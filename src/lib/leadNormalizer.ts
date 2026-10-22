import { 
  ELIOS_CLASSES, 
  ELIOS_SECTIONS, 
  ELIOS_STATUSES, 
  ELIOS_SOURCES, 
  ELIOS_OFFERS, 
  isClassWithoutSection,
  LeadNote
} from '@/types/crm';
import { extractPhoneData, formatPhone } from '@/lib/phoneUtils';

/**
 * Normalise et assainit une chaîne de caractères (suppression accents, ponctuation, espaces superflus)
 */
export function cleanKey(str: string): string {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Dictionnaire d'alias pour mapper automatiquement les colonnes de n'importe quel fichier Excel ou CSV
 */
export const HEADER_ALIASES: Record<string, string[]> = {
  phone: [
    'telephone', 'telephon', 'tel', 'phone', 'numero', 'num', 'contact', 'mobile',
    'portable', 'gsm', 'numtel', 'numerodetelephone', 'numerotel', 'telephonique'
  ],
  firstName: [
    'prenom', 'firstname', 'first', 'prenomeleve', 'prenomclient', 'prenomprospect'
  ],
  lastName: [
    'nom', 'lastname', 'last', 'nomdefamille', 'nomeleve', 'nomclient', 'nomprospect'
  ],
  fullName: [
    'nomcomplet', 'fullname', 'nometprenom', 'nometprenoms', 'nometprenomseleve',
    'prenometnom', 'eleve', 'prospect', 'client', 'identite', 'nomprenom', 'nom_prenom'
  ],
  grade: [
    'grade', 'classe', 'niveau', 'level', 'annee', 'promotion', 'scolarite', 'classeactuelle'
  ],
  section: [
    'specialite', 'section', 'filiere', 'branche', 'option', 'filiereactuelle', 'serie'
  ],
  status: [
    'statut', 'status', 'etat', 'pipeline', 'phase', 'statutcommercial', 'etatduprospect'
  ],
  offer: [
    'offre', 'pack', 'formule', 'produit', 'offer', 'packchoisi', 'formation'
  ],
  amount: [
    'montant', 'prix', 'amount', 'paye', 'montantpaye', 'versement', 'reglement', 'tarif'
  ],
  source: [
    'source', 'origine', 'canal', 'provenance', 'acquisition', 'leadsource'
  ],
  staff: [
    'staff', 'operateur', 'commercial', 'agent', 'assignea', 'assigne', 'responsable', 'suivipar', 'vendeur'
  ],
  teachers: [
    'enseignant', 'enseignants', 'prof', 'profs', 'professeur', 'professeurs', 'teacher', 'teachers', 'formateur', 'formateurs'
  ],
  familyGroup: [
    'groupefamilial', 'famille', 'family', 'familygroup', 'fratrie', 'parent'
  ],
  notes: [
    'notes', 'note', 'commentaire', 'commentaires', 'remarque', 'remarques', 'historique', 'suivi', 'observation', 'observations'
  ],
  date: [
    'datecreation', 'date', 'createdat', 'dateajout', 'dateentree', 'timestamp'
  ]
};

/**
 * Détecte le champ canonique correspondant à un nom de colonne quelconque
 */
export function matchHeaderField(headerName: string): string | null {
  const cleaned = cleanKey(headerName);
  if (!cleaned) return null;

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(cleaned)) return field;
  }

  // Correspondance par inclusion partielle si non trouvé exactement
  if (cleaned.includes('teleph') || cleaned.includes('phone') || (cleaned.includes('num') && cleaned.includes('tel'))) {
    return 'phone';
  }
  if (cleaned.includes('prenom') || cleaned.includes('first')) return 'firstName';
  if (cleaned.includes('nom') && !cleaned.includes('economie')) return 'lastName';
  if (cleaned.includes('classe') || cleaned.includes('niveau') || cleaned.includes('grade')) return 'grade';
  if (cleaned.includes('section') || cleaned.includes('specialite') || cleaned.includes('filiere')) return 'section';
  if (cleaned.includes('statut') || cleaned.includes('status')) return 'status';
  if (cleaned.includes('prof') || cleaned.includes('enseign')) return 'teachers';
  if (cleaned.includes('note') || cleaned.includes('comment')) return 'notes';
  if (cleaned.includes('source') || cleaned.includes('origine')) return 'source';
  if (cleaned.includes('offre') || cleaned.includes('pack')) return 'offer';

  return null;
}

