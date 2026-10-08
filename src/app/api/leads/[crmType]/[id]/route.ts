import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Lead from '@/models/Lead';
import { formatPhone } from '@/lib/phoneUtils';
import { isClassWithoutSection } from '@/types/crm';

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
      : { crmType };

    const lead = await Lead.findOne({ ...query, ...crmFilter }).lean();
    if (!lead) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
    }
    return NextResponse.json(lead);
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
    const operator = body.lastModifiedBy || body.operator || body.staff || 'Système';

    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { id };

    const crmFilter = crmType === 'formatic'
      ? { $or: [{ crmType: 'formatic' }, { crmType: 'elios', fromFormatic: true }] }
      : { crmType };

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

      const updateNoteQuery: any = { 
        $push: { notes: { $each: [newNote], $position: 0 } },
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
      return NextResponse.json(updated);
    }

    // Cas 2 : Modification atomique d'une note existante
    if (body.action === 'edit_note' && body.noteId && body.noteText !== undefined) {
      const existing = await Lead.findOne({ ...query, ...crmFilter });
      if (!existing) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
      
      const notes = Array.isArray(existing.notes) ? [...existing.notes] : [];
      const noteIdx = notes.findIndex((n: any) => (n.id === body.noteId || n._id?.toString() === body.noteId));
      if (noteIdx !== -1) {
        const noteAuthor = notes[noteIdx].by || notes[noteIdx].addedBy || '';
        if (noteAuthor && operator && noteAuthor.toLowerCase() !== operator.toLowerCase()) {
          return NextResponse.json({ error: "Seul l'auteur de cette note peut la modifier" }, { status: 403 });
        }
        notes[noteIdx] = {
          ...notes[noteIdx],
          text: body.noteText,
          editedAt: now.toISOString(),
          editedBy: operator,
        };
      }

      existing.notes = notes;
      existing.updatedAt = now;
      existing.lastModifiedBy = operator;
      if (!existing.modifiers) existing.modifiers = [];
      if (operator && operator.toLowerCase() !== 'système' && operator.toLowerCase() !== 'systeme' && operator.toLowerCase() !== 'non assigné' && !existing.modifiers.includes(operator)) {
        existing.modifiers.push(operator);
      }
      await existing.save();

      return NextResponse.json(existing);
    }

    // Cas 3 : Suppression atomique d'une note
    if (body.action === 'delete_note' && body.noteId) {
      const existing = await Lead.findOne({ ...query, ...crmFilter });
      if (!existing) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
      
      const noteToDelete = (existing.notes || []).find((n: any) => n.id === body.noteId || n._id?.toString() === body.noteId);
      if (noteToDelete) {
        const noteAuthor = noteToDelete.by || noteToDelete.addedBy || '';
        if (noteAuthor && operator && noteAuthor.toLowerCase() !== operator.toLowerCase()) {
          return NextResponse.json({ error: "Seul l'auteur de cette note peut la supprimer" }, { status: 403 });
        }
      }

      existing.notes = (existing.notes || []).filter(
        (n: any) => n.id !== body.noteId && n._id?.toString() !== body.noteId
      );
      existing.updatedAt = now;
      existing.lastModifiedBy = operator;
      if (!existing.modifiers) existing.modifiers = [];
      if (operator && operator.toLowerCase() !== 'système' && operator.toLowerCase() !== 'systeme' && operator.toLowerCase() !== 'non assigné' && !existing.modifiers.includes(operator)) {
        existing.modifiers.push(operator);
      }
      await existing.save();

      return NextResponse.json(existing);
    }

    // Cas 4 : Mise à jour globale des informations prospect
    if (body.phone !== undefined) {
      body.phone = formatPhone(body.phone) || body.phone;
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

    // Toute modification met à jour updatedAt et lastModifiedBy (ce qui réinitialise le cycle de Rappels)
    body.updatedAt = now;
    body.lastModifiedBy = operator;

    const updateQuery: any = { $set: body };
    if (operator && operator.toLowerCase() !== 'système' && operator.toLowerCase() !== 'systeme' && operator.toLowerCase() !== 'non assigné') {
      updateQuery.$addToSet = { modifiers: operator };
    }

    const updated = await Lead.findOneAndUpdate(
      { ...query, ...crmFilter },
      updateQuery,
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
    }

    // MIGRATION To Elios : déplace définitivement le prospect de CRM Formatic vers CRM Elios (sans copie ni doublon)
    const isToEliosActive = Boolean(body.toElios !== undefined ? body.toElios : (updated.toElios ?? (updated as any)?._doc?.toElios));
    if (crmType === 'formatic' && isToEliosActive && updated.crmType === 'formatic') {
      try {
        const targetPhone = updated.phone || body.phone;
        const migrationNote = {
          id: `note-from-formatic-${Date.now()}`,
          text: `Prospect migré depuis CRM Formatic par ${operator}`,
          by: operator,
          addedBy: operator,
          date: now.toISOString(),
          addedAt: now
        };

        const existingElios = await Lead.findOne({ crmType: 'elios', phone: targetPhone });
        if (existingElios) {
          // Fusion des données et des notes dans la fiche Elios existante
          existingElios.fromFormatic = true;
          existingElios.firstName = updated.firstName || existingElios.firstName || '';
          existingElios.lastName = updated.lastName || existingElios.lastName || '';
          existingElios.name = updated.name || existingElios.name;
          existingElios.offer = updated.offer || existingElios.offer;
          existingElios.amount = updated.amount || existingElios.amount;
          existingElios.grade = updated.grade || existingElios.grade;
          existingElios.section = updated.section || existingElios.section;
          existingElios.status = updated.status || existingElios.status;
          existingElios.familyGroup = updated.familyGroup || existingElios.familyGroup || '';
          existingElios.updatedAt = now;
          existingElios.lastModifiedBy = operator;
          if (!existingElios.modifiers) existingElios.modifiers = [];
          if (operator && operator.toLowerCase() !== 'système' && operator.toLowerCase() !== 'systeme' && operator.toLowerCase() !== 'non assigné' && !existingElios.modifiers.includes(operator)) {
            existingElios.modifiers.push(operator);
          }

          // Fusion des notes sans doublons
          const eliosNoteTexts = new Set((existingElios.notes || []).map((n: any) => (n.text || '').trim()));
          const notesToMerge: any[] = [];
          for (const fn of (updated.notes || [])) {
            const txt = (fn.text || '').trim();
            if (txt && !eliosNoteTexts.has(txt)) {
              notesToMerge.push(fn);
              eliosNoteTexts.add(txt);
            }
          }
          existingElios.notes = [
            migrationNote,
            ...notesToMerge,
            ...(existingElios.notes || [])
          ];

          await existingElios.save();

          // SUPPRESSION définitive du prospect de CRM Formatic pour garantir zéro doublon
          await Lead.deleteOne({ _id: updated._id });

          return NextResponse.json({
            ...existingElios.toObject(),
            migrated: true,
            targetCrm: 'elios'
          });
        } else {
          // Aucun doublon dans Elios : attribution d'un PRO-ID Elios si conflit d'ID
          let eliosId = updated.id;
          const idClash = await Lead.findOne({ crmType: 'elios', id: eliosId });
          if (idClash || !eliosId) {
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
            eliosId = `PRO-${nextNum.toString().padStart(5, '0')}`;
          }

          // Migration directe du document vers Elios
          updated.id = eliosId;
          updated.crmType = 'elios';
          updated.fromFormatic = true;
          updated.toElios = false;
          updated.source = updated.source || 'From Formatic';
          updated.updatedAt = now;
          updated.lastModifiedBy = operator;
          if (!updated.modifiers) updated.modifiers = [];
          if (operator && operator.toLowerCase() !== 'système' && operator.toLowerCase() !== 'systeme' && operator.toLowerCase() !== 'non assigné' && !updated.modifiers.includes(operator)) {
            updated.modifiers.push(operator);
          }
          updated.notes = [
            migrationNote,
            ...(updated.notes || [])
          ];
          await updated.save();

          return NextResponse.json({
            ...updated.toObject(),
            migrated: true,
            targetCrm: 'elios'
          });
        }
      } catch (syncErr) {
        console.error('Erreur migration PATCH To Elios:', syncErr);
      }
    }

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

    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { id };
    const deleted = await Lead.findOneAndDelete({ ...query, crmType });

    if (!deleted) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Prospect supprimé avec succès' });
  } catch (error: any) {
    console.error('Failed to delete lead:', error);
    return NextResponse.json({ error: error.message || 'Erreur suppression prospect' }, { status: 500 });
  }
}
