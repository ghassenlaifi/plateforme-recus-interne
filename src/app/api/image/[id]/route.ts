import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  throw new Error('Missing Google Drive OAuth2 environment variables in .env.local');
}

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

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

    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    const headers = new Headers();
    if (response.headers['content-type']) {
      headers.set('Content-Type', response.headers['content-type']);
    } else {
      headers.set('Content-Type', 'image/jpeg');
    }
    
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    const webStream = new ReadableStream({
      start(controller) {
        response.data.on('data', (chunk: any) => {
          controller.enqueue(chunk);
        });
        response.data.on('end', () => {
          controller.close();
        });
        response.data.on('error', (err: any) => {
          controller.error(err);
        });
      },
    });

    return new NextResponse(webStream, { headers });
  } catch (error: any) {
    console.error('Error fetching image from Drive:', error.message);
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
