/**
 * Helper officiel de génération de la référence de reçu Elios Academy.
 *
 * Nomenclature standardisée :
 * EA - [3 premiers chiffres tél] - [3 chiffres suivants tél] - [2 derniers chiffres tél + 1er chiffre du jour] - [2ème chiffre du jour + 2 chiffres du mois]
 *
 * Exemple :
 * Tél : 92 330 331 (92330331)
 * Date : 29/09/2026
 * -> EA - 923 - 330 - 312 - 909
 */
import { extractPhoneDigits } from '@/lib/phoneUtils';

export function generateReceiptReference(phone: string, dateInput?: Date | string | null): string {
  // 1. Nettoyer le numéro de téléphone pour extraire exactement les 8 chiffres tunisiens
  let digits = extractPhoneDigits(phone);

  // Fallback si moins de 8 chiffres
  if (digits.length < 8) {
    digits = digits.padEnd(8, '0');
  }

  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const remainingPhone = digits.slice(6, 8);

  // 2. Extraire les composantes de la date
  const date = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(date.getTime()) ? new Date() : date;

  const dayStr = String(validDate.getDate()).padStart(2, '0'); // ex: "29"
  const monthStr = String(validDate.getMonth() + 1).padStart(2, '0'); // ex: "09"

  const dayFirstDigit = dayStr[0]; // "2"
  const daySecondDigit = dayStr[1]; // "9"

  const part3 = `${remainingPhone}${dayFirstDigit}`; // "31" + "2" = "312"
  const part4 = `${daySecondDigit}${monthStr}`; // "9" + "09" = "909"

  return `EA-${part1}-${part2}-${part3}-${part4}`;
}

