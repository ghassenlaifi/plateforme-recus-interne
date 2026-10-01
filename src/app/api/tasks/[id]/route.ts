import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Task } from '@/models/Task';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await req.json();

    // 1. Ajout d'une nouvelle note d'avancement
    if (body.newNote && body.newNote.text?.trim()) {
      const updated = await Task.findByIdAndUpdate(
        id,
        {
          $push: {
            notes: {
              author: (body.newNote.author || 'Opérateur').trim(),
              text: body.newNote.text.trim(),
              createdAt: new Date(),
            },
          },
        },
        { new: true }
      );
      if (!updated) {
        return NextResponse.json({ error: 'Tâche non trouvée' }, { status: 404 });
      }
      return NextResponse.json({ task: updated });
    }

    // 2. Normalisation assignedTo si présent
    if (body.assignedTo !== undefined) {
      if (Array.isArray(body.assignedTo)) {
        body.assignedTo = body.assignedTo.map((s: any) => String(s).trim()).filter(Boolean);
      } else if (typeof body.assignedTo === 'string' && body.assignedTo.trim()) {
        body.assignedTo = body.assignedTo.includes(',')
          ? body.assignedTo.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [body.assignedTo.trim()];
      }
    }

    // 3. Gestion de la complétion et horodatage
    if (body.completed !== undefined) {
      if (body.completed) {
        body.completedAt = new Date();
      } else {
        body.completedAt = null;
        body.completedBy = null;
      }
    }

    const task = await Task.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!task) {
      return NextResponse.json({ error: 'Tâche non trouvée' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error: any) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: error.message || 'Erreur mise à jour' }, { status: 500 });
  }
}


export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const task = await Task.findByIdAndDelete(id);

    if (!task) {
      return NextResponse.json({ error: 'Tâche non trouvée' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Tâche supprimée' });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: error.message || 'Erreur suppression' }, { status: 500 });
  }
}
