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
import { WhatsAppTemplates } from '@/types/settings';

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : null);

export function SessionReminderAlert() {
  const { data: sessionData, mutate } = useSWR<{ sessions: Session[] }>(
    '/api/sessions',
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  const { data: groupsData } = useSWR<{ groups: CommunicationGroup[] }>(
    '/api/settings/groups',
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: whatsappData } = useSWR<{ templates: WhatsAppTemplates }>(
    '/api/settings/whatsapp',
    fetcher,
    { revalidateOnFocus: false }
  );

  const [activeAlertSession, setActiveAlertSession] = useState<Session | null>(null);
  const [remindedTeacher, setRemindedTeacher] = useState<Record<string, boolean>>({});
  const [remindedGroup, setRemindedGroup] = useState<Record<string, boolean>>({});
  const [isCopiedZoom, setIsCopiedZoom] = useState(false);

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

        // Calcul du delta temps en minutes
        const [hours, minutes] = s.startTime.split(':').map(Number);
        const sessionDate = new Date(`${s.startDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
        
        // Différence en minutes
        const diffMs = sessionDate.getTime() - now.getTime();
        const diffMinutes = Math.round(diffMs / 60000);

        // Alerte si la séance démarre dans 60 min ou moins (et jusqu'à 30 min après le début)
        if (diffMinutes <= 60 && diffMinutes >= -30) {
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

  // Calcul du compte à rebours pour la séance active
  const now = new Date();
  const [hours, minutes] = activeAlertSession.startTime.split(':').map(Number);
  const sessionDate = new Date(`${activeAlertSession.startDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  const diffMinutes = Math.round((sessionDate.getTime() - now.getTime()) / 60000);

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
    const text = formatTeacherReminder(activeAlertSession, 'fr', whatsappData?.templates?.teacherReminder);
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
    const text = formatGroupReminder(activeAlertSession, 'fr', whatsappData?.templates?.groupReminder);
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
              <span style={{ color: 'var(--ink2)' }}>🔗 Réunion Zoom :</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <a 
                  href={activeAlertSession.zoomJoinUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="link"
                  style={{ fontSize: '13px', fontWeight: 600, color: 'var(--acc)' }}
                >
                  Ouvrir le direct
                </a>
                <button 
                  type="button" 
                  onClick={handleCopyZoom} 
                  style={{ border: '1px solid var(--line)', background: 'var(--card)', borderRadius: '6px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer' }}
                >
                  {isCopiedZoom ? 'Copié !' : 'Copier'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Boutons d'actions immédiates */}
        <div style={{ display: 'grid', gap: '10px' }}>
          {/* Action 1 : Rappel Enseignant WhatsApp */}
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
            {isTeacherReminded ? '✓ Enseignant déjà rappelé (Envoyer à nouveau)' : "Envoyer Rappel WhatsApp à l'Enseignant"}
          </button>

          {/* Action 2 : Rappel Groupe Élèves WhatsApp */}
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
              ? `✓ ${resolveCommunicationGroup(activeAlertSession, commGroups).name} déjà rappelé` 
              : `Envoyer Rappel (${resolveCommunicationGroup(activeAlertSession, commGroups).name})`}
          </button>

          {/* Action 3 : Rejoindre Zoom */}
          {activeAlertSession.zoomJoinUrl && (
            <a 
              href={activeAlertSession.zoomJoinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn pri"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px', 
                padding: '11px 16px',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '13.5px',
                textDecoration: 'none'
              }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                <rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/>
              </svg>
              Lancer / Rejoindre la Réunion Zoom
            </a>
          )}
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
