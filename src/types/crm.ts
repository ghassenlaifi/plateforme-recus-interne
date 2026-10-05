export interface LeadNote {
  id?: string;
  by?: string;
  addedBy?: string;
  date?: string;
  addedAt?: string | Date;
  text: string;
}

export interface LeadItem {
  _id?: string;
  id: string;
  firstName?: string;
  lastName?: string;
  name: string;
  phone: string;
  offer?: string;
  amount?: string;
  source?: string;
  grade?: string;
  section?: string;
  status: string;
  staff?: string;
  date: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  lastModifiedBy?: string;
  notes?: LeadNote[];
  familyGroup?: string;
  toElios?: boolean;
  fromFormatic?: boolean;
  crmType: 'elios' | 'formatic';
}

// -------------------------------------------------------------
// CONFIGURATION OFFICIELLE CRM ELIOS & FORMATIC (FILTRES UNIFIÉS)
// -------------------------------------------------------------

export const ELIOS_STATUSES = [
  'Lead',
  'N/A',
  'Potential Prospect',
  'Approved Prospect',
  'Approved',
  'Rejected'
] as const;

export type EliosStatus = typeof ELIOS_STATUSES[number];

export const ELIOS_STATUS_COLORS: Record<string, string> = {
  "Lead": "#3B82F6",              // Bleu - nouveau lead entrant par défaut
  "N/A": "#6B7280",               // Gris - Pas de réponse / non attribué
  "Potential Prospect": "#0891B2",// Cyan - Prospect intéressé
  "Approved Prospect": "#D97706", // Ambre chaud - En phase finale de validation
  "Approved": "#16A34A",          // Vert émeraude - Inscription confirmée / payée
  "Rejected": "#DC2626",          // Rouge - Refusé / annulé
  // Rétrocompatibilité
  "Nouveau": "#3B82F6",
  "Converti": "#16A34A",
  "À rappeler": "#D97706"
};

export const ELIOS_CLASSES = [
  "7ème de Base",
  "8ème de Base",
  "9ème de Base",
  "1ère Année",
  "2ème Année",
  "3ème Année",
  "BAC"
] as const;

export const ELIOS_SECTIONS = [
  "Science",
  "Mathématiques",
  "Technique",
  "Informatique",
  "Économie",
  "Lettres",
  "Sport"
] as const;

export const ELIOS_SOURCES = [
  "Facebook",
  "Whatsapp",
  "Instagram",
  "Ex-Elios",
  "Appel Direct",
  "Formatic dataBase",
  "From Formatic"
] as const;

export const ELIOS_OFFERS = [
  "Zero to Hero",
  "Bac Intensif",
  "Suivi Annuel",
  "Formation Pro",
  "Autre"
] as const;

// Alias Formatic (règles et filtres strictement identiques)
export const FORMATIC_STATUSES = ELIOS_STATUSES;
export const FORMATIC_STATUS_COLORS = ELIOS_STATUS_COLORS;
export const FORMATIC_CLASSES = ELIOS_CLASSES;
export const FORMATIC_SECTIONS = ELIOS_SECTIONS;
export const FORMATIC_SOURCES = ELIOS_SOURCES;
export const FORMATIC_OFFERS = ELIOS_OFFERS;

/**
 * Règle Métier Stricte des Rappels Elios :
 * - Un élève au statut 'N/A' passe aux Rappels exactement 5 jours après sa dernière modification.
 * - Un élève au statut 'Potential Prospect' ou 'Approved Prospect' passe aux Rappels 3 jours après sa dernière modification.
 * - Tout autre statut (Lead, Approved, Rejected) ne passe JAMAIS aux Rappels.
 * - Dès qu'une modification est effectuée, la date de dernière modification est réinitialisée à Date.now(),
 *   sortant instantanément l'élève des Rappels.
 */
export function isLeadInRappels(lead: LeadItem, now: number = Date.now()): boolean {
  const status = (lead.status || '').trim();
  if (status !== 'N/A' && status !== 'Potential Prospect' && status !== 'Approved Prospect') {
    return false;
  }
  const lastModTime = lead.updatedAt 
    ? new Date(lead.updatedAt).getTime() 
    : (lead.date ? new Date(lead.date).getTime() : 0);
  
  if (!lastModTime || isNaN(lastModTime)) return false;

  const diffDays = (now - lastModTime) / (1000 * 60 * 60 * 24);

  if (status === 'N/A') {
    return diffDays >= 5;
  }
  if (status === 'Potential Prospect' || status === 'Approved Prospect') {
    return diffDays >= 3;
  }
  return false;
}

export function getRappelsDelayDays(lead: LeadItem, now: number = Date.now()): number {
  const lastModTime = lead.updatedAt 
    ? new Date(lead.updatedAt).getTime() 
    : (lead.date ? new Date(lead.date).getTime() : 0);
  if (!lastModTime || isNaN(lastModTime)) return 0;
  return Math.floor((now - lastModTime) / (1000 * 60 * 60 * 24));
}

// Compatibilité générale pour d'autres CRM
export const CRM_STATUS_COLORS = ELIOS_STATUS_COLORS;
export const CRM_SELECTABLE_STATUSES = ELIOS_STATUSES;
