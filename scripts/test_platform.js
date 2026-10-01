const fs = require('fs');
const path = require('path');
const http = require('http');

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

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks)
        });
      });
    }).on('error', reject);
  });
}

async function verifyPlatform() {
  console.log('1. Checking GET /api/receipts...');
  const res = await get('http://localhost:3000/api/receipts');
  console.log('Receipts API Status:', res.statusCode);
  const receipts = JSON.parse(res.body.toString('utf-8'));
  console.log('Total receipts found in MongoDB:', receipts.length);

  const sample = receipts.slice(0, 3);
  sample.forEach((r, i) => {
    console.log(`Receipt #${i+1}: Ref: ${r.reference || 'N/A'}, Nom: ${r.clientDetails?.nom || 'N/A'}, Montant: ${r.amount} DT, DriveId: ${r.gDriveFileId || 'N/A'}`);
  });

  const receiptWithImg = receipts.find(r => r.gDriveFileId && !r.gDriveFileId.startsWith('deduction-'));
  if (receiptWithImg) {
    console.log('\n2. Testing Image endpoint GET /api/image/' + receiptWithImg.gDriveFileId);
    const imgRes = await get('http://localhost:3000/api/image/' + receiptWithImg.gDriveFileId);
    console.log('Image HTTP Status:', imgRes.statusCode);
    console.log('Content-Type:', imgRes.headers['content-type']);
    console.log('Received image bytes:', imgRes.body.length);
    if (imgRes.statusCode === 200 && imgRes.body.length > 500) {
      console.log('IMAGE PREVIEW IS FULLY FUNCTIONAL AND SERVING CORRECTLY!');
    } else {
      console.log('WARNING: Image endpoint returned status ' + imgRes.statusCode);
    }
  }

  console.log('\n--- PLATFORM VERIFICATION COMPLETE ---');
}

verifyPlatform().catch(console.error);
