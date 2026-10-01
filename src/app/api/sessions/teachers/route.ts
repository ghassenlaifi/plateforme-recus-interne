import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Teacher from '@/models/Teacher';
import Session from '@/models/Session';
import { normalizePhone, validatePhone } from '@/lib/sessionHelpers';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const subject = (searchParams.get('subject') || '').trim();

    const query: any = { active: true };
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { subject: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }
    if (subject) {
      query.subject = subject;
    }

    const teachers = await Teacher.find(query).sort({ name: 1 }).lean();
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const currentTime = now.slice(11, 16);

    // Récupérer toutes les séances pour enrichir les fiches enseignants
    const allSessions = await Session.find({}).lean();

    const enriched = teachers.map((t: any) => {
      const teacherSessions = allSessions.filter(
        (s: any) => (s.teacherName || '').toLowerCase() === t.name.toLowerCase()
      );
      const sessionCount = teacherSessions.length;
      const missingDocsCount = teacherSessions.filter((s: any) => !s.pdf || !s.rec).length;

      // Prochaine séance à venir
      const upcoming = teacherSessions
        .filter((s: any) => !s.done && (s.startDate > today || (s.startDate === today && s.startTime >= currentTime)))
        .sort((a: any, b: any) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`));

      return {
        ...t,
        sessionCount,
        missingDocsCount,
        nextSession: upcoming[0] || null,
      };
    });

    return NextResponse.json(enriched, { status: 200 });
  } catch (error: any) {
    console.error('Error in GET /api/sessions/teachers:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const name = (body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Le nom est obligatoire' }, { status: 400 });
    }

    const existing = await Teacher.findOne({ name });
    if (existing) {
      return NextResponse.json({ error: 'Cet enseignant existe déjà' }, { status: 409 });
    }

    if (body.phone && body.phone.trim()) {
      const check = validatePhone(body.phone);
      if (!check.isValid) {
        return NextResponse.json({ error: check.error || 'Numéro de téléphone invalide' }, { status: 400 });
      }
    }

    const phone = normalizePhone(body.phone);

    const teacher = await Teacher.create({
      name,
      phone,
      email: (body.email || '').trim().toLowerCase(),
      subject: (body.subject || '').trim(),
      active: true,
      notes: body.notes || '',
    });

    return NextResponse.json(teacher, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/sessions/teachers:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
