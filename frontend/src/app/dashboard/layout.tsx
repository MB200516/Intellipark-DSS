'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import TopNav from '@/components/TopNav';
import OnboardingTour from '@/components/OnboardingTour';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading || !user) return (
    <div style={{ minHeight:'100vh', background:'#111010', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize:'0.8rem', letterSpacing:'0.2em', color:'rgba(240,237,232,0.2)' }}>LOADING</div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'#F0EDE8' }}>
      <TopNav />
      <main style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
        {children}
      </main>
      <OnboardingTour />
    </div>
  );
}
