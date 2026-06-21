"""
IntelliPark Model Engine
========================
This is the model logic extracted directly from gl2.ipynb.

HOW IT WORKS:
  1. Place your raw CSV  →  backend/data/violations.csv
     (the file named "jan to may police violation_anonymized791b166.csv" from your notebook)
  2. On startup, the backend calls run_pipeline() which:
       - Cleans + engineers features exactly as in your notebook
       - Trains the LightGBM model
       - Predicts violations for the next 14 days per junction
       - Computes PCII risk scores
       - Returns a list of hotspot dicts ready for the API
  3. Results are cached in memory — no re-training on every request.

If the raw CSV is not present, returns None and the fallback data is used.
"""

import os
import json
import warnings
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

warnings.filterwarnings("ignore")

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
RAW_CSV  = os.path.join(DATA_DIR, "jan to may police violation_anonymized791b166.csv")  # ← PUT YOUR CSV HERE

SEVERITY_MAP = {
    "PARKING IN A MAIN ROAD": 5,
    "PARKING ON FOOTPATH":    4,
    "NO PARKING":             3,
    "WRONG PARKING":          2,
    "DEFECTIVE NUMBER PLATE": 1,
}

VEHICLE_WEIGHT = {
    "PRIVATE BUS": 5, "PUBLIC BUS": 5,
    "TIPPER": 4, "LGV": 4, "HGV": 4, "TRUCK": 4,
    "MAXI-CAB": 3, "VAN": 3, "PRIVATE MINI BUS": 3,
    "CAR": 2, "PASSENGER AUTO": 2, "GOODS AUTO": 2,
    "SCOOTER": 1, "MOTOR CYCLE": 1, "MOPED": 1,
}

FEATURE_COLS = [
    "junction_id", "dow", "month", "week", "is_weekend", "day_of_month", "month_part",
    "lag_1", "lag_2", "lag_3", "lag_7", "lag_14",
    "roll_mean_3", "roll_mean_7", "roll_mean_14",
    "roll_std_3",  "roll_std_7",  "roll_std_14",
    "roll_max_3",  "roll_max_7",  "roll_max_14",
    "ewm_3", "ewm_7", "ewm_14",
    "trend_signal", "above_avg_flag", "junction_avg",
    "avg_severity", "avg_vehicle_wt", "unique_vehicles",
]
CAT_COLS = ["junction_id", "dow", "month", "is_weekend"]
TARGET   = "violations"


def _severity_score(vt_str):
    try:
        viols = json.loads(vt_str)
    except Exception:
        viols = [str(vt_str).strip()]
    return max(SEVERITY_MAP.get(v.strip(), 1) for v in viols)


def _infer_zone(lat, lng):
    if lat > 13.0:                  return "North"
    if lat < 12.88:                 return "South"
    if lng > 77.68:                 return "East"
    if lng < 77.54:                 return "West"
    if lat > 12.96 and lng > 77.60: return "North East"
    if lat > 12.96:                 return "Central"
    if lng > 77.62:                 return "South East"
    return "South"


def compute_hourly_distribution(df, hotspot_set):
    # fraction of each junction's daily violations that historically occur per hour
    hourly = df[df["junction_name"].isin(hotspot_set)].groupby(
        ["junction_name", "hour"]
    ).size().reset_index(name="count")
    totals = hourly.groupby("junction_name")["count"].transform("sum")
    hourly["fraction"] = hourly["count"] / totals
    dist = {}
    for jname, grp in hourly.groupby("junction_name"):
        dist[jname] = dict(zip(grp["hour"], grp["fraction"]))
    return dist


