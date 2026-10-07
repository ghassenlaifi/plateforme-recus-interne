/**
 * Script haute performance de normalisation et réparation intégrale des numéros de téléphone en base MongoDB.
 * Formate tous les numéros stockés vers le standard officiel "XX XXX XXX" (ex : "92 330 331") via bulkWrite.
 */

const mongoose = require('mongoose');

function extractPhoneDigits(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  str = str.replace(/^(\+\s*216|00\s*216|\(\s*\+?\s*216\s*\)|\(\s*00\s*216\s*\)|216[\s\.\-\/]+)/i, '');
  let digits = str.replace(/\D/g, '');
  if (digits.startsWith('00216')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('216') && digits.length >= 11) {
    digits = digits.slice(3);
  }
  return digits.slice(0, 8);
}

function formatPhone(raw) {
  const digits = extractPhoneDigits(raw);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return digits.slice(0, 2) + ' ' + digits.slice(2);
  return digits.slice(0, 2) + ' ' + digits.slice(2, 5) + ' ' + digits.slice(5, 8);
}

const PHONE_REGEX = /^\d{2} \d{3} \d{3}$/;

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("ERREUR : Aucune variable MONGODB_URI trouvée dans l'environnement.");
    process.exit(1);
  }

  console.log('Connexion à MongoDB...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log('Connecté avec succès.');

  // 1. Normalisation des Leads (CRM Formatic & Elios)
  console.log('\n--- Normalisation de la collection "leads" ---');
  const leads = await db.collection('leads').find({}).toArray();
  const leadOps = [];
  for (const lead of leads) {
    if (lead.phone && !PHONE_REGEX.test(lead.phone)) {
      const normalized = formatPhone(lead.phone);
      if (normalized && normalized !== lead.phone) {
        leadOps.push({
          updateOne: {
            filter: { _id: lead._id },
            update: { $set: { phone: normalized } }
          }
        });
      }
    }
  }
  if (leadOps.length > 0) {
    console.log(`Exécution bulkWrite pour ${leadOps.length} leads...`);
    const res = await db.collection('leads').bulkWrite(leadOps);
    console.log(`Leads mis à jour : ${res.modifiedCount} / ${leads.length}`);
  } else {
    console.log(`Tous les ${leads.length} leads sont déjà normalisés.`);
  }

  // 2. Normalisation des Receipts (Reçus & Justificatifs)
  console.log('\n--- Normalisation de la collection "receipts" ---');
  const receipts = await db.collection('receipts').find({}).toArray();
  const receiptOps = [];
  for (const receipt of receipts) {
    const rawTel = receipt.clientDetails?.telephone;
    if (rawTel && !PHONE_REGEX.test(rawTel) && rawTel !== '00000000' && rawTel !== 'N/A') {
      const normalized = formatPhone(rawTel);
      if (normalized && normalized !== rawTel) {
        receiptOps.push({
          updateOne: {
            filter: { _id: receipt._id },
            update: { $set: { 'clientDetails.telephone': normalized } }
          }
        });
      }
    }
  }
  if (receiptOps.length > 0) {
    console.log(`Exécution bulkWrite pour ${receiptOps.length} reçus...`);
    const res = await db.collection('receipts').bulkWrite(receiptOps);
    console.log(`Reçus mis à jour : ${res.modifiedCount} / ${receipts.length}`);
  } else {
    console.log(`Tous les ${receipts.length} reçus sont déjà normalisés.`);
  }

  // 3. Normalisation des Enseignants (Teachers)
  console.log('\n--- Normalisation de la collection "teachers" ---');
  const teachers = await db.collection('teachers').find({}).toArray();
  const teacherOps = [];
  for (const teacher of teachers) {
    if (teacher.phone && !PHONE_REGEX.test(teacher.phone)) {
      const normalized = formatPhone(teacher.phone);
      if (normalized && normalized !== teacher.phone) {
        teacherOps.push({
          updateOne: {
            filter: { _id: teacher._id },
            update: { $set: { phone: normalized } }
          }
        });
      }
    }
  }
  if (teacherOps.length > 0) {
    console.log(`Exécution bulkWrite pour ${teacherOps.length} enseignants...`);
    const res = await db.collection('teachers').bulkWrite(teacherOps);
    console.log(`Enseignants mis à jour : ${res.modifiedCount} / ${teachers.length}`);
  } else {
    console.log(`Tous les ${teachers.length} enseignants sont déjà normalisés.`);
  }

  // 4. Normalisation des Séances (Sessions)
  console.log('\n--- Normalisation de la collection "sessions" ---');
  const sessions = await db.collection('sessions').find({}).toArray();
  const sessionOps = [];
  for (const session of sessions) {
    if (session.teacherPhone && !PHONE_REGEX.test(session.teacherPhone)) {
      const normalized = formatPhone(session.teacherPhone);
      if (normalized && normalized !== session.teacherPhone) {
        sessionOps.push({
          updateOne: {
            filter: { _id: session._id },
            update: { $set: { teacherPhone: normalized } }
          }
        });
      }
    }
  }
  if (sessionOps.length > 0) {
    console.log(`Exécution bulkWrite pour ${sessionOps.length} séances...`);
    const res = await db.collection('sessions').bulkWrite(sessionOps);
    console.log(`Séances mises à jour : ${res.modifiedCount} / ${sessions.length}`);
  } else {
    console.log(`Toutes les ${sessions.length} séances sont déjà normalisées.`);
  }

  console.log('\n✓ Normalisation terminée avec succès dans toutes les collections MongoDB.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Erreur lors de la migration :', err);
  process.exit(1);
});

