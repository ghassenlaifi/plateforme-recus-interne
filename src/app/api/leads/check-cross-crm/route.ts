import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Lead from '@/models/Lead';
import { extractPhoneData, buildPhoneMongoRegex, formatPhone } from '@/lib/phoneUtils';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const phone = url.searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ existsInElios: false }, { status: 200 });
    }

    const data = extractPhoneData(phone);
    if (!data.isValid && data.nationalDigits.length < 6) {
      return NextResponse.json({ existsInElios: false }, { status: 200 });
    }

    await connectMongo();

    const phoneRegex = buildPhoneMongoRegex(phone);
    const existingEliosLead = await Lead.findOne({
      crmType: 'elios',
      phone: phoneRegex
    }).lean();

    if (!existingEliosLead) {
      return NextResponse.json({ existsInElios: false }, { status: 200 });
    }

    const doc = existingEliosLead as any;
    const cleanPhone = formatPhone(doc.phone) || doc.phone;
    const leadId = doc.id || doc._id;

    return NextResponse.json({
      existsInElios: true,
      lead: {
        id: doc.id,
        _id: String(doc._id),
        name: doc.name || 'Prospect sans nom',
        phone: cleanPhone,
        status: doc.status || 'Lead',
        offer: doc.offer || '',
        grade: doc.grade || '',
        section: doc.section || '',
        staff: doc.staff || doc.lastModifiedBy || 'Système',
        lastModifiedBy: doc.lastModifiedBy || doc.staff || 'Système',
        date: doc.date || doc.createdAt
      },
      eliosUrl: `/crm-elios?search=${encodeURIComponent(data.nationalDigits || phone)}&openLead=${encodeURIComponent(leadId)}`
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error in /api/leads/check-cross-crm:', error);
    return NextResponse.json({ error: error.message || 'Erreur vérification CRM' }, { status: 500 });
  }
}

