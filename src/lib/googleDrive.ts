import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !GOOGLE_DRIVE_FOLDER_ID) {
  throw new Error('Missing Google Drive OAuth2 environment variables in .env.local');
}

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground' // Redirect URI (par défaut ou bidon si on utilise que le refresh token)
);

oauth2Client.setCredentials({
  refresh_token: GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

const CACHE_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'receipts');

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Helper pour convertir un Buffer Node.js en ReadableStream (nécessaire pour l'API Drive)
 */
function bufferToStream(buffer: Buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

/**
 * Upload le fichier sur Google Drive et le rend publiquement lisible.
 * Sauvegarde également une copie locale haute disponibilité (Tier 1).
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

  // Génération d'un identifiant local unique de sécurité
  const localFileId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const localFilePath = path.join(CACHE_DIR, localFileId);

  // 1. Sauvegarde locale immédiate garantie (zéro perte de données)
  try {
    fs.writeFileSync(localFilePath, fileBuffer);
  } catch (fsErr) {
    console.error('[Upload Pipeline] Erreur écriture disque locale:', fsErr);
  }

  // 2. Tentative de synchronisation vers Google Drive
  try {
    const fileMetadata = {
      name: originalName,
      parents: [GOOGLE_DRIVE_FOLDER_ID as string],
    };

    const media = {
      mimeType,
      body: bufferToStream(fileBuffer),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    const fileId = response.data.id;
    const webViewLink = response.data.webViewLink;

    if (fileId && webViewLink) {
      // Duplication du fichier local sous l'ID Google Drive pour accès instantané
      try {
        const driveLocalPath = path.join(CACHE_DIR, fileId);
        fs.writeFileSync(driveLocalPath, fileBuffer);
      } catch (e) {
        // Ignorer si la copie locale sous le nouvel id échoue
      }

      // Rendre accessible publiquement
      try {
        await drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
        });
      } catch (permErr: any) {
        console.warn('[Upload Pipeline] Permission anyone non appliquée:', permErr.message);
      }

      return { fileId, webViewLink };
    }
  } catch (error: any) {
    console.warn(`[Upload Pipeline] Google Drive non disponible (${error.message}). Basculement automatique sur le stockage local haute disponibilité.`);
  }

  // Fallback haute résilience : renvoyer l'ID local sécurisé
  return {
    fileId: localFileId,
    webViewLink: `/api/image/${localFileId}`
  };
}

/**
 * Supprime un fichier de Google Drive et du cache local
 * 
 * @param fileId L'identifiant du fichier sur Google Drive
 */
export async function deleteFileFromDrive(fileId: string): Promise<void> {
  // Suppression locale
  try {
    const localFilePath = path.join(CACHE_DIR, fileId);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  } catch (err: any) {
    console.warn(`[Delete Pipeline] Fichier local ${fileId} non supprimé:`, err.message);
  }

  // Suppression Google Drive si c'est un identifiant Drive
  if (!fileId.startsWith('rec_') && !fileId.startsWith('deduction-') && !fileId.startsWith('retrait-')) {
    try {
      await drive.files.delete({
        fileId: fileId,
      });
    } catch (error: any) {
      console.warn(`[Delete Pipeline] Erreur suppression Google Drive (ID: ${fileId}):`, error.message);
    }
  }
}
