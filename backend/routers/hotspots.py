from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, StreamingResponse
from auth import current_user
from data_store import store
import io
import csv

router = APIRouter(tags=["hotspots"])

@router.get("/hotspots")
async def hotspots(_=Depends(current_user)):
    return store.sorted_by_risk()

@router.get("/heatmap/render", response_class=HTMLResponse)
async def heatmap_render(_=Depends(current_user)):
    import folium
    from folium.plugins import HeatMap

    rows = store.sorted_by_risk()
    max_score = max((r["risk_score"] for r in rows), default=1) or 1
    heat_data = [[h["lat"], h["lng"], h["risk_score"] / max_score] for h in rows]

    m = folium.Map(location=[12.9716, 77.5946], zoom_start=12, tiles="OpenStreetMap", control_scale=True)
    HeatMap(heat_data, min_opacity=0.45, max_zoom=16, radius=50, blur=40,
            gradient={"0.0": "#0000ff", "0.25": "#00ffff", "0.45": "#00ff00",
                      "0.65": "#ffff00", "0.82": "#ff8800", "1.0": "#ff0000"}).add_to(m)

    lc = {"Critical": "#A0141E", "High": "#C05000", "Moderate": "#C08000", "Low": "#2E7D32"}
    for h in rows:
        c = lc[h["risk_level"]]
        popup = f"""<div style="font-family:'Times New Roman',serif;min-width:200px;padding:4px">
          <div style="font-size:15px;font-weight:700;margin-bottom:4px">{h['junction']}</div>
          <div style="font-size:12px;color:#555;margin-bottom:8px">{h.get('zone','')}</div>
          <table style="font-size:13px;width:100%">
            <tr><td style="color:#444">Predicted violations</td><td style="text-align:right;font-weight:600">{h['predicted_violations']}</td></tr>
            <tr><td style="color:#444">Risk score (PCII)</td><td style="text-align:right;font-weight:600">{h['risk_score']}</td></tr>
          </table>
          <div style="margin-top:8px;display:inline-block;padding:2px 10px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;border:1px solid {c}55;color:{c};background:{c}18">{h['risk_level']}</div>
        </div>"""
        folium.CircleMarker(location=[h["lat"], h["lng"]], radius=5, color=c, fill=True,
            fill_color=c, fill_opacity=0.9, weight=1.5,
            popup=folium.Popup(popup, max_width=240), tooltip=h["junction"]).add_to(m)

    html = m._repr_html_()
    return HTMLResponse(f'<!DOCTYPE html><html><head><meta charset="utf-8"/><style>html,body{{margin:0;padding:0;width:100%;height:100%;}}</style></head><body>{html}</body></html>')

@router.get("/hotspots-public")
async def hotspots_public():
    # unauthenticated feed, used by officer app's in-WebView heatmap
    return store.sorted_by_risk()

@router.get("/reports/csv")
async def export_csv(_=Depends(current_user)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Junction", "Zone", "Predicted Violations", "Risk Score", "Risk Level", "Forecast Time"])
    for h in store.sorted_by_risk():
        writer.writerow([h["junction"], h.get("zone", ""), h["predicted_violations"],
                          h["risk_score"], h["risk_level"], h.get("forecast_datetime", "")])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=intellipark_report.csv"})

@router.post("/model/retrain")
async def retrain(_=Depends(current_user)):
    store.reload()
    return {"ok": True, "metrics": store.metrics, "hotspot_count": len(store.hotspots)}
