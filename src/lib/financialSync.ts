/**
 * Cross-Tab and Real-Time Synchronization Engine for Receipts, Wallets & Financial Portefeuilles
 * Garantit une cohérence et une synchronisation instantanée entre :
 * - Suivi des encaissements (/receipts)
 * - Trésorerie & Portefeuilles (/portefeuilles)
 * - Reçus de paiement (/payment-receipts)
 * - CRM Elios (/crm-elios) & CRM Formatic (/crm-formatic)
 */
import { broadcastCrmChange } from '@/lib/crmSync';

const FINANCIAL_SYNC_CHANNEL = 'elios_financial_sync_channel';
const FINANCIAL_SYNC_STORAGE_KEY = 'elios_financial_sync_pulse';

export type FinancialAction = 
  | 'receipt_created' 
  | 'receipt_updated' 
  | 'receipt_deleted' 
  | 'receipt_processed'
  | 'wallet_retrait'
  | 'wallet_reset';

/**
 * Émet une pulsation de synchronisation globale multi-onglets et multi-fenêtres
 */
export function broadcastFinancialChange(action: FinancialAction = 'receipt_updated') {
  if (typeof window === 'undefined') return;

  // 1. Canal BroadcastChannel natif haute performance
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(FINANCIAL_SYNC_CHANNEL);
      bc.postMessage({ type: 'FINANCIAL_DATA_CHANGED', action, timestamp: Date.now() });
      bc.close();
    }
  } catch {}

  // 2. Événement localStorage (couverture cross-fenêtre universelle)
  try {
    localStorage.setItem(FINANCIAL_SYNC_STORAGE_KEY, JSON.stringify({ action, timestamp: Date.now() }));
  } catch {}

  // 3. Événement intra-fenêtre / intra-composant
  try {
    window.dispatchEvent(new CustomEvent('elios-financial-sync', { detail: { action } }));
  } catch {}

  // 4. Synchronisation automatique des CRMs (Leads, statuts, notes)
  try {
    broadcastCrmChange('all');
  } catch {}
}

/**
 * Souscrit un composant ou une page aux pulsations financières temps réel
 */
export function subscribeToFinancialSync(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'FINANCIAL_DATA_CHANGED') {
      callback();
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === FINANCIAL_SYNC_STORAGE_KEY) {
      callback();
    }
  };

  const handleCustom = () => {
    callback();
  };

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(FINANCIAL_SYNC_CHANNEL);
      bc.onmessage = handleMessage;
    }
  } catch {}

  window.addEventListener('storage', handleStorage);
  window.addEventListener('elios-financial-sync', handleCustom);

  return () => {
    try {
      if (bc) bc.close();
    } catch {}
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('elios-financial-sync', handleCustom);
  };
}

