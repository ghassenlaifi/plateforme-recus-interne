"use client";

import React, { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Operator, getThemeColors, getOperatorColors } from '@/types';
import { SessionReminderAlert } from './SessionReminderAlert';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface EliosHeaderProps {
  crumb?: string;
  parentCrumb?: string;
  parentHref?: string;
  activeUser: string | null;
  setActiveUser: (user: string) => void;
  showSearch?: boolean;
  onOpenSearch?: () => void;
  showSettings?: boolean;
}

export function EliosHeader({ 
  crumb, 
  parentCrumb, 
  parentHref, 
  activeUser, 
  setActiveUser, 
  showSearch, 
  onOpenSearch, 
  showSettings = true 
}: EliosHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const userRef = useRef<HTMLDivElement>(null);

  const { data: operators } = useSWR<Operator[]>('/api/operators', fetcher);

  // Initialisation du thème (light/dark)
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('elios.theme');
      const initial = savedTheme ? JSON.parse(savedTheme) : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      setTheme(initial);
      document.documentElement.dataset.theme = initial;
    } catch {
      // fallback
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('elios.theme', JSON.stringify(next));
    } catch {}
  };

  // Fermer le menu lors d'un clic extérieur ou Échap
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Déterminer la couleur et initiale de l'utilisateur actif
  const opColor = getOperatorColors(activeUser, operators).dot;
  const initial = activeUser ? activeUser.charAt(0).toUpperCase() : '?';

  return (
    <header className="top">
      <div className="crumb">
        <Link 
          id="home" 
          href="/" 
          className="home-brand" 
          style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none' }}
          title="Elios Workspace"
        >
          <span 
            style={{ 
              width: '26px', 
              height: '26px', 
              borderRadius: '50%', 
              overflow: 'hidden', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
              background: '#ffffff',
              flexShrink: 0
            }}
          >
            <img 
              src="/LogoCircle.png" 
              alt="Elios" 
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </span>
          <span style={{ fontWeight: 700, fontSize: '14.5px', letterSpacing: '-0.01em' }}>Elios Workspace</span>
        </Link>
        {parentCrumb && parentHref && (
          <>
            <span className="hide sep">/</span>
            <Link href={parentHref} className="hide">
              {parentCrumb}
            </Link>
          </>
        )}
        {crumb && (
          <>
            <span className="sep">/</span>
            <b>{crumb}</b>
          </>
        )}
      </div>

      <div className="sp"></div>

      {showSettings !== false && (
        <Link 
          href="/settings" 
          className={`btn ${crumb === 'Paramètres' ? 'active' : ''}`}
          id="btnSettings" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px',
            ...(crumb === 'Paramètres' ? { borderColor: 'var(--brand)', color: 'var(--brand)', fontWeight: 600 } : {})
          }}
          title="Paramètres"
        >
          <svg className="i" viewBox="0 0 24 24">
            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span className="txt">Paramètres</span>
        </Link>
      )}

      <button 
        className="btn" 
        id="theme" 
        onClick={toggleTheme} 
        aria-label="Changer de thème"
        type="button"
      >
        <svg className="i" viewBox="0 0 24 24">
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>
        </svg>
      </button>

      <div className="user" id="user" ref={userRef}>
        <button 
          className="btn" 
          id="userBtn" 
          aria-haspopup="true" 
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          type="button"
        >
          <span className="av" id="av" style={{ backgroundColor: opColor }}>
            {initial}
          </span>
          <span className="txt" id="uname">
            {activeUser || 'Choisir un opérateur'}
          </span>
          <svg className="i" viewBox="0 0 24 24">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        <div className={`menu ${isMenuOpen ? 'open' : ''}`} id="menu" role="menu" data-open={isMenuOpen}>
          <p>Connecté en tant que</p>
          {operators && operators.length > 0 ? (
            operators.map((op) => {
              const isSelected = (activeUser || '').toLowerCase() === op.name.toLowerCase();
              const color = getThemeColors(op.theme).dot;
              return (
                <button
                  key={op._id}
                  role="menuitemradio"
                  aria-checked={isSelected}
                  type="button"
                  onClick={() => {
                    setActiveUser(op.name);
                    try {
                      localStorage.setItem('elios.user', JSON.stringify(op.name));
                      localStorage.setItem('receiptHubActiveUser', op.name);
                    } catch {}
                    setIsMenuOpen(false);
                  }}
                >
                  <span className="av" style={{ backgroundColor: color }}>
                    {op.name.charAt(0).toUpperCase()}
                  </span>
                  <span>{op.name}</span>
                </button>
              );
            })
          ) : (
            <p style={{ color: 'var(--ink3)', fontSize: '13px', padding: '8px 10px' }}>
              Chargement des opérateurs...
            </p>
          )}
        </div>
      </div>

      <SessionReminderAlert />
    </header>
  );
}