/**
 * Normalisation stricte du niveau scolaire (Grade)
 */
export function normalizeGrade(gradeRaw: any): string {
  if (!gradeRaw) return '';
  const s = String(gradeRaw).trim();
  const c = cleanKey(s);

  if (c.startsWith('7') || c.includes('7eme') || c.includes('7e')) return '7ème de Base';
  if (c.startsWith('8') || c.includes('8eme') || c.includes('8e')) return '8ème de Base';
  if (c.startsWith('9') || c.includes('9eme') || c.includes('9e')) return '9ème de Base';
  if (c.startsWith('1') || c.includes('1ere') || c.includes('1e')) return '1ère Année';
  if (c.startsWith('2') || c.includes('2eme') || c.includes('2e')) return '2ème Année';
  if (c.startsWith('3') || c.includes('3eme') || c.includes('3e')) return '3ème Année';
  if (c.includes('bac') || c.startsWith('4') || c.includes('terminale')) return 'BAC';

  // Recherche parmi les classes officielles
  const match = ELIOS_CLASSES.find(cls => cleanKey(cls) === c);
  if (match) return match;

  return s;
}

/**
 * Normalisation stricte de la section / spécialité
 */
export function normalizeSection(sectionRaw: any, grade?: string): string {
  // RÈGLE MÉTIER ABSOLUE : Les niveaux 7ème, 8ème, 9ème et 1ère Année n'ont JAMAIS de section
  if (grade && isClassWithoutSection(grade)) {
    return '';
  }

  if (!sectionRaw) return '';
  const s = String(sectionRaw).trim();
  const c = cleanKey(s);

  if (c.includes('math')) return 'Mathématiques';
  if (c.includes('sc') || c.includes('science')) return 'Science';
  if (c.includes('tech')) return 'Technique';
  if (c.includes('info')) return 'Informatique';
  if (c.includes('eco')) return 'Économie';
  if (c.includes('lettre')) return 'Lettres';
  if (c.includes('sport')) return 'Sport';

  const match = ELIOS_SECTIONS.find(sec => cleanKey(sec) === c);
  if (match) return match;

  return s;
}

/**
 * Normalisation stricte du statut commercial
 */
export function normalizeStatus(statusRaw: any, defaultStatus: string = 'Lead'): string {
  if (!statusRaw) return defaultStatus;
  const s = String(statusRaw).trim();
  const c = cleanKey(s);

  if (c === 'lead' || c === 'nouveau' || c === 'new') return 'Lead';
  if (c === 'na' || c === 'nr' || c.includes('pasdereponse')) return 'N/A';
  if (c.includes('potent') || c.includes('rappeler') || c.includes('relancer')) return 'Potential Prospect';
  if (c.includes('approvedprospect') || c.includes('valideprospect')) return 'Approved Prospect';
  if (c === 'approved' || c === 'converti' || c.includes('valide') || c.includes('paye') || c.includes('inscrit')) return 'Approved';
  if (c.includes('reject') || c.includes('refus') || c.includes('annul') || c.includes('noninter')) return 'Rejected';

  const match = ELIOS_STATUSES.find(st => cleanKey(st) === c);
  if (match) return match;

  return defaultStatus;
}

/**
 * Normalisation de la source d'acquisition
 */
export function normalizeSource(sourceRaw: any, defaultSource: string = 'Import Excel'): string {
  if (!sourceRaw) return defaultSource;
  const s = String(sourceRaw).trim();
  const c = cleanKey(s);

  if (c.includes('facebook') || c === 'fb') return 'Facebook';
  if (c.includes('whatsapp') || c === 'wa') return 'Whatsapp';
  if (c.includes('instagram') || c === 'ig') return 'Instagram';
  if (c.includes('exelios') || c.includes('ancien')) return 'Ex-Elios';
  if (c.includes('appel') || c.includes('direct') || c.includes('tel')) return 'Appel Direct';
  if (c.includes('formatic')) return 'Formatic dataBase';

  const match = ELIOS_SOURCES.find(src => cleanKey(src) === c);
  if (match) return match;

  return s || defaultSource;
}

