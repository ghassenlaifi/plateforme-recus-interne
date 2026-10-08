import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWhipEvent extends Document {
  taskId: string;
  taskTitle: string;
  triggeredBy: string;
  targetOperators: string[];
  message: string;
  createdAt: Date;
}

const WhipEventSchema: Schema = new Schema(
  {
    taskId: { type: String, required: true },
    taskTitle: { type: String, required: true, trim: true },
    triggeredBy: { type: String, required: true, trim: true },
    targetOperators: { 
      type: [String], 
      required: true, 
      default: [] 
    },
    message: { 
      type: String, 
      required: false, 
      trim: true, 
      maxlength: 200,
      default: '' 
    },
    createdAt: { 
      type: Date, 
      default: Date.now, 
      index: { expires: 300 } // Auto-suppression après 5 minutes via MongoDB TTL
    },
  },
  {
    timestamps: false,
  }
);

if (mongoose.models && mongoose.models.WhipEvent) {
  delete (mongoose.models as any).WhipEvent;
}

export const WhipEvent: Model<IWhipEvent> = 
  mongoose.models.WhipEvent || mongoose.model<IWhipEvent>('WhipEvent', WhipEventSchema);

