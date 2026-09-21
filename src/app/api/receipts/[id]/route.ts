import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Receipt from '@/models/Receipt';

type Params = { id: string };

export async function PATCH(req: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id } = await Promise.resolve(params); // Next.js 15+ compatibility for params
    const body = await req.json();

    await connectToDatabase();

    // Cas 1 : Ajout d'une note
    if (body.noteText && body.addedBy) {
      const updatedReceipt = await Receipt.findByIdAndUpdate(
        id,
        {
          $push: {
            notes: {
              text: body.noteText,
              addedBy: body.addedBy,
              addedAt: new Date(),
            },
          },
        },
        { new: true }
      );
      
      if (!updatedReceipt) {
        return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
      }
      
      return NextResponse.json(updatedReceipt, { status: 200 });
    }

    // Cas 2 : Marquer comme traité
    if (body.status === 'PROCESSED' && body.processedBy) {
      const updatedReceipt = await Receipt.findByIdAndUpdate(
        id,
        {
          $set: {
            status: 'PROCESSED',
            processedBy: body.processedBy,
            processedAt: new Date(),
            lockedBy: null,
            lockedAt: null,
          },
        },
        { new: true }
      );

      if (!updatedReceipt) {
        return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
      }

      return NextResponse.json(updatedReceipt, { status: 200 });
    }

    // Cas 3 : Verrouillage / Déverrouillage
    if (typeof body.lock === 'boolean') {
      const updatedReceipt = await Receipt.findByIdAndUpdate(
        id,
        {
          $set: {
            lockedBy: body.lock ? body.lockedBy : null,
            lockedAt: body.lock ? new Date() : null,
          }
        },
        { new: true }
      );
      if (!updatedReceipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
      return NextResponse.json(updatedReceipt, { status: 200 });
    }

    // Cas 4 : Mise à jour des détails (Edition dans le popup)
    if (body.clientDetails || body.paymentMode !== undefined || body.paymentDate !== undefined) {
      const updateData: any = {};
      if (body.clientDetails) updateData.clientDetails = body.clientDetails;
      if (body.paymentMode !== undefined) updateData.paymentMode = body.paymentMode;
      if (body.paymentDate !== undefined) updateData.paymentDate = body.paymentDate;
      
      const updatedReceipt = await Receipt.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      );
      if (!updatedReceipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
      return NextResponse.json(updatedReceipt, { status: 200 });
    }

    // Si la requête ne correspond à aucun cas
    return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 });
  } catch (error) {
    console.error(`Error in PATCH /api/receipts/[id]:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id } = await Promise.resolve(params);
    await connectToDatabase();
    
    // Supprimer physiquement de la base de données
    const deletedReceipt = await Receipt.findByIdAndDelete(id);
    
    if (!deletedReceipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }
    
    // TODO: Si vous avez besoin de supprimer sur Google Drive, 
    // il faudra appeler l'API Google Drive gDriveFileId ici.
    
    return NextResponse.json({ message: `Receipt ${id} deleted successfully.` }, { status: 200 });
  } catch (error) {
    console.error(`Error in DELETE /api/receipts/[id]:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

