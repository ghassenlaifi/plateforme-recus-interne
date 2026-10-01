import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Lead from '@/models/Lead';

export async function GET(request: Request, { params }: { params: Promise<{ crmType: string }> }) {
  const { crmType } = await params;
  try {
    await connectMongo();
    
    if (!['elios', 'formatic'].includes(crmType)) {
      return NextResponse.json({ error: 'Invalid CRM type' }, { status: 400 });
    }

    // Sort by latest update first, then creation date
    const leads = await Lead.find({ crmType }).sort({ updatedAt: -1, date: -1 });
    return NextResponse.json(leads);
  } catch (error) {
    console.error('Failed to fetch leads:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ crmType: string }> }) {
  const { crmType } = await params;
  try {
    await connectMongo();
    
    if (!['elios', 'formatic'].includes(crmType)) {
      return NextResponse.json({ error: 'Invalid CRM type' }, { status: 400 });
    }

    const body = await request.json();
    
    // Auto-generate an ID (PRO-XXXXX) sequentially
    let nextIdNumber = 1;
    const allLeadsWithId = await Lead.find({ crmType, id: /^PRO-\d+$/ }, { id: 1 }).lean();
    if (allLeadsWithId && allLeadsWithId.length > 0) {
      let maxNum = 0;
      for (const item of allLeadsWithId) {
        const num = parseInt(item.id.replace('PRO-', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
      nextIdNumber = maxNum + 1;
    }
    const newId = `PRO-${nextIdNumber.toString().padStart(5, '0')}`;

    let leadStatus = body.status || 'Lead'; // Par défaut 'Lead'
    if (leadStatus === 'Converti') leadStatus = 'Approved';

    const cleanPhone = String(body.phone || '').replace(/\D/g, '').replace(/^216(?=\d{8}$)/, '');
    const firstName = (body.firstName || '').trim();
    const lastName = (body.lastName || '').trim();
    const computedName = body.name || [firstName, lastName].filter(Boolean).join(' ') || 'Prospect sans nom';
    const now = new Date();

    const lead = await Lead.create({
      id: body.id || newId,
      firstName,
      lastName,
      name: computedName,
      phone: cleanPhone || String(body.phone || ''),
      offer: body.offer || 'Zero to Hero',
      amount: body.amount || '',
      source: body.source || 'Facebook', // Par défaut 'Facebook'
      grade: body.grade || '',
      section: body.section || '',
      status: leadStatus,
      staff: body.staff || 'Système',
      crmType: crmType,
      familyGroup: (body.familyGroup || '').trim(),
      toElios: Boolean(body.toElios),
      date: now,
      updatedAt: now,
      lastModifiedBy: body.staff || 'Système',
      notes: body.notes || []
    });

    // Si nouveau prospect Formatic avec To Elios coché : synchroniser / copier vers Elios
    const isToEliosActive = Boolean(body.toElios !== undefined ? body.toElios : (lead.toElios ?? (lead as any)?._doc?.toElios));
    if (crmType === 'formatic' && isToEliosActive) {
      try {
        const targetPhone = lead.phone || cleanPhone;
        const existingElios = await Lead.findOne({ crmType: 'elios', phone: targetPhone });
        if (existingElios) {
          existingElios.fromFormatic = true;
          await existingElios.save();
        } else {
          let nextNum = 1;
          const lastElios = await Lead.find({ crmType: 'elios', id: /^PRO-\d+$/ }, { id: 1 }).lean();
          if (lastElios && lastElios.length > 0) {
            let maxN = 0;
            for (const item of lastElios) {
              const num = parseInt(item.id.replace('PRO-', ''), 10);
              if (!isNaN(num) && num > maxN) maxN = num;
            }
            nextNum = maxN + 1;
          }
          const newEliosId = `PRO-${nextNum.toString().padStart(5, '0')}`;

          await Lead.create({
            id: newEliosId,
            firstName: lead.firstName || '',
            lastName: lead.lastName || '',
            name: lead.name || 'Prospect sans nom',
            phone: lead.phone,
            offer: lead.offer || 'Zero to Hero',
            amount: lead.amount || '',
            source: 'From Formatic',
            grade: lead.grade || '',
            section: lead.section || '',
            status: lead.status || 'Lead',
            staff: lead.staff || 'Système',
            crmType: 'elios',
            familyGroup: lead.familyGroup || '',
            date: now,
            updatedAt: now,
            lastModifiedBy: body.staff || 'Système',
            fromFormatic: true,
            notes: [
              ...(lead.notes || []),
              {
                id: `note-from-formatic-${Date.now()}`,
                text: `Nouveau prospect Formatic synchronisé vers Elios`,
                by: body.staff || 'Système',
                addedBy: body.staff || 'Système',
                date: now.toISOString(),
                addedAt: now
              }
            ]
          });
        }
      } catch (copyErr) {
        console.error('Erreur synchronisation To Elios:', copyErr);
      }
    }

    return NextResponse.json(lead, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create lead:', error);
    return NextResponse.json({ error: error.message || 'Failed to create lead' }, { status: 500 });
  }
}
