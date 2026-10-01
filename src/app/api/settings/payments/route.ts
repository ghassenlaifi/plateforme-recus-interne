import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Settings } from '@/models/Settings';
import { PaymentMethod, DEFAULT_PAYMENT_METHODS } from '@/types/settings';
import { formatPaymentMethodsForWhatsApp } from '@/lib/whatsappHelper';

const SETTINGS_KEY = 'payment_methods';

export async function GET() {
  try {
    await connectToDatabase();
    const doc = await Settings.findOne({ key: SETTINGS_KEY }).lean();

    let methods: PaymentMethod[] = DEFAULT_PAYMENT_METHODS;
    if (doc && (doc as any).value) {
      try {
        const parsed = JSON.parse((doc as any).value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          methods = parsed;
        }
      } catch (e) {
        console.error('Error parsing payment methods from DB:', e);
      }
    }

    const whatsappPreview = formatPaymentMethodsForWhatsApp(methods);

    return NextResponse.json({
      methods,
      whatsappPreview,
    });
  } catch (error: any) {
    console.error('Error fetching payment settings:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    if (!Array.isArray(body.methods)) {
      return NextResponse.json({ error: 'Format invalide : methods doit être un tableau' }, { status: 400 });
    }

    const methods: PaymentMethod[] = body.methods;

    await Settings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { value: JSON.stringify(methods) },
      { upsert: true, new: true }
    );

    const whatsappPreview = formatPaymentMethodsForWhatsApp(methods);

    return NextResponse.json({
      success: true,
      methods,
      whatsappPreview,
    });
  } catch (error: any) {
    console.error('Error saving payment settings:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la sauvegarde' }, { status: 500 });
  }
}

