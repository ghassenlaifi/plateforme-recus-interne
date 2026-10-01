import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Task } from '@/models/Task';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const rawTasks = await Task.find().sort({ createdAt: -1 }).lean();

    // Normalisation pour rétro-compatibilité
    const tasks = (rawTasks || []).map((t: any) => {
      let assignedTo: string[] = [];
      if (Array.isArray(t.assignedTo)) {
        assignedTo = t.assignedTo.filter(Boolean).map((s: any) => String(s).trim());
      } else if (typeof t.assignedTo === 'string' && t.assignedTo.trim()) {
        assignedTo = t.assignedTo.includes(',') 
          ? t.assignedTo.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [t.assignedTo.trim()];
      }
      if (assignedTo.length === 0) {
        assignedTo = ['Ghassen'];
      }

      return {
        ...t,
        assignedTo,
        notes: Array.isArray(t.notes) ? t.notes : [],
      };
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: 'Le titre est obligatoire' }, { status: 400 });
    }

    let assignedTo: string[] = [];
    if (Array.isArray(body.assignedTo)) {
      assignedTo = body.assignedTo.map((s: any) => String(s).trim()).filter(Boolean);
    } else if (typeof body.assignedTo === 'string' && body.assignedTo.trim()) {
      assignedTo = body.assignedTo.includes(',')
        ? body.assignedTo.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [body.assignedTo.trim()];
    }
    if (assignedTo.length === 0) {
      assignedTo = ['Ghassen'];
    }

    const task = await Task.create({
      title: body.title.trim(),
      assignedTo,
      category: body.category || 'Commercial',
      priority: body.priority || 'Haute',
      dueDate: body.dueDate || 'Cette semaine',
      completed: !!body.completed,
      notes: Array.isArray(body.notes) ? body.notes : [],
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la création' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectToDatabase();
    const result = await Task.deleteMany({});
    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error: any) {
    console.error('Error clearing tasks:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}


