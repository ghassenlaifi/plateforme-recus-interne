const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ghassenlaifii_db_user:v5S91ZMkwGXEL1P4@receipthub-cluster.aqr9ofq.mongodb.net/?appName=ReceiptHub-Cluster';
const EXCEL_FILE_PATH = 'C:/Users/ghass/Downloads/prospects-2026-09-30 (1).xlsx';

const KNOWN_OPERATORS = ['Ghassen', 'Asma', 'Mariem', 'Aya', 'Koussay', 'Narjess', 'Soumaya', 'Elyes', 'Amine'];

function parseDate(str) {
  if (!str) return null;
  if (str instanceof Date && !isNaN(str.getTime())) return str;
  const strVal = String(str).trim();
  
  // Format DD/MM/YYYY HH:mm:ss ou DD/MM/YYYY
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

  // Format ISO / string standard
  const cleaned = strVal.replace(/\(.*?\)/g, '').trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;

  return null;
}

function detectOperator(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  
  if (lower.includes('narjess') || lower.includes('narjes')) return 'Narjess';
  if (lower.includes('soumaya') || lower.includes('soumaia') || lower.includes('sou :') || lower.includes('soum :')) return 'Soumaya';
  if (lower.includes('elyes') || lower.includes('elies') || lower.includes('labidi')) return 'Elyes';
  if (lower.includes('mariem') || lower.includes('meriem') || lower.includes('maryem')) return 'Mariem';
  if (lower.includes('aya') || lower.includes('eya') || lower.includes('aya :')) return 'Aya';
  if (lower.includes('asma')) return 'Asma';
  if (lower.includes('ghassen') || lower.includes('gassen')) return 'Ghassen';
  if (lower.includes('koussay') || lower.includes('kousai')) return 'Koussay';
  if (lower.includes('amine')) return 'Amine';

  for (const op of KNOWN_OPERATORS) {
    const regex = new RegExp(`\\b${op.toLowerCase()}\\b`, 'i');
    if (regex.test(lower)) return op;
  }
  return null;
}

function normalizeGrade(gradeRaw) {
  const g = (gradeRaw || '').toString().trim();
  const lower = g.toLowerCase();
  if (lower === 'bac' || lower.includes('bac')) return 'BAC';
  if (lower.includes('3ème') || lower.includes('3eme') || lower.includes('3 éme')) return '3ème Année';
  if (lower.includes('2ème') || lower.includes('2eme') || lower.includes('2 éme')) return '2ème Année';
  if (lower.includes('1ère') || lower.includes('1ere') || lower.includes('1 ère')) return '1ère Année';
  if (lower.includes('9ème') || lower.includes('9eme')) return '9ème de Base';
  if (lower.includes('8ème') || lower.includes('8eme')) return '8ème de Base';
  if (lower.includes('7ème') || lower.includes('7eme')) return '7ème de Base';
  return g;
}

function normalizeSection(secRaw) {
  const s = (secRaw || '').toString().trim();
  const lower = s.toLowerCase();
  if (lower.includes('math')) return 'Mathématiques';
  if (lower.includes('scien')) return 'Science';
  if (lower.includes('tech')) return 'Technique';
  if (lower.includes('info')) return 'Informatique';
  if (lower.includes('eco') || lower.includes('éco')) return 'Économie';
  if (lower.includes('lettre')) return 'Lettres';
  if (lower.includes('sport')) return 'Sport';
  return s;
}

