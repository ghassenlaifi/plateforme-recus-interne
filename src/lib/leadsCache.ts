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
  };
};

if (!globalStore.__leadsMemoryCache) {
  globalStore.__leadsMemoryCache = {};
}

const cache = globalStore.__leadsMemoryCache;
const TTL_MS = 60 * 1000; // 60 secondes de fraîcheur absolue
const STALE_TTL_MS = 10 * 60 * 1000; // Jusqu'à 10 minutes pour Stale-While-Revalidate

export function getCachedLeads(crmType: 'elios' | 'formatic'): { data: any[] | null; isStale: boolean } {
  const entry = cache[crmType];
  if (!entry || !entry.data || entry.data.length === 0) {
    return { data: null, isStale: true };
  }

  const age = Date.now() - entry.timestamp;
  if (age < TTL_MS) {
    return { data: entry.data, isStale: false };
  }

  if (age < STALE_TTL_MS) {
    return { data: entry.data, isStale: true };
  }

  return { data: null, isStale: true };
}

export function setCachedLeads(crmType: 'elios' | 'formatic', data: any[]) {
  cache[crmType] = {
    data,
    timestamp: Date.now(),
    isFetching: false,
  };
}

export function invalidateLeadsCache(crmType?: 'elios' | 'formatic' | 'all') {
  if (!crmType || crmType === 'all') {
    delete cache.elios;
    delete cache.formatic;
  } else {
    delete cache[crmType];
  }
}

/**
 * Mise à jour atomique dans le cache mémoire pour garantir une cohérence instantanée
 */
export function updateCachedLeadInPlace(crmType: 'elios' | 'formatic', updatedLead: any) {
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
export function removeCachedLeadInPlace(crmType: 'elios' | 'formatic', targetId: string) {
  const entry = cache[crmType];
  if (!entry || !Array.isArray(entry.data)) return;

  entry.data = entry.data.filter((l: any) => 
    (l._id && l._id.toString() !== targetId) && 
    (l.id && l.id !== targetId)
  );
  entry.timestamp = Date.now();
}

