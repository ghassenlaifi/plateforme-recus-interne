const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Charger .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const MONGODB_URI = process.env.MONGODB_URI;

// Fonction de normalisation canonique
function getCanonicalPhoneKey(raw) {
  if (!raw) return 'EMPTY';
  const str = String(raw).trim();
  const digits = str.replace(/\D/g, '');
  if (!digits) return 'NO_DIGITS';
  
  if (str.startsWith('+968') || str.startsWith('00968') || (digits.startsWith('968') && digits.length >= 11)) {
    let d = digits;
    if (d.startsWith('00968')) d = d.slice(5);
    else if (d.startsWith('968')) d = d.slice(3);
    return 'OM_' + d.slice(0, 8);
  }
  
  let d = digits;
  if (d.startsWith('00216')) d = d.slice(5);
  else if (d.startsWith('216') && d.length >= 11) d = d.slice(3);
  
  if (d.length >= 8) {
    return 'TN_' + d.slice(-8);
  }
  return 'RAW_' + digits;
}

// Hiérarchie des statuts
const STATUS_RANK = {
  'Approved': 100,
  'Converti': 100,
  'Approved Prospect': 90,
  'Acompte': 85,
  'Potential Prospect': 70,
  'Lead': 50,
  'N/A': 30,
  'Rejected': 20,
  'Annulé': 10,
  'Inconnu': 0
};

function getStatusRank(s) {
  return STATUS_RANK[s] || 40;
}

function normalizeName(name) {
  const n = String(name || '').trim();
  if (!n || n.toLowerCase() === 'prospect sans nom') return '';
  return n;
}

