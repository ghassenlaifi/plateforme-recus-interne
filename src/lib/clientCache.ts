/**
 * Client-Side Local Cache Helper for CRM Leads
 * Fournit un rendu instantané à T=0ms (Zéro écran vide, Zéro flash à 0)
 * Optimisé pour une empreinte ultra-légère (< 50 Ko) et zéro dépassement de quota.
 */

const MAX_CACHED_LEADS = 100;

function stripHeavyFields(lead: any) {
  if (!lead || typeof lead !== 'object') return lead;
  // Ne pas stocker l'historique complet des notes et logs dans le sessionStorage client
  const { notes, modifierLogs, ...lightLead } = lead;
  return lightLead;
}

export function getClientCachedLeads(key: string): any[] | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return undefined;
}

export function removeClientCachedLead(targetId: string, customId?: string) {
  if (typeof window === 'undefined' || !targetId) return;
  const targetStr = String(targetId).trim();
  const customStr = customId ? String(customId).trim() : null;
  const keys = ['elios_cached_leads', 'formatic_cached_leads', 'sos_prof_cached_leads'];

  for (const key of keys) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((l: any) => {
          const lMongoId = l._id ? String(l._id).trim() : '';
          const lCustomId = l.id ? String(l.id).trim() : '';
          if (lMongoId && lMongoId === targetStr) return false;
          if (lCustomId && lCustomId === targetStr) return false;
          if (customStr && lCustomId === customStr) return false;
          return true;
        });
        sessionStorage.setItem(key, JSON.stringify(filtered.slice(0, MAX_CACHED_LEADS)));
      }
    } catch {}
  }
}

export function setClientCachedLeads(key: string, data: any[]) {
  if (typeof window === 'undefined' || !Array.isArray(data)) return;
  try {
    // Sauvegarder uniquement les MAX_CACHED_LEADS premiers prospects allégés
    const light = data.slice(0, MAX_CACHED_LEADS).map(stripHeavyFields);
    sessionStorage.setItem(key, JSON.stringify(light));
  } catch (err) {
    console.warn(`[ClientCache] sessionStorage write notice:`, err);
  }
}

export function prependClientCachedLead(key: string, newLead: any) {
  if (typeof window === 'undefined' || !newLead) return;
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    const lightLead = stripHeavyFields(newLead);
    const targetStr = lightLead._id ? String(lightLead._id) : String(lightLead.id || '');

    if (Array.isArray(parsed)) {
      const filtered = parsed.filter((l: any) => {
        const lMongo = l._id ? String(l._id) : '';
        const lCustom = l.id ? String(l.id) : '';
        return lMongo !== targetStr && lCustom !== targetStr;
      });
      sessionStorage.setItem(key, JSON.stringify([lightLead, ...filtered].slice(0, MAX_CACHED_LEADS)));
    }
  } catch {}
}

export function updateClientCachedLead(updatedLead: any) {
  if (typeof window === 'undefined' || !updatedLead) return;
  const leadId = updatedLead._id ? String(updatedLead._id) : String(updatedLead.id || '');
  const keys = ['elios_cached_leads', 'formatic_cached_leads', 'sos_prof_cached_leads'];
  for (const key of keys) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const idx = parsed.findIndex((l: any) => 
          (l._id && String(l._id) === leadId) || 
          (l.id && String(l.id) === leadId)
        );
        if (idx !== -1) {
          parsed[idx] = { ...parsed[idx], ...stripHeavyFields(updatedLead) };
          sessionStorage.setItem(key, JSON.stringify(parsed.slice(0, MAX_CACHED_LEADS)));
        }
      }
    } catch {}
  }
}



