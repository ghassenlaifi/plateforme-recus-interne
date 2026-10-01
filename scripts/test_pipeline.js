const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf-8');
  env.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = val;
      }
    }
  });
}

const { google } = require('googleapis');

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

console.log('Testing Drive Credentials...');
const oauth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  'https://developers.google.com/oauthplayground'
);
oauth2Client.setCredentials({ refresh_token: refreshToken });

const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function run() {
  try {
    const tokenRes = await oauth2Client.getAccessToken();
    console.log('1. Access Token acquired successfully! Token starts with:', tokenRes.token ? tokenRes.token.substring(0, 15) + '...' : 'NONE');

    const folderRes = await drive.files.get({ fileId: folderId, fields: 'id, name, capabilities' });
    console.log('2. Target folder reached:', folderRes.data.name, '(ID:', folderRes.data.id, ')');

    // Test a tiny upload
    const { Readable } = require('stream');
    const s = new Readable();
    s.push(Buffer.from('TEST RECEIPTHUB VERIFICATION'));
    s.push(null);

    const uploadRes = await drive.files.create({
      requestBody: { name: 'receipthub_verify_test.txt', parents: [folderId] },
      media: { mimeType: 'text/plain', body: s },
      fields: 'id, webViewLink'
    });
    console.log('3. Test file created on Drive! File ID:', uploadRes.data.id);

    // Make public
    await drive.permissions.create({
      fileId: uploadRes.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });
    console.log('4. File permissions set to public (anyone can read)!');

    // Clean up
    await drive.files.delete({ fileId: uploadRes.data.id });
    console.log('5. Test file cleaned up and deleted successfully!');

    console.log('--- ALL GOOGLE DRIVE CHECKS PASSED 100% ---');
  } catch (err) {
    console.error('FAILED:', err.message, err.response?.data);
  }
}
run();
