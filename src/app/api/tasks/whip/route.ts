import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { WhipEvent } from '@/models/WhipEvent';
import { Task } from '@/models/Task';

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const { taskId, triggeredBy } = body;
    let { taskTitle, message, targetOperators } = body;

    if (!taskId) {
      return NextResponse.json({ error: 'Identifiant de tâche requis' }, { status: 400 });
    }

    const cleanTriggeredBy = (triggeredBy || 'Opérateur').trim();

    // Récupérer la tâche pour fiabiliser le titre et les collaborateurs assignés
    let resolvedTask: any = null;
    try {
      resolvedTask = await Task.findById(taskId).lean();
    } catch {}

    if (resolvedTask) {
      if (!taskTitle) {
        taskTitle = resolvedTask.title;
      }
      if (!targetOperators || !Array.isArray(targetOperators) || targetOperators.length === 0) {
        const rawAssigned: string[] = Array.isArray(resolvedTask.assignedTo) 
          ? resolvedTask.assignedTo 
          : [String(resolvedTask.assignedTo || 'Ghassen')];
        
        // Cibler les autres collaborateurs de la tâche
        const others = rawAssigned
          .map(s => String(s).trim())
          .filter(s => s && s.toLowerCase() !== cleanTriggeredBy.toLowerCase());

        // Si le déclencheur est le seul assigné, la cible reste lui-même pour tester
        targetOperators = others.length > 0 ? others : rawAssigned;
      }
    }

    const cleanTaskTitle = (taskTitle || 'Tâche d’équipe').trim();
    const cleanMessage = (message && String(message).trim()) 
      ? String(message).trim().slice(0, 200) 
      : '';

    const cleanTargets = Array.isArray(targetOperators) && targetOperators.length > 0
      ? targetOperators.map(t => String(t).trim()).filter(Boolean)
      : ['ALL'];

    const whipDoc = await WhipEvent.create({
      taskId: String(taskId),
      taskTitle: cleanTaskTitle,
      triggeredBy: cleanTriggeredBy,
      targetOperators: cleanTargets,
      message: cleanMessage,
      createdAt: new Date(),
    });

    return NextResponse.json({ 
      success: true, 
      event: whipDoc 
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating whip event:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors du déclenchement du fouet' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);

    const user = searchParams.get('user');
    const sinceParam = searchParams.get('since');

    // Fenêtre temporelle par défaut : les 25 dernières secondes
    let sinceDate = new Date(Date.now() - 25000);
    if (sinceParam) {
      const parsed = new Date(sinceParam);
      if (!isNaN(parsed.getTime())) {
        sinceDate = parsed;
      }
    }

    const filter: any = {
      createdAt: { $gte: sinceDate },
    };

    if (user && user.trim()) {
      const cleanUser = user.trim();
      const userRegex = new RegExp(`^${escapeRegex(cleanUser)}$`, 'i');

      filter.$and = [
        // Doit cibler cet opérateur OU tous
        {
          $or: [
            { targetOperators: userRegex },
            { targetOperators: { $in: ['ALL', 'all'] } },
            { targetOperators: cleanUser },
          ]
        },
        // Ne pas notifier celui qui l'a déclenché (il a déjà son animation locale)
        {
          triggeredBy: { $not: userRegex }
        }
      ];
    }

    const events = await WhipEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('Error fetching whip events:', error);
    return NextResponse.json({ error: error.message || 'Erreur de récupération' }, { status: 500 });
  }
}

