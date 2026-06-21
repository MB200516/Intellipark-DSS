'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, BarChart, Bar,
} from 'recharts';

const C = { crimson:'#A0141E', dark:'#6B0F17', high:'#C05000', moderate:'#C08000', low:'#2E7D32', blue:'#1565C0' };
const RISK_COLORS: Record<string,string> = { Critical:C.crimson, High:C.high, Moderate:C.moderate, Low:C.low };
const CHART_COLORS = [C.crimson, C.high, C.moderate, C.low, C.blue, '#5E35B1','#00838F'];
const TT = { background:'#111010', border:'1px solid rgba(160,20,30,0.4)', borderRadius:4, fontSize:14, fontFamily:'Inter, sans-serif', color:'#F0EDE8' };

export default function DashboardPage() {
  const [kpi,      setKpi]      = useState<any>(null);
  const [byZone,   setByZone]   = useState<any[]>([]);
  const [riskDist, setRiskDist] = useState<any[]>([]);
  const [topJ,     setTopJ]     = useState<any[]>([]);
  const [byHour,   setByHour]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/kpi'),
      api.get('/dashboard/chart/by-zone'),
      api.get('/dashboard/chart/risk-distribution'),
      api.get('/dashboard/chart/top-junctions'),
      api.get('/dashboard/chart/by-hour'),
    ]).then(([k,z,r,t,h]) => {
      setKpi(k.data); setByZone(z.data); setRiskDist(r.data); setTopJ(t.data); setByHour(h.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding:'3rem 2.5rem', fontSize:'1.1rem', color:'#555' }}>Loading dashboard data...</div>
  );

  const totalHotspots = kpi?.total_hotspots || 1;
  const criticalPct = Math.round(((kpi?.critical_hotspots || 0) / totalHotspots) * 100);
  const highPct = Math.round(((kpi?.high_risk_hotspots || 0) / totalHotspots) * 100);
  const unitsTotal = 5;
  const unitsAvailablePct = Math.round(((kpi?.available_patrol_units || 0) / unitsTotal) * 100);

  const KPI_ITEMS = kpi ? [
    { label:'Total Hotspots', value: kpi.total_hotspots, accent: C.crimson, ring: 100 },
    { label:'High Risk Hotspots', value: kpi.high_risk_hotspots, accent: C.high, ring: highPct },
    { label:'Predicted Violations', value: kpi.predicted_violations, accent: C.moderate, ring: 100 },
    { label:'Patrol Units Available', value: kpi.available_patrol_units, accent: C.low, ring: unitsAvailablePct },
  ] : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">{kpi?.last_updated ? `Updated ${kpi.last_updated}` : ''}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'1.2rem' }}>
          {kpi?.using_real_data && (
            <div style={{ fontSize:'0.82rem', color:C.low, fontWeight:700, letterSpacing:'0.06em' }}>
              Live Model Data
            </div>
          )}
          <div style={{ padding:'0.4rem 1rem', background:C.crimson, color:'#F0EDE8', fontSize:'0.82rem', letterSpacing:'0.14em', textTransform:'uppercase', fontWeight:700 }}>
            Live
          </div>
        </div>
      </div>

      <div style={{ padding:'2rem 2.2rem', display:'flex', flexDirection:'column', gap:'1.6rem' }}>

        {/* KPI row with circular progress rings */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1.1rem' }}>
          {KPI_ITEMS.map((item) => (
            <div key={item.label} className="kpi-card-v2">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div className="kpi-label">{item.label}</div>
                  <div className="kpi-value" style={{ marginTop:'0.4rem' }}>{item.value}</div>
                </div>
                <RingGauge value={item.ring} color={item.accent} />
              </div>
            </div>
          ))}
        </div>

        {/* Row 2: Line chart (violations by zone) + Risk donut */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:'1.1rem' }}>

          <div className="section-card-v2">
            <div className="section-header">
              <span className="section-title">Predicted Violations by Zone</span>
              <span style={{ fontSize:'0.88rem', color:'#555', fontWeight:600 }}>{byZone.length} zones</span>
            </div>
            <div style={{ padding:'1.5rem 1.4rem 1rem' }}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={byZone} margin={{ left:0, right:16, top:8, bottom:8 }}>
                  <defs>
                    <linearGradient id="zoneFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.crimson} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={C.crimson} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="zone"
                    tick={{ fontSize:12.5, fontFamily:'Inter, sans-serif', fill:'#333', fontWeight:600 }}
                    axisLine={{ stroke:'rgba(0,0,0,0.1)' }} tickLine={false} />
                  <YAxis tick={{ fontSize:12.5, fontFamily:'Inter, sans-serif', fill:'#666' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TT} formatter={(v:any) => [v,'Violations']} cursor={{ stroke:C.crimson, strokeWidth:1, strokeDasharray:'3 3' }} />
                  <Area type="monotone" dataKey="predicted_violations" name="Violations"
                    stroke={C.crimson} strokeWidth={2.5} fill="url(#zoneFill)"
                    dot={{ r:4, fill:C.crimson, strokeWidth:2, stroke:'#fff' }}
                    activeDot={{ r:6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="section-card-v2">
            <div className="section-header"><span className="section-title">Risk Distribution</span></div>
            <div style={{ padding:'1.2rem 0.8rem 0.5rem' }}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={riskDist} dataKey="count" nameKey="level"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={48} paddingAngle={3}
                    cornerRadius={3}>
                    {riskDist.map((e) => <Cell key={e.level} fill={RISK_COLORS[e.level] || C.crimson} />)}
                  </Pie>
                  <Tooltip contentStyle={TT} formatter={(v:any) => [v,'Hotspots']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', padding:'0.5rem' }}>
                {riskDist.map((d) => (
                  <div key={d.level} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      <div style={{ width:11, height:11, borderRadius:3, background:RISK_COLORS[d.level] }} />
                      <span style={{ fontSize:'0.97rem', color:'#111', fontWeight:700 }}>{d.level}</span>
                    </div>
                    <span style={{ fontSize:'0.97rem', color:'#111', fontWeight:600 }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Top junctions ranked bars + radial gauge cluster */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.1rem' }}>

          <div className="section-card-v2">
            <div className="section-header">
              <span className="section-title">Top Junctions by Predicted Violations</span>
            </div>
            <div style={{ padding:'1.4rem 1.5rem' }}>
              {topJ.map((j, i) => (
                <div key={j.junction} style={{ display:'flex', alignItems:'center', gap:'0.9rem', marginBottom: i < topJ.length-1 ? '1rem' : 0 }}>
                  <div style={{
                    width:28, height:28, borderRadius:'50%', flexShrink:0,
                    background: i < 3 ? RISK_COLORS[j.risk_level] : '#eee',
                    color: i < 3 ? '#fff' : '#888',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'0.78rem', fontWeight:700,
                  }}>{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.3rem' }}>
                      <span style={{ fontSize:'0.93rem', color:'#111', fontWeight:700 }}>{j.junction}</span>
                      <span style={{ fontSize:'0.93rem', color:'#111', fontWeight:700 }}>{j.predicted_violations}</span>
                    </div>
                    <div style={{ height:6, background:'rgba(0,0,0,0.06)', borderRadius:3 }}>
                      <div style={{
                        height:'100%', borderRadius:3,
                        width:`${(j.predicted_violations / Math.max(...topJ.map((x:any)=>x.predicted_violations),1))*100}%`,
                        background: RISK_COLORS[j.risk_level] || C.crimson,
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card-v2">
            <div className="section-header">
              <span className="section-title">Risk Level Composition</span>
            </div>
            <div style={{ padding:'1.6rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-around', flexWrap:'wrap', gap:'1.5rem' }}>
              {riskDist.map((d) => (
                <div key={d.level} style={{ textAlign:'center' }}>
                  <RingGauge
                    value={Math.round((d.count/totalHotspots)*100)}
                    color={RISK_COLORS[d.level]}
                    size={84}
                    stroke={9}
                    showLabel
                  />
                  <div style={{ fontSize:'0.85rem', fontWeight:700, color:'#111', marginTop:'0.6rem' }}>{d.level}</div>
                  <div style={{ fontSize:'0.78rem', color:'#777' }}>{d.count} sites</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 4: predicted violations by hour, today */}
        <div className="section-card-v2">
          <div className="section-header">
            <span className="section-title">Predicted Violations by Hour, Today</span>
          </div>
          <div style={{ padding:'1.5rem 1.4rem 1rem' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byHour} margin={{ left:0, right:16, top:8, bottom:8 }}>
                <XAxis dataKey="hour"
                  tick={{ fontSize:12, fontFamily:'Inter, sans-serif', fill:'#333', fontWeight:600 }}
                  axisLine={{ stroke:'rgba(0,0,0,0.1)' }} tickLine={false} />
                <YAxis tick={{ fontSize:12, fontFamily:'Inter, sans-serif', fill:'#666' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TT} formatter={(v:any) => [v,'Violations']} cursor={{ fill:'rgba(160,20,30,0.06)' }} />
                <Bar dataKey="violations" name="Violations" radius={[3,3,0,0]} fill={C.crimson} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function RingGauge({ value, color, size = 56, stroke = 6, showLabel = false }:
  { value: number; color: string; size?: number; stroke?: number; showLabel?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(value,100) / 100) * c;
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset 0.6s ease' }} />
      </svg>
      {showLabel && (
        <div style={{
          position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'0.92rem', fontWeight:700, color:'#111',
        }}>
          {value}%
        </div>
      )}
    </div>
  );
}
