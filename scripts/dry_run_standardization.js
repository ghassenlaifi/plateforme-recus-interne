const xlsx = require('xlsx');

const eliosFile = 'C:/Users/ghass/OneDrive/Desktop/ReceiptHub/EliosCRM.xlsx';
const formaticFile = 'C:/Users/ghass/OneDrive/Desktop/ReceiptHub/FormaticCRM.xlsx';

const GRADE_MAP = {
  'bac': 'BAC',
  'baccalaureat': 'BAC',
  'baccalauréat': 'BAC',
  'terminale': 'BAC',
  '3ème année': '3ème Année',
  '3eme': '3ème Année',
  '3e': '3ème Année',
  '3e secondaire': '3ème Année',
  '3eme annee': '3ème Année',
  '2ème année': '2ème Année',
  '2eme': '2ème Année',
  '2e': '2ème Année',
  '2e secondaire': '2ème Année',
  '2eme annee': '2ème Année',
  '1ère année': '1ère Année',
  '1ere': '1ère Année',
  '1er': '1ère Année',
  '1re': '1ère Année',
  '1re secondaire': '1ère Année',
  '1ere annee': '1ère Année',
  '9ème de base': '9ème de Base',
  '9eme': '9ème de Base',
  '9e': '9ème de Base',
  '9ème année': '9ème de Base',
  '9eme année': '9ème de Base',
  '9e année': '9ème de Base',
  '8ème de base': '8ème de Base',
  '8eme': '8ème de Base',
  '8e': '8ème de Base',
  '8ème année': '8ème de Base',
  '8eme année': '8ème de Base',
  '8e année': '8ème de Base',
  '7ème de base': '7ème de Base',
  '7eme': '7ème de Base',
  '7e': '7ème de Base',
  '7ème année': '7ème de Base',
  '7eme année': '7ème de Base',
  '7e année': '7ème de Base',
};

const SECTION_MAP = {
  'math': 'Mathématiques',
  'maths': 'Mathématiques',
  'mathématiques': 'Mathématiques',
  'mathematiques': 'Mathématiques',
  'science': 'Science',
  'sciences': 'Science',
  'sc': 'Science',
  'sciences expérimentales': 'Science',
  'sciences exp': 'Science',
  'éco': 'Économie',
  'eco': 'Économie',
  'économie': 'Économie',
  'economie': 'Économie',
  'gestion': 'Économie',
  'économie et gestion': 'Économie',
  'info': 'Informatique',
  'informatique': 'Informatique',
  'tech': 'Technique',
  'technique': 'Technique',
  'sciences techniques': 'Technique',
  'lettres': 'Lettres',
  'lettre': 'Lettres',
  'let': 'Lettres',
  'sport': 'Sport',
  'sports': 'Sport',
};

const STATUS_MAP = {
  'lead': 'Lead',
  'nouveau': 'Lead',
  'approved prospect': 'Approved Prospect',
  'approved': 'Approved',
  'converti': 'Approved',
  'potential prospect': 'Potential Prospect',
  'à rappeler': 'Potential Prospect',
  'a rappeler': 'Potential Prospect',
  'n/a': 'N/A',
  'na': 'N/A',
  'rejected': 'Rejected',
  'refusé': 'Rejected',
  'refuse': 'Rejected'
};

