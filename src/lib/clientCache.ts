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

export function setClientCachedLeads(key: string, data: any[]) {
  if (typeof window === 'undefined' || !Array.isArray(data) || data.length === 0) return;
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    // Si quota sessionStorage dépassé (rare pour ~3MB), basculer silencieusement
    console.warn(`[ClientCache] sessionStorage write notice:`, err);
  }
}

