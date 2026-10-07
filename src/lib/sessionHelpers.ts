import { Session } from '@/types/session';
import { formatPhone as formatPhoneUtil, extractPhoneDigits, normalizePhoneForUrl } from '@/lib/phoneUtils';

export const COUNTRY_CODE = '216';

/**
 * Niveaux et Classes officiels normalisés (strictement identiques au CRM Elios / Formatic)
 */
export const LEVELS = [
  '7ème de Base',
  '8ème de Base',
  '9ème de Base',
  '1ère Année',
  '2ème Année',
  '3ème Année',
  'BAC',
];

/**
 * Sections et Spécialités officielles normalisées (strictement identiques au CRM Elios / Formatic)
 */
export const SECTIONS = [
  'Sans section',
  'Science',
  'Mathématiques',
  'Technique',
  'Informatique',
  'Économie',
  'Lettres',
  'Sport',
];

export const SUBJECTS = [
  'Mathématiques',
  'Informatique',
  'Sciences physiques',
  'Sciences de la Vie et de la Terre',
  'Mécanique',
  'Électrique',
  'Français',
  'Anglais',
  'Arabe',
  'Économie',
  'Gestion',
  'Philosophie',
  'Histoire-Géographie',
  'Italien',
  'Allemand',
  'Espagnol',
];

// ============================================================================
// CONTRÔLE ET NORMALISATION TÉLÉPHONIQUE (TUNISIE & INTERNATIONAL)
// ============================================================================

/**
 * Nettoie la saisie utilisateur et applique le masque en temps réel.
 * En Tunisie, les numéros comptent exactement 8 chiffres (mobiles: 2X, 5X, 9X, 4X; fixes: 7X, 3X).
 * Empêche physiquement de saisir plus de 8 chiffres pour un numéro local
 * et formate automatiquement au format 'XX XXX XXX' ou '+216 XX XXX XXX'.
 */
export function formatPhoneInput(value: string): string {
  return formatPhoneUtil(value);
}

/**
 * Valide rigoureusement le numéro de téléphone.
 * Règles :
 * - Si vide et non requis => valide.
 * - Si tunisien (8 chiffres ou indicatif 216) => doit compter exactement 8 chiffres
 *   et commencer par un préfixe valide en Tunisie (2, 3, 4, 5, 7, 9).
 * - Les numéros fantaisistes (ex: 923300000000, 123456, 01234567) sont rejetés.
 */
export function validatePhone(
  raw?: string | null,
  required: boolean = false
): { isValid: boolean; error?: string } {
  if (!raw || !raw.trim()) {
    if (required) {
      return { isValid: false, error: 'Le numéro de téléphone est obligatoire.' };
    }
    return { isValid: true };
  }

  const str = raw.trim();
  const digits = extractPhoneDigits(str);

  if (digits.length === 0) {
    return { isValid: false, error: 'Veuillez saisir un numéro valide.' };
  }

  if (digits.length !== 8) {
    return {
      isValid: false,
      error: `Numéro tunisien invalide : 8 chiffres requis (${digits.length}/8 saisis).`,
    };
  }

  const firstDigit = digits.charAt(0);
  const validPrefixes = ['2', '3', '4', '5', '7', '9'];
  if (!validPrefixes.includes(firstDigit)) {
    return {
      isValid: false,
      error: 'Préfixe opérateur invalide en Tunisie. Doit débuter par 2, 4, 5, 9 (mobile) ou 3, 7 (fixe).',
    };
  }

  return { isValid: true };
}

/**
 * Normalise un numéro de téléphone pour WhatsApp (ex: 22 987 775 -> 21622987775).
 * Renvoie une chaîne propre sans '+' ni espaces, prête pour les liens 'wa.me/'.
 */
export function normalizePhone(raw?: string | null): string {
  return normalizePhoneForUrl(raw);
}

/**
 * Formate un numéro de téléphone pour un affichage lisible dans l'interface (ex: +216 22 987 775)
 */
export function formatPhone(raw?: string | null): string {
  return formatPhoneUtil(raw);
}

// ============================================================================
// COUCHE ANTI-CORRUPTION & ADAPTER : NORMALISATION PÉDAGOGIQUE (EXCEL <-> BDD)
// ============================================================================

/**
 * Dictionnaire d'alias pour les niveaux scolaires (Grades).
 * Tolérant à la casse, aux abréviations et aux accents.
 */
