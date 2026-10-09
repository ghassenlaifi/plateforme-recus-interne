import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Receipt from '@/models/Receipt';
import { deleteFileFromDrive } from '@/lib/googleDrive';
import { formatPhone } from '@/lib/phoneUtils';
import { resolveExactReceiptDate } from '@/lib/dateUtils';

type Params = { id: string };

export async function GET(req: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id } = await Promise.resolve(params);
    await connectToDatabase();
    const receipt = await Receipt.findById(id).lean();
    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }
    return NextResponse.json(receipt, { status: 200 });
  } catch (error: any) {
    console.error(`Error in GET /api/receipts/[id]:`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id } = await Promise.resolve(params); // Next.js 15+ compatibility for params
    const body = await req.json();

    await connectToDatabase();

    const existingReceipt = await Receipt.findById(id);
    if (!existingReceipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    const updateOps: any = {};
    const setFields: any = {};

    // Verrouillage / Concurrence : si un autre opérateur a verrouillé ce reçu depuis moins de 45s
    if (body.lock === true) {
      if (
        existingReceipt.lockedBy &&
        existingReceipt.lockedBy !== body.lockedBy &&
        existingReceipt.lockedAt &&
        (Date.now() - new Date(existingReceipt.lockedAt).getTime()) < 45000
      ) {
        return NextResponse.json(
          { error: `Ce reçu est actuellement ouvert par ${existingReceipt.lockedBy}.` },
          { status: 423 }
        );
      }
      setFields.lockedBy = body.lockedBy || 'Elios';
      setFields.lockedAt = new Date();
    } else if (body.lock === false) {
      setFields.lockedBy = null;
      setFields.lockedAt = null;
    }

    // 1. Mise à jour des informations de l'élève (traçable)
    if (body.clientDetails) {
      const rawTel = body.clientDetails.telephone || body.clientDetails.phone;
      if (rawTel) {
        body.clientDetails.telephone = formatPhone(rawTel) || rawTel;
      }
      setFields.clientDetails = body.clientDetails;
    }

    // 2. Mise à jour du mode et portefeuille destination
    if (body.paymentMode !== undefined) setFields.paymentMode = body.paymentMode;
    if (body.paymentDetails !== undefined) setFields.paymentDetails = body.paymentDetails;
    if (body.paymentDate !== undefined) {
      setFields.paymentDate = resolveExactReceiptDate(
        body.paymentDate,
        existingReceipt.paymentDate || existingReceipt.createdAt || new Date()
      );
    }
    if (body.amount !== undefined) setFields.amount = Number(body.amount);

    // 3. Statut Traité / En attente
    if (body.status === 'PROCESSED' || body.status === 'ARCHIVED') {
      setFields.status = body.status;
      setFields.processedBy = body.processedBy || body.lastModifiedBy || 'Elios';
      setFields.processedAt = existingReceipt.processedAt || new Date();
      setFields.lockedBy = null;
      setFields.lockedAt = null;
    } else if (body.status) {
      setFields.status = body.status;
    }

    // 4. Traçabilité : Auteur de la modification
    if (body.lastModifiedBy || body.operatorName) {
      setFields.lastModifiedBy = body.lastModifiedBy || body.operatorName;
    }

    // 5. Ajout de note (avec auteur et date)
    const noteText = body.note || body.noteText;
    if (noteText && String(noteText).trim()) {
      const noteAuthor = body.addedBy || body.lastModifiedBy || body.processedBy || 'Elios';
      updateOps.$push = {
        notes: {
          text: String(noteText).trim(),
          addedBy: noteAuthor,
          addedAt: new Date(),
        },
      };
      setFields.lastModifiedBy = noteAuthor;
    }

    if (Object.keys(setFields).length > 0) {
      updateOps.$set = setFields;
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
