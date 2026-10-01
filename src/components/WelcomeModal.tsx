"use client";

import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar } from 'lucide-react';

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [activeUser, setActiveUser] = useState<string>('');

  useEffect(() => {
    // 24 hours interval in milliseconds
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const lastTimestamp = localStorage.getItem('elios_welcome_timestamp');
    const legacyDate = localStorage.getItem('lastWelcomeDate');
    const today = new Date().toDateString();

    let shouldOpen = false;

    if (lastTimestamp) {
      const elapsed = now - parseInt(lastTimestamp, 10);
      if (elapsed >= TWENTY_FOUR_HOURS) {
        shouldOpen = true;
      }
    } else if (legacyDate) {
      if (legacyDate !== today) {
        shouldOpen = true;
      }
    } else {
      // First visit ever
      shouldOpen = true;
    }

    if (shouldOpen) {
      const timer = setTimeout(() => setIsOpen(true), 200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Format live Tunisian time and Arabic date
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const timeFmt = new Intl.DateTimeFormat('ar-TN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
      }).format(now);

      const dateFmt = new Intl.DateTimeFormat('ar-TN', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }).format(now);
      
      setCurrentTime(timeFmt);
      setCurrentDate(dateFmt);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Retrieve active user for personalized greeting
  useEffect(() => {
    try {
      const saved = localStorage.getItem('elios.user') || localStorage.getItem('receiptHubActiveUser');
      if (saved) {
        let u = saved;
        try {
          const parsed = JSON.parse(saved);
          if (typeof parsed === 'string') u = parsed;
        } catch {}
        setActiveUser(u);
      }
    } catch {}
  }, [isOpen]);

  // Keyboard navigation (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Allow custom window event to re-open for testing / review
  useEffect(() => {
    const handleReopen = () => setIsOpen(true);
    window.addEventListener('open-elios-welcome', handleReopen);
    return () => window.removeEventListener('open-elios-welcome', handleReopen);
  }, []);

  const handleClose = () => {
    const now = Date.now().toString();
    const today = new Date().toDateString();
    localStorage.setItem('elios_welcome_timestamp', now);
    localStorage.setItem('lastWelcomeDate', today);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay welcome-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.70)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        className="modal-dialog welcome-modal-card"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '480px',
          maxHeight: 'min(92dvh, 620px)',
          borderRadius: '24px',
          background: 'var(--card, #ffffff)',
          color: 'var(--ink, #1e293b)',
          border: '1px solid var(--line, #e2e8f0)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          fontFamily: "'Tajawal', var(--font, sans-serif)",
          animation: 'modalIn .25s cubic-bezier(.16, 1, .3, 1)'
        }}
      >
        {/* Top accent border */}
        <div 
          style={{
            height: '4px',
            width: '100%',
            background: 'linear-gradient(90deg, #182240 0%, #3B4BD8 45%, #E08A12 80%, #182240 100%)'
          }}
        />

        {/* Close Button */}
        <button 
          type="button"
          onClick={handleClose}
          aria-label="Fermer"
          title="Fermer (Échap)"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: 'var(--hover, #f1f5f9)',
            color: 'var(--ink3, #64748b)',
            border: '1px solid var(--line, #e2e8f0)',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--ink, #0f172a)';
            e.currentTarget.style.transform = 'scale(1.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ink3, #64748b)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <X size={17} />
        </button>

        {/* Modal Body: Scrollable if height is constrained */}
        <div 
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: '24px 22px 26px',
            overflowY: 'auto',
            maxHeight: 'calc(92dvh - 8px)',
            boxSizing: 'border-box',
            gap: '14px'
          }}
        >
          {/* Logo Circulaire Officiel Elios */}
          <div 
            style={{
              width: '62px',
              height: '62px',
              borderRadius: '50%',
              overflow: 'hidden',
              boxShadow: '0 8px 24px -4px rgba(24, 34, 64, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.06)',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '2px'
            }}
          >
            <img 
              src="/LogoCircle.png" 
              alt="Logo Elios Workspace" 
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>

          {/* Brand Badge */}
          <div 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 14px',
              borderRadius: '9999px',
              background: 'color-mix(in srgb, var(--brand, #3B4BD8) 12%, transparent)',
              color: 'var(--brand, #3B4BD8)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.02em'
            }}
          >
            <span>Elios Workspace</span>
          </div>

          {/* Welcome Title & Operator Personalization */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <p 
              dir="rtl" 
              style={{ 
                margin: 0, 
                fontSize: '13px', 
                fontWeight: 700, 
                color: 'var(--warn, #D97706)',
                letterSpacing: '0.02em'
              }}
            >
              أهلاً وسهلاً بك
            </p>
            <h2 
              dir="rtl" 
              style={{ 
                margin: 0, 
                fontSize: '26px', 
                fontWeight: 800, 
                color: 'var(--ink, #1e293b)',
                letterSpacing: '-0.02em',
                lineHeight: 1.25
              }}
            >
              {activeUser ? `مرحباً بك، ${activeUser}!` : 'مرحباً بك في يومك الجديد!'}
            </h2>
          </div>

          {/* Date & Time Live Display */}
          <div 
            dir="rtl"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px 14px',
              padding: '8px 16px',
              borderRadius: '12px',
              background: 'var(--hover, #f8fafc)',
              border: '1px solid var(--line, #e2e8f0)',
              color: 'var(--ink2, #475569)',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={15} style={{ color: 'var(--brand, #3B4BD8)' }} />
              <span style={{ fontFamily: 'var(--mono, monospace)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {currentTime}
              </span>
            </div>
            <div style={{ width: '1px', height: '14px', background: 'var(--line, #cbd5e1)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} style={{ color: 'var(--warn, #D97706)' }} />
              <span>{currentDate}</span>
            </div>
          </div>

          {/* Subtle Decorative Divider */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.7, margin: '2px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--line, #e2e8f0)' }} />
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--warn, #D97706)' }} />
            <div style={{ flex: 1, height: '1px', background: 'var(--line, #e2e8f0)' }} />
          </div>

          {/* Sacred Barakah Duaa Card */}
          <div 
            style={{
              width: '100%',
              padding: '16px 20px',
              borderRadius: '16px',
              background: 'color-mix(in srgb, var(--warn, #D97706) 6%, var(--card, #ffffff))',
              border: '1px solid color-mix(in srgb, var(--warn, #D97706) 24%, var(--line, #e2e8f0))',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <p 
              dir="rtl" 
              style={{ 
                margin: 0,
                fontFamily: "'Amiri', serif",
                fontSize: '22px',
                lineHeight: 1.8,
                fontWeight: 700,
                color: 'var(--ink, #1e293b)',
                userSelect: 'none'
              }}
            >
              بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ
            </p>
            <p 
              dir="rtl"
              style={{
                margin: 0,
                fontSize: '12px',
                color: 'var(--ink3, #64748b)',
                fontWeight: 500
              }}
            >
              « نسأل الله لكم يوماً مباركاً وتوفيقاً دائماً في أعمالكم »
            </p>
          </div>

          {/* Action Button: Ergonomically placed, full width, responsive and prominent */}
          <div style={{ width: '100%', marginTop: '6px' }}>
            <button 
              type="button"
              onClick={handleClose}
              dir="rtl"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '13px 20px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #182240 0%, #253360 100%)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(24, 34, 64, 0.25)',
                transition: 'all 0.18s ease',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(24, 34, 64, 0.35)';
                e.currentTarget.style.background = 'linear-gradient(135deg, #1e2c54 0%, #2d3e74 100%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(24, 34, 64, 0.25)';
                e.currentTarget.style.background = 'linear-gradient(135deg, #182240 0%, #253360 100%)';
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.25 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 700 }}>
                  <span>نبدأ على بركة الله</span>
                  <svg 
                    viewBox="0 0 24 24" 
                    width="16" 
                    height="16" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{ transform: 'rotate(180deg)' }}
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
                <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 400, letterSpacing: '0.02em', marginTop: '2px' }}>
                  Accéder à Elios Workspace
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