function normalizeNoteDate(n) {
  const d = n.addedAt || n.date;
  if (!d) return new Date();
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function mergeLeadGroup(leads, phoneKey) {
  // 1. Choisir le Master
  const eliosLeads = leads.filter(l => l.crmType === 'elios');
  const formaticLeads = leads.filter(l => l.crmType === 'formatic');
  const isCross = eliosLeads.length > 0 && formaticLeads.length > 0;

  let candidates = eliosLeads.length > 0 ? eliosLeads : formaticLeads;

  // Tri des candidats par ancienneté d'ID et de date
  candidates.sort((a, b) => {
    const numA = parseInt((a.id || '').replace('PRO-', ''), 10) || 999999;
    const numB = parseInt((b.id || '').replace('PRO-', ''), 10) || 999999;
    if (numA !== numB) return numA - numB;
    const dateA = new Date(a.date || a.createdAt || 0).getTime();
    const dateB = new Date(b.date || b.createdAt || 0).getTime();
    return dateA - dateB;
  });

  const master = { ...candidates[0] };
  const secondaries = leads.filter(l => String(l._id) !== String(master._id));

  // 2. Fusion intelligente des champs
  for (const sec of secondaries) {
    // Nom
    const masterName = normalizeName(master.name);
    const secName = normalizeName(sec.name);
    if (!masterName && secName) {
      master.name = sec.name;
    } else if (masterName && secName && secName.length > masterName.length && secName.includes(masterName)) {
      master.name = sec.name;
    }

    if (!master.firstName && sec.firstName) master.firstName = sec.firstName;
    if (!master.lastName && sec.lastName) master.lastName = sec.lastName;

    // Statut : garder le plus prioritaire
    if (getStatusRank(sec.status) > getStatusRank(master.status)) {
      master.status = sec.status;
    }

    // Champs métiers si vides
    if (!master.offer || master.offer === 'Zero to Hero') {
      if (sec.offer && sec.offer !== 'Zero to Hero') master.offer = sec.offer;
    }
    if (!master.amount && sec.amount) master.amount = sec.amount;
    if (!master.grade && sec.grade) master.grade = sec.grade;
    if (!master.section && sec.section) master.section = sec.section;
    if (!master.familyGroup && sec.familyGroup) master.familyGroup = sec.familyGroup;

    // Modificateurs
    const allMods = new Set([...(master.modifiers || []), ...(sec.modifiers || [])]);
    master.modifiers = Array.from(allMods);

    // Logs
    const secLogs = Array.isArray(sec.modifierLogs) ? sec.modifierLogs : [];
    const masterLogs = Array.isArray(master.modifierLogs) ? master.modifierLogs : [];
    master.modifierLogs = [...masterLogs, ...secLogs];
  }

  // Si cross-CRM ou provenant de Formatic
  if (isCross || formaticLeads.length > 0) {
    master.crmType = 'elios';
    master.fromFormatic = true;
    master.toElios = false;
    if (!master.source || master.source === 'Facebook') {
      master.source = 'From Formatic';
    }
  }

  // 3. Fusion et réconciliation des notes
  const noteFingerprints = new Set();
  const mergedNotes = [];

  // Traiter les notes de tous les leads
  for (const l of leads) {
    const isFormaticDoc = l.crmType === 'formatic';
    const notesList = Array.isArray(l.notes) ? l.notes : [];

    for (const n of notesList) {
      if (!n || !n.text) continue;
      let text = String(n.text).trim();
      if (!text) continue;

      // Si provient de Formatic et n'indique pas encore Formatic
      if (isFormaticDoc && !text.toLowerCase().includes('formatic')) {
        text = `[Formatic] ${text}`;
      }

      // Empreinte de déduplication (insensible à la casse et espaces superflus)
      const cleanFp = text.toLowerCase().replace(/^\[formatic\]\s*/i, '').replace(/\s+/g, ' ');
      const authorKey = (n.by || n.addedBy || 'Système').trim().toLowerCase();
      const fpKey = `${authorKey}:::${cleanFp}`;

      if (noteFingerprints.has(fpKey)) {
        // Doublon strict de note -> ignoré
        continue;
      }
      noteFingerprints.add(fpKey);

      const noteDate = normalizeNoteDate(n);
      mergedNotes.push({
        id: n.id || `note-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        text: text,
        by: (n.by || n.addedBy || 'Système').trim(),
        addedBy: (n.addedBy || n.by || 'Système').trim(),
        date: noteDate.toISOString(),
        addedAt: noteDate
      });
    }
  }

  // Tri chronologique descendant (plus récent en tête, convention Next.js de la plateforme)
  mergedNotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  master.notes = mergedNotes;

  return {
    master,
    secondariesToDelete: secondaries.map(s => ({ _id: s._id, id: s.id, crmType: s.crmType, name: s.name })),
    isCross,
    originalCount: leads.length,
    finalNotesCount: mergedNotes.length
  };
}

async function runDryRun() {
  console.log("=== SIMULATION DRY-RUN DU GRAND CHANTIER DE FUSION DES DOUBLONS ===");
  await mongoose.connect(MONGODB_URI, { family: 4 });
  const Lead = mongoose.models.Lead || mongoose.model('Lead', new mongoose.Schema({}, { strict: false }));
  const allLeads = await Lead.find({}).lean();

  const groups = new Map();
  for (const lead of allLeads) {
    const key = getCanonicalPhoneKey(lead.phone);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(lead);
  }

  const results = [];
  for (const [key, leads] of groups.entries()) {
    if (leads.length > 1 && key !== 'EMPTY' && key !== 'NO_DIGITS') {
      const merged = mergeLeadGroup(leads, key);
      results.push({ phoneKey: key, ...merged });
    }
  }

  console.log(`\nNombre de groupes analysés et simulés avec succès : ${results.length}`);
  console.log(`Total de documents secondaires identifiés pour suppression : ${results.reduce((acc, r) => acc + r.secondariesToDelete.length, 0)}`);

  console.log("\n--- EXEMPLES DE FUSIONS OBTENUES EN SIMULATION ---");
  for (const r of results.slice(0, 5)) {
    console.log(`\n======================================================`);
    console.log(`Téléphone : ${r.phoneKey} (Doublons initiaux : ${r.originalCount}) - ${r.isCross ? 'CROSS-CRM' : 'INTRA-CRM'}`);
    console.log(`Master conservé : [${r.master.crmType.toUpperCase()}] ID: ${r.master.id} | Nom: "${r.master.name}" | Statut: ${r.master.status}`);
    console.log(`Fiches secondaires supprimées :`);
    r.secondariesToDelete.forEach(s => {
      console.log(`  x Supprimer: [${s.crmType.toUpperCase()}] ID: ${s.id} | Nom: "${s.name}" | _id: ${s._id}`);
    });
    console.log(`Notes consolidées (${r.finalNotesCount} notes) :`);
    r.master.notes.slice(0, 3).forEach(n => {
      console.log(`    * [${n.by}] (${n.date.slice(0, 10)}) : ${n.text.slice(0, 70)}...`);
    });
  }

  await mongoose.disconnect();
  console.log("\nSimulation terminée sans aucune modification en base de données.");
}

runDryRun().catch(err => {
  console.error(err);
  process.exit(1);
});

