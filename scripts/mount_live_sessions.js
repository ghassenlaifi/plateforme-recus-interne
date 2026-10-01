const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ghassenlaifii_db_user:v5S91ZMkwGXEL1P4@receipthub-cluster.aqr9ofq.mongodb.net/?appName=ReceiptHub-Cluster';
const CSV_PATH = 'C:/Users/ghass/Downloads/live-sessions-2026-09-30.csv';

const KNOWN_TEACHERS = [
  { name: "Issam Abidi", phone: "21622987775", subject: "Gestion" },
  { name: "Ibtissem Kharrat", phone: "21621191695", subject: "Français", email: "ikharrat3@gmail.com" },
  { name: "Faten Weslati", phone: "", subject: "Français", email: "fatenwesleti36@gmail.com" },
  { name: "Mohamed  Ben fraj balazi", phone: "", subject: "Anglais", email: "mohamedbenfraj140@gmail.com" },
  { name: "rachida zedini", phone: "", subject: "Économie", email: "rachidazedini0@gmail.com" },
  { name: "Mohamed Ali Rabah", phone: "", subject: "Informatique", email: "rabahmohamedali84@gmail.com" },
  { name: "Samir Hammami", phone: "", subject: "Mécanique", email: "samir290969@gmail.com" },
  { name: "Atef Labidi", phone: "21652331446", subject: "Math", email: "laabidi.atifou@gmail.com" },
  { name: "Hela Selmi", phone: "", subject: "Math", email: "selmihala123@gmail.com" },
  { name: "Asma Prof Svt", phone: "21695144094", subject: "Sciences de la vie et de la terre" }
];

function mapGrade(grade) {
  if (!grade) return 'Baccalauréat';
  const g = String(grade).toLowerCase();
  if (g.includes('bac')) return 'Baccalauréat';
  if (g.includes('3')) return '3e secondaire';
  if (g.includes('2')) return '2e secondaire';
  if (g.includes('1')) return '1re secondaire';
  if (g.includes('9')) return '9e année';
  if (g.includes('8')) return '8e année';
  if (g.includes('7')) return '7e année';
  return grade;
}

function mapSpeciality(spec) {
  if (!spec) return 'Sans section';
  const s = String(spec).toLowerCase();
  if (s.includes('tech')) return 'Sciences techniques';
  if (s.includes('math')) return 'Mathématiques';
  if (s.includes('info')) return 'Informatique';
  if (s.includes('eco')) return 'Économie et gestion';
  if (s.includes('sci')) return 'Sciences expérimentales';
  if (s.includes('let')) return 'Lettres';
  if (s.includes('gen')) return 'Sans section';
  return spec;
}

