import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Settings } from '@/models/Settings';

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const { action, pin, newPin, phrase } = body;

    // Seed default PIN if not exists
    let pinSetting = await Settings.findOne({ key: 'admin_pin' });
    if (!pinSetting) {
      pinSetting = await Settings.create({ key: 'admin_pin', value: '124578' });
    }

    if (action === 'verify') {
      if (pin === pinSetting.value) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false, error: 'Code PIN incorrect' }, { status: 401 });
    }

    if (action === 'change') {
      if (phrase !== 'Elios is the best Academy') {
        return NextResponse.json({ success: false, error: 'Phrase de sécurité incorrecte' }, { status: 403 });
      }
      if (!newPin || newPin.length !== 6) {
        return NextResponse.json({ success: false, error: 'Le code PIN doit contenir exactement 6 chiffres' }, { status: 400 });
      }
      
      pinSetting.value = newPin;
      await pinSetting.save();
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  } catch (error: any) {
    console.error('API PIN Error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
