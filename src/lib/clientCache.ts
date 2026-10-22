/**
 * Global In-Memory Client Cache for CRM Leads
 * Fournit un rendu instantané à T=0ms pour l'INTÉGRALITÉ des données CRM (> 3 300 prospects)
 * Sans limitation arbitraire de taille, sans troncature à 100, et sans quota browser.
 * Engine Version: 2.1 - Ultra-fast multi-crm data synchronization
 */

// Store global persistant au sein de la session SPA du navigateur
const globalClientStore = (typeof window !== 'undefined' ? (window as any) : global) as {
  __crm_full_leads_cache?: Record<string, any[]>;
};

if (!globalClientStore.__crm_full_leads_cache) {
  globalClientStore.__crm_full_leads_cache = {};
}

// Purge défensive des anciens caches sessionStorage résiduels (qui étaient bridés à 100 prospects)
if (typeof window !== 'undefined') {
  try {
    sessionStorage.removeItem('elios_cached_leads');
    sessionStorage.removeItem('formatic_cached_leads');
    sessionStorage.removeItem('sos_prof_cached_leads');
  } catch {}
}

const memoryCache = globalClientStore.__crm_full_leads_cache;

export function getClientCachedLeads(key: string): any[] | undefined {
  const data = memoryCache[key];
  if (Array.isArray(data) && data.length > 0) {
    return data;
  }
  return undefined;
}

export function setClientCachedLeads(key: string, data: any[]) {
  if (!Array.isArray(data)) return;
  // Stocke l'intégralité sans aucune troncature
  memoryCache[key] = data;
}

export function prependClientCachedLead(key: string, newLead: any) {
  if (!newLead) return;
  const list = memoryCache[key] || [];
  const targetMongo = newLead._id ? String(newLead._id).trim() : '';
  const targetCust = newLead.id ? String(newLead.id).trim() : '';

  const filtered = list.filter((l: any) => {
    const lMongo = l._id ? String(l._id).trim() : '';
    const lCust = l.id ? String(l.id).trim() : '';
    if (targetMongo && lMongo === targetMongo) return false;
    if (targetCust && lCust === targetCust) return false;
    return true;
  });

  memoryCache[key] = [newLead, ...filtered];
}

export function removeClientCachedLead(targetId: string, customId?: string) {
  if (!targetId) return;
  const targetStr = String(targetId).trim();
  const customStr = customId ? String(customId).trim() : null;
  const keys = ['elios_cached_leads', 'formatic_cached_leads', 'sos_prof_cached_leads'];

  for (const key of keys) {
    const list = memoryCache[key];
    if (Array.isArray(list)) {
      memoryCache[key] = list.filter((l: any) => {
        const lMongoId = l._id ? String(l._id).trim() : '';
        const lCustomId = l.id ? String(l.id).trim() : '';
        if (lMongoId && lMongoId === targetStr) return false;
        if (lCustomId && lCustomId === targetStr) return false;
        if (customStr && lCustomId === customStr) return false;
        return true;
      });
    }
  }
}

export function updateClientCachedLead(updatedLead: any) {
  if (!updatedLead) return;
  const leadMongo = updatedLead._id ? String(updatedLead._id).trim() : '';
  const leadCust = updatedLead.id ? String(updatedLead.id).trim() : '';
  const keys = ['elios_cached_leads', 'formatic_cached_leads', 'sos_prof_cached_leads'];

  for (const key of keys) {
    const list = memoryCache[key];
    if (Array.isArray(list)) {
      const idx = list.findIndex((l: any) => {
        const lMongo = l._id ? String(l._id).trim() : '';
        const lCust = l.id ? String(l.id).trim() : '';
        return (leadMongo && lMongo === leadMongo) || (leadCust && lCust === leadCust);
      });
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updatedLead };
      }
    }
  }
}



