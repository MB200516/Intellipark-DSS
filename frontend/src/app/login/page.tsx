'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [remember, setRemember] = useState(false);
  const { login } = useAuth();
  const router    = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(username, password); router.push('/dashboard'); }
    catch { setError('Invalid credentials. Use admin / admin123'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F5F4F1' }}>

      {/* LEFT: login card */}
      <div style={{
        width: '48%' , minWidth: '420px', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '3rem 3.2rem', background: '#fff', position: 'relative', zIndex: 2
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '2.2rem' }}>
          <div style={{
            width: 38, height: 38, background: '#A0141E', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '2.3rem', fontWeight: 800, color: '#111', letterSpacing: '0.01em', lineHeight: 1.1 }}>
              INTELLIPARK
            </div>
            <div style={{ fontSize: '0.7rem', color: '#777', letterSpacing: '0.02em' }}>
              Decision Support System
            </div>
          </div>
        </div>

        <h1 style={{ fontSize: '2.0rem', fontWeight: 700, color: '#111', marginBottom: '0.5rem' }}>
          Login
        </h1>
        <p style={{ fontSize: '1.3rem', color: '#666', marginBottom: '2rem', lineHeight: 1.5 }}>
          Enter your credentials to access the central command dashboard.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em', color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 700 }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                required autoComplete="username" placeholder="Officer ID or Email"
                style={{
                  width: '100%', background: '#FAFAF9', border: '1px solid rgba(0,0,0,0.12)',
                  padding: '0.85rem 1rem', fontSize: '0.95rem', color: '#111',
                  fontFamily: 'inherit', outline: 'none', borderRadius: 2,
                }}
                onFocus={(e) => { e.target.style.borderColor = '#A0141E'; }}
                onBlur={(e)  => { e.target.style.borderColor = 'rgba(0,0,0,0.12)'; }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em', color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 700 }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required autoComplete="current-password" placeholder="••••••••"
              style={{
                width: '100%', background: '#FAFAF9', border: '1px solid rgba(0,0,0,0.12)',
                padding: '0.85rem 1rem', fontSize: '0.95rem', color: '#111',
                fontFamily: 'inherit', outline: 'none', borderRadius: 2,
              }}
              onFocus={(e) => { e.target.style.borderColor = '#A0141E'; }}
              onBlur={(e)  => { e.target.style.borderColor = 'rgba(0,0,0,0.12)'; }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.6rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span style={{ fontSize: '0.82rem', color: '#666' }}>Stay signed in on this workstation</span>
          </label>

          {error && (
            <div style={{ fontSize: '0.85rem', color: '#7B0D14', marginBottom: '1.1rem', padding: '0.65rem 0.9rem', background: 'rgba(160,20,30,0.06)', border: '1px solid rgba(160,20,30,0.18)', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', background: loading ? '#6B0F17' : '#A0141E', border: 'none',
            color: '#fff', padding: '0.9rem', fontSize: '0.92rem', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            borderRadius: 2,
          }}>
            {loading ? 'Authenticating...' : <>Secure Login <span>→</span></>}
          </button>
        </form>

        {/* Demo creds box */}
        <div style={{
          marginTop: '1.8rem', padding: '0.9rem 1rem', background: '#FAFAF9',
          border: '1px solid rgba(0,0,0,0.08)', display: 'flex', gap: '0.7rem', alignItems: 'flex-start',
        }}>
          <span style={{ color: '#A0141E', fontSize: '1.1rem', lineHeight: 1 }}></span>
          <div>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.06em', color: '#888', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.3rem' }}>
              Demo Credentials
            </div>
            <div style={{ fontSize: '0.82rem', color: '#444' }}>Username: <strong>admin</strong></div>
            <div style={{ fontSize: '0.82rem', color: '#444' }}>Password: <strong>admin123</strong></div>
          </div>
        </div>
      </div>

      {/* RIGHT: photo collage, slanted divider */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#ffffff' }}>
        <div style={{
          position: 'absolute', inset: 0,
          clipPath: 'polygon(8% 0%, 100% 0%, 100% 100%, 0% 100%)',
        }}>
          <img
            src="/login-collage.jpg"
            alt="Bengaluru Traffic Police live surveillance network"
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center 30%',
            }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(160,20,30,0.18), rgba(10,6,8,0.5))',
          }} />
          
        </div>
      </div>
    </div>
  );
}
