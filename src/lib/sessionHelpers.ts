import { Session } from '@/types/session';

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
  if (!value) return '';

  const trimmed = value.trim();
  const startsWithPlus = trimmed.startsWith('+');
  
  // Extraction des chiffres uniquement
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return startsWithPlus ? '+' : '';

  // Cas 1 : Préfixe international Tunisie (+216 ou 00216 ou 216 au début)
  if (startsWithPlus && digits.startsWith('216')) {
    const localDigits = digits.slice(3).slice(0, 8); // max 8 chiffres locaux
    if (localDigits.length <= 2) return `+216 ${localDigits}`;
    if (localDigits.length <= 5) return `+216 ${localDigits.slice(0, 2)} ${localDigits.slice(2)}`;
    return `+216 ${localDigits.slice(0, 2)} ${localDigits.slice(2, 5)} ${localDigits.slice(5, 8)}`;
  }

  // Cas 2 : L'utilisateur a collé '216' sans '+' au début
  if (!startsWithPlus && digits.startsWith('216') && digits.length > 8) {
    const localDigits = digits.slice(3).slice(0, 8);
    if (localDigits.length <= 2) return `+216 ${localDigits}`;
    if (localDigits.length <= 5) return `+216 ${localDigits.slice(0, 2)} ${localDigits.slice(2)}`;
    return `+216 ${localDigits.slice(0, 2)} ${localDigits.slice(2, 5)} ${localDigits.slice(5, 8)}`;
  }

  // Cas 3 : Autre indicatif international (+33, +213, +1, etc.)
  if (startsWithPlus) {
    // International libre jusqu'à 15 chiffres (standard E.164)
    const intlDigits = digits.slice(0, 15);
    return `+${intlDigits}`;
  }

  // Cas 4 : Numéro local tunisien standard (8 chiffres max)
  const localDigits = digits.slice(0, 8);
  if (localDigits.length <= 2) return localDigits;
  if (localDigits.length <= 5) return `${localDigits.slice(0, 2)} ${localDigits.slice(2)}`;
  return `${localDigits.slice(0, 2)} ${localDigits.slice(2, 5)} ${localDigits.slice(5, 8)}`;
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
  const digits = str.replace(/\D/g, '');

  if (digits.length === 0) {
    return { isValid: false, error: 'Veuillez saisir un numéro valide.' };
  }

  // Détection indicatif Tunisie
  let localDigits = digits;
  if (digits.startsWith('216') && digits.length >= 10) {
    localDigits = digits.slice(3);
  } else if (digits.startsWith('00216')) {
    localDigits = digits.slice(5);
  }

  // Si c'est un numéro tunisien
  if (str.startsWith('+216') || !str.startsWith('+')) {
    if (localDigits.length !== 8) {
      return {
        isValid: false,
        error: `Numéro tunisien invalide : 8 chiffres requis (${localDigits.length}/8 saisis).`,
      };
    }

    const firstDigit = localDigits.charAt(0);
    const validPrefixes = ['2', '3', '4', '5', '7', '9'];
    if (!validPrefixes.includes(firstDigit)) {
      return {
        isValid: false,
        error: 'Préfixe opérateur invalide en Tunisie. Doit débuter par 2, 4, 5, 9 (mobile) ou 3, 7 (fixe).',
      };
    }

    return { isValid: true };
  }

  // Si c'est un numéro international étranger (+...)
  if (digits.length < 7 || digits.length > 15) {
    return {
      isValid: false,
      error: 'Format international invalide (entre 7 et 15 chiffres requis).',
    };
  }

  return { isValid: true };
}

/**
 * Normalise un numéro de téléphone pour WhatsApp (ex: 22 987 775 -> 21622987775).
 * Renvoie une chaîne propre sans '+' ni espaces, prête pour les liens 'wa.me/'.
 */
export function normalizePhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';

  digits = digits.replace(/^00/, '');

  // 8 chiffres tunisiens => préfixe 216
  if (digits.length === 8) {
    return COUNTRY_CODE + digits;
  }
  // 11 chiffres commençant par 216
  if (digits.length === 11 && digits.startsWith(COUNTRY_CODE)) {
    return digits;
  }

  return digits;
}

/**
 * Formate un numéro de téléphone pour un affichage lisible dans l'interface (ex: +216 22 987 775)
 */
export function formatPhone(raw?: string | null): string {
  const norm = normalizePhone(raw);
  if (!norm) return raw ? String(raw) : '';
  if (norm.length === 11 && norm.startsWith(COUNTRY_CODE)) {
    return `+${norm.slice(0, 3)} ${norm.slice(3, 5)} ${norm.slice(5, 8)} ${norm.slice(8)}`;
  }
  if (norm.length === 8) {
    return `${norm.slice(0, 2)} ${norm.slice(2, 5)} ${norm.slice(5)}`;
  }
  return norm;
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
 * Génère le message WhatsApp de rappel pour l'enseignant
 */
export function formatTeacherReminder(session: Partial<Session>): string {
  const teacher = session.teacherName || 'Professeur';
  const subject = session.subject || session.title || 'Séance';
  const level = session.level || '';
  const section = session.section && session.section !== 'Sans section' ? ` - ${session.section}` : '';
  const date = formatDateFR(session.startDate);
  const time = session.startTime || '';
  const zoom = session.zoomJoinUrl ? `\n🔗 Lien Zoom : ${session.zoomJoinUrl}` : '';
  const meetingId = session.zoomMeetingId ? `\n🔑 ID Réunion : ${session.zoomMeetingId}` : '';

  return `Bonjour ${teacher},
Rappel pour votre séance en direct :
📚 Matière : ${subject} (${level}${section})
📅 Date : ${date}
⏰ Heure : ${time}${zoom}${meetingId}

Merci de confirmer votre disponibilité.`;
}

/**
 * Génère le message WhatsApp de rappel pour le GROUPE DES ÉLÈVES
 */
export function formatGroupReminder(session: Partial<Session>): string {
  const subject = session.subject || session.title || 'Séance';
  const level = session.level || '';
  const section = session.section && session.section !== 'Sans section' ? ` (${session.section})` : '';
  const teacher = session.teacherName || 'Votre enseignant';
  const date = formatDateFR(session.startDate);
  const start = session.startTime || '';
  const end = session.endTime ? ` à ${session.endTime}` : '';
  const zoom = session.zoomJoinUrl ? `\n🔗 Lien d'accès Zoom : ${session.zoomJoinUrl}` : '';
  const meetingId = session.zoomMeetingId ? `\n🔑 ID Réunion : ${session.zoomMeetingId}` : '';

  return `📢 *Rappel de séance en direct - Elios Academy*

Chers élèves de *${level}${section}*,

Votre cours en direct aura lieu aujourd'hui :
📖 *Matière* : ${subject}
👨‍🏫 *Enseignant* : ${teacher}
📅 *Date* : ${date}
⏰ *Horaire* : ${start}${end}${zoom}${meetingId}

⚠️ *Merci d'être ponctuels et de préparer vos questions pour le direct !*`;
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
