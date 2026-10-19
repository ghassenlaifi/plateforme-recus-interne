/**
 * Utilitaires universels de normalisation, validation et formatage des numéros de téléphone.
 * 
 * Supporte avec une rigueur absolue d'Ingénieur Architecte CTO & Data Integrity :
 * 1. Tunisie (+216) - PAYS PAR DÉFAUT :
 *    - Format local standard : "XX XXX XXX" (ex: "92 330 331")
 *    - Format international : "+216 XX XXX XXX"
 *    - 8 chiffres nationaux (préfixes : 2, 3, 4, 5, 7, 9)
 *    - WhatsApp : "216XXXXXXXX"
 * 
 * 2. France (+33) :
 *    - Format standard : "+33 X XX XX XX XX" (ex: "+33 6 12 34 56 78")
 *    - 9 chiffres nationaux (le 0 initial domestique est automatiquement nettoyé)
 *    - WhatsApp : "33XXXXXXXXX"
 * 
 * 3. Italie (+39) :
 *    - Format standard : "+39 XXX XXX XXXX" (ex: "+39 312 345 6789")
 *    - 9 à 10 chiffres nationaux
 *    - WhatsApp : "39XXXXXXXXXX"
 * 
 * 4. Allemagne (+49) :
 *    - Format standard : "+49 XXX XXXXXXXX" (ex: "+49 151 1234 5678")
 *    - 10 à 11 chiffres nationaux (le 0 initial domestique est nettoyé)
 *    - WhatsApp : "49XXXXXXXXXXX"
 * 
 * 5. Arabie Saoudite (+966) :
 *    - Format standard : "+966 5X XXX XXXX" (ex: "+966 50 123 4567")
 *    - 9 chiffres nationaux (débutant par 5, le 0 initial domestique est nettoyé)
 *    - WhatsApp : "9665XXXXXXXX"
 * 
 * 6. Sultanat d'Oman (+968) :
 *    - Format standard : "+968 XXXX XXXX" (ex: "+968 9123 4567")
 *    - 8 chiffres nationaux
 *    - WhatsApp : "968XXXXXXXX"
 * 
 * 7. Qatar (+974) :
 *    - Format standard : "+974 XXXX XXXX" (ex: "+974 5512 3456")
 *    - 8 chiffres nationaux (débutant par 3, 5, 6, 7)
 *    - WhatsApp : "974XXXXXXXX"
 */

export type SupportedCountryCode = 'TN' | 'FR' | 'IT' | 'DE' | 'SA' | 'OM' | 'QA';
export type PhoneCountry = SupportedCountryCode | 'UNKNOWN';

export interface CountryConfig {
  code: SupportedCountryCode;
  name: string;
  dialCode: string;
  flag: string;
  nationalLength: number | number[];
  placeholder: string;
  example: string;
}

export const SUPPORTED_COUNTRIES: Record<SupportedCountryCode, CountryConfig> = {
  TN: {
    code: 'TN',
    name: 'Tunisie',
    dialCode: '216',
    flag: '🇹🇳',
    nationalLength: 8,
    placeholder: 'Ex : 92 330 331',
    example: '92 330 331',
  },
  FR: {
    code: 'FR',
    name: 'France',
    dialCode: '33',
    flag: '🇫🇷',
    nationalLength: 9,
    placeholder: 'Ex : +33 6 12 34 56 78',
    example: '+33 6 12 34 56 78',
  },
  IT: {
    code: 'IT',
    name: 'Italie',
    dialCode: '39',
    flag: '🇮🇹',
    nationalLength: [9, 10],
    placeholder: 'Ex : +39 312 345 6789',
    example: '+39 312 345 6789',
  },
  DE: {
    code: 'DE',
    name: 'Allemagne',
    dialCode: '49',
    flag: '🇩🇪',
    nationalLength: [10, 11],
    placeholder: 'Ex : +49 151 1234 5678',
    example: '+49 151 1234 5678',
  },
  SA: {
    code: 'SA',
    name: 'Arabie Saoudite',
    dialCode: '966',
    flag: '🇸🇦',
    nationalLength: 9,
    placeholder: 'Ex : +966 50 123 4567',
    example: '+966 50 123 4567',
  },
  OM: {
    code: 'OM',
    name: 'Oman',
    dialCode: '968',
    flag: '🇴🇲',
    nationalLength: 8,
    placeholder: 'Ex : +968 9123 4567',
    example: '+968 9123 4567',
  },
  QA: {
    code: 'QA',
    name: 'Qatar',
    dialCode: '974',
    flag: '🇶🇦',
    nationalLength: 8,
    placeholder: 'Ex : +974 5512 3456',
    example: '+974 5512 3456',
  },
};

