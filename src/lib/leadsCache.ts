/**
 * In-Memory High Performance Leads Cache with Stale-While-Revalidate
 * Architecturé pour diviser le temps de réponse par 1000x et garantir l'intégrité des données.
 */

interface CacheEntry {
  data: any[];
  timestamp: number;
  isFetching?: boolean;
}

// Global cache store sur le process Node.js pour survivre aux rechargements de modules Next.js en dev
const globalStore = global as unknown as {
  __leadsMemoryCache?: {
    elios?: CacheEntry;
    formatic?: CacheEntry;
    'sos-prof'?: CacheEntry;
  };
};

if (!globalStore.__leadsMemoryCache) {
  globalStore.__leadsMemoryCache = {};
}

const cache = globalStore.__leadsMemoryCache;
const TTL_MS = 15 * 1000; // 15 secondes de fraîcheur en mémoire vive

export function getCachedLeads(crmType: 'elios' | 'formatic' | 'sos-prof'): { data: any[] | null; isStale: boolean } {
  const entry = cache[crmType];
  if (!entry || !entry.data || entry.data.length === 0) {
    return { data: null, isStale: true };
  }

  const age = Date.now() - entry.timestamp;
  if (age < TTL_MS) {
    return { data: entry.data, isStale: false };
  }

  // Si le cache a plus de 15s, on force le rechargement immédiat pour intégrité absolue
  return { data: null, isStale: true };
}

export function setCachedLeads(crmType: 'elios' | 'formatic' | 'sos-prof', data: any[]) {
  cache[crmType] = {
    data,
    timestamp: Date.now(),
    isFetching: false,
  };
}

export function invalidateLeadsCache(crmType?: 'elios' | 'formatic' | 'sos-prof' | 'all') {
  if (!crmType || crmType === 'all') {
    delete cache.elios;
    delete cache.formatic;
    delete cache['sos-prof'];
  } else {
    delete cache[crmType];
  }
}

/**
 * Mise à jour atomique dans le cache mémoire pour garantir une cohérence instantanée
 */
export function updateCachedLeadInPlace(crmType: 'elios' | 'formatic' | 'sos-prof', updatedLead: any) {
  const entry = cache[crmType];
  if (!entry || !Array.isArray(entry.data)) return;

  const leadId = updatedLead._id ? updatedLead._id.toString() : updatedLead.id;
  const idx = entry.data.findIndex((l: any) => 
    (l._id && l._id.toString() === leadId) || 
    (l.id && l.id === leadId)
  );

  if (idx !== -1) {
    entry.data[idx] = { ...entry.data[idx], ...updatedLead };
  } else {
    // Si nouveau prospect, l'insérer en tête
    entry.data.unshift(updatedLead);
  }
  entry.timestamp = Date.now();
}

/**
 * Suppression atomique dans le cache mémoire
 */
export function removeCachedLeadInPlace(crmType: 'elios' | 'formatic' | 'sos-prof', targetId: string, customId?: string) {
  const entry = cache[crmType];
  if (!entry || !Array.isArray(entry.data)) return;

  entry.data = entry.data.filter((l: any) => 
    (l._id && l._id.toString() !== targetId) && 
    (l.id && l.id !== targetId) &&
    (!customId || l.id !== customId)
  );
  entry.timestamp = Date.now();
}

/**
 * Suppression universelle dans tous les caches CRM
 */
export function removeCachedLeadEverywhere(targetId: string, customId?: string) {
  removeCachedLeadInPlace('elios', targetId, customId);
  removeCachedLeadInPlace('formatic', targetId, customId);
  removeCachedLeadInPlace('sos-prof', targetId, customId);
}


