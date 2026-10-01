import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITaskNote {
  _id?: string;
  author: string;
  text: string;
  createdAt: Date;
}

export interface ITask extends Document {
  title: string;
  assignedTo: string[];
  category: 'Commercial' | 'Finance' | 'Pédagogie' | 'Général';
  priority: 'Haute' | 'Normale' | 'Basse';
  dueDate: string;
  completed: boolean;
  completedAt?: Date | null;
  completedBy?: string | null;
  notes: ITaskNote[];
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema({
  author: { type: String, required: true, trim: true },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

const TaskSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    assignedTo: {
      type: Schema.Types.Mixed,
      required: true,
      default: ['Ghassen'],
    },
    category: { 
      type: String, 
      enum: ['Commercial', 'Finance', 'Pédagogie', 'Général'], 
      default: 'Commercial' 
    },
    priority: { 
      type: String, 
      enum: ['Haute', 'Normale', 'Basse'], 
      default: 'Haute' 
    },
    dueDate: { type: String, default: 'Cette semaine' },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    completedBy: { type: String, default: null },
    notes: { type: [NoteSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

if (mongoose.models && mongoose.models.Task) {
  delete (mongoose.models as any).Task;
}

export const Task: Model<ITask> = 
  mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);

