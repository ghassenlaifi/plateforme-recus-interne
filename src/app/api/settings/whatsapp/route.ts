import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Settings } from '@/models/Settings';
import { WhatsAppTemplates, DEFAULT_WHATSAPP_TEMPLATES } from '@/types/settings';

const SETTINGS_KEY = 'whatsapp_templates';

export async function GET() {
  try {
    await connectToDatabase();
    const doc = await Settings.findOne({ key: SETTINGS_KEY }).lean();

    let templates: WhatsAppTemplates = DEFAULT_WHATSAPP_TEMPLATES;
    if (doc && (doc as any).value) {
      try {
        const parsed = JSON.parse((doc as any).value);
        templates = {
          approvedProspectHeader: parsed.approvedProspectHeader || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectHeader,
          approvedProspectFooter: parsed.approvedProspectFooter || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectFooter,
          approvedProspectHeader_ar: parsed.approvedProspectHeader_ar || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectHeader_ar,
          approvedProspectFooter_ar: parsed.approvedProspectFooter_ar || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectFooter_ar,
          naMessage: parsed.naMessage || DEFAULT_WHATSAPP_TEMPLATES.naMessage,
          naMessage_ar: parsed.naMessage_ar || DEFAULT_WHATSAPP_TEMPLATES.naMessage_ar,
          groupReminder: parsed.groupReminder || DEFAULT_WHATSAPP_TEMPLATES.groupReminder,
          groupReminder_ar: parsed.groupReminder_ar || DEFAULT_WHATSAPP_TEMPLATES.groupReminder_ar,
          teacherReminder: parsed.teacherReminder || DEFAULT_WHATSAPP_TEMPLATES.teacherReminder,
          teacherReminder_ar: parsed.teacherReminder_ar || DEFAULT_WHATSAPP_TEMPLATES.teacherReminder_ar,
        };
      } catch (e) {
        console.error('Error parsing whatsapp templates from DB:', e);
      }
    }

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Error fetching whatsapp templates:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const templates: WhatsAppTemplates = {
      approvedProspectHeader: body.approvedProspectHeader || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectHeader,
      approvedProspectFooter: body.approvedProspectFooter || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectFooter,
      approvedProspectHeader_ar: body.approvedProspectHeader_ar || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectHeader_ar,
      approvedProspectFooter_ar: body.approvedProspectFooter_ar || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectFooter_ar,
      naMessage: body.naMessage || DEFAULT_WHATSAPP_TEMPLATES.naMessage,
      naMessage_ar: body.naMessage_ar || DEFAULT_WHATSAPP_TEMPLATES.naMessage_ar,
      groupReminder: body.groupReminder || DEFAULT_WHATSAPP_TEMPLATES.groupReminder,
      groupReminder_ar: body.groupReminder_ar || DEFAULT_WHATSAPP_TEMPLATES.groupReminder_ar,
      teacherReminder: body.teacherReminder || DEFAULT_WHATSAPP_TEMPLATES.teacherReminder,
      teacherReminder_ar: body.teacherReminder_ar || DEFAULT_WHATSAPP_TEMPLATES.teacherReminder_ar,
    };

    await Settings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { value: JSON.stringify(templates) },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error: any) {
    console.error('Error saving whatsapp templates:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la sauvegarde' }, { status: 500 });
  }
}

