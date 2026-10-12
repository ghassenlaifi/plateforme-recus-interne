const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 1. Chargement de la configuration d'environnement .env.local
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
if (!MONGODB_URI) {
  console.error("Erreur critique: MONGODB_URI manquant dans .env.local");
  process.exit(1);
}

// 2. Normalisation canonique universelle du numéro de téléphone
function getCanonicalPhoneKey(raw) {
  if (!raw) return 'EMPTY';
  const str = String(raw).trim();
  const digits = str.replace(/\D/g, '');
  if (!digits) return 'NO_DIGITS';
  
  // Oman (+968)
  if (str.startsWith('+968') || str.startsWith('00968') || (digits.startsWith('968') && digits.length >= 11)) {
    let d = digits;
    if (d.startsWith('00968')) d = d.slice(5);
    else if (d.startsWith('968')) d = d.slice(3);
    return 'OM_' + d.slice(0, 8);
  }
  
  // Tunisie (+216)
  let d = digits;
  if (d.startsWith('00216')) d = d.slice(5);
  else if (d.startsWith('216') && d.length >= 11) d = d.slice(3);
  
  if (d.length >= 8) {
    return 'TN_' + d.slice(-8);
  }
  return 'RAW_' + digits;
}

// 3. Hiérarchie et pondération des statuts métiers
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

