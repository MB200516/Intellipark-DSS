'use client';
import { useEffect, useState, useRef } from 'react';

const STATUS_LINES = [
  'INITIALIZING_SYSTEM_CORE...',
  'CALIBRATING_SENSORS...',
  'RETRIEVING_HEATMAPS...',
  'UPLINK_ESTABLISHED.',
  'SYNCING_COMMAND_CENTER...',
  'AUTHORIZING_ACCESS...',
  'SYSTEM_READY.',
];

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [percent, setPercent] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);
  const [terminalId, setTerminalId] = useState('BTP-DSS-7729-ALPHA');
  const [fading, setFading] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPercent((p) => {
        const next = Math.min(100, p + Math.floor(Math.random() * 2) + 1);
        if (next > 15 && next <= 35) setStatusIdx((s) => Math.max(s, 1));
        if (next > 35 && next <= 60) setStatusIdx((s) => Math.max(s, 2));
        if (next > 60 && next <= 85) setStatusIdx((s) => Math.max(s, 3));
        if (next > 85 && next < 100) setStatusIdx((s) => Math.max(s, 4));
        if (next >= 100) {
          setStatusIdx(5);
          clearInterval(interval);
          setTimeout(() => setFading(true), 500);
          setTimeout(() => onComplete(), 1300);
        }
        return next;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [onComplete]);

  useEffect(() => {
    const idInterval = setInterval(() => {
      const rand = Math.floor(Math.random() * 9000) + 1000;
      setTerminalId(`BTP-DSS-${rand}-ALPHA`);
    }, 8000);
    return () => clearInterval(idInterval);
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!mainRef.current) return;
      const x = (window.innerWidth / 2 - e.pageX) / 80;
      const y = (window.innerHeight / 2 - e.pageY) / 80;
      mainRef.current.style.transform = `translate(${x}px, ${y}px)`;
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <div className={`boot-screen ${fading ? 'boot-fade-out' : ''}`}>
      <div className="boot-scanline" />
      <div className="boot-glitch-overlay" />

      <main ref={mainRef} className="boot-main">
        <div className="boot-fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="boot-shield-row">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#A0141E" style={{ marginRight: 10 }}>
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
            </svg>
            <span className="boot-eyebrow">Security Protocol Alpha</span>
          </div>
          <h1 className="boot-title">INTELLIPARK</h1>
        </div>

        <section className="boot-progress-section boot-fade-up" style={{ animationDelay: '0.6s' }}>
          <div className="boot-progress-track">
            <div className="boot-progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="boot-status-row">
            <p className="boot-status-text">{STATUS_LINES[statusIdx]}</p>
            <p className="boot-percent">{percent}%</p>
          </div>
        </section>

        <div className="boot-fade-up" style={{ animationDelay: '0.8s' }}>
          <p className="boot-agency">Bengaluru Traffic Police</p>
          <p className="boot-unit">Operational Intelligence Unit</p>
        </div>
      </main>

      <footer className="boot-footer boot-fade-up" style={{ animationDelay: '1.2s' }}>
        <div style={{ textAlign: 'left' }}>
          <p className="boot-footer-label">Terminal Node</p>
          <p className="boot-footer-value">{terminalId}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
            <span className="boot-pulse-icon" style={{ animationDelay: '0s' }}>◎</span>
            <span className="boot-pulse-icon" style={{ animationDelay: '0.4s' }}>◈</span>
            <span className="boot-pulse-icon" style={{ animationDelay: '0.8s' }}>▤</span>
          </div>
          <p className="boot-encryption">Encryption Standard AES-256</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="boot-footer-label">Geo-Coordinates</p>
          <p className="boot-footer-value">12.9716° N, 77.5946° E</p>
        </div>
      </footer>
    </div>
  );
}
