import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Receipt from '@/models/Receipt';
import { deleteFileFromDrive } from '@/lib/googleDrive';

export async function GET(request: Request) {
  try {
    // 1. SÉCURITÉ : Vérification du secret CRON Vercel
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Non autorisé. Jeton cron invalide.' },
        { status: 401 }
      );
    }

    // Connexion à la base de données
    await connectDB();

    // 2. CALCUL DE LA DATE LIMITE (il y a 7 jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 3. REQUÊTE MONGODB
    // Recherche des reçus traités il y a plus de 7 jours.
    // Utilise processedAt si disponible, sinon se rabat sur updatedAt (pour la rétrocompatibilité).
    const receiptsToDelete = await Receipt.find({
      status: 'PROCESSED',
      $or: [
        { processedAt: { $lte: sevenDaysAgo } },
        { processedAt: { $exists: false }, updatedAt: { $lte: sevenDaysAgo } }
      ]
    });

    let successCount = 0;
    const errors: any[] = [];

    // 4. BOUCLE DE SUPPRESSION TRANSACTIONNELLE
    for (const receipt of receiptsToDelete) {
      try {
        // Suppression sur Google Drive si l'ID existe
        if (receipt.gDriveFileId) {
          try {
            await deleteFileFromDrive(receipt.gDriveFileId);
          } catch (driveError: any) {
            // On ne bloque pas si le fichier Drive est déjà supprimé ou introuvable (404)
            if (driveError.code !== 404) {
              console.error(`Avertissement : Impossible de supprimer le fichier Drive ${receipt.gDriveFileId}`, driveError.message);
            }
          }
        }

        // Passage en statut ARCHIVED au lieu de suppression MongoDB
        receipt.status = 'ARCHIVED';
        await receipt.save();
        successCount++;
      } catch (receiptError: any) {
        console.error(`Erreur lors de la suppression du reçu ${receipt._id}:`, receiptError.message);
        errors.push({ id: receipt._id, error: receiptError.message });
      }
    }

    // 5. RÉPONSE
    return NextResponse.json({
      success: true,
      message: 'Nettoyage terminé.',
      deletedCount: successCount,
      targetDate: sevenDaysAgo.toISOString(),
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Erreur critique dans le Cron Job Cleanup:', error.message);
    return NextResponse.json(
      { error: 'Erreur interne lors du nettoyage.' },
      { status: 500 }
    );
  }
}
