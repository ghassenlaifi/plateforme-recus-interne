"use client";

import React, { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { Operator, getOperatorColors } from '@/types';
import { playWhipSound, isWhipMuted, setWhipMuted } from '@/lib/whipSound';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const initials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
};

interface OpenWhipOverlayProps {
  triggeredBy: string;
  taskTitle: string;
  message: string;
  onClose: () => void;
  autoCloseMs?: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export function OpenWhipOverlay({
  triggeredBy,
  taskTitle,
  message,
  onClose,
  autoCloseMs = 3000,
}: OpenWhipOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [progress, setProgress] = useState(100);

  const { data: operatorsData } = useSWR<Operator[]>('/api/operators', fetcher);
  const operators = Array.isArray(operatorsData) ? operatorsData : [];
  const senderColors = getOperatorColors(triggeredBy, operators);

  // Initialisation mute
  useEffect(() => {
    setMutedState(isWhipMuted());
  }, []);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !muted;
    setMutedState(next);
    setWhipMuted(next);
  };

  // Animation Canvas du fouet & des particules
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime = performance.now();
    let hasCracked = false;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Point d'ancrage (poignée en bas à gauche)
    const getHandle = () => ({ x: 60, y: canvas.height - 40 });
    // Point d'impact / de claquement (centre de l'écran, légèrement vers le haut)
    const getTarget = () => ({ x: canvas.width * 0.52, y: canvas.height * 0.38 });

    const sparks: Spark[] = [];
    let shockwaveRadius = 0;
    let shockwaveAlpha = 0;

    const triggerCrack = () => {
      hasCracked = true;
      playWhipSound();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 320);
      setShowCard(true);

      const target = getTarget();
      shockwaveRadius = 5;
      shockwaveAlpha = 1.0;

