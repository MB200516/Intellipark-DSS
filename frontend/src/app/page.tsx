'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';

export default function RootPage() {
  const router = useRouter();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), 3500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!minTimeElapsed) return;
    router.replace('/login');
  }, [minTimeElapsed, router]);

  return <LoadingScreen onComplete={() => {}} />;
}