export const SUPPORTED_COUNTRIES_LIST: CountryConfig[] = Object.values(SUPPORTED_COUNTRIES);

export interface PhoneInfo {
  country: PhoneCountry;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  nationalDigits: string;
  internationalDigits: string;
  formatted: string;
  isValid: boolean;
  error?: string;
}

/**
 * Détecte avec précision le pays d'origine du numéro parmi les pays supportés.
 * Règle d'or absolue : Tout numéro local sans indicatif (8 chiffres) est PAR DÉFAUT Tunisie.
 * Les numéros tunisiens débutant par 96, 97, 21 ou 33 ne sont JAMAIS confondus
 * avec l'étranger grâce au contrôle strict des préfixes internationaux et longueurs.
 */
export function detectPhoneCountry(raw?: string | null): PhoneCountry {
  if (!raw) return 'UNKNOWN';
  const str = String(raw).trim();
  if (!str) return 'UNKNOWN';

  // 1. Préfixes explicites avec '+' ou '00'
  if (/^(\+\s*966|00\s*966|\(\s*\+?\s*966\s*\))/i.test(str)) return 'SA';
  if (/^(\+\s*968|00\s*968|\(\s*\+?\s*968\s*\))/i.test(str)) return 'OM';
  if (/^(\+\s*974|00\s*974|\(\s*\+?\s*974\s*\))/i.test(str)) return 'QA';
  if (/^(\+\s*216|00\s*216|\(\s*\+?\s*216\s*\))/i.test(str)) return 'TN';
  if (/^(\+\s*33|00\s*33|\(\s*\+?\s*33\s*\))/i.test(str)) return 'FR';
  if (/^(\+\s*39|00\s*39|\(\s*\+?\s*39\s*\))/i.test(str)) return 'IT';
  if (/^(\+\s*49|00\s*49|\(\s*\+?\s*49\s*\))/i.test(str)) return 'DE';

  const digits = str.replace(/\D/g, '');

  // 2. Chiffres bruts sans indicatif '+' avec longueur complète internationale
  if (digits.startsWith('966') && digits.length >= 11) return 'SA';
  if (digits.startsWith('968') && digits.length >= 11) return 'OM';
  if (digits.startsWith('974') && digits.length >= 11) return 'QA';
  if (digits.startsWith('216') && digits.length >= 11) return 'TN';
  if (digits.startsWith('33') && digits.length >= 11) return 'FR';
  if (digits.startsWith('39') && digits.length >= 11) return 'IT';
  if (digits.startsWith('49') && digits.length >= 12) return 'DE';

  // 3. Saisie en cours débutant par un indicatif international
  if (str.startsWith('+966') || str.startsWith('00966')) return 'SA';
  if (str.startsWith('+968') || str.startsWith('00968')) return 'OM';
  if (str.startsWith('+974') || str.startsWith('00974')) return 'QA';
  if (str.startsWith('+216') || str.startsWith('00216')) return 'TN';
  if (str.startsWith('+33') || str.startsWith('0033')) return 'FR';
  if (str.startsWith('+39') || str.startsWith('0039')) return 'IT';
  if (str.startsWith('+49') || str.startsWith('0049')) return 'DE';

  // 4. Par défaut : TUNISIE
  return digits.length > 0 ? 'TN' : 'UNKNOWN';
}

/**
 * Extrait l'ensemble des données structurées et normalisées d'un numéro de téléphone.
 */
