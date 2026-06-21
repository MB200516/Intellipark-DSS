'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useReplayTour } from '@/components/OnboardingTour';

const LINKS = [
  { href: '/dashboard',             label: 'Dashboard',           tourId: 'nav-dashboard' },
  { href: '/dashboard/hotspots',    label: 'Hotspot Prediction',  tourId: 'nav-hotspots' },
  { href: '/dashboard/heatmap',     label: 'Heatmap',              tourId: 'nav-heatmap' },
  { href: '/dashboard/reports',     label: 'Reports',              tourId: 'nav-reports' },
  { href: '/dashboard/patrol',      label: 'Patrol Assignments',  tourId: 'nav-patrol' },
];

export default function TopNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const replayTour = useReplayTour();

  return (
    <nav className="topnav">
      {/* Brand */}
      <div className="topnav-brand" data-tour="nav-brand">
        <span className="topnav-brand-name">INTELLIPARK</span>
        <span className="topnav-brand-sub">DSS</span>
      </div>

      <div className="topnav-divider" />

      {/* Nav links */}
      <div className="topnav-links">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            data-tour={l.tourId}
            className={`nav-link ${pathname === l.href ? 'active' : ''}`}
          >
            {l.label}
          </Link>
        ))}
      </div>

      {/* User + signout */}
      <div className="topnav-user">
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.82rem', color: '#F0EDE8', fontWeight: 700, lineHeight: 1.2 }}>
            {user?.full_name}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'rgba(240,237,232,0.4)', letterSpacing: '0.08em' }}>
            {user?.badge}
          </div>
        </div>
        <button
          onClick={replayTour}
          style={{
            fontSize: '0.72rem', letterSpacing: '0.1em', color: 'rgba(240,237,232,0.35)',
            background: 'none', border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase',
            padding: '0.3rem 0.75rem',
          }}
        >
          Replay Tour
        </button>
        <button
          onClick={() => { logout(); router.push('/login'); }}
          style={{
            fontSize: '0.72rem', letterSpacing: '0.1em', color: 'rgba(240,237,232,0.35)',
            background: 'none', border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase',
            padding: '0.3rem 0.75rem',
          }}
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