// 4. Algorithme de fusion déterministe
function consolidateLeadGroup(leads, phoneKey) {
  const eliosLeads = leads.filter(l => l.crmType === 'elios');
  const formaticLeads = leads.filter(l => l.crmType === 'formatic');
  const isCross = eliosLeads.length > 0 && formaticLeads.length > 0;

  // Sélection du candidat Master
  const candidates = eliosLeads.length > 0 ? eliosLeads : formaticLeads;

  // Tri pour privilégier l'ID le plus ancien/historique (ex: PRO-00019)
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

  // Fusion intelligente des données
  for (const sec of secondaries) {
    const masterName = normalizeName(master.name);
    const secName = normalizeName(sec.name);
    if (!masterName && secName) {
      master.name = sec.name;
    } else if (masterName && secName && secName.length > masterName.length && secName.includes(masterName)) {
      master.name = sec.name;
    }

    if (!master.firstName && sec.firstName) master.firstName = sec.firstName;
    if (!master.lastName && sec.lastName) master.lastName = sec.lastName;

    // Statut : préserver le statut de plus haute valeur commerciale
    if (getStatusRank(sec.status) > getStatusRank(master.status)) {
      master.status = sec.status;
    }

    // Champs métiers
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

  // Règle architecturale : Si cross-CRM (présent dans les deux) -> Le client est consolidé définitivement vers Elios
  if (isCross || formaticLeads.length > 0) {
    master.crmType = 'elios';
    master.fromFormatic = true;
    master.toElios = false;
    if (!master.source || master.source === 'Facebook') {
      master.source = 'From Formatic';
    }
  }

  // Fusion & Réconciliation des Notes
  const noteFingerprints = new Set();
  const mergedNotes = [];

  for (const l of leads) {
    const isFormaticDoc = l.crmType === 'formatic';
    const notesList = Array.isArray(l.notes) ? l.notes : [];

    for (const n of notesList) {
      if (!n || !n.text) continue;
      let text = String(n.text).trim();
      if (!text) continue;

      // Mention explicite de l'origine si provenant de Formatic
      if (isFormaticDoc && !text.toLowerCase().includes('formatic')) {
        text = `[Formatic] ${text}`;
      }

      // Empreinte unique de note pour éliminer les doublons stricts
      const cleanFp = text.toLowerCase().replace(/^\[formatic\]\s*/i, '').replace(/\s+/g, ' ');
      const authorKey = (n.by || n.addedBy || 'Système').trim().toLowerCase();
      const fpKey = `${authorKey}:::${cleanFp}`;

      if (noteFingerprints.has(fpKey)) {
        continue; // Note déjà présente -> éviter le bruit
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

  // Tri chronologique rigoureux : du plus récent au plus ancien (anti-chronologique, standard plateforme)
  mergedNotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  master.notes = mergedNotes;
  master.updatedAt = new Date();

  return {
    master,
    secondariesToDelete: secondaries.map(s => s._id),
    isCross,
    originalCount: leads.length,
    finalNotesCount: mergedNotes.length
  };
}

// 5. Exécution Principale
async function main() {
  console.log("===============================================================================");
  console.log("   CHANTIER ARCHITECTURAL DE FUSION & ASSAINISSEMENT ULTIME DES LEADS (CTO)   ");
  console.log("===============================================================================");

  console.log("\n1. Connexion à MongoDB...");
  await mongoose.connect(MONGODB_URI, {
    family: 4,
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 45000,
  });
  console.log("✓ Connecté à MongoDB.");

  const Lead = mongoose.models.Lead || mongoose.model('Lead', new mongoose.Schema({}, { strict: false }));

  // 2. Création d'une sauvegarde de sécurité complète (Backup Snapshot)
  console.log("\n2. Extraction et sauvegarde de sécurité complète (Pre-Migration Snapshot)...");
  const allLeads = await Lead.find({}).lean();
  console.log(`✓ ${allLeads.length} leads extraits.`);

  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `leads_snapshot_pre_dedup_${timestampStr}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(allLeads, null, 2), 'utf8');
  console.log(`✓ Sauvegarde de sécurité enregistrée avec succès : ${backupFile} (${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(2)} MB)`);

  // 3. Regroupement par numéro canonique
  console.log("\n3. Analyse et regroupement par clé de téléphone canonique...");
  const groups = new Map();
  for (const lead of allLeads) {
    const key = getCanonicalPhoneKey(lead.phone);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(lead);
  }

  const duplicateGroups = [];
  for (const [key, leads] of groups.entries()) {
    if (leads.length > 1 && key !== 'EMPTY' && key !== 'NO_DIGITS') {
      duplicateGroups.push({ key, leads });
    }
  }

  console.log(`✓ ${duplicateGroups.length} groupes avec doublons détectés pour assainissement.`);

  // 4. Exécution de la fusion et suppression atomique des doublons
  console.log("\n4. Exécution des fusions et consolidations en base de données...");

  let updatedMastersCount = 0;
  let deletedSecondariesCount = 0;
  let crossCrmCount = 0;
  let intraEliosCount = 0;

  for (let i = 0; i < duplicateGroups.length; i++) {
    const { key, leads } = duplicateGroups[i];
    const consolidation = consolidateLeadGroup(leads, key);

    const master = consolidation.master;
    const toDeleteIds = consolidation.secondariesToDelete;

    if (consolidation.isCross) crossCrmCount++;
    else intraEliosCount++;

    // Mise à jour de la fiche Master
    await Lead.updateOne(
      { _id: master._id },
      {
        $set: {
          name: master.name,
          firstName: master.firstName || '',
          lastName: master.lastName || '',
          phone: master.phone,
          status: master.status,
          offer: master.offer || 'Zero to Hero',
          amount: master.amount || '',
          grade: master.grade || '',
          section: master.section || '',
          familyGroup: master.familyGroup || '',
          source: master.source || 'Facebook',
          crmType: master.crmType,
          fromFormatic: Boolean(master.fromFormatic),
          toElios: Boolean(master.toElios),
          modifiers: master.modifiers || [],
          modifierLogs: master.modifierLogs || [],
          notes: master.notes,
          updatedAt: master.updatedAt
        }
      }
    );
    updatedMastersCount++;

    // Suppression définitive des fiches secondaires redondantes
    if (toDeleteIds.length > 0) {
      await Lead.deleteMany({ _id: { $in: toDeleteIds } });
      deletedSecondariesCount += toDeleteIds.length;
    }

    if ((i + 1) % 30 === 0 || i === duplicateGroups.length - 1) {
      console.log(`  Progression : ${i + 1}/${duplicateGroups.length} groupes traités...`);
    }
  }

  console.log("\n✓ Toutes les fusions ont été appliquées avec succès :");
  console.log(`  - Fiches Master enrichies et consolidées : ${updatedMastersCount}`);
  console.log(`  - Fiches secondaires en doublon supprimées : ${deletedSecondariesCount}`);
  console.log(`  - Dont doublons Cross-CRM réconciliés vers Elios : ${crossCrmCount}`);
  console.log(`  - Dont doublons Intra-Elios consolidés : ${intraEliosCount}`);

  // 5. Audit de validation Post-Migration
  console.log("\n5. Audit de contrôle et validation de l'intégrité finale...");
  const finalLeads = await Lead.find({}).lean();
  console.log(`- Nombre final de leads en base : ${finalLeads.length} (initialement : ${allLeads.length})`);

  const verifyGroups = new Map();
  for (const lead of finalLeads) {
    const key = getCanonicalPhoneKey(lead.phone);
    if (!verifyGroups.has(key)) verifyGroups.set(key, []);
    verifyGroups.get(key).push(lead);
  }

  let residualDuplicates = 0;
  for (const [key, leads] of verifyGroups.entries()) {
    if (leads.length > 1 && key !== 'EMPTY' && key !== 'NO_DIGITS') {
      residualDuplicates++;
      console.error(`  Anomalie résiduelle sur la clé : ${key} (${leads.length} leads)`);
    }
  }

  if (residualDuplicates === 0) {
    console.log("===============================================================================");
    console.log("✓ SUCCES TOTAL : 0 DOUBLON RESIDUEL DANS TOUTE LA BASE DE DONNEES !");
    console.log("✓ L'ensemble des numéros de téléphone sont désormais 100% uniques et consolidés.");
    console.log("===============================================================================");
  } else {
    console.warn(`Attention : ${residualDuplicates} doublon(s) résiduel(s) détecté(s).`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error("Erreur critique d'exécution:", err);
  process.exit(1);
});

