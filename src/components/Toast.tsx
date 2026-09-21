"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Check, AlertCircle } from 'lucide-react';

type Tone = 'ok' | 'warn';

interface ToastOptions {
  message: string;
  tone?: Tone;
  undo?: () => void;
}

interface ToastItem extends ToastOptions {
  id: number;
  isOut: boolean;
}

interface ToastContextType {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((options: ToastOptions) => {
    const id = Date.now();
    setToasts((prev) => {
      const next = [{ ...options, id, isOut: false }, ...prev];
      return next.slice(0, 3); // keep max 3
    });

    const duration = options.undo ? 6000 : 3500;
    
    // Auto dismiss
    const dismissTimer = setTimeout(() => {
      dismiss(id);
    }, duration);

    return () => clearTimeout(dismissTimer);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, isOut: true } : t));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div id="toastHost" className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4" style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }} aria-live="polite">
        {toasts.map((t) => {
          const isWarn = t.tone === 'warn';
          const bgClass = isWarn ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-400';
          const Icon = isWarn ? AlertCircle : Check;
          
          return (
            <div key={t.id} className={`toast pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-gray-900 py-2.5 pl-3.5 pr-2.5 text-sm text-white shadow-xl ring-1 ring-white/10 ${t.isOut ? 'is-out' : ''}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${bgClass}`}>
                <Icon className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="min-w-0">{t.message}</span>
              {t.undo && (
                <button
                  type="button"
                  onClick={() => {
                    t.undo!();
                    dismiss(t.id);
                  }}
                  className="ml-1 shrink-0 rounded-md px-2.5 py-2 text-xs font-medium text-white/90 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Annuler
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

