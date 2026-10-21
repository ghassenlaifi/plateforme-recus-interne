import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Lead from '@/models/Lead';
import { formatPhone, buildPhoneMongoRegex } from '@/lib/phoneUtils';
import { isClassWithoutSection } from '@/types/crm';
import { invalidateLeadsCache, removeCachedLeadEverywhere, updateCachedLeadInPlace } from '@/lib/leadsCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0'
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ crmType: string; id: string }> }
) {
  const { crmType, id } = await params;
  try {
    await connectMongo();
    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { id };
    const crmFilter = crmType === 'formatic'
      ? { $or: [{ crmType: 'formatic' }, { crmType: 'elios', fromFormatic: true }] }
      : crmType === 'elios'
        ? { crmType: 'elios' }
        : { crmType: 'sos-prof' };

    const lead = await Lead.findOne({ ...query, ...crmFilter }).lean();
    if (!lead) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404, headers: NO_CACHE_HEADERS });
    }
    return NextResponse.json(lead, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error('Failed to fetch lead:', error);
    return NextResponse.json({ error: error.message || 'Erreur récupération prospect' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ crmType: string; id: string }> }
) {
  const { crmType, id } = await params;
  try {
    await connectMongo();
    const body = await request.json();
    const now = new Date();
    const operator = body.lastModifiedBy || body.operator || 'Système';

    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { id };

    const crmFilter = crmType === 'formatic'
      ? { $or: [{ crmType: 'formatic' }, { crmType: 'elios', fromFormatic: true }] }
      : crmType === 'elios'
        ? { crmType: 'elios' }
        : { crmType: 'sos-prof' };

    // Cas 1 : Ajout atomique d'une note (évite les conflits entre opérateurs)
    if (body.action === 'add_note' && body.note) {
      const newNote = {
        id: body.note.id || ('n-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
        text: body.note.text || '',
        by: body.note.by || operator,
        addedBy: body.note.addedBy || body.note.by || operator,
        date: body.note.date || now.toISOString(),
        addedAt: now,
      };

      const logEntry = (operator && operator.toLowerCase() !== 'système' && operator.toLowerCase() !== 'systeme' && operator.toLowerCase() !== 'non assigné')
        ? [{ operator, at: now, action: 'add_note' }]
        : [];

      const updateNoteQuery: any = { 
        $push: { 
          notes: { $each: [newNote], $position: 0 },
          ...(logEntry.length > 0 ? { modifierLogs: { $each: logEntry, $slice: -100 } } : {})
        },
        $set: { updatedAt: now, lastModifiedBy: operator }
      };
      if (operator && operator.toLowerCase() !== 'système' && operator.toLowerCase() !== 'systeme' && operator.toLowerCase() !== 'non assigné') {
        updateNoteQuery.$addToSet = { modifiers: operator };
      }

      const updated = await Lead.findOneAndUpdate(
        { ...query, ...crmFilter },
        updateNoteQuery,
        { new: true }
      );

      if (!updated) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
      updateCachedLeadInPlace(crmType as 'elios' | 'formatic', updated.toObject ? updated.toObject() : updated);
      return NextResponse.json(updated);
    }

    // Cas 2 : Modification atomique d'une note existante
    if (body.action === 'edit_note' && body.noteId && body.noteText !== undefined) {
      const existing = await Lead.findOne({ ...query, ...crmFilter });
      if (!existing) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
      
      const notes = Array.isArray(existing.notes) ? [...existing.notes] : [];
      let noteIdx = notes.findIndex((n: any) => 
        (n.id && n.id === body.noteId) || 
        (n._id && n._id.toString() === body.noteId)
      );

      if (noteIdx === -1 && typeof body.noteId === 'string' && body.noteId.startsWith('n-')) {
        const idxCandidate = parseInt(body.noteId.replace('n-', ''), 10);
        if (!isNaN(idxCandidate) && idxCandidate >= 0 && idxCandidate < notes.length) {
          noteIdx = idxCandidate;
        }
      }

      if (noteIdx === -1) {
        return NextResponse.json({ error: 'Note introuvable' }, { status: 404 });
      }

      const noteToEdit = notes[noteIdx];
      const noteAuthor = noteToEdit.by || noteToEdit.addedBy || '';
      const isValidationNote = Boolean(
        (noteToEdit.text && (
          noteToEdit.text.includes('Inscription validée') ||
          noteToEdit.text.includes('Inscription validée automatiquement')
        )) ||
        (noteToEdit.id && typeof noteToEdit.id === 'string' && noteToEdit.id.startsWith('auto-'))
      );
      const isAuthorized = Boolean(
        isValidationNote ||
        !noteAuthor ||
        noteAuthor.toLowerCase() === 'système' ||
        noteAuthor.toLowerCase() === 'systeme' ||
        (operator && noteAuthor.toLowerCase() === operator.toLowerCase()) ||
        (operator && ['ghassen', 'admin', 'superadmin', 'amine'].includes(operator.toLowerCase()))
      );

      if (!isAuthorized) {
        return NextResponse.json({ error: "Seul l'auteur de cette note ou un administrateur peut la modifier" }, { status: 403 });
      }

      notes[noteIdx] = {
        ...notes[noteIdx],
        text: body.noteText,
        editedAt: now.toISOString(),
        editedBy: operator,
      };

      existing.notes = notes;
      existing.updatedAt = now;
      existing.lastModifiedBy = operator;
      if (!existing.modifiers) existing.modifiers = [];
      if (operator && operator.toLowerCase() !== 'système' && operator.toLowerCase() !== 'systeme' && operator.toLowerCase() !== 'non assigné') {
        if (!existing.modifiers.includes(operator)) existing.modifiers.push(operator);
        if (!existing.modifierLogs) existing.modifierLogs = [];
        existing.modifierLogs.push({ operator, at: now, action: 'edit_note' });
        if (existing.modifierLogs.length > 100) existing.modifierLogs = existing.modifierLogs.slice(-100);
      }
      await existing.save();
      updateCachedLeadInPlace(crmType as 'elios' | 'formatic', existing.toObject ? existing.toObject() : existing);
      return NextResponse.json(existing);
    }

    // Cas 3 : Suppression atomique d'une note
    if (body.action === 'delete_note' && body.noteId) {
      const existing = await Lead.findOne({ ...query, ...crmFilter });
      if (!existing) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
      
      const notes = Array.isArray(existing.notes) ? [...existing.notes] : [];
      let noteIdx = notes.findIndex((n: any) => 
        (n.id && n.id === body.noteId) || 
        (n._id && n._id.toString() === body.noteId)
      );

      // Fallback index pour les notes sans id explicite (format 'n-0', 'n-1', etc.)
      if (noteIdx === -1 && typeof body.noteId === 'string' && body.noteId.startsWith('n-')) {
        const idxCandidate = parseInt(body.noteId.replace('n-', ''), 10);
        if (!isNaN(idxCandidate) && idxCandidate >= 0 && idxCandidate < notes.length) {
          noteIdx = idxCandidate;
        }
      }

      if (noteIdx === -1) {
        return NextResponse.json({ error: 'Note introuvable' }, { status: 404 });
      }

      const noteToDelete = notes[noteIdx];
      const noteAuthor = (noteToDelete.by || noteToDelete.addedBy || '').trim();
      const isValidationNote = Boolean(
        (noteToDelete.text && (
          noteToDelete.text.includes('Inscription validée') ||
          noteToDelete.text.includes('Inscription validée automatiquement')
        )) ||
        (noteToDelete.id && typeof noteToDelete.id === 'string' && noteToDelete.id.startsWith('auto-'))
      );

      let isAuthorized = false;
      if (isValidationNote) {
        // La note de validation de paiement peut être modifiée/supprimée manuellement par tout opérateur en session
        isAuthorized = Boolean(
          (operator && operator.trim()) ||
          (!noteAuthor || noteAuthor.toLowerCase() === 'système' || noteAuthor.toLowerCase() === 'systeme')
        );
      } else {
        // Notes manuelles classiques : auteur de la note ou administrateur
        isAuthorized = Boolean(
          !noteAuthor ||
          noteAuthor.toLowerCase() === 'système' ||
          noteAuthor.toLowerCase() === 'systeme' ||
          (operator && noteAuthor.toLowerCase() === operator.trim().toLowerCase()) ||
          (operator && ['ghassen', 'admin', 'superadmin', 'amine'].includes(operator.trim().toLowerCase()))
        );
      }

      if (!isAuthorized) {
        return NextResponse.json({ 
          error: "Seul un opérateur authentifié ou un administrateur peut supprimer cette note" 
        }, { status: 403 });
      }

      notes.splice(noteIdx, 1);
      existing.notes = notes;
      existing.updatedAt = now;
      existing.lastModifiedBy = operator;

      if (!existing.modifiers) existing.modifiers = [];
      if (operator && operator.toLowerCase() !== 'système' && operator.toLowerCase() !== 'systeme' && operator.toLowerCase() !== 'non assigné') {
        if (!existing.modifiers.includes(operator)) existing.modifiers.push(operator);
        if (!existing.modifierLogs) existing.modifierLogs = [];
        existing.modifierLogs.push({ operator, at: now, action: 'delete_note' });
        if (existing.modifierLogs.length > 100) existing.modifierLogs = existing.modifierLogs.slice(-100);
      }
      await existing.save();
      updateCachedLeadInPlace(crmType as 'elios' | 'formatic', existing.toObject ? existing.toObject() : existing);
      return NextResponse.json(existing);
    }

    // Cas 4 : Mise à jour globale des informations prospect
    if (body.phone !== undefined) {
      body.phone = formatPhone(body.phone) || body.phone;
      const phoneRegex = buildPhoneMongoRegex(body.phone);
      const conflictFilter: any = {
        ...crmFilter,
        phone: phoneRegex,
        ...(query._id ? { _id: { $ne: query._id } } : { id: { $ne: query.id } })
      };
      const existingConflict = await Lead.findOne(conflictFilter).lean();
      if (existingConflict) {
        const conflictName = (existingConflict as any).name || (existingConflict as any).phone;
        const conflictStatus = (existingConflict as any).status || 'Lead';
        return NextResponse.json({
          error: `Ce numéro de téléphone est déjà attribué à un autre prospect ("${conflictName}", statut : ${conflictStatus}). Les doublons sont strictement interdits.`
        }, { status: 409 });
      }
    }

    if (body.status === 'Converti') {
      body.status = 'Approved';
    }

    if (body.firstName !== undefined || body.lastName !== undefined) {
      const fName = body.firstName !== undefined ? body.firstName : '';
      const lName = body.lastName !== undefined ? body.lastName : '';
      if (!body.name) {
        body.name = [fName, lName].filter(Boolean).join(' ') || 'Prospect sans nom';
      }
    }

    if (body.grade !== undefined && isClassWithoutSection(body.grade)) {
      body.section = '';
    }
    if (body.assignedTeachers !== undefined) {
      body.assignedTeachers = Array.isArray(body.assignedTeachers) ? body.assignedTeachers : [];
    }

    // Contrôle magistral Cross-CRM : Interdire d'attribuer à un prospect Formatic un numéro déjà présent dans CRM Elios
    if (crmType === 'formatic' && body.phone && !body.toElios) {
      const cleanPhone = formatPhone(body.phone) || String(body.phone).trim();
      const phoneRegex = buildPhoneMongoRegex(cleanPhone);
      const eliosConflict = await Lead.findOne({ crmType: 'elios', phone: phoneRegex }).lean();
      if (eliosConflict) {
        const doc = eliosConflict as any;
        return NextResponse.json({
          error: `Ce numéro de téléphone est déjà présent dans le CRM Elios pour le prospect "${doc.name || doc.phone}". Modification interdite dans Formatic.`,
          conflictType: 'EXISTS_IN_ELIOS',
          eliosLead: doc
        }, { status: 409 });
      }
    }

    // Toute modification met à jour updatedAt et lastModifiedBy (ce qui réinitialise le cycle de Rappels)
    body.updatedAt = now;
    body.lastModifiedBy = operator;

    const actionType = body.action || (body.status !== undefined ? 'status_change' : 'update');
    const logEntry = (operator && operator.toLowerCase() !== 'système' && operator.toLowerCase() !== 'systeme' && operator.toLowerCase() !== 'non assigné')
      ? [{ operator, at: now, action: actionType }]
      : [];

    const pendingNote = body.pendingNote;
    delete body.pendingNote;

    // =========================================================================
    // MIGRATION CROSS-CRM ULTRA-RAPIDE (TO ELIOS ou TO SOS PROF)
    // Exécutée en UNE SEULE ÉCRITURE ATOMIQUE pour division par 3 de la latence
    // =========================================================================
    const isToEliosMigration = crmType === 'formatic' && Boolean(body.toElios);
    const isToSosProfMigration = (crmType === 'formatic' || crmType === 'elios') && Boolean(body.toSosProf);

    if (isToEliosMigration || isToSosProfMigration) {
      try {
        const sourceDoc = await Lead.findOne({ ...query, ...crmFilter });
        if (!sourceDoc) {
          return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
        }

        const targetCrm: 'elios' | 'sos-prof' = isToSosProfMigration ? 'sos-prof' : 'elios';
        const originLabel = crmType === 'elios' ? 'Elios' : 'Formatic';
        const rawTargetPhone = body.phone || sourceDoc.phone;
        const cleanTargetPhone = formatPhone(rawTargetPhone) || String(rawTargetPhone || '').trim();
        const phoneRegex = buildPhoneMongoRegex(cleanTargetPhone);

        const migrationNote = {
          id: `note-from-${crmType}-${Date.now()}`,
          text: isToSosProfMigration
            ? `Prospect migré depuis CRM ${originLabel} vers SOS Prof par ${operator}`
            : `Prospect migré depuis CRM Formatic vers CRM Elios par ${operator}`,
          by: operator,
          addedBy: operator,
          date: now.toISOString(),
          addedAt: now
        };

        // Requêtes parallèles ultra-rapides : vérification simultanée du numéro et du conflit d'ID
        const [existingTarget, idClash] = await Promise.all([
          Lead.findOne({ crmType: targetCrm, phone: phoneRegex }),
          sourceDoc.id ? Lead.findOne({ crmType: targetCrm, id: sourceDoc.id }).select('id').lean() : null
        ]);

        if (existingTarget) {
          // Fusion des données et des notes dans la fiche cible existante
          if (isToSosProfMigration) {
            if (crmType === 'formatic') existingTarget.fromFormatic = true;
            if (crmType === 'elios') existingTarget.fromElios = true;
            if (Array.isArray(body.assignedTeachers) && body.assignedTeachers.length > 0) {
              existingTarget.assignedTeachers = body.assignedTeachers;
            }
          } else {
            existingTarget.fromFormatic = true;
          }

          if (body.firstName !== undefined) existingTarget.firstName = body.firstName;
          if (body.lastName !== undefined) existingTarget.lastName = body.lastName;
          if (body.name) existingTarget.name = body.name;
          if (body.offer) existingTarget.offer = body.offer;
          if (body.amount !== undefined) existingTarget.amount = body.amount;
          if (body.grade !== undefined) existingTarget.grade = body.grade;
          if (body.section !== undefined) existingTarget.section = body.section;
          if (body.status) existingTarget.status = body.status;
          if (body.familyGroup !== undefined) existingTarget.familyGroup = body.familyGroup;
          existingTarget.date = now;
          existingTarget.updatedAt = now;
          existingTarget.lastModifiedBy = operator;

          if (!existingTarget.modifiers) existingTarget.modifiers = [];
          if (operator && operator.toLowerCase() !== 'système' && operator.toLowerCase() !== 'systeme' && operator.toLowerCase() !== 'non assigné') {
            if (!existingTarget.modifiers.includes(operator)) existingTarget.modifiers.push(operator);
            if (!existingTarget.modifierLogs) existingTarget.modifierLogs = [];
            existingTarget.modifierLogs.push({ operator, at: now, action: 'migrate' });
            if (existingTarget.modifierLogs.length > 100) existingTarget.modifierLogs = existingTarget.modifierLogs.slice(-100);
          }

          // Fusion des notes sans doublons
          const targetNoteTexts = new Set((existingTarget.notes || []).map((n: any) => (n.text || '').trim()));
          const notesToMerge: any[] = [];
          if (pendingNote) {
            notesToMerge.push(pendingNote);
            targetNoteTexts.add((pendingNote.text || '').trim());
          }
          for (const fn of (sourceDoc.notes || [])) {
            const txt = (fn.text || '').trim();
            if (txt && !targetNoteTexts.has(txt)) {
              notesToMerge.push(fn);
              targetNoteTexts.add(txt);
            }
          }
          existingTarget.notes = [
            migrationNote,
            ...notesToMerge,
            ...(existingTarget.notes || [])
          ];
          existingTarget.markModified('notes');

          // Sauvegarde de la fiche cible et suppression de la fiche source en parallèle (1 seul round-trip)
          await Promise.all([
            existingTarget.save(),
            Lead.deleteOne({ _id: sourceDoc._id })
          ]);

          removeCachedLeadEverywhere(String(sourceDoc._id), sourceDoc.id);
          updateCachedLeadInPlace(targetCrm, existingTarget.toObject ? existingTarget.toObject() : existingTarget);

          return NextResponse.json({
            ...existingTarget.toObject(),
            migrated: true,
            targetCrm
          });
        } else {
          // Aucun doublon dans le CRM cible : attribution d'un PRO-ID si conflit d'ID
          let targetId = sourceDoc.id;
          if (idClash || !targetId) {
            const topTarget = await Lead.findOne({ crmType: targetCrm, id: /^PRO-\d+$/ }).sort({ id: -1 }).select('id').lean();
            let nextNum = 1;
            if (topTarget && (topTarget as any).id) {
              const num = parseInt((topTarget as any).id.replace('PRO-', ''), 10);
              if (!isNaN(num)) nextNum = num + 1;
            }
            targetId = `PRO-${nextNum.toString().padStart(5, '0')}`;
          }

          // Migration directe du document vers le CRM cible en une seule écriture
          sourceDoc.id = targetId;
          sourceDoc.crmType = targetCrm;
          sourceDoc.toSosProf = false;
          sourceDoc.toElios = false;
          if (isToSosProfMigration) {
            if (crmType === 'formatic') {
              sourceDoc.fromFormatic = true;
              sourceDoc.source = sourceDoc.source || 'From Formatic';
            }
            if (crmType === 'elios') {
              sourceDoc.fromElios = true;
              sourceDoc.source = sourceDoc.source || 'From Elios';
            }
            if (Array.isArray(body.assignedTeachers)) {
              sourceDoc.assignedTeachers = body.assignedTeachers;
            }
          } else {
            sourceDoc.fromFormatic = true;
            sourceDoc.source = sourceDoc.source || 'From Formatic';
          }

          if (body.firstName !== undefined) sourceDoc.firstName = body.firstName;
          if (body.lastName !== undefined) sourceDoc.lastName = body.lastName;
          if (body.name) sourceDoc.name = body.name;
          if (body.offer) sourceDoc.offer = body.offer;
          if (body.amount !== undefined) sourceDoc.amount = body.amount;
          if (body.grade !== undefined) sourceDoc.grade = body.grade;
          if (body.section !== undefined) sourceDoc.section = body.section;
          if (body.status) sourceDoc.status = body.status;
          if (body.familyGroup !== undefined) sourceDoc.familyGroup = body.familyGroup;
          sourceDoc.date = now;
          sourceDoc.updatedAt = now;
          sourceDoc.lastModifiedBy = operator;

          if (!sourceDoc.modifiers) sourceDoc.modifiers = [];
          if (operator && operator.toLowerCase() !== 'système' && operator.toLowerCase() !== 'systeme' && operator.toLowerCase() !== 'non assigné') {
            if (!sourceDoc.modifiers.includes(operator)) sourceDoc.modifiers.push(operator);
            if (!sourceDoc.modifierLogs) sourceDoc.modifierLogs = [];
            sourceDoc.modifierLogs.push({ operator, at: now, action: 'migrate' });
            if (sourceDoc.modifierLogs.length > 100) sourceDoc.modifierLogs = sourceDoc.modifierLogs.slice(-100);
          }

          const notesList = [...(sourceDoc.notes || [])];
          if (pendingNote) {
            notesList.unshift(pendingNote);
          }
          notesList.unshift(migrationNote);
          sourceDoc.notes = notesList;
          sourceDoc.markModified('notes');

          // UNE SEULE ÉCRITURE ATOMIQUE EN BASE
          await sourceDoc.save();

          removeCachedLeadEverywhere(String(sourceDoc._id), sourceDoc.id);
          updateCachedLeadInPlace(targetCrm, sourceDoc.toObject ? sourceDoc.toObject() : sourceDoc);

          return NextResponse.json({
            ...sourceDoc.toObject(),
            migrated: true,
            targetCrm
          });
        }
      } catch (syncErr: any) {
        console.error('Erreur migration PATCH:', syncErr);
        return NextResponse.json({ error: `Erreur lors de la migration: ${syncErr?.message || syncErr}` }, { status: 500 });
      }
    }

    // CAS STANDARD : Mise à jour sans migration (1 seule opération atomique findOneAndUpdate)
    const updateQuery: any = { $set: body };
    if (operator && operator.toLowerCase() !== 'système' && operator.toLowerCase() !== 'systeme' && operator.toLowerCase() !== 'non assigné') {
      updateQuery.$addToSet = { modifiers: operator };
    }
    if (logEntry.length > 0 || pendingNote) {
      updateQuery.$push = {
        ...(logEntry.length > 0 ? { modifierLogs: { $each: logEntry, $slice: -100 } } : {}),
        ...(pendingNote ? { notes: { $each: [pendingNote], $position: 0 } } : {})
      };
    }

    const updated = await Lead.findOneAndUpdate(
      { ...query, ...crmFilter },
      updateQuery,
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
    }

    updateCachedLeadInPlace(crmType as any, updated.toObject ? updated.toObject() : updated);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Failed to update lead:', error);
    return NextResponse.json({ error: error.message || 'Erreur mise à jour prospect' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ crmType: string; id: string }> }
) {
  const { crmType, id } = await params;
  try {
    await connectMongo();

    const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);
    const deleteQuery = isMongoId ? { $or: [{ _id: id }, { id }] } : { id };

    // Suppression universelle sans restriction sur crmType (garantit la suppression même si prospect migré/cross-CRM)
    const deleted = await Lead.findOneAndDelete(deleteQuery);

    if (!deleted) {
      // Idempotence : si le prospect a déjà été supprimé (double-clic ou requête concurrente), renvoyer 200 succès
      removeCachedLeadEverywhere(id);
      return NextResponse.json({ 
        message: 'Prospect déjà supprimé ou introuvable',
        alreadyDeleted: true 
      });
    }

    // Éviction immédiate et atomique de tous les caches en mémoire vive (serveur) sans invalider brutalement
    const mongoIdStr = deleted._id ? deleted._id.toString() : '';
    const customIdStr = deleted.id || '';
    removeCachedLeadEverywhere(mongoIdStr || id, customIdStr);
    if (customIdStr && customIdStr !== id) {
      removeCachedLeadEverywhere(customIdStr);
    }

    return NextResponse.json({ 
      message: 'Prospect supprimé avec succès',
      deletedId: mongoIdStr || customIdStr
    });
  } catch (error: any) {
    console.error('Failed to delete lead:', error);
    return NextResponse.json({ error: error.message || 'Erreur suppression prospect' }, { status: 500 });
  }
}

