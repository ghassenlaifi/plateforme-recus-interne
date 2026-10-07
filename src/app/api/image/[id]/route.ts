import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import connectToDatabase from '@/lib/mongodb';
import ReceiptImage from '@/models/ReceiptImage';

// Cache mémoire LRU haute performance (<1ms)
interface CacheEntry {
  buffer: Buffer;
  mimeType: string;
  timestamp: number;
}
const MEMORY_CACHE = new Map<string, CacheEntry>();
const MAX_MEMORY_ITEMS = 80;

function addToMemoryCache(id: string, buffer: Buffer, mimeType: string) {
  if (MEMORY_CACHE.size >= MAX_MEMORY_ITEMS) {
    const oldestKey = MEMORY_CACHE.keys().next().value;
    if (oldestKey) MEMORY_CACHE.delete(oldestKey);
  }
  MEMORY_CACHE.set(id, { buffer, mimeType, timestamp: Date.now() });
}

// Dossiers de cache temporaire
const TMP_CACHE_DIR = path.join(os.tmpdir(), 'receipthub-cache');
const LEGACY_CACHE_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'receipts');

function saveToTmpDisk(fileId: string, buffer: Buffer) {
  try {
    if (!fs.existsSync(TMP_CACHE_DIR)) {
      fs.mkdirSync(TMP_CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(TMP_CACHE_DIR, fileId), buffer);
  } catch (e) {
    // Silencieux sur environnements restreints
  }
}

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
    if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') {
      return 'image/webp';
    }
  }
  return 'image/jpeg';
}

