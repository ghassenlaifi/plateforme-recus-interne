/**
 * Client-Side Local Cache Helper for CRM Leads
 * Fournit un rendu instantané à T=0ms (Zéro écran vide, Zéro flash à 0)
 */

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
  const keys = ['elios_cached_leads', 'formatic_cached_leads', 'sos_prof_cached_leads'];
  for (const key of keys) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((l: any) => 
          l._id !== targetId && 
          l.id !== targetId && 
          (!customId || l.id !== customId)
        );
        sessionStorage.setItem(key, JSON.stringify(filtered));
      }
    } catch {}
  }
}

export function setClientCachedLeads(key: string, data: any[]) {
  if (typeof window === 'undefined' || !Array.isArray(data)) return;
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    // Si quota sessionStorage dépassé (rare pour ~3MB), basculer silencieusement
    console.warn(`[ClientCache] sessionStorage write notice:`, err);
  }
}

export function prependClientCachedLead(key: string, newLead: any) {
  if (typeof window === 'undefined' || !newLead) return;
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter((l: any) => 
        (l._id && l._id !== newLead._id) && 
        (l.id && l.id !== newLead.id)
      );
      sessionStorage.setItem(key, JSON.stringify([newLead, ...filtered]));
    }
  } catch {}
}

export function updateClientCachedLead(updatedLead: any) {
  if (typeof window === 'undefined' || !updatedLead) return;
  const leadId = updatedLead._id ? String(updatedLead._id) : updatedLead.id;
  const keys = ['elios_cached_leads', 'formatic_cached_leads', 'sos_prof_cached_leads'];
  for (const key of keys) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const idx = parsed.findIndex((l: any) => 
          (l._id && String(l._id) === leadId) || 
          (l.id && l.id === leadId)
        );
        if (idx !== -1) {
          parsed[idx] = { ...parsed[idx], ...updatedLead };
          sessionStorage.setItem(key, JSON.stringify(parsed));
        }
      }
    } catch {}
  }
}