/**
 * Normalisation de l'offre commerciale
 */
export function normalizeOffer(offerRaw: any, defaultOffer: string = 'Zero to Hero'): string {
  if (!offerRaw) return defaultOffer;
  const s = String(offerRaw).trim();
  const c = cleanKey(s);

  if (c.includes('zerotohero') || c.includes('zero') || c.includes('hero')) return 'Zero to Hero';
  if (c.includes('bacintensif') || c.includes('intensif')) return 'Bac Intensif';
  if (c.includes('suiviannuel') || c.includes('annuel')) return 'Suivi Annuel';
  if (c.includes('formationpro') || c.includes('formation')) return 'Formation Pro';

  const match = ELIOS_OFFERS.find(off => cleanKey(off) === c);
  if (match) return match;

  return s || defaultOffer;
}

/**
 * Découpe et normalise une liste d'enseignants assignés (pour SOS Prof)
 */
export function normalizeTeachers(teachersRaw: any): string[] {
  if (!teachersRaw) return [];
  if (Array.isArray(teachersRaw)) {
    return Array.from(new Set(teachersRaw.map(t => String(t).trim()).filter(Boolean)));
  }

  const str = String(teachersRaw).trim();
  if (!str) return [];

  // Tenter de parser si c'est du JSON
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return Array.from(new Set(parsed.map(t => String(t).trim()).filter(Boolean)));
      }
    } catch {}
  }

  // Séparer par virgule, point-virgule, slash ou retour chariot
  const split = str.split(/[,;\/\n\r]+/).map(t => t.trim()).filter(Boolean);
  return Array.from(new Set(split));
}

/**
 * Parse intelligemment les notes (supporte JSON exporté historique ou texte libre)
 */
export function parseImportNotes(notesRaw: any, defaultAuthor: string = 'Système'): LeadNote[] {
  if (!notesRaw) return [];
  const now = new Date();
  const nowIso = now.toISOString();

  // Si déjà un tableau
  if (Array.isArray(notesRaw)) {
    return notesRaw.map((n: any, idx: number) => {
      if (typeof n === 'string') {
        return {
          id: `note-import-${Date.now()}-${idx}`,
          text: n.trim(),
          by: defaultAuthor,
          addedBy: defaultAuthor,
          date: nowIso,
          addedAt: now
        };
      }
      return {
        id: n.id || `note-import-${Date.now()}-${idx}`,
        text: (n.text || n.note || '').trim(),
        by: n.by || n.addedBy || n.authorName || defaultAuthor,
        addedBy: n.addedBy || n.by || n.authorName || defaultAuthor,
        date: n.date || n.timestamp || nowIso,
        addedAt: n.addedAt || (n.createdAt ? new Date(n.createdAt) : now)
      };
    }).filter(n => n.text.length > 0);
  }

  const str = String(notesRaw).trim();
  if (!str) return [];

  // Cas 1 : JSON array string (comme dans EliosData.xlsx ou FormaticData.xlsx)
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any, idx: number) => {
          const txt = (item.text || item.note || '').trim();
          const author = item.authorName || item.by || item.addedBy || defaultAuthor;
          const dt = item.createdAt ? new Date(item.createdAt) : (item.date ? new Date(item.date) : now);
          return {
            id: String(item.id || `note-import-${Date.now()}-${idx}`),
            text: txt || (item.action ? `Action: ${item.action}` : ''),
            by: author,
            addedBy: author,
            date: item.timestamp || dt.toISOString(),
            addedAt: dt
          };
        }).filter(n => n.text.length > 0);
      }
    } catch {}
  }

  // Cas 2 : Texte simple ou multiligne
  const lines = str.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  return lines.map((line, idx) => ({
    id: `note-import-${Date.now()}-${idx}`,
    text: line,
    by: defaultAuthor,
    addedBy: defaultAuthor,
    date: nowIso,
    addedAt: now
  }));
}