async function run() {
  console.log('--- Montage du module Gestion des Séances ---');
  console.log('Connexion à MongoDB...');
  await mongoose.connect(MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 15000 });
  console.log('Connecté avec succès.');

  const Teacher = mongoose.model('Teacher', new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    subject: { type: String, default: '' },
    externalId: { type: String, default: '' },
    active: { type: Boolean, default: true },
    notes: { type: String, default: '' },
  }, { timestamps: true }));

  const Session = mongoose.model('Session', new mongoose.Schema({
    sessionId: { type: String, sparse: true, index: true },
    title: { type: String, required: true },
    subject: { type: String, required: true },
    level: { type: String, required: true },
    section: { type: String, default: 'Sans section' },
    room: { type: String, default: '' },
    group: { type: String, default: 'Normal Time' },
    groupId: { type: String, default: '' },
    teacherName: { type: String, required: true },
    teacherPhone: { type: String, default: '' },
    teacherEmail: { type: String, default: '' },
    teacherId: { type: String, default: '' },
    startDate: { type: String, required: true },
    startTime: { type: String, required: true },
    endDate: { type: String, default: '' },
    endTime: { type: String, default: '' },
    durationMinutes: { type: Number, default: 90 },
    timeZone: { type: String, default: 'Africa/Tunis' },
    zoomMeetingId: { type: String, default: '' },
    zoomJoinUrl: { type: String, default: '' },
    zoomHost: { type: String, default: '' },
    zoomProvisioningState: { type: String, default: 'ready' },
    state: { type: String, default: 'scheduled' },
    remTeacher: { type: Boolean, default: false },
    remGroup: { type: Boolean, default: false },
    done: { type: Boolean, default: false },
    pdf: { type: Boolean, default: false },
    rec: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    rawGrade: { type: String, default: '' },
    rawSpec: { type: String, default: '' },
    rawSubject: { type: String, default: '' },
    rawSubjectId: { type: String, default: '' },
  }, { timestamps: true }));

  // 1. Initialisation des enseignants connus
  console.log('\n1. Enregistrement des enseignants...');
  for (const t of KNOWN_TEACHERS) {
    const existing = await Teacher.findOne({
      $or: [
        { name: t.name },
        ...(t.email ? [{ email: t.email.toLowerCase() }] : []),
      ]
    });
    if (!existing) {
      await Teacher.create({
        name: t.name,
        phone: t.phone,
        email: t.email ? t.email.toLowerCase() : '',
        subject: t.subject,
        active: true,
      });
      console.log(`  + Enseignant créé : ${t.name} (${t.subject})`);
    } else {
      if (t.phone && !existing.phone) {
        existing.phone = t.phone;
        await existing.save();
        console.log(`  * Téléphone mis à jour pour : ${t.name} -> ${t.phone}`);
      }
    }
  }

  // 2. Lecture du fichier CSV
  console.log(`\n2. Lecture de ${CSV_PATH}...`);
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Fichier introuvable à : ${CSV_PATH}`);
    process.exit(1);
  }

  const workbook = xlsx.readFile(CSV_PATH, { raw: true });
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: true });
  console.log(`Nombre de lignes détectées : ${rows.length}`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const r of rows) {
    const sessionId = r['Session ID'];
    const title = r['Title'] || 'Séance';
    const rawGrade = r['Grade'];
    const rawSpec = r['Speciality'];
    const rawSubject = r['Subject(s)'] || '';
    const teacherName = (r['Teacher'] || '').trim();
    const teacherEmail = (r['Teacher email'] || '').trim().toLowerCase();
    const teacherExternalId = r['Teacher ID'] || '';
    const startDate = String(r['Start date'] || '').trim();
    const startTime = String(r['Start time'] || '').trim();
    const endDate = String(r['End date'] || startDate).trim();
    const endTime = String(r['End time'] || '').trim();
    const room = r['Room'] || '';
    const group = r['Group'] || 'Normal Time';
    const groupId = r['Group ID'] || '';
    const zoomMeetingId = String(r['Zoom meeting ID'] || '');
    const zoomJoinUrl = r['Zoom join URL'] || '';
    const zoomHost = r['Zoom host'] || '';
    const duration = Number(r['Duration (minutes)']) || 90;

    let subject = rawSubject;
    if (subject.includes('(')) subject = subject.split('(')[0].trim();
    if (!subject && title) subject = title.split(':')[0].trim();
    if (!subject) subject = 'Séance';

    const level = mapGrade(rawGrade);
    const section = mapSpeciality(rawSpec);

    // Trouver le téléphone de l'enseignant
    let teacherPhone = '';
    const teacherDoc = await Teacher.findOne({
      $or: [
        { name: teacherName },
        ...(teacherEmail ? [{ email: teacherEmail }] : []),
      ]
    });
    if (teacherDoc && teacherDoc.phone) {
      teacherPhone = teacherDoc.phone;
    }

    const sessionPayload = {
      sessionId,
      title,
      subject,
      level,
      section,
      room,
      group,
      groupId,
      teacherName,
      teacherEmail,
      teacherPhone,
      teacherId: teacherExternalId,
      startDate,
      startTime,
      endDate,
      endTime,
      durationMinutes: duration,
      zoomMeetingId,
      zoomJoinUrl,
      zoomHost,
      rawGrade,
      rawSpec,
      rawSubject,
      rawSubjectId: r['Primary subject ID'] || '',
      state: 'scheduled',
    };

    const existingSession = await Session.findOne({ sessionId });
    if (existingSession) {
      Object.assign(existingSession, sessionPayload);
      await existingSession.save();
      updatedCount++;
      console.log(`  [Mise à jour] ${startTime} - ${subject} (${level}) - Prof: ${teacherName}`);
    } else {
      await Session.create({
        ...sessionPayload,
        remTeacher: false,
        remGroup: false,
        done: false,
        pdf: false,
        rec: false,
      });
      createdCount++;
      console.log(`  [Création] ${startTime} - ${subject} (${level}) - Prof: ${teacherName}`);
    }
  }

  console.log(`\n=== Résumé du montage ===`);
  console.log(`Séances créées : ${createdCount}`);
  console.log(`Séances mises à jour : ${updatedCount}`);
  console.log(`Total séances en base : ${await Session.countDocuments()}`);
  console.log(`Total enseignants en base : ${await Teacher.countDocuments()}`);

  await mongoose.disconnect();
  console.log('\nDéconnexion réussie. Montage terminé avec succès !');
}

run().catch(err => {
  console.error('Erreur lors du montage :', err);
  process.exit(1);
});