export function extractPhoneData(raw?: string | null): PhoneInfo {
  if (!raw) {
    return {
      country: 'UNKNOWN',
      countryCode: '',
      countryName: '',
      countryFlag: '',
      nationalDigits: '',
      internationalDigits: '',
      formatted: '',
      isValid: false,
    };
  }

  const str = String(raw).trim();
  const country = detectPhoneCountry(raw);
  const cfg = country !== 'UNKNOWN' ? SUPPORTED_COUNTRIES[country] : null;

  // -------------------------------------------------------------
  // 1. ARABIE SAOUDITE (+966)
  // -------------------------------------------------------------
  if (country === 'SA') {
    let s = str.replace(/^(\+\s*966|00\s*966|\(\s*\+?\s*966\s*\)|966[\s\.\-\/]+)/i, '');
    let digits = s.replace(/\D/g, '');
    if (digits.startsWith('00966')) digits = digits.slice(5);
    else if (digits.startsWith('966') && digits.length >= 11) digits = digits.slice(3);

    // Supprimer le 0 domestique éventuel (ex: 050 -> 50)
    if (digits.startsWith('0')) digits = digits.slice(1);

    const nationalDigits = digits.slice(0, 9);
    const internationalDigits = nationalDigits ? `966${nationalDigits}` : '';
    const isValid = nationalDigits.length === 9 && nationalDigits.startsWith('5');

    let formatted = '';
    if (nationalDigits) {
      if (nationalDigits.length <= 2) {
        formatted = `+966 ${nationalDigits}`;
      } else if (nationalDigits.length <= 5) {
        formatted = `+966 ${nationalDigits.slice(0, 2)} ${nationalDigits.slice(2)}`;
      } else {
        formatted = `+966 ${nationalDigits.slice(0, 2)} ${nationalDigits.slice(2, 5)} ${nationalDigits.slice(5)}`;
      }
    }

    let error: string | undefined = undefined;
    if (!isValid && nationalDigits.length > 0) {
      if (nationalDigits.length !== 9) {
        error = `Numéro saoudien (+966) : 9 chiffres requis (${nationalDigits.length}/9 saisis).`;
      } else if (!nationalDigits.startsWith('5')) {
        error = 'Numéro saoudien invalide : doit débuter par 5 (ex : +966 50 123 4567).';
      }
    }

    return {
      country: 'SA',
      countryCode: '966',
      countryName: cfg?.name || 'Arabie Saoudite',
      countryFlag: cfg?.flag || '🇸🇦',
      nationalDigits,
      internationalDigits,
      formatted,
      isValid,
      error,
    };
  }

  // -------------------------------------------------------------
  // 2. SULTANAT D'OMAN (+968)
  // -------------------------------------------------------------
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

    let error: string | undefined = undefined;
    if (!isValid && nationalDigits.length > 0) {
      error = `Numéro omanais (+968) : 8 chiffres requis (${nationalDigits.length}/8 saisis).`;
    }

    return {
      country: 'OM',
      countryCode: '968',
      countryName: cfg?.name || 'Oman',
      countryFlag: cfg?.flag || '🇴🇲',
      nationalDigits,
      internationalDigits,
      formatted,
      isValid,
      error,
    };
  }

  // -------------------------------------------------------------
  // 3. QATAR (+974)
  // -------------------------------------------------------------
  if (country === 'QA') {
    let s = str.replace(/^(\+\s*974|00\s*974|\(\s*\+?\s*974\s*\)|974[\s\.\-\/]+)/i, '');
    let digits = s.replace(/\D/g, '');
    if (digits.startsWith('00974')) digits = digits.slice(5);
    else if (digits.startsWith('974') && digits.length >= 11) digits = digits.slice(3);

    const nationalDigits = digits.slice(0, 8);
    const internationalDigits = nationalDigits ? `974${nationalDigits}` : '';
    const isValid = nationalDigits.length === 8;

    let formatted = '';
    if (nationalDigits) {
      if (nationalDigits.length <= 4) {
        formatted = `+974 ${nationalDigits}`;
      } else {
        formatted = `+974 ${nationalDigits.slice(0, 4)} ${nationalDigits.slice(4)}`;
      }
    }

    let error: string | undefined = undefined;
    if (!isValid && nationalDigits.length > 0) {
      error = `Numéro qatari (+974) : 8 chiffres requis (${nationalDigits.length}/8 saisis).`;
    }

    return {
      country: 'QA',
      countryCode: '974',
      countryName: cfg?.name || 'Qatar',
      countryFlag: cfg?.flag || '🇶🇦',
      nationalDigits,
      internationalDigits,
      formatted,
      isValid,
      error,
    };
  }

  // -------------------------------------------------------------
  // 4. FRANCE (+33)
  // -------------------------------------------------------------
  if (country === 'FR') {
    let s = str.replace(/^(\+\s*33|00\s*33|\(\s*\+?\s*33\s*\)|33[\s\.\-\/]+)/i, '');
    let digits = s.replace(/\D/g, '');
    if (digits.startsWith('0033')) digits = digits.slice(4);
    else if (digits.startsWith('33') && digits.length >= 11) digits = digits.slice(2);

    // Supprimer le 0 domestique initial (ex: 06 12 -> 6 12)
    if (digits.startsWith('0')) digits = digits.slice(1);

    const nationalDigits = digits.slice(0, 9);
    const internationalDigits = nationalDigits ? `33${nationalDigits}` : '';
    const isValid = nationalDigits.length === 9;

    let formatted = '';
    if (nationalDigits) {
      formatted = `+33 ${nationalDigits.slice(0, 1)}`;
      if (nationalDigits.length > 1) formatted += ` ${nationalDigits.slice(1, 3)}`;
      if (nationalDigits.length > 3) formatted += ` ${nationalDigits.slice(3, 5)}`;
      if (nationalDigits.length > 5) formatted += ` ${nationalDigits.slice(5, 7)}`;
      if (nationalDigits.length > 7) formatted += ` ${nationalDigits.slice(7, 9)}`;
    }

    let error: string | undefined = undefined;
    if (!isValid && nationalDigits.length > 0) {
      error = `Numéro français (+33) : 9 chiffres requis (${nationalDigits.length}/9 saisis).`;
    }

    return {
      country: 'FR',
      countryCode: '33',
      countryName: cfg?.name || 'France',
      countryFlag: cfg?.flag || '🇫🇷',
      nationalDigits,
      internationalDigits,
      formatted,
      isValid,
      error,
    };
  }

  // -------------------------------------------------------------
  // 5. ITALIE (+39)
  // -------------------------------------------------------------
  if (country === 'IT') {
    let s = str.replace(/^(\+\s*39|00\s*39|\(\s*\+?\s*39\s*\)|39[\s\.\-\/]+)/i, '');
    let digits = s.replace(/\D/g, '');
    if (digits.startsWith('0039')) digits = digits.slice(4);
    else if (digits.startsWith('39') && digits.length >= 11) digits = digits.slice(2);

    const nationalDigits = digits.slice(0, 10);
    const internationalDigits = nationalDigits ? `39${nationalDigits}` : '';
    const isValid = nationalDigits.length >= 9 && nationalDigits.length <= 10;

    let formatted = '';
    if (nationalDigits) {
      if (nationalDigits.length <= 3) {
        formatted = `+39 ${nationalDigits}`;
      } else if (nationalDigits.length <= 6) {
        formatted = `+39 ${nationalDigits.slice(0, 3)} ${nationalDigits.slice(3)}`;
      } else {
        formatted = `+39 ${nationalDigits.slice(0, 3)} ${nationalDigits.slice(3, 6)} ${nationalDigits.slice(6)}`;
      }
    }

    let error: string | undefined = undefined;
    if (!isValid && nationalDigits.length > 0) {
      error = `Numéro italien (+39) : 9 à 10 chiffres requis (${nationalDigits.length} saisis).`;
    }

    return {
      country: 'IT',
      countryCode: '39',
      countryName: cfg?.name || 'Italie',
      countryFlag: cfg?.flag || '🇮🇹',
      nationalDigits,
      internationalDigits,
      formatted,
      isValid,
      error,
    };
  }

  // -------------------------------------------------------------
  // 6. ALLEMAGNE (+49)
  // -------------------------------------------------------------
  if (country === 'DE') {
    let s = str.replace(/^(\+\s*49|00\s*49|\(\s*\+?\s*49\s*\)|49[\s\.\-\/]+)/i, '');
    let digits = s.replace(/\D/g, '');
    if (digits.startsWith('0049')) digits = digits.slice(4);
    else if (digits.startsWith('49') && digits.length >= 12) digits = digits.slice(2);

    // Supprimer le 0 domestique initial si présent (ex: 0151 -> 151)
    if (digits.startsWith('0') && digits.length > 10) digits = digits.slice(1);

    const nationalDigits = digits.slice(0, 11);
    const internationalDigits = nationalDigits ? `49${nationalDigits}` : '';
    const isValid = nationalDigits.length >= 10 && nationalDigits.length <= 11;

    let formatted = '';
    if (nationalDigits) {
      if (nationalDigits.length <= 3) {
        formatted = `+49 ${nationalDigits}`;
      } else if (nationalDigits.length <= 7) {
        formatted = `+49 ${nationalDigits.slice(0, 3)} ${nationalDigits.slice(3)}`;
      } else {
        formatted = `+49 ${nationalDigits.slice(0, 3)} ${nationalDigits.slice(3, 7)} ${nationalDigits.slice(7)}`;
      }
    }

    let error: string | undefined = undefined;
    if (!isValid && nationalDigits.length > 0) {
      error = `Numéro allemand (+49) : 10 à 11 chiffres requis (${nationalDigits.length} saisis).`;
    }

    return {
      country: 'DE',
      countryCode: '49',
      countryName: cfg?.name || 'Allemagne',
      countryFlag: cfg?.flag || '🇩🇪',
      nationalDigits,
      internationalDigits,
      formatted,
      isValid,
      error,
    };
  }

  // -------------------------------------------------------------
  // 7. TUNISIE (+216) - PAYS PAR DÉFAUT
  // -------------------------------------------------------------
  let s = str.replace(/^(\+\s*216|00\s*216|\(\s*\+?\s*216\s*\)|216[\s\.\-\/]+)/i, '');
  let digits = s.replace(/\D/g, '');
  if (digits.startsWith('00216')) digits = digits.slice(5);
  else if (digits.startsWith('216') && digits.length >= 11) digits = digits.slice(3);

  const nationalDigits = digits.slice(0, 8);
  const internationalDigits = nationalDigits ? `216${nationalDigits}` : '';
  const first = nationalDigits.charAt(0);
  const hasValidPrefix = ['2', '3', '4', '5', '7', '9'].includes(first);
  const isValid = nationalDigits.length === 8 && hasValidPrefix;

  // Formatage : si la saisie d'origine comportait explicitement '+216', on préserve '+216', sinon format national XX XXX XXX
  const hasExplicitIntl = str.startsWith('+216') || str.startsWith('00216') || str.startsWith('+');
  let formatted = '';
  if (nationalDigits) {
    let localFormatted = '';
    if (nationalDigits.length <= 2) {
      localFormatted = nationalDigits;
    } else if (nationalDigits.length <= 5) {
      localFormatted = `${nationalDigits.slice(0, 2)} ${nationalDigits.slice(2)}`;
    } else {
      localFormatted = `${nationalDigits.slice(0, 2)} ${nationalDigits.slice(2, 5)} ${nationalDigits.slice(5, 8)}`;
    }
    formatted = hasExplicitIntl ? `+216 ${localFormatted}` : localFormatted;
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
    countryName: cfg?.name || 'Tunisie',
    countryFlag: cfg?.flag || '🇹🇳',
    nationalDigits,
    internationalDigits,
    formatted,
    isValid,
    error,
  };
}

