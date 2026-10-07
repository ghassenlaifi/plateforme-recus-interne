import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Receipt from '@/models/Receipt';
import Lead from '@/models/Lead';
import { uploadFileToDrive } from '@/lib/googleDrive';
import { generateReceiptReference } from '@/lib/receiptReference';
import { formatPhone } from '@/lib/phoneUtils';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    const paymentMode = url.searchParams.get('paymentMode');
    const paymentDetails = url.searchParams.get('paymentDetails');
    
    let query: any = {};
    if (status === 'all') {
      query.status = { $in: ['PENDING', 'PROCESSED', 'ARCHIVED'] };
    } else if (status) {
      query.status = status;
    } else {
      query.status = { $in: ['PENDING', 'PROCESSED'] };
    }
    
    if (paymentMode) {
      query.paymentMode = { $regex: new RegExp(`^${paymentMode.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') };
    }
    if (paymentDetails) {
      query.paymentDetails = { $regex: new RegExp(`^${paymentDetails.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') };
    }

    const receipts = await Receipt.find(query).sort({ createdAt: -1 });

    const receiptsWithRef = receipts.map((r) => {
      const doc = r.toObject();
      if (!doc.reference) {
        doc.reference = generateReceiptReference(doc.clientDetails?.telephone || '', doc.paymentDate || doc.createdAt);
      }
      return doc;
    });

    return NextResponse.json(receiptsWithRef, { status: 200 });
  } catch (error: any) {
    console.error('Error in GET /api/receipts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function triggerCrmApproval(
  telephone: string | undefined | null,
  amount: number | undefined,
  operatorName: string | undefined,
  reference: string | undefined
) {
  try {
    if (!telephone || !String(telephone).trim() || telephone === '00000000') return;
    const rawPhone = String(telephone).trim();
    const digitsOnly = rawPhone.replace(/\D/g, '');
    const norm8 = digitsOnly.length > 8 && digitsOnly.startsWith('216') 
      ? digitsOnly.slice(-8) 
      : (digitsOnly.length === 8 ? digitsOnly : digitsOnly);

    const phoneOrConditions: any[] = [
      { phone: rawPhone },
      { phone: digitsOnly },
      { phone: norm8 }
    ];

    if (norm8.length === 8) {
      const spacedPattern = norm8.split('').join('[\\s.-]*');
      phoneOrConditions.push({ phone: { $regex: new RegExp(`${spacedPattern}$`) } });
    }

    const matchingLeads = await Lead.find({ $or: phoneOrConditions });

    for (const lead of matchingLeads) {
      const updatedNotes = Array.isArray(lead.notes) ? [...lead.notes] : [];
      updatedNotes.unshift({
        text: `Inscription validée automatiquement via Elios Workspace (Montant: ${amount || 0} DT, Réf: ${reference || ''})`,
        by: operatorName || 'Système',
        addedBy: operatorName || 'Système',
        date: new Date().toISOString(),
        addedAt: new Date()
      });

      const setFields: any = {
        status: 'Approved',
        notes: updatedNotes,
      };

      if (amount && (!lead.amount || Number(lead.amount) === 0)) {
        setFields.amount = String(amount);
      }

      await Lead.updateOne({ _id: lead._id }, { $set: setFields });
      console.log(`[CRM Auto-Approval] Lead ${lead.id || lead._id} (${lead.crmType}) automatically approved via receipt ${reference || ''}.`);
    }
  } catch (crmErr) {
    console.error('[CRM Auto-Approval Error] Failed to update CRM lead automatically:', crmErr);
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // Cas JSON : déduction manuelle de portefeuille / création directe
    if (contentType.includes('application/json')) {
      const body = await req.json();
      await connectToDatabase();

      const operatorName = body.operator || body.operatorName || 'Système';
      const amountStr = body.clientDetails?.amount || body.amount;
      const amount = parseFloat(amountStr);
      const paymentMethod = body.clientDetails?.paymentMethod || body.paymentMode || '';

      let mode = paymentMethod;
      let details = body.paymentDetails || '';
      if (paymentMethod.includes(' - ')) {
        const parts = paymentMethod.split(' - ');
        mode = parts[0].trim();
        details = parts.slice(1).join(' - ').trim();
      }

      if (mode.toLowerCase().startsWith('virement')) mode = 'Virement Bancaire';
      else if (mode.toLowerCase().startsWith('edinar') || mode.toLowerCase().includes('d17')) mode = 'Edinar - D17';
      else if (mode.toLowerCase().includes('esp')) mode = 'Espèces';

      const rawPhone = body.clientDetails?.telephone || body.clientDetails?.phone || body.telephone || body.phone || '00000000';
      const phoneVal = formatPhone(rawPhone) || rawPhone;
      const nameVal = body.clientDetails?.nom || body.clientDetails?.name || body.nom || body.name || 'DÉDUCTION MANUELLE';
      const classVal = body.clientDetails?.classe || body.clientDetails?.offer || body.classe || 'N/A';

      const ref = body.reference || ('DED-' + Date.now());

      const newReceipt = await Receipt.create({
        operatorName,
        clientDetails: {
          nom: nameVal,
          telephone: phoneVal,
          classe: classVal,
        },
        paymentMode: mode,
        paymentDetails: details,
        paymentDate: new Date(),
        amount: isNaN(amount) ? 0 : amount,
        reference: ref,
        notes: body.clientDetails?.note || body.notes ? [{
          text: body.clientDetails?.note || (typeof body.notes === 'string' ? body.notes : 'Note système'),
          addedBy: operatorName,
          addedAt: new Date(),
        }] : [],
        gDriveFileId: body.imageId || ('deduction-' + Date.now()),
        gDriveViewUrl: body.gDriveViewUrl || 'https://drive.google.com/system-deduction',
        status: 'PROCESSED',
      });

      // Synchronisation CRM automatique
      await triggerCrmApproval(phoneVal, isNaN(amount) ? 0 : amount, operatorName, ref);

      return NextResponse.json(newReceipt, { status: 201 });
    }

    const formData = await req.formData();
    
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Le fichier image est requis' }, { status: 400 });
    }

    // Tolérance pour les noms de champs venant de l'ancien/nouveau frontend
    const operatorName = (formData.get('operatorName') || formData.get('uploadedBy')) as string;
    const nom = (formData.get('clientName') || formData.get('nom')) as string;
    const rawTelephone = ((formData.get('clientPhone') || formData.get('telephone')) as string) || '';
    const telephone = formatPhone(rawTelephone) || rawTelephone;
    const classe = (formData.get('clientClass') || formData.get('classe')) as string;
    
    const email = (formData.get('clientEmail') || formData.get('email')) as string | null;
    const familyGroup = formData.get('familyGroup') as string | null;
    
    let paymentMode = (formData.get('paymentMode') || formData.get('mode')) as string | null;
    const paymentDetails = (formData.get('paymentDetails') || formData.get('wallet')) as string | null;
    const paymentDate = formData.get('paymentDate') as string | null;
    const amountStr = formData.get('amount') as string | null;
    const amount = amountStr ? parseFloat(amountStr) : undefined;
    const note = formData.get('note') as string | null;

    if (paymentMode) {
      if (paymentMode.toLowerCase().startsWith('virement')) paymentMode = 'Virement Bancaire';
      else if (paymentMode.toLowerCase().startsWith('edinar') || paymentMode.toLowerCase().includes('d17')) paymentMode = 'Edinar - D17';
      else if (paymentMode.toLowerCase().includes('esp')) paymentMode = 'Espèces';
    }

    const notes: any[] = [];
    if (note) {
      notes.push({
        text: note,
        addedBy: operatorName,
        addedAt: new Date(),
      });
    }

    // 1. Validation rigoureuse (classe n'est plus obligatoire)
    if (!operatorName || !telephone || !paymentMode || !paymentDetails || amount === undefined || isNaN(amount)) {
      return NextResponse.json({ error: 'Les champs obligatoires (opérateur, téléphone, mode de paiement, détails et montant) sont manquants ou invalides' }, { status: 400 });
    }

    // 2. Convertir le fichier en Buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 3. Appel à Google Drive pour uploader
    let fileId, webViewLink;
    try {
      const uploadRes = await uploadFileToDrive(buffer, file.type, file.name);
      fileId = uploadRes.fileId;
      webViewLink = uploadRes.webViewLink;
    } catch (uploadError: any) {
      console.error('Drive Upload Error:', uploadError);
      return NextResponse.json({ error: `Erreur Google Drive: ${uploadError.message}` }, { status: 500 });
    }

    // 4. Connexion MongoDB
    await connectToDatabase();

    // 5. Création et sauvegarde du document
    const effectiveDate = paymentDate ? new Date(paymentDate) : new Date();
    const reference = generateReceiptReference(telephone, effectiveDate);

    const newReceipt = await Receipt.create({
      operatorName,
      clientDetails: {
        nom,
        telephone,
        ...(classe && { classe }),
        ...(email && { email }),
        ...(familyGroup && { familyGroup }),
      },
      ...(paymentMode && { paymentMode }),
      ...(paymentDetails && { paymentDetails }),
      ...(paymentDate && { paymentDate: effectiveDate }),
      amount,
      reference,
      notes,
      gDriveFileId: fileId,
      gDriveViewUrl: webViewLink,
      status: 'PENDING',
    });

    // Synchronisation CRM automatique
    await triggerCrmApproval(telephone, amount, operatorName, newReceipt.reference || reference);


    // 6. Retour de la réponse JSON au client
    return NextResponse.json(newReceipt, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/receipts:', error);
    return NextResponse.json({ error: error.message || 'Erreur interne du serveur lors de la création du reçu' }, { status: 500 });
  }
}
