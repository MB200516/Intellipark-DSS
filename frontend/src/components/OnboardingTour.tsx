'use client';
import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface TourStep {
  target: string;       // data-tour attribute value, or null for a centred intro/outro card
  title: string;
  body: string;
  route?: string;        // navigate here before showing this step
  placement?: 'bottom' | 'top' | 'right';
}

const STEPS: TourStep[] = [
  {
    target: null as any,
    title: 'Welcome to IntelliPark',
    body: 'A quick walkthrough of the command dashboard. Six short steps, skip anytime.',
  },
  {
    target: 'nav-brand',
    title: 'Command Centre',
    body: 'You are signed in as a supervisor. This bar stays visible across every page so you can jump between views instantly.',
    placement: 'bottom',
  },
  {
    target: 'nav-dashboard',
    title: 'Dashboard',
    body: 'KPI cards, violations by zone, risk distribution, and an hourly forecast chart for today, all generated from the live model.',
    route: '/dashboard',
    placement: 'bottom',
  },
  {
    target: 'nav-hotspots',
    title: 'Hotspot Prediction',
    body: 'Every predicted violation hotspot for today, with the exact forecast hour it is expected to occur and its risk score.',
    route: '/dashboard/hotspots',
    placement: 'bottom',
  },
  {
    target: 'nav-heatmap',
    title: 'Heatmap',
    body: 'A continuous density heatmap across Bengaluru, blue for low risk through red for critical, built from the same predictions.',
    route: '/dashboard/heatmap',
    placement: 'bottom',
  },
  {
    target: 'nav-reports',
    title: 'Reports',
    body: 'Export the current forecast as CSV, see a zone-level summary, and track how many officer-confirmed violations are queued to retrain the model.',
    route: '/dashboard/reports',
    placement: 'bottom',
  },
  {
    target: 'nav-patrol',
    title: 'Patrol Assignments',
    body: 'Live officer locations, one-click nearest-unit assignment using Bidirectional A* routing, and real-time status as officers accept and respond.',
    route: '/dashboard/patrol',
    placement: 'bottom',
  },
  {
    target: null as any,
    title: 'You are ready',
    body: 'Replay this tour anytime from the Sign Out menu corner, or just start working. Risk colours are consistent everywhere: crimson is critical, orange is high, amber is moderate, green is low.',
  },
];

const STORAGE_KEY = 'intellipark_tour_completed';

export default function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const t = setTimeout(() => setActive(true), 500);
      return () => clearTimeout(t);
    }
  }, []);

  const step = STEPS[stepIdx];

  const locateTarget = useCallback(() => {
    if (!step.target) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) setRect(el.getBoundingClientRect());
    else setRect(null);
  }, [step]);

  useEffect(() => {
    if (!active) return;
    if (step.route && step.route !== pathname) {
      router.push(step.route);
    }
    const t = setTimeout(locateTarget, 250);
    window.addEventListener('resize', locateTarget);
    return () => { clearTimeout(t); window.removeEventListener('resize', locateTarget); };
  }, [active, stepIdx, pathname]);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setActive(false);
    setStepIdx(0);
  };

  const next = () => {
    if (stepIdx === STEPS.length - 1) { finish(); return; }
    setStepIdx((i) => i + 1);
  };
  const prev = () => setStepIdx((i) => Math.max(0, i - 1));

  if (!active) return null;

  const cardPos = rect
    ? { top: rect.bottom + 14, left: Math.min(Math.max(rect.left, 16), window.innerWidth - 360) }
    : { top: window.innerHeight / 2 - 90, left: window.innerWidth / 2 - 180 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000 }}>
      {/* dim background with a cut-out around the target */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <mask id="tourMask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - 8} y={rect.top - 8}
                width={rect.width + 16} height={rect.height + 16}
                rx={6} fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(10,6,8,0.72)" mask="url(#tourMask)" />
      </svg>

      {rect && (
        <div style={{
          position: 'absolute',
          top: rect.top - 8, left: rect.left - 8,
          width: rect.width + 16, height: rect.height + 16,
          border: '2px solid #A0141E', borderRadius: 6,
          boxShadow: '0 0 0 4px rgba(160,20,30,0.15)',
          pointerEvents: 'none',
        }} />
      )}

      {/* card */}
      <div style={{
        position: 'absolute', top: cardPos.top, left: cardPos.left,
        width: 340, background: '#fff', borderRadius: 6,
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)', padding: '1.4rem 1.5rem',
        border: '1px solid rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
          <span style={{ fontSize: '0.68rem', letterSpacing: '0.12em', color: '#A0141E', fontWeight: 700, textTransform: 'uppercase' }}>
            Step {stepIdx + 1} of {STEPS.length}
          </span>
          <button onClick={finish} style={{
            fontSize: '0.7rem', color: '#999', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em',
          }}>Skip</button>
        </div>

        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111', marginBottom: '0.5rem' }}>
          {step.title}
        </div>
        <div style={{ fontSize: '0.88rem', color: '#555', lineHeight: 1.6, marginBottom: '1.2rem' }}>
          {step.body}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === stepIdx ? '#A0141E' : 'rgba(0,0,0,0.12)',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {stepIdx > 0 && (
              <button onClick={prev} style={{
                padding: '0.45rem 0.9rem', fontSize: '0.78rem', fontWeight: 700,
                background: 'none', border: '1px solid rgba(0,0,0,0.15)', color: '#444',
                cursor: 'pointer', fontFamily: 'inherit', borderRadius: 3,
              }}>Back</button>
            )}
            <button onClick={next} style={{
              padding: '0.45rem 1.1rem', fontSize: '0.78rem', fontWeight: 700,
              background: '#A0141E', border: 'none', color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit', borderRadius: 3,
            }}>
              {stepIdx === STEPS.length - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useReplayTour() {
  const [, force] = useState(0);
  return () => {
    localStorage.removeItem(STORAGE_KEY);
    force((n) => n + 1);
    window.location.reload();
  };
}
