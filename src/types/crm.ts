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

export const RAPPELS_ELIGIBLE_STATUSES = [
  'N/A',
  'Potential Prospect',
  'Approved Prospect'
] as const;

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
 * Vérifie si une chaîne représente un opérateur humain valide
 * (exclut 'Système', 'Non assigné', les chaînes vides et tirets).
 */
export function isValidOperatorName(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return false;
  const clean = name.trim().toLowerCase();
  if (!clean || clean === '-' || clean === '—') return false;
  if (clean === 'système' || clean === 'systeme' || clean === 'system' || clean === 'bot') return false;
  if (clean === 'non assigné' || clean === 'non assigne' || clean === 'unassigned') return false;
  return true;
}

/**
 * Résout de façon déterministe, chronologique et robuste le nom de l'opérateur
 * ayant effectué la TOUTE DERNIÈRE modification ou interaction sur la fiche du prospect.
 * 
 * Règle d'or de haute intégrité :
 * 1. Collecte l'ensemble des interactions datées de chaque opérateur humain (modifierLogs & notes).
 * 2. Détermine l'opérateur associé au timestamp le plus récent (Maximal Time Event).
 * 3. En l'absence d'interactions horodatées, repli déterministe sur modifierLogs récents,
 *    notes récentes, lastModifiedBy explicite, staff initial, ou 'Non assigné'.
 */
export function getLeadLastModifier(lead?: Partial<LeadItem> | null): string {
  if (!lead) return 'Non assigné';

  interface InteractionCandidate {
    operator: string;
    time: number;
  }

  const candidates: InteractionCandidate[] = [];

  // 1. Scanner les logs de modifications structurés
  if (Array.isArray(lead.modifierLogs)) {
    for (const log of lead.modifierLogs) {
      if (!log || !isValidOperatorName(log.operator)) continue;
      const t = log.at ? new Date(log.at).getTime() : NaN;
      if (!isNaN(t)) {
        candidates.push({
          operator: log.operator.trim(),
          time: t,
        });
      }
    }
  }

  // 2. Scanner toutes les notes
  if (Array.isArray(lead.notes)) {
    for (const n of lead.notes) {
      if (!n) continue;
      const author = (n as any).editedBy || n.addedBy || n.by;
      if (!isValidOperatorName(author)) continue;
      const t = ((n as any).editedAt || n.addedAt || n.date) 
        ? new Date((n as any).editedAt || n.addedAt || n.date).getTime() 
        : NaN;
      if (!isNaN(t)) {
        candidates.push({
          operator: author.trim(),
          time: t,
        });
      }
    }
  }

  // Si des interactions dynamiques existent avec timestamps valides :
  // l'opérateur avec le timestamp le plus élevé (le plus récent) l'emporte STRICTEMENT.
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.time - a.time);
    return candidates[0].operator;
  }

  // 3. Fallbacks sans timestamp ou sans interactions dynamiques
  // a) Dernier log de modification
  if (Array.isArray(lead.modifierLogs) && lead.modifierLogs.length > 0) {
    for (let i = lead.modifierLogs.length - 1; i >= 0; i--) {
      const op = lead.modifierLogs[i]?.operator;
      if (isValidOperatorName(op)) return op.trim();
    }
  }

  // b) Note la plus récente
  if (Array.isArray(lead.notes) && lead.notes.length > 0) {
    for (const n of lead.notes) {
      const op = (n as any)?.editedBy || n?.addedBy || n?.by;
      if (isValidOperatorName(op)) return op.trim();
    }
  }

  // c) lastModifiedBy explicite
  if (isValidOperatorName(lead.lastModifiedBy)) {
    return lead.lastModifiedBy!.trim();
  }

  // d) staff créateur / premier manipulateur
  if (isValidOperatorName(lead.staff)) {
    return lead.staff!.trim();
  }

  return (lead.lastModifiedBy || lead.staff || 'Non assigné').trim();
}

/**
 * Récupère le timestamp précis correspondant à la dernière modification ou interaction
 * effectuée par un opérateur sur la fiche prospect.
 */
