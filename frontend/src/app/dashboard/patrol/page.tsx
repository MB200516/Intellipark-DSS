'use client';
import { useEffect, useState, useRef } from 'react';
import api from '@/lib/api';
import { RiskBadge } from '@/components/RiskBadge';

interface Hotspot {
  id: number; junction: string; zone: string;
  risk_score: number; risk_level: string; predicted_violations: number;
}
interface Officer {
  id: string; name: string; badge: string; unit_name: string;
  status: string; lat: number | null; lng: number | null; online: boolean;
  loc_timestamp?: string | null;
}
interface Assignment {
  id: number; hotspot_id: number; junction: string; officer_id: string;
  officer_name: string; unit_name: string; road_distance_km: number;
  eta_minutes: number; status: string; assigned_at: string;
}

const STATUS_COLORS: Record<string,string> = {
  available: '#2E7D32', on_patrol: '#C05000', dispatched: '#A0141E', off_duty: '#888',
};
const STATUS_LABELS: Record<string,string> = {
  available: 'Available', on_patrol: 'On Patrol', dispatched: 'Dispatched', off_duty: 'Off Duty',
};
const ASSIGN_STATUS_COLORS: Record<string,string> = {
  pending: '#C08000', accepted: '#1565C0', en_route: '#1565C0',
  arrived: '#6A1B9A', completed: '#2E7D32', declined: '#A0141E',
};

