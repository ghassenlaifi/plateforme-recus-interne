import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Lead from '@/models/Lead';
import * as xlsx from 'xlsx';
import { standardizeImportRow } from '@/lib/leadNormalizer';
import { buildPhoneMongoRegex } from '@/lib/phoneUtils';
import { invalidateLeadsCache } from '@/lib/leadsCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ crmType: string }> }
) {
  const { crmType } = await params;
  try {
    if (!['elios', 'formatic', 'sos-prof'].includes(crmType)) {
      return NextResponse.json({ error: 'Type de CRM invalide' }, { status: 400 });
    }

    await connectMongo();

    const contentType = request.headers.get('content-type') || '';
    let rawRows: any[] = [];
    let defaultSource = '';
    let defaultStatus = 'Lead';
    let defaultOffer = 'Zero to Hero';
    let operator = 'Import Système';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      defaultSource = (formData.get('defaultSource') as string) || '';
      defaultStatus = (formData.get('defaultStatus') as string) || 'Lead';
      defaultOffer = (formData.get('defaultOffer') as string) || 'Zero to Hero';
      operator = (formData.get('operator') as string) || 'Import Système';

      if (!file) {
        return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return NextResponse.json({ error: 'Le fichier ne contient aucune feuille' }, { status: 400 });
      }

      const worksheet = workbook.Sheets[firstSheetName];
      rawRows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
    } else {
      // JSON payload
      const body = await request.json();
      rawRows = Array.isArray(body.rows) ? body.rows : [];
      defaultSource = body.defaultSource || '';
      defaultStatus = body.defaultStatus || 'Lead';
      defaultOffer = body.defaultOffer || 'Zero to Hero';
      operator = body.operator || 'Import Système';
    }

    if (!rawRows || rawRows.length === 0) {
      return NextResponse.json({ error: 'Aucune donnée détectée dans le fichier' }, { status: 400 });
    }

    // 1. Normalisation standardisée de toutes les lignes
    const normalizedCandidates = rawRows.map((row, index) => {
      const standardized = standardizeImportRow(row, {
        defaultSource,
        defaultStatus,
        defaultOffer,
        operator,
        crmType: crmType as any
      });
      return {
        ...standardized,
        rowIndex: index + 2 // +2 pour correspondre au numéro de ligne réel dans Excel (ligne 1 = en-têtes)
      };
    });

    const validCandidates = normalizedCandidates.filter(c => !c.validationError && c.cleanPhone);
    const invalidCandidates = normalizedCandidates.filter(c => Boolean(c.validationError));

    const errors: string[] = invalidCandidates.map(
      c => `Ligne ${c.rowIndex} : ${c.validationError || 'Données invalides'}`
    );

    // 2. RÈGLE MILITAIRE : ON N'ÉCRASE JAMAIS LES ANCIENNES DONNÉES
    // Recherche de tous les numéros existants dans le CRM cible pour les préserver
    const phoneRegexes = validCandidates.map(c => buildPhoneMongoRegex(c.cleanPhone));
    
    // Batch de recherche des doublons existants
    const existingInDb = await Lead.find({
      crmType,
      phone: { $in: phoneRegexes }
    }, { phone: 1, id: 1, notes: 1, name: 1 }).lean();

    const existingPhoneSet = new Set<string>();
    existingInDb.forEach((doc: any) => {
      const digits = String(doc.phone || '').replace(/\D/g, '').slice(-8);
      if (digits) existingPhoneSet.add(digits);
    });

    // 3. Détermination des séquences d'ID PRO pour les nouveaux prospects
    let nextIdNumber = 1;
    const lastLeads = await Lead.find({ crmType, id: /^PRO-\d+$/ }, { id: 1 }).lean();
    if (lastLeads && lastLeads.length > 0) {
      let maxNum = 0;
      for (const item of lastLeads) {
        const num = parseInt(item.id.replace('PRO-', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
      nextIdNumber = maxNum + 1;
    }

    const now = new Date();
    const leadsToInsert: any[] = [];
    let preservedCount = 0;
    const seenImportPhones = new Set<string>();

    for (const cand of validCandidates) {
      const cleanDigits = cand.cleanPhone.replace(/\D/g, '').slice(-8);

      // Doublon intra-fichier ou déjà existant en base -> PRÉSERVER SANS ÉCRASER
      if (existingPhoneSet.has(cleanDigits) || seenImportPhones.has(cleanDigits)) {
        preservedCount++;
        continue;
      }

      seenImportPhones.add(cleanDigits);

      const generatedId = `PRO-${nextIdNumber.toString().padStart(5, '0')}`;
      nextIdNumber++;

      const initialNotes = [...cand.notes];
      initialNotes.push({
        id: `note-import-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        text: `Prospect importé depuis fichier Excel le ${now.toLocaleDateString('fr-FR')} par ${operator}`,
        by: operator,
        addedBy: operator,
        date: now.toISOString(),
        addedAt: now
      });

      leadsToInsert.push({
        id: generatedId,
        firstName: cand.firstName,
        lastName: cand.lastName,
        name: cand.name,
        phone: cand.cleanPhone,
        offer: cand.offer,
        amount: cand.amount,
        source: cand.source,
        grade: cand.grade,
        section: cand.section,
        status: cand.status,
        staff: cand.staff || operator,
        assignedTeachers: cand.assignedTeachers || [],
        familyGroup: cand.familyGroup,
        crmType,
        date: cand.date || now,
        updatedAt: now,
        lastModifiedBy: operator,
        modifiers: (operator && !['système', 'systeme', 'non assigné'].includes(operator.toLowerCase())) ? [operator] : [],
        modifierLogs: [
          {
            operator,
            at: now,
            action: 'import'
          }
        ],
        notes: initialNotes
      });
    }

    // 4. Insertion sécurisée en masse
    if (leadsToInsert.length > 0) {
      await Lead.insertMany(leadsToInsert, { ordered: false });
    }

    // Invalidation immédiate du cache RAM
    invalidateLeadsCache(crmType as any);

    return NextResponse.json({
      success: true,
      totalRows: rawRows.length,
      imported: leadsToInsert.length,
      preserved: preservedCount,
      invalid: invalidCandidates.length,
      errors: errors.slice(0, 30),
      message: `${leadsToInsert.length} nouveau(x) prospect(s) importé(s) avec succès. ${preservedCount} prospect(s) déjà existant(s) conservé(s) intact(s) sans aucun écrasement.`
    }, { status: 200 });

  } catch (error: any) {
    console.error('Erreur importation prospects:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de l\'importation' }, { status: 500 });
  }
}

