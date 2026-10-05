import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Lead from '@/models/Lead';

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

      const updated = await Lead.findOneAndUpdate(
        { ...query, crmType },
        { 
          $push: { notes: { $each: [newNote], $position: 0 } },
          $set: { updatedAt: now, lastModifiedBy: operator }
        },
        { new: true }
      );

      if (!updated) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
      return NextResponse.json(updated);
    }

    // Cas 2 : Modification atomique d'une note existante
    if (body.action === 'edit_note' && body.noteId && body.noteText !== undefined) {
      const existing = await Lead.findOne({ ...query, crmType });
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
      await existing.save();

      return NextResponse.json(existing);
    }

    // Cas 3 : Suppression atomique d'une note
    if (body.action === 'delete_note' && body.noteId) {
      const existing = await Lead.findOne({ ...query, crmType });
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
      await existing.save();

      return NextResponse.json(existing);
    }

    // Cas 4 : Mise à jour globale des informations prospect
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

    // Toute modification met à jour updatedAt et lastModifiedBy (ce qui réinitialise le cycle de Rappels)
    body.updatedAt = now;
    body.lastModifiedBy = operator;

    const updated = await Lead.findOneAndUpdate(
      { ...query, crmType },
      { $set: body },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
    }

    // Si prospect Formatic avec toElios activé : synchroniser / copier vers Elios avec étiquette From Formatic
    const isToEliosActive = Boolean(body.toElios !== undefined ? body.toElios : (updated.toElios ?? (updated as any)?._doc?.toElios));
    if (crmType === 'formatic' && isToEliosActive) {
      try {
        const targetPhone = updated.phone || body.phone;
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
            firstName: updated.firstName || '',
            lastName: updated.lastName || '',
            name: updated.name || 'Prospect sans nom',
            phone: updated.phone,
            offer: updated.offer || 'Zero to Hero',
            amount: updated.amount || '',
            source: 'From Formatic',
            grade: updated.grade || '',
            section: updated.section || '',
            status: updated.status || 'Lead',
            staff: updated.staff || 'Système',
            crmType: 'elios',
            familyGroup: updated.familyGroup || '',
            date: updated.date || now,
            updatedAt: now,
            lastModifiedBy: operator,
            fromFormatic: true,
            notes: [
              ...(updated.notes || []),
              {
                id: `note-from-formatic-${Date.now()}`,
                text: `Prospect copié depuis CRM Formatic par ${operator}`,
                by: operator,
                addedBy: operator,
                date: now.toISOString(),
                addedAt: now
              }
            ]
          });
        }
      } catch (syncErr) {
        console.error('Erreur synchronisation PATCH To Elios:', syncErr);
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
