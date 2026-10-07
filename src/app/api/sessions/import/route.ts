import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Session from '@/models/Session';
import Teacher from '@/models/Teacher';
import * as xlsx from 'xlsx';
import { 
  mapGradeToLevel, 
  mapSpecialityToSection, 
  mapSubjectToStandard, 
  normalizePhone,
  extractSessionTargets,
} from '@/lib/sessionHelpers';
import { formatPhone } from '@/lib/phoneUtils';

/**
 * Normalise rigoureusement une date Excel ou textuelle au format strict YYYY-MM-DD
 */
function parseExcelDate(raw: any): string {
  if (!raw) return '';

  // Cas 1 : Nombre de série Excel (ex: 45678)
  if (typeof raw === 'number' || (!isNaN(Number(raw)) && !String(raw).includes('-') && !String(raw).includes('/'))) {
    const num = Number(raw);
    if (num > 20000 && num < 60000) {
      // Époque Excel : 1899-12-30 UTC
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
  }

  const str = String(raw).trim();

  // Cas 2 : Format JJ/MM/AAAA ou JJ-MM-AAAA
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Cas 3 : Format AAAA-MM-JJ ou AAAA/MM/JJ
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Cas 4 : Objet Date ou format ISO
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
}

/**
 * Normalise une heure Excel ou textuelle au format strict HH:mm
 */
function parseExcelTime(raw: any): string {
  if (!raw && raw !== 0) return '';

  // Cas 1 : Fraction d'un jour sous Excel (ex: 0.75 pour 18:00)
  if (typeof raw === 'number' && raw >= 0 && raw < 1) {
    const totalMinutes = Math.round(raw * 24 * 60);
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const m = String(totalMinutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  const str = String(raw).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  }

  return str;
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer', raw: true });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return NextResponse.json({ error: 'Le fichier ne contient aucune feuille de calcul' }, { status: 400 });
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = xlsx.utils.sheet_to_json(firstSheet, { raw: true });

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Le fichier est vide' }, { status: 400 });
    }

    let importedSessionsCount = 0;
    let updatedSessionsCount = 0;
    let importedTeachersCount = 0;

    for (const row of rows) {
      const sessionId = String(row['Session ID'] || row['sessionId'] || row['ID'] || '').trim();
      const title = String(row['Title'] || row['title'] || 'Séance').trim();
      const rawGrade = String(row['Grade'] || row['grade'] || '').trim();
      const rawSpec = String(row['Speciality'] || row['speciality'] || row['Specialty'] || '').trim();
      const rawSubject = String(row['Subject(s)'] || row['subject'] || row['Matière'] || '').trim();
      const teacherName = String(row['Teacher'] || row['teacher'] || row['Enseignant'] || '').trim();
      const teacherEmail = String(row['Teacher email'] || row['email'] || '').trim().toLowerCase();
      const teacherExternalId = String(row['Teacher ID'] || '').trim();

      const startDateRaw = row['Start date'] || row['Date'] || '';
      const startTimeRaw = row['Start time'] || row['Heure'] || '';
      const endDateRaw = row['End date'] || startDateRaw;
      const endTimeRaw = row['End time'] || '';

      const startDate = parseExcelDate(startDateRaw);
      const startTime = parseExcelTime(startTimeRaw);
      const endDate = parseExcelDate(endDateRaw) || startDate;
      const endTime = parseExcelTime(endTimeRaw);

      // Si pas de date ou pas d'heure valide, ignorer la ligne invalide pour préserver la qualité des données
      if (!startDate) {
        continue;
      }

      const room = String(row['Room'] || '').trim();
      const group = String(row['Group'] || 'Normal Time').trim();
      const groupId = String(row['Group ID'] || '').trim();
      const zoomMeetingId = String(row['Zoom meeting ID'] || row['meetingId'] || '').trim();
      const zoomJoinUrl = String(row['Zoom join URL'] || row['joinUrl'] || '').trim();
      const zoomHost = String(row['Zoom host'] || '').trim();
      const duration = Number(row['Duration (minutes)']) || 90;
      const rawSubjectId = String(row['Primary subject ID'] || '').trim();

      // ------------------------------------------------------------------------
      // 1. GESTION / SYNCHRONISATION ENSEIGNANT
      // ------------------------------------------------------------------------
      const rawTeacherPhone = String(row['Teacher phone'] || row['Teacher Phone'] || row['phone'] || row['Phone'] || row['Telephone'] || row['Téléphone'] || '').trim();
      const normalizedTeacherPhone = formatPhone(rawTeacherPhone);

      let teacherPhone = '';
      if (teacherName) {
        let teacherDoc = await Teacher.findOne({
          $or: [
            { name: teacherName },
            ...(teacherEmail ? [{ email: teacherEmail }] : []),
          ],
        });

        if (!teacherDoc) {
          teacherDoc = await Teacher.create({
            name: teacherName,
            phone: normalizedTeacherPhone,
            email: teacherEmail,
            externalId: teacherExternalId,
            subject: mapSubjectToStandard(rawSubject, title),
            active: true,
          });
          importedTeachersCount++;
        } else {
          // Mise à jour de l'email, téléphone ou sujet s'il manquait
          let modified = false;
          if (normalizedTeacherPhone && (!teacherDoc.phone || teacherDoc.phone !== normalizedTeacherPhone)) {
            teacherDoc.phone = normalizedTeacherPhone;
            modified = true;
          }
          if (teacherEmail && !teacherDoc.email) {
            teacherDoc.email = teacherEmail;
            modified = true;
          }
          if (teacherExternalId && !teacherDoc.externalId) {
            teacherDoc.externalId = teacherExternalId;
            modified = true;
          }
          const stdSub = mapSubjectToStandard(rawSubject, title);
          if (stdSub && !teacherDoc.subject) {
            teacherDoc.subject = stdSub;
            modified = true;
          }
          if (modified) await teacherDoc.save();
        }

        teacherPhone = formatPhone(teacherDoc.phone || normalizedTeacherPhone);
      }

      // ------------------------------------------------------------------------
      // 2. GESTION DES SÉANCES MULTI-NIVEAUX / SECTIONS (UNE CARTE PAR NIVEAU & SECTION)
      // ------------------------------------------------------------------------
      // Règle d'or : Si une séance est destinée à plusieurs niveaux ou sections (ex: "Math (2eme / Info), Math (2eme / Science)"),
      // on extrait chaque cible pour créer véritablement des cartes distinctes, chacune avec son Niveau et sa Section.
      const targets = extractSessionTargets(title, rawGrade, rawSpec, rawSubject, room);

      for (let tIdx = 0; tIdx < targets.length; tIdx++) {
        const target = targets[tIdx];
        const subject = target.subject;
        const level = target.level;
        const section = target.section;
        const targetRoom = target.room || room;

        // Si la séance combine plusieurs niveaux/sections, isoler les identifiants
        const targetSessionId = (targets.length > 1 && sessionId)
          ? `${sessionId}-${tIdx + 1}`
          : sessionId;

        let existingSession = null;

        if (targetSessionId) {
          // Recherche prioritaire par ID de séance ET Date
          existingSession = await Session.findOne({ sessionId: targetSessionId, startDate });
        }

        // Si l'ancienne séance existait sans suffixe lors d'une importation préalable
        if (!existingSession && tIdx === 0 && sessionId) {
          existingSession = await Session.findOne({ sessionId, startDate });
        }

        if (!existingSession && startTime && teacherName) {
          // Recherche secondaire par signature pédagogique et horaire sur la même date, même niveau et section
          existingSession = await Session.findOne({
            startDate,
            startTime,
            teacherName,
            subject,
            level,
            section,
          });
        }

        if (existingSession) {
          // MISE À JOUR DE LA MÊME SÉANCE DU MÊME JOUR POUR CE NIVEAU ET CETTE SECTION
          existingSession.sessionId = targetSessionId || existingSession.sessionId;
          existingSession.title = title;
          existingSession.subject = subject;
          existingSession.level = level;
          existingSession.section = section;
          if (targetRoom) existingSession.room = targetRoom;
          if (group) existingSession.group = group;
          if (groupId) existingSession.groupId = groupId;
          existingSession.teacherName = teacherName;
          if (teacherEmail) existingSession.teacherEmail = teacherEmail;
          if (teacherPhone && !existingSession.teacherPhone) {
            existingSession.teacherPhone = teacherPhone;
          }
          existingSession.startDate = startDate;
          existingSession.startTime = startTime;
          existingSession.endDate = endDate;
          if (endTime) existingSession.endTime = endTime;
          existingSession.durationMinutes = duration;
          if (zoomMeetingId) existingSession.zoomMeetingId = zoomMeetingId;
          if (zoomJoinUrl) existingSession.zoomJoinUrl = zoomJoinUrl;
          if (zoomHost) existingSession.zoomHost = zoomHost;
          if (rawGrade) existingSession.rawGrade = rawGrade;
          if (rawSpec) existingSession.rawSpec = rawSpec;
          if (rawSubject) existingSession.rawSubject = rawSubject;
          if (rawSubjectId) existingSession.rawSubjectId = rawSubjectId;

          // RÈGLE CRITIQUE D'INTÉGRITÉ OPÉRATIONNELLE :
          // On préserve STRICTEMENT les états validés par les opérateurs (done, pdf, rec, remTeacher, remGroup, notes)
          await existingSession.save();
          updatedSessionsCount++;
        } else {
          // CRÉATION DE LA NOUVELLE CARTE DE SÉANCE POUR CE NIVEAU ET CETTE SECTION
          await Session.create({
            sessionId: targetSessionId,
            title,
            subject,
            level,
            section,
            room: targetRoom,
            group,
            groupId,
            teacherName,
            teacherEmail,
            teacherPhone,
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
            rawSubjectId,
            state: 'scheduled',
            remTeacher: false,
            remGroup: false,
            done: false,
            pdf: false,
            rec: false,
            notes: '',
          });
          importedSessionsCount++;
        }
      }
    }

    const message = `${importedSessionsCount} nouvelle(s) séance(s) planifiée(s), ${updatedSessionsCount} séance(s) synchronisée(s), et ${importedTeachersCount} nouvel(s) enseignant(s) ajouté(s). Les séances passées et la traçabilité du calendrier restent 100% préservées.`;

    return NextResponse.json({
      success: true,
      message,
      importedSessionsCount,
      updatedSessionsCount,
      importedTeachersCount,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error in POST /api/sessions/import:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de l\'import du fichier' }, { status: 500 });
  }
}

