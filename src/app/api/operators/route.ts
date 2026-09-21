import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Operator from '@/models/Operator';

export async function GET() {
  try {
    await connectToDatabase();
    const operators = await Operator.find().sort({ createdAt: -1 });
    return NextResponse.json(operators, { status: 200 });
  } catch (error: any) {
    console.error('Error in GET /api/operators:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, theme } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 });
    }

    if (!theme) {
      return NextResponse.json({ error: 'Le thème est requis' }, { status: 400 });
    }

    await connectToDatabase();

    // Check if operator already exists (case insensitive)
    const existing = await Operator.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) {
      return NextResponse.json({ error: 'Cet opérateur existe déjà' }, { status: 409 });
    }

    const newOperator = await Operator.create({
      name: name.trim(),
      theme,
    });

    return NextResponse.json(newOperator, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/operators:', error);
    if (error.code === 11000) {
      return NextResponse.json({ error: 'Cet opérateur existe déjà' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

