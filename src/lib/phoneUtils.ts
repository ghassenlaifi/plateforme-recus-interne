/**
 * Utilitaires universels de normalisation, validation et formatage des numéros de téléphone.
 * 
 * Supporte avec une rigueur absolue :
 * 1. Tunisie (+216) :
 *    - Format local standard : "XX XXX XXX" (ex: "92 330 331", "21 158 832")
 *    - Préfixes autorisés : 2, 3, 4, 5, 7, 9
 *    - URL WhatsApp : "216XXXXXXXX"
 * 
 * 2. Sultanat d'Oman (+968) :
 *    - Indicatif officiel : +968
 *    - Format standard : "+968 XXXX XXXX" (ex: "+968 9123 4567")
 *    - 8 chiffres nationaux après l'indicatif
 *    - URL WhatsApp : "968XXXXXXXX"
 */

export type PhoneCountry = 'TN' | 'OM' | 'UNKNOWN';

export interface PhoneInfo {
  country: PhoneCountry;
  countryCode: '216' | '968' | '';
  nationalDigits: string;
  internationalDigits: string;
  formatted: string;
  isValid: boolean;
  error?: string;
}

/**
 * Détecte avec précision le pays d'origine du numéro (Tunisie ou Oman).
 * Règle d'or : Les numéros tunisiens commençant par 96 (ex: 96 305 894) ne doivent jamais
 * être confondus avec Oman grâce à la vérification stricte des préfixes internationaux et longueurs.
 */
export function detectPhoneCountry(raw?: string | null): PhoneCountry {
  if (!raw) return 'UNKNOWN';
  const str = String(raw).trim();

  // 1. Préfixe explicite Oman (+968, 00968, (+968))
  if (/^(\+\s*968|00\s*968|\(\s*\+?\s*968\s*\))/i.test(str)) {
    return 'OM';
  }

  // 2. Préfixe explicite Tunisie (+216, 00216, (+216))
  if (/^(\+\s*216|00\s*216|\(\s*\+?\s*216\s*\))/i.test(str)) {
    return 'TN';
  }

  const digits = str.replace(/\D/g, '');

  // 3. Chiffres bruts commençant par 968 avec au moins 11 chiffres (968 + 8 chiffres = 11)
  if (digits.startsWith('968') && digits.length >= 11) {
    return 'OM';
  }

  // 4. Chiffres bruts commençant par 216 avec au moins 11 chiffres (216 + 8 chiffres = 11)
  if (digits.startsWith('216') && digits.length >= 11) {
    return 'TN';
  }

  // 5. Numéro local sans indicatif (8 chiffres) -> Par défaut Tunisie
  if (digits.length === 8) {
    return 'TN';
  }

  // 6. En cours de frappe avec indicatif partiel ou complet
  if (str.startsWith('+968') || str.startsWith('00968')) {
    return 'OM';
  }
  if (str.startsWith('+216') || str.startsWith('00216')) {
    return 'TN';
  }

  return digits.length > 0 ? 'TN' : 'UNKNOWN';
}

/**
 * Extrait l'ensemble des données structurées d'un numéro de téléphone.
 */
