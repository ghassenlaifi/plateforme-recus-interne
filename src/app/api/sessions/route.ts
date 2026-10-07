import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Session from '@/models/Session';
import Teacher from '@/models/Teacher';
import { normalizePhone, validatePhone } from '@/lib/sessionHelpers';
import { formatPhone } from '@/lib/phoneUtils';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get('q') || '').trim();
    const level = (searchParams.get('level') || '').trim();
    const section = (searchParams.get('section') || '').trim();
    const teacher = (searchParams.get('teacher') || '').trim();
    const filter = (searchParams.get('filter') || 'all').trim();
    const date = (searchParams.get('date') || '').trim(); // e.g. YYYY-MM-DD or YYYY-MM
    const today = new Date().toISOString().slice(0, 10);

    const query: any = {};

    if (q) {
      query.$or = [
        { subject: { $regex: q, $options: 'i' } },
        { title: { $regex: q, $options: 'i' } },
        { teacherName: { $regex: q, $options: 'i' } },
        { room: { $regex: q, $options: 'i' } },
      ];
    }

    if (level) query.level = level;
    if (section) query.section = section;
    if (teacher) query.teacherName = teacher;

    if (date) {
      if (date.length === 7) {
        query.startDate = { $regex: `^${date}` };
      } else {
        query.startDate = date;
      }
    }

    // Filtres spécialisés
    if (filter === 'act') {
      // Actions requises (manque PDF ou enregistrement)
      query.$or = [{ pdf: false }, { rec: false }];
    } else if (filter === 'pdf') {
      query.pdf = false;
    } else if (filter === 'rec') {
      query.rec = false;
    } else if (filter === 'day') {
      query.startDate = today;
    } else if (filter === 'nr') {
      query.remTeacher = false;
    } else if (filter === 'done') {
      query.done = true;
    }

    const sessions = await Session.find(query).sort({ startDate: 1, startTime: 1 }).lean();

    // Calcul des statistiques globales
    const allSessions = await Session.find({}).lean();
    const totalSessions = allSessions.length;
    const completedSessions = allSessions.filter((s: any) => s.done).length;
    const missingDocs = allSessions.filter((s: any) => !s.pdf || !s.rec).length;
    const todayReminders = allSessions.filter((s: any) => s.startDate === today && !s.remTeacher).length;

    // Calcul pour le mois courant
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthSessions = allSessions.filter((s: any) => s.startDate?.startsWith(currentMonth)).length;

    return NextResponse.json({
      sessions,
      stats: {
        totalSessions,
        completedSessions,
        missingDocs,
        todayReminders,
        monthSessions,
      },
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error in GET /api/sessions:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    if (!body.subject || !body.level || !body.startDate || !body.startTime) {
      return NextResponse.json(
        { error: 'Matière, niveau, date et heure sont obligatoires' },
        { status: 400 }
      );
    }

    if (body.teacherPhone && body.teacherPhone.trim()) {
      const check = validatePhone(body.teacherPhone);
      if (!check.isValid) {
        return NextResponse.json({ error: check.error || 'Numéro de téléphone enseignant invalide' }, { status: 400 });
      }
    }

    const teacherPhone = formatPhone(body.teacherPhone);

    // Si un enseignant est spécifié, on s'assure qu'il existe ou on met à jour son téléphone
    if (body.teacherName && body.teacherName.trim()) {
      const tName = body.teacherName.trim();
      const existingTeacher = await Teacher.findOne({ name: tName });
      if (existingTeacher) {
        if (!existingTeacher.phone && teacherPhone) {
          existingTeacher.phone = teacherPhone;
          await existingTeacher.save();
        }
      } else {
        await Teacher.create({
          name: tName,
          phone: teacherPhone,
          subject: body.subject,
          active: true,
        });
      }
    }

    const newSession = await Session.create({
      title: body.title || `${body.subject} : ${body.startTime} - ${body.startDate}`,
      subject: body.subject.trim(),
      level: body.level.trim(),
      section: body.section ? body.section.trim() : 'Sans section',
      room: body.room || `${body.level} / ${body.section || 'General'}`,
      group: body.group || 'Normal Time',
      teacherName: body.teacherName ? body.teacherName.trim() : 'Enseignant non renseigné',
      teacherPhone,
      teacherEmail: body.teacherEmail || '',
      startDate: body.startDate,
      startTime: body.startTime,
      endDate: body.endDate || body.startDate,
      endTime: body.endTime || '',
      durationMinutes: body.durationMinutes || 90,
      zoomMeetingId: body.zoomMeetingId || '',
      zoomJoinUrl: body.zoomJoinUrl || '',
      zoomHost: body.zoomHost || '',
      state: body.state || 'scheduled',
      remTeacher: !!body.remTeacher,
      remGroup: !!body.remGroup,
      done: !!body.done,
      pdf: !!body.pdf,
      rec: !!body.rec,
      notes: body.notes || '',
    });

    return NextResponse.json(newSession, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/sessions:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la création de la séance' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const ids = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Une liste d\'identifiants de séances valide est requise' },
        { status: 400 }
      );
    }

    const result = await Session.deleteMany({ _id: { $in: ids } });

    return NextResponse.json({
      success: true,
      message: `${result.deletedCount} séance(s) supprimée(s) avec succès.`,
      deletedCount: result.deletedCount,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error in DELETE /api/sessions:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression groupée des séances' },
      { status: 500 }
    );
  }
}
