import pandas as pd
import os
from datetime import datetime

FEEDBACK_PATH = os.path.join(os.path.dirname(__file__), "data", "feedback.csv")

def log_violation(junction_name, lat, lng, violation_type, vehicle_type, severity_weight, vehicle_weight):
    # appends one officer-confirmed violation, picked up on next retrain
    row = pd.DataFrame([{
        "junction_name": junction_name, "latitude": lat, "longitude": lng,
        "violation_type": violation_type, "vehicle_type": vehicle_type,
        "created_datetime": datetime.now().isoformat(),
        "severity_weight": severity_weight, "vehicle_weight": vehicle_weight,
    }])
    os.makedirs(os.path.dirname(FEEDBACK_PATH), exist_ok=True)
    if os.path.exists(FEEDBACK_PATH):
        row.to_csv(FEEDBACK_PATH, mode="a", header=False, index=False)
    else:
        row.to_csv(FEEDBACK_PATH, index=False)

def merge_feedback_into_training(raw_df):
    if os.path.exists(FEEDBACK_PATH):
        fb = pd.read_csv(FEEDBACK_PATH)
        raw_df = pd.concat([raw_df, fb], ignore_index=True)
        print(f"[Feedback] merged {len(fb)} officer-logged violations into training data")
    return raw_df

def feedback_count():
    if os.path.exists(FEEDBACK_PATH):
        return len(pd.read_csv(FEEDBACK_PATH))
    return 0
