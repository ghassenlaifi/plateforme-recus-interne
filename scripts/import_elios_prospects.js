const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ghassenlaifii_db_user:v5S91ZMkwGXEL1P4@receipthub-cluster.aqr9ofq.mongodb.net/?appName=ReceiptHub-Cluster';
const EXCEL_FILE_PATH = 'C:/Users/ghass/Downloads/prospects-2026-09-30.xlsx';

const KNOWN_OPERATORS = ['Ghassen', 'Asma', 'Mariem', 'Aya', 'Koussay', 'Narjess', 'Soumaya', 'Elyes', 'Amine'];

function parseDate(str) {
  if (!str) return null;
  if (str instanceof Date && !isNaN(str.getTime())) return str;
  const strVal = String(str).trim();
  
  // Format DD/MM/YYYY HH:mm:ss
  //  ou DD/MM/YYYY
  const m = strVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (m) {
    return new Date(
      parseInt(m[3], 10),
      parseInt(m[2], 10) - 1,
      parseInt(m[1], 10),
      parseInt(m[4] || '0', 10),
      parseInt(m[5] || '0', 10),
      parseInt(m[6] || '0', 10)
    );
  }

  // Format ISO / string standard (sans les libellés de fuseau entre parenthèses)
  const cleaned = strVal.replace(/\(.*?\)/g, '').trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;

  return null;
}

function detectOperator(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const op of KNOWN_OPERATORS) {
    const regex = new RegExp(`\\b${op.toLowerCase()}\\b`, 'i');
    if (regex.test(lower)) return op;
  }
  return null;
}

async function runImport() {
  console.log('=== DÉBUT DE L\'IMPORTATION MILITAIRE DES PROSPECTS ELIOS ===');
  
  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error(`Fichier introuvable: ${EXCEL_FILE_PATH}`);
    process.exit(1);
  }

  console.log(`Lecture du classeur: ${EXCEL_FILE_PATH}...`);
  const wb = xlsx.readFile(EXCEL_FILE_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json(sheet);
  console.log(`Nombre total de lignes brutes détectées: ${rawRows.length}`);

  console.log('Connexion à MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI, { dbName: 'test' });
  console.log('Connecté avec succès à MongoDB Atlas (test database).');

  const db = mongoose.connection.db;
  const collection = db.collection('leads');

  const bulkOps = [];
  let processed = 0;

  for (const row of rawRows) {
    processed++;
    const id = (row.ID || `PRO-${String(processed).padStart(5, '0')}`).trim();
    const firstName = (row.Prenom || '').toString().trim();
    const lastName = (row.Nom || '').toString().trim();
    const computedName = [firstName, lastName].filter(Boolean).join(' ') || (firstName || lastName || 'Prospect sans nom');

    let phone = (row.Telephone || '').toString().replace(/\D/g, '');
    if (phone.length === 11 && phone.startsWith('216')) {
      phone = phone.slice(3);
    }

    let source = (row.Source || 'Facebook').toString().trim();
    if (source.toLowerCase() === 'ex_elios') source = 'Ex-Elios';
    if (source.toLowerCase() === 'whatsapp') source = 'Whatsapp';

    let grade = (row.Grade || '').toString().trim();
    if (grade.toLowerCase() === 'bac') grade = 'BAC';

    let section = (row.Specialite || '').toString().trim();

    let status = (row.Statut || 'Lead').toString().trim();
    if (status === 'Converti') status = 'Approved';
    if (!status) status = 'Lead';

    const offer = (row.Offre || 'Zero to Hero').toString().trim();

    const creationDate = parseDate(row.DateCreation) || parseDate(row.DerniereMiseAJour) || new Date();
    const updateDate = parseDate(row.DerniereMiseAJour) || creationDate || new Date();

    // Traitement des notes
    const rawNotesText = (row.Notes || '').toString();
    const noteLines = rawNotesText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    let lastOp = null;
    const structuredNotes = noteLines.map((line, idx) => {
      const op = detectOperator(line) || 'Système';
      if (op !== 'Système') lastOp = op;
      return {
        id: `note-${id}-${idx + 1}`,
        text: line,
        by: op,
        addedBy: op,
        date: updateDate.toISOString(),
        addedAt: updateDate
      };
    });

    const staffOperator = lastOp || 'Système';

    bulkOps.push({
      updateOne: {
        filter: { id: id, crmType: 'elios' },
        update: {
          $set: {
            id,
            firstName,
            lastName,
            name: computedName,
            phone,
            offer,
            amount: '',
            source,
            grade,
            section,
            status,
            staff: staffOperator,
            date: creationDate,
            updatedAt: updateDate,
            lastModifiedBy: staffOperator,
            notes: structuredNotes,
            crmType: 'elios'
          }
        },
        upsert: true
      }
    });

    if (bulkOps.length >= 500) {
      console.log(`Exécution du batch bulkWrite... (${processed}/${rawRows.length})`);
      await collection.bulkWrite(bulkOps);
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    console.log(`Exécution du dernier batch bulkWrite (${bulkOps.length} ops)...`);
    await collection.bulkWrite(bulkOps);
  }

  console.log(`\n=== RAPPORT D'INGESTION RÉUSSIE ===`);
  const totalInDb = await collection.countDocuments({ crmType: 'elios' });
  console.log(`Total prospects Elios en base : ${totalInDb}`);

  const statusAgg = await collection.aggregate([
    { $match: { crmType: 'elios' } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log('Distribution des statuts en base :');
  statusAgg.forEach(s => console.log(`  - ${s._id}: ${s.count}`));

  await mongoose.disconnect();
  console.log('Connexion MongoDB fermée proprement.');
}

runImport().catch(err => {
  console.error('Erreur fatale lors de l\'import:', err);
  process.exit(1);
});
