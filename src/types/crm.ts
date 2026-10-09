export interface LeadNote {
  id?: string;
  by?: string;
  addedBy?: string;
  date?: string;
  addedAt?: string | Date;
  text: string;
}

export interface ModifierLog {
  operator: string;
  at: string | Date;
  action?: string;
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
  modifiers?: string[];
  modifierLogs?: ModifierLog[];
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
  "Lead": "#0284C7",              // Bleu clair officiel (Sky-600)
  "Approved": "#7BA25B",          // Vert Olive officiel de la palette (100%) [Inversé avec Approved Prospect]
  "N/A": "#6B7280",               // Gris neutre
  "Potential Prospect": "#F49E1F",// Orangé officiel de la palette (100%)
  "Approved Prospect": "#3D4E7F", // Bleu Marine degré 80% [Inversé avec Approved]
  "Rejected": "#DC2626",          // Rouge refusé / alerte
  "rejected": "#DC2626",          // Rouge refusé (tolérance minuscule)
  // Rétrocompatibilité
  "Nouveau": "#0284C7",
  "Converti": "#7BA25B",
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
  if (lower === 'lead' || lower === 'nouveau') return '#0284C7';
  if (lower === 'approved' || lower === 'converti') return '#7BA25B';
  if (lower === 'n/a' || lower === 'na') return '#6B7280';
  if (lower === 'potential prospect' || lower === 'à rappeler' || lower === 'a rappeler') return '#F49E1F';
  if (lower === 'approved prospect') return '#3D4E7F';
  if (lower === 'rejected') return '#DC2626';
  return '#6B7280';
}

export const getFormaticStatusColor = getEliosStatusColor;
export const getCrmStatusColor = getEliosStatusColor;

export const ELIOS_NIVEAUX = [
  "7ème de Base",
  "8ème de Base",
  "9ème de Base",
  "1ère Année",
  "2ème Année",
  "3ème Année",
  "BAC"
] as const;

export const NIVEAUX_WITHOUT_SECTION = [
  "7ème de Base",
  "8ème de Base",
  "9ème de Base",
  "1ère Année"
] as const;

// Rétrocompatibilité
export const ELIOS_CLASSES = ELIOS_NIVEAUX;
export const CLASSES_WITHOUT_SECTION = NIVEAUX_WITHOUT_SECTION;

/**
 * Détermine si un niveau scolaire n'a pas de filière/section
 * (7ème de Base, 8ème de Base, 9ème de Base, 1ère Année).
 */