export interface StandardizedLeadCandidate {
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  cleanPhone: string;
  isValidPhone: boolean;
  phoneCountry?: string;
  offer: string;
  amount: string;
  source: string;
  grade: string;
  section: string;
  status: string;
  staff: string;
  familyGroup: string;
  assignedTeachers: string[];
  notes: LeadNote[];
  date: Date;
  rawRow: Record<string, any>;
  validationError?: string;
}

export interface NormalizationOptions {
  defaultSource?: string;
  defaultStatus?: string;
  defaultOffer?: string;
  operator?: string;
  crmType?: 'elios' | 'formatic' | 'sos-prof';
}

/**
 * Standardise une ligne de données brute (Excel / CSV) en prospect canonique
 */
export function standardizeImportRow(
  rawRow: Record<string, any>,
  options: NormalizationOptions = {}
): StandardizedLeadCandidate {
  const op = options.operator || 'Système';
  const defaultSource = options.defaultSource || (options.crmType === 'formatic' ? 'Formatic dataBase' : 'Import Excel');
  const defaultStatus = options.defaultStatus || 'Lead';
  const defaultOffer = options.defaultOffer || 'Zero to Hero';

  // 1. Détecter et mapper chaque colonne vers son champ canonique
  const mapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    const field = matchHeaderField(key);
    if (field && mapped[field] === undefined && value !== undefined && value !== null && String(value).trim() !== '') {
      mapped[field] = value;
    }
  }

  // 2. Traitement du téléphone
  const rawPhone = String(mapped.phone || '').trim();
  const phoneData = extractPhoneData(rawPhone);
  const cleanPhone = phoneData.formatted || formatPhone(rawPhone) || rawPhone;
  const isValidPhone = Boolean(phoneData.isValid || phoneData.nationalDigits.length >= 8);

  // 3. Traitement des noms et prénoms
  let fName = String(mapped.firstName || '').trim();
  let lName = String(mapped.lastName || '').trim();
  const fullNameRaw = String(mapped.fullName || '').trim();

  if (!fName && !lName && fullNameRaw) {
    const parts = fullNameRaw.split(/\s+/).filter(Boolean);
    fName = parts[0] || '';
    lName = parts.slice(1).join(' ') || '';
  }

  const computedName = [fName, lName].filter(Boolean).join(' ') || fullNameRaw || 'Prospect sans nom';

  // 4. Traitement du niveau et de la section
  const grade = normalizeGrade(mapped.grade);
  const section = normalizeSection(mapped.section, grade);

  // 5. Statut, Offre, Montant, Source, Staff
  const status = normalizeStatus(mapped.status, defaultStatus);
  const offer = normalizeOffer(mapped.offer, defaultOffer);
  const amount = String(mapped.amount || '').trim();
  const source = normalizeSource(mapped.source, defaultSource);
  const staff = String(mapped.staff || op).trim() || op;
  const familyGroup = String(mapped.familyGroup || '').trim();

  // 6. Enseignants (pour SOS Prof)
  const assignedTeachers = normalizeTeachers(mapped.teachers);

  // 7. Notes
  const notes = parseImportNotes(mapped.notes, op);

  // 8. Date de création
  let creationDate = new Date();
  if (mapped.date) {
    const parsedDate = new Date(mapped.date);
    if (!isNaN(parsedDate.getTime())) {
      creationDate = parsedDate;
    }
  }

  let validationError: string | undefined;
  if (!rawPhone || !cleanPhone) {
    validationError = 'Numéro de téléphone absent';
  } else if (!isValidPhone) {
    validationError = `Numéro de téléphone invalide (${cleanPhone})`;
  }

  return {
    firstName: fName,
    lastName: lName,
    name: computedName,
    phone: cleanPhone,
    cleanPhone,
    isValidPhone,
    phoneCountry: phoneData.countryName,
    offer,
    amount,
    source,
    grade,
    section,
    status,
    staff,
    familyGroup,
    assignedTeachers,
    notes,
    date: creationDate,
    rawRow,
    validationError
  };
}

/**
 * Teste si une valeur ressemble à un numéro de téléphone valide
 */
