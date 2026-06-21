'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function ReportsPage() {
  const [kpi, setKpi] = useState<any>(null);
  const [byZone, setByZone] = useState<any[]>([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get('/dashboard/kpi').then((r) => setKpi(r.data));
    api.get('/dashboard/chart/by-zone').then((r) => setByZone(r.data));
  }, []);

  const handleDownloadCsv = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('intellipark_token') || '';
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/reports/csv`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `intellipark_report_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">Export current hotspot forecast data for filing or record keeping</div>
        </div>
      </div>

      <div style={{ padding:'1.8rem 2.2rem', display:'flex', flexDirection:'column', gap:'1.5rem' }}>

        <div className="section-card-v2">
          <div className="section-header"><span className="section-title">Export Today's Forecast</span></div>
          <div style={{ padding:'1.8rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <div style={{ fontSize:'1.05rem', fontWeight:700, color:'#111', marginBottom:'0.3rem' }}>
                Hotspot Prediction Report (CSV)
              </div>
              <div style={{ fontSize:'0.9rem', color:'#666' }}>
                {kpi ? `${kpi.total_hotspots} forecasted events, generated ${kpi.last_updated}` : 'Loading...'}
              </div>
            </div>
            <button onClick={handleDownloadCsv} disabled={downloading} style={{
              padding:'0.8rem 1.6rem', fontSize:'0.92rem', fontWeight:700,
              background: downloading ? '#6B0F17' : '#A0141E', color:'#fff',
              border:'none', cursor: downloading ? 'not-allowed' : 'pointer',
              fontFamily:'inherit', borderRadius:2,
            }}>
              {downloading ? 'Preparing...' : 'Download CSV'}
            </button>
          </div>
        </div>

        <div className="section-card-v2">
          <div className="section-header"><span className="section-title">Summary by Zone</span></div>
          <table className="data-table">
            <thead><tr><th>Zone</th><th>Hotspot Count</th><th>Total Predicted Violations</th></tr></thead>
            <tbody>
              {byZone.map((z) => (
                <tr key={z.zone}>
                  <td style={{ fontWeight:700 }}>{z.zone}</td>
                  <td>{z.hotspot_count}</td>
                  <td style={{ fontWeight:700 }}>{z.predicted_violations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section-card-v2">
          <div className="section-header"><span className="section-title">Model Feedback Loop</span></div>
          <div style={{ padding:'1.5rem', fontSize:'0.95rem', color:'#444', lineHeight:1.7 }}>
            {kpi?.feedback_logged ?? 0} officer-confirmed violations have been logged since the last retrain.
            These are merged into the training set automatically the next time the model is retrained,
            improving prediction accuracy over time as real enforcement outcomes come in.
          </div>
        </div>

      </div>
    </div>
  );
}
