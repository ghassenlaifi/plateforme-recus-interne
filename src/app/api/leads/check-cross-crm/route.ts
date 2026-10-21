import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Lead from '@/models/Lead';
import { extractPhoneData, buildPhoneMongoRegex, formatPhone } from '@/lib/phoneUtils';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const phone = url.searchParams.get('phone');
    const target = url.searchParams.get('target') || 'all';

    if (!phone) {
      return NextResponse.json({ existsInElios: false, existsInSosProf: false }, { status: 200 });
    }

    const data = extractPhoneData(phone);
    if (!data.isValid && data.nationalDigits.length < 6) {
      return NextResponse.json({ existsInElios: false, existsInSosProf: false }, { status: 200 });
    }

    await connectMongo();

    const phoneRegex = buildPhoneMongoRegex(phone);

    const [existingEliosLead, existingSosLead] = await Promise.all([
      Lead.findOne({ crmType: 'elios', phone: phoneRegex }).lean(),
      Lead.findOne({ crmType: 'sos-prof', phone: phoneRegex }).lean()
    ]);

    const eliosDoc = existingEliosLead as any;
    const sosDoc = existingSosLead as any;

    return NextResponse.json({
      existsInElios: Boolean(eliosDoc),
      existsInSosProf: Boolean(sosDoc),
      lead: eliosDoc ? {
        id: eliosDoc.id,
        _id: String(eliosDoc._id),
        name: eliosDoc.name || 'Prospect sans nom',
        phone: formatPhone(eliosDoc.phone) || eliosDoc.phone,
        status: eliosDoc.status || 'Lead',
        offer: eliosDoc.offer || '',
        grade: eliosDoc.grade || '',
        section: eliosDoc.section || '',
        staff: eliosDoc.staff || eliosDoc.lastModifiedBy || 'Système',
        lastModifiedBy: eliosDoc.lastModifiedBy || eliosDoc.staff || 'Système',
        date: eliosDoc.date || eliosDoc.createdAt
      } : null,
      sosLead: sosDoc ? {
        id: sosDoc.id,
        _id: String(sosDoc._id),
        name: sosDoc.name || 'Prospect sans nom',
        phone: formatPhone(sosDoc.phone) || sosDoc.phone,
        status: sosDoc.status || 'Lead',
        offer: sosDoc.offer || '',
        grade: sosDoc.grade || '',
        section: sosDoc.section || '',
        staff: sosDoc.staff || sosDoc.lastModifiedBy || 'Système',
        assignedTeachers: sosDoc.assignedTeachers || [],
        date: sosDoc.date || sosDoc.createdAt
      } : null,
      eliosUrl: eliosDoc ? `/crm-elios?search=${encodeURIComponent(data.nationalDigits || phone)}&openLead=${encodeURIComponent(eliosDoc.id || eliosDoc._id)}` : '',
      sosUrl: sosDoc ? `/crm-sos-prof?search=${encodeURIComponent(data.nationalDigits || phone)}&openLead=${encodeURIComponent(sosDoc.id || sosDoc._id)}` : ''
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error in /api/leads/check-cross-crm:', error);
    return NextResponse.json({ error: error.message || 'Erreur vérification CRM' }, { status: 500 });
  }
}
