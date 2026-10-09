"use client";

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { Session } from '@/types/session';
import { 
  formatPhone, 
  normalizePhone, 
  formatTeacherReminder, 
  formatGroupReminder 
} from '@/lib/sessionHelpers';
import { CommunicationGroup } from '@/types/communicationGroup';
import { resolveCommunicationGroup } from '@/lib/communicationGroupHelper';
import { WhatsAppTemplates, DEFAULT_WHATSAPP_TEMPLATES } from '@/types/settings';

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : null);

export function SessionReminderAlert() {
  const { data: sessionData, mutate } = useSWR<{ sessions: Session[] }>(
    '/api/sessions',
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const { data: groupsData } = useSWR<{ groups: CommunicationGroup[] }>(
    '/api/settings/groups',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const { data: whatsappData } = useSWR<{ templates: WhatsAppTemplates }>(
    '/api/settings/whatsapp',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const [activeAlertSession, setActiveAlertSession] = useState<Session | null>(null);
  const [remindedTeacher, setRemindedTeacher] = useState<Record<string, boolean>>({});
  const [remindedGroup, setRemindedGroup] = useState<Record<string, boolean>>({});
  const [isCopiedZoom, setIsCopiedZoom] = useState(false);
  const [selectedLang, setSelectedLang] = useState<'fr' | 'ar' | null>(null);

  const sessions = useMemo(() => sessionData?.sessions || [], [sessionData]);
  const commGroups = useMemo(() => groupsData?.groups || [], [groupsData]);

  // Vérification périodique des séances démarrant dans moins de 60 minutes
  useEffect(() => {
    if (!sessions || sessions.length === 0) return;

    const checkUpcomingSessions = () => {
      const now = new Date();
      
      for (const s of sessions) {
        if (s.done) continue;
        if (!s.startDate || !s.startTime) continue;
        // Si l'enseignant ET le groupe d'élèves ont déjà été rappelés, pas de popup intrusif
        if (s.remTeacher && s.remGroup) continue;

        // Découpage strict et parsing local pour éviter tout décalage horaire ou UTC
        const datePart = (s.startDate || '').split('T')[0];
        const [y, m, d] = datePart.split('-').map(Number);
        if (!y || !m || !d) continue;

        const timeParts = (s.startTime || '').replace('h', ':').split(':');
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1] || '0', 10);
        if (isNaN(hours) || isNaN(minutes)) continue;

        const sessionDate = new Date(y, m - 1, d, hours, minutes, 0);
        if (isNaN(sessionDate.getTime())) continue;
        
        // Différence en minutes
        const diffMs = sessionDate.getTime() - now.getTime();
        const diffMinutes = Math.round(diffMs / 60000);

        // Alerte STRICTEMENT 1 heure avant le début de séance (entre 60 min avant et le début de séance)
        if (diffMinutes <= 60 && diffMinutes >= 0) {
          const dismissKey = `elios.dismissed_alert_${s._id}_${s.startDate}`;
          const dismissedUntil = sessionStorage.getItem(dismissKey);

          if (dismissedUntil) {
            const expireTime = Number(dismissedUntil);
            if (Date.now() < expireTime) {
              continue; // encore en période de mise en sourdine
            }
          }

          // Déclencher le popup pour cette séance
          setActiveAlertSession(s);
          break; // afficher une alerte à la fois
        }
      }
    };

    checkUpcomingSessions();
    const interval = setInterval(checkUpcomingSessions, 20000);
    return () => clearInterval(interval);
  }, [sessions]);

  if (!activeAlertSession) return null;

  // Calcul du compte à rebours précis pour la séance active
  const now = new Date();
  const datePart = (activeAlertSession.startDate || '').split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  const timeParts = (activeAlertSession.startTime || '').replace('h', ':').split(':');
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1] || '0', 10);
  const sessionDate = new Date(y, m - 1, d, hours, minutes, 0);
  const diffMinutes = Math.max(0, Math.round((sessionDate.getTime() - now.getTime()) / 60000));

  const isTeacherReminded = remindedTeacher[activeAlertSession._id] || activeAlertSession.remTeacher;
  const isGroupReminded = remindedGroup[activeAlertSession._id] || activeAlertSession.remGroup;

  const handleDismiss = (snoozeMinutes: number = 0) => {
    if (snoozeMinutes > 0) {
      const snoozeUntil = Date.now() + snoozeMinutes * 60 * 1000;
      sessionStorage.setItem(`elios.dismissed_alert_${activeAlertSession._id}_${activeAlertSession.startDate}`, String(snoozeUntil));
    } else {
      // Ignorer définitivement pour aujourd'hui
      sessionStorage.setItem(`elios.dismissed_alert_${activeAlertSession._id}_${activeAlertSession.startDate}`, String(Date.now() + 24 * 3600 * 1000));
    }
    setActiveAlertSession(null);
  };

  const handleSendTeacherReminder = async () => {
    const teacherLang = selectedLang || (whatsappData?.templates?.teacherReminderLang || 'fr');
    const customTemplate = teacherLang === 'ar'
      ? (whatsappData?.templates?.teacherReminder_ar || DEFAULT_WHATSAPP_TEMPLATES.teacherReminder_ar)
      : (whatsappData?.templates?.teacherReminder || DEFAULT_WHATSAPP_TEMPLATES.teacherReminder);
    const text = formatTeacherReminder(activeAlertSession, teacherLang, customTemplate);
    const cleanPhone = normalizePhone(activeAlertSession.teacherPhone);

    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } else {
      navigator.clipboard.writeText(text);
      alert("Message copié dans le presse-papier ! Aucun numéro n'est enregistré pour cet enseignant.");
      window.open('https://web.whatsapp.com/', '_blank', 'noopener');
    }

    setRemindedTeacher(prev => ({ ...prev, [activeAlertSession._id]: true }));
    try {
      await fetch(`/api/sessions/${activeAlertSession._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remTeacher: true }),
      });
      mutate();
    } catch {}
  };

  const handleSendGroupReminder = async () => {
    if (!activeAlertSession) return;
    const groupLang = selectedLang || (whatsappData?.templates?.groupReminderLang || 'fr');
    const customTemplate = groupLang === 'ar'
      ? (whatsappData?.templates?.groupReminder_ar || DEFAULT_WHATSAPP_TEMPLATES.groupReminder_ar)
      : (whatsappData?.templates?.groupReminder || DEFAULT_WHATSAPP_TEMPLATES.groupReminder);
    const text = formatGroupReminder(activeAlertSession, groupLang, customTemplate);
    navigator.clipboard.writeText(text);

    const targetGroup = resolveCommunicationGroup(activeAlertSession, commGroups);
    if (targetGroup && targetGroup.whatsappLink && targetGroup.whatsappLink.trim()) {
      const link = targetGroup.whatsappLink.trim();
      const finalUrl = link.startsWith('http') ? link : `https://${link}`;
      window.open(finalUrl, '_blank', 'noopener');
    } else {
      alert(`Message copié dans le presse-papier ! Aucun lien WhatsApp direct n'est configuré pour « ${targetGroup?.name || 'ce groupe'} ». Ouverture de WhatsApp Web.`);
      window.open('https://web.whatsapp.com/', '_blank', 'noopener');
    }

    setRemindedGroup(prev => ({ ...prev, [activeAlertSession._id]: true }));
    try {
      await fetch(`/api/sessions/${activeAlertSession._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remGroup: true }),
      });
      mutate();
    } catch {}
  };

  const handleCopyZoom = () => {
    if (!activeAlertSession.zoomJoinUrl) return;
    navigator.clipboard.writeText(activeAlertSession.zoomJoinUrl);
    setIsCopiedZoom(true);
    setTimeout(() => setIsCopiedZoom(false), 2000);
  };

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        zIndex: 9999, 
        backgroundColor: 'rgba(0, 0, 0, 0.65)', 
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div 
        className="modal-dialog card" 
        style={{ 
          maxWidth: '540px', 
          width: '100%', 
          borderRadius: '20px', 
          padding: '24px', 
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)',
          border: '1.5px solid var(--acc)',
          background: 'var(--card)',
          color: 'var(--ink)'
        }}
      >
        {/* En-tête alerte */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
          <div 
            style={{ 
              width: '46px', 
              height: '46px', 
              borderRadius: '14px', 
              background: 'color-mix(in srgb, var(--warn) 15%, transparent)', 
              color: 'var(--warn)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <path d="M12 4 2.5 20h19zM12 10v4M12 17h.01"/>
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span 
                style={{ 
                  background: 'var(--warn)', 
                  color: '#fff', 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  padding: '2px 8px', 
                  borderRadius: '999px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {diffMinutes > 0 ? `Dans ${diffMinutes} min` : 'En cours'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink2)' }}>
                Rappel Pédagogique H-1
              </span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '6px 0 2px', letterSpacing: '-0.3px', color: 'var(--ink)' }}>
              {activeAlertSession.subject}
            </h2>
            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--ink2)' }}>
              <b>{activeAlertSession.level}</b> · {activeAlertSession.section}
            </p>
          </div>

          <button 
            type="button" 
            className="ib" 
            onClick={() => handleDismiss(0)}
            title="Fermer ce rappel"
            style={{ flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Détails de la séance */}
        <div 
          style={{ 
            background: 'var(--hover)', 
            border: '1px solid var(--line)', 
            borderRadius: '14px', 
            padding: '14px 16px', 
            margin: '16px 0',
            display: 'grid',
            gap: '8px',
            fontSize: '13.5px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--ink2)' }}>⏰ Horaire du cours :</span>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>
              {activeAlertSession.startTime} {activeAlertSession.endTime ? `à ${activeAlertSession.endTime}` : ''}
            </b>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--ink2)' }}>👨‍🏫 Enseignant :</span>
            <b>{activeAlertSession.teacherName}</b>
          </div>

          {activeAlertSession.teacherPhone && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--ink2)' }}>📞 WhatsApp Enseignant :</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--wa)' }}>
                {formatPhone(activeAlertSession.teacherPhone)}
              </span>
            </div>
          )}

          {activeAlertSession.zoomJoinUrl && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--ink2)' }}>🔗 Lien Zoom :</span>
              <button 
                type="button" 
                onClick={handleCopyZoom} 
                style={{ 
                  border: '1px solid var(--line)', 
                  background: 'var(--card)', 
                  borderRadius: '6px', 
                  padding: '3px 8px', 
                  fontSize: '11.5px', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Copier le lien de la réunion Zoom dans le presse-papier"
              >
                {isCopiedZoom ? '✓ Copié !' : '📋 Copier le lien'}
              </button>
            </div>
          )}
        </div>

        {/* Sélecteur de langue du message WhatsApp */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 12px', padding: '0 2px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>🌐</span> Langue du rappel :
          </span>
          <div style={{ display: 'inline-flex', padding: '3px', borderRadius: '10px', background: 'var(--hover)', border: '1px solid var(--line)', gap: '3px' }}>
            <button
              type="button"
              onClick={() => setSelectedLang(null)}
              title="Utiliser la langue configurée par défaut pour chaque modèle dans Paramètres"
              style={{
                border: 'none',
                background: selectedLang === null ? 'var(--card)' : 'transparent',
                color: selectedLang === null ? 'var(--pri)' : 'var(--ink3)',
                fontWeight: 700,
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '7px',
                cursor: 'pointer',
                boxShadow: selectedLang === null ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              ⚙️ Défaut {selectedLang === null ? '✓' : ''}
            </button>
            <button
              type="button"
              onClick={() => setSelectedLang('fr')}
              title="Forcer l'envoi en français"
              style={{
                border: 'none',
                background: selectedLang === 'fr' ? 'var(--card)' : 'transparent',
                color: selectedLang === 'fr' ? 'var(--pri)' : 'var(--ink3)',
                fontWeight: 700,
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '7px',
                cursor: 'pointer',
                boxShadow: selectedLang === 'fr' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              🇫🇷 FR {selectedLang === 'fr' ? '✓' : ''}
            </button>
            <button
              type="button"
              onClick={() => setSelectedLang('ar')}
              title="Forcer l'envoi en arabe"
              style={{
                border: 'none',
                background: selectedLang === 'ar' ? 'var(--card)' : 'transparent',
                color: selectedLang === 'ar' ? 'var(--pri)' : 'var(--ink3)',
                fontWeight: 700,
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '7px',
                cursor: 'pointer',
                boxShadow: selectedLang === 'ar' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              🇹🇳 AR {selectedLang === 'ar' ? '✓' : ''}
            </button>
          </div>
        </div>

        {/* Boutons d'actions immédiates */}
        <div style={{ display: 'grid', gap: '10px' }}>
          {/* Action 1 : Rappel Enseignant WhatsApp */}
          {(() => {
            const activeTeacherLang = selectedLang || (whatsappData?.templates?.teacherReminderLang || 'fr');
            const activeGroupLang = selectedLang || (whatsappData?.templates?.groupReminderLang || 'fr');
            return (
              <>
                <button 
                  type="button" 
                  onClick={handleSendTeacherReminder}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '10px',
                    padding: '11px 16px',
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    border: isTeacherReminded ? '1px solid var(--ok)' : '1px solid color-mix(in srgb, #25D366 40%, var(--line))',
                    background: isTeacherReminded ? 'color-mix(in srgb, var(--ok) 12%, var(--card))' : 'color-mix(in srgb, #25D366 12%, var(--card))',
                    color: isTeacherReminded ? 'var(--ok)' : 'var(--wa)'
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>
                  </svg>
                  {isTeacherReminded 
                    ? `✓ Enseignant déjà rappelé (${activeTeacherLang === 'ar' ? '🇹🇳 AR' : '🇫🇷 FR'})` 
                    : `Envoyer Rappel Enseignant (${activeTeacherLang === 'ar' ? '🇹🇳 AR' : '🇫🇷 FR'})`}
                </button>

                {/* Action 2 : Rappel Groupe Élèves WhatsApp */}
                <button 
                  type="button" 
                  onClick={handleSendGroupReminder}
                  title={`Ouvrir ${resolveCommunicationGroup(activeAlertSession, commGroups).name}`}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '10px',
                    padding: '11px 16px',
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    border: isGroupReminded ? '1px solid var(--ok)' : '1px solid var(--line)',
                    background: isGroupReminded ? 'color-mix(in srgb, var(--ok) 10%, var(--card))' : 'var(--hover)',
                    color: isGroupReminded ? 'var(--ok)' : 'var(--ink)'
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                    <circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>
                  </svg>
                  {isGroupReminded 
                    ? `✓ ${resolveCommunicationGroup(activeAlertSession, commGroups).name} déjà rappelé (${activeGroupLang === 'ar' ? '🇹🇳 AR' : '🇫🇷 FR'})` 
                    : `Envoyer Rappel (${resolveCommunicationGroup(activeAlertSession, commGroups).name}) (${activeGroupLang === 'ar' ? '🇹🇳 AR' : '🇫🇷 FR'})`}
                </button>
              </>
            );
          })()}
        </div>

        {/* Pied du popup */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
          <button 
            type="button" 
            className="link btn" 
            style={{ border: 0, background: 'none', color: 'var(--ink2)', fontSize: '12.5px', cursor: 'pointer' }}
            onClick={() => handleDismiss(15)}
          >
            ⏱️ Me rappeler dans 15 min
          </button>

          <button 
            type="button" 
            className="btn" 
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => handleDismiss(0)}
          >
            Compris / Déjà traité
          </button>
        </div>
      </div>
    </div>
  );
}
