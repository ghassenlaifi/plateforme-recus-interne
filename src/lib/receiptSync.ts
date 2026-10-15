import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import { formatPhone, extractPhoneDigits, isSamePhone, buildPhoneMongoRegex } from '@/lib/phoneUtils';
import { generateReceiptReference } from '@/lib/receiptReference';
import { invalidateLeadsCache, updateCachedLeadInPlace } from '@/lib/leadsCache';

/**
 * Construit les conditions de recherche MongoDB ultra-résistantes
 * pour matcher un numéro sous toutes ses formes (formaté, brut, 8 chiffres, international).
 */
export function buildPhoneMatchConditions(phone: string): any[] {
  const rawPhone = String(phone || '').trim();
  const digitsOnly = extractPhoneDigits(rawPhone) || rawPhone.replace(/\D/g, '');
  const norm8 = digitsOnly.length > 8 && digitsOnly.startsWith('216') 
    ? digitsOnly.slice(-8) 
    : (digitsOnly.length === 8 ? digitsOnly : digitsOnly);

  const phoneOrConditions: any[] = [
    { phone: rawPhone },
    { phone: digitsOnly },
    { phone: norm8 }
  ];

  if (norm8.length === 8) {
    const regex = buildPhoneMongoRegex(norm8);
    phoneOrConditions.push({ phone: regex });
  }

  return phoneOrConditions;
}

export interface TriggerCrmApprovalParams {
  telephone: string | undefined | null;
  amount: number | undefined;
  operatorName: string | undefined;
  reference: string | undefined;
  paymentDate?: Date | string | null;
}

/**
 * Valide et passe un prospect en statut 'Approved' dans le CRM suite à l'encaissement d'un reçu.
 * Enregistre l'ancien statut ('previousStatus') dans la note système pour permettre un rollback parfait.
 */
