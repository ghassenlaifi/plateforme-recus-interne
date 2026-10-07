"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface BasketballUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  isImporting: boolean;
  importFile: File | null;
  setImportFile: (file: File | null) => void;
  onSelectFile: (file: File) => void;
  onSubmitImport: (fileToImport?: File) => void;
  importMsg: { text: string; type: 'ok' | 'err' } | null;
  setImportMsg: (msg: { text: string; type: 'ok' | 'err' } | null) => void;
}

export function BasketballUploadModal({
  isOpen,
  onClose,
  isImporting,
  importFile,
  setImportFile,
  onSelectFile,
  onSubmitImport,
  importMsg,
  setImportMsg
}: BasketballUploadModalProps) {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isDraggingOverCourt, setIsDraggingOverCourt] = useState(false);
  const [isAiming, setIsAiming] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [isShooting, setIsShooting] = useState(false);
  const [shotProgress, setShotProgress] = useState(0); // 0 to 1
  const [shotStartPos, setShotStartPos] = useState<{ x: number; y: number }>({ x: 70, y: 260 });
  const [isSwishing, setIsSwishing] = useState(false);
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; y: number; color: string; vx: number; vy: number }>>([]);
  const [showCelebration, setShowCelebration] = useState(false);

  const courtRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize sound preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('elios.basketball.sound');
      if (saved !== null) {
        setIsSoundEnabled(saved === 'true');
      }
    } catch {}
  }, []);

  const toggleSound = () => {
    const next = !isSoundEnabled;
    setIsSoundEnabled(next);
    try {
      localStorage.setItem('elios.basketball.sound', String(next));
    } catch {}
  };

  // Reset temporary animation & shot state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDragPos(null);
      setIsAiming(false);
      setIsShooting(false);
      setShowCelebration(false);
      setConfetti([]);
    }
  }, [isOpen]);

  // Web Audio API sound synthesis
  const playSwishSound = useCallback(() => {
    if (!isSoundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const bufferSize = Math.floor(ctx.sampleRate * 0.28);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2100;
      filter.Q.value = 2.4;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch {}
  }, [isSoundEnabled]);

  const playBounceSound = useCallback(() => {
    if (!isSoundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(170, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {}
  }, [isSoundEnabled]);

  // Hoop coordinates relative to court (center width, y=140)
  const getHoopCenter = () => {
    if (!courtRef.current) return { x: 230, y: 145 };
    const rect = courtRef.current.getBoundingClientRect();
    return { x: rect.width / 2, y: 140 };
  };

  // Launch a celebratory particle burst
  const triggerConfetti = (centerX: number, centerY: number) => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    const count = 18;
    const pieces = Array.from({ length: count }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 2.5 + Math.random() * 3.5;
      return {
        id: Date.now() + i,
        x: centerX,
        y: centerY,
        color: colors[i % colors.length],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5
      };
    });
    setConfetti(pieces);
    setShowCelebration(true);
    setTimeout(() => {
      setConfetti([]);
      setShowCelebration(false);
    }, 1200);
  };

  // Trigger smooth shot animation into the basket
  const triggerShotAnimation = useCallback((fromPos: { x: number; y: number }, targetFileToImport?: File) => {
    if (isShooting) return;
    setIsShooting(true);
    setShotStartPos(fromPos);
    setShotProgress(0);

    const hoop = getHoopCenter();
    const duration = 650; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const p = Math.min(1, elapsed / duration);
      // Ease out cubic for realistic ball arc
      setShotProgress(p);

      if (p < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // SWISH!
        setIsShooting(false);
        setShotProgress(0);
        setIsSwishing(true);
        playSwishSound();
        triggerConfetti(hoop.x, hoop.y + 25);

        setTimeout(() => setIsSwishing(false), 600);

        // Dès qu'un panier réussit :
        if (targetFileToImport || importFile) {
          setImportMsg({
            text: 'Panier réussi ! 🏀 Cliquez sur "Lancer l\'importation" pour valider l\'import.',
            type: 'ok'
          });
        } else {
          // Aucun fichier n'est encore sélectionné : ouvrir l'explorateur de fichiers immédiatement
          setImportMsg({
            text: 'Panier réussi ! 🏀 Sélectionnez votre fichier .csv ou .xlsx dans l\'explorateur.',
            type: 'ok'
          });
          setTimeout(() => {
            fileInputRef.current?.click();
          }, 350);
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [isShooting, importFile, playSwishSound, setImportMsg]);

  // Clean animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Drag aiming handlers (Mouse & Touch)
  const handleAimStart = (clientX: number, clientY: number) => {
    if (isShooting || isImporting) return;
    if (!courtRef.current) return;
    const rect = courtRef.current.getBoundingClientRect();
    const x = Math.max(20, Math.min(rect.width - 20, clientX - rect.left));
    const y = Math.max(20, Math.min(rect.height - 20, clientY - rect.top));
    setIsAiming(true);
    setDragPos({ x, y });
    playBounceSound();
  };

  const handleAimMove = (clientX: number, clientY: number) => {
    if (!isAiming || !courtRef.current) return;
    const rect = courtRef.current.getBoundingClientRect();
    const x = Math.max(20, Math.min(rect.width - 20, clientX - rect.left));
    const y = Math.max(20, Math.min(rect.height - 20, clientY - rect.top));
    setDragPos({ x, y });
  };

  const handleAimEnd = () => {
    if (!isAiming) return;
    setIsAiming(false);
    const hoop = getHoopCenter();
    const current = dragPos || { x: 70, y: 260 };
    setDragPos(null);

    // If released upwards or towards the basket, take the shot!
    const isReleasedTowardsBasket = current.y < 240 || Math.hypot(current.x - hoop.x, current.y - hoop.y) < 180;
    if (isReleasedTowardsBasket) {
      triggerShotAnimation(current);
    } else {
      // Spring back to base
      playBounceSound();
    }
  };

  // Native File Drop on Court
  const handleCourtDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverCourt(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      onSelectFile(droppedFile);

      // Trigger basketball shot right from drop point!
      if (courtRef.current) {
        const rect = courtRef.current.getBoundingClientRect();
        const dropX = Math.max(30, Math.min(rect.width - 30, e.clientX - rect.left));
        const dropY = Math.max(30, Math.min(rect.height - 30, e.clientY - rect.top));
        triggerShotAnimation({ x: dropX, y: dropY }, droppedFile);
      } else {
        triggerShotAnimation({ x: 70, y: 260 }, droppedFile);
      }
    }
  };

  // Position calculation during shot along a smooth parabolic curve
  const hoop = getHoopCenter();
  const getShootingPosition = () => {
    const p = shotProgress;
    const start = shotStartPos;
    // Control point for parabolic apex higher than the rim
    const ctrlX = (start.x + hoop.x) / 2;
    const ctrlY = Math.min(start.y, hoop.y) - 90;

    // Quadratic Bezier formula
    const x = Math.pow(1 - p, 2) * start.x + 2 * (1 - p) * p * ctrlX + Math.pow(p, 2) * hoop.x;
    const y = Math.pow(1 - p, 2) * start.y + 2 * (1 - p) * p * ctrlY + Math.pow(p, 2) * (hoop.y + 12);
    const rotation = (p * 360 * 1.5) % 360;
    const scale = 1 - p * 0.28; // ball/file slightly scales down as it recedes towards the rim

    return { x, y, rotation, scale };
  };

  // Trajectory dots for aiming
  const renderAimDots = () => {
    if (!isAiming || !dragPos) return null;
    const start = dragPos;
    const ctrlX = (start.x + hoop.x) / 2;
    const ctrlY = Math.min(start.y, hoop.y) - 80;
    const dotsCount = 7;
    const dots = [];

    for (let i = 1; i <= dotsCount; i++) {
      const t = i / (dotsCount + 1);
      const dx = Math.pow(1 - t, 2) * start.x + 2 * (1 - t) * t * ctrlX + Math.pow(t, 2) * hoop.x;
      const dy = Math.pow(1 - t, 2) * start.y + 2 * (1 - t) * t * ctrlY + Math.pow(t, 2) * hoop.y;
      dots.push(
        <div
          key={`dot-${i}`}
          style={{
            position: 'absolute',
            left: `${dx}px`,
            top: `${dy}px`,
            width: `${5 + (1 - t) * 3}px`,
            height: `${5 + (1 - t) * 3}px`,
            borderRadius: '50%',
            background: 'var(--brand)',
            opacity: 0.35 + t * 0.5,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            boxShadow: '0 0 6px rgba(59, 130, 246, 0.5)'
          }}
        />
      );
    }
    return dots;
  };

  if (!isOpen) return null;

  const currentFileBadge = importFile
    ? importFile.name.endsWith('.csv') ? 'CSV' : 'XLSX'
    : 'XLSX';

  const shotPos = isShooting ? getShootingPosition() : null;

  return (
    <div 
      className="modal-overlay" 
      style={{ zIndex: 120, padding: '16px' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isImporting && !isShooting) {
          setImportFile(null);
          setImportMsg(null);
          onClose();
        }
      }}
    >
      <div 
        className="modal-dialog" 
        style={{ 
          width: 'min(500px, 94vw)', 
          borderRadius: '24px', 
          background: 'var(--card)', 
          border: '1px solid var(--line)', 
          boxShadow: '0 20px 50px rgba(0,0,0,0.18)', 
          padding: '24px', 
          boxSizing: 'border-box', 
          overflow: 'hidden', 
          position: 'relative' 
        }}
      >
        {/* En-tête : Titre + Sous-titre + Bouton Son + Bouton Fermer */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
              Upload files
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--ink3)', margin: '4px 0 0', fontWeight: 500 }}>
              Drag and drop, or take the shot.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Bouton Sound Mute / Unmute */}
            <button
              type="button"
              onClick={toggleSound}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '1px solid var(--line)',
                background: isSoundEnabled ? 'var(--hover)' : 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: isSoundEnabled ? 'var(--ink)' : 'var(--ink3)',
                transition: 'all 0.15s ease'
              }}
              title={isSoundEnabled ? 'Son activé (cliquez pour couper)' : 'Son coupé (cliquez pour activer)'}
            >
              {isSoundEnabled ? (
                <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              )}
            </button>

            {/* Bouton Fermer */}
            <button
              type="button"
              onClick={() => {
                setImportFile(null);
                setImportMsg(null);
                onClose();
              }}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '1px solid var(--line)',
                background: 'var(--card)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--ink2)',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
              disabled={isImporting}
              title="Fermer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Zone Terrain de Basket / Dropzone principale */}
        <div
          ref={courtRef}
          style={{
            position: 'relative',
            width: '100%',
            height: '310px',
            borderRadius: '20px',
            border: isDraggingOverCourt ? '2px dashed var(--brand)' : '2px dashed #D1D5DB',
            background: isDraggingOverCourt ? 'rgba(59, 130, 246, 0.05)' : 'rgba(249, 250, 251, 0.7)',
            transition: 'border-color 0.2s, background 0.2s',
            overflow: 'hidden',
            userSelect: 'none',
            touchAction: 'none'
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOverCourt(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOverCourt(false);
          }}
          onDrop={handleCourtDrop}
          onMouseMove={(e) => {
            if (isAiming) handleAimMove(e.clientX, e.clientY);
          }}
          onMouseUp={handleAimEnd}
          onTouchMove={(e) => {
            if (isAiming && e.touches[0]) {
              handleAimMove(e.touches[0].clientX, e.touches[0].clientY);
            }
          }}
          onTouchEnd={handleAimEnd}
        >
          {/* Haut de la Dropzone : Icône Upload + Drop files here */}
          <div 
            style={{ 
              position: 'absolute', 
              top: '18px', 
              left: 0, 
              right: 0, 
              textAlign: 'center', 
              pointerEvents: 'none',
              zIndex: 5
            }}
          >
            <div 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                color: '#4B5563',
                marginBottom: '4px'
              }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)' }}>
              Drop files here
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--ink3)', marginTop: '2px' }}>
              or take the shot
            </div>
          </div>

          {/* ======================================================== */}
          {/* LE PANIER DE BASKET (Backboard + Rim + Woven Mesh Net)   */}
          {/* ======================================================== */}
          <div
            style={{
              position: 'absolute',
              top: '82px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '130px',
              height: '140px',
              pointerEvents: 'none',
              zIndex: 10
            }}
          >
            <svg 
              viewBox="0 0 130 140" 
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              <defs>
                <filter id="hoop-shadow" x="-10%" y="-10%" width="120%" height="130%">
                  <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.12"/>
                </filter>
              </defs>

              {/* Panneau de basket (Backboard transparent rectangulaire arrondi) */}
              <rect 
                x="20" 
                y="6" 
                width="90" 
                height="62" 
                rx="8" 
                fill="#ffffff" 
                stroke="#6B7280" 
                strokeWidth="2.2"
                filter="url(#hoop-shadow)"
              />
              {/* Carré de cible intérieur du panneau */}
              <rect 
                x="44" 
                y="24" 
                width="42" 
                height="32" 
                rx="3" 
                fill="none" 
                stroke="#3B82F6" 
                strokeWidth="2.2"
              />

              {/* Support métallique de l'arceau */}
              <rect x="58" y="58" width="14" height="6" fill="#D97706" rx="1"/>

              {/* Filet de basket maillé (Net) */}
              <g 
                style={{
                  transformOrigin: '65px 64px',
                  transform: isSwishing ? 'scale(1.18, 1.35)' : 'scale(1, 1)',
                  transition: isSwishing ? 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'transform 0.4s ease-out'
                }}
              >
                {/* Lignes verticales/diagonales du filet maillé */}
                <path 
                  d="M 37 64 L 46 94 L 52 118 L 65 120 L 78 118 L 84 94 L 93 64" 
                  fill="none" 
                  stroke="#9CA3AF" 
                  strokeWidth="1.5" 
                  strokeLinecap="round"
                />
                <path 
                  d="M 46 64 L 54 94 L 60 118 L 65 120 L 70 118 L 76 94 L 84 64" 
                  fill="none" 
                  stroke="#CBD5E1" 
                  strokeWidth="1.3" 
                />
                <path 
                  d="M 55 64 L 62 94 L 65 119 L 68 94 L 75 64" 
                  fill="none" 
                  stroke="#9CA3AF" 
                  strokeWidth="1.3" 
                />

                {/* Cordes horizontales entrelacées du filet */}
                <ellipse cx="65" cy="80" rx="20" ry="4" fill="none" stroke="#9CA3AF" strokeWidth="1.2" strokeDasharray="3 2"/>
                <ellipse cx="65" cy="98" rx="14" ry="3.5" fill="none" stroke="#CBD5E1" strokeWidth="1.2" strokeDasharray="3 2"/>
                <ellipse cx="65" cy="116" rx="9" ry="2.5" fill="none" stroke="#9CA3AF" strokeWidth="1.4"/>
              </g>

              {/* L'Arceau de basket (Rim) devant le filet */}
              <ellipse 
                cx="65" 
                cy="64" 
                rx="28" 
                ry="8.5" 
                fill="none" 
                stroke="#EA580C" 
                strokeWidth="3.4"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Effet visuel célébration SWISH */}
          {showCelebration && (
            <div 
              style={{
                position: 'absolute',
                top: '120px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 25,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                animation: 'fadeIn 0.2s ease-out'
              }}
            >
              <span 
                style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: '#fff',
                  fontWeight: 500,
                  fontSize: '9.5px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  padding: '3px 9px',
                  borderRadius: '999px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                  transform: 'none'
                }}
              >
                {isImporting ? 'SWISH ! 🏀 IMPORT EN COURS' : 'SWISH ! 🏀 PANIER RÉUSSI'}
              </span>
            </div>
          )}

          {/* Particules Confetti éclatant du panier */}
          {confetti.map((c) => (
            <div
              key={c.id}
              style={{
                position: 'absolute',
                left: `${c.x}px`,
                top: `${c.y}px`,
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: c.color,
                pointerEvents: 'none',
                zIndex: 30,
                transform: `translate(${c.vx * 8}px, ${c.vy * 8}px)`,
                transition: 'all 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
                opacity: 0.9
              }}
            />
          ))}

          {/* Points de trajectoire de visée (Aim dots) */}
          {renderAimDots()}

          {/* ======================================================== */}
          {/* FICHIER EN COURS DE VOL (SHOOTING PARABOLIC PROJECTILE)  */}
          {/* ======================================================== */}
          {isShooting && shotPos && (
            <div
              style={{
                position: 'absolute',
                left: `${shotPos.x}px`,
                top: `${shotPos.y}px`,
                transform: `translate(-50%, -50%) rotate(${shotPos.rotation}deg) scale(${shotPos.scale})`,
                zIndex: 20,
                pointerEvents: 'none',
                transition: 'none'
              }}
            >
              {/* Document volant avec badge */}
              <div
                style={{
                  width: '38px',
                  height: '48px',
                  background: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  position: 'relative'
                }}
              >
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    right: 0, 
                    width: 0, 
                    height: 0, 
                    borderStyle: 'solid', 
                    borderWidth: '0 8px 8px 0', 
                    borderColor: 'transparent #9CA3AF transparent transparent' 
                  }} 
                />
                <span 
                  style={{ 
                    fontSize: '9px', 
                    fontWeight: 800, 
                    color: currentFileBadge === 'CSV' ? '#2563EB' : '#059669',
                    letterSpacing: '-0.02em'
                  }}
                >
                  {currentFileBadge}
                </span>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* LE FICHIER DRAGGABLE AU BAS GAUCHE ("Take the shot")      */}
          {/* ======================================================== */}
          {!isShooting && (
            <div
              style={{
                position: 'absolute',
                left: isAiming && dragPos ? `${dragPos.x}px` : '42px',
                top: isAiming && dragPos ? `${dragPos.y}px` : '240px',
                transform: isAiming ? 'translate(-50%, -50%) scale(1.08)' : 'none',
                zIndex: 15,
                cursor: 'grab',
                transition: isAiming ? 'none' : 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}
              onMouseDown={(e) => handleAimStart(e.clientX, e.clientY)}
              onTouchStart={(e) => {
                if (e.touches[0]) handleAimStart(e.touches[0].clientX, e.touches[0].clientY);
              }}
              title="Cliquez et tirez vers le panier pour marquer !"
            >
              <div
                style={{
                  width: '42px',
                  height: '52px',
                  background: '#ffffff',
                  borderRadius: '7px',
                  border: '1.2px solid #E5E7EB',
                  boxShadow: isAiming 
                    ? '0 12px 28px rgba(37, 99, 235, 0.25), 0 0 0 2px var(--brand)' 
                    : '0 4px 12px rgba(0,0,0,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                {/* Coin plié */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    right: 0, 
                    width: 0, 
                    height: 0, 
                    borderStyle: 'solid', 
                    borderWidth: '0 10px 10px 0', 
                    borderColor: 'transparent #CBD5E1 transparent transparent' 
                  }} 
                />
                
                {/* Lignes de texte factices de document */}
                <div style={{ width: '22px', height: '2px', background: '#E2E8F0', borderRadius: '1px', marginBottom: '3px' }} />
                <div style={{ width: '16px', height: '2px', background: '#E2E8F0', borderRadius: '1px', marginBottom: '6px' }} />

                {/* Badge Format (PDF / CSV / XLSX) comme sur la capture */}
                <span 
                  style={{ 
                    fontSize: '9px', 
                    fontWeight: 800, 
                    color: '#ffffff',
                    background: currentFileBadge === 'CSV' ? '#2563EB' : '#059669',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1
                  }}
                >
                  {currentFileBadge}
                </span>

                {/* Petite main curseur d'indication (👆) si pas encore en train de viser */}
                {!isAiming && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-8px',
                      right: '-8px',
                      fontSize: '15px',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                      animation: 'bounce 1.5s infinite',
                      pointerEvents: 'none'
                    }}
                  >
                    👆
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mention d'aide au bas : "Aim the file & release to shoot into the basket" */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: '11px',
              color: 'var(--ink3)',
              fontWeight: 500,
              pointerEvents: 'none',
              letterSpacing: '-0.01em'
            }}
          >
            Aim the file & release to shoot into the basket
          </div>
        </div>

        {/* Détail du fichier sélectionné (si un fichier a été choisi ou déposé) */}
        <div style={{ marginTop: '14px' }}>
          {importFile ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 14px',
                borderRadius: '12px',
                background: 'var(--hover)',
                border: '1px solid var(--line)',
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span 
                  style={{ 
                    fontSize: '10px', 
                    fontWeight: 800, 
                    color: '#fff', 
                    background: '#059669', 
                    padding: '2px 5px', 
                    borderRadius: '4px' 
                  }}
                >
                  {importFile.name.endsWith('.csv') ? 'CSV' : 'XLSX'}
                </span>
                <span 
                  style={{ 
                    fontWeight: 600, 
                    color: 'var(--ink)', 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    maxWidth: '260px'
                  }}
                >
                  {importFile.name}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--ink3)', flexShrink: 0 }}>
                  ({(importFile.size / 1024).toFixed(1)} Ko)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => triggerShotAnimation({ x: 70, y: 260 })}
                  disabled={isShooting || isImporting}
                  className="btn"
                  style={{ height: '28px', padding: '0 9px', fontSize: '11.5px', fontWeight: 600, gap: '4px' }}
                  title="Tirer au panier"
                >
                  🏀 Tirer
                </button>
                <button
                  type="button"
                  onClick={() => setImportFile(null)}
                  style={{
                    border: 'none',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#DC2626',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Retirer le fichier"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px' 
              }}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn"
                style={{ fontSize: '12.5px', height: '32px', gap: '6px' }}
              >
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>Parcourir vos fichiers (CSV / Excel)</span>
              </button>
            </div>
          )}

          {/* Input file caché */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const picked = e.target.files[0];
                onSelectFile(picked);
                setImportMsg({
                  text: `Fichier prêt : "${picked.name}". Cliquez sur "Lancer l'importation" pour valider.`,
                  type: 'ok'
                });
              }
              e.target.value = '';
            }}
          />

          {/* Message d'erreur ou succès */}
          {importMsg && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '12.5px',
                fontWeight: 500,
                background: importMsg.type === 'ok' ? '#ECFDF5' : '#FEF2F2',
                color: importMsg.type === 'ok' ? '#065F46' : '#991B1B',
                border: `1px solid ${importMsg.type === 'ok' ? '#A7F3D0' : '#FECACA'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>{importMsg.type === 'ok' ? '✓' : '⚠️'}</span>
              <span>{importMsg.text}</span>
            </div>
          )}
        </div>

        {/* Pied de la modale : Boutons d'action standards */}
        <div 
          style={{ 
            marginTop: '20px', 
            paddingTop: '16px', 
            borderTop: '1px solid var(--line)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-end', 
            gap: '10px' 
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={() => {
              setImportFile(null);
              setImportMsg(null);
              onClose();
            }}
            disabled={isImporting || isShooting}
          >
            Annuler
          </button>
          
          <button
            type="button"
            className="btn pri"
            disabled={!importFile || isImporting || isShooting}
            onClick={() => onSubmitImport()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {isImporting ? (
              <>
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                <span>Importation...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>Lancer l'importation</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
