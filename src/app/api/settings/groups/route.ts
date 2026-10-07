import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import CommunicationGroupModel from '@/models/CommunicationGroup';
import { normalizeWhatsappLink } from '@/lib/communicationGroupHelper';
import { ensureCommunicationGroupsSeeded, resetCommunicationGroupsToDefault } from '@/lib/communicationGroupServer';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET() {
  try {
    await connectToDatabase();
    await ensureCommunicationGroupsSeeded();

    const groups = await CommunicationGroupModel.find({}).sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json({ groups }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching communication groups:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    // Cas 1 : Réinitialisation aux valeurs d'usine / par défaut
    if (body.action === 'reset_defaults') {
      await resetCommunicationGroupsToDefault();
      const defaultGroups = await CommunicationGroupModel.find({}).sort({ order: 1, createdAt: 1 }).lean();
      return NextResponse.json({ success: true, groups: defaultGroups }, { status: 200 });
    }

    // Cas 2 : Suppression d'un groupe via POST
    if (body.action === 'delete') {
      const identifier = body.id || body._id || body.code;
      if (!identifier) {
        return NextResponse.json({ error: 'Identifiant du groupe manquant' }, { status: 400 });
      }
      const query = identifier.match(/^[0-9a-fA-F]{24}$/) ? { _id: identifier } : { code: identifier };
      const deleted = await CommunicationGroupModel.findOneAndDelete(query);
      if (!deleted) {
        return NextResponse.json({ error: 'Groupe introuvable' }, { status: 404 });
      }
      const remainingGroups = await CommunicationGroupModel.find({}).sort({ order: 1, createdAt: 1 }).lean();
      return NextResponse.json({ success: true, message: 'Groupe supprimé avec succès', groups: remainingGroups }, { status: 200 });
    }

    // Cas 3 : Mise à jour par lot (bulk update de liens / statuts d'une liste)
    if (Array.isArray(body.groups)) {
      for (const item of body.groups) {
        if (!item._id && !item.code) continue;
        const query = item._id ? { _id: item._id } : { code: item.code };
        const updateData: any = {};
        if (item.whatsappLink !== undefined) {
          updateData.whatsappLink = normalizeWhatsappLink(item.whatsappLink);
        }
        if (item.description !== undefined) {
          updateData.description = String(item.description).trim();
        }
        if (typeof item.active === 'boolean') {
          updateData.active = item.active;
        }

        await CommunicationGroupModel.findOneAndUpdate(query, { $set: updateData });
      }

      const updatedGroups = await CommunicationGroupModel.find({}).sort({ order: 1, createdAt: 1 }).lean();
      return NextResponse.json({ success: true, groups: updatedGroups }, { status: 200 });
    }

    // Cas 4 : Création d'un NOUVEAU groupe (CRUD - Create)
    if (body.action === 'create' || (!body.id && !body._id && !body.code && body.name)) {
      const name = String(body.name || '').trim();
      if (!name) {
        return NextResponse.json({ error: 'Le nom du groupe est obligatoire' }, { status: 400 });
      }

      const level = String(body.level || '').trim();
      if (!level) {
        return NextResponse.json({ error: 'Le niveau est obligatoire' }, { status: 400 });
      }

      const section = String(body.section || 'Sans section').trim();
      const category = String(body.category || 'Lycée').trim();

      // Vérifier unicité du nom (insensible à la casse)
      const existingName = await CommunicationGroupModel.findOne({
        name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (existingName) {
        return NextResponse.json({ error: `Un groupe portant le nom « ${name} » existe déjà` }, { status: 409 });
      }

      // Générer un slug unique
      let baseCode = body.code ? slugify(String(body.code)) : slugify(name);
      if (!baseCode) baseCode = 'groupe';

      let uniqueCode = baseCode;
      let counter = 1;
      while (await CommunicationGroupModel.findOne({ code: uniqueCode })) {
        uniqueCode = `${baseCode}-${counter}`;
        counter++;
      }

      const count = await CommunicationGroupModel.countDocuments();
      const order = typeof body.order === 'number' ? body.order : count + 1;

      const newGroup = await CommunicationGroupModel.create({
        name,
        code: uniqueCode,
        level,
        section,
        category,
        whatsappLink: normalizeWhatsappLink(body.whatsappLink || ''),
        description: String(body.description || '').trim(),
        active: body.active !== undefined ? Boolean(body.active) : true,
        order,
      });

      const allGroups = await CommunicationGroupModel.find({}).sort({ order: 1, createdAt: 1 }).lean();
      return NextResponse.json({
        success: true,
        message: 'Groupe créé avec succès',
        group: newGroup,
        groups: allGroups
      }, { status: 201 });
    }

    // Cas 5 : Mise à jour individuelle d'un groupe existant
    const identifier = body.id || body._id || body.code;
    if (!identifier) {
      return NextResponse.json({ error: 'Identifiant du groupe manquant' }, { status: 400 });
    }

    const query = identifier.match(/^[0-9a-fA-F]{24}$/) ? { _id: identifier } : { code: identifier };
    const updateData: any = {};

    if (body.name !== undefined) {
      const newName = String(body.name).trim();
      if (!newName) {
        return NextResponse.json({ error: 'Le nom du groupe ne peut pas être vide' }, { status: 400 });
      }
      // Vérifier si un autre groupe a déjà ce nom
      const duplicate = await CommunicationGroupModel.findOne({
        _id: { $ne: query._id },
        code: { $ne: query.code },
        name: { $regex: new RegExp(`^${newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (duplicate) {
        return NextResponse.json({ error: `Un autre groupe porte déjà le nom « ${newName} »` }, { status: 409 });
      }
      updateData.name = newName;
    }

    if (body.level !== undefined) updateData.level = String(body.level).trim();
    if (body.section !== undefined) updateData.section = String(body.section).trim();
    if (body.category !== undefined) updateData.category = String(body.category).trim();
    if (body.whatsappLink !== undefined) updateData.whatsappLink = normalizeWhatsappLink(body.whatsappLink);
    if (body.description !== undefined) updateData.description = String(body.description).trim();
    if (typeof body.active === 'boolean') updateData.active = body.active;
    if (typeof body.order === 'number') updateData.order = body.order;

    const updated = await CommunicationGroupModel.findOneAndUpdate(query, { $set: updateData }, { new: true });
    if (!updated) {
      return NextResponse.json({ error: 'Groupe introuvable' }, { status: 404 });
    }

    const allGroups = await CommunicationGroupModel.find({}).sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json({ success: true, group: updated, groups: allGroups }, { status: 200 });
  } catch (error: any) {
    console.error('Error in communication groups route:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors du traitement de la requête' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Paramètre id manquant' }, { status: 400 });
    }

    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { code: id };
    const deleted = await CommunicationGroupModel.findOneAndDelete(query);
    if (!deleted) {
      return NextResponse.json({ error: 'Groupe introuvable' }, { status: 404 });
    }

    const remainingGroups = await CommunicationGroupModel.find({}).sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json({ success: true, message: 'Groupe supprimé avec succès', groups: remainingGroups }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting communication group:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la suppression' }, { status: 500 });
  }
}