export function isPhoneLike(val: any): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim();
  if (!s || s.length < 7 || s.length > 25) return false;
  if (/[a-zA-Z]{3,}/.test(s)) return false;
  const digits = s.replace(/\D/g, '');
  if (digits.length === 8 && /^[2-9]/.test(digits)) return true;
  if (digits.length >= 8 && digits.length <= 15) {
    const data = extractPhoneData(s);
    return Boolean(data.isValid || data.nationalDigits.length >= 8);
  }
  return false;
}

/**
 * Teste si une valeur ressemble à un niveau scolaire (Grade)
 */
export function isGradeLike(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim();
  const c = cleanKey(s);
  if (!c) return false;
  if (/^(7|8|9)(eme|e)?(debase|base)?$/.test(c)) return true;
  if (/^(1|2|3)(ere|eme|e)?(annee)?$/.test(c)) return true;
  if (c.includes('bac') || c.includes('terminale') || c.includes('secondaire') || c.includes('primaire') || c.includes('college')) return true;
  return ELIOS_CLASSES.some(cls => cleanKey(cls) === c);
}

/**
 * Teste si une valeur ressemble à une section / spécialité
 */
export function isSectionLike(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim();
  const c = cleanKey(s);
  if (!c) return false;
  if (c.includes('math') || c.includes('science') || c.includes('technique') || c.includes('info') || c.includes('eco') || c.includes('lettre') || c.includes('sport')) return true;
  return ELIOS_SECTIONS.some(sec => cleanKey(sec) === c);
}

/**
 * Teste si une valeur ressemble à un statut commercial
 */
export function isStatusLike(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim();
  const c = cleanKey(s);
  if (!c) return false;
  if (['lead', 'na', 'nr', 'nouveau', 'new', 'approved', 'converti', 'rejected', 'refus'].includes(c)) return true;
  if (c.includes('potent') || c.includes('rappel') || c.includes('relanc') || c.includes('valid') || c.includes('prospect')) return true;
  return ELIOS_STATUSES.some(st => cleanKey(st) === c);
}

/**
 * Teste si une valeur ressemble à une offre commerciale
 */
export function isOfferLike(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim();
  const c = cleanKey(s);
  if (!c) return false;
  if (c.includes('zero') || c.includes('hero') || c.includes('intensif') || c.includes('annuel') || c.includes('pack') || c.includes('formation')) return true;
  return ELIOS_OFFERS.some(off => cleanKey(off) === c);
}

/**
 * Teste si une valeur ressemble à une source d'acquisition
 */
export function isSourceLike(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim();
  const c = cleanKey(s);
  if (!c) return false;
  if (c.includes('facebook') || c === 'fb' || c.includes('whatsapp') || c === 'wa' || c.includes('instagram') || c === 'ig' || c.includes('tiktok') || c.includes('exelios') || c.includes('formatic') || c.includes('appel') || c.includes('site')) return true;
  return ELIOS_SOURCES.some(src => cleanKey(src) === c);
}

/**
 * Teste si une valeur ressemble à un montant financier
 */
export function isAmountLike(val: any): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim();
  if (!s) return false;
  if (isPhoneLike(val)) return false;
  const cleanNum = s.replace(/dt|tnd|dinars?|\s/gi, '').replace(',', '.');
  const num = parseFloat(cleanNum);
  if (!isNaN(num) && num > 0 && num < 100000 && /^\d+(\.\d+)?$/.test(cleanNum)) {
    return true;
  }
  return false;
}

/**
 * Teste si une valeur ressemble à une date
 */
export function isDateLike(val: any): boolean {
  if (!val) return false;
  if (val instanceof Date && !isNaN(val.getTime())) return true;
  const s = String(val).trim();
  if (isPhoneLike(s)) return false;
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(s)) return true;
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(s)) return true;
  const parsed = Date.parse(s);
  return !isNaN(parsed) && parsed > 946684800000;
}

/**
 * Teste si une valeur ressemble à un nom de personne
 */
export function isPersonNameLike(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim();
  if (s.length < 2 || s.length > 50) return false;
  if (isPhoneLike(s) || isGradeLike(s) || isSectionLike(s) || isStatusLike(s) || isOfferLike(s) || isSourceLike(s) || isAmountLike(s) || isDateLike(s)) {
    return false;
  }
  if (!/[a-zA-Z\u0600-\u06FF]/.test(s)) return false;
  if (s.includes('@') || s.includes('http') || /\d{3,}/.test(s)) return false;
  return true;
}