export function extractPhoneData(raw?: string | null): PhoneInfo {
  if (!raw) {
    return {
      country: 'UNKNOWN',
      countryCode: '',
      nationalDigits: '',
      internationalDigits: '',
      formatted: '',
      isValid: false,
    };
  }

  const str = String(raw).trim();
  const country = detectPhoneCountry(raw);

  if (country === 'OM') {
    let s = str.replace(/^(\+\s*968|00\s*968|\(\s*\+?\s*968\s*\)|968[\s\.\-\/]+)/i, '');
    let digits = s.replace(/\D/g, '');
    if (digits.startsWith('00968')) digits = digits.slice(5);
    else if (digits.startsWith('968') && digits.length >= 11) digits = digits.slice(3);

    const nationalDigits = digits.slice(0, 8);
    const internationalDigits = nationalDigits ? `968${nationalDigits}` : '';
    const isValid = nationalDigits.length === 8;

    let formatted = '';
    if (nationalDigits) {
      if (nationalDigits.length <= 4) {
        formatted = `+968 ${nationalDigits}`;
      } else {
        formatted = `+968 ${nationalDigits.slice(0, 4)} ${nationalDigits.slice(4)}`;
      }
    }

    return {
      country: 'OM',
      countryCode: '968',
      nationalDigits,
      internationalDigits,
      formatted,
      isValid,
      error: isValid ? undefined : `Numéro omanais (+968) : 8 chiffres requis (${nationalDigits.length}/8 saisis).`,
    };
  }

  // Par défaut Tunisie (+216)
  let s = str.replace(/^(\+\s*216|00\s*216|\(\s*\+?\s*216\s*\)|216[\s\.\-\/]+)/i, '');
  let digits = s.replace(/\D/g, '');
  if (digits.startsWith('00216')) digits = digits.slice(5);
  else if (digits.startsWith('216') && digits.length >= 11) digits = digits.slice(3);

  const nationalDigits = digits.slice(0, 8);
  const internationalDigits = nationalDigits ? `216${nationalDigits}` : '';
  const first = nationalDigits.charAt(0);
  const hasValidPrefix = ['2', '3', '4', '5', '7', '9'].includes(first);
  const isValid = nationalDigits.length === 8 && hasValidPrefix;

  let formatted = '';
  if (nationalDigits) {
    if (nationalDigits.length <= 2) {
      formatted = nationalDigits;
    } else if (nationalDigits.length <= 5) {
      formatted = `${nationalDigits.slice(0, 2)} ${nationalDigits.slice(2)}`;
    } else {
      formatted = `${nationalDigits.slice(0, 2)} ${nationalDigits.slice(2, 5)} ${nationalDigits.slice(5, 8)}`;
    }
  }

  let error: string | undefined = undefined;
  if (!isValid && nationalDigits.length > 0) {
    if (nationalDigits.length !== 8) {
      error = `Numéro tunisien invalide : 8 chiffres requis (${nationalDigits.length}/8 saisis).`;
    } else if (!hasValidPrefix) {
      error = 'Préfixe opérateur invalide en Tunisie. Doit débuter par 2, 4, 5, 9 (mobile) ou 3, 7 (fixe).';
    }
  }

  return {
    country: 'TN',
    countryCode: '216',
    nationalDigits,
    internationalDigits,
    formatted,
    isValid,
    error,
  };
}

/**
 * Extrait les chiffres nationaux (8 chiffres) en tenant compte du pays.
 */
export function extractPhoneDigits(raw?: string | null): string {
  const data = extractPhoneData(raw);
  return data.nationalDigits;
}

/**
 * Formate un numéro sous la forme normalisée :
 * - Oman : "+968 XXXX XXXX" (ex : "+968 9123 4567")
 * - Tunisie : "XX XXX XXX" (ex : "92 330 331")
 */
export function formatPhone(raw?: string | null): string {
  const data = extractPhoneData(raw);
  return data.formatted;
}

/**
 * Gestionnaire d'input réactif en temps réel avec auto-masking progressif.
 * Permet à l'utilisateur de taper indifféremment :
 * - Un numéro tunisien direct : "92..." -> "92 330 331"
 * - Un numéro omanais : "+968..." ou "968..." -> "+968 9123 4567"
 */
