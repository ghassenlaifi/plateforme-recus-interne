"use client";

import React, { useState } from 'react';
import { TaskItem } from '@/types/task';
import { Operator, getOperatorColors } from '@/types';
import { playWhipSound } from '@/lib/whipSound';

interface OpenWhipModalProps {
  task: TaskItem | null;
  isOpen: boolean;
  onClose: () => void;
  activeUser: string | null;
  operators: Operator[];
  onTriggerSuccess: (data: { triggeredBy: string; taskTitle: string; message: string }) => void;
}

const PRESET_MESSAGES = [
  { icon: '🎯', text: 'Chway blabla, barchaa résultat' },
  { icon: '💸', text: 'Chrayek ntaftfou chwaya mn chahriytek' },
  { icon: '🚨', text: 'Amine bch yjik' },
];

export function OpenWhipModal({
  task,
  isOpen,
  onClose,
  activeUser,
  operators,
  onTriggerSuccess,
}: OpenWhipModalProps) {
  // Sélection cochée ou décochée (null = aucune punchline sélectionnée)
  const [selectedMessage, setSelectedMessage] = useState<string | null>(PRESET_MESSAGES[0].text);
  const [customMessage, setCustomMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !task) return null;

  const currentActive = activeUser || (operators.length > 0 ? operators[0].name : 'Ghassen');
  const taskId = task._id || task.id;

  // Calcul des opérateurs cibles assignés à la tâche
  const assignedList = Array.isArray(task.assignedTo) && task.assignedTo.length > 0
    ? task.assignedTo
    : ['Ghassen'];

  const targetOthers = assignedList.filter(
    name => name.trim().toLowerCase() !== currentActive.trim().toLowerCase()
  );
  // Si le déclencheur est le seul assigné, la cible reste lui-même pour tester
  const targets = targetOthers.length > 0 ? targetOthers : assignedList;

  // Calcul du message final (message personnalisé ou preset coché, ou vide si décoché)
  const finalMessage = customMessage.trim() ? customMessage.trim() : (selectedMessage || '');

  const handleTestSound = (e: React.MouseEvent) => {
    e.preventDefault();
    playWhipSound();
  };

  const handleTogglePreset = (text: string) => {
    if (selectedMessage === text) {
      setSelectedMessage(null); // Décocher
    } else {
      setSelectedMessage(text); // Cocher
      setCustomMessage('');
    }
  };

  const handleTriggerWhip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/tasks/whip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          taskTitle: task.title,
          triggeredBy: currentActive,
          message: finalMessage,
          targetOperators: targets,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de l’envoi');
      }

      // Notifier le composant parent pour déclencher l'animation locale unique
      onTriggerSuccess({
        triggeredBy: currentActive,
        taskTitle: task.title,
        message: finalMessage,
      });

      onClose();
    } catch (err: any) {
      alert(err.message || 'Impossible de faire claquer le fouet');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        position: 'fixed',
        inset: 0,
        zIndex: 10000, 
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="modal-dialog card" 
        style={{ 
          maxWidth: '540px', 
          width: 'min(540px, 96vw)',
          maxHeight: 'min(620px, 92vh)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          border: '2px solid #f59e0b',
          background: 'var(--card, #ffffff)',
          color: 'var(--ink, #0f172a)',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* Header Modale FIXE — Badge éliminé et phrase rendue plus petite */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            padding: '14px 18px',
            borderBottom: '1px solid var(--line, rgba(0,0,0,0.08))',
            background: 'var(--card, #ffffff)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div 
              style={{ 
                width: 36, 
                height: 36, 
                borderRadius: '11px', 
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: '19px',
                boxShadow: '0 3px 8px rgba(245, 158, 11, 0.35)',
                flexShrink: 0,
              }}
            >
              🤠
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, letterSpacing: '-0.2px', color: 'var(--ink, #0f172a)' }}>
                Faire claquer le fouet sur l’équipe !
              </h2>
            </div>
          </div>

          <button 
            type="button" 
            className="x" 
            onClick={onClose} 
            title="Fermer"
            style={{ 
              fontSize: '18px', 
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: '6px 8px',
              color: 'var(--ink3, #94a3b8)',
              borderRadius: '8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Corps défilable (scrollable body) - Ne coupe jamais sur aucun écran */}
        <form 
          onSubmit={handleTriggerWhip}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            flex: 1, 
            minHeight: 0,
            overflow: 'hidden' 
          }}
        >
          <div 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Détails de la tâche & cibles */}
            <div 
              style={{ 
                background: 'var(--hover, rgba(0,0,0,0.03))', 
                border: '1px solid var(--line, rgba(0,0,0,0.08))', 
                borderRadius: '12px', 
                padding: '10px 12px', 
                fontSize: '12.5px',
              }}
            >
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: 'var(--ink3, #64748b)', fontWeight: 600 }}>Tâche : </span>
                <b style={{ color: 'var(--ink, #0f172a)' }}>{task.title}</b>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--ink3, #64748b)', fontWeight: 600 }}>Cible(s) :</span>
                {targets.map(name => {
                  const col = getOperatorColors(name, operators);
                  return (
                    <span 
                      key={name}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 8px',
                        borderRadius: '7px',
                        background: 'var(--card, #fff)',
                        border: '1px solid var(--line, rgba(0,0,0,0.1))',
                        fontSize: '11.5px',
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: col.dot }} />
                      <span>{name}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Grille responsive des punchlines avec case à cocher/décocher */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  Choisissez une punchline motivante :
                </label>
                <small style={{ fontSize: '11px', color: 'var(--ink3, #64748b)', fontStyle: 'italic' }}>
                  (Cliquer pour cocher / décocher)
                </small>
              </div>

              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', 
                  gap: '6px' 
                }}
              >
                {PRESET_MESSAGES.map((preset) => {
                  const isSelected = selectedMessage === preset.text && !customMessage.trim();
                  return (
                    <button
                      key={preset.text}
                      type="button"
                      onClick={() => handleTogglePreset(preset.text)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '7px 10px',
                        borderRadius: '10px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: isSelected 
                          ? '1.5px solid #f59e0b' 
                          : '1px solid var(--line, rgba(0,0,0,0.1))',
                        background: isSelected 
                          ? 'color-mix(in srgb, #f59e0b 15%, var(--card))' 
                          : 'var(--card, #fff)',
                        color: isSelected ? '#b45309' : 'var(--ink, #0f172a)',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {/* Case à cocher / décocher interactive */}
                      <span 
                        style={{
                          width: 15,
                          height: 15,
                          borderRadius: 4,
                          border: isSelected ? '1.5px solid #f59e0b' : '1.5px solid var(--line, #94a3b8)',
                          background: isSelected ? '#f59e0b' : 'transparent',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: 800,
                          flexShrink: 0,
                          transition: 'all 0.12s ease',
                        }}
                      >
                        {isSelected ? '✓' : ''}
                      </span>

                      <span style={{ fontSize: '15px' }}>{preset.icon}</span>
                      <span style={{ flex: 1, whiteSpace: 'normal', lineHeight: 1.25 }}>{preset.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Saisie personnalisée */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '5px', color: 'var(--ink, #0f172a)' }}>
                Ou rédigez votre mot / phrase personnalisé(e) :
              </label>
              <input
                type="text"
                placeholder="Ex: Amine bch yjik"
                value={customMessage}
                maxLength={150}
                onChange={(e) => setCustomMessage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: customMessage.trim() ? '2px solid #f59e0b' : '1px solid var(--line, rgba(0,0,0,0.15))',
                  background: 'var(--card, #fff)',
                  color: 'var(--ink, #0f172a)',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              {customMessage.trim() ? (
                <small style={{ color: '#b45309', fontSize: '11px', fontWeight: 600, marginTop: '3px', display: 'block' }}>
                  ✓ Votre phrase personnalisée sera envoyée lors du claquement !
                </small>
              ) : selectedMessage ? (
                <small style={{ color: 'var(--ink3, #64748b)', fontSize: '11px', marginTop: '3px', display: 'block' }}>
                  Punchline sélectionnée : « {selectedMessage} »
                </small>
              ) : (
                <small style={{ color: 'var(--ink3, #64748b)', fontSize: '11px', marginTop: '3px', display: 'block' }}>
                  Aucune punchline cochée : le fouet claquera sans texte attaché.
                </small>
              )}
            </div>
          </div>

          {/* Footer STICKY FIXE — Toujours visible et accessible sur TOUT écran */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              gap: '10px',
              padding: '12px 18px',
              borderTop: '1px solid var(--line, rgba(0,0,0,0.08))',
              background: 'var(--card, #ffffff)',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={handleTestSound}
              style={{
                background: 'var(--hover, rgba(0,0,0,0.05))',
                border: '1px solid var(--line, rgba(0,0,0,0.1))',
                borderRadius: '10px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--ink2, #475569)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Tester le bruit du claquement de fouet"
            >
              <span>🔊</span>
              <span>Tester le son</span>
            </button>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn"
                onClick={onClose}
                style={{ fontSize: '12.5px', borderRadius: '10px', padding: '8px 14px' }}
              >
                Annuler
              </button>
              
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
                  transition: 'transform 0.1s ease',
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <span style={{ fontSize: '14px' }}>🤠💥</span>
                <span>{isSubmitting ? 'Envoi...' : 'Faire claquer le fouet !'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