async function runImport() {
  console.log('=== DÉBUT DE L\'IMPORTATION MILITAIRE DES PROSPECTS FORMATIC ===');
  
  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error(`Fichier introuvable: ${EXCEL_FILE_PATH}`);
    process.exit(1);
  }

  console.log(`Lecture du classeur Formatic: ${EXCEL_FILE_PATH}...`);
  const wb = xlsx.readFile(EXCEL_FILE_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json(sheet);
  console.log(`Nombre total de lignes brutes détectées: ${rawRows.length}`);

  console.log('Connexion à MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI, { dbName: 'test' });
  console.log('Connecté avec succès à MongoDB Atlas (base test).');

  const db = mongoose.connection.db;
  const collection = db.collection('leads');

  // Supprimer les anciens leads Formatic pour un import 100% propre et idempotent
  const deletedOld = await collection.deleteMany({ crmType: 'formatic' });
  console.log(`Anciens leads Formatic nettoyés: ${deletedOld.deletedCount}`);

  // Trouver le max ID existant dans Elios pour les copies To Elios
  const eliosLeads = await collection.find({ crmType: 'elios' }).toArray();
  const eliosPhoneMap = new Map();
  let maxEliosNum = 0;
  for (const el of eliosLeads) {
    if (el.phone) eliosPhoneMap.set(el.phone, el);
    if (el.id && el.id.startsWith('PRO-')) {
      const num = parseInt(el.id.replace('PRO-', ''), 10);
      if (!isNaN(num) && num > maxEliosNum) maxEliosNum = num;
    }
  }
  console.log(`Total Elios leads existants: ${eliosLeads.length}, Max ID Elios: PRO-${maxEliosNum}`);

  const formaticDocs = [];
  const toEliosSyncDocs = [];
  const toEliosUpdateIds = [];

  let countToEliosYes = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const id = (row.ID || `PRO-${String(i + 1).padStart(5, '0')}`).trim();
    const firstName = (row.Prenom || '').toString().trim();
    const lastName = (row.Nom || '').toString().trim();
    const computedName = [firstName, lastName].filter(Boolean).join(' ') || (firstName || lastName || 'Prospect sans nom');

    let phone = (row.Telephone || '').toString().replace(/\D/g, '');
    if (phone.length === 11 && phone.startsWith('216')) {
      phone = phone.slice(3);
    }

    const source = (row.Source || 'Formatic dataBase').toString().trim();
    const grade = normalizeGrade(row.Grade);
    const section = normalizeSection(row.Specialite);

    let status = (row.Statut || 'N/A').toString().trim();
    if (status === 'Converti') status = 'Approved';
    if (!status) status = 'Lead';

    const offer = (row.Offre || 'Zero to Hero').toString().trim();

    // TO ELIOS check
    const rawToElios = (row['To Elios'] || '').toString().toLowerCase();
    const toElios = rawToElios.includes('oui') || rawToElios === 'true';
    if (toElios) countToEliosYes++;

    const creationDate = parseDate(row.DateCreation) || parseDate(row.DerniereMiseAJour) || new Date();
    const updateDate = parseDate(row.DerniereMiseAJour) || creationDate || new Date();

    // Parsing et découpage des notes
    const rawNotesText = (row.Notes || '').toString().trim();
    const parsedNotes = [];
    let detectedOp = null;

    if (rawNotesText) {
      const noteBlocks = rawNotesText.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
      for (let bIdx = 0; bIdx < noteBlocks.length; bIdx++) {
        const block = noteBlocks[bIdx];
        const opFromBlock = detectOperator(block);
        if (opFromBlock && !detectedOp) detectedOp = opFromBlock;

        parsedNotes.push({
          id: `note-${id}-${bIdx + 1}`,
          text: block,
          by: opFromBlock || 'Système',
          addedBy: opFromBlock || 'Système',
          date: updateDate.toISOString(),
          addedAt: updateDate
        });
      }
    }

    const assignedStaff = detectedOp || 'Non assigné';
    const lastModifier = detectedOp || 'Système';

    const formaticLead = {
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
      staff: assignedStaff,
      crmType: 'formatic',
      familyGroup: '',
      toElios,
      fromFormatic: false,
      date: creationDate,
      updatedAt: updateDate,
      lastModifiedBy: lastModifier,
      notes: parsedNotes
    };

    formaticDocs.push(formaticLead);

    // GESTION DU COPY TO ELIOS
    if (toElios && phone) {
      if (eliosPhoneMap.has(phone)) {
        // Déjà existant dans Elios -> on marque fromFormatic: true
        const existing = eliosPhoneMap.get(phone);
        toEliosUpdateIds.push(existing._id);
      } else {
        // Non existant dans Elios -> on crée la copie avec étiquette fromFormatic: true
        maxEliosNum++;
        const newEliosId = `PRO-${String(maxEliosNum).padStart(5, '0')}`;
        
        const eliosCopy = {
          id: newEliosId,
          firstName,
          lastName,
          name: computedName,
          phone,
          offer,
          amount: '',
          source: 'From Formatic',
          grade,
          section,
          status,
          staff: assignedStaff,
          crmType: 'elios',
          familyGroup: '',
          toElios: false,
          fromFormatic: true,
          date: creationDate,
          updatedAt: updateDate,
          lastModifiedBy: lastModifier,
          notes: [
            ...parsedNotes,
            {
              id: `note-from-formatic-${id}`,
              text: `Prospect copié depuis CRM Formatic (Fiche originale : ${id})`,
              by: lastModifier,
              addedBy: lastModifier,
              date: updateDate.toISOString(),
              addedAt: updateDate
            }
          ]
        };
        toEliosSyncDocs.push(eliosCopy);
        eliosPhoneMap.set(phone, eliosCopy); // évite les doublons dans le même batch
      }
    }
  }

  console.log(`Insertion de ${formaticDocs.length} prospects dans CRM Formatic...`);
  if (formaticDocs.length > 0) {
    await collection.insertMany(formaticDocs);
  }
  console.log('✓ Tous les prospects Formatic insérés avec succès.');

  console.log(`Synchronisation TO ELIOS :`);
  console.log(`- Prospects Formatic marqués To Elios: ${countToEliosYes}`);
  console.log(`- Prospects Elios existants mis à jour avec étiquette "fromFormatic": ${toEliosUpdateIds.length}`);
  console.log(`- Nouveaux prospects créés et copiés dans CRM Elios: ${toEliosSyncDocs.length}`);

  if (toEliosUpdateIds.length > 0) {
    await collection.updateMany(
      { _id: { $in: toEliosUpdateIds } },
      { $set: { fromFormatic: true } }
    );
    console.log('✓ Prospects Elios existants mis à jour avec fromFormatic: true.');
  }

  if (toEliosSyncDocs.length > 0) {
    await collection.insertMany(toEliosSyncDocs);
    console.log(`✓ ${toEliosSyncDocs.length} prospects copiés avec succès dans CRM Elios.`);
  }

  const finalFormaticCount = await collection.countDocuments({ crmType: 'formatic' });
  const finalEliosCount = await collection.countDocuments({ crmType: 'elios' });
  const finalFromFormaticInElios = await collection.countDocuments({ crmType: 'elios', fromFormatic: true });

  console.log('=== BILAN GLOBAL POST-IMPORTATION ===');
  console.log(`- Total Leads Formatic : ${finalFormaticCount}`);
  console.log(`- Total Leads Elios    : ${finalEliosCount}`);
  console.log(`- Leads Elios avec étiquette "From Formatic" : ${finalFromFormaticInElios}`);

  await mongoose.disconnect();
  console.log('Déconnexion de MongoDB Atlas réussie.');
  console.log('=== IMPORTATION TERMINÉE AVEC SUCCÈS ===');
}

runImport().catch(err => {
  console.error('Erreur fatale lors de l\'import:', err);
  process.exit(1);
});