/**
 * Extrait les chiffres nationaux en tenant compte du pays.
 */
export function extractPhoneDigits(raw?: string | null): string {
  const data = extractPhoneData(raw);
  return data.nationalDigits;
}

/**
 * Formate un numéro sous sa forme officielle standardisée :
 * - Tunisie : "XX XXX XXX" (ou "+216 XX XXX XXX")
 * - France : "+33 X XX XX XX XX"
 * - Italie : "+39 XXX XXX XXXX"
 * - Allemagne : "+49 XXX XXXXXXXX"
 * - Arabie Saoudite : "+966 5X XXX XXXX"
 * - Oman : "+968 XXXX XXXX"
 * - Qatar : "+974 XXXX XXXX"
 */
export function formatPhone(raw?: string | null): string {
  const data = extractPhoneData(raw);
  return data.formatted;
}

/**
 * Gestionnaire d'input réactif en temps réel avec auto-masking progressif.
 * Permet à l'utilisateur de taper indifféremment :
 * - Un numéro tunisien direct : "92..." -> "92 330 331"
 * - Un indicatif international débutant par '+' :
 *   +33... -> France
 *   +39... -> Italie
 *   +49... -> Allemagne
 *   +966... -> Arabie Saoudite
 *   +968... -> Oman
 *   +974... -> Qatar
 *   +216... -> Tunisie
 */