function parseFlexibleDate(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  
  if (typeof val === 'number') {
    if (val > 100000000000) return new Date(val); // ms timestamp
    if (val > 1000000000) return new Date(val * 1000); // sec timestamp
    if (val > 30000 && val < 60000) {
      const excelEpoch = new Date(1899, 11, 30);
      return new Date(excelEpoch.getTime() + val * 86400 * 1000);
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  if (/^\d{12,14}$/.test(str)) {
    const num = parseInt(str, 10);
    if (!isNaN(num)) return new Date(num);
  }

  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
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

  const cleaned = str.replace(/\(.*?\)/g, '').trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;

  return null;
}

function cleanSinglePhone(raw) {
  if (!raw) return '';
  let str = String(raw).replace(/[\u200E\u200F\u202A-\u202E]/g, '').trim();
  str = str.replace(/\(.*?\)/g, '').trim();

  if (str.startsWith('+')) {
    const digits = str.replace(/\D/g, '');
    if (digits.startsWith('216') && digits.length === 11) {
      return digits.slice(3);
    }
    return '+' + digits;
  }

  const digits = str.replace(/\D/g, '');
  if (digits.startsWith('00216') && digits.length === 13) {
    return digits.slice(5);
  }
  if (digits.startsWith('216') && digits.length === 11) {
    return digits.slice(3);
  }
  return digits;
}

function normalizeLeadPhone(rawTel) {
  if (!rawTel) return { primary: '', secondary: '' };
  let str = String(rawTel).replace(/[\u200E\u200F\u202A-\u202E]/g, '').trim();
  
  const parts = str.split(/[/|,;]+/).map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const p1 = cleanSinglePhone(parts[0]);
    const p2 = cleanSinglePhone(parts.slice(1).join(' / '));
    return { primary: p1, secondary: p2 };
  }

  const digits = str.replace(/\D/g, '');
  if (digits.length === 16 && !str.includes('+')) {
    const p1 = digits.slice(0, 8);
    const p2 = digits.slice(8);
    return { primary: p1, secondary: p2 };
  }

  return { primary: cleanSinglePhone(str), secondary: '' };
}

function isClassWithoutSection(grade) {
  if (!grade) return false;
  const g = grade.trim().toLowerCase();
  return (
    g.startsWith('7') ||
    g.startsWith('8') ||
    g.startsWith('9') ||
    g.startsWith('1')
  );
}

function normalizeGrade(rawGrade, rawNotes) {
  const g = String(rawGrade || '').trim().toLowerCase();
  if (GRADE_MAP[g]) return GRADE_MAP[g];

  // Try to recover from notes if empty
  if (!g && rawNotes) {
    const nLower = String(rawNotes).toLowerCase();
    if (nLower.includes('bac eco') || nLower.includes('bac math') || nLower.includes('bac sc') || nLower.includes('bac info') || nLower.includes('bac tech') || nLower.includes('bac lettre')) return 'BAC';
    if (nLower.includes('3eme') || nLower.includes('3ème')) return '3ème Année';
    if (nLower.includes('2eme') || nLower.includes('2ème')) return '2ème Année';
    if (nLower.includes('1ere') || nLower.includes('1ère')) return '1ère Année';
    if (nLower.includes('9eme') || nLower.includes('9ème')) return '9ème de Base';
    if (nLower.includes('8eme') || nLower.includes('8ème')) return '8ème de Base';
    if (nLower.includes('7eme') || nLower.includes('7ème')) return '7ème de Base';
  }

  return rawGrade ? String(rawGrade).trim() : '';
}

function normalizeSection(rawSection, grade, rawNotes) {
  if (isClassWithoutSection(grade)) return '';

  const s = String(rawSection || '').trim().toLowerCase();
  if (SECTION_MAP[s]) return SECTION_MAP[s];

  if (!s && rawNotes) {
    const nLower = String(rawNotes).toLowerCase();
    if (nLower.includes('eco') || nLower.includes('économie')) return 'Économie';
    if (nLower.includes('math')) return 'Mathématiques';
    if (nLower.includes('sc') || nLower.includes('science')) return 'Science';
    if (nLower.includes('info')) return 'Informatique';
    if (nLower.includes('tech')) return 'Technique';
    if (nLower.includes('lettre')) return 'Lettres';
  }

  return rawSection ? String(rawSection).trim() : '';
}

function normalizeStatus(rawStatus) {
  const st = String(rawStatus || '').trim().toLowerCase();
  return STATUS_MAP[st] || (rawStatus ? String(rawStatus).trim() : 'Lead');
}

function normalizeAuthor(rawAuthor) {
  if (!rawAuthor) return 'Système';
  const a = String(rawAuthor).trim();
  if (a.toLowerCase() === 'maryem') return 'Mariem';
  if (a.toLowerCase() === 'systeme' || a.toLowerCase() === 'système' || a.toLowerCase() === 'system') return 'Système';
  return a.charAt(0).toUpperCase() + a.slice(1);
}

function testPipeline(name, filePath, crmType) {
  console.log(`\n========================================================`);
  console.log(`TEST PIPELINE DE NORMALISATION : ${name} (${crmType})`);
  console.log(`========================================================`);

  const wb = xlsx.readFile(filePath);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Prospects'], { raw: true, defval: '' });
  console.log(`Total lignes brutes : ${rows.length}`);

  const gradeStats = {};
  const sectionStats = {};
  const statusStats = {};
  const operatorStats = {};
  let totalNotesCount = 0;
  let secondaryPhonesCount = 0;

  rows.forEach((r, idx) => {
    const grade = normalizeGrade(r.Grade, r.Notes);
    gradeStats[grade || '[VIDE]'] = (gradeStats[grade || '[VIDE]'] || 0) + 1;

    const section = normalizeSection(r.Specialite, grade, r.Notes);
    sectionStats[section || '[VIDE]'] = (sectionStats[section || '[VIDE]'] || 0) + 1;

    const status = normalizeStatus(r.Statut);
    statusStats[status] = (statusStats[status] || 0) + 1;

    const { primary, secondary } = normalizeLeadPhone(r.Telephone);
    if (secondary) secondaryPhonesCount++;

    // Parse notes and detect operator
    let lastAuthor = 'Système';
    let lastModDate = null;
    const cleanNotes = [];

    if (r.Notes) {
      try {
        const rawNotes = JSON.parse(r.Notes);
        if (Array.isArray(rawNotes)) {
          rawNotes.forEach((n, nIdx) => {
            const author = normalizeAuthor(n.authorName || n.by || n.addedBy);
            const nDate = n.createdAt ? new Date(n.createdAt) : (parseFlexibleDate(n.timestamp) || new Date());
            
            if (author !== 'Système') {
              lastAuthor = author;
              lastModDate = nDate;
            }

            if (n.text && n.text.trim()) {
              cleanNotes.push({
                id: n.id || `note-${r.ID}-${nIdx + 1}`,
                by: author,
                addedBy: author,
                date: nDate.toISOString(),
                addedAt: nDate,
                text: n.text.trim()
              });
              totalNotesCount++;
            }
          });
        }
      } catch (e) {}
    }

    operatorStats[lastAuthor] = (operatorStats[lastAuthor] || 0) + 1;
  });

  console.log('\n[Distribution des Niveaux normalisés]:', gradeStats);
  console.log('\n[Distribution des Sections normalisées]:', sectionStats);
  console.log('\n[Distribution des Statuts normalisés]:', statusStats);
  console.log('\n[Distribution des Opérateurs attribués]:', operatorStats);
  console.log(`\nTotal notes conservées : ${totalNotesCount}`);
  console.log(`Total numéros secondaires capturés : ${secondaryPhonesCount}`);
}

testPipeline('Elios CRM', eliosFile, 'elios');
testPipeline('Formatic CRM', formaticFile, 'formatic');

