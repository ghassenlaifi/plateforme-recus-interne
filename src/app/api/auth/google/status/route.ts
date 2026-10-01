import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
  const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({
      connected: false,
      status: 'missing_config',
      message: 'Variables d’environnement Google Drive non configurées.',
      folderId: GOOGLE_DRIVE_FOLDER_ID || null,
    });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

    // Tenter de générer un access token pour tester la validité du refresh token
    const tokenRes = await oauth2Client.getAccessToken();

    if (tokenRes.token) {
      return NextResponse.json({
        connected: true,
        status: 'active',
        message: 'Connexion Google Drive active et opérationnelle.',
        folderId: GOOGLE_DRIVE_FOLDER_ID,
      });
    } else {
      return NextResponse.json({
        connected: false,
        status: 'invalid_token',
        message: 'Jeton Google Drive expiré ou révoqué.',
        folderId: GOOGLE_DRIVE_FOLDER_ID,
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      connected: false,
      status: 'error',
      message: error.message || 'Erreur lors de la vérification du jeton Google Drive',
      errorDetails: error.response?.data || null,
      folderId: GOOGLE_DRIVE_FOLDER_ID,
    });
  }
}
