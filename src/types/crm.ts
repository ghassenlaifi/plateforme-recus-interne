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
  isMigratedToElios?: boolean;
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
  "Lead": "#23356E",              // Bleu Marine officiel (100%)
  "Approved": "#3D4E7F",          // Bleu Marine degré 80% (autre degré de bleu de la palette)
  "N/A": "#6B7280",               // Gris neutre
  "Potential Prospect": "#F49E1F",// Orangé officiel de la palette (100%)
  "Approved Prospect": "#7BA25B", // Vert Olive officiel de la palette (100%)
  "Rejected": "#DC2626",          // Rouge refusé / alerte
  "rejected": "#DC2626",          // Rouge refusé (tolérance minuscule)
  // Rétrocompatibilité
  "Nouveau": "#23356E",
  "Converti": "#3D4E7F",
  "À rappeler": "#F49E1F"
};

/**
 * Résolution robuste et insensible à la casse de la couleur de statut selon la palette entreprise
 */
export function getEliosStatusColor(status?: string | null): string {
  if (!status) return '#6B7280';
  const s = status.trim();
  if (ELIOS_STATUS_COLORS[s]) return ELIOS_STATUS_COLORS[s];
  const lower = s.toLowerCase();
  if (lower === 'lead' || lower === 'nouveau') return '#23356E';
  if (lower === 'approved' || lower === 'converti') return '#3D4E7F';
  if (lower === 'n/a' || lower === 'na') return '#6B7280';
  if (lower === 'potential prospect' || lower === 'à rappeler' || lower === 'a rappeler') return '#F49E1F';
  if (lower === 'approved prospect') return '#7BA25B';
  if (lower === 'rejected') return '#DC2626';
  return '#6B7280';
}

export const getFormaticStatusColor = getEliosStatusColor;
export const getCrmStatusColor = getEliosStatusColor;

export const ELIOS_CLASSES = [
  "7ème de Base",
  "8ème de Base",
  "9ème de Base",
  "1ère Année",
  "2ème Année",
  "3ème Année",
  "BAC"
] as const;

export const CLASSES_WITHOUT_SECTION = [
  "7ème de Base",
  "8ème de Base",
  "9ème de Base",
  "1ère Année"
] as const;

/**
 * Détermine si une classe scolaire n'a pas de filière/section
 * (7ème de Base, 8ème de Base, 9ème de Base, 1ère Année).
 */
export function isClassWithoutSection(classe?: string | null): boolean {
  if (!classe || classe === 'ALL') return false;
  const c = classe.trim().toLowerCase();
  return (
    c.startsWith('7') ||
    c.startsWith('8') ||
    c.startsWith('9') ||
    c.startsWith('1') ||
    c.includes('7ème') ||
    c.includes('7eme') ||
    c.includes('8ème') ||
    c.includes('8eme') ||
    c.includes('9ème') ||
    c.includes('9eme') ||
    c.includes('1ère') ||
    c.includes('1ere')
  );
}

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
export const FORMATIC_CLASSES_WITHOUT_SECTION = CLASSES_WITHOUT_SECTION;
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
