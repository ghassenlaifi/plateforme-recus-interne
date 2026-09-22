import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Receipt from '@/models/Receipt';
import { uploadFileToDrive } from '@/lib/googleDrive';

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
    
    if (paymentMode) query.paymentMode = paymentMode;
    if (paymentDetails) query.paymentDetails = paymentDetails;

    const receipts = await Receipt.find(query).sort({ createdAt: -1 });

    return NextResponse.json(receipts, { status: 200 });
  } catch (error: any) {
    console.error('Error in GET /api/receipts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Le fichier image est requis' }, { status: 400 });
    }

    // Tolérance pour les noms de champs venant de l'ancien/nouveau frontend
    const operatorName = (formData.get('operatorName') || formData.get('uploadedBy')) as string;
    const nom = (formData.get('clientName') || formData.get('nom')) as string;
    const telephone = (formData.get('clientPhone') || formData.get('telephone')) as string;
    const classe = (formData.get('clientClass') || formData.get('classe')) as string;
    
    const email = (formData.get('clientEmail') || formData.get('email')) as string | null;
    const familyGroup = formData.get('familyGroup') as string | null;
    
    const paymentMode = formData.get('paymentMode') as string | null;
    const paymentDetails = formData.get('paymentDetails') as string | null;
    const paymentDate = formData.get('paymentDate') as string | null;
    const amountStr = formData.get('amount') as string | null;
    const amount = amountStr ? parseFloat(amountStr) : undefined;
    const note = formData.get('note') as string | null;

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
      ...(paymentDate && { paymentDate: new Date(paymentDate) }),
      amount,
      notes,
      gDriveFileId: fileId,
      gDriveViewUrl: webViewLink,
      status: 'PENDING',
    });

    // 6. Retour de la réponse JSON au client
    return NextResponse.json(newReceipt, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/receipts:', error);
    return NextResponse.json({ error: error.message || 'Erreur interne du serveur lors de la création du reçu' }, { status: 500 });
  }
}