export function isLevelWithoutSection(level?: string | null): boolean {
  if (!level || level === 'ALL') return false;
  const c = level.trim().toLowerCase();
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

export const isClassWithoutSection = isLevelWithoutSection;

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

/**
 * Résout de façon déterministe et robuste le nom de l'opérateur ayant effectué
 * la dernière modification sur la fiche du prospect.
 * 
 * Priorité d'intégrité :
 * 1. lead.lastModifiedBy si renseigné et distinct de 'Système' / 'Non assigné'
 * 2. Dernier opérateur consigné dans lead.modifierLogs
 * 3. Auteur de la note la plus récente (si notes présentes)
 * 4. lead.staff initial (créateur / premier manipulateur) si valide
 * 5. Repli propre sur lastModifiedBy / staff ou 'Non assigné'
 */
export function getLeadLastModifier(lead?: Partial<LeadItem> | null): string {
  if (!lead) return 'Non assigné';

  // 1. lastModifiedBy explicite
  const lastMod = (lead.lastModifiedBy || '').trim();
  if (
    lastMod &&
    lastMod.toLowerCase() !== 'système' &&
    lastMod.toLowerCase() !== 'systeme' &&
    lastMod.toLowerCase() !== 'non assigné' &&
    lastMod.toLowerCase() !== 'non assigne'
  ) {
    return lastMod;
  }

  // 2. Dernier opérateur dans modifierLogs
  if (Array.isArray(lead.modifierLogs) && lead.modifierLogs.length > 0) {
    for (let i = lead.modifierLogs.length - 1; i >= 0; i--) {
      const op = (lead.modifierLogs[i]?.operator || '').trim();
      if (
        op &&
        op.toLowerCase() !== 'système' &&
        op.toLowerCase() !== 'systeme' &&
        op.toLowerCase() !== 'non assigné' &&
        op.toLowerCase() !== 'non assigne'
      ) {
        return op;
      }
    }
  }

  // 3. Auteur de la note la plus récente
  if (Array.isArray(lead.notes) && lead.notes.length > 0) {
    for (const note of lead.notes) {
      if (!note) continue;
      const noteAuthor = (note.by || note.addedBy || (note as any).editedBy || '').trim();
      if (
        noteAuthor &&
        noteAuthor.toLowerCase() !== 'système' &&
        noteAuthor.toLowerCase() !== 'systeme' &&
        noteAuthor.toLowerCase() !== 'non assigné' &&
        noteAuthor.toLowerCase() !== 'non assigne'
      ) {
        return noteAuthor;
      }
    }
  }

  // 4. Créateur initial / staff assigné
  const staff = (lead.staff || '').trim();
  if (
    staff &&
    staff.toLowerCase() !== 'système' &&
    staff.toLowerCase() !== 'systeme' &&
    staff.toLowerCase() !== 'non assigné' &&
    staff.toLowerCase() !== 'non assigne'
  ) {
    return staff;
  }

  return lastMod || staff || 'Non assigné';
}

/**
 * Détermine si un prospect a été créé, modifié ou annoté par un opérateur donné à un moment quelconque.
 * Règle d'or : Retourne vrai si l'opérateur :
 * - A créé ou est assigné à la fiche (lead.staff),
 * - A effectué la dernière modification (lead.lastModifiedBy),
 * - Figure dans l'historique des modifications structurées (lead.modifierLogs),
 * - Figure dans l'historique des modificateurs (lead.modifiers),
 * - A rédigé, ajouté ou modifié une note dans l'historique (lead.notes).
 */
export function isLeadTouchedByStaff(lead?: Partial<LeadItem> | null, targetStaff?: string | null): boolean {
  if (!lead) return false;
  if (!targetStaff || targetStaff === 'ALL') return true;

  const target = targetStaff.trim().toLowerCase();
  if (!target || target === 'all') return true;

  // 1. Staff initial / créateur
  const staff = (lead.staff || '').trim().toLowerCase();
  if (staff === target) return true;

  // 2. Dernier modificateur
  const lastMod = (lead.lastModifiedBy || '').trim().toLowerCase();
  if (lastMod === target) return true;

  // 3. Historique précis modifierLogs
  if (Array.isArray(lead.modifierLogs)) {
    for (const log of lead.modifierLogs) {
      if (log?.operator && log.operator.trim().toLowerCase() === target) return true;
    }
  }

  // 4. Modificateurs historiques enregistrés
  if (Array.isArray(lead.modifiers)) {
    for (const m of lead.modifiers) {
      if (m && m.trim().toLowerCase() === target) return true;
    }
  }

  // 5. Auteur ou éditeur d'une note dans l'historique
  if (Array.isArray(lead.notes)) {
    for (const n of lead.notes) {
      if (!n) continue;
      const author = (n.by || n.addedBy || (n as any).editedBy || '').trim().toLowerCase();
      if (author === target) return true;

      // Détection des mentions textuelles automatiques (ex: "migré depuis CRM Formatic par NomOperateur")
      const text = (n.text || '').toLowerCase();
      if (text.includes(`par ${target}`)) return true;
    }
  }

  return false;
}

/**
 * Extrait l'ensemble exhaustif des opérateurs ayant contribué à cette fiche prospect.
 */
export function extractAllLeadStaff(lead?: Partial<LeadItem> | null): string[] {
  if (!lead) return [];
  const set = new Set<string>();

  const addIfValid = (name?: string | null) => {
    if (!name) return;
    const clean = name.trim();
    if (!clean) return;
    const lower = clean.toLowerCase();
    if (lower === 'système' || lower === 'systeme' || lower === 'non assigné' || lower === 'non assigne') return;
    set.add(clean);
  };

  addIfValid(lead.staff);
  addIfValid(lead.lastModifiedBy);

  if (Array.isArray(lead.modifiers)) {
    lead.modifiers.forEach(addIfValid);
  }

  if (Array.isArray(lead.modifierLogs)) {
    lead.modifierLogs.forEach((m: any) => addIfValid(m?.operator));
  }

  if (Array.isArray(lead.notes)) {
    lead.notes.forEach((n: any) => {
      addIfValid(n?.by);
      addIfValid(n?.addedBy);
      addIfValid(n?.editedBy);
    });
  }

  return Array.from(set);
}

// -----------------------------------------------------------------------------
// ARCHITECTURE DES FILTRES COMBINÉS TEMPORELS ET OPÉRATEURS (DATA INTEGRITY)
// -----------------------------------------------------------------------------

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Calcule l'intervalle temporel [start, end] selon le filtre sélectionné.
 * - 'today': Aujourd'hui 00:00:00.000 à 23:59:59.999
 * - 'week': 7 derniers jours glissants (jusqu'à aujourd'hui 23:59:59.999)
 * - 'month': Du 1er jour du mois courant à 00:00:00.000 jusqu'au dernier jour à 23:59:59.999
 * - 'custom': Plage personnalisée définie par customStartDate et customEndDate
 */
export function getDateFilterRange(
  filterDate?: string | null,
  customStartDate?: string | null,
  customEndDate?: string | null,
  refDate: Date = new Date()
): DateRange | null {
  if (!filterDate || filterDate === 'ALL') return null;

  if (filterDate === 'today') {
    const start = new Date(refDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(refDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (filterDate === 'week') {
    const start = new Date(refDate);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(refDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (filterDate === 'month') {
    const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (filterDate === 'custom') {
    if (!customStartDate && !customEndDate) return null;
    const start = customStartDate 
      ? new Date(new Date(customStartDate).setHours(0, 0, 0, 0)) 
      : new Date(0);
    const end = customEndDate 
      ? new Date(new Date(customEndDate).setHours(23, 59, 59, 999)) 
      : new Date(8640000000000000);
    return { start, end };
  }

  return null;
}

/**
 * Détermine si un horodatage se trouve dans l'intervalle donné.
 */
export function isTimestampInRange(
  time: Date | string | number | undefined | null,
  range: DateRange
): boolean {
  if (!time) return false;
  const t = new Date(time).getTime();
  if (isNaN(t)) return false;
  return t >= range.start.getTime() && t <= range.end.getTime();
}

/**
 * Extrait l'ensemble des horodatages réels où un opérateur cible a créé, modifié
 * ou annoté un prospect donné.
 */
export function getStaffContributionTimestamps(
  lead?: Partial<LeadItem> | null,
  targetStaff?: string | null
): Date[] {
  if (!lead || !targetStaff || targetStaff === 'ALL') return [];
  const target = targetStaff.trim().toLowerCase();
  if (!target || target === 'all') return [];

  const timestamps: Date[] = [];
  const pushIfValid = (val: Date | string | undefined | null) => {
    if (!val) return;
    const d = new Date(val);
    if (!isNaN(d.getTime())) timestamps.push(d);
  };

  // 1. Staff initial / créateur
  const staff = (lead.staff || '').trim().toLowerCase();
  if (staff === target) {
    pushIfValid(lead.date);
    pushIfValid(lead.createdAt);
  }

  // 2. Dernier modificateur
  const lastMod = (lead.lastModifiedBy || '').trim().toLowerCase();
  if (lastMod === target) {
    pushIfValid(lead.updatedAt);
  }

  // 3. ModifierLogs (historique précis)
  if (Array.isArray(lead.modifierLogs)) {
    for (const log of lead.modifierLogs) {
      if (log?.operator && log.operator.trim().toLowerCase() === target) {
        pushIfValid(log.at);
      }
    }
  }

  // 4. Notes ajoutées ou modifiées
  if (Array.isArray(lead.notes)) {
    for (const n of lead.notes) {
      if (!n) continue;
      const author = (n.by || n.addedBy || '').trim().toLowerCase();
      const editor = ((n as any).editedBy || '').trim().toLowerCase();
      const noteText = (n.text || '').toLowerCase();
      const isParTarget = noteText.includes(`par ${target}`);

      if (author === target || isParTarget) {
        pushIfValid(n.addedAt);
        pushIfValid(n.date);
      }
      if (editor === target) {
        pushIfValid((n as any).editedAt);
      }
    }
  }

  return timestamps;
}

/**
 * Détermine si un prospect a eu une activité quelconque (création, modification, note, log)
 * dans l'intervalle temporel spécifié.
 */
export function isLeadActiveInDateRange(
  lead?: Partial<LeadItem> | null,
  range?: DateRange | null
): boolean {
  if (!lead || !range) return true;

  // 1. Date de modification
  if (isTimestampInRange(lead.updatedAt, range)) return true;

  // 2. Date de création
  if (isTimestampInRange(lead.date, range)) return true;
  if (isTimestampInRange(lead.createdAt, range)) return true;

  // 3. ModifierLogs
  if (Array.isArray(lead.modifierLogs)) {
    for (const log of lead.modifierLogs) {
      if (isTimestampInRange(log?.at, range)) return true;
    }
  }

  // 4. Notes
  if (Array.isArray(lead.notes)) {
    for (const n of lead.notes) {
      if (isTimestampInRange(n?.addedAt, range)) return true;
      if (isTimestampInRange(n?.date, range)) return true;
      if (isTimestampInRange((n as any)?.editedAt, range)) return true;
    }
  }

  return false;
}

/**
 * Détermine avec une rigueur absolue si un prospect a été modifié/créé/annoté
 * par un opérateur cible durant un intervalle temporel donné.
 */
export function isLeadTouchedByStaffInDateRange(
  lead?: Partial<LeadItem> | null,
  targetStaff?: string | null,
  range?: DateRange | null
): boolean {
  if (!lead) return false;
  if (!range) return isLeadTouchedByStaff(lead, targetStaff);
  if (!targetStaff || targetStaff === 'ALL') return isLeadActiveInDateRange(lead, range);

  const timestamps = getStaffContributionTimestamps(lead, targetStaff);
  if (timestamps.length === 0) return false;

  return timestamps.some(t => isTimestampInRange(t, range));
}

/**
 * RÈGLE D'OR MÉTIER DU FILTRE COMBINÉ (STAFF & DATE) :
 * 
 * 1. Aucun filtre -> true
 * 2. Staff seul (Date = 'ALL') :
 *    "Si je choisit que l'operateur sans date, je doit avoir tout les clients que cet operateur a contribué, de n'importe quel facon et a n'importe quel date."
 *    -> Tous les clients touchés par cet opérateur à n'importe quel moment.
 * 3. Date seule (Staff = 'ALL') :
 *    -> Tous les clients ayant eu une activité durant cette période.
 * 4. Staff ET Date choisis :
 *    "si je fait Ghassen et Aujourd'hui je dois avoir les clients que Ghassen a fait des modification aujourd'hui, si Cette semaine ou n'importe quel date ou intervalle, ca doit etre rigouresemnt concut et implementé."
 *    -> STRICTEMENT les clients que cet opérateur précis a modifiés/créés/annotés durant cet intervalle précis.
 */
export function isLeadMatchingStaffAndDate(
  lead?: Partial<LeadItem> | null,
  filterStaff?: string | null,
  filterDate?: string | null,
  customStartDate?: string | null,
  customEndDate?: string | null,
  refDate: Date = new Date()
): boolean {
  if (!lead) return false;

  const hasStaffFilter = Boolean(filterStaff && filterStaff !== 'ALL');
  const dateRange = getDateFilterRange(filterDate, customStartDate, customEndDate, refDate);
  const hasDateFilter = Boolean(dateRange !== null);

  // 1. Aucun filtre
  if (!hasStaffFilter && !hasDateFilter) {
    return true;
  }

  // 2. Staff seul sans date
  if (hasStaffFilter && !hasDateFilter) {
    return isLeadTouchedByStaff(lead, filterStaff);
  }

  // 3. Date seule sans staff
  if (!hasStaffFilter && hasDateFilter) {
    return isLeadActiveInDateRange(lead, dateRange!);
  }

  // 4. Staff ET Date combinés
  return isLeadTouchedByStaffInDateRange(lead, filterStaff, dateRange);
}
