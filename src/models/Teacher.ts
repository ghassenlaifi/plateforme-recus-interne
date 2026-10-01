import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITeacher extends Document {
  name: string;
  phone?: string;
  email?: string;
  subject?: string;
  externalId?: string;
  active: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherSchema = new Schema<ITeacher>({
  name: { type: String, required: true, trim: true, index: true },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true, lowercase: true },
  subject: { type: String, default: '', trim: true },
  externalId: { type: String, default: '', sparse: true },
  active: { type: Boolean, default: true },
  notes: { type: String, default: '' },
}, {
  timestamps: true,
});

const Teacher: Model<ITeacher> = mongoose.models.Teacher || mongoose.model<ITeacher>('Teacher', TeacherSchema);

export default Teacher;
