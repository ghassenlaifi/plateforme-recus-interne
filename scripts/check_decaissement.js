const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { google } = require('googleapis');

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

async function verifyAll() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const receiptsCol = db.collection('receipts');
  const allReceipts = await receiptsCol.find({}).toArray();

  const processed = allReceipts.filter(r => r.status === 'PROCESSED');
  const sumProcessed = processed.reduce((sum, r) => sum + (r.amount || 0), 0);

  const pending = allReceipts.filter(r => r.status === 'PENDING');
  const sumPending = pending.reduce((sum, r) => sum + (r.amount || 0), 0);

  console.log('=== VERIFICATION BASE DE DONNEES ===');
  console.log(`Reçus traités : ${processed.length} pour un total de : ${sumProcessed.toFixed(2)} DT`);
  console.log(`Reçus en attente : ${pending.length} pour un total de : ${sumPending.toFixed(2)} DT`);

  // Vérifier si le reçu de 300 DT existe
  const r300 = allReceipts.find(r => r.amount === 300 && r.clientDetails?.telephone?.includes('92'));
  console.log(`Reçu test 300 DT présent en base : ${r300 ? 'OUI' : 'NON (DÉCAISSÉ ET SUPPRIMÉ)'}`);

  // Solde portefeuille Edinar - D17 - Elyes
  const elyesReceipts = allReceipts.filter(r => r.paymentMode === 'Edinar - D17' && r.paymentDetails === 'Elyes');
  const elyesTotal = elyesReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  console.log(`\n=== PORTEFEUILLE EDINAR - D17 - ELYES ===`);
  console.log(`Nombre de reçus dans ce portefeuille : ${elyesReceipts.length}`);
  console.log(`Solde total calculé : ${elyesTotal.toFixed(2)} DT`);
  console.log(`Le reçu de 300 DT fait-il partie du solde ? ${elyesReceipts.some(r => r.amount === 300 && r.clientDetails?.telephone?.includes('92')) ? 'OUI' : 'NON (BIEN DÉCAISSÉ)'}`);

  // Google Drive check
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const q = `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`;
    const driveRes = await drive.files.list({ q, fields: 'files(id, name)' });
    console.log(`\n=== GOOGLE DRIVE ===`);
    console.log(`Fichiers actifs dans le dossier Google Drive : ${driveRes.data.files.length}`);
  } catch (driveErr) {
    console.warn('Drive check warning:', driveErr.message);
  }

  await mongoose.disconnect();
}

verifyAll().catch(console.error);
