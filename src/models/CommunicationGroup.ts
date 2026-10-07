import mongoose, { Schema, Document, Model } from 'mongoose';
import { CommunicationGroup as ICommunicationGroupData } from '@/types/communicationGroup';

export interface ICommunicationGroup extends Omit<ICommunicationGroupData, '_id'>, Document {}

const CommunicationGroupSchema = new Schema<ICommunicationGroup>(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    code: { type: String, required: true, unique: true, trim: true, index: true },
    level: { type: String, required: true, trim: true, index: true },
    section: { type: String, required: true, trim: true },
    whatsappLink: { type: String, default: '', trim: true },
    category: {
      type: String,
      default: 'Lycée',
      trim: true,
    },
    description: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'communication_groups',
  }
);

const CommunicationGroup: Model<ICommunicationGroup> =
  mongoose.models.CommunicationGroup ||
  mongoose.model<ICommunicationGroup>('CommunicationGroup', CommunicationGroupSchema);

export default CommunicationGroup;

