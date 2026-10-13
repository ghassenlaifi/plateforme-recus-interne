/**
 * Cross-Tab and Real-Time Synchronization Engine for CRM Elios & CRM Formatic
 * Garantit une cohérence instantanée des compteurs et listes de prospects
 * entre tous les onglets, fenêtres et sessions d'opérateurs.
 */

const SYNC_CHANNEL_NAME = 'elios_crm_sync_channel';
const SYNC_STORAGE_KEY = 'elios_crm_sync_pulse';

export type CrmTarget = 'elios' | 'formatic' | 'all';

/**
 * Diffuse un signal de synchronisation instantané à tous les onglets ouverts
 */
export function broadcastCrmChange(crmType: CrmTarget = 'all') {
  if (typeof window === 'undefined') return;

  // 1. Canal BroadcastChannel natif haute performance
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
      bc.postMessage({ type: 'CRM_LEAD_CHANGED', crmType, timestamp: Date.now() });
      bc.close();
    }
  } catch {}

  // 2. Événement localStorage (couverture cross-fenêtre universelle)
  try {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify({ crmType, timestamp: Date.now() }));
  } catch {}

  // 3. Événement intra-fenêtre / intra-composant
  try {
    window.dispatchEvent(new CustomEvent('elios-crm-sync', { detail: { crmType } }));
  } catch {}
}

/**
 * Souscrit un composant aux signaux de synchronisation en temps réel
 */
export function subscribeToCrmSync(
  crmType: 'elios' | 'formatic',
  callback: () => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleMessage = (event: MessageEvent) => {
    if (event.data && (event.data.crmType === crmType || event.data.crmType === 'all')) {
      callback();
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === SYNC_STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed.crmType === crmType || parsed.crmType === 'all') {
          callback();
        }
      } catch {}
    }
  };

  const handleCustom = (event: Event) => {
    const custom = event as CustomEvent;
    if (custom.detail && (custom.detail.crmType === crmType || custom.detail.crmType === 'all')) {
      callback();
    }
  };

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
      bc.onmessage = handleMessage;
    }
  } catch {}

  window.addEventListener('storage', handleStorage);
  window.addEventListener('elios-crm-sync', handleCustom);

  return () => {
    try {
      if (bc) bc.close();
    } catch {}
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('elios-crm-sync', handleCustom);
  };
}

