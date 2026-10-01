import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/google/callback`;
    const code = req.nextUrl.searchParams.get('code');
    const errorParam = req.nextUrl.searchParams.get('error');

    if (errorParam) {
      return new NextResponse(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h2 style="color: #DC2626;">Erreur d'autorisation Google</h2>
            <p>${errorParam}</p>
            <a href="/receipts" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3B82F6; color: white; border-radius: 8px; text-decoration: none;">Retour aux reçus</a>
          </body>
        </html>
      `, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (!code) {
      return new NextResponse('Code d’autorisation manquant', { status: 400 });
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (tokens.refresh_token) {
      process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;

      // Mettre à jour .env.local de façon persistante
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
          envContent = envContent.replace(
            /GOOGLE_REFRESH_TOKEN=([^\r\n]*)/,
            `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`
          );
        } else {
          envContent += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      }

      return new NextResponse(`
        <!DOCTYPE html>
        <html lang="fr">
          <head>
            <meta charset="utf-8">
            <title>Connexion Google Drive réussie</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F9FAFB; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); max-width: 480px; text-align: center; border: 1px solid #E5E7EB; }
              .badge { background: #ECFDF5; color: #059669; padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: 13px; display: inline-block; margin-bottom: 16px; }
              h1 { font-size: 22px; color: #111827; margin: 0 0 10px; }
              p { color: #6B7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
              .btn { background: #0F9D82; color: white; padding: 12px 24px; border-radius: 10px; font-weight: 600; text-decoration: none; display: inline-block; transition: 0.2s; }
              .btn:hover { background: #0B7F69; }
            </style>
          </head>
          <body>
            <div class="card">
              <span class="badge">✓ Pipeline Google Drive Opérationnel</span>
              <h1>Connexion réussie</h1>
              <p>Votre jeton d'accès Google Drive a été renouvelé avec succès. Les téléversements et la consultation des reçus sont désormais 100% synchronisés.</p>
              <a href="/receipts" class="btn">Accéder aux reçus</a>
            </div>
          </body>
        </html>
      `, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } else {
      return new NextResponse(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h2 style="color: #D97706;">Jeton de rafraîchissement non retourné</h2>
            <p>Google a validé la session mais n'a pas retourné de nouveau refresh token (la session était déjà active). Veuillez vous reconnecter en forçant le consentement.</p>
            <a href="/api/auth/google" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #0F9D82; color: white; border-radius: 8px; text-decoration: none;">Réessayer avec consentement</a>
          </body>
        </html>
      `, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
  } catch (err: any) {
    console.error('Erreur dans le callback Google OAuth:', err);
    return new NextResponse(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h2 style="color: #DC2626;">Erreur de validation du jeton</h2>
          <p>${err.message}</p>
          <a href="/receipts" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3B82F6; color: white; border-radius: 8px; text-decoration: none;">Retour aux reçus</a>
        </body>
      </html>
    `, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}