export function formatPhoneInput(raw?: string | null): string {
  if (!raw) return '';
  const str = String(raw);
  const trimmed = str.trim();
  if (!trimmed) return '';

  // 1. Saisie avec indicatif international débutant par '+'
  if (trimmed.startsWith('+')) {
    if (trimmed === '+') return '+';

    // A. Arabie Saoudite : '+966'
    if (trimmed.startsWith('+966')) {
      const remainder = trimmed.slice(4);
      let digits = remainder.replace(/\D/g, '');
      if (digits.startsWith('0')) digits = digits.slice(1);
      digits = digits.slice(0, 9);
      if (digits.length === 0) return str.endsWith(' ') ? '+966 ' : '+966';
      if (digits.length <= 2) return `+966 ${digits}`;
      if (digits.length <= 5) return `+966 ${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `+966 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
    }

    // B. Sultanat d'Oman : '+968'
    if (trimmed.startsWith('+968')) {
      const remainder = trimmed.slice(4);
      const digits = remainder.replace(/\D/g, '').slice(0, 8);
      if (digits.length === 0) return str.endsWith(' ') ? '+968 ' : '+968';
      if (digits.length <= 4) return `+968 ${digits}`;
      return `+968 ${digits.slice(0, 4)} ${digits.slice(4)}`;
    }

    // C. Qatar : '+974'
    if (trimmed.startsWith('+974')) {
      const remainder = trimmed.slice(4);
      const digits = remainder.replace(/\D/g, '').slice(0, 8);
      if (digits.length === 0) return str.endsWith(' ') ? '+974 ' : '+974';
      if (digits.length <= 4) return `+974 ${digits}`;
      return `+974 ${digits.slice(0, 4)} ${digits.slice(4)}`;
    }

    // D. France : '+33'
    if (trimmed.startsWith('+33')) {
      const remainder = trimmed.slice(3);
      let digits = remainder.replace(/\D/g, '');
      if (digits.startsWith('0')) digits = digits.slice(1);
      digits = digits.slice(0, 9);
      if (digits.length === 0) return str.endsWith(' ') ? '+33 ' : '+33';
      let res = `+33 ${digits.slice(0, 1)}`;
      if (digits.length > 1) res += ` ${digits.slice(1, 3)}`;
      if (digits.length > 3) res += ` ${digits.slice(3, 5)}`;
      if (digits.length > 5) res += ` ${digits.slice(5, 7)}`;
      if (digits.length > 7) res += ` ${digits.slice(7, 9)}`;
      return res;
    }

    // E. Italie : '+39'
    if (trimmed.startsWith('+39')) {
      const remainder = trimmed.slice(3);
      const digits = remainder.replace(/\D/g, '').slice(0, 10);
      if (digits.length === 0) return str.endsWith(' ') ? '+39 ' : '+39';
      if (digits.length <= 3) return `+39 ${digits}`;
      if (digits.length <= 6) return `+39 ${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `+39 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }

    // F. Allemagne : '+49'
    if (trimmed.startsWith('+49')) {
      const remainder = trimmed.slice(3);
      let digits = remainder.replace(/\D/g, '');
      if (digits.startsWith('0') && digits.length > 10) digits = digits.slice(1);
      digits = digits.slice(0, 11);
      if (digits.length === 0) return str.endsWith(' ') ? '+49 ' : '+49';
      if (digits.length <= 3) return `+49 ${digits}`;
      if (digits.length <= 7) return `+49 ${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `+49 ${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
    }

    // G. Tunisie internationale : '+216'
    if (trimmed.startsWith('+216')) {
      const remainder = trimmed.slice(4);
      const digits = remainder.replace(/\D/g, '').slice(0, 8);
      if (digits.length === 0) return str.endsWith(' ') ? '+216 ' : '+216';
      if (digits.length <= 2) return `+216 ${digits}`;
      if (digits.length <= 5) return `+216 ${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `+216 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
    }

    // Saisie en cours d'indicatif partiel ('+2', '+3', '+4', '+9', '+96', '+97')
    if (['+2', '+21', '+3', '+4', '+9', '+96', '+97'].includes(trimmed)) {
      return trimmed;
    }

    const cleanDigits = trimmed.slice(1).replace(/\D/g, '');
    return cleanDigits ? `+${cleanDigits}` : '+';
  }

  // 2. Préfixe international '00' (ex: 0033, 00966, 00968, 00974, 00216, 0039, 0049)
  if (trimmed.startsWith('00')) {
    if (trimmed === '00' || trimmed.length <= 4) {
      return trimmed;
    }
    // Remplacer 00 par + et ré-appliquer le formatteur
    return formatPhoneInput('+' + trimmed.slice(2));
  }

  // 3. Détection par préfixe collé sans '+' (ex: 9665..., 9689..., 9745..., 336...)
  const allDigits = trimmed.replace(/\D/g, '');
  if (allDigits.startsWith('966') && allDigits.length > 9) {
    return formatPhoneInput('+' + allDigits);
  }
  if (allDigits.startsWith('968') && allDigits.length > 8) {
    return formatPhoneInput('+' + allDigits);
  }
  if (allDigits.startsWith('974') && allDigits.length > 8) {
    return formatPhoneInput('+' + allDigits);
  }
  if (allDigits.startsWith('33') && allDigits.length > 9) {
    return formatPhoneInput('+' + allDigits);
  }
  if (allDigits.startsWith('39') && allDigits.length > 9) {
    return formatPhoneInput('+' + allDigits);
  }
  if (allDigits.startsWith('49') && allDigits.length > 10) {
    return formatPhoneInput('+' + allDigits);
  }
  if (allDigits.startsWith('216') && allDigits.length > 8) {
    return formatPhoneInput('+' + allDigits);
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
 * - Tunisie : "216XXXXXXXX"
 * - France : "33XXXXXXXXX"
 * - Italie : "39XXXXXXXXXX"
 * - Allemagne : "49XXXXXXXXXXX"
 * - Arabie Saoudite : "9665XXXXXXXX"
 * - Oman : "968XXXXXXXX"
 * - Qatar : "974XXXXXXXX"
 */
export function normalizePhoneForUrl(raw?: string | null): string {
  const data = extractPhoneData(raw);
  return data.internationalDigits;
}

/**
 * Valide si le numéro est valide selon son pays d'origine (Tunisie, France, Italie, Allemagne, Arabie Saoudite, Oman, Qatar).
 */
export function isValidPhone(raw?: string | null): boolean {
  const data = extractPhoneData(raw);
  return data.isValid;
}

/**
 * Valide spécifiquement un numéro tunisien (8 chiffres débutant par un préfixe valide).
 */
export function isValidTunisianPhone(raw?: string | null): boolean {
  const data = extractPhoneData(raw);
  return data.country === 'TN' && data.isValid;
}

/**
 * Valide spécifiquement un numéro omanais (+968, 8 chiffres).
 */
export function isValidOmaniPhone(raw?: string | null): boolean {
  const data = extractPhoneData(raw);
  return data.country === 'OM' && data.isValid;
}

/**
 * Vérifie de manière universelle si un numéro de téléphone stocké correspond
 * à une requête de recherche (complète ou partielle), peu importe le formatage.
 */
export function matchesPhoneQuery(storedPhone?: string | null, query?: string | null): boolean {
  if (!storedPhone || !query) return false;
  
  const rawQuery = String(query).trim();
  const rawStored = String(storedPhone).trim();
  if (!rawQuery || !rawStored) return false;

  // 1. Nettoyage textuel sans séparateurs ni espaces
  const queryClean = rawQuery.toLowerCase().replace(/[\s\.\-\/\(\)\+]/g, '');
  const storedClean = rawStored.toLowerCase().replace(/[\s\.\-\/\(\)\+]/g, '');
  if (queryClean.length >= 2 && storedClean.includes(queryClean)) {
    return true;
  }

  // 2. Chiffres purs
  const queryDigits = rawQuery.replace(/\D/g, '');
  const storedDigits = rawStored.replace(/\D/g, '');

  if (!queryDigits || !storedDigits) {
    return false;
  }

  if (queryDigits.length >= 2 && storedDigits.includes(queryDigits)) {
    return true;
  }

  // 3. Dépréfixage des indicatifs internationaux supportés
  const dialCodes = ['216', '33', '39', '49', '966', '968', '974'];
  const stripPrefix = (digits: string): string => {
    for (const code of dialCodes) {
      if (digits.startsWith(`00${code}`)) return digits.slice(2 + code.length);
      if (digits.startsWith(code) && digits.length >= code.length + 7) return digits.slice(code.length);
    }
    return digits;
  };

  const queryStripped = stripPrefix(queryDigits);
  const storedStripped = stripPrefix(storedDigits);

  if (queryStripped.length >= 2) {
    if (storedStripped.includes(queryStripped) || storedDigits.includes(queryStripped)) {
      return true;
    }
  }

  // 4. Comparaison via données structurées PhoneInfo
  const dataQuery = extractPhoneData(rawQuery);
  const dataStored = extractPhoneData(rawStored);

  if (dataQuery.nationalDigits && dataStored.nationalDigits) {
    if (
      dataStored.nationalDigits.includes(dataQuery.nationalDigits) ||
      dataQuery.nationalDigits.includes(dataStored.nationalDigits)
    ) {
      return true;
    }
  }

  if (dataQuery.internationalDigits && dataStored.internationalDigits) {
    if (
      dataStored.internationalDigits.includes(dataQuery.internationalDigits) ||
      dataQuery.internationalDigits.includes(dataStored.internationalDigits)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Détermine avec certitude si deux numéros de téléphone désignent le même numéro,
 * en gérant avec une intégrité absolue les indicatifs internationaux des 7 pays supportés.
 */
export function isSamePhone(phoneA?: string | null, phoneB?: string | null): boolean {
  if (!phoneA || !phoneB) return false;
  const dataA = extractPhoneData(phoneA);
  const dataB = extractPhoneData(phoneB);

  // 1. Les deux numéros ont été résolus avec des chiffres internationaux complets
  if (dataA.internationalDigits && dataB.internationalDigits) {
    return dataA.internationalDigits === dataB.internationalDigits;
  }

  // 2. Chiffres nationaux et même pays résolu
  if (
    dataA.country !== 'UNKNOWN' &&
    dataA.country === dataB.country &&
    dataA.nationalDigits &&
    dataB.nationalDigits
  ) {
    return dataA.nationalDigits === dataB.nationalDigits;
  }

  // 3. Fallback chiffres purs stricts
  const rawDigitsA = String(phoneA).replace(/\D/g, '');
  const rawDigitsB = String(phoneB).replace(/\D/g, '');
  return rawDigitsA.length > 0 && rawDigitsA === rawDigitsB;
}

/**
 * Génère une expression régulière MongoDB permettant de retrouver
 * un numéro sous toutes ses formes (avec ou sans '+', avec '00', avec ou sans indicatif, espaces, tirets).
 */
export function buildPhoneMongoRegex(rawPhone: string): RegExp {
  const data = extractPhoneData(rawPhone);
  const digits = data.nationalDigits || rawPhone.replace(/\D/g, '');

  if (!digits || digits.length < 6) {
    const escaped = rawPhone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped}$`, 'i');
  }

  const digitPattern = digits.split('').join('[\\s.-]*');

  // Si pays résolu parmi les 7 pays
  if (data.country !== 'UNKNOWN' && data.countryCode) {
    const code = data.countryCode;
    // Permet :
    // - '+<code> ...'
    // - '00<code> ...'
    // - '<code> ...'
    // - Sans indicatif (avec éventuel 0 initial pour France/Allemagne/Saoudite)
    return new RegExp(`^(?:\\+?${code}|00${code})?[\\s.-]*0?${digitPattern}$`, 'i');
  }

  // Fallback multi-indicatif général
  return new RegExp(`^(?:\\+?(?:216|33|39|49|966|968|974)|00(?:216|33|39|49|966|968|974))?[\\s.-]*0?${digitPattern}$`, 'i');
}
