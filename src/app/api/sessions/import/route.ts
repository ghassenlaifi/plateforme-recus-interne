import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Session from '@/models/Session';
import Teacher from '@/models/Teacher';
import * as xlsx from 'xlsx';
import { 
  mapGradeToLevel, 
  mapSpecialityToSection, 
  mapSubjectToStandard, 
  normalizePhone 
} from '@/lib/sessionHelpers';

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
    let importedTeachersCount = 0;

    for (const row of rows) {
      const sessionId = row['Session ID'] || row['sessionId'] || row['ID'] || '';
      const title = row['Title'] || row['title'] || 'Séance';
      const rawGrade = row['Grade'] || row['grade'] || '';
      const rawSpec = row['Speciality'] || row['speciality'] || row['Specialty'] || '';
      const rawSubject = row['Subject(s)'] || row['subject'] || row['Matière'] || '';
      const teacherName = (row['Teacher'] || row['teacher'] || row['Enseignant'] || '').trim();
      const teacherEmail = (row['Teacher email'] || row['email'] || '').trim().toLowerCase();
      const teacherExternalId = row['Teacher ID'] || '';
      const startDate = String(row['Start date'] || row['Date'] || '').trim();
      const startTime = String(row['Start time'] || row['Heure'] || '').trim();
      const endDate = String(row['End date'] || startDate).trim();
      const endTime = String(row['End time'] || '').trim();
      const room = row['Room'] || '';
      const group = row['Group'] || 'Normal Time';
      const groupId = row['Group ID'] || '';
      const zoomMeetingId = String(row['Zoom meeting ID'] || row['meetingId'] || '');
      const zoomJoinUrl = row['Zoom join URL'] || row['joinUrl'] || '';
      const zoomHost = row['Zoom host'] || '';
      const duration = Number(row['Duration (minutes)']) || 90;

      const rawSubjectId = row['Primary subject ID'] || '';

      // Déduire la matière propre et normalisée
      const subject = mapSubjectToStandard(rawSubject, title);
      const level = mapGradeToLevel(rawGrade);
      const section = mapSpecialityToSection(rawSpec);

      // Gestion / synchronisation enseignant
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
            email: teacherEmail,
            externalId: teacherExternalId,
            subject,
            active: true,
          });
          importedTeachersCount++;
        } else {
          // Mise à jour de l'email ou sujet s'il manquait
          let modified = false;
          if (teacherEmail && !teacherDoc.email) {
            teacherDoc.email = teacherEmail;
            modified = true;
          }
          if (teacherExternalId && !teacherDoc.externalId) {
            teacherDoc.externalId = teacherExternalId;
            modified = true;
          }
          if (subject && !teacherDoc.subject) {
            teacherDoc.subject = subject;
            modified = true;
          }
          if (modified) await teacherDoc.save();
        }

        teacherPhone = teacherDoc.phone || '';
      }

      // Upsert de la séance
      const sessionQuery = sessionId
        ? { sessionId }
        : { title, startDate, startTime, teacherName };

      const existingSession = await Session.findOne(sessionQuery);

      if (existingSession) {
        existingSession.title = title;
        existingSession.subject = subject;
        existingSession.level = level;
        existingSession.section = section;
        existingSession.room = room;
        existingSession.group = group;
        existingSession.groupId = groupId;
        existingSession.teacherName = teacherName;
        existingSession.teacherEmail = teacherEmail;
        if (teacherPhone && !existingSession.teacherPhone) {
          existingSession.teacherPhone = teacherPhone;
        }
        existingSession.startDate = startDate;
        existingSession.startTime = startTime;
        existingSession.endDate = endDate;
        existingSession.endTime = endTime;
        existingSession.durationMinutes = duration;
        existingSession.zoomMeetingId = zoomMeetingId;
        existingSession.zoomJoinUrl = zoomJoinUrl;
        existingSession.zoomHost = zoomHost;
        existingSession.rawGrade = rawGrade;
        existingSession.rawSpec = rawSpec;
        existingSession.rawSubject = rawSubject;
        existingSession.rawSubjectId = rawSubjectId;

        await existingSession.save();
        importedSessionsCount++;
      } else {
        await Session.create({
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
        });
        importedSessionsCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `${importedSessionsCount} séance(s) et ${importedTeachersCount} nouvel(s) enseignant(s) importés avec succès.`,
      importedSessionsCount,
      importedTeachersCount,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error in POST /api/sessions/import:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de l\'import du fichier' }, { status: 500 });
  }
}
