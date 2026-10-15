/**
 * Moteur d'engagement et de motivation des opérateurs Elios Workspace.
 * 
 * Règles d'Architecture :
 * 1. Absence > 1h 30 min (90 minutes) :
 *    - Au retour de l'opérateur (focus / visibilité), affichage du popup de reprise avec دعاء بالتوفيق.
 *    - Réinitialisation complète de tous les compteurs successifs à 0.
 * 
 * 2. Déclenchement Strict sur Ajout de Notes Successives (pendant l'intervalle d'activité) :
 *    - Coordination Stratégique (Soumaya) : Déclenché aux 7 premières notes successives, puis toutes les 40 notes successives.
 *    - Célébration d'Effort : Déclenché toutes les 21 notes successives (21, 42, 63, 84...).
 *    - Encouragement Moral ("Ghoul el Workspace") : Déclenché toutes les 30 notes successives (30, 60, 90, 120...).
 * 
 * 3. Activités générales (appels WhatsApp, créations, modifications de champs) :
 *    - Maintiennent la session active (mise à jour du timestamp d'activité) sans déclencher les popups de paliers.
 */

export type MotivationalPopupType = 
  | 'RETURN_AFTER_ABSENCE'
  | 'STRATEGIC_COORDINATION'
  | 'MILESTONE_21_OPS'
  | 'MILESTONE_30_GHOUL'
  | 'MILESTONE_7_OPS'
  | 'STATUS_21'
  | 'STATUS_30'
  | 'STATUS_10'
  | 'STATUS_15';

export interface MotivationalEventData {
  type: MotivationalPopupType;
  operatorName: string;
  notesCount?: number;
  opsCount: number;
  statusCount: number;
}

// 90 minutes en millisecondes (1h 30 min)
export const INACTIVITY_THRESHOLD_MS = 90 * 60 * 1000;

const STORAGE_KEYS = {
  LAST_ACTIVITY: 'elios_motivation_last_activity',
  NOTES_COUNT: 'elios_motivation_notes_count',
  OPS_COUNT: 'elios_motivation_ops_count',
  STATUS_COUNT: 'elios_motivation_status_count',
  LAST_ABSENCE_SHOWN: 'elios_motivation_last_absence_shown',
};

function getStorageNumber(key: string, defaultValue = 0): number {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const val = localStorage.getItem(key);
    if (!val) return defaultValue;
    const n = parseInt(val, 10);
    return isNaN(n) ? defaultValue : n;
  } catch {
    return defaultValue;
  }
}

