const xlsx = require('xlsx');

const eliosFile = 'C:/Users/ghass/OneDrive/Desktop/ReceiptHub/EliosCRM.xlsx';
const formaticFile = 'C:/Users/ghass/OneDrive/Desktop/ReceiptHub/FormaticCRM.xlsx';

function audit(name, filePath) {
  console.log(`\n================ AUDIT COMPLET : ${name} ================`);
  const wb = xlsx.readFile(filePath);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Prospects'], { defval: '', raw: false });
  console.log(`Nombre total de lignes : ${rows.length}`);

  const grades = {};
  const specialites = {};
  const statuts = {};
  const sources = {};
  const offres = {};
  const dateFormats = {};
  const phoneLengths = {};
  const authors = {};

  rows.forEach((r, idx) => {
    // Grade
    const g = String(r.Grade || '').trim();
    grades[g] = (grades[g] || 0) + 1;

    // Specialite
    const sp = String(r.Specialite || '').trim();
    specialites[sp] = (specialites[sp] || 0) + 1;

    // Statut
    const st = String(r.Statut || '').trim();
    statuts[st] = (statuts[st] || 0) + 1;

    // Source
    const src = String(r.Source || '').trim();
    sources[src] = (sources[src] || 0) + 1;

    // Offre
    const off = String(r.Offre || '').trim();
    offres[off] = (offres[off] || 0) + 1;

    // Tel
    const rawTel = String(r.Telephone || '').trim();
    const cleanTel = rawTel.replace(/\D/g, '');
    phoneLengths[cleanTel.length] = (phoneLengths[cleanTel.length] || 0) + 1;

    // Notes authors
    if (r.Notes) {
      try {
        const notes = JSON.parse(r.Notes);
        if (Array.isArray(notes)) {
          notes.forEach(n => {
            const author = n.authorName || n.by || n.addedBy || 'Inconnu';
            authors[author] = (authors[author] || 0) + 1;
          });
        }
      } catch (e) {}
    }
  });

  console.log('\n--- Niveaux / Grades bruts ---', grades);
  console.log('\n--- Spécialités / Sections brutes ---', specialites);
  console.log('\n--- Statuts bruts ---', statuts);
  console.log('\n--- Sources brutes ---', sources);
  console.log('\n--- Offres brutes ---', offres);
  console.log('\n--- Longueurs des numéros de téléphone (chiffres seuls) ---', phoneLengths);
  console.log('\n--- Auteurs des notes ---', authors);
}

audit('ELIOS', eliosFile);
audit('FORMATIC', formaticFile);