def run_pipeline():
    """
    Full pipeline: load raw CSV → engineer features → train LightGBM → predict → return hotspots.
    Returns (hotspot_list, metrics_dict) or (None, None) if raw CSV is missing.
    """
    if not os.path.exists(RAW_CSV):
        print(f"[ModelEngine] {RAW_CSV} not found — skipping model training.")
        return None, None

    print("[ModelEngine] Loading raw violation data...")
    df = pd.read_csv(RAW_CSV)

    from feedback import merge_feedback_into_training
    df = merge_feedback_into_training(df)
    print(f"[ModelEngine] Raw records: {len(df):,}")

    # ── 1. Parse & clean ──────────────────────────────────────────────
    df["created_datetime"] = pd.to_datetime(df["created_datetime"], format="ISO8601", utc=True)
    df["created_datetime"] = df["created_datetime"].dt.tz_convert("Asia/Kolkata")
    df = df.dropna(subset=["junction_name", "vehicle_type", "violation_type", "latitude", "longitude"])
    df = df[df["junction_name"] != "No Junction"]

    df["date"]         = df["created_datetime"].dt.date
    df["hour"]         = df["created_datetime"].dt.hour
    df["dow"]          = df["created_datetime"].dt.dayofweek
    df["month"]        = df["created_datetime"].dt.month
    df["week"]         = df["created_datetime"].dt.isocalendar().week.astype(int)
    df["is_weekend"]   = (df["dow"] >= 5).astype(int)
    df["day_of_month"] = df["created_datetime"].dt.day

    print(f"[ModelEngine] Clean records: {len(df):,} | Junctions: {df['junction_name'].nunique()}")

    # ── 2. Severity & vehicle weights ─────────────────────────────────
    df["severity_weight"] = df["violation_type"].apply(_severity_score)
    df["vehicle_weight"]  = df["vehicle_type"].map(VEHICLE_WEIGHT).fillna(1.5)

    # ── 3. Junction stats & PCII ──────────────────────────────────────
    total_days = df["date"].nunique()
    junction_stats = df.groupby("junction_name").agg(
        total_violations   =("id", "count"),
        avg_severity       =("severity_weight", "mean"),
        avg_vehicle_wt     =("vehicle_weight", "mean"),
        lat                =("latitude", "median"),
        lon                =("longitude", "median"),
        unique_days_active =("date", "nunique"),
        peak_hour          =("hour", lambda x: x.mode()[0]),
        weekend_pct        =("is_weekend", "mean"),
        unique_vehicles    =("vehicle_type", "nunique"),
    ).reset_index()

    junction_stats["daily_avg"] = junction_stats["total_violations"] / total_days

    freq_rank = junction_stats["daily_avg"].rank(pct=True)
    activity  = junction_stats["unique_days_active"] / total_days

    raw_pcii = (
        freq_rank *
        junction_stats["avg_severity"] *
        junction_stats["avg_vehicle_wt"] *
        (0.7 + 0.3 * activity)
    )
    junction_stats["PCII"] = (
        (raw_pcii - raw_pcii.min()) /
        (raw_pcii.max() - raw_pcii.min()) * 100
    ).round(2)

    junction_stats = junction_stats.sort_values("PCII", ascending=False).reset_index(drop=True)
    junction_stats["current_rank"] = junction_stats.index + 1

    threshold   = junction_stats["total_violations"].quantile(0.20)
    hotspot_set = set(junction_stats[junction_stats["total_violations"] >= threshold]["junction_name"])

    print(f"[ModelEngine] Hotspot junctions: {len(hotspot_set)}")

    # ── 4. Daily time-series aggregation ──────────────────────────────
    df["date"] = pd.to_datetime(df["date"])
    daily = df.groupby(["junction_name", "date"]).agg(
        violations     =("id", "count"),
        avg_severity   =("severity_weight", "mean"),
        avg_vehicle_wt =("vehicle_weight", "mean"),
        unique_vehicles=("vehicle_type", "nunique"),
    ).reset_index()

    ts_df = daily[daily["junction_name"].isin(hotspot_set)].copy()

    # ── 5. Feature engineering ────────────────────────────────────────
    ts_df = ts_df.sort_values(["junction_name", "date"]).reset_index(drop=True)

    ts_df["dow"]          = ts_df["date"].dt.dayofweek
    ts_df["month"]        = ts_df["date"].dt.month
    ts_df["week"]         = ts_df["date"].dt.isocalendar().week.astype(int)
    ts_df["is_weekend"]   = (ts_df["dow"] >= 5).astype(int)
    ts_df["day_of_month"] = ts_df["date"].dt.day
    ts_df["month_part"]   = pd.cut(ts_df["date"].dt.day, bins=[0, 10, 20, 31],
                                    labels=[0, 1, 2]).astype(float)

    for lag in [1, 2, 3, 7, 14]:
        ts_df[f"lag_{lag}"] = ts_df.groupby("junction_name")["violations"].shift(lag)

    for w in [3, 7, 14]:
        ts_df[f"roll_mean_{w}"] = ts_df.groupby("junction_name")["violations"].transform(
            lambda x: x.shift(1).rolling(w, min_periods=1).mean())
        ts_df[f"roll_std_{w}"]  = ts_df.groupby("junction_name")["violations"].transform(
            lambda x: x.shift(1).rolling(w, min_periods=1).std().fillna(0))
        ts_df[f"roll_max_{w}"]  = ts_df.groupby("junction_name")["violations"].transform(
            lambda x: x.shift(1).rolling(w, min_periods=1).max())

    for span in [3, 7, 14]:
        ts_df[f"ewm_{span}"] = ts_df.groupby("junction_name")["violations"].transform(
            lambda x: x.shift(1).ewm(span=span).mean())

    ts_df["trend_signal"] = (
        ts_df.groupby("junction_name")["violations"].transform(
            lambda x: x.shift(1).rolling(3, min_periods=1).mean()) -
        ts_df.groupby("junction_name")["violations"].transform(
            lambda x: x.shift(1).rolling(14, min_periods=1).mean())
    )
    ts_df["junction_avg"]   = ts_df.groupby("junction_name")["violations"].transform("mean")
    ts_df["above_avg_flag"] = (
        ts_df.groupby("junction_name")["violations"].transform(
            lambda x: x.shift(1).rolling(7, min_periods=1).mean()) > ts_df["junction_avg"]
    ).astype(int)

    le = LabelEncoder()
    ts_df["junction_id"] = le.fit_transform(ts_df["junction_name"])

    ts_feat = ts_df.dropna().reset_index(drop=True)

    # ── 6. Train/val split & LightGBM training ───────────────────────
    import lightgbm as lgb

    cutoff_date = ts_feat["date"].max() - pd.Timedelta(days=14)
    train = ts_feat[ts_feat["date"] <= cutoff_date]
    val   = ts_feat[ts_feat["date"] >  cutoff_date]

    X_train, y_train = train[FEATURE_COLS], train[TARGET]
    X_val,   y_val   = val[FEATURE_COLS],   val[TARGET]

    dtrain = lgb.Dataset(X_train, label=y_train, categorical_feature=CAT_COLS, free_raw_data=False)
    dval   = lgb.Dataset(X_val,   label=y_val,   categorical_feature=CAT_COLS, reference=dtrain, free_raw_data=False)

    params = {
        "objective":         "regression_l1",
        "metric":            ["mae", "rmse"],
        "learning_rate":     0.05,
        "num_leaves":        63,
        "max_depth":         7,
        "min_child_samples": 10,
        "feature_fraction":  0.8,
        "bagging_fraction":  0.8,
        "bagging_freq":      5,
        "lambda_l1":         0.1,
        "lambda_l2":         1.0,
        "verbose":           -1,
        "seed":              42,
    }

    print("[ModelEngine] Training LightGBM...")
    model = lgb.train(
        params, dtrain,
        num_boost_round=1000,
        valid_sets=[dval],
        callbacks=[lgb.early_stopping(40, verbose=False), lgb.log_evaluation(period=-1)],
    )

    val_pred = np.maximum(0, model.predict(X_val, num_iteration=model.best_iteration))
    mae  = mean_absolute_error(y_val, val_pred)
    rmse = mean_squared_error(y_val, val_pred) ** 0.5
    r2   = r2_score(y_val, val_pred)
    mape = np.mean(np.abs((y_val - val_pred) / np.where(y_val == 0, 1, y_val))) * 100
    acc  = max(0, 100 - mape)

    metrics = {"mae": round(mae, 2), "rmse": round(rmse, 2),
               "r2": round(r2, 4), "mape": round(mape, 2), "accuracy": round(acc, 2)}
    print(f"[ModelEngine] Accuracy: {acc:.2f}%  MAE: {mae:.2f}  R2: {r2:.4f}")

    # predict tomorrow's daily total, one day ahead only, not 14 days
    last_date = ts_feat["date"].max()
    next_day = last_date + pd.Timedelta(days=1)
    junctions = ts_feat["junction_name"].unique()

    future_rows = []
    for jname in junctions:
        jdata = ts_feat[ts_feat["junction_name"] == jname].sort_values("date")
        if len(jdata) == 0:
            continue
        last_row = jdata.iloc[-1].copy()
        row = {
            "junction_name": jname, "date": next_day,
            "junction_id": last_row["junction_id"],
            "dow": next_day.dayofweek, "month": next_day.month,
            "week": int(next_day.isocalendar()[1]),
            "is_weekend": int(next_day.dayofweek >= 5),
            "day_of_month": next_day.day,
            "month_part": 0 if next_day.day <= 10 else (1 if next_day.day <= 20 else 2),
            "junction_avg": last_row["junction_avg"],
            "above_avg_flag": last_row["above_avg_flag"],
            "avg_severity": last_row["avg_severity"],
            "avg_vehicle_wt": last_row["avg_vehicle_wt"],
            "unique_vehicles": last_row["unique_vehicles"],
        }
        for col in FEATURE_COLS:
            if col not in row:
                row[col] = last_row.get(col, 0)
        future_rows.append(row)

    future_df = pd.DataFrame(future_rows)
    X_future = future_df[FEATURE_COLS].fillna(0)
    future_df["predicted_violations"] = np.maximum(
        0, model.predict(X_future, num_iteration=model.best_iteration)
    )
    daily_pred = dict(zip(future_df["junction_name"], future_df["predicted_violations"]))

    hotspot_set_final = set(junctions)
    hourly_dist = compute_hourly_distribution(df, hotspot_set_final)

    jstats = junction_stats.set_index("junction_name")

    trend_last = ts_df.sort_values("date").groupby("junction_name")["trend_signal"].last()
    gt_min, gt_max = trend_last.min(), trend_last.max()

    def norm_trend(v):
        if gt_max == gt_min: return 12.0
        return round(((v - gt_min) / (gt_max - gt_min)) * 25, 1)

    def risk_level(score):
        if score >= 75: return "Critical"
        if score >= 50: return "High"
        if score >= 25: return "Moderate"
        return "Low"

    now = datetime.now()
    hotspots = []
    record_id = 1

    for jname, daily_total in daily_pred.items():
        if jname not in jstats.index:
            continue
        js = jstats.loc[jname]
        pcii = float(js["PCII"])
        lat, lng = float(js["lat"]), float(js["lon"])
        gt = norm_trend(trend_last.get(jname, 0))
        sev = round(float(js["avg_severity"]) / 5 * 100, 1)
        dist = hourly_dist.get(jname, {})

        # disaggregate the daily total into next 12 hours, skip hours with no predicted activity
        for hour_offset in range(1, 13):
            target_dt = now + timedelta(hours=hour_offset)
            hr = target_dt.hour
            frac = dist.get(hr, 1 / 24)
            hourly_pred = max(0, round(daily_total * frac))
            if hourly_pred == 0:
                continue

            hotspots.append({
                "id": record_id,
                "junction": jname, "lat": lat, "lng": lng,
                "zone": _infer_zone(lat, lng),
                "predicted_violations": int(hourly_pred),
                "forecast_datetime": target_dt.isoformat(),
                "forecast_hour": hr,
                "historical_density": int(js["total_violations"]),
                "severity": sev, "growth_trend": gt,
                "risk_score": pcii, "risk_level": risk_level(pcii),
                "peak_hour": int(js["peak_hour"]),
                "weekend_pct": round(float(js["weekend_pct"]), 3),
            })
            record_id += 1

    hotspots.sort(key=lambda x: x["risk_score"], reverse=True)

    # Re-number IDs after sort
    for i, h in enumerate(hotspots):
        h["id"] = i + 1

    print(f"[ModelEngine] Pipeline complete. {len(hotspots)} hotspots ready.")
    return hotspots, metrics