function setStorageNumber(key: string, value: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

export function getActiveOperatorName(): string {
  if (typeof window === 'undefined') return 'Ghassen';
  try {
    const saved = localStorage.getItem('elios.user') || localStorage.getItem('receiptHubActiveUser');
    if (saved) {
      const parsed = saved.startsWith('"') ? JSON.parse(saved) : saved;
      if (typeof parsed === 'string' && parsed.trim() && parsed !== 'Système') {
        return parsed.trim();
      }
    }
  } catch {}
  return 'Ghassen';
}

/**
 * Réinitialise manuellement tous les compteurs d'activité à 0
 */
export function resetMotivationalCounters() {
  if (typeof window === 'undefined') return;
  setStorageNumber(STORAGE_KEYS.NOTES_COUNT, 0);
  setStorageNumber(STORAGE_KEYS.OPS_COUNT, 0);
  setStorageNumber(STORAGE_KEYS.STATUS_COUNT, 0);
  setStorageNumber(STORAGE_KEYS.LAST_ACTIVITY, Date.now());
}

/**
 * Déclenche l'événement global pour afficher le popup motivant
 */
export function dispatchMotivationalPopup(data: MotivationalEventData) {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent('elios-motivational-popup', { detail: data });
  window.dispatchEvent(event);
}

/**
 * Vérifie si l'opérateur revient après une absence supérieure à 1 heure 30 minutes.
 * Réinitialise tous les compteurs successifs à 0 et affiche le popup de reprise.
 */
export function checkInactivityReturn(): boolean {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  const lastActivity = getStorageNumber(STORAGE_KEYS.LAST_ACTIVITY, 0);

  // Si premier lancement absolu, on initialise le marqueur temporel
  if (lastActivity === 0) {
    setStorageNumber(STORAGE_KEYS.LAST_ACTIVITY, now);
    return false;
  }

  const elapsed = now - lastActivity;

  if (elapsed >= INACTIVITY_THRESHOLD_MS) {
    // Vérifier si nous n'avons pas déjà affiché le popup pour cette même absence récente (< 60s)
    const lastAbsenceShown = getStorageNumber(STORAGE_KEYS.LAST_ABSENCE_SHOWN, 0);
    if (now - lastAbsenceShown < 60 * 1000) {
      return false;
    }

    // Réinitialisation militaire des compteurs suite à inactivité > 1h30
    setStorageNumber(STORAGE_KEYS.NOTES_COUNT, 0);
    setStorageNumber(STORAGE_KEYS.OPS_COUNT, 0);
    setStorageNumber(STORAGE_KEYS.STATUS_COUNT, 0);
    setStorageNumber(STORAGE_KEYS.LAST_ACTIVITY, now);
    setStorageNumber(STORAGE_KEYS.LAST_ABSENCE_SHOWN, now);

    const operatorName = getActiveOperatorName();

    dispatchMotivationalPopup({
      type: 'RETURN_AFTER_ABSENCE',
      operatorName,
      notesCount: 0,
      opsCount: 0,
      statusCount: 0,
    });

    return true;
  }

  // Activité continue : on met simplement à jour l'horodatage
  setStorageNumber(STORAGE_KEYS.LAST_ACTIVITY, now);
  return false;
}

/**
 * Enregistre une activité CRM effectuée par l'opérateur.
 * @param type 'note_added' (DÉCLENCHEUR STRICT des popups de paliers successifs),
 *             'operation' (appel, WhatsApp, création, modif : maintient la session active sans déclencher de palier),
 *             'status_change' (changement de statut : maintient la session active sans déclencher de palier)
 * @param operator Nom optionnel de l'opérateur
 */
export function recordCrmActivity(
  type: 'note_added' | 'operation' | 'status_change' = 'operation',
  operator?: string | null
) {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const lastActivity = getStorageNumber(STORAGE_KEYS.LAST_ACTIVITY, now);
  const operatorName = (operator && operator.trim()) || getActiveOperatorName();

  let notesCount = getStorageNumber(STORAGE_KEYS.NOTES_COUNT, 0);
  let opsCount = getStorageNumber(STORAGE_KEYS.OPS_COUNT, 0);
  let statusCount = getStorageNumber(STORAGE_KEYS.STATUS_COUNT, 0);

  // Règle d'inactivité : Si plus de 1h 30 min sans activité, réinitialisation complète à 0
  if (now - lastActivity >= INACTIVITY_THRESHOLD_MS) {
    notesCount = 0;
    opsCount = 0;
    statusCount = 0;
    setStorageNumber(STORAGE_KEYS.NOTES_COUNT, 0);
    setStorageNumber(STORAGE_KEYS.OPS_COUNT, 0);
    setStorageNumber(STORAGE_KEYS.STATUS_COUNT, 0);
  }

  // Mettre à jour l'horodatage de dernière activité pour maintenir la session active
  setStorageNumber(STORAGE_KEYS.LAST_ACTIVITY, now);

  // Métriques générales
  opsCount += 1;
  setStorageNumber(STORAGE_KEYS.OPS_COUNT, opsCount);

  if (type === 'status_change') {
    statusCount += 1;
    setStorageNumber(STORAGE_KEYS.STATUS_COUNT, statusCount);
  }

  // RÈGLE ARCHITECTURALE STRICTE :
  // Seul l'AJOUT DE NOTES SUCCESSIVES incrémente le compteur de palier et déclenche les popups !
  if (type !== 'note_added') {
    return;
  }

  // Incrémenter le compteur de notes successives
  notesCount += 1;
  setStorageNumber(STORAGE_KEYS.NOTES_COUNT, notesCount);

  // 1. Palier 30 Notes successives : L'Ghoul mta3 el workspace (30, 60, 90, 120...)
  if (notesCount > 0 && notesCount % 30 === 0) {
    dispatchMotivationalPopup({
      type: 'MILESTONE_30_GHOUL',
      operatorName,
      notesCount,
      opsCount: notesCount,
      statusCount,
    });
    return;
  }

  // 2. Palier 21 Notes successives : Célébration d'Effort (21, 42, 63, 84...)
  if (notesCount > 0 && notesCount % 21 === 0) {
    dispatchMotivationalPopup({
      type: 'MILESTONE_21_OPS',
      operatorName,
      notesCount,
      opsCount: notesCount,
      statusCount,
    });
    return;
  }

  // 3. Coordination Stratégique Soumaya : Les 7 premières notes successives, puis toutes les 40 notes
  if (notesCount === 7 || (notesCount > 7 && notesCount % 40 === 0)) {
    dispatchMotivationalPopup({
      type: 'STRATEGIC_COORDINATION',
      operatorName,
      notesCount,
      opsCount: notesCount,
      statusCount,
    });
    return;
  }
}

/**
 * Raccourci explicite pour enregistrer l'ajout d'une note successive
 */
export function recordNoteAdded(operator?: string | null) {
  recordCrmActivity('note_added', operator);
}
