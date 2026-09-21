import { google } from 'googleapis';
import { Readable } from 'stream';

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
  
  const fileMetadata = {
    name: originalName,
    parents: [GOOGLE_DRIVE_FOLDER_ID as string],
  };

  const media = {
    mimeType,
    body: bufferToStream(fileBuffer),
  };

  try {
    // 1. Upload du fichier
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    const fileId = response.data.id;
    const webViewLink = response.data.webViewLink;

    if (!fileId || !webViewLink) {
      throw new Error("L'API Google Drive n'a pas retourné l'ID ou le lien du fichier.");
    }

    // 2. Rendre le fichier accessible publiquement en lecture (Anyone with the link)
    // Cela permet d'afficher l'image directement dans l'interface sans problèmes de permissions.
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return { fileId, webViewLink };
  } catch (error: any) {
    console.error('Erreur lors de la communication avec Google Drive API:', error.message);
    throw error;
  }
}

/**
 * Supprime un fichier de Google Drive
 * 
 * @param fileId L'identifiant du fichier sur Google Drive
 */
export async function deleteFileFromDrive(fileId: string): Promise<void> {
  try {
    await drive.files.delete({
      fileId: fileId,
    });
  } catch (error: any) {
    console.error(`Erreur lors de la suppression du fichier Drive (ID: ${fileId}):`, error.message);
    throw error;
  }
}