export async function triggerCrmApproval({
  telephone,
  amount,
  operatorName,
  reference,
  paymentDate
}: TriggerCrmApprovalParams) {
  try {
    await connectToDatabase();
    if (!telephone || !String(telephone).trim() || telephone === '00000000') return;

    const phoneOrConditions = buildPhoneMatchConditions(telephone);
    const matchingLeads = await Lead.find({ $or: phoneOrConditions });
    if (!matchingLeads || matchingLeads.length === 0) return;

    const targetDateObj = paymentDate ? new Date(paymentDate) : new Date();
    const effectiveOp = operatorName || 'Système';
    const now = new Date();

    for (const lead of matchingLeads) {
      const existingNotes = Array.isArray(lead.notes) ? [...lead.notes] : [];

      // 1. Détection de doublon par référence identique
      const hasSameRef = reference && existingNotes.some((n: any) => {
        if (!n) return false;
        if (n.receiptRef && n.receiptRef === reference) return true;
        return n.text && n.text.includes(reference);
      });

      // 2. Détection de doublon par mois civil ou intervalle inférieur à 25 jours
      const hasSameMonthAutoNote = existingNotes.some((n: any) => {
        if (!n || !n.text) return false;
        const isAuto = n.text.includes('Inscription validée automatiquement via Elios Workspace');
        if (!isAuto) return false;

        const noteDateVal = n.date || n.addedAt;
        if (!noteDateVal) return false;
        const nd = new Date(noteDateVal);
        if (isNaN(nd.getTime())) return false;
        const noteMonthKey = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`;
        const targetMonthKey = `${targetDateObj.getFullYear()}-${String(targetDateObj.getMonth() + 1).padStart(2, '0')}`;
        if (noteMonthKey === targetMonthKey) return true;
        const diffMs = Math.abs(targetDateObj.getTime() - nd.getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays < 25;
      });

      const setFields: any = {
        status: 'Approved'
      };

      if (amount && (!lead.amount || Number(lead.amount) === 0)) {
        setFields.amount = String(amount);
      }

      if (hasSameRef) {
        console.log(`[CRM Auto-Approval Skipped] Note avec réf ${reference} déjà présente sur le prospect ${lead._id} (${lead.crmType}).`);
        await Lead.updateOne({ _id: lead._id }, { $set: setFields });
        continue;
      }

      if (hasSameMonthAutoNote) {
        console.log(`[CRM Auto-Approval Skipped] Note automatique déjà présente ce mois sur le prospect ${lead._id} (${lead.crmType}).`);
        await Lead.updateOne({ _id: lead._id }, { $set: setFields });
        continue;
      }

      // 3. Création officielle de la note système avec snapshot de l'ancien statut
      const newNote = {
        id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        text: `Inscription validée automatiquement via Elios Workspace (Montant: ${amount || 0} DT, Réf: ${reference || ''})`,
        by: effectiveOp,
        addedBy: effectiveOp,
        date: now.toISOString(),
        addedAt: now,
        receiptRef: reference || '',
        previousStatus: lead.status || 'Lead'
      };

      setFields.notes = [newNote, ...existingNotes];
      setFields.updatedAt = now;
      setFields.lastModifiedBy = effectiveOp;

      const updateOp: any = { $set: setFields };
      if (effectiveOp.toLowerCase() !== 'système' && effectiveOp.toLowerCase() !== 'systeme') {
        updateOp.$addToSet = { modifiers: effectiveOp };
        updateOp.$push = {
          modifierLogs: {
            $each: [{ operator: effectiveOp, at: now, action: 'auto_approval_receipt' }],
            $slice: -100
          }
        };
      }

      await Lead.updateOne({ _id: lead._id }, updateOp);
      
      const updatedDoc = {
        ...(lead.toObject ? lead.toObject() : lead),
        ...setFields
      };
      updateCachedLeadInPlace(lead.crmType as 'elios' | 'formatic', updatedDoc);
      console.log(`[CRM Auto-Approval] Lead ${lead.id || lead._id} (${lead.crmType}) validé Approved via reçu ${reference || ''}.`);
    }

    invalidateLeadsCache('all');
  } catch (crmErr) {
    console.error('[CRM Auto-Approval Error] Failed to update CRM lead automatically:', crmErr);
  }
}

export interface RollbackCrmApprovalParams {
  telephone: string | undefined | null;
  reference: string | undefined;
  newTelephone?: string | null;
  newReference?: string | null;
  operatorName?: string | null;
}

/**
 * Exécute un rollback automatique, rigoureux et traçable du prospect lié à l'ancien numéro de téléphone :
 * 1. Retire la note système de validation correspondant à la référence du reçu.
 * 2. Vérifie si le prospect a d'autres reçus valides. Si non, rétablit son statut d'origine ('previousStatus').
 * 3. Ajoute une note d'audit claire expliquant la réaffectation du reçu.
 */
export async function rollbackCrmApproval({
  telephone,
  reference,
  newTelephone,
  newReference,
  operatorName
}: RollbackCrmApprovalParams) {
  try {
    await connectToDatabase();
    if (!telephone || !reference || telephone === '00000000') return;

    const phoneOrConditions = buildPhoneMatchConditions(telephone);
    const matchingLeads = await Lead.find({ $or: phoneOrConditions });
    if (!matchingLeads || matchingLeads.length === 0) return;

    const now = new Date();
    const effectiveOp = operatorName || 'Système';

    for (const lead of matchingLeads) {
      const existingNotes = Array.isArray(lead.notes) ? [...lead.notes] : [];

      // Trouver la note de validation associée à ce reçu spécifique
      const noteIndex = existingNotes.findIndex((n: any) => {
        if (!n) return false;
        if (n.receiptRef && n.receiptRef === reference) return true;
        return n.text && n.text.includes(reference);
      });

      if (noteIndex === -1) {
        console.log(`[Rollback Skipped] Aucune note système avec réf ${reference} trouvée sur le lead ${lead._id}.`);
        continue;
      }

      const matchedNote = existingNotes[noteIndex];

      // Déterminer le statut précédent
      let previousStatus = matchedNote.previousStatus;
      if (!previousStatus) {
        // Fallback intelligent en consultant les logs d'activité précédents
        const logs = Array.isArray(lead.modifierLogs) ? lead.modifierLogs : [];
        const priorLog = logs.slice().reverse().find((l: any) => l.action !== 'auto_approval_receipt' && l.status);
        if (priorLog?.status) {
          previousStatus = priorLog.status;
        } else {
          // Si le prospect avait des notes antérieures suggérant 'Potential Prospect' ou 'Lead'
          const hasPotentialHint = existingNotes.some((n: any) => n.text?.toLowerCase().includes('potential'));
          previousStatus = hasPotentialHint ? 'Potential Prospect' : 'Lead';
        }
      }

      // Vérifier si le prospect possède un AUTRE reçu valide encore actif dans ses notes
      const hasOtherReceiptValidation = existingNotes.some((n: any, idx: number) => {
        if (idx === noteIndex || !n || !n.text) return false;
        const isAuto = n.text.includes('Inscription validée') || (n.id && String(n.id).startsWith('auto-'));
        if (!isAuto) return false;
        if (reference && ((n.receiptRef && n.receiptRef === reference) || n.text.includes(reference))) return false;
        return true;
      });

      // Retirer la note système du reçu erroné
      existingNotes.splice(noteIndex, 1);

      // Statut final : Approved s'il a un autre reçu valide, sinon restauration du statut précédent
      const finalStatus = hasOtherReceiptValidation ? 'Approved' : (previousStatus || 'Lead');

      const updateOp: any = {
        $set: {
          status: finalStatus,
          notes: existingNotes,
          updatedAt: now,
          lastModifiedBy: effectiveOp
        }
      };

      if (effectiveOp.toLowerCase() !== 'système' && effectiveOp.toLowerCase() !== 'systeme') {
        updateOp.$addToSet = { modifiers: effectiveOp };
        updateOp.$push = {
          modifierLogs: {
            $each: [{ operator: effectiveOp, at: now, action: 'receipt_reassigned_rollback' }],
            $slice: -100
          }
        };
      }

      await Lead.updateOne({ _id: lead._id }, updateOp);

      const updatedDoc = {
        ...(lead.toObject ? lead.toObject() : lead),
        status: finalStatus,
        notes: existingNotes,
        updatedAt: now,
        lastModifiedBy: effectiveOp
      };
      updateCachedLeadInPlace(lead.crmType as 'elios' | 'formatic', updatedDoc);

      console.log(`[Rollback Effectué] Lead ${lead._id} (${lead.phone}) : reçu ${reference} retiré, statut rétabli à ${finalStatus}.`);
    }

    invalidateLeadsCache('all');
  } catch (err) {
    console.error('[CRM Rollback Error] Échec du rollback automatique du prospect:', err);
  }
}

export interface ReassignReceiptPhoneParams {
  existingReceipt: any;
  newTelephone: string;
  newReference?: string;
  amount?: number;
  operatorName?: string;
  paymentDate?: Date | string | null;
}

/**
 * Orchestrateur de réaffectation d'un reçu vers un nouveau numéro de téléphone :
 * 1. Recalcule automatiquement la RÉFÉRENCE officielle conforme à la formule EA-[TEL]-[DATE].
 * 2. Effectue le ROLLBACK sur l'ancien numéro (retrait de note avec ancienne référence + restauration statut).
 * 3. Applique l'APPROBATION sur le nouveau numéro (statut Approved + note système avec la nouvelle référence).
 * 4. Met à jour les caches et la synchronisation multi-onglets temps réel.
 */
export async function handleReceiptPhoneReassignment({
  existingReceipt,
  newTelephone,
  newReference,
  amount,
  operatorName,
  paymentDate
}: ReassignReceiptPhoneParams) {
  if (!existingReceipt || !newTelephone) return;

  const oldPhone = existingReceipt.clientDetails?.telephone;
  const oldReference = existingReceipt.reference;
  const effectiveAmount = amount !== undefined ? amount : existingReceipt.amount;
  const effectiveOp = operatorName || existingReceipt.lastModifiedBy || existingReceipt.operatorName || 'Système';
  const effectiveDate = paymentDate !== undefined ? paymentDate : existingReceipt.paymentDate;

  // Calculer la nouvelle référence conforme à la nomenclature EA-[TEL]-[DATE] si non fournie
  const targetReference = newReference || generateReceiptReference(newTelephone, effectiveDate);

  // Si le numéro n'a pas changé, aucune réaffectation nécessaire
  if (oldPhone && isSamePhone(oldPhone, newTelephone)) {
    return { newReference: targetReference };
  }

  console.log(`[Receipt Phone Reassignment] Référence recalculée : ${oldReference} -> ${targetReference} (Tél: ${oldPhone} -> ${newTelephone}) par ${effectiveOp}.`);

  // 1. ROLLBACK DE L'ANCIEN PROSPECT
  if (oldPhone && oldPhone !== '00000000') {
    await rollbackCrmApproval({
      telephone: oldPhone,
      reference: oldReference,
      newTelephone,
      newReference: targetReference,
      operatorName: effectiveOp
    });
  }

  // 2. APPROBATION DU NOUVEAU PROSPECT (AVEC LA NOUVELLE RÉFÉRENCE)
  await triggerCrmApproval({
    telephone: newTelephone,
    amount: effectiveAmount,
    operatorName: effectiveOp,
    reference: targetReference,
    paymentDate: effectiveDate
  });

  invalidateLeadsCache('all');

  return { newReference: targetReference };
}
