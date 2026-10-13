/**
 * Moteur d'engagement et de motivation des opérateurs Elios Workspace.
 * 
 * Règles militaires :
 * 1. Absence > 1h 30 min (90 minutes) :
 *    - Au retour de l'opérateur, affichage du popup de reprise avec دعاء بالتوفيق.
 *    - Réinitialisation complète des compteurs de contribution successive.
 * 
 * 2. Toutes les 7 opérations successives (7, 14, 21, 28...) :
 *    - Affichage du popup de célébration avec le nombre total d'opérations et دعاء البركة.
 * 
 * 3. 10 modifications successives de statut :
 *    - Popup d'encouragement : "Aadi tesma3 klem mouch houwa ama was3alna belk myselch."
 * 
 * 4. 15 modifications successives de statut :
 *    - Popup de synchronisation stratégique : "Nverifiw besoin maa Soumaya chkoun lezem nkallmou jem3a hedhi"
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
  opsCount: number;
  statusCount: number;
}

// 90 minutes en millisecondes (1h 30 min)
export const INACTIVITY_THRESHOLD_MS = 90 * 60 * 1000;

const STORAGE_KEYS = {
  LAST_ACTIVITY: 'elios_motivation_last_activity',
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
 * Déclenche l'événement global pour afficher le popup motivant
 */
export function dispatchMotivationalPopup(data: MotivationalEventData) {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent('elios-motivational-popup', { detail: data });
  window.dispatchEvent(event);
}

/**
 * Vérifie si l'opérateur revient après une absence supérieure à 1 heure 30 minutes.
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
    setStorageNumber(STORAGE_KEYS.OPS_COUNT, 0);
    setStorageNumber(STORAGE_KEYS.STATUS_COUNT, 0);
    setStorageNumber(STORAGE_KEYS.LAST_ACTIVITY, now);
    setStorageNumber(STORAGE_KEYS.LAST_ABSENCE_SHOWN, now);

    const operatorName = getActiveOperatorName();

    dispatchMotivationalPopup({
      type: 'RETURN_AFTER_ABSENCE',
      operatorName,
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
 * Enregistre une opération ou un changement de statut effectué par l'opérateur.
 * @param type 'operation' (appel, note, modif générale) ou 'status_change' (changement de statut lead)
 * @param operator Nom optionnel de l'opérateur
 */
export function recordCrmActivity(
  type: 'operation' | 'status_change' = 'operation',
  operator?: string | null
) {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const lastActivity = getStorageNumber(STORAGE_KEYS.LAST_ACTIVITY, now);
  const operatorName = (operator && operator.trim()) || getActiveOperatorName();

  let opsCount = getStorageNumber(STORAGE_KEYS.OPS_COUNT, 0);
  let statusCount = getStorageNumber(STORAGE_KEYS.STATUS_COUNT, 0);

  // Règle d'inactivité : Si plus de 1h 30 min sans activité, réinitialisation à zéro
  if (now - lastActivity >= INACTIVITY_THRESHOLD_MS) {
    opsCount = 0;
    statusCount = 0;
  }

  // Incrémenter les opérations
  opsCount += 1;
  setStorageNumber(STORAGE_KEYS.OPS_COUNT, opsCount);

  if (type === 'status_change') {
    statusCount += 1;
    setStorageNumber(STORAGE_KEYS.STATUS_COUNT, statusCount);
  }

  // Mettre à jour l'horodatage de dernière activité
  setStorageNumber(STORAGE_KEYS.LAST_ACTIVITY, now);

  // 1. Palier 30 Opérations successives : L'Ghoul mta3 el workspace (30, 60, 90, 120...)
  if (opsCount > 0 && opsCount % 30 === 0) {
    dispatchMotivationalPopup({
      type: 'MILESTONE_30_GHOUL',
      operatorName,
      opsCount,
      statusCount,
    });
    return;
  }

  // 2. Palier 21 Opérations successives : Célébration d'Effort (21, 42, 63, 84...)
  if (opsCount > 0 && opsCount % 21 === 0) {
    dispatchMotivationalPopup({
      type: 'MILESTONE_21_OPS',
      operatorName,
      opsCount,
      statusCount,
    });
    return;
  }

  // 3. Coordination Stratégique Soumaya : Les 7 premières opérations, puis toutes les 40 opérations
  if (opsCount === 7 || (opsCount > 7 && opsCount % 40 === 0)) {
    dispatchMotivationalPopup({
      type: 'STRATEGIC_COORDINATION',
      operatorName,
      opsCount,
      statusCount,
    });
    return;
  }
}