/**
 * Teste si une valeur ressemble à une note / commentaire libre
 */
export function isNoteLike(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim();
  if (s.length > 30) return true;
  if (s.startsWith('[') && s.endsWith(']')) return true;
  if (s.includes('\n') || s.includes(';') || s.includes(':')) return true;
  return false;
}

export const FIELD_HUMAN_LABELS: Record<string, string> = {
  phone: 'Téléphone',
  firstName: 'Prénom',
  lastName: 'Nom',
  fullName: 'Nom complet',
  grade: 'Niveau / Classe',
  section: 'Section',
  status: 'Statut',
  offer: 'Offre',
  amount: 'Montant',
  source: 'Source',
  staff: 'Opérateur',
  teachers: 'Enseignants',
  familyGroup: 'Groupe familial',
  notes: 'Notes / Remarques',
  date: 'Date de création'
};

export interface InferredSheetResult {
  hasHeader: boolean;
  columnMapping: Record<number, string>;
  columnLabels: Record<number, string>;
  candidates: StandardizedLeadCandidate[];
  totalDataRows: number;
  detectedFields: string[];
}

/**
 * MOTEUR D'INFÉRENCE SÉMANTIQUE DE COLONNES (HEURISTIC COLUMN CLASSIFIER)
 * Identifie et injecte les prospects de n'importe quel fichier Excel/CSV
 * MÊME SI LES NOMS DE COLONNES SONT ABSENTS, TRONQUÉS OU ANONYMES.
 */
