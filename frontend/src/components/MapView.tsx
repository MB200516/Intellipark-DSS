'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
interface HotspotMarker {
  id: number;
  junction: string;
  zone: string;
  lat: number;
  lng: number;
  predicted_violations: number;
  risk_score: number;
  risk_level: string;
}

interface Props {
  hotspots: HotspotMarker[];
  onSelect: (h: HotspotMarker) => void;
}

export default function MapView({ hotspots, onSelect }: Props) {
  const divRef     = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<any>(null);
  const heatRef    = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const initRef    = useRef(false);

  // ── Bootstrap Leaflet + leaflet-heat once ────────────────────────
  useEffect(() => {
    if (initRef.current || !divRef.current) return;
    initRef.current = true;

    import('leaflet').then((Lmod) => {
      const L = Lmod.default ?? Lmod;

      // Inject leaflet-heat from CDN
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
      script.onload = () => {
        if (mapRef.current) return; // already inited

        const map = L.map(divRef.current!, {
          center: [12.9716, 77.5946],
          zoom: 12,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 18,
        }).addTo(map);

        mapRef.current = map;

        // Initial draw
        drawHeat(L, map);
        drawMarkers(L, map);
      };
      document.head.appendChild(script);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        heatRef.current = null;
        initRef.current = false;
      }
    };
  }, []);

  // ── Redraw whenever hotspots change ──────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then((Lmod) => {
      const L = Lmod.default ?? Lmod;
      drawHeat(L, mapRef.current);
      drawMarkers(L, mapRef.current);
    });
  }, [hotspots]);

  // ── Heat layer ────────────────────────────────────────────────────
  function drawHeat(L: any, map: any) {
    if (!map || !(L as any).heatLayer) return;

    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }

    if (hotspots.length === 0) return;

    // Build [lat, lng, intensity] points
    // Add multiple weighted sub-points per hotspot so high-risk sites
    // produce bigger, denser blobs — matching the notebook screenshots
    const points: [number, number, number][] = [];

    hotspots.forEach((h) => {
      const intensity = h.risk_score / 100; // 0–1
      const count     = Math.ceil(intensity * 8) + 2; // 2–10 sub-points

      // Central point
      points.push([h.lat, h.lng, intensity]);

      // Scatter sub-points in a small radius around the centre
      // so the blob looks organic, not like a perfect circle
      for (let i = 0; i < count; i++) {
        const angle  = (i / count) * 2 * Math.PI;
        const spread = 0.006 + Math.random() * 0.008; // ~0.6–1.4 km
        const dlat   = Math.sin(angle) * spread * (0.7 + Math.random() * 0.6);
        const dlng   = Math.cos(angle) * spread * (0.7 + Math.random() * 0.6);
        points.push([h.lat + dlat, h.lng + dlng, intensity * (0.5 + Math.random() * 0.4)]);
      }
    });

    heatRef.current = (L as any).heatLayer(points, {
      radius:    45,   // pixel radius of each point
      blur:      35,   // gaussian blur amount
      maxZoom:   16,
      max:       1.0,
      gradient: {
        0.00: '#0000ff', // blue
        0.20: '#00ffff', // cyan
        0.40: '#00ff00', // green
        0.60: '#ffff00', // yellow
        0.80: '#ff8800', // orange
        1.00: '#ff0000', // red
      },
      minOpacity: 0.45,
    }).addTo(map);
  }

  // ── Invisible click-target markers (no visual dot) ────────────────
  function drawMarkers(L: any, map: any) {
    if (!map) return;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    hotspots.forEach((h) => {
      // Transparent circle — only purpose is to catch clicks and show popup
      const marker = L.circle([h.lat, h.lng], {
        radius:       400,
        color:        'transparent',
        fillColor:    'transparent',
        fillOpacity:  0,
        interactive:  true,
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family:'Times New Roman',serif;padding:2px;min-width:175px">
          <div style="font-size:15px;font-weight:600;margin-bottom:3px">${h.junction}</div>
          <div style="font-size:13px;color:#555;margin-bottom:10px">${h.zone}</div>
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
            <span>Predicted violations</span><strong>${h.predicted_violations}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px">
            <span>Risk score</span><strong>${h.risk_score}</strong>
          </div>
          <span style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;padding:3px 10px;
            border:1px solid rgba(139,30,45,0.35);color:#8B1E2D;background:rgba(139,30,45,0.08)">
            ${h.risk_level}
          </span>
        </div>
      `, { closeButton: false });

      marker.on('click', () => onSelect(h));
      markersRef.current.push(marker);
    });
  }

  return <div ref={divRef} style={{ height: '100%', width: '100%' }} />;
}
