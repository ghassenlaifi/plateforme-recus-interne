import mongoose from 'mongoose';
import Receipt from '@/models/Receipt';
import { buildPhoneMongoRegex, extractPhoneDigits, formatPhone } from '@/lib/phoneUtils';

export interface MonthlyReceiptConflict {
  hasConflict: boolean;
  conflictReceipt?: any;
  error?: string;
}

/**
 * Règle militaire d'intégrité financière :
 * Un seul reçu peut être importé pour un même numéro de téléphone au cours d'un même mois.
 * 
 * Critères stricts de détection de conflit :
 * 1. Même numéro de téléphone (normalisé, 8 chiffres ou regex universelle).
 * 2. Statut actif (exclusion stricte des reçus ARCHIVED).
 * 3. Même mois civil (Année + Mois) OU intervalle strictement inférieur à 25 jours calendaires.
 */
export async function checkMonthlyReceiptConflict(
  phone: string,
  targetDateInput?: Date | string | null,
  excludeReceiptId?: string | null
): Promise<MonthlyReceiptConflict> {
  const digits = extractPhoneDigits(phone);
  if (!digits || digits.length < 8 || /^0+$/.test(digits)) {
    return { hasConflict: false };
  }

  const targetDate = targetDateInput ? new Date(targetDateInput) : new Date();
  const validTargetDate = isNaN(targetDate.getTime()) ? new Date() : targetDate;

  // Calcul des bornes du mois civil cible (du 1er au dernier jour du mois)
  const targetYear = validTargetDate.getFullYear();
  const targetMonth = validTargetDate.getMonth();
  const startOfMonth = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

  // Fenêtre glissante de 25 jours calendaires (pour éviter les doublons accidentels à cheval sur 2 mois)
  const twentyFiveDaysBefore = new Date(validTargetDate.getTime() - 25 * 24 * 60 * 60 * 1000);
  const twentyFiveDaysAfter = new Date(validTargetDate.getTime() + 25 * 24 * 60 * 60 * 1000);

  // Expression régulière MongoDB universelle
  const phoneRegex = buildPhoneMongoRegex(digits);

  const query: any = {
    $or: [
      { 'clientDetails.telephone': phoneRegex },
      { 'clientDetails.telephone': digits },
      { 'clientDetails.telephone': formatPhone(digits) },
      { 'clientDetails.phone': phoneRegex },
      { 'clientDetails.phone': digits },
      { telephone: phoneRegex },
      { phone: phoneRegex }
    ],
    status: { $ne: 'ARCHIVED' },
    $and: [
      {
        $or: [
          // Conflit par paymentDate
          { paymentDate: { $gte: startOfMonth, $lte: endOfMonth } },
          { paymentDate: { $gte: twentyFiveDaysBefore, $lte: twentyFiveDaysAfter } },
          // Conflit par createdAt si paymentDate absent
          { paymentDate: { $exists: false }, createdAt: { $gte: startOfMonth, $lte: endOfMonth } },
          { paymentDate: null, createdAt: { $gte: startOfMonth, $lte: endOfMonth } },
          { paymentDate: { $exists: false }, createdAt: { $gte: twentyFiveDaysBefore, $lte: twentyFiveDaysAfter } },
          { paymentDate: null, createdAt: { $gte: twentyFiveDaysBefore, $lte: twentyFiveDaysAfter } }
        ]
      }
    ]
  };

  if (excludeReceiptId) {
    if (mongoose.Types.ObjectId.isValid(excludeReceiptId)) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeReceiptId) };
    } else {
      query._id = { $ne: excludeReceiptId };
    }
  }

  const existingReceipt = await Receipt.findOne(query).sort({ paymentDate: -1, createdAt: -1 }).lean();

  if (!existingReceipt) {
    return { hasConflict: false };
  }

  // Formatage détaillé et lisible pour l'opérateur
  const existingDateObj = (existingReceipt as any).paymentDate 
    ? new Date((existingReceipt as any).paymentDate) 
    : new Date((existingReceipt as any).createdAt);

  const dateFormatted = !isNaN(existingDateObj.getTime())
    ? `${String(existingDateObj.getDate()).padStart(2, '0')}/${String(existingDateObj.getMonth() + 1).padStart(2, '0')}/${existingDateObj.getFullYear()}`
    : 'Date non précisée';

  const monthFrNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const monthName = !isNaN(existingDateObj.getTime()) ? `${monthFrNames[existingDateObj.getMonth()]} ${existingDateObj.getFullYear()}` : 'ce mois-ci';

  const ref = (existingReceipt as any).reference || (existingReceipt as any)._id;
  const amt = (existingReceipt as any).amount || 0;
  const mode = (existingReceipt as any).paymentMode || 'N/A';
  const op = (existingReceipt as any).operatorName || 'Système';

  const errorMessage = `Règle d'intégrité stricte : Un seul reçu peut être importé par numéro de téléphone au cours d'un même mois. Un reçu existe déjà pour ce numéro (${formatPhone(digits)}) pour ${monthName} (enregistré le ${dateFormatted}, Réf: ${ref}, Montant: ${amt} DT via ${mode}, Opérateur: ${op}). Un intervalle minimum d'un mois est obligatoire entre deux échéances.`;

  return {
    hasConflict: true,
    conflictReceipt: existingReceipt,
    error: errorMessage
  };
}

