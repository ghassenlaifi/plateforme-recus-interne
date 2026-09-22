import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Receipt from '@/models/Receipt';
import { deleteFileFromDrive } from '@/lib/googleDrive';

// Sécuriser cette route en production avec une variable d'environnement ou autre.
// Pour l'instant, on laisse ouvert pour le développement/CTO.
export async function DELETE(request: Request) {
  try {
    await connectDB();

    const allReceipts = await Receipt.find({});
    
    let deletedDriveCount = 0;
    
    for (const receipt of allReceipts) {
      if (receipt.gDriveFileId) {
        try {
          await deleteFileFromDrive(receipt.gDriveFileId);
          deletedDriveCount++;
        } catch (driveError: any) {
          if (driveError.code !== 404) {
            console.error(`Impossible de supprimer le fichier Drive ${receipt.gDriveFileId}`);
          }
        }
      }
    }

    const deleteResult = await Receipt.deleteMany({});

    return NextResponse.json({
      success: true,
      message: 'Purge totale effectuée avec succès.',
      deletedReceipts: deleteResult.deletedCount,
      deletedDriveFiles: deletedDriveCount
    });
  } catch (error: any) {
    console.error('Erreur lors de la purge:', error.message);
    return NextResponse.json(
      { error: 'Erreur interne lors de la purge.' },
      { status: 500 }
    );
  }
}

