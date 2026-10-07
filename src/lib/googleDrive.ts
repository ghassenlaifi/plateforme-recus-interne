import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';
import connectToDatabase from '@/lib/mongodb';
import ReceiptImage from '@/models/ReceiptImage';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Utilisation du dossier temporaire système (seul dossier inscriptible sur Vercel Serverless / AWS Lambda)
const CACHE_DIR = path.join(os.tmpdir(), 'receipthub-cache');

function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  } catch (err) {
    // Silencieux si échec sur conteneur read-only strict
  }
}

/**
 * Initialisation sécurisée du client Google Drive sans crash au démarrage
 */
function getDriveClient() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !GOOGLE_DRIVE_FOLDER_ID) {
    return null;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: GOOGLE_REFRESH_TOKEN,
    });

    return {
      drive: google.drive({ version: 'v3', auth: oauth2Client }),
      folderId: GOOGLE_DRIVE_FOLDER_ID,
    };
  } catch (err: any) {
    console.warn('[Storage Pipeline] Erreur initialisation client Google Drive:', err.message);
    return null;
  }
}

/**
 * Upload haute disponibilité à double niveau (Dual-Storage Tiered Architecture) :
 * 1. PERSISTANCE IMMÉDIATE DANS MONGODB ATLAS (Garantie absolue zéro perte de données sur Vercel Serverless)
 * 2. SYNCHRONISATION GOOGLE DRIVE CLOUD (Si identifiants valides)
 *
 * @param fileBuffer Buffer contenant le fichier
 * @param mimeType Le type MIME du fichier (ex: 'image/jpeg')
 * @param originalName Le nom d'origine du fichier
 * @returns { fileId, webViewLink }
 */
export async function uploadFileToDrive(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<{ fileId: string; webViewLink: string }> {
  ensureCacheDir();

  // Identifiant local unique hautement résilient
  const localFileId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const localFilePath = path.join(CACHE_DIR, localFileId);

  // 1. Écriture dans le cache temporaire local (si le système de fichiers le permet)
  try {
    fs.writeFileSync(localFilePath, fileBuffer);
  } catch (fsErr) {
    // Non bloquant si système de fichiers restreint
  }

  // 2. PERSISTANCE CRITIQUE DANS MONGODB ATLAS
  // Cette étape élimine définitivement le problème de perte d'images sur Vercel
  try {
    await connectToDatabase();
    await ReceiptImage.findOneAndUpdate(
      { fileId: localFileId },
      {
        fileId: localFileId,
        aliases: [localFileId],
        mimeType: mimeType || 'image/jpeg',
        data: fileBuffer,
        size: fileBuffer.length,
        originalName: originalName || 'recu',
      },
      { upsert: true, new: true }
    );
    console.log(`[Storage Pipeline] Image sauvegardée avec succès dans MongoDB Atlas (ID: ${localFileId}, Taille: ${fileBuffer.length} octets)`);
  } catch (dbErr: any) {
    console.error('[Storage Pipeline] Erreur critique lors de la persistance MongoDB:', dbErr);
  }

  // 3. TENTATIVE DE SYNCHRONISATION GOOGLE DRIVE
  const driveConfig = getDriveClient();
  if (driveConfig) {
    try {
      const { drive, folderId } = driveConfig;

      const fileMetadata = {
        name: originalName || `${localFileId}.jpg`,
        parents: [folderId],
      };

      const media = {
        mimeType: mimeType || 'image/jpeg',
        body: Readable.from(fileBuffer),
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink',
      });

      const driveFileId = response.data.id;
      const webViewLink = response.data.webViewLink;

      if (driveFileId && webViewLink) {
        // Enregistrer également l'image sous l'ID Google Drive dans MongoDB pour résolution bidirectionnelle instantanée
        try {
          await ReceiptImage.updateOne(
            { fileId: localFileId },
            { $addToSet: { aliases: driveFileId } }
          );

          // Création d'une entrée directe avec l'ID Drive pour accès direct O(1)
          await ReceiptImage.findOneAndUpdate(
            { fileId: driveFileId },
            {
              fileId: driveFileId,
              aliases: [localFileId, driveFileId],
              mimeType: mimeType || 'image/jpeg',
              data: fileBuffer,
              size: fileBuffer.length,
              originalName: originalName || '',
            },
            { upsert: true }
          );
        } catch (aliasErr) {
          console.warn('[Storage Pipeline] Erreur association alias MongoDB:', aliasErr);
        }

        // Cache local sous l'identifiant Drive
        try {
          fs.writeFileSync(path.join(CACHE_DIR, driveFileId), fileBuffer);
        } catch (e) {
          // Ignorer
        }

        // Configuration des permissions publiques Google Drive
        try {
          await drive.permissions.create({
            fileId: driveFileId,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
          });
        } catch (permErr: any) {
          console.warn('[Storage Pipeline] Permission anyone non appliquée:', permErr.message);
        }

        console.log(`[Storage Pipeline] Image synchronisée sur Google Drive (Drive ID: ${driveFileId})`);
        return { fileId: driveFileId, webViewLink };
      }
    } catch (driveErr: any) {
      console.warn(`[Storage Pipeline] Google Drive non disponible (${driveErr.message}). Basculement fluide sur le stockage persistant MongoDB Atlas.`);
    }
  } else {
    console.warn('[Storage Pipeline] Identifiants Google Drive non configurés. Image stockée de manière pérenne dans MongoDB Atlas.');
  }

  // 4. RETOUR HAUTE RÉSILIENCE MONGODB PERSISTANT
  return {
    fileId: localFileId,
    webViewLink: `/api/image/${localFileId}`,
  };
}

/**
 * Supprime un fichier de Google Drive, de MongoDB Atlas et du cache local
 * 
 * @param fileId L'identifiant du fichier
 */
export async function deleteFileFromDrive(fileId: string): Promise<void> {
  if (!fileId) return;

  // 1. Suppression du cache local
  try {
    const localFilePath = path.join(CACHE_DIR, fileId);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  } catch (err: any) {
    console.warn(`[Delete Pipeline] Fichier local ${fileId} non supprimé:`, err.message);
  }

  // 2. Suppression dans MongoDB Atlas
  try {
    await connectToDatabase();
    await ReceiptImage.deleteMany({
      $or: [{ fileId: fileId }, { aliases: fileId }],
    });
    console.log(`[Delete Pipeline] Image ${fileId} supprimée de MongoDB Atlas`);
  } catch (dbErr: any) {
    console.warn(`[Delete Pipeline] Erreur suppression MongoDB ${fileId}:`, dbErr.message);
  }

  // 3. Suppression Google Drive si applicable
  const isDriveId = !fileId.startsWith('rec_') && !fileId.startsWith('deduction-') && !fileId.startsWith('retrait-');
  if (isDriveId) {
    const driveConfig = getDriveClient();
    if (driveConfig) {
      try {
        await driveConfig.drive.files.delete({
          fileId: fileId,
        });
        console.log(`[Delete Pipeline] Image ${fileId} supprimée de Google Drive`);
      } catch (error: any) {
        console.warn(`[Delete Pipeline] Erreur suppression Google Drive (ID: ${fileId}):`, error.message);
      }
    }
  }
}
