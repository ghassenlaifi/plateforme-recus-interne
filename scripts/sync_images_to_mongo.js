const fs = require('fs');
const path = require('path');
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    process.env[match[1]] = match[2].trim();
  }
});

const mongoose = require('mongoose');

async function syncExistingImages() {
  console.log('--- Démarrage de la synchronisation de sécurité des images vers MongoDB Atlas ---');
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 20000,
  });
  
  const ReceiptImageSchema = new mongoose.Schema({
    fileId: { type: String, required: true, unique: true, index: true },
    aliases: { type: [String], default: [] },
    mimeType: { type: String, default: 'image/jpeg' },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
    originalName: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  }, { timestamps: true });

  const ReceiptImage = mongoose.models.ReceiptImage || mongoose.model('ReceiptImage', ReceiptImageSchema);

  // 1. Scanner les fichiers locaux existants
  const uploadsDir = path.resolve('public', 'uploads', 'receipts');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    console.log(`Fichiers trouvés dans public/uploads/receipts : ${files.length}`);

    let localCount = 0;
    for (const filename of files) {
      const filePath = path.join(uploadsDir, filename);
      const stat = fs.statSync(filePath);
      if (stat.isFile() && stat.size > 100) {
        const buffer = fs.readFileSync(filePath);
        let mime = 'image/jpeg';
        if (buffer[0] === 0x89 && buffer[1] === 0x50) mime = 'image/png';
        if (buffer[0] === 0x25 && buffer[1] === 0x50) mime = 'application/pdf';

        await ReceiptImage.findOneAndUpdate(
          { fileId: filename },
          {
            fileId: filename,
            aliases: [filename],
            mimeType: mime,
            data: buffer,
            size: buffer.length,
            originalName: filename,
          },
          { upsert: true }
        );
        localCount++;
      }
    }
    console.log(`✅ ${localCount} images locales synchronisées avec succès dans MongoDB Atlas.`);
  }

  // 2. Vérifier le total dans MongoDB Atlas
  const totalInDb = await ReceiptImage.countDocuments();
  console.log(`📊 Total des images sécurisées dans MongoDB Atlas : ${totalInDb}`);

  await mongoose.disconnect();
  console.log('--- Synchronisation terminée ---');
}

syncExistingImages().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});

