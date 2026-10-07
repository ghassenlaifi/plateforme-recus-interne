const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const files = [
  'C:\\Users\\ghass\\OneDrive\\Desktop\\ReceiptHub\\EliosCRM.xlsx',
  'C:\\Users\\ghass\\OneDrive\\Desktop\\ReceiptHub\\FormaticCRM.xlsx'
];

for (const filePath of files) {
  console.log(`\n======================================================`);
  console.log(`ANALYSE DU FICHIER : ${path.basename(filePath)}`);
  console.log(`======================================================`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`Fichier non trouvé : ${filePath}`);
    continue;
  }

  const wb = xlsx.readFile(filePath);
  console.log(`Feuilles détectées (${wb.SheetNames.length}):`, wb.SheetNames);
  
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
    console.log(`\n--- Feuille: "${sheetName}" | Nb lignes: ${data.length} ---`);
    if (data.length > 0) {
      console.log('Colonnes détectées:', Object.keys(data[0]));
      console.log('\nExemple 1ère ligne:', JSON.stringify(data[0], null, 2));
      if (data.length > 1) {
        console.log('Exemple 2ème ligne:', JSON.stringify(data[1], null, 2));
      }

      // Collect sample statistics
      const allGrades = new Set();
      const allSections = new Set();
      const allStatuses = new Set();
      const allOperators = new Set();
      const allSources = new Set();
      const samplePhones = [];
      const sampleDates = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        for (const k of Object.keys(row)) {
          const lk = k.toLowerCase();
          const val = String(row[k]).trim();
          if (!val) continue;

          if (lk.includes('classe') || lk.includes('grade') || lk.includes('niveau')) allGrades.add(val);
          if (lk.includes('section') || lk.includes('spec') || lk.includes('filiere')) allSections.add(val);
          if (lk.includes('statut') || lk.includes('status')) allStatuses.add(val);
          if (lk.includes('operateur') || lk.includes('operator') || lk.includes('staff') || lk.includes('agent')) allOperators.add(val);
          if (lk.includes('source') || lk.includes('origine')) allSources.add(val);
          if ((lk.includes('tel') || lk.includes('phone')) && samplePhones.length < 15) {
            samplePhones.push(val);
          }
          if ((lk.includes('date') || lk.includes('created') || lk.includes('time')) && sampleDates.length < 15) {
            sampleDates.push(val);
          }
        }
      }

      console.log(`\n[Niveaux/Grades détectés (${allGrades.size})]:`, Array.from(allGrades).sort());
      console.log(`[Sections détectées (${allSections.size})]:`, Array.from(allSections).sort());
      console.log(`[Statuts détectés (${allStatuses.size})]:`, Array.from(allStatuses).sort());
      console.log(`[Opérateurs détectés (${allOperators.size})]:`, Array.from(allOperators).sort());
      console.log(`[Sources détectées (${allSources.size})]:`, Array.from(allSources).sort());
      console.log(`[Échantillon Téléphones]:`, samplePhones);
      console.log(`[Échantillon Dates]:`, sampleDates);
    }
  }
}

