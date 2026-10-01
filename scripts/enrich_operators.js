const mongoose = require('../node_modules/mongoose');
const URI = process.env.MONGODB_URI || 'mongodb+srv://ghassenlaifii_db_user:v5S91ZMkwGXEL1P4@receipthub-cluster.aqr9ofq.mongodb.net/?appName=ReceiptHub-Cluster';

const aliasPatterns = [
  { name: 'Narjess', reg: /(?:\bnarjess\b|\bnarjes\b|\bnrjs\b|\bnrjes\b)/i },
  { name: 'Soumaya', reg: /(?:\bsoumaya\b|\bsouma\b|\bsou\b|\bsoum\b)/i },
  { name: 'Aya', reg: /(?:\baya\b|\beya\b|\bayet\b)/i },
  { name: 'Mariem', reg: /(?:\bmariem\b|\bmeriem\b|\bmeryem\b|\bmarieem\b|\bmrym\b)/i },
  { name: 'Asma', reg: /(?:\basma\b|\besma\b|\b3asma\b)/i },
  { name: 'Elyes', reg: /(?:\belyes\b|\bilyes\b|\belies\b|\blabidi\b)/i },
  { name: 'Koussay', reg: /(?:\bkoussay\b|\bkossay\b|\bkousai\b|\b9osay\b)/i },
  { name: 'Ghassen', reg: /(?:\bghassen\b|\bgassen\b|\bgass\b)/i },
  { name: 'Amine', reg: /(?:\bamine\b|\bmed amine\b)/i }
];

async function enrich() {
  await mongoose.connect(URI, { dbName: 'test' });
  const receipts = await mongoose.connection.db.collection('receipts').find().toArray();
  const phoneToOp = new Map();
  for (const r of receipts) {
    const rawTel = (r.clientDetails && r.clientDetails.telephone) || r.phone;
    const cleanTel = String(rawTel || '').replace(/\D/g, '').slice(-8);
    const op = r.operatorName || r.processedBy || r.paymentDetails;
    if (cleanTel && op) phoneToOp.set(cleanTel, op);
  }

  const leads = await mongoose.connection.db.collection('leads').find({ crmType: 'elios' }).toArray();
  const bulkOps = [];
  let updatedCount = 0;

  for (const lead of leads) {
    const cleanTel = String(lead.phone || '').replace(/\D/g, '').slice(-8);
    let detectedOp = null;

    if (phoneToOp.has(cleanTel)) {
      detectedOp = phoneToOp.get(cleanTel);
    }

    // Check notes
    const notes = Array.isArray(lead.notes) ? [...lead.notes] : [];
    let noteUpdated = false;

    for (let i = 0; i < notes.length; i++) {
      const text = notes[i].text || '';
      for (const ap of aliasPatterns) {
        if (ap.reg.test(text)) {
          notes[i].by = ap.name;
          notes[i].addedBy = ap.name;
          noteUpdated = true;
          if (!detectedOp) detectedOp = ap.name;
          break;
        }
      }
    }

    if (detectedOp) {
      bulkOps.push({
        updateOne: {
          filter: { _id: lead._id },
          update: {
            $set: {
              staff: detectedOp,
              lastModifiedBy: detectedOp,
              notes: notes
            }
          }
        }
      });
      updatedCount++;
    }
  }

  if (bulkOps.length > 0) {
    await mongoose.connection.db.collection('leads').bulkWrite(bulkOps);
  }

  console.log('Enriched leads count:', updatedCount);
  const staffCounts = {};
  const leadsAfter = await mongoose.connection.db.collection('leads').find({ crmType: 'elios' }, { projection: { staff: 1 } }).toArray();
  for (const l of leadsAfter) {
    staffCounts[l.staff || 'None'] = (staffCounts[l.staff || 'None'] || 0) + 1;
  }
  console.log('New staff distribution:', staffCounts);
  await mongoose.disconnect();
}

enrich().catch(console.error);
