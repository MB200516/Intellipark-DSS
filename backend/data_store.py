import numpy as np
import os
from datetime import datetime, timedelta
from model_engine import run_pipeline

# ── Download CSV from Azure Blob Storage if not already present ──
def _download_csv_if_needed():
    from model_engine import RAW_CSV, DATA_DIR
    if os.path.exists(RAW_CSV):
        print("[DataStore] CSV already present, skipping download.")
        return
    conn_str = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not conn_str:
        print("[DataStore] No AZURE_STORAGE_CONNECTION_STRING set, skipping download.")
        return
    try:
        from azure.storage.blob import BlobServiceClient
        print("[DataStore] Downloading CSV from Azure Blob Storage...")
        os.makedirs(DATA_DIR, exist_ok=True)
        client = BlobServiceClient.from_connection_string(conn_str)
        blob = client.get_blob_client(
            container="data",
            blob="jan to may violations compressed.csv.gz"
        )
        with open(RAW_CSV, "wb") as f:
            f.write(blob.download_blob().readall())
        print("[DataStore] CSV downloaded successfully.")
    except Exception as e:
        print(f"[DataStore] Failed to download CSV: {e}")

_download_csv_if_needed()

def _fallback_with_forecast():
    now = datetime.now()
    raw = [
        {"id":1, "junction":"KR Market Junction",    "lat":12.9698,"lng":77.5765,"zone":"Central",    "predicted_violations":12,"historical_density":562, "severity":91.0,"growth_trend":12.0,"risk_score":88.2,"risk_level":"Critical","peak_hour":11,"weekend_pct":0.30,"hour_offset":1},
        {"id":2, "junction":"Silk Board Junction",   "lat":12.9176,"lng":77.6233,"zone":"South",      "predicted_violations":9, "historical_density":733, "severity":85.0,"growth_trend":18.0,"risk_score":83.5,"risk_level":"Critical","peak_hour":9, "weekend_pct":0.28,"hour_offset":2},
        {"id":3, "junction":"Hebbal Flyover",         "lat":13.0351,"lng":77.5953,"zone":"North",      "predicted_violations":7, "historical_density":618, "severity":74.0,"growth_trend":9.0, "risk_score":72.8,"risk_level":"High",    "peak_hour":8, "weekend_pct":0.25,"hour_offset":3},
        {"id":4, "junction":"Marathahalli Bridge",   "lat":12.9591,"lng":77.6974,"zone":"East",       "predicted_violations":8, "historical_density":155, "severity":80.0,"growth_trend":14.0,"risk_score":79.4,"risk_level":"High",    "peak_hour":10,"weekend_pct":0.32,"hour_offset":1},
        {"id":5, "junction":"Koramangala 5th Block", "lat":12.9352,"lng":77.6245,"zone":"South East", "predicted_violations":6, "historical_density":1329,"severity":70.0,"growth_trend":7.0, "risk_score":65.3,"risk_level":"High",    "peak_hour":12,"weekend_pct":0.35,"hour_offset":4},
        {"id":6, "junction":"MG Road & Brigade Rd",  "lat":12.9757,"lng":77.6096,"zone":"Central",    "predicted_violations":10,"historical_density":293, "severity":93.0,"growth_trend":5.0, "risk_score":87.9,"risk_level":"Critical","peak_hour":14,"weekend_pct":0.40,"hour_offset":2},
        {"id":7, "junction":"Yeshwanthpur Circle",   "lat":13.0213,"lng":77.5530,"zone":"North West", "predicted_violations":5, "historical_density":2785,"severity":57.0,"growth_trend":11.0,"risk_score":55.4,"risk_level":"High",    "peak_hour":9, "weekend_pct":0.22,"hour_offset":5},
        {"id":8, "junction":"Electronic City Toll",  "lat":12.8456,"lng":77.6603,"zone":"South",      "predicted_violations":6, "historical_density":169, "severity":65.0,"growth_trend":20.0,"risk_score":67.8,"risk_level":"High",    "peak_hour":8, "weekend_pct":0.20,"hour_offset":3},
        {"id":9, "junction":"Jayanagar 4th Block",   "lat":12.9250,"lng":77.5938,"zone":"South",      "predicted_violations":3, "historical_density":149, "severity":48.0,"growth_trend":4.0, "risk_score":42.7,"risk_level":"Moderate","peak_hour":11,"weekend_pct":0.33,"hour_offset":6},
        {"id":10,"junction":"Whitefield Main Rd",    "lat":12.9698,"lng":77.7499,"zone":"East",       "predicted_violations":5, "historical_density":167, "severity":61.0,"growth_trend":16.0,"risk_score":60.2,"risk_level":"High",    "peak_hour":9, "weekend_pct":0.28,"hour_offset":4},
    ]
    for r in raw:
        dt = now + timedelta(hours=r.pop("hour_offset"))
        r["forecast_datetime"] = dt.isoformat()
        r["forecast_hour"] = dt.hour
    return raw

FALLBACK_HOTSPOTS = _fallback_with_forecast()

PATROL_UNITS = [
    {"id":"A1","name":"Unit Alpha-1","officer":"SI Pradeep Nair",  "lat":12.9730,"lng":77.5830,"status":"Available"},
    {"id":"A2","name":"Unit Alpha-2","officer":"HC Sunita Reddy",  "lat":12.9200,"lng":77.6100,"status":"Available"},
    {"id":"B1","name":"Unit Bravo-1","officer":"SI Mohan Gowda",   "lat":13.0300,"lng":77.6000,"status":"Available"},
    {"id":"B2","name":"Unit Bravo-2","officer":"ASI Kavitha R.",   "lat":12.9580,"lng":77.7000,"status":"On Patrol"},
    {"id":"C1","name":"Unit Charlie-1","officer":"HC Rajan M.",    "lat":12.8500,"lng":77.6600,"status":"Available"},
]
PATROL_UNITS_DEFAULT = {u["id"]: u for u in PATROL_UNITS}

class Store:
    def __init__(self):
        self.hotspots = []
        self.using_real_data = False
        self.metrics = {"accuracy": 85.72, "mae": 1.63, "rmse": 7.68, "r2": 0.5712}
        self.reload()

    def reload(self):
        result, metrics = run_pipeline()
        if result:
            self.hotspots = result
            self.metrics = metrics
            self.using_real_data = True
        else:
            self.hotspots = FALLBACK_HOTSPOTS
            self.using_real_data = False

    def sorted_by_risk(self):
        return sorted(self.hotspots, key=lambda x: x["risk_score"], reverse=True)

store = Store()

def haversine(la1, ln1, la2, ln2):
    R = 6371
    p1, p2 = np.radians(la1), np.radians(la2)
    a = np.sin(np.radians(la2-la1)/2)**2 + np.cos(p1)*np.cos(p2)*np.sin(np.radians(ln2-ln1)/2)**2
    return round(2*R*np.arcsin(np.sqrt(a)), 2)
