import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Receipt from '@/models/Receipt';
import { deleteFileFromDrive } from '@/lib/googleDrive';
import { normalizeWallet, buildWalletMongoMatch } from '@/lib/walletUtils';

export async function DELETE(request: Request) {
  try {
    const { mode, details } = await request.json();

    if (!mode) {
      return NextResponse.json({ error: 'Mode de paiement manquant' }, { status: 400 });
    }

    await connectDB();

    const { mode: cleanMode, details: cleanDetails } = normalizeWallet(mode, details);
    const match = buildWalletMongoMatch(cleanMode, cleanDetails);

    // Trouver tous les reçus correspondants (PENDING, PROCESSED et ARCHIVED)
    const query: any = {
      status: { $in: ['PENDING', 'PROCESSED', 'ARCHIVED'] },
      paymentMode: match.paymentMode,
      paymentDetails: match.paymentDetails,
    };

    const receiptsToDelete: any[] = await Receipt.find(query);
    let deletedDriveCount = 0;

    for (const receipt of receiptsToDelete) {
      const gId = receipt.gDriveFileId;
      // Ne solliciter l'API Drive que pour les vrais fichiers uploadés (exclure les déductions manuelles / retraits)
      if (gId && !gId.startsWith('retrait-') && !gId.startsWith('deduction-') && !gId.includes('system-deduction')) {
        try {
          await deleteFileFromDrive(gId);
          deletedDriveCount++;
        } catch (driveError: any) {
          if (driveError.code !== 404) {
            console.error(`Avertissement : Impossible de supprimer le fichier Drive ${gId}`, driveError.message);
          }
        }
      }
    }

    const deleteResult = await Receipt.deleteMany(query);

    return NextResponse.json({
      success: true,
      message: `Portefeuille ${cleanMode} - ${cleanDetails} réinitialisé avec succès.`,
      deletedCount: deleteResult.deletedCount,
      deletedDriveCount
    });

  } catch (error: any) {
    console.error('Erreur dans DELETE /api/portefeuilles/reset:', error);
    return NextResponse.json({ error: 'Erreur Serveur lors de la réinitialisation' }, { status: 500 });
  }
}