export function formatPhoneInput(raw?: string | null): string {
  if (!raw) return '';
  const str = String(raw);
  const trimmed = str.trim();
  if (!trimmed) return '';

  // 1. Saisie avec indicatif international débutant par '+'
  if (trimmed.startsWith('+')) {
    if (trimmed === '+') return '+';

    // A. Sultanat d'Oman : '+9', '+96', '+968...'
    if (trimmed === '+9' || trimmed === '+96') {
      return trimmed;
    }
    if (trimmed.startsWith('+968')) {
      const remainder = trimmed.slice(4);
      const digits = remainder.replace(/\D/g, '').slice(0, 8);
      if (digits.length === 0) {
        return str.endsWith(' ') ? '+968 ' : '+968';
      }
      if (digits.length <= 4) {
        return `+968 ${digits}`;
      }
      return `+968 ${digits.slice(0, 4)} ${digits.slice(4)}`;
    }

    // B. Tunisie internationale : '+2', '+21', '+216...'
    if (trimmed === '+2' || trimmed === '+21') {
      return trimmed;
    }
    if (trimmed.startsWith('+216')) {
      const remainder = trimmed.slice(5);
      const digits = remainder.replace(/\D/g, '').slice(0, 8);
      if (digits.length === 0) {
        return str.endsWith(' ') ? '+216 ' : '+216';
      }
      if (digits.length <= 2) {
        return `+216 ${digits}`;
      }
      if (digits.length <= 5) {
        return `+216 ${digits.slice(0, 2)} ${digits.slice(2)}`;
      }
      return `+216 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
    }

    // C. Autre indicatif international en cours : préserver '+' sans l'effacer
    const cleanDigits = trimmed.slice(1).replace(/\D/g, '');
    return cleanDigits ? `+${cleanDigits}` : '+';
  }

  // 2. Préfixe international '00' (ex: 00968 ou 00216)
  if (trimmed.startsWith('00')) {
    if (trimmed === '00' || trimmed === '009' || trimmed === '0096' || trimmed === '002' || trimmed === '0021') {
      return trimmed;
    }
    if (trimmed.startsWith('00968')) {
      const digits = trimmed.slice(5).replace(/\D/g, '').slice(0, 8);
      if (digits.length === 0) return '+968';
      if (digits.length <= 4) return `+968 ${digits}`;
      return `+968 ${digits.slice(0, 4)} ${digits.slice(4)}`;
    }
    if (trimmed.startsWith('00216')) {
      const digits = trimmed.slice(5).replace(/\D/g, '').slice(0, 8);
      if (digits.length === 0) return '+216';
      if (digits.length <= 2) return `+216 ${digits}`;
      if (digits.length <= 5) return `+216 ${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `+216 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
    }
  }

  // 3. Saisie directe Oman avec '968' et plus de 8 chiffres
  const allDigits = trimmed.replace(/\D/g, '');
  if (allDigits.startsWith('968') && allDigits.length > 8) {
    const omaniDigits = allDigits.slice(3, 11);
    if (omaniDigits.length <= 4) return `+968 ${omaniDigits}`;
    return `+968 ${omaniDigits.slice(0, 4)} ${omaniDigits.slice(4)}`;
  }

  // 4. Numéro local standard Tunisie (8 chiffres : 2X, 3X, 4X, 5X, 7X, 9X)
  const tnDigits = allDigits.slice(0, 8);
  if (!tnDigits) return '';
  if (tnDigits.length <= 2) {
    return tnDigits;
  }
  if (tnDigits.length <= 5) {
    return `${tnDigits.slice(0, 2)} ${tnDigits.slice(2)}`;
  }
  return `${tnDigits.slice(0, 2)} ${tnDigits.slice(2, 5)} ${tnDigits.slice(5)}`;
}

/**
 * Retourne le numéro au format international compact pour les URLs WhatsApp et appels :
 * - Oman : "968XXXXXXXX" (ex : "96891234567")
 * - Tunisie : "216XXXXXXXX" (ex : "21692330331")
 */
export function normalizePhoneForUrl(raw?: string | null): string {
  const data = extractPhoneData(raw);
  return data.internationalDigits;
}

/**
 * Valide si le numéro est valide (Tunisie ou Oman).
 */
export function isValidPhone(raw?: string | null): boolean {
  const data = extractPhoneData(raw);
  return data.isValid;
}

/**
 * Valide si le numéro contient bien exactement 8 chiffres tunisiens commençant par un préfixe valide.
 */
export function isValidTunisianPhone(raw?: string | null): boolean {
  const data = extractPhoneData(raw);
  return data.country === 'TN' && data.isValid;
}

/**
 * Valide si le numéro contient bien exactement 8 chiffres omanais après l'indicatif +968.
 */
export function isValidOmaniPhone(raw?: string | null): boolean {
  const data = extractPhoneData(raw);
  return data.country === 'OM' && data.isValid;
}
