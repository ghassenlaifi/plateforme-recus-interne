import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'receipts');

function detectMimeType(buffer: Buffer): string {
  if (buffer.length >= 4) {
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png';
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    // PDF: 25 50 44 46 (%PDF)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return 'application/pdf';
    }
    // WebP: RIFF ... WEBP
    if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') {
      return 'image/webp';
    }
  }
  return 'image/jpeg';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const fileId = resolvedParams.id;

    if (!fileId) {
      return new NextResponse('Missing file ID', { status: 400 });
    }

    // Tier 1: Vérification du cache disque local ultra-rapide (<5ms)
    const localFilePath = path.join(CACHE_DIR, fileId);
    if (fs.existsSync(localFilePath)) {
      try {
        const fileBuffer = fs.readFileSync(localFilePath);
        if (fileBuffer.length > 0) {
          const mimeType = detectMimeType(fileBuffer);
          return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
              'Content-Type': mimeType,
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      } catch (readErr) {
        console.warn(`[Image Server] Erreur lecture fichier local ${fileId}:`, readErr);
      }
    }

    // Tier 2: Fetch via CDN haute performance Google Drive (lh3)
    const cdnUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    try {
      const cdnRes = await fetch(cdnUrl);
      if (cdnRes.ok) {
        const arrayBuf = await cdnRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (buffer.length > 500) {
          // Sauvegarde automatique dans le cache local pour les futurs accès
          try {
            if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
            fs.writeFileSync(localFilePath, buffer);
          } catch (cacheErr) {
            console.warn('[Image Server] Échec écriture cache local:', cacheErr);
          }

          const mimeType = cdnRes.headers.get('content-type') || detectMimeType(buffer);
          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': mimeType,
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      }
    } catch (cdnErr) {
      console.warn(`[Image Server] CDN direct échoué pour ${fileId}:`, cdnErr);
    }

    // Tier 3: Fetch via CDN Thumbnail Google Drive
    const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w2048`;
    try {
      const thumbRes = await fetch(thumbUrl);
      if (thumbRes.ok) {
        const arrayBuf = await thumbRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (buffer.length > 500) {
          try {
            if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
            fs.writeFileSync(localFilePath, buffer);
          } catch (cacheErr) {
            console.warn('[Image Server] Échec écriture cache local:', cacheErr);
          }

          const mimeType = thumbRes.headers.get('content-type') || detectMimeType(buffer);
          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': mimeType,
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      }
    } catch (thumbErr) {
      console.warn(`[Image Server] Thumbnail direct échoué pour ${fileId}:`, thumbErr);
    }

    // Tier 4: Tentative via OAuth API Drive (si credentials valides)
    try {
      const { google } = await import('googleapis');
      const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
      const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
      const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

      if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
        const oauth2Client = new google.auth.OAuth2(
          GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET,
          'https://developers.google.com/oauthplayground'
        );
        oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const driveRes = await drive.files.get(
          { fileId: fileId, alt: 'media' },
          { responseType: 'arraybuffer' }
        );

        if (driveRes.data) {
          const buffer = Buffer.from(driveRes.data as ArrayBuffer);
          try {
            if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
            fs.writeFileSync(localFilePath, buffer);
          } catch (wErr) {
            console.warn('[Image Server] Erreur écriture cache Drive API:', wErr);
          }

          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': (driveRes.headers['content-type'] as string) || detectMimeType(buffer),
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      }
    } catch (apiErr: any) {
      console.warn(`[Image Server] Drive API non disponible (${apiErr.message})`);
    }

    return new NextResponse('Image non trouvée', { status: 404 });
  } catch (error: any) {
    console.error('Erreur critique dans GET /api/image:', error);
    return new NextResponse('Erreur serveur lors de la récupération de l’image', { status: 500 });
  }
}
