"use client";

import { useEffect } from 'react';

/**
 * Préchauffe de manière transparente le cache serveur des deux CRMs
 * pendant les temps morts du navigateur (Idle Time), sans impacter les performances de la page active.
 */
export function LeadsCacheWarmer() {
  useEffect(() => {
    const prewarm = () => {
      // Préchargement à basse priorité des caches RAM serveur
      try {
        fetch('/api/leads/elios', { priority: 'low' } as any).catch(() => {});
        setTimeout(() => {
          fetch('/api/leads/formatic', { priority: 'low' } as any).catch(() => {});
        }, 1000);
      } catch {}
    };

    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(prewarm, { timeout: 2500 });
      } else {
        setTimeout(prewarm, 1200);
      }
    }
  }, []);

  return null;
}