export default function PatrolPage() {
  const [hotspots,    setHotspots]    = useState<Hotspot[]>([]);
  const [officers,    setOfficers]    = useState<Officer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [assigning,   setAssigning]   = useState<number | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const loadAll = async () => {
    const [h, o, a] = await Promise.all([
      api.get('/hotspots'),
      api.get('/officers'),
      api.get('/assignments'),
    ]);
    setHotspots(h.data);
    setOfficers(o.data);
    setAssignments(a.data);
  };

  useEffect(() => {
    loadAll().finally(() => setLoading(false));

    const token = localStorage.getItem('intellipark_token') || '';
    const wsUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      .replace('http://', 'ws://').replace('https://', 'wss://') + '/ws/dashboard';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen  = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'officer_location') {
          setOfficers((prev) => prev.map((o) =>
            o.id === msg.officer_id ? { ...o, lat: msg.lat, lng: msg.lng, online: true } : o
          ));
        }
        if (msg.type === 'officer_status') {
          setOfficers((prev) => prev.map((o) =>
            o.id === msg.officer_id ? { ...o, status: msg.status, online: msg.status !== 'off_duty' } : o
          ));
        }
        if (msg.type === 'assignment_update') {
          loadAll();
        }
      } catch {}
    };

    return () => ws.close();
  }, []);

  const handleAssign = async (hotspotId: number) => {
    setAssigning(hotspotId);
    try {
      await api.post(`/assignments/create?hotspot_id=${hotspotId}`);
      await loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Could not find an available unit');
    } finally {
      setAssigning(null);
    }
  };

  const handleRelease = async (officerId: string) => {
    try {
      await api.post(`/officers/${officerId}/release`);
      await loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Could not release unit');
    }
  };

  const assignedHotspotIds = new Set(
    assignments
      .filter((a) => ['pending','accepted','en_route','arrived'].includes(a.status))
      .map((a) => a.hotspot_id)
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Patrol Assignments</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <div style={{ width:9, height:9, borderRadius:'50%', background: wsConnected ? '#2E7D32' : '#A0141E' }} />
            <span style={{ fontSize:'0.85rem', fontWeight:700, color:'#444' }}>
              {wsConnected ? 'Live Tracking' : 'Reconnecting'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding:'2rem 2.2rem', display:'flex', flexDirection:'column', gap:'2rem' }}>

        {/* Officer App Download Banner */}
        <div style={{
          padding:'1rem 1.5rem', background:'#1565C0', color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          flexWrap:'wrap', gap:'0.5rem',
        }}>
          <div>
            <div style={{ fontWeight:700, fontSize:'0.95rem', letterSpacing:'0.05em', textTransform:'uppercase' }}>
              📱 Officer Mobile App
            </div>
            <div style={{ fontSize:'0.85rem', opacity:0.85, marginTop:'0.2rem' }}>
              Download the app on your Android device to coordinate patrol assignments in the field.
              Login with your badge number and password <strong>officer123</strong>.
            </div>
          </div>
          
            href="https://expo.dev/artifacts/eas/y8ZtghJGq3K27FeiJtlZfn2u4VQoMeXwDxYp1cInT5Q.apk"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding:'0.6rem 1.4rem', background:'#fff', color:'#1565C0',
              fontWeight:700, fontSize:'0.82rem', letterSpacing:'0.06em',
              textTransform:'uppercase', textDecoration:'none', whiteSpace:'nowrap',
            }}
          >
            ⬇ Download APK
          </a>
        </div>

        {/* Officer roster */}
        <div className="section-card">
          <div className="section-header">
            <span className="section-title">Officer Roster</span>
            <span style={{ fontSize:'0.88rem', color:'#555', fontWeight:600 }}>
              {officers.filter(o => o.status === 'available').length} available
            </span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:1, background:'rgba(0,0,0,0.06)' }}>
            {officers.map((o) => (
              <div key={o.id} style={{ background:'#fff', padding:'1.2rem 1.3rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: o.online ? '#2E7D32' : '#ccc' }} />
                  <span style={{ fontSize:'0.72rem', color:'#888', letterSpacing:'0.05em' }}>
                    {o.online ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div style={{ fontSize:'1rem', fontWeight:700, color:'#111' }}>{o.unit_name}</div>
                <div style={{ fontSize:'0.88rem', color:'#555', marginTop:'0.1rem' }}>{o.name}</div>
                <div style={{ fontSize:'0.78rem', color:'#888', marginTop:'0.1rem' }}>{o.badge}</div>
                <div style={{
                  marginTop:'0.7rem', display:'inline-block', padding:'0.25rem 0.7rem',
                  fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase',
                  color:'#fff', background: STATUS_COLORS[o.status] || '#888',
                }}>
                  {STATUS_LABELS[o.status] || o.status}
                </div>

                {o.lat && o.lng ? (
                  <div style={{
                    marginTop:'0.65rem', padding:'0.5rem 0.6rem',
                    background:'#F5F3EE', border:'1px solid rgba(0,0,0,0.06)',
                  }}>
                    <div style={{ fontSize:'0.66rem', color:'#888', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.2rem' }}>
                      Live Position
                    </div>
                    <div style={{ fontSize:'0.82rem', color:'#111', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>
                      {o.lat.toFixed(5)}, {o.lng.toFixed(5)}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize:'0.74rem', color:'#bbb', marginTop:'0.6rem', fontStyle:'italic' }}>
                    No GPS data yet
                  </div>
                )}

                {(o.status === 'dispatched' || o.status === 'on_patrol') && (
                  <button
                    onClick={() => handleRelease(o.id)}
                    style={{
                      marginTop:'0.7rem', width:'100%', padding:'0.4rem',
                      fontSize:'0.72rem', letterSpacing:'0.05em', fontWeight:700,
                      textTransform:'uppercase', background:'none',
                      border:'1px solid rgba(0,0,0,0.18)', color:'#444',
                      cursor:'pointer', fontFamily:'inherit',
                    }}
                  >
                    Release Unit
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Assignment trigger list */}
        <div className="section-card">
          <div className="section-header">
            <span className="section-title">Hotspots Requiring Assignment</span>
          </div>
          {loading ? (
            <div style={{ padding:'2.5rem', fontSize:'1rem', color:'#555' }}>Loading...</div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Junction</th><th>Zone</th><th>Risk Level</th><th>Action</th>
              </tr></thead>
              <tbody>
                {hotspots.slice(0, 10).map((h) => {
                  const isAssigned = assignedHotspotIds.has(h.id);
                  return (
                    <tr key={h.id}>
                      <td style={{ fontWeight:700 }}>{h.junction}</td>
                      <td>{h.zone}</td>
                      <td><RiskBadge level={h.risk_level} /></td>
                      <td>
                        {isAssigned ? (
                          <span style={{ fontSize:'0.85rem', color:'#2E7D32', fontWeight:700 }}>Unit dispatched</span>
                        ) : (
                          <button
                            onClick={() => handleAssign(h.id)}
                            disabled={assigning === h.id}
                            style={{
                              padding:'0.5rem 1rem', fontSize:'0.82rem', letterSpacing:'0.06em',
                              background: assigning === h.id ? '#6B0F17' : '#A0141E',
                              color:'#fff', border:'none', cursor:'pointer',
                              fontFamily:'inherit', fontWeight:700, textTransform:'uppercase',
                            }}
                          >
                            {assigning === h.id ? 'Finding unit...' : 'Assign Nearest Unit'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Live assignment feed */}
        <div className="section-card">
          <div className="section-header">
            <span className="section-title">Assignment Feed</span>
            <span style={{ fontSize:'0.88rem', color:'#555', fontWeight:600 }}>{assignments.length} total</span>
          </div>
          {assignments.length === 0 ? (
            <div style={{ padding:'2rem', fontSize:'0.95rem', color:'#888' }}>No assignments yet.</div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Junction</th><th>Officer</th><th>Distance</th><th>ETA</th><th>Status</th>
              </tr></thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight:700 }}>{a.junction}</td>
                    <td>{a.officer_name} <span style={{ color:'#888' }}>({a.unit_name})</span></td>
                    <td>{a.road_distance_km} km</td>
                    <td>{a.eta_minutes} min</td>
                    <td>
                      <span style={{
                        padding:'0.25rem 0.7rem', fontSize:'0.75rem', fontWeight:700,
                        letterSpacing:'0.06em', textTransform:'uppercase', color:'#fff',
                        background: ASSIGN_STATUS_COLORS[a.status] || '#888',
                      }}>
                        {a.status.replace('_',' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