      // Générer 40 étincelles incandescentes
      const colors = ['#fde047', '#fb923c', '#ef4444', '#ffffff', '#f59e0b'];
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 12;
        sparks.push({
          x: target.x,
          y: target.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 2 + Math.random() * 4,
          alpha: 1,
          life: 0,
          maxLife: 30 + Math.random() * 25,
        });
      }
    };

    const render = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const handle = getHandle();
      const target = getTarget();

      // Durée du coup de fouet avant claquement : ~320ms
      const lashDuration = 320;
      const t = Math.min(1, elapsed / lashDuration);

      if (t >= 0.95 && !hasCracked) {
        triggerCrack();
      }

      // Dessiner le fouet (animation dynamique de la corde)
      if (elapsed < 1600) {
        // Courbe de Bézier simulant l'onde du fouet qui se propage et claque
        ctx.save();

        // Poignée en cuir
        ctx.save();
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#451a03'; // Brun cuir foncé
        ctx.beginPath();
        ctx.moveTo(handle.x - 20, handle.y + 20);
        ctx.lineTo(handle.x + 25, handle.y - 15);
        ctx.stroke();

        // Anneau doré de poignée
        ctx.lineWidth = 16;
        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(handle.x + 20, handle.y - 10);
        ctx.lineTo(handle.x + 25, handle.y - 15);
        ctx.stroke();
        ctx.restore();

        // Points de contrôle de la lanière
        const currentTipX = handle.x + (target.x - handle.x) * Math.sin(t * (Math.PI / 2));
        const currentTipY = handle.y + (target.y - handle.y) * Math.sin(t * (Math.PI / 2));

        // Onde de boucle (le fouet fait une boucle sinueuse avant d'exploser)
        const waveAmp = (1 - t * 0.7) * 220;
        const waveFreq = t * Math.PI * 3;
        const cp1x = handle.x + (currentTipX - handle.x) * 0.35 + Math.cos(waveFreq) * waveAmp;
        const cp1y = handle.y - 120 + Math.sin(waveFreq) * (waveAmp * 0.8);

        const cp2x = handle.x + (currentTipX - handle.x) * 0.75 - Math.sin(waveFreq) * waveAmp;
        const cp2y = target.y - 80 + Math.cos(waveFreq) * (waveAmp * 0.6);

        // Dessiner l'ombre de la lanière
        ctx.beginPath();
        ctx.moveTo(handle.x + 25, handle.y - 15);
        ctx.bezierCurveTo(cp1x, cp1y + 12, cp2x, cp2y + 12, currentTipX, currentTipY + 12);
        ctx.lineWidth = 9 * (1 - t * 0.3);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineCap = 'round';
        ctx.stroke();

        // Lanière principale (cuir fauve tressé)
        ctx.beginPath();
        ctx.moveTo(handle.x + 25, handle.y - 15);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, currentTipX, currentTipY);
        ctx.lineWidth = 8 * (1 - t * 0.4);
        ctx.strokeStyle = '#78350f'; // Brun cuir
        ctx.lineCap = 'round';
        ctx.stroke();

        // Ligne de brillance supérieure
        ctx.beginPath();
        ctx.moveTo(handle.x + 25, handle.y - 15);
        ctx.bezierCurveTo(cp1x, cp1y - 2, cp2x, cp2y - 2, currentTipX, currentTipY);
        ctx.lineWidth = 3.5 * (1 - t * 0.4);
        ctx.strokeStyle = '#fde68a'; // Reflet lumière dorée
        ctx.lineCap = 'round';
        ctx.stroke();

        // La mèche / cracker (pointe blanche/rouge ultra rapide)
        ctx.beginPath();
        ctx.arc(currentTipX, currentTipY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        ctx.restore();
      }

      // Dessiner l'onde de choc circulaire au moment du crack
      if (shockwaveAlpha > 0.01) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(target.x, target.y, shockwaveRadius, 0, Math.PI * 2);
        ctx.lineWidth = 6 * shockwaveAlpha;
        ctx.strokeStyle = `rgba(251, 191, 36, ${shockwaveAlpha})`;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(target.x, target.y, shockwaveRadius * 0.7, 0, Math.PI * 2);
        ctx.lineWidth = 3 * shockwaveAlpha;
        ctx.strokeStyle = `rgba(255, 255, 255, ${shockwaveAlpha})`;
        ctx.stroke();
        ctx.restore();

        shockwaveRadius += 9;
        shockwaveAlpha *= 0.91;
      }

      // Dessiner les étincelles
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.25; // gravité
        s.vx *= 0.96; // résistance air
        s.life += 1;
        s.alpha = Math.max(0, 1 - (s.life / s.maxLife));

        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (1 - s.life / s.maxLife * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (s.life >= s.maxLife) {
          sparks.splice(i, 1);
        }
      }

      // Arrêt complet et définitif du rendu Canvas une fois le coup de fouet passé
      if (elapsed > 1500 && sparks.length === 0 && shockwaveAlpha <= 0.01) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return; // Fin de l'animation, aucun appel ultérieur à requestAnimationFrame
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Décompte progress bar & auto-dismiss
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / autoCloseMs) * 100);
      setProgress(remainingPct);
      if (remainingPct <= 0) {
        clearInterval(interval);
        onClose();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [autoCloseMs, onClose]);

  return (
    <div 
      className={`openwhip-overlay-container ${isShaking ? 'whip-shake-active' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        pointerEvents: showCard ? 'auto' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      {/* Canvas d'animation pleine page */}
      <canvas 
        ref={canvasRef} 
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Badge BD "💥 CRACK !" surgissant au point d'impact */}
      {isShaking && (
        <div 
          className="whip-crack-burst"
          style={{
            position: 'absolute',
            top: '32%',
            left: '52%',
            transform: 'translate(-50%, -50%) rotate(-8deg)',
            pointerEvents: 'none',
            zIndex: 100001,
          }}
        >
          <div 
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: 'min(44px, 9vw)',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              padding: '12px 28px',
              borderRadius: '24px',
              boxShadow: '0 0 50px rgba(239, 68, 68, 0.8), 0 10px 30px rgba(0,0,0,0.5)',
              border: '4px solid #fff',
              textShadow: '3px 3px 0 #991b1b',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span>💥</span>
            <span>CRACK !</span>
            <span>🤠</span>
          </div>
        </div>
      )}

      {/* Carte d'annonce OpenWhip */}
      {showCard && (
        <div 
          className="openwhip-card-appear"
          style={{
            position: 'relative',
            zIndex: 100002,
            maxWidth: '520px',
            width: 'min(520px, 94vw)',
            background: 'var(--card, #ffffff)',
            borderRadius: '20px',
            padding: 'min(20px, 4.5vw)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 2px var(--acc, #3b82f6)',
            color: 'var(--ink, #0f172a)',
            animation: 'whipCardPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          }}
        >
          {/* Header de la carte */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span 
                style={{ 
                  fontSize: '24px', 
                  display: 'inline-flex',
                }}
              >
                🤠💥
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                  Coup de fouet reçu !
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Bouton sourdine */}
              <button
                type="button"
                onClick={toggleMute}
                title={muted ? 'Activer le son du fouet' : 'Couper le son du fouet'}
                style={{
                  background: 'var(--hover, rgba(0,0,0,0.05))',
                  border: '1px solid var(--line, rgba(0,0,0,0.1))',
                  borderRadius: '10px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{muted ? '🔇' : '🔊'}</span>
              </button>

              {/* Bouton fermer */}
              <button
                type="button"
                onClick={onClose}
                title="Fermer"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--ink3, #94a3b8)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Déclencheur & Tâche */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              background: 'var(--hover, rgba(0,0,0,0.03))',
              border: '1px solid var(--line, rgba(0,0,0,0.08))',
              borderRadius: '16px',
              padding: '12px 14px',
              marginBottom: '16px',
            }}
          >
            <span 
              style={{ 
                width: 42, 
                height: 42, 
                borderRadius: '50%', 
                backgroundColor: senderColors.dot, 
                color: '#fff', 
                display: 'grid', 
                placeItems: 'center', 
                fontSize: '14px', 
                fontWeight: 800,
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              {initials(triggeredBy)}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                <span style={{ color: senderColors.dot }}>{triggeredBy}</span> vous secoue sur la tâche :
              </div>
              <div 
                style={{ 
                  fontSize: '13px', 
                  color: 'var(--ink2, #475569)', 
                  fontWeight: 600, 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  marginTop: '2px',
                }}
              >
                « {taskTitle} »
              </div>
            </div>
          </div>

          {/* Bulle BD avec la punchline choisie (si présente et non décochée) */}
          {message && message.trim() ? (
            <div 
              style={{
                position: 'relative',
                background: 'linear-gradient(135deg, color-mix(in srgb, #f59e0b 12%, var(--card)), color-mix(in srgb, #ef4444 8%, var(--card)))',
                border: '2px dashed color-mix(in srgb, #f59e0b 50%, var(--line))',
                borderRadius: '16px',
                padding: '16px 18px',
                marginBottom: '18px',
                textAlign: 'center',
              }}
            >
              <div 
                style={{
                  fontSize: 'min(18px, 4.4vw)',
                  fontWeight: 800,
                  lineHeight: 1.4,
                  color: '#b45309',
                  letterSpacing: '-0.2px',
                }}
              >
                « {message} »
              </div>
            </div>
          ) : null}

          {/* Action et Barre de progression */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)',
                transition: 'transform 0.15s ease',
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <span>🫡</span>
              <span>Bien reçu, je m’y mets tout de suite !</span>
            </button>

            {/* Barre de temps restant */}
            <div 
              style={{ 
                height: '4px', 
                width: '100%', 
                background: 'var(--line, rgba(0,0,0,0.08))', 
                borderRadius: '999px',
                overflow: 'hidden',
              }}
            >
              <div 
                style={{ 
                  height: '100%', 
                  width: `${progress}%`, 
                  background: '#f59e0b', 
                  transition: 'width 0.05s linear',
                }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Styles CSS in-component pour la secousse et les animations */}
      <style jsx>{`
        @keyframes whipShake {
          0% { transform: translate(0, 0); }
          15% { transform: translate(-6px, 4px) rotate(-1deg); }
          30% { transform: translate(6px, -5px) rotate(1.2deg); }
          45% { transform: translate(-5px, -3px) rotate(-0.8deg); }
          60% { transform: translate(4px, 4px) rotate(0.6deg); }
          75% { transform: translate(-3px, 2px); }
          90% { transform: translate(2px, -1px); }
          100% { transform: translate(0, 0); }
        }

        .whip-shake-active {
          animation: whipShake 0.32s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }

        @keyframes whipCardPop {
          0% {
            opacity: 0;
            transform: scale(0.7) translateY(40px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes whipHatBounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(6deg); }
        }
      `}</style>
    </div>
  );
}