export const GRADE_ALIASES: Record<string, string> = {
  bac: 'BAC',
  baccalaureat: 'BAC',
  baccalauréat: 'BAC',
  terminale: 'BAC',
  '4eme': 'BAC',
  '4ème': 'BAC',
  '3eme': '3ème Année',
  '3ème': '3ème Année',
  '3e': '3ème Année',
  '3': '3ème Année',
  '3e secondaire': '3ème Année',
  '2eme': '2ème Année',
  '2ème': '2ème Année',
  '2e': '2ème Année',
  '2': '2ème Année',
  '2e secondaire': '2ème Année',
  '1er': '1ère Année',
  '1ere': '1ère Année',
  '1ère': '1ère Année',
  '1re': '1ère Année',
  '1': '1ère Année',
  '1re secondaire': '1ère Année',
  '9eme': '9ème de Base',
  '9ème': '9ème de Base',
  '9e': '9ème de Base',
  '9': '9ème de Base',
  '9e annee': '9ème de Base',
  '9e année': '9ème de Base',
  '8eme': '8ème de Base',
  '8ème': '8ème de Base',
  '8e': '8ème de Base',
  '8': '8ème de Base',
  '8e annee': '8ème de Base',
  '8e année': '8ème de Base',
  '7eme': '7ème de Base',
  '7ème': '7ème de Base',
  '7e': '7ème de Base',
  '7': '7ème de Base',
  '7e annee': '7ème de Base',
  '7e année': '7ème de Base',
};

/**
 * Dictionnaire d'alias pour les spécialités / sections (normalisé CRM).
 */
export const SPEC_ALIASES: Record<string, string> = {
  tech: 'Technique',
  technique: 'Technique',
  techniques: 'Technique',
  'sc. tech': 'Technique',
  'sciences techniques': 'Technique',
  math: 'Mathématiques',
  maths: 'Mathématiques',
  mathematiques: 'Mathématiques',
  mathématiques: 'Mathématiques',
  info: 'Informatique',
  informatique: 'Informatique',
  'sc. info': 'Informatique',
  eco: 'Économie',
  éco: 'Économie',
  economie: 'Économie',
  économie: 'Économie',
  'eco gestion': 'Économie',
  'économie et gestion': 'Économie',
  sci: 'Science',
  science: 'Science',
  sciences: 'Science',
  'sciences expérimentales': 'Science',
  'sciences experimentales': 'Science',
  let: 'Lettres',
  lettre: 'Lettres',
  lettres: 'Lettres',
  sport: 'Sport',
  general: 'Sans section',
  général: 'Sans section',
  'sans section': 'Sans section',
  'tronc commun': 'Sans section',
};

/**
 * Mappe le grade du CSV vers le libellé français standard
 */
export function mapGradeToLevel(grade?: string): string {
  if (!grade) return 'BAC';
  const clean = grade.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (GRADE_ALIASES[clean]) return GRADE_ALIASES[clean];

  for (const [key, val] of Object.entries(GRADE_ALIASES)) {
    if (clean.includes(key)) return val;
  }
  return grade;
}

/**
 * Mappe la spécialité du CSV vers la section standard
 */
export function mapSpecialityToSection(spec?: string): string {
  if (!spec) return 'Sans section';
  const clean = spec.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (SPEC_ALIASES[clean]) return SPEC_ALIASES[clean];

  for (const [key, val] of Object.entries(SPEC_ALIASES)) {
    if (clean.includes(key)) return val;
  }
  return spec;
}

/**
 * Normalise la matière à partir du titre ou libellé brut du fichier Excel/CSV
 */
export function mapSubjectToStandard(rawSubject?: string, title?: string): string {
  let sub = (rawSubject || '').trim();
  if (sub.includes('(')) {
    sub = sub.split('(')[0].trim();
  }
  if (!sub && title) {
    sub = title.split(':')[0].trim();
  }
  if (!sub) return 'Séance';

  const clean = sub.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (clean.includes('math')) return 'Mathématiques';
  if (clean.includes('info') || clean.includes('algo') || clean.includes('program')) return 'Informatique';
  if (clean.includes('mecanique') || clean.includes('mcanique')) return 'Mécanique';
  if (clean.includes('electrique')) return 'Électrique';
  if (clean.includes('physique')) return 'Sciences physiques';
  if (clean.includes('svt') || (clean.includes('science') && clean.includes('vie'))) return 'Sciences de la Vie et de la Terre';
  if (clean.includes('francais') || clean.includes('franais')) return 'Français';
  if (clean.includes('anglais') || clean.includes('english')) return 'Anglais';
  if (clean.includes('arabe')) return 'Arabe';
  if (clean.includes('eco') || clean.includes('conomie')) return 'Économie';
  if (clean.includes('gestion')) return 'Gestion';
  if (clean.includes('philo')) return 'Philosophie';
  if (clean.includes('hist') || clean.includes('geo')) return 'Histoire-Géographie';

  return sub;
}

/**
 * Conversion inverse pour l'export Excel ou compatibilité externe
 */
