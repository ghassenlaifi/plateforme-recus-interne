import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Receipt from '@/models/Receipt';
import { deleteFileFromDrive } from '@/lib/googleDrive';

export async function DELETE(request: Request) {
  try {
    const { mode, details } = await request.json();

    if (!mode) {
      return NextResponse.json({ error: 'Mode de paiement manquant' }, { status: 400 });
    }

    await connectDB();

    // Trouver tous les reçus correspondants (PROCESSED et ARCHIVED)
    const query = {
      status: { $in: ['PROCESSED', 'ARCHIVED'] as any[] },
      paymentMode: mode,
      paymentDetails: details || '' // ou null selon le cas, mais string vide est la norme
    };

    // On accepte de réinitialiser ceux qui n'ont pas de détails (si c'est le cas)
    if (!details) {
      query.paymentDetails = { $in: [null, ''] } as any;
    }

    const receiptsToDelete: any[] = await Receipt.find(query);
    let deletedDriveCount = 0;

    for (const receipt of receiptsToDelete) {
      if (receipt.gDriveFileId) {
        try {
          await deleteFileFromDrive(receipt.gDriveFileId);
          deletedDriveCount++;
        } catch (driveError: any) {
          if (driveError.code !== 404) {
            console.error(`Avertissement : Impossible de supprimer le fichier Drive ${receipt.gDriveFileId}`, driveError.message);
          }
        }
      }
    }

    const deleteResult = await Receipt.deleteMany(query);

    return NextResponse.json({
      success: true,
      message: `Portefeuille ${mode} ${details || ''} réinitialisé avec succès.`,
      deletedCount: deleteResult.deletedCount,
      deletedDriveCount
    });

  } catch (error: any) {
    console.error('Erreur dans DELETE /api/portefeuilles/reset:', error);
    return NextResponse.json({ error: 'Erreur Serveur lors de la réinitialisation' }, { status: 500 });
  }
}

