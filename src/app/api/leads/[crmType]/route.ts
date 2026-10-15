import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Lead from '@/models/Lead';
import { formatPhone, buildPhoneMongoRegex } from '@/lib/phoneUtils';
import { isClassWithoutSection } from '@/types/crm';
import { getCachedLeads, setCachedLeads, invalidateLeadsCache, updateCachedLeadInPlace } from '@/lib/leadsCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0'
};

export async function GET(request: Request, { params }: { params: Promise<{ crmType: string }> }) {
  const { crmType } = await params;
  try {
    if (!['elios', 'formatic'].includes(crmType)) {
      return NextResponse.json({ error: 'Invalid CRM type' }, { status: 400 });
    }

    const validCrm = crmType as 'elios' | 'formatic';
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === '1' || url.searchParams.get('force') === '1';
    if (forceRefresh) {
      invalidateLeadsCache('all');
    }

    const { data: cached, isStale } = getCachedLeads(validCrm);

    // Si nous avons des données ultra-fraîches en mémoire vive (< 15s) et sans forçage : réponse instantanée (< 5ms)
    if (cached && !isStale && !forceRefresh) {
      return NextResponse.json(cached, { headers: NO_CACHE_HEADERS });
    }

    await connectMongo();

    if (crmType === 'formatic') {
      // Pour Formatic : requêtes parallèles optimisées avec batchSize et tri chronologique unifié
      const [formaticLeads, migratedLeads] = await Promise.all([
        Lead.find({ crmType: 'formatic' }).sort({ date: -1, _id: -1 }).batchSize(2000).lean(),
        Lead.find({ crmType: 'elios', fromFormatic: true }).sort({ date: -1, _id: -1 }).batchSize(2000).lean()
      ]);

      const formattedMigrated = migratedLeads.map((l: any) => ({
        ...l,
        isMigratedToElios: true,
        toElios: true
      }));

      const result = [...formaticLeads, ...formattedMigrated];
      result.sort((a, b) => {
        const timeB = b.date ? new Date(b.date).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        const timeA = a.date ? new Date(a.date).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        if (timeB !== timeA) return timeB - timeA;
        const idNumB = parseInt(String(b.id || '').replace(/\D/g, ''), 10) || 0;
        const idNumA = parseInt(String(a.id || '').replace(/\D/g, ''), 10) || 0;
        if (idNumB !== idNumA) return idNumB - idNumA;
        return String(b.id || b._id).localeCompare(String(a.id || a._id));
      });
      setCachedLeads('formatic', result);
      return NextResponse.json(result, { headers: NO_CACHE_HEADERS });
    }

    // Sort by creation date so new leads are strictly on top
    const leads = await Lead.find({ crmType }).sort({ date: -1, _id: -1 }).batchSize(2000).lean();
    setCachedLeads('elios', leads);
    return NextResponse.json(leads, { headers: NO_CACHE_HEADERS });
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

    const isToEliosActive = Boolean(body.toElios);
    const targetCrm = (crmType === 'formatic' && isToEliosActive) ? 'elios' : crmType;

    // Règle d'intégrité absolue : INTERDICTION DES DOUBLONS DE NUMÉRO DE TÉLÉPHONE
    const phoneRegex = buildPhoneMongoRegex(cleanPhone);

    // 1. Règle magistrale Cross-CRM : Interdiction stricte si le numéro est déjà dans CRM Elios
    if (crmType === 'formatic') {
      const eliosConflict = await Lead.findOne({ crmType: 'elios', phone: phoneRegex }).lean();
      if (eliosConflict) {
        const doc = eliosConflict as any;
        const dupName = doc.name || doc.phone;
        const dupStatus = doc.status || 'Lead';
        const cleanDigits = cleanPhone.replace(/\D/g, '').slice(-8);
        return NextResponse.json(
          {
            error: `Ce numéro de téléphone est déjà présent dans le CRM Elios pour le prospect "${dupName}" (${dupStatus}). Il est strictement interdit de le créer dans le CRM Formatic.`,
            conflictType: 'EXISTS_IN_ELIOS',
            eliosLead: {
              id: doc.id,
              _id: String(doc._id),
              name: dupName,
              status: dupStatus,
              phone: formatPhone(doc.phone) || doc.phone,
              offer: doc.offer || '',
              grade: doc.grade || '',
              section: doc.section || '',
              staff: doc.staff || doc.lastModifiedBy || 'Système'
            },
            eliosUrl: `/crm-elios?search=${encodeURIComponent(cleanDigits)}&openLead=${encodeURIComponent(doc.id || doc._id)}`
          },
          { status: 409 }
        );
      }
    }

    // 2. Règle intra-CRM : Interdiction des doublons dans le CRM cible
    const existingDuplicate = await Lead.findOne({ crmType: targetCrm, phone: phoneRegex }).lean();
    if (existingDuplicate) {
      const dupName = (existingDuplicate as any).name || (existingDuplicate as any).phone;
      const dupStatus = (existingDuplicate as any).status || 'Lead';
      const crmLabel = targetCrm === 'elios' ? 'CRM Elios' : 'CRM Formatic';
      return NextResponse.json(
        { 
          error: `Ce numéro de téléphone est déjà enregistré pour le prospect "${dupName}" (${dupStatus}). Les doublons sont strictement interdits dans ${crmLabel}.`,
          conflictType: 'EXISTS_IN_SAME_CRM',
          existingLead: {
            id: (existingDuplicate as any).id,
            name: dupName,
            status: dupStatus,
            phone: (existingDuplicate as any).phone
          }
        }, 
        { status: 409 }
      );
    }

    // Si nouveau prospect créé avec To Elios activé : création directe dans Elios (MIGRATION, zéro copie dans Formatic)
    if (crmType === 'formatic' && isToEliosActive) {

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
        modifiers: (body.staff && body.staff.toLowerCase() !== 'système' && body.staff.toLowerCase() !== 'systeme' && body.staff.toLowerCase() !== 'non assigné') ? [body.staff] : [],
        modifierLogs: (body.staff && body.staff.toLowerCase() !== 'système' && body.staff.toLowerCase() !== 'systeme' && body.staff.toLowerCase() !== 'non assigné')
          ? [{ operator: body.staff, at: now, action: 'create' }]
          : [],
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

      updateCachedLeadInPlace('elios', eliosLead.toObject());
      invalidateLeadsCache('all');

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
      modifiers: (body.staff && body.staff.toLowerCase() !== 'système' && body.staff.toLowerCase() !== 'systeme' && body.staff.toLowerCase() !== 'non assigné') ? [body.staff] : [],
      modifierLogs: (body.staff && body.staff.toLowerCase() !== 'système' && body.staff.toLowerCase() !== 'systeme' && body.staff.toLowerCase() !== 'non assigné')
        ? [{ operator: body.staff, at: now, action: 'create' }]
        : [],
      notes: body.notes || []
    });

    updateCachedLeadInPlace(crmType as any, lead.toObject());
    invalidateLeadsCache(isToEliosActive ? 'all' : (crmType as any));
    return NextResponse.json(lead, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create lead:', error);
    return NextResponse.json({ error: error.message || 'Failed to create lead' }, { status: 500 });
  }
}
