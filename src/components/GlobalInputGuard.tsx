'use client';

import { useEffect } from 'react';

/**
 * Global protection for number inputs:
 * 1. Blocks mouse wheel scrolling from modifying values
 * 2. Blocks ArrowUp, ArrowDown, PageUp, and PageDown keys from modifying values
 */
export function GlobalInputGuard() {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'number') {
        (el as HTMLInputElement).blur();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'number') {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  return null;
}

