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
if (!MONGODB_URI) {
  console.error("Erreur: MONGODB_URI non trouvé dans .env.local");
  process.exit(1);
}

// Fonction de normalisation de téléphone canonique
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
  
  // Tunisie (+216) ou 8 chiffres
  let d = digits;
  if (d.startsWith('00216')) d = d.slice(5);
  else if (d.startsWith('216') && d.length >= 11) d = d.slice(3);
  
  if (d.length >= 8) {
    return 'TN_' + d.slice(-8);
  }
  return 'RAW_' + digits;
}

async function runAudit() {
  console.log("=== AUDIT COMPLET DE LA BASE DE DONNEES (DATA INTEGRITY & SCRAPPING) ===");
  console.log("Connexion à MongoDB...");
  
  await mongoose.connect(MONGODB_URI, {
    family: 4,
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 45000,
  });
  console.log("Connecté avec succès à MongoDB.\n");

  const Lead = mongoose.models.Lead || mongoose.model('Lead', new mongoose.Schema({}, { strict: false }));

  const allLeads = await Lead.find({}).lean();
  console.log(`Total des documents Leads bruts en base : ${allLeads.length}`);

  const eliosLeads = allLeads.filter(l => l.crmType === 'elios');
  const formaticLeads = allLeads.filter(l => l.crmType === 'formatic');
  const unknownCrm = allLeads.filter(l => l.crmType !== 'elios' && l.crmType !== 'formatic');

  console.log(`- Leads Elios : ${eliosLeads.length}`);
  console.log(`- Leads Formatic : ${formaticLeads.length}`);
  if (unknownCrm.length > 0) {
    console.log(`- Leads avec crmType inconnu : ${unknownCrm.length}`);
  }

  // Regroupement par clé de téléphone canonique
  const groups = new Map();

  for (const lead of allLeads) {
    const key = getCanonicalPhoneKey(lead.phone);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(lead);
  }

  console.log(`\nNombre total de clés téléphoniques distinctes : ${groups.size}`);

  let uniqueEliosOnly = 0;
  let uniqueFormaticOnly = 0;
  let intraEliosDuplicates = 0;
  let intraFormaticDuplicates = 0;
  let crossCrmDuplicates = 0;

  const duplicateGroups = [];

  for (const [key, leads] of groups.entries()) {
    if (key === 'EMPTY' || key === 'NO_DIGITS') {
      console.warn(`Attention : ${leads.length} prospect(s) sans numéro valide.`);
      continue;
    }

    const inElios = leads.filter(l => l.crmType === 'elios');
    const inFormatic = leads.filter(l => l.crmType === 'formatic');

    if (leads.length === 1) {
      if (inElios.length === 1) uniqueEliosOnly++;
      else if (inFormatic.length === 1) uniqueFormaticOnly++;
    } else {
      // Plusieurs leads pour ce même numéro !
      const isCross = inElios.length > 0 && inFormatic.length > 0;
      const isIntraElios = inElios.length > 1 && inFormatic.length === 0;
      const isIntraFormatic = inFormatic.length > 1 && inElios.length === 0;

      if (isCross) crossCrmDuplicates++;
      else if (isIntraElios) intraEliosDuplicates++;
      else if (isIntraFormatic) intraFormaticDuplicates++;

      duplicateGroups.push({
        phoneKey: key,
        totalLeads: leads.length,
        eliosCount: inElios.length,
        formaticCount: inFormatic.length,
        isCross,
        isIntraElios,
        isIntraFormatic,
        leads
      });
    }
  }

  console.log("\n--- RESULTATS DE L'AUDIT ---");
  console.log(`1. Leads uniques sains Elios : ${uniqueEliosOnly}`);
  console.log(`2. Leads uniques sains Formatic : ${uniqueFormaticOnly}`);
  console.log(`3. Groupes de doublons INTRA-Elios (plusieurs fiches dans Elios seul) : ${intraEliosDuplicates}`);
  console.log(`4. Groupes de doublons INTRA-Formatic (plusieurs fiches dans Formatic seul) : ${intraFormaticDuplicates}`);
  console.log(`5. Groupes de doublons CROSS-CRM (présent à la fois dans Elios ET Formatic) : ${crossCrmDuplicates}`);
  console.log(`TOTAL groupes avec doublons à assainir : ${duplicateGroups.length}`);

  let totalDocsToDelete = 0;
  let totalNotesInDuplicates = 0;

  duplicateGroups.forEach(g => {
    totalDocsToDelete += (g.totalLeads - 1);
    g.leads.forEach(l => {
      if (Array.isArray(l.notes)) totalNotesInDuplicates += l.notes.length;
    });
  });

  console.log(`\nImpact de la fusion & assainissement :`);
  console.log(`- Documents redondants à éliminer : ${totalDocsToDelete}`);
  console.log(`- Volume total de notes à analyser et réconcilier : ${totalNotesInDuplicates}`);

  // Échantillon de doublons pour analyse
  console.log(`\n--- ECHANTILLON DE DOUBLONS CROISES (TOP 5) ---`);
  const crossSamples = duplicateGroups.filter(g => g.isCross).slice(0, 5);
  for (const s of crossSamples) {
    console.log(`\nTéléphone : ${s.phoneKey} (Elios: ${s.eliosCount}, Formatic: ${s.formaticCount})`);
    s.leads.forEach(l => {
      console.log(`  - [${l.crmType.toUpperCase()}] ID: ${l.id} | Nom: "${l.name}" | Statut: ${l.status} | Notes: ${(l.notes || []).length} | Date: ${l.date || l.createdAt}`);
    });
  }

  console.log(`\n--- ECHANTILLON DE DOUBLONS INTRA-ELIOS (TOP 5) ---`);
  const intraEliosSamples = duplicateGroups.filter(g => g.isIntraElios).slice(0, 5);
  for (const s of intraEliosSamples) {
    console.log(`\nTéléphone : ${s.phoneKey} (Elios: ${s.eliosCount})`);
    s.leads.forEach(l => {
      console.log(`  - [ELIOS] ID: ${l.id} | Nom: "${l.name}" | Statut: ${l.status} | Notes: ${(l.notes || []).length} | Date: ${l.date || l.createdAt}`);
    });
  }

  await mongoose.disconnect();
  console.log("\nAudit terminé avec succès.");
}

runAudit().catch(err => {
  console.error("Erreur durant l'audit:", err);
  process.exit(1);
});

