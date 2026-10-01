import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Receipt from '@/models/Receipt';
import { deleteFileFromDrive } from '@/lib/googleDrive';

type Params = { id: string };

export async function PATCH(req: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id } = await Promise.resolve(params); // Next.js 15+ compatibility for params
    const body = await req.json();

    await connectToDatabase();

    const existingReceipt = await Receipt.findById(id);
    if (!existingReceipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    // Règle stricte: si le reçu est déjà traité, ses informations ne sont jamais modifiables
    if (existingReceipt.status === 'PROCESSED') {
      return NextResponse.json(
        { error: "Les informations d'un reçu déjà traité ne sont pas modifiables." },
        { status: 403 }
      );
    }

    const updateOps: any = {};
    const setFields: any = {};

    // 1. Mise à jour des informations de l'élève
    if (body.clientDetails) {
      setFields.clientDetails = body.clientDetails;
    }

    // 2. Mise à jour du mode et portefeuille destination
    if (body.paymentMode !== undefined) setFields.paymentMode = body.paymentMode;
    if (body.paymentDetails !== undefined) setFields.paymentDetails = body.paymentDetails;
    if (body.paymentDate !== undefined) setFields.paymentDate = new Date(body.paymentDate);
    if (body.amount !== undefined) setFields.amount = Number(body.amount);

    // 3. Statut Traité / En attente
    if (body.status === 'PROCESSED') {
      setFields.status = 'PROCESSED';
      setFields.processedBy = body.processedBy || 'Elios';
      setFields.processedAt = new Date();
      setFields.lockedBy = null;
      setFields.lockedAt = null;
    } else if (body.status) {
      setFields.status = body.status;
    }

    // 4. Verrouillage
    if (typeof body.lock === 'boolean') {
      setFields.lockedBy = body.lock ? body.lockedBy : null;
      setFields.lockedAt = body.lock ? new Date() : null;
    }

    if (Object.keys(setFields).length > 0) {
      updateOps.$set = setFields;
    }

    // 5. Ajout de note
    const noteText = body.note || body.noteText;
    if (noteText && String(noteText).trim()) {
      updateOps.$push = {
        notes: {
          text: String(noteText).trim(),
          addedBy: body.addedBy || body.processedBy || 'Elios',
          addedAt: new Date(),
        },
      };
    }

    if (Object.keys(updateOps).length === 0) {
      return NextResponse.json({ error: 'Payload de mise à jour vide' }, { status: 400 });
    }

    const updatedReceipt = await Receipt.findByIdAndUpdate(id, updateOps, { new: true });
    
    if (!updatedReceipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    return NextResponse.json(updatedReceipt, { status: 200 });
  } catch (error: any) {
    console.error(`Error in PATCH /api/receipts/[id]:`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id } = await Promise.resolve(params);
    await connectToDatabase();
    
    // Récupérer et supprimer physiquement de la base de données
    const deletedReceipt = await Receipt.findByIdAndDelete(id);
    
    if (!deletedReceipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }
    
    // Supprimer le fichier sur Google Drive et du cache local
    if (deletedReceipt.gDriveFileId) {
      try {
        await deleteFileFromDrive(deletedReceipt.gDriveFileId);
      } catch (driveErr: any) {
        console.warn(`[Delete Pipeline] Avertissement suppression Google Drive:`, driveErr.message);
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: `Reçu ${id} supprimé avec succès.`,
      deletedAmount: deletedReceipt.amount,
      paymentMode: deletedReceipt.paymentMode,
      paymentDetails: deletedReceipt.paymentDetails
    }, { status: 200 });
  } catch (error: any) {
    console.error(`Error in DELETE /api/receipts/[id]:`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