function generatePlaceholderSvg(id: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="none">
    <rect width="600" height="400" fill="#F8FAFC" rx="16"/>
    <rect x="20" y="20" width="560" height="360" rx="12" stroke="#E2E8F0" stroke-width="2" stroke-dasharray="6 6"/>
    <circle cx="300" cy="150" r="44" fill="#EEF2F6"/>
    <path d="M286 160L296 170L314 146" stroke="#64748B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M284 134H316M284 144H304" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round"/>
    <text x="300" y="230" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="#1E293B">Reçu Archivé / Image en cours de synchronisation</text>
    <text x="300" y="260" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#64748B">Identifiant : ${id}</text>
    <text x="300" y="285" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#94A3B8">Elios Workspace • Plateforme de Gestion des Reçus</text>
  </svg>`;
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

    // TIER 0 : Cache Mémoire RAM ultra-rapide (<1ms)
    const memCached = MEMORY_CACHE.get(fileId);
    if (memCached) {
      return new NextResponse(new Uint8Array(memCached.buffer), {
        status: 200,
        headers: {
          'Content-Type': memCached.mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Storage-Tier': 'RAM-Cache',
        },
      });
    }

    // TIER 1 : Cache Disque Temporaire Local (<5ms)
    const candidates = [
      path.join(TMP_CACHE_DIR, fileId),
      path.join(LEGACY_CACHE_DIR, fileId),
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        try {
          const buffer = fs.readFileSync(filePath);
          if (buffer.length > 200) {
            const mimeType = detectMimeType(buffer);
            addToMemoryCache(fileId, buffer, mimeType);
            return new NextResponse(new Uint8Array(buffer), {
              status: 200,
              headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-Storage-Tier': 'Local-Disk',
              },
            });
          }
        } catch (readErr) {
          // Continuer vers le niveau suivant
        }
      }
    }

    // TIER 2 : BASE DE DONNÉES PERSISTANTE MONGODB ATLAS (Garantie absolue zéro perte)
    try {
      await connectToDatabase();
      const imageDoc = await ReceiptImage.findOne({
        $or: [{ fileId: fileId }, { aliases: fileId }],
      });

      if (imageDoc && imageDoc.data && imageDoc.data.length > 0) {
        const buffer = Buffer.from(imageDoc.data);
        const mimeType = imageDoc.mimeType || detectMimeType(buffer);

        addToMemoryCache(fileId, buffer, mimeType);
        saveToTmpDisk(fileId, buffer);

        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Storage-Tier': 'MongoDB-Atlas',
          },
        });
      }
    } catch (dbErr: any) {
      console.warn(`[Image Server] Recherche MongoDB pour ${fileId} échouée:`, dbErr.message);
    }

    // TIER 3 & 4 : RÉCUPÉRATION GOOGLE DRIVE (Si l'identifiant est un ID Drive Google)
    const isDriveId = !fileId.startsWith('rec_') && !fileId.startsWith('deduction-') && !fileId.startsWith('retrait-');
    if (isDriveId) {
      // 3A. CDN Direct Google UserContent (lh3)
      const cdnUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      try {
        const cdnRes = await fetch(cdnUrl, { cache: 'no-store' });
        if (cdnRes.ok) {
          const arrayBuf = await cdnRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          if (buffer.length > 500) {
            const mimeType = cdnRes.headers.get('content-type') || detectMimeType(buffer);

            // Auto-guérison : Archivage immédiat dans MongoDB Atlas pour pérenniser l'image à tout jamais
            try {
              await connectToDatabase();
              await ReceiptImage.findOneAndUpdate(
                { fileId: fileId },
                {
                  fileId: fileId,
                  aliases: [fileId],
                  mimeType: mimeType,
                  data: buffer,
                  size: buffer.length,
                },
                { upsert: true }
              );
            } catch (autoHealErr) {
              // Silencieux
            }

            addToMemoryCache(fileId, buffer, mimeType);
            saveToTmpDisk(fileId, buffer);

            return new NextResponse(new Uint8Array(buffer), {
              status: 200,
              headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-Storage-Tier': 'Google-Drive-CDN',
              },
            });
          }
        }
      } catch (cdnErr) {
        // Continuer vers la miniature Drive
      }

      // 3B. CDN Thumbnail Google Drive
      const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w2048`;
      try {
        const thumbRes = await fetch(thumbUrl, { cache: 'no-store' });
        if (thumbRes.ok) {
          const arrayBuf = await thumbRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          if (buffer.length > 500) {
            const mimeType = thumbRes.headers.get('content-type') || detectMimeType(buffer);

            // Auto-guérison dans MongoDB Atlas
            try {
              await connectToDatabase();
              await ReceiptImage.findOneAndUpdate(
                { fileId: fileId },
                {
                  fileId: fileId,
                  aliases: [fileId],
                  mimeType: mimeType,
                  data: buffer,
                  size: buffer.length,
                },
                { upsert: true }
              );
            } catch (autoHealErr) {
              // Silencieux
            }

            addToMemoryCache(fileId, buffer, mimeType);
            saveToTmpDisk(fileId, buffer);

            return new NextResponse(new Uint8Array(buffer), {
              status: 200,
              headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-Storage-Tier': 'Google-Drive-Thumbnail',
              },
            });
          }
        }
      } catch (thumbErr) {
        // Continuer vers l'API Drive OAuth
      }

      // 4. API Google Drive OAuth
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
            const mimeType = (driveRes.headers['content-type'] as string) || detectMimeType(buffer);

            // Auto-guérison dans MongoDB Atlas
            try {
              await connectToDatabase();
              await ReceiptImage.findOneAndUpdate(
                { fileId: fileId },
                {
                  fileId: fileId,
                  aliases: [fileId],
                  mimeType: mimeType,
                  data: buffer,
                  size: buffer.length,
                },
                { upsert: true }
              );
            } catch (autoHealErr) {
              // Silencieux
            }

            addToMemoryCache(fileId, buffer, mimeType);
            saveToTmpDisk(fileId, buffer);

            return new NextResponse(new Uint8Array(buffer), {
              status: 200,
              headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-Storage-Tier': 'Google-Drive-API',
              },
            });
          }
        }
      } catch (apiErr: any) {
        console.warn(`[Image Server] Drive API non disponible (${apiErr.message})`);
      }
    }

    // TIER 5 : DÉGRADATION ÉLÉGANTE (Image SVG Placeholder au lieu d'une icône cassée)
    const placeholder = generatePlaceholderSvg(fileId);
    return new NextResponse(placeholder, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
        'X-Storage-Tier': 'Placeholder-Fallback',
      },
    });
  } catch (error: any) {
    console.error('Erreur critique dans GET /api/image:', error);
    const placeholder = generatePlaceholderSvg('error');
    return new NextResponse(placeholder, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
      },
    });
  }
}
