import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Teacher from '@/models/Teacher';
import Session from '@/models/Session';
import { normalizePhone, validatePhone } from '@/lib/sessionHelpers';
import { formatPhone } from '@/lib/phoneUtils';

type Params = { id: string };

export async function PATCH(req: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id } = await Promise.resolve(params);
    const body = await req.json();

    await connectToDatabase();

    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return NextResponse.json({ error: 'Enseignant non trouvé' }, { status: 404 });
    }

    const oldName = teacher.name;
    const updateFields: any = {};

    if (body.name !== undefined && body.name.trim()) {
      updateFields.name = body.name.trim();
    }
    if (body.phone !== undefined) {
      if (body.phone && body.phone.trim()) {
        const check = validatePhone(body.phone);
        if (!check.isValid) {
          return NextResponse.json({ error: check.error || 'Numéro de téléphone invalide' }, { status: 400 });
        }
      }
      updateFields.phone = formatPhone(body.phone);
    }
    if (body.email !== undefined) {
      updateFields.email = body.email.trim().toLowerCase();
    }
    if (body.subject !== undefined) {
      updateFields.subject = body.subject.trim();
    }
    if (body.notes !== undefined) {
      updateFields.notes = body.notes;
    }

    const updated = await Teacher.findByIdAndUpdate(id, { $set: updateFields }, { new: true });

    // Si le nom a changé, mettre à jour les séances associées
    if (updateFields.name && updateFields.name !== oldName) {
      await Session.updateMany(
        { teacherName: oldName },
        { $set: { teacherName: updateFields.name } }
      );
    }

    // Si le téléphone a changé, mettre à jour les séances associées
    if (updateFields.phone !== undefined) {
      await Session.updateMany(
        { teacherName: updated?.name },
        { $set: { teacherPhone: updateFields.phone } }
      );
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error('Error in PATCH /api/sessions/teachers/[id]:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id } = await Promise.resolve(params);
    await connectToDatabase();

    const deleted = await Teacher.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Enseignant non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Enseignant supprimé avec succès', id }, { status: 200 });
  } catch (error: any) {
    console.error('Error in DELETE /api/sessions/teachers/[id]:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
