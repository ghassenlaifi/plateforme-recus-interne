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

