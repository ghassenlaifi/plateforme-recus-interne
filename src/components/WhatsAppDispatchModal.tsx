"use client";

import React, { useState, useEffect } from 'react';
import { getWhatsAppLink, cleanTunisianPhone } from '@/lib/whatsappHelper';
import { formatPhone, extractPhoneDigits } from '@/lib/phoneUtils';

interface WhatsAppDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  studentPhone: string;
  targetStatus: 'Approved Prospect' | 'Approved' | 'N/A' | string;
  defaultMessage: string;
  frenchMessage?: string;
  arabicMessage?: string;
  onSent?: () => void;
}

export function WhatsAppDispatchModal({
  isOpen,
  onClose,
  studentName,
  studentPhone,
  targetStatus,
  defaultMessage,
  frenchMessage,
  arabicMessage,
  onSent
}: WhatsAppDispatchModalProps) {
  const [selectedLang, setSelectedLang] = useState<'fr' | 'ar'>('fr');
  const [message, setMessage] = useState(defaultMessage);
  const [phone, setPhone] = useState(() => formatPhone(studentPhone));

  useEffect(() => {
    setSelectedLang('fr');
    setMessage(frenchMessage || defaultMessage);
  }, [defaultMessage, frenchMessage, isOpen]);

  useEffect(() => {
    setPhone(formatPhone(studentPhone));
  }, [studentPhone]);

  const handleLangChange = (lang: 'fr' | 'ar') => {
    setSelectedLang(lang);
    if (lang === 'ar' && arabicMessage) {
      setMessage(arabicMessage);
    } else if (lang === 'fr' && (frenchMessage || defaultMessage)) {
      setMessage(frenchMessage || defaultMessage);
    }
  };

  if (!isOpen) return null;

  const isApproved = targetStatus === 'Approved Prospect' || targetStatus === 'Approved';
  const hasValidPhone = extractPhoneDigits(phone).length === 8;

  const handleSendWhatsApp = () => {
    const url = getWhatsAppLink(phone, message);
    window.open(url, '_blank', 'noopener,noreferrer');
    if (onSent) onSent();
    onClose();
  };

  return (
    <div 
      className="modal-overlay" 
      style={{ zIndex: 120 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="modal-dialog" 
        style={{ 
          width: 'min(580px, 94vw)',
          borderRadius: '20px',
          boxShadow: 'var(--shadow2)'
        }}
      >
        {/* Header */}
        <div className="dh" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 22px' }}>
          <div 
            style={{ 
              width: 42, 
              height: 42, 
              borderRadius: '14px', 
              background: '#25D36622', 
              color: '#25D366',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: 'currentColor' }}>
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.17-.48-.29"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#16A34A', display: 'block' }}>
              Communication WhatsApp
            </span>
            <h3 style={{ margin: '2px 0 0', fontSize: '15.5px', fontWeight: 700, color: 'var(--ink)' }}>
              {isApproved ? 'Envoyer les modes de paiement' : 'Envoyer un message de relance'}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
              <span 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: isApproved ? 'color-mix(in srgb, var(--warn) 15%, transparent)' : 'color-mix(in srgb, var(--ink3) 15%, transparent)',
                  color: isApproved ? 'var(--warn)' : 'var(--ink2)'
                }}
              >
                Statut : {targetStatus}
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="x" 
            onClick={onClose}
            title="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Corps du Popup */}
        <div className="db" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Destinataire */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'var(--hover)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            padding: '10px 14px',
            flexWrap: 'wrap'
          }}>
            <div>
              <small style={{ color: 'var(--ink3)', fontSize: '11px', display: 'block', fontWeight: 600 }}>
                DESTINATAIRE
              </small>
              <b style={{ fontSize: '14px', color: 'var(--ink)' }}>
                {studentName || 'Élève'}
              </b>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="Ex: 92 330 331"
                maxLength={16}
                style={{
                  padding: '5px 10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--card)',
                  width: '140px',
                  fontFamily: 'monospace'
                }}
              />
              {!hasValidPhone && (
                <span style={{ fontSize: '11px', color: 'var(--bad)', fontWeight: 600 }}>
                  Numéro requis
                </span>
              )}
            </div>
          </div>

          {/* Éditeur de message */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <small style={{ color: 'var(--ink2)', fontSize: '12px', fontWeight: 600 }}>
                  Message à envoyer :
                </small>
                {arabicMessage && (
                  <div style={{ display: 'inline-flex', padding: '2px', background: 'var(--hover)', borderRadius: '8px', border: '1px solid var(--line)' }}>
                    <button
                      type="button"
                      onClick={() => handleLangChange('fr')}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        background: selectedLang === 'fr' ? 'var(--card)' : 'transparent',
                        color: selectedLang === 'fr' ? 'var(--pri)' : 'var(--ink3)'
                      }}
                    >
                      🇫🇷 FR
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLangChange('ar')}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        background: selectedLang === 'ar' ? 'var(--card)' : 'transparent',
                        color: selectedLang === 'ar' ? 'var(--pri)' : 'var(--ink3)'
                      }}
                    >
                      🇹🇳 AR
                    </button>
                  </div>
                )}
              </div>
              <small style={{ color: 'var(--ink3)', fontSize: '11.5px' }}>
                Modifiable pour cet envoi uniquement
              </small>
            </div>

            <textarea
              rows={9}
              dir={selectedLang === 'ar' ? 'rtl' : 'ltr'}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid var(--line)',
                background: 'var(--card)',
                color: 'var(--ink)',
                fontSize: '13px',
                lineHeight: 1.45,
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
                textAlign: selectedLang === 'ar' ? 'right' : 'left'
              }}
            />
          </div>

          <div style={{ 
            fontSize: '11.5px', 
            color: 'var(--ink3)', 
            lineHeight: 1.35, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px' 
          }}>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2, flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
            <span>
              La modification actuelle n'affecte pas le modèle de base défini dans les Paramètres.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="df" style={{ 
          padding: '14px 20px', 
          borderTop: '1px solid var(--line)', 
          background: 'var(--card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          <button 
            type="button" 
            className="btn" 
            onClick={onClose}
          >
            Fermer
          </button>
          
          <button 
            type="button" 
            className="btn" 
            onClick={handleSendWhatsApp}
            disabled={!hasValidPhone || !message.trim()}
            style={{
              background: '#25D366',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(37, 211, 102, 0.35)',
              opacity: (!hasValidPhone || !message.trim()) ? 0.5 : 1,
              cursor: (!hasValidPhone || !message.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'currentColor' }}>
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.17-.48-.29"/>
            </svg>
            <span>Envoyer sur WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}

