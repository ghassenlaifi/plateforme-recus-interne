const fs = require('fs');
const path = require('path');
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    process.env[match[1]] = match[2].trim();
  }
});

// SIMULATION: Pas de credentials Google Drive (comme sur un Vercel sans Drive)
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_REFRESH_TOKEN;

async function testFallbackMode() {
  console.log('=== TEST DU MODE FALLBACK PUR MONGODB ATLAS (SIMULATION VERCEL SANS DRIVE) ===');

  const mongoMod = await import('./src/lib/mongodb.ts');
  const connectToDatabase = typeof mongoMod.default === 'function' ? mongoMod.default : (mongoMod.default?.default || mongoMod);
  
  const imageMod = await import('./src/models/ReceiptImage.ts');
  const ReceiptImage = imageMod.default?.default || imageMod.default;
  
  const driveMod = await import('./src/lib/googleDrive.ts');
  const uploadFileToDrive = driveMod.uploadFileToDrive || driveMod.default?.uploadFileToDrive;
  const deleteFileFromDrive = driveMod.deleteFileFromDrive || driveMod.default?.deleteFileFromDrive;

  await connectToDatabase();

  const testJpegBuffer = Buffer.from('FAKE-JPEG-DATA-FOR-TESTING-FALLBACK');

  console.log('1. Upload sans Google Drive...');
  const res = await uploadFileToDrive(testJpegBuffer, 'image/jpeg', 'recu-fallback.jpg');
  console.log('Résultat fallback:', res);

  if (!res.fileId.startsWith('rec_')) {
    console.error('❌ Attendu fileId rec_..., reçu:', res.fileId);
    process.exit(1);
  }

  // Vérifier dans MongoDB Atlas
  const doc = await ReceiptImage.findOne({ fileId: res.fileId });
  if (doc && doc.data.equals(testJpegBuffer)) {
    console.log('✅ SUCCÈS TOTAL: Image persistée dans MongoDB Atlas avec son ID rec_ !');
  } else {
    console.error('❌ ÉCHEC: Image non trouvée dans MongoDB !');
    process.exit(1);
  }

  // Nettoyage
  await deleteFileFromDrive(res.fileId);
  console.log('✅ Nettoyage terminé.');
  console.log('=== TEST FALLBACK RÉUSSI AVEC SUCCÈS ===');
  process.exit(0);
}

testFallbackMode().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});

