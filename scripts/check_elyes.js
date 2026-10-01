const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

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

async function checkElyes() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const receiptsCol = db.collection('receipts');

  const elyesTxs = await receiptsCol.find({
    paymentMode: 'Edinar - D17',
    paymentDetails: 'Elyes'
  }).sort({ createdAt: -1 }).toArray();

  console.log(`Total transactions for 'Edinar - D17 - Elyes': ${elyesTxs.length}`);
  let sum = 0;
  elyesTxs.forEach((t, i) => {
    console.log(`[${i+1}] ID: ${t._id}, Ref: ${t.reference}, Amount: ${t.amount} DT, Phone: ${t.clientDetails?.telephone}, Status: ${t.status}, CreatedAt: ${t.createdAt}`);
    sum += (t.amount || 0);
  });
  console.log(`Sum of all transactions in Edinar - D17 - Elyes: ${sum} DT`);

  await mongoose.disconnect();
}

checkElyes().catch(console.error);
