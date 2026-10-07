import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import CommunicationGroupModel from '@/models/CommunicationGroup';
import { normalizeWhatsappLink } from '@/lib/communicationGroupHelper';

type Params = { id: string };

export async function GET(req: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id } = await Promise.resolve(params);
    await connectToDatabase();

    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { code: id };
    const group = await CommunicationGroupModel.findOne(query).lean();

    if (!group) {
      return NextResponse.json({ error: 'Groupe introuvable' }, { status: 404 });
    }

    return NextResponse.json({ group }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching communication group by id:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id } = await Promise.resolve(params);
    const body = await req.json();

    await connectToDatabase();

    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { code: id };
    const updateData: any = {};

    if (body.name !== undefined) {
      const newName = String(body.name).trim();
      if (!newName) {
        return NextResponse.json({ error: 'Le nom du groupe ne peut pas être vide' }, { status: 400 });
      }
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
    console.error('Error updating communication group by id:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id } = await Promise.resolve(params);
    await connectToDatabase();

    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { code: id };
    const deleted = await CommunicationGroupModel.findOneAndDelete(query);

    if (!deleted) {
      return NextResponse.json({ error: 'Groupe introuvable' }, { status: 404 });
    }

    const remainingGroups = await CommunicationGroupModel.find({}).sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json({ success: true, message: 'Groupe supprimé avec succès', groups: remainingGroups }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting communication group by id:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la suppression' }, { status: 500 });
  }
}
