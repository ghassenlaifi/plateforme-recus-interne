import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Session from '@/models/Session';
import Teacher from '@/models/Teacher';
import { normalizePhone, validatePhone } from '@/lib/sessionHelpers';
import { formatPhone } from '@/lib/phoneUtils';

type Params = { id: string };

export async function PATCH(req: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id } = await Promise.resolve(params);
    const body = await req.json();

    await connectToDatabase();

    const updateFields: any = {};

    if (body.title !== undefined) updateFields.title = body.title.trim();
    if (body.subject !== undefined) updateFields.subject = body.subject.trim();
    if (body.level !== undefined) updateFields.level = body.level.trim();
    if (body.section !== undefined) updateFields.section = body.section.trim();
    if (body.room !== undefined) updateFields.room = body.room.trim();
    if (body.teacherName !== undefined) updateFields.teacherName = body.teacherName.trim();
    if (body.teacherPhone !== undefined) {
      if (body.teacherPhone && body.teacherPhone.trim()) {
        const check = validatePhone(body.teacherPhone);
        if (!check.isValid) {
          return NextResponse.json({ error: check.error || 'Numéro de téléphone invalide' }, { status: 400 });
        }
      }
      updateFields.teacherPhone = formatPhone(body.teacherPhone);
    }
    if (body.teacherEmail !== undefined) updateFields.teacherEmail = body.teacherEmail.trim();
    if (body.startDate !== undefined) updateFields.startDate = body.startDate;
    if (body.startTime !== undefined) updateFields.startTime = body.startTime;
    if (body.endDate !== undefined) updateFields.endDate = body.endDate;
    if (body.endTime !== undefined) updateFields.endTime = body.endTime;
    if (body.zoomMeetingId !== undefined) updateFields.zoomMeetingId = body.zoomMeetingId;
    if (body.zoomJoinUrl !== undefined) updateFields.zoomJoinUrl = body.zoomJoinUrl;
    if (body.zoomHost !== undefined) updateFields.zoomHost = body.zoomHost;
    if (body.notes !== undefined) updateFields.notes = body.notes;

    // Flags pédagogiques
    if (typeof body.remTeacher === 'boolean') updateFields.remTeacher = body.remTeacher;
    if (typeof body.remGroup === 'boolean') updateFields.remGroup = body.remGroup;
    if (typeof body.done === 'boolean') updateFields.done = body.done;
    if (typeof body.pdf === 'boolean') updateFields.pdf = body.pdf;
    if (typeof body.rec === 'boolean') updateFields.rec = body.rec;

    // Si le numéro de l'enseignant est mis à jour, synchroniser avec la table Teacher
    if (updateFields.teacherPhone && updateFields.teacherName) {
      await Teacher.findOneAndUpdate(
        { name: updateFields.teacherName },
        { $set: { phone: updateFields.teacherPhone } },
        { upsert: false }
      );
    }

    const updatedSession = await Session.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedSession) {
      return NextResponse.json({ error: 'Séance non trouvée' }, { status: 404 });
    }

    return NextResponse.json(updatedSession, { status: 200 });
  } catch (error: any) {
    console.error('Error in PATCH /api/sessions/[id]:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id } = await Promise.resolve(params);
    await connectToDatabase();

    const deleted = await Session.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Séance non trouvée' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Séance supprimée avec succès', id }, { status: 200 });
  } catch (error: any) {
    console.error('Error in DELETE /api/sessions/[id]:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
