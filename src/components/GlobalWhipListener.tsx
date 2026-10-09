"use client";

import React, { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import { OpenWhipOverlay } from './OpenWhipOverlay';
import { WhipEventItem } from '@/types/whip';
import { Operator } from '@/types';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function GlobalWhipListener() {
  const [activeWhip, setActiveWhip] = useState<{
    triggeredBy: string;
    taskTitle: string;
    message: string;
  } | null>(null);

  const { data: operatorsData } = useSWR<Operator[]>('/api/operators', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000
  });
  const operators = Array.isArray(operatorsData) ? operatorsData : [];
  const operatorsRef = useRef(operators);
  operatorsRef.current = operators;

  const seenIdsRef = useRef<Set<string>>(new Set());
  const lastCheckRef = useRef<number>(Date.now() - 15000); // 15s dans le passé à l'initialisation

  // Charger les identifiants déjà vus depuis sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('elios_seen_whip_ids');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          arr.forEach((id: string) => seenIdsRef.current.add(String(id)));
        }
      }
    } catch {}
  }, []);

  const markEventAsSeen = (id: string) => {
    seenIdsRef.current.add(String(id));
    try {
      const arr = Array.from(seenIdsRef.current).slice(-100); // garder les 100 derniers
      sessionStorage.setItem('elios_seen_whip_ids', JSON.stringify(arr));
    } catch {}
  };

  // Écouteur d'événement local pour le déclencheur (affichage immédiat une seule fois)
  useEffect(() => {
    const handleLocalTrigger = (e: Event) => {
      const customEvent = e as CustomEvent<{
        triggeredBy: string;
        taskTitle: string;
        message: string;
      }>;
      if (customEvent.detail) {
        setActiveWhip(customEvent.detail);
      }
    };

    window.addEventListener('openwhip:trigger', handleLocalTrigger);
    return () => window.removeEventListener('openwhip:trigger', handleLocalTrigger);
  }, []);

  // Polling temps réel du backend pour tous les collaborateurs de la tâche
  useEffect(() => {
    let isMounted = true;

    const pollWhipEvents = async () => {
      try {
        // Ne pas scruter si le document est masqué / onglet en arrière-plan
        if (typeof document !== 'undefined' && document.hidden) return;

        // Si une animation de fouet est déjà active à l'écran, ne pas interférer
        if (activeWhip) return;

        // Récupérer l'utilisateur actuellement actif dans le CRM
        let activeUser = '';
        try {
          const saved = localStorage.getItem('elios.user') || localStorage.getItem('receiptHubActiveUser');
          if (saved) {
            const parsed = saved.startsWith('"') ? JSON.parse(saved) : saved;
            if (typeof parsed === 'string') activeUser = parsed.trim();
          }
        } catch {}

        // Fallback si non encore défini explicitement
        const currentOps = operatorsRef.current;
        if (!activeUser && currentOps.length > 0) {
          activeUser = currentOps[0].name;
        }

        if (!activeUser) return;

        const sinceIso = new Date(lastCheckRef.current).toISOString();
        const res = await fetch(`/api/tasks/whip?user=${encodeURIComponent(activeUser)}&since=${encodeURIComponent(sinceIso)}`);
        
        if (!res.ok) return;
        const data = await res.json();
        const events: WhipEventItem[] = Array.isArray(data.events) ? data.events : [];

        if (events.length > 0 && isMounted) {
          // Filtrer les événements non encore vus
          const newEvents = events.filter(ev => {
            const evId = String(ev._id || `${ev.taskId}_${new Date(ev.createdAt).getTime()}`);
            return !seenIdsRef.current.has(evId);
          });

          // Marquer tous les nouveaux comme vus pour empêcher toute répétition ou boucle
          newEvents.forEach(ev => {
            const evId = String(ev._id || `${ev.taskId}_${new Date(ev.createdAt).getTime()}`);
            markEventAsSeen(evId);
          });

          if (newEvents.length > 0 && !activeWhip) {
            // Prendre le plus récent et l'exécuter une seule fois
            const latest = newEvents[0];
            setActiveWhip({
              triggeredBy: latest.triggeredBy,
              taskTitle: latest.taskTitle,
              message: latest.message,
            });
          }
        }

        // Mettre à jour l'horodatage de dernière vérification
        lastCheckRef.current = Date.now() - 5000;
      } catch (err) {
        // Silence réseau temporaire
      }
    };

    // Première vérification
    pollWhipEvents();

    // Intervalle équilibré de 5 secondes (léger et réactif)
    const interval = setInterval(pollWhipEvents, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeWhip]);

  if (!activeWhip) return null;

  return (
    <OpenWhipOverlay
      triggeredBy={activeWhip.triggeredBy}
      taskTitle={activeWhip.taskTitle}
      message={activeWhip.message}
      autoCloseMs={3000}
      onClose={() => setActiveWhip(null)}
    />
  );
}
