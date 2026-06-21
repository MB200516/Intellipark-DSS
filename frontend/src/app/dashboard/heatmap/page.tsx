'use client';
import { useEffect, useState, useRef } from 'react';
import api from '@/lib/api';
import { RiskBadge } from '@/components/RiskBadge';

interface Hotspot {
  id: number; junction: string; zone: string;
  lat: number; lng: number;
  predicted_violations: number; risk_score: number; risk_level: string;
}

const LEVEL_COLORS: Record<string, string> = {
  Critical: '#B71C1C', High: '#E65100', Moderate: '#D4A017', Low: '#2E7D32',
};

export default function HeatmapPage() {
  const [hotspots, setHotspots]     = useState<Hotspot[]>([]);
  const [selected, setSelected]     = useState<Hotspot | null>(null);
  const [loading, setLoading]       = useState(true);
  const [mapUrl, setMapUrl]         = useState('');
  const [filter, setFilter]         = useState('All');
  const iframeRef                   = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Load sidebar hotspot list
    api.get('/hotspots')
      .then((r) => setHotspots(r.data))
      .finally(() => setLoading(false));

    // Build iframe src — pass token as query param so backend can auth the iframe request
    const token = localStorage.getItem('intellipark_token') || '';
    // We'll fetch the HTML and blob-URL it so the token stays in the header
    fetchMap(token);
  }, []);

  async function fetchMap(token: string) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/heatmap/render`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      setMapUrl(URL.createObjectURL(blob));
    } catch {
      setMapUrl('');
    }
  }

  const filtered = filter === 'All' ? hotspots : hotspots.filter((h) => h.risk_level === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Violation Heatmap</div>
          <div className="page-subtitle">Kernel density heatmap of predicted parking violation hotspots across Bengaluru</div>
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {['All', 'Critical', 'High', 'Moderate', 'Low'].map((l) => (
            <button
              key={l}
              onClick={() => setFilter(l)}
              style={{
                padding: '0.35rem 0.9rem', fontSize: '0.82rem',
                background: filter === l ? (LEVEL_COLORS[l] || '#8B1E2D') : '#fff',
                color: filter === l ? '#fff' : '#111',
                border: '1px solid rgba(0,0,0,0.12)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >{l}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Folium iframe map ── */}
        <div style={{ flex: 1, position: 'relative', background: '#e8e4dc' }}>
          {!mapUrl ? (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '0.95rem', color: '#444',
            }}>
              Generating heatmap...
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={mapUrl}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title="IntelliPark Heatmap"
            />
          )}
        </div>

        {/* ── Side panel ── */}
        <div style={{
          width: 290, background: '#fff',
          borderLeft: '1px solid rgba(0,0,0,0.09)',
          overflow: 'auto', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
        }}>
          {selected ? (
            <div style={{ padding: '1.4rem' }}>
              <div style={{ fontSize: '0.72rem', letterSpacing: '0.16em', color: '#444', textTransform: 'uppercase', marginBottom: '0.9rem' }}>
                Selected Location
              </div>
              <div style={{ fontSize: '1.15rem', color: '#111', lineHeight: 1.3, marginBottom: '0.25rem' }}>{selected.junction}</div>
              <div style={{ fontSize: '0.9rem', color: '#444', marginBottom: '1.2rem' }}>{selected.zone}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
                {[{ label: 'Predicted', value: selected.predicted_violations }, { label: 'Risk Score', value: selected.risk_score }].map((s) => (
                  <div key={s.label} style={{ background: '#fff', padding: '0.9rem' }}>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.12em', color: '#444', textTransform: 'uppercase', marginBottom: '0.3rem' }}>{s.label}</div>
                    <div style={{ fontSize: '1.6rem', color: '#111' }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <RiskBadge level={selected.risk_level} />
              <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(139,30,45,0.04)', borderLeft: '2px solid #8B1E2D' }}>
                <div style={{ fontSize: '0.72rem', color: '#444' }}>Coordinates</div>
                <div style={{ fontSize: '0.88rem', color: '#111', marginTop: '0.2rem' }}>{selected.lat.toFixed(4)}N, {selected.lng.toFixed(4)}E</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  marginTop: '1rem', width: '100%', padding: '0.55rem',
                  fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase',
                  background: 'none', border: '1px solid rgba(0,0,0,0.15)', color: '#444',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >Clear Selection</button>
            </div>
          ) : (
            <div style={{ padding: '1.4rem', flex: 1 }}>
              <div style={{ fontSize: '0.72rem', letterSpacing: '0.16em', color: '#444', textTransform: 'uppercase', marginBottom: '1rem' }}>
                {loading ? 'Loading...' : `Locations (${filtered.length})`}
              </div>
              {filtered.map((h) => (
                <div
                  key={h.id}
                  onClick={() => setSelected(h)}
                  style={{
                    padding: '0.75rem 0.9rem', marginBottom: 1,
                    background: '#F5F3EE', cursor: 'pointer',
                    borderLeft: `3px solid ${LEVEL_COLORS[h.risk_level] || '#8B1E2D'}`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#ede9e1')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#F5F3EE')}
                >
                  <div style={{ fontSize: '0.93rem', color: '#111' }}>{h.junction}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.82rem', color: '#444' }}>{h.zone}</span>
                    <span style={{ fontSize: '0.82rem', color: LEVEL_COLORS[h.risk_level], fontWeight: 600 }}>{h.risk_score}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gradient legend */}
          <div style={{ padding: '1rem 1.4rem', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.14em', color: '#444', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Intensity Scale</div>
            <div style={{ display: 'flex', height: 10, marginBottom: '0.4rem' }}>
              {['#0000ff','#00ffff','#00ff00','#ffff00','#ff8800','#ff0000'].map((c, i) => (
                <div key={i} style={{ flex: 1, background: c }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#111' }}>
              <span>Low</span><span>Moderate</span><span>Critical</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