export function inferColumnsAndStandardizeRows(
  inputData: any[][] | Record<string, any>[],
  options: NormalizationOptions = {}
): InferredSheetResult {
  if (!inputData || inputData.length === 0) {
    return {
      hasHeader: false,
      columnMapping: {},
      columnLabels: {},
      candidates: [],
      totalDataRows: 0,
      detectedFields: []
    };
  }

  // Conversion universelle en matrice 2D
  let matrix: any[][] = [];
  let detectedObjectKeys: string[] | null = null;

  if (Array.isArray(inputData[0])) {
    matrix = (inputData as any[][]).filter(row => 
      Array.isArray(row) && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')
    );
  } else {
    // Cas tableau d'objets (xlsx sheet_to_json par défaut)
    const objects = inputData as Record<string, any>[];
    const keys = Array.from(new Set(objects.flatMap(obj => Object.keys(obj))));
    detectedObjectKeys = keys;
    
    // Vérifier si les clés sont des en-têtes réels ou des clés artificielles (__EMPTY, A, B, Col1...)
    const isSyntheticKeys = keys.every(k => 
      !k || k.startsWith('__EMPTY') || /^col(umn)?\s*\d+$/i.test(k) || /^[A-Z]{1,2}$/.test(k)
    );

    if (isSyntheticKeys) {
      matrix = objects.map(obj => keys.map(k => obj[k]));
    } else {
      // Clés réelles considérées comme la ligne 0 (en-têtes)
      matrix = [keys, ...objects.map(obj => keys.map(k => obj[k]))];
    }
  }

  if (matrix.length === 0) {
    return {
      hasHeader: false,
      columnMapping: {},
      columnLabels: {},
      candidates: [],
      totalDataRows: 0,
      detectedFields: []
    };
  }

  // 1. DÉTECTION SÉMANTIQUE : LA LIGNE 0 EST-ELLE UN EN-TÊTE OU DÉJÀ UNE DONNÉE ?
  const firstRow = matrix[0] || [];
  let hasHeader = false;
  const initialHeaderMap: Record<number, string> = {};

  let headerMatchCount = 0;
  let phoneInFirstRow = false;

  for (let c = 0; c < firstRow.length; c++) {
    const val = firstRow[c];
    if (isPhoneLike(val)) {
      phoneInFirstRow = true;
    }
    const matched = matchHeaderField(String(val || ''));
    if (matched) {
      headerMatchCount++;
      initialHeaderMap[c] = matched;
    }
  }

  // Règle formelle : Un en-tête ne contient JAMAIS de numéro de téléphone
  // et doit matcher au moins 1 mot-clé d'en-tête explicite
  if (!phoneInFirstRow && headerMatchCount >= 1) {
    if (headerMatchCount >= 2 || firstRow.length <= 3) {
      hasHeader = true;
    } else {
      // Vérifier si la ligne 1 a des numéros de téléphone pour confirmer
      const secondRow = matrix[1];
      if (secondRow && secondRow.some(cell => isPhoneLike(cell))) {
        hasHeader = true;
      }
    }
  }

  const headerRow = hasHeader ? matrix[0] : null;
  const dataRows = hasHeader ? matrix.slice(1) : matrix;

  const maxCols = Math.max(...matrix.map(r => r.length), 0);
  const columnMapping: Record<number, string> = {};
  const assignedFields = new Set<string>();

  // Si en-tête détecté, mapper d'abord les correspondances directes
  if (hasHeader && headerRow) {
    for (let c = 0; c < maxCols; c++) {
      const explicit = matchHeaderField(String(headerRow[c] || ''));
      if (explicit && !assignedFields.has(explicit)) {
        columnMapping[c] = explicit;
        assignedFields.add(explicit);
      }
    }
  }

  // 2. INFÉRENCE PAR ANALYSE STATISTIQUE DU CONTENU DES COLONNES
  // Pour chaque colonne non assignée, tester le profil probabiliste des valeurs
  const colScores: Record<number, Record<string, number>> = {};

  for (let c = 0; c < maxCols; c++) {
    colScores[c] = {};
    const samples = dataRows
      .map(r => r[c])
      .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
      .slice(0, 60);

    if (samples.length === 0) continue;

    const count = samples.length;
    colScores[c].phone = samples.filter(isPhoneLike).length / count;
    colScores[c].grade = samples.filter(isGradeLike).length / count;
    colScores[c].section = samples.filter(isSectionLike).length / count;
    colScores[c].status = samples.filter(isStatusLike).length / count;
    colScores[c].offer = samples.filter(isOfferLike).length / count;
    colScores[c].source = samples.filter(isSourceLike).length / count;
    colScores[c].amount = samples.filter(isAmountLike).length / count;
    colScores[c].date = samples.filter(isDateLike).length / count;
    colScores[c].notes = samples.filter(isNoteLike).length / count;
    colScores[c].personName = samples.filter(isPersonNameLike).length / count;
  }

  // Fonction utilitaire pour trouver la meilleure colonne pour un champ donné
  const findBestCol = (field: string, minThreshold: number): number | null => {
    let bestCol: number | null = null;
    let bestScore = minThreshold;
    for (let c = 0; c < maxCols; c++) {
      if (columnMapping[c]) continue; // déjà assignée
      const score = colScores[c]?.[field] || 0;
      if (score > bestScore) {
        bestScore = score;
        bestCol = c;
      }
    }
    return bestCol;
  };

  // Attribution prioritaire par spécificité décroissante
  // 1. TÉLÉPHONE (Colonne pivot absolue)
  if (!assignedFields.has('phone')) {
    const col = findBestCol('phone', 0.35);
    if (col !== null) {
      columnMapping[col] = 'phone';
      assignedFields.add('phone');
    }
  }

  // 2. NIVEAU / CLASSE
  if (!assignedFields.has('grade')) {
    const col = findBestCol('grade', 0.25);
    if (col !== null) {
      columnMapping[col] = 'grade';
      assignedFields.add('grade');
    }
  }

  // 3. SECTION / SPÉCIALITÉ
  if (!assignedFields.has('section')) {
    const col = findBestCol('section', 0.25);
    if (col !== null) {
      columnMapping[col] = 'section';
      assignedFields.add('section');
    }
  }

  // 4. STATUT COMMERCIAL
  if (!assignedFields.has('status')) {
    const col = findBestCol('status', 0.25);
    if (col !== null) {
      columnMapping[col] = 'status';
      assignedFields.add('status');
    }
  }

  // 5. OFFRE COMMERCIALE
  if (!assignedFields.has('offer')) {
    const col = findBestCol('offer', 0.2);
    if (col !== null) {
      columnMapping[col] = 'offer';
      assignedFields.add('offer');
    }
  }

  // 6. SOURCE D'ACQUISITION
  if (!assignedFields.has('source')) {
    const col = findBestCol('source', 0.2);
    if (col !== null) {
      columnMapping[col] = 'source';
      assignedFields.add('source');
    }
  }

  // 7. MONTANT
  if (!assignedFields.has('amount')) {
    const col = findBestCol('amount', 0.35);
    if (col !== null) {
      columnMapping[col] = 'amount';
      assignedFields.add('amount');
    }
  }

  // 8. DATE
  if (!assignedFields.has('date')) {
    const col = findBestCol('date', 0.35);
    if (col !== null) {
      columnMapping[col] = 'date';
      assignedFields.add('date');
    }
  }

  // 9. NOTES / REMARQUES (Texte long)
  if (!assignedFields.has('notes')) {
    const col = findBestCol('notes', 0.3);
    if (col !== null) {
      columnMapping[col] = 'notes';
      assignedFields.add('notes');
    }
  }

  // 10. NOMS ET PRÉNOMS (Colonnes textuelles restantes)
  const remainingTextCols: number[] = [];
  for (let c = 0; c < maxCols; c++) {
    if (!columnMapping[c]) {
      const pScore = colScores[c]?.personName || 0;
      if (pScore > 0.3) {
        remainingTextCols.push(c);
      }
    }
  }

  if (!assignedFields.has('fullName') && !assignedFields.has('firstName') && !assignedFields.has('lastName')) {
    if (remainingTextCols.length >= 2) {
      // 2 colonnes de texte : Prénom puis Nom
      columnMapping[remainingTextCols[0]] = 'firstName';
      columnMapping[remainingTextCols[1]] = 'lastName';
      assignedFields.add('firstName');
      assignedFields.add('lastName');
    } else if (remainingTextCols.length === 1) {
      // 1 seule colonne de texte : Nom complet
      columnMapping[remainingTextCols[0]] = 'fullName';
      assignedFields.add('fullName');
    }
  } else if (!assignedFields.has('fullName') && assignedFields.has('firstName') && !assignedFields.has('lastName')) {
    if (remainingTextCols.length >= 1) {
      columnMapping[remainingTextCols[0]] = 'lastName';
      assignedFields.add('lastName');
    }
  }

  // Tout résidu textuel non assigné est consigné en notes complémentaires
  for (let c = 0; c < maxCols; c++) {
    if (!columnMapping[c]) {
      const hasAnyContent = dataRows.some(r => r[c] && String(r[c]).trim().length > 0);
      if (hasAnyContent) {
        if (!assignedFields.has('notes')) {
          columnMapping[c] = 'notes';
          assignedFields.add('notes');
        } else if (!assignedFields.has('familyGroup')) {
          columnMapping[c] = 'familyGroup';
          assignedFields.add('familyGroup');
        }
      }
    }
  }

  // Étiquettes humaines pour chaque colonne détectée
  const columnLabels: Record<number, string> = {};
  for (let c = 0; c < maxCols; c++) {
    const field = columnMapping[c];
    if (field) {
      columnLabels[c] = FIELD_HUMAN_LABELS[field] || field;
    } else {
      columnLabels[c] = `Colonne ${c + 1} (ignorée)`;
    }
  }

  // 3. TRANSFORMATION ET NORMALISATION DE TOUTES LES LIGNES DE DONNÉES
  const candidates: StandardizedLeadCandidate[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rowObj: Record<string, any> = {};

    for (let c = 0; c < maxCols; c++) {
      const field = columnMapping[c];
      const val = row[c];
      if (field && val !== undefined && val !== null && String(val).trim() !== '') {
        // Si plusieurs colonnes sont dirigées vers notes, les concaténer
        if (field === 'notes' && rowObj.notes) {
          rowObj.notes = `${rowObj.notes} | ${val}`;
        } else {
          rowObj[field] = val;
        }
      }
    }

    const cand = standardizeImportRow(rowObj, options);
    candidates.push(cand);
  }

  return {
    hasHeader,
    columnMapping,
    columnLabels,
    candidates,
    totalDataRows: dataRows.length,
    detectedFields: Array.from(assignedFields)
  };
}