export function canonicalToRawGrade(level: string): string {
  if (level.includes('Bac')) return 'Bac';
  if (level.includes('3e')) return '3eme';
  if (level.includes('2e')) return '2eme';
  if (level.includes('1re') || level.includes('1er')) return '1er';
  if (level.includes('9e')) return '9eme';
  if (level.includes('8e')) return '8eme';
  if (level.includes('7e')) return '7eme';
  return level;
}

export function canonicalToRawSpec(section: string): string {
  if (section.includes('tech')) return 'Tech';
  if (section.includes('Math')) return 'Math';
  if (section.includes('Info')) return 'Info';
  if (section.includes('cono') || section.includes('Gestion')) return 'Eco';
  if (section.includes('xp') || section.includes('exp')) return 'Sci';
  if (section.includes('Let')) return 'Let';
  return 'General';
}

/**
 * Formate la date au format lisible JJ/MM/AAAA
 */
export function formatDateFR(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// ============================================================================
// TEMPLATES WHATSAPP DE NOTIFICATIONS ET RAPPELS
// ============================================================================

/**
 * Génère le message WhatsApp de rappel pour l'enseignant (SANS lien Zoom, aujourd'hui + heure exacte)
 */
export function formatTeacherReminder(session: Partial<Session>, lang: 'fr' | 'ar' = 'fr', customTemplate?: string): string {
  const teacher = session.teacherName || 'Professeur';
  const subject = session.subject || session.title || 'Séance';
  const level = session.level ? (session.section && session.section !== 'Sans section' ? `${session.level} - ${session.section}` : session.level) : '';
  const time = session.startTime || '18:00';

  if (customTemplate) {
    return customTemplate
      .replace(/\{prof\}/gi, teacher)
      .replace(/\{nom\}/gi, teacher)
      .replace(/\{matiere\}/gi, subject)
      .replace(/\{matière\}/gi, subject)
      .replace(/\{niveau\}/gi, level)
      .replace(/\{heure\}/gi, time)
      .trim();
  }

  if (lang === 'ar') {
    return `تحية طيبة أستاذ(ة) ${teacher}،\n\nنذكركم بحصتكم المباشرة في مادة ${subject}${level ? ` (${level})` : ''} المبرمجة اليوم على الساعة ${time}.\n\nيرجى تأكيد حضوركم وجاهزيتكم.`;
  }

  return `Bonjour ${teacher},\n\nRappel pour votre séance en direct de ${subject}${level ? ` (${level})` : ''} prévue aujourd'hui à ${time}.\n\nMerci de confirmer votre disponibilité.`;
}

/**
 * Génère le message WhatsApp de rappel pour le GROUPE DES ÉLÈVES (SANS lien Zoom, aujourd'hui + heure exacte)
 */
export function formatGroupReminder(session: Partial<Session>, lang: 'fr' | 'ar' = 'fr', customTemplate?: string): string {
  const subject = session.subject || session.title || 'Séance';
  const level = session.level ? (session.section && session.section !== 'Sans section' ? `${session.level} (${session.section})` : session.level) : '';
  const time = session.startTime || '18:00';

  if (customTemplate) {
    return customTemplate
      .replace(/\{matiere\}/gi, subject)
      .replace(/\{matière\}/gi, subject)
      .replace(/\{niveau\}/gi, level)
      .replace(/\{heure\}/gi, time)
      .replace(/\{prof\}/gi, session.teacherName || '')
      .replace(/\{enseignant\}/gi, session.teacherName || '')
      .trim();
  }

  if (lang === 'ar') {
    return `📢 *تذكير بالحصّة - Elios Academy*\n\nأعزائنا التلاميذ${level ? ` (${level})` : ''}،\n\nنذكركم بأن حصتكم في مادة ${subject} ستكون اليوم على الساعة ${time}.\n\nيرجى الحضور في الموعد المحدد وتجهيز دروسكم !`;
  }

  return `📢 *Rappel de séance - Elios Academy*\n\nChers élèves${level ? ` de *${level}*` : ''},\n\nNous vous rappelons que votre séance de ${subject} aura lieu aujourd'hui à ${time}.\n\nSoyez au rendez-vous et préparez vos cours !`;
}

/**
 * Message WhatsApp : Demande de support PDF de cours
 */
export function formatPdfRequest(session: Partial<Session>): string {
  const teacher = session.teacherName || 'Professeur';
  const subject = session.subject || 'la séance';
  const date = formatDateFR(session.startDate);

  return `Bonjour ${teacher}, merci de nous transmettre le document PDF / support de cours de la séance de ${subject} du ${date}.`;
}

/**
 * Message WhatsApp : Demande d'enregistrement vidéo
 */
export function formatRecRequest(session: Partial<Session>): string {
  const teacher = session.teacherName || 'Professeur';
  const subject = session.subject || 'la séance';
  const date = formatDateFR(session.startDate);

  return `Bonjour ${teacher}, merci de nous transmettre l'enregistrement vidéo de la séance de ${subject} du ${date}.`;
}
