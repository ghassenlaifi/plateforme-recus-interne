"use client";

import React, { useState, useEffect } from 'react';
import { X, Sparkles, HeartHandshake, Zap, Compass, Clock } from 'lucide-react';
import {
  MotivationalPopupType,
  MotivationalEventData,
  checkInactivityReturn,
  getActiveOperatorName
} from '@/lib/motivationTracker';

/**
 * Petit Ghost amical animé en SVG :
 * Sourit joyeusement, flotte délicatement et s'agrandit progressivement (scale-up).
 */
function FriendlySmilingGhost() {
  return (
    <div className="ghost-animation-container" style={{ position: 'relative', width: '120px', height: '130px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`
        @keyframes ghostFloatingScale {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-10px) scale(1.09);
          }
        }
        @keyframes ghostShadowPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.25;
          }
          50% {
            transform: scale(0.82);
            opacity: 0.12;
          }
        }
        @keyframes ghostSparkleTwinkle {
          0%, 100% {
            transform: scale(0.8) rotate(0deg);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.2) rotate(180deg);
            opacity: 1;
          }
        }
        @keyframes ghostWiggleArm {
          0%, 100% {
            transform: rotate(-4deg);
          }
          50% {
            transform: rotate(6deg);
          }
        }
        .ghost-body-float {
          animation: ghostFloatingScale 2.8s ease-in-out infinite;
          transform-origin: center bottom;
        }
        .ghost-shadow-pulse {
          animation: ghostShadowPulse 2.8s ease-in-out infinite;
        }
        .ghost-sparkle-1 {
          animation: ghostSparkleTwinkle 2.2s ease-in-out infinite;
        }
        .ghost-sparkle-2 {
          animation: ghostSparkleTwinkle 2.6s ease-in-out infinite 0.7s;
        }
        @media (max-width: 480px) {
          .ghost-animation-container {
            transform: scale(0.9);
            margin: -4px 0 -6px;
          }
          .motivational-modal-card {
            border-radius: 20px !important;
            max-width: 96vw !important;
          }
          .motivational-modal-inner {
            padding: 22px 16px 20px !important;
            gap: 13px !important;
          }
          .motivational-modal-title {
            font-size: 17.5px !important;
            line-height: 1.35 !important;
          }
          .motivational-modal-duaa {
            font-size: 17px !important;
            line-height: 1.65 !important;
          }
        }
        @media (max-height: 660px) {
          .ghost-animation-container {
            transform: scale(0.78);
            margin: -10px 0 -12px;
          }
          .motivational-modal-inner {
            padding: 18px 16px 18px !important;
            gap: 11px !important;
          }
        }
        .motivational-modal-inner::-webkit-scrollbar {
          width: 4px;
        }
        .motivational-modal-inner::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.35);
          border-radius: 10px;
        }
      `}</style>

      {/* Étincelle magique dorée gauche */}
      <div 
        className="ghost-sparkle-1"
        style={{
          position: 'absolute',
          top: '12px',
          left: '8px',
          color: '#F59E0B',
          fontSize: '14px',
          userSelect: 'none'
        }}
      >
        ✨
      </div>

      {/* Étincelle magique dorée droite */}
      <div 
        className="ghost-sparkle-2"
        style={{
          position: 'absolute',
          top: '20px',
          right: '10px',
          color: '#EAB308',
          fontSize: '13px',
          userSelect: 'none'
        }}
      >
        ⭐
      </div>

      {/* Corps du Ghost avec animation de flottement et d'agrandissement doux */}
      <div className="ghost-body-float" style={{ position: 'relative', width: '92px', height: '104px' }}>
        <svg
          viewBox="0 0 100 115"
          width="92"
          height="106"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: 'drop-shadow(0 10px 18px rgba(59, 130, 246, 0.28))' }}
        >
          {/* Halo doux */}
          <circle cx="50" cy="50" r="46" fill="url(#ghostGlowGrad)" opacity="0.45" />

          {/* Dégradés */}
          <defs>
            <radialGradient id="ghostGlowGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ghostSkinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="65%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>
            <linearGradient id="ghostCheekGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F472B6" />
              <stop offset="100%" stopColor="#FB7185" />
            </linearGradient>
          </defs>

          {/* Silhouette du Ghost (tête ronde + bras + vagues du bas) */}
          <path
            d="M50 10
               C30 10 16 26 16 48
               C16 54 13 60 9 63
               C6 65 6 69 9 71
               C14 74 18 78 19 86
               C20 98 25 104 33 99
               C39 95 44 98 48 103
               C52 103 57 96 63 99
               C69 102 75 100 78 94
               C81 83 83 75 89 71
               C93 69 93 65 90 63
               C86 60 84 54 84 48
               C84 26 70 10 50 10 Z"
            fill="url(#ghostSkinGrad)"
            stroke="#CBD5E1"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />

          {/* Joues roses mignonnes (Blush) */}
          <ellipse cx="30" cy="53" rx="5" ry="3.5" fill="url(#ghostCheekGrad)" opacity="0.65" />
          <ellipse cx="70" cy="53" rx="5" ry="3.5" fill="url(#ghostCheekGrad)" opacity="0.65" />

          {/* Yeux souriants ultra-joyeux (^ ^) */}
          <path
            d="M26 44 C28 39 34 39 36 44"
            stroke="#1E293B"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M64 44 C66 39 72 39 74 44"
            stroke="#1E293B"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          {/* Petit éclat blanc dans les yeux pour l'effet kawaii */}
          <circle cx="31" cy="40" r="1.3" fill="#3B82F6" />
          <circle cx="69" cy="40" r="1.3" fill="#3B82F6" />

          {/* Bouche souriante très chaleureuse */}
          <path
            d="M42 54 C46 62 54 62 58 54"
            stroke="#1E293B"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Petite langue mignonne */}
          <path
            d="M47 58 C48 61 52 61 53 58 Z"
            fill="#FB7185"
            opacity="0.8"
          />

          {/* Bras gauche qui fait coucou / salue */}
          <path
            d="M17 56 C11 52 8 50 6 54 C4 58 9 63 15 64"
            stroke="#CBD5E1"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="#FFFFFF"
          />

          {/* Bras droit amical */}
          <path
            d="M83 56 C89 52 92 50 94 54 C96 58 91 63 85 64"
            stroke="#CBD5E1"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="#FFFFFF"
          />
        </svg>
      </div>

      {/* Ombre portée pulsante au sol */}
      <div
        className="ghost-shadow-pulse"
        style={{
          width: '54px',
          height: '10px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(30, 41, 59, 0.45) 0%, rgba(30, 41, 59, 0) 70%)',
          marginTop: '-4px'
        }}
      />
    </div>
  );
}

export function MotivationalModal() {
  const [modalData, setModalData] = useState<MotivationalEventData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Écoute de l'événement global déclenché par motivationTracker
  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<MotivationalEventData>;
      if (customEvent.detail) {
        setModalData(customEvent.detail);
        setIsOpen(true);
      }
    };

    window.addEventListener('elios-motivational-popup', handleEvent);
    return () => window.removeEventListener('elios-motivational-popup', handleEvent);
  }, []);

  // Vérification de retour après inactivité > 1h 30 min (au montage et au focus de la fenêtre)
  useEffect(() => {
    // Petit délai de 1200ms après l'ouverture pour ne pas surcharger WelcomeModal
    const checkTimer = setTimeout(() => {
      checkInactivityReturn();
    }, 1200);

    const handleFocus = () => {
      checkInactivityReturn();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkInactivityReturn();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(checkTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Fermeture par la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!isOpen || !modalData) return null;

  const operatorName = modalData.operatorName || getActiveOperatorName();

  // Configuration du contenu en fonction du type de popup
  let badgeIcon = <Sparkles size={14} />;
  let badgeText = "ELIOS MOTIVATION";
  let badgeColor = "#2563EB";
  let mainTitle = "";
  let arabicDuaa = "";
  let duaaSubtext = "";
  let buttonText = "Yallah, bismillah !";

  switch (modalData.type) {
    case 'RETURN_AFTER_ABSENCE':
      badgeIcon = <Clock size={14} />;
      badgeText = "RETOUR AU WORKSPACE • +1H30 D'ABSENCE";
      badgeColor = "#D97706";
      mainTitle = `Yallah ${operatorName} nrj3ou nekhdmou, kol contribution tfarah Elios`;
      arabicDuaa = "اللَّهُمَّ إِنِّي أَسْأَلُكَ التَّوْفِيقَ وَالسَّدَادَ، وَبَارِكْ لَنَا فِي أَعْمَالِنَا وَارْزُقْنَا النَّجَاحَ";
      duaaSubtext = "« نسأل الله لك التوفيق والبركة والنجاح في مهامك »";
      buttonText = "Yallah, bismillah !";
      break;

    case 'MILESTONE_7_OPS':
      badgeIcon = <Zap size={14} />;
      badgeText = `🔥 ${modalData.opsCount} OPÉRATIONS EFFECTUÉES`;
      badgeColor = "#16A34A";
      mainTitle = `${modalData.opsCount} opérations effectuées ! Bravo aliiiik ${operatorName} !! rabi iberekleek ..`;
      arabicDuaa = "بَارَكَ اللَّهُ فِي جُهُودِك وَزَادَكَ مِنْ فَضْلِهِ وَتَوْفِيقِهِ وَأَسْعَدَكَ فِي كُلِّ خُطْوَة";
      duaaSubtext = "« عمل ممتاز وهمّة عالية، كل مجهود يبني نجاح فريق Elios ! »";
      buttonText = "Nkammlou hakka !";
      break;

    case 'STATUS_21':
    case 'STATUS_10':
      badgeIcon = <HeartHandshake size={14} />;
      badgeText = "21 Prospects suivis";
      badgeColor = "#EA580C";
      mainTitle = "Aadi tesma3 klem mouch houwa ama was3alna belk myselch.";
      arabicDuaa = "";
      duaaSubtext = "";
      buttonText = "Mwas3in belna w mkamlin !";
      break;

    case 'STATUS_30':
    case 'STATUS_15':
      badgeIcon = <Compass size={14} />;
      badgeText = "30 Prospects suivis";
      badgeColor = "#9333EA";
      mainTitle = "Nverifiw besoin maa Soumaya chkoun lezem nkallmou jem3a hedhi";
      arabicDuaa = "";
      duaaSubtext = "";
      buttonText = "Fhamtek, nverifiw !";
      break;
  }

  return (
    <div
      className="modal-overlay motivational-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        padding: 'clamp(8px, 2.5vw, 16px)',
        boxSizing: 'border-box',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="modal-dialog motivational-modal-card"
        style={{
          position: 'relative',
          width: 'min(100%, 475px)',
          maxWidth: '475px',
          maxHeight: 'min(92dvh, 620px)',
          borderRadius: 'clamp(18px, 4vw, 24px)',
          background: 'var(--card, #ffffff)',
          color: 'var(--ink, #1e293b)',
          border: '1.5px solid var(--line, #e2e8f0)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          animation: 'modalIn .28s cubic-bezier(.16, 1, .3, 1)'
        }}
      >
        {/* Barre d'accent supérieure dégradée élégante */}
        <div
          style={{
            height: '4px',
            width: '100%',
            background: 'linear-gradient(90deg, #182240 0%, #3B4BD8 35%, #F59E0B 70%, #10B981 100%)'
          }}
        />

        {/* Bouton de fermeture discret */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fermer"
          title="Fermer (Échap)"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: 'var(--hover, #f1f5f9)',
            color: 'var(--ink3, #64748b)',
            border: '1px solid var(--line, #e2e8f0)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--ink, #0f172a)';
            e.currentTarget.style.transform = 'scale(1.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ink3, #64748b)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <X size={16} />
        </button>

        {/* Corps principal centré et chaleureux */}
        <div
          className="motivational-modal-inner"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: '26px 22px 24px',
            overflowY: 'auto',
            maxHeight: 'calc(92dvh - 8px)',
            boxSizing: 'border-box',
            gap: '15px'
          }}
        >
          {/* Le Petit Ghost Souriant qui s'agrandit délicatement */}
          <FriendlySmilingGhost />

          {/* Badge Pilule de Contexte */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 14px',
              borderRadius: '9999px',
              background: `color-mix(in srgb, ${badgeColor} 12%, transparent)`,
              color: badgeColor,
              fontSize: '11.5px',
              fontWeight: 700,
              letterSpacing: '0.01em',
              textTransform: 'none'
            }}
          >
            {badgeIcon}
            <span>{badgeText}</span>
          </div>

          {/* Message principal motivant */}
          <div style={{ padding: '0 4px', width: '100%' }}>
            <h2
              className="motivational-modal-title"
              style={{
                margin: 0,
                fontSize: '19.5px',
                fontWeight: 800,
                color: 'var(--ink, #0f172a)',
                lineHeight: 1.4,
                letterSpacing: '-0.015em'
              }}
            >
              {mainTitle}
            </h2>
          </div>

          {/* Carte Spirituelle / دعاء بالتوفيق باللغة العربية */}
          {arabicDuaa && (
            <div
              style={{
                width: '100%',
                padding: '14px 16px',
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
                className="motivational-modal-duaa"
                style={{
                  margin: 0,
                  fontFamily: "'Amiri', 'Traditional Arabic', serif",
                  fontSize: '18.5px',
                  lineHeight: 1.75,
                  fontWeight: 700,
                  color: 'var(--ink, #1e293b)',
                  userSelect: 'none'
                }}
              >
                {arabicDuaa}
              </p>
              {duaaSubtext && (
                <p
                  dir="rtl"
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    color: 'var(--ink3, #64748b)',
                    fontWeight: 500
                  }}
                >
                  {duaaSubtext}
                </p>
              )}
            </div>
          )}

          {/* Bouton d'action principal */}
          <div style={{ width: '100%', marginTop: '4px' }}>
            <button
              type="button"
              onClick={handleClose}
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
                fontWeight: 700,
                fontSize: '15px',
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
              <span>{buttonText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

