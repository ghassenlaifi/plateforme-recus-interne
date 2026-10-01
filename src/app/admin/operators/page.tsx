"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminOperatorsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings');
  }, [router]);

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--ink2)', fontFamily: 'var(--font)' }}>
      Redirection vers les Paramètres...
    </div>
  );
}

