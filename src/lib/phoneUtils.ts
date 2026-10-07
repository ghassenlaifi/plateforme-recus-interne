/**
 * Utilitaires universels de normalisation et formatage des numéros de téléphone (Tunisie).
 *
 * Supporte toutes les formes d'entrée :
 * - +216 92330331
 * - +216 92 330 331
 * - + 216 92 330 331
 * - (+216) 92 330 331
 * - 00216 92 330 331
 * - 0021692330331
 * - 21692330331
 * - 216 92330331
 * - 216 92 330 331
 * - 216-92-330-331
 * - 92 330 331
 * - 92330331
 * - 92-330-331 / 92.330.331
 *
 * Résultat normalisé pour la sauvegarde et l'aperçu : "92 330 331" (format 2-3-3).
 */

/**
 * Extrait les 8 chiffres d'un numéro tunisien en nettoyant les préfixes (+216, 00216, 216),
 * les espaces et les séparateurs.
 */
export function extractPhoneDigits(raw?: string | null): string {
  if (!raw) return '';
  let str = String(raw).trim();

  // 1. Enlever les formats préfixes explicites au début :
  // - Avec '+' : +216, + 216, (+216), etc.
  // - Avec '00' : 00216, 00 216, (00216), etc.
  // - '216' suivi d'un séparateur (espace, tiret, point, slash) : 216 92330331, 216-92-330-331
  str = str.replace(/^(\+\s*216|00\s*216|\(\s*\+?\s*216\s*\)|\(\s*00\s*216\s*\)|216[\s\.\-\/]+)/i, '');

  // 2. Extraire les chiffres restants
  let digits = str.replace(/\D/g, '');

  // 3. Si les chiffres commencent encore par 00216
  if (digits.startsWith('00216')) {
    digits = digits.slice(5);
  }
  // 4. Si les chiffres commencent par 216 et font 11 chiffres (216 + 8 chiffres tunisiens)
  else if (digits.startsWith('216') && digits.length >= 11) {
    digits = digits.slice(3);
  }

  // On limite strictement aux 8 chiffres du numéro tunisien
  return digits.slice(0, 8);
}

/**
 * Formate un numéro de téléphone sous la forme normalisée "XX XXX XXX" (ex : "92 330 331").
 * Utilisé à la fois :
 * 1. Pendant la saisie utilisateur en temps réel (auto-masking progressif)
 * 2. Lors de la sauvegarde (entrée sauvegardée au format normalisé)
 * 3. Lors de l'affichage dans les tableaux, cartes, badges et fiches (aperçu normalisé)
 */
export function formatPhone(raw?: string | null): string {
  const digits = extractPhoneDigits(raw);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
}

/**
 * Alias de formatPhone pour les gestionnaires d'input onChange.
 */
export function formatPhoneInput(raw?: string | null): string {
  return formatPhone(raw);
}

/**
 * Retourne le numéro au format international compact pour les URLs WhatsApp et appels (ex : "21692330331").
 */
export function normalizePhoneForUrl(raw?: string | null): string {
  const digits = extractPhoneDigits(raw);
  if (!digits) return '';
  return `216${digits}`;
}

/**
 * Valide si le numéro contient bien exactement 8 chiffres tunisiens commençant par un préfixe valide.
 */
export function isValidTunisianPhone(raw?: string | null): boolean {
  const digits = extractPhoneDigits(raw);
  return digits.length === 8 && /^[234579]/.test(digits);
}
