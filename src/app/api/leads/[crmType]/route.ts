import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Lead from '@/models/Lead';
import { formatPhone } from '@/lib/phoneUtils';
import { isClassWithoutSection } from '@/types/crm';

export async function GET(request: Request, { params }: { params: Promise<{ crmType: string }> }) {
  const { crmType } = await params;
  try {
    await connectMongo();
    
    if (!['elios', 'formatic'].includes(crmType)) {
      return NextResponse.json({ error: 'Invalid CRM type' }, { status: 400 });
    }

    if (crmType === 'formatic') {
      // Pour Formatic : renvoyer les prospects Formatic actifs ainsi que les prospects migrés vers Elios
      const formaticLeads = await Lead.find({ crmType: 'formatic' }).sort({ date: -1, _id: -1 }).lean();
      const migratedLeads = await Lead.find({ crmType: 'elios', fromFormatic: true }).sort({ date: -1, _id: -1 }).lean();

      const formattedMigrated = migratedLeads.map((l: any) => ({
        ...l,
        isMigratedToElios: true,
        toElios: true
      }));

      return NextResponse.json([...formaticLeads, ...formattedMigrated]);
    }

    // Sort by creation date so modifications keep leads strictly in their place
    const leads = await Lead.find({ crmType }).sort({ date: -1, _id: -1 });
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
    const cleanPhone = formatPhone(body.phone) || String(body.phone || '').trim();
    const firstName = (body.firstName || '').trim();
    const lastName = (body.lastName || '').trim();
    const computedName = body.name || [firstName, lastName].filter(Boolean).join(' ') || 'Prospect sans nom';
    const now = new Date();
    let leadStatus = body.status || 'Lead';
    if (leadStatus === 'Converti') leadStatus = 'Approved';

    // Si nouveau prospect créé avec To Elios activé : création directe dans Elios (MIGRATION, zéro copie dans Formatic)
    const isToEliosActive = Boolean(body.toElios);
    if (crmType === 'formatic' && isToEliosActive) {
      const existingElios = await Lead.findOne({ crmType: 'elios', phone: cleanPhone });
      if (existingElios) {
        existingElios.fromFormatic = true;
        existingElios.updatedAt = now;
        existingElios.lastModifiedBy = body.staff || 'Système';
        existingElios.notes = [
          {
            id: `note-from-formatic-${Date.now()}`,
            text: `Nouveau prospect Formatic créé et migré vers Elios par ${body.staff || 'Système'}`,
            by: body.staff || 'Système',
            addedBy: body.staff || 'Système',
            date: now.toISOString(),
            addedAt: now
          },
          ...(existingElios.notes || [])
        ];
        await existingElios.save();
        return NextResponse.json({
          ...existingElios.toObject(),
          migrated: true,
          targetCrm: 'elios'
        }, { status: 201 });
      }

      // Attribution d'un ID PRO pour Elios
      let nextIdNumber = 1;
      const allLeadsWithId = await Lead.find({ crmType: 'elios', id: /^PRO-\d+$/ }, { id: 1 }).lean();
      if (allLeadsWithId && allLeadsWithId.length > 0) {
        let maxNum = 0;
        for (const item of allLeadsWithId) {
          const num = parseInt(item.id.replace('PRO-', ''), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
        nextIdNumber = maxNum + 1;
      }
      const newEliosId = `PRO-${nextIdNumber.toString().padStart(5, '0')}`;

      const eliosLead = await Lead.create({
        id: body.id || newEliosId,
        firstName,
        lastName,
        name: computedName,
        phone: cleanPhone,
        offer: body.offer || 'Zero to Hero',
        amount: body.amount || '',
        source: 'From Formatic',
        grade: body.grade || '',
        section: isClassWithoutSection(body.grade) ? '' : (body.section || ''),
        status: leadStatus,
        staff: body.staff || 'Système',
        crmType: 'elios',
        familyGroup: (body.familyGroup || '').trim(),
        toElios: false,
        fromFormatic: true,
        date: now,
        updatedAt: now,
        lastModifiedBy: body.staff || 'Système',
        notes: [
          ...(body.notes || []),
          {
            id: `note-from-formatic-${Date.now()}`,
            text: `Nouveau prospect Formatic créé et migré vers Elios par ${body.staff || 'Système'}`,
            by: body.staff || 'Système',
            addedBy: body.staff || 'Système',
            date: now.toISOString(),
            addedAt: now
          }
        ]
      });

      return NextResponse.json({
        ...eliosLead.toObject(),
        migrated: true,
        targetCrm: 'elios'
      }, { status: 201 });
    }

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

    const lead = await Lead.create({
      id: body.id || newId,
      firstName,
      lastName,
      name: computedName,
      phone: cleanPhone,
      offer: body.offer || 'Zero to Hero',
      amount: body.amount || '',
      source: body.source || 'Facebook',
      grade: body.grade || '',
      section: isClassWithoutSection(body.grade) ? '' : (body.section || ''),
      status: leadStatus,
      staff: body.staff || 'Système',
      crmType: crmType,
      familyGroup: (body.familyGroup || '').trim(),
      toElios: false,
      date: now,
      updatedAt: now,
      lastModifiedBy: body.staff || 'Système',
      notes: body.notes || []
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create lead:', error);
    return NextResponse.json({ error: error.message || 'Failed to create lead' }, { status: 500 });
  }
}
