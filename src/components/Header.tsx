"use client";

import React, { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import { getThemeColors, Operator } from '@/types';
import Link from 'next/link';
import { Settings } from 'lucide-react';

import Image from 'next/image';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface HeaderProps {
  activeUser: string | null;
  setActiveUser: (user: string) => void;
  attention?: boolean;
}

export function Header({ activeUser, setActiveUser, attention }: HeaderProps) {
  const [headerHeight, setHeaderHeight] = useState(80);
  const hdrWrapRef = useRef<HTMLDivElement>(null);
  const [hideHint, setHideHint] = useState(false);
  
  const { data: operators, isLoading } = useSWR<Operator[]>('/api/operators', fetcher);

  useEffect(() => {
    const syncHeaderSpace = () => {
      if (hdrWrapRef.current) {
        const h = hdrWrapRef.current.offsetHeight;
        setHeaderHeight(h);
        document.documentElement.style.setProperty('--hdr', `${h}px`);
      }
    };
    
    syncHeaderSpace();
    window.addEventListener('resize', syncHeaderSpace);
    
    // Fallback resize observer
    let observer: ResizeObserver | null = null;
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      observer = new ResizeObserver(syncHeaderSpace);
      if (hdrWrapRef.current) observer.observe(hdrWrapRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', syncHeaderSpace);
      if (observer) observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (activeUser) {
      setHideHint(true);
    }
  }, [activeUser]);

  return (
    <>
      <div ref={hdrWrapRef} id="hdrWrap" className="hdr-wrap pointer-events-none fixed inset-x-0 top-0 z-30">
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
          <header className="hdr-nav pointer-events-auto relative flex w-full flex-col items-start gap-x-5 gap-y-3 rounded-xl bg-white px-4 py-3 md:flex-row md:flex-wrap md:items-center md:px-5">
            <div className="flex shrink-0 items-center gap-2.5">
              <div className="relative h-8 w-8 overflow-hidden rounded-md border border-gray-100 shadow-sm">
                <Image 
                  src="/LogoElios.jpeg" 
                  alt="Logo Elios" 
                  fill 
                  className="object-cover" 
                  sizes="32px"
                />
              </div>
              <span 
                className="text-[15px] font-bold italic tracking-tight"
                style={{ 
                  color: '#28326a', 
                  fontFamily: '"Nunito", "Quicksand", "Arial Rounded MT Bold", "Varela Round", sans-serif'
                }}
              >
                RECEIPT Management
              </span>
            </div>

            <span className="hidden h-5 w-px bg-gray-200 md:block" aria-hidden="true"></span>

            <div className="flex w-full min-w-0 flex-1 items-center gap-2 md:w-auto md:gap-3">
              <span id="whoLabel" className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-black">
                CONNECTÉ EN TANT QUE :
              </span>
              <div 
                id="userPillsWrap" 
                className={`-mx-1 -my-1 min-w-0 flex-1 px-1 py-1 ${attention ? 'attention' : ''}`}
              >
                <div id="userPills" role="radiogroup" aria-labelledby="whoLabel" className="no-scrollbar flex gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible">
                  {isLoading ? (
                    <span className="text-xs text-gray-400 py-1">Chargement...</span>
                  ) : operators && operators.length > 0 ? (
                    operators.map((op) => {
                      const isActive = activeUser === op.name;
                      const colors = getThemeColors(op.theme);
                      return (
                        <button
                          key={op._id}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          onClick={() => setActiveUser(op.name)}
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                            isActive
                              ? 'shadow-sm'
                              : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                          style={
                            isActive
                              ? { backgroundColor: colors.bg, color: colors.fg, boxShadow: `inset 0 0 0 1px ${colors.dot}` }
                              : {}
                          }
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.dot }}></span>
                          {op.name}
                        </button>
                      );
                    })
                  ) : (
                    <Link href="/admin/operators" className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 hover:bg-indigo-100 transition-colors">
                      <Settings className="h-3 w-3" />
                      Configurer les opérateurs
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div 
              id="userHint" 
              className={`hint-wrap w-full xl:w-auto xl:flex-none ${hideHint ? 'is-hidden' : ''}`}
              hidden={hideHint}
              role="status"
            >
              <div className="hint-inner">
                <p className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"></span>
                  Choisissez votre nom pour continuer
                </p>
              </div>
            </div>
          </header>
        </div>
      </div>
      <div id="hdrSpacer" aria-hidden="true" style={{ height: headerHeight }}></div>
    </>
  );
}