export function getLeadLastModifiedDate(lead?: Partial<LeadItem> | null): Date | null {
  if (!lead) return null;

  let maxTime = -1;

  if (Array.isArray(lead.modifierLogs)) {
    for (const log of lead.modifierLogs) {
      if (!log || !isValidOperatorName(log.operator)) continue;
      const t = log.at ? new Date(log.at).getTime() : NaN;
      if (!isNaN(t) && t > maxTime) maxTime = t;
    }
  }

  if (Array.isArray(lead.notes)) {
    for (const n of lead.notes) {
      if (!n) continue;
      const author = (n as any).editedBy || n.addedBy || n.by;
      if (!isValidOperatorName(author)) continue;
      const t = ((n as any).editedAt || n.addedAt || n.date) 
        ? new Date((n as any).editedAt || n.addedAt || n.date).getTime() 
        : NaN;
      if (!isNaN(t) && t > maxTime) maxTime = t;
    }
  }

  if (maxTime > 0) return new Date(maxTime);
  if (lead.updatedAt) {
    const d = new Date(lead.updatedAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (lead.date) {
    const d = new Date(lead.date);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
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
 * Détermine avec une rigueur absolue si un prospect a été CRÉÉ dans l'intervalle temporel spécifié.
 * Règle d'or : se base EXCLUSIVEMENT sur la date de création de la fiche (createdAt ou date).
 */
export function isLeadCreatedInDateRange(
  lead?: Partial<LeadItem> | null,
  range?: DateRange | null
): boolean {
  if (!lead || !range) return true;

  if (isTimestampInRange(lead.createdAt, range)) return true;
  if (isTimestampInRange(lead.date, range)) return true;

  return false;
}

/**
 * Détermine avec une rigueur absolue si un prospect a fait l'objet d'au moins une VRAIE MODIFICATION
 * par un opérateur cible dans l'intervalle temporel donné.
 * 
 * RÈGLE STRICTE (Intégrité & Audit Métier) :
 * - La simple création d'une fiche (action: 'create', createdAt/date initiale) NE DOIT PAS être considérée comme une modification.
 * - Sont considérées comme modifications valides à cette date par cet opérateur :
 *   1. Entrée dans modifierLogs avec operator = targetStaff, at dans range, et action !== 'create'
 *      (actions : update, add_note, edit_note, delete_note, migrate, auto_approval_receipt, etc.).
 *   2. Ajout ou édition d'une note par targetStaff dans range (excluant la note auto initiale de création).
 *   3. lead.lastModifiedBy = targetStaff avec lead.updatedAt dans range, sous réserve que cette mise à jour
 *      soit une modification réelle (postérieure à la création d'au moins 3 secondes ou effectuée par un opérateur différent du créateur).
 */
export function isLeadModifiedByStaffInDateRange(
  lead?: Partial<LeadItem> | null,
  targetStaff?: string | null,
  range?: DateRange | null
): boolean {
  if (!lead || !range) return false;
  if (!targetStaff || targetStaff === 'ALL') return false;

  const target = targetStaff.trim().toLowerCase();
  if (!target || target === 'all') return false;

  let creationTime = lead.createdAt 
    ? new Date(lead.createdAt).getTime() 
    : (lead.date ? new Date(lead.date).getTime() : NaN);

  if (isNaN(creationTime) && Array.isArray(lead.modifierLogs)) {
    const createLog = lead.modifierLogs.find((l: any) => (l?.action || '').toLowerCase() === 'create');
    if (createLog?.at) {
      creationTime = new Date(createLog.at).getTime();
    }
  }

  const isCreator = (lead.staff || '').trim().toLowerCase() === target;
  // Fenêtre de création initiale (5 minutes = 300 000 ms) :
  // Toute action (save, update automatique du formulaire) effectuée par le créateur dans ce créneau fait partie de la création du prospect.
  // Elle ne constitue pas une modification commerciale ultérieure.
  const CREATION_SESSION_WINDOW_MS = 300000;

  // 1. Recherche dans modifierLogs (toute action explicite de modification)
  if (Array.isArray(lead.modifierLogs)) {
    for (const log of lead.modifierLogs) {
      if (!log || !log.operator) continue;
      const op = log.operator.trim().toLowerCase();
      if (op === target) {
        const action = (log.action || '').trim().toLowerCase();
        // Exclusion impérative de l'action de création initiale
        if (action === 'create') continue;

        const logTime = new Date(log.at).getTime();
        // Si l'opérateur est le créateur de la fiche, tout log survenu durant la session de création initiale (< 5 min)
        // fait partie de la création du prospect et ne constitue pas une modification ultérieure.
        if (isCreator && !isNaN(creationTime) && !isNaN(logTime) && (logTime - creationTime) <= CREATION_SESSION_WINDOW_MS) {
          continue;
        }

        if (isTimestampInRange(log.at, range)) {
          return true;
        }
      }
    }
  }

  // 2. Recherche dans les notes ajoutées ou modifiées par cet opérateur dans l'intervalle
  if (Array.isArray(lead.notes)) {
    for (const n of lead.notes) {
      if (!n) continue;
      const author = (n.by || n.addedBy || '').trim().toLowerCase();
      const editor = ((n as any).editedBy || '').trim().toLowerCase();

      // Note éditée par cet opérateur dans l'intervalle
      if (editor === target && isTimestampInRange((n as any).editedAt, range)) {
        return true;
      }

      // Note rédigée par cet opérateur dans l'intervalle
      if (author === target) {
        const noteTime = n.addedAt ? new Date(n.addedAt).getTime() : (n.date ? new Date(n.date).getTime() : NaN);
        // Exclure toute note rédigée à la création par le créateur (< 5 min)
        if (isCreator && !isNaN(creationTime) && !isNaN(noteTime) && (noteTime - creationTime) <= CREATION_SESSION_WINDOW_MS) {
          continue;
        }
        const isNotAutoCreationNote = !n.text?.toLowerCase().includes('nouveau prospect formatic créé') && !n.text?.toLowerCase().includes('nouveau prospect');

        if (isTimestampInRange(n.addedAt || n.date, range) && isNotAutoCreationNote) {
          return true;
        }
      }
    }
  }

  // 3. Dernier modificateur officiel (lead.lastModifiedBy & lead.updatedAt)
  const lastMod = (lead.lastModifiedBy || '').trim().toLowerCase();
  if (lastMod === target && isTimestampInRange(lead.updatedAt, range)) {
    const updateTime = lead.updatedAt ? new Date(lead.updatedAt).getTime() : NaN;
    // Pour le créateur, la mise à jour doit être postérieure d'au moins 5 minutes à la création
    if (!isCreator || (!isNaN(creationTime) && !isNaN(updateTime) && (updateTime - creationTime) > CREATION_SESSION_WINDOW_MS)) {
      return true;
    }
  }

  return false;
}

/**
 * Détermine si un prospect a eu une activité quelconque (création, modification, note, log)
 * dans l'intervalle temporel spécifié (conservé pour compatibilité).
 */
export function isLeadActiveInDateRange(
  lead?: Partial<LeadItem> | null,
  range?: DateRange | null
): boolean {
  if (!lead || !range) return true;

  if (isTimestampInRange(lead.updatedAt, range)) return true;
  if (isTimestampInRange(lead.date, range)) return true;
  if (isTimestampInRange(lead.createdAt, range)) return true;

  if (Array.isArray(lead.modifierLogs)) {
    for (const log of lead.modifierLogs) {
      if (isTimestampInRange(log?.at, range)) return true;
    }
  }

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
 * Détermine si un prospect a été modifié/créé/annoté par un opérateur cible dans l'intervalle temporel.
 */
export function isLeadTouchedByStaffInDateRange(
  lead?: Partial<LeadItem> | null,
  targetStaff?: string | null,
  range?: DateRange | null
): boolean {
  if (!lead) return false;
  if (!range) return isLeadTouchedByStaff(lead, targetStaff);
  if (!targetStaff || targetStaff === 'ALL') return isLeadCreatedInDateRange(lead, range);

  return isLeadModifiedByStaffInDateRange(lead, targetStaff, range);
}

/**
 * RÈGLE D'OR MÉTIER DU FILTRE (STAFF & DATE) :
 * 
 * 1. Aucun filtre (Staff = 'ALL', Date = 'ALL') :
 *    -> true (tous les prospects).
 * 
 * 2. Staff seul (Date = 'ALL') :
 *    "Si je choisit que l'operateur sans date, je doit avoir tout les clients que cet operateur a contribué, de n'importe quel facon et a n'importe quel date."
 *    -> Tous les clients touchés par cet opérateur à n'importe quel moment (créateur, modificateur, notes, etc.).
 * 
 * 3. Date seule (Staff = 'ALL') :
 *    "si on choisie dans les filtres seulement le filtre Date : le CRM devrait afficher seulement les fiches crées a cette date ou intervalle de temps exacte."
 *    -> STRICTEMENT les prospects créés à cette date ou dans cet intervalle exact.
 * 
 * 4. Staff ET Date choisis :
 *    "Si on applique les filtres Date+ Staff : il doit pas affichés les fiches crees mais ceux qui ont eu n'importe quelle type de modification a cette date ou intervalle de temps exacte par operateur choisit.
 *     Ici on affiche que celui qui a fait la modification a cette date, si plusieurs ont fait des modifications a cette date donc on accepte qu'il soit partagé et visible chez eux tous."
 *    -> STRICTEMENT les prospects qui ont subi au moins une MODIFICATION par cet opérateur dans cet intervalle exact.
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

  // 2. Staff seul sans date : tous les clients où l'opérateur est intervenu
  if (hasStaffFilter && !hasDateFilter) {
    return isLeadTouchedByStaff(lead, filterStaff);
  }

  // 3. Date seule sans staff : UNIQUEMENT les fiches CRÉÉES à cette date ou dans cet intervalle
  if (!hasStaffFilter && hasDateFilter) {
    return isLeadCreatedInDateRange(lead, dateRange!);
  }

  // 4. Staff ET Date combinés : UNIQUEMENT les fiches MODIFIÉES par cet opérateur à cette date
  return isLeadModifiedByStaffInDateRange(lead, filterStaff, dateRange);
}

