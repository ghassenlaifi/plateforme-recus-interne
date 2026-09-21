import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INote {
  text: string;
  addedBy: string;
  addedAt: Date;
}

export interface IReceipt extends Document {
  operatorName: string; // anciennement uploadedBy
  processedBy?: string | null;
  processedAt?: Date | null;
  clientDetails: {
    nom: string;
    telephone: string;
    classe?: string;
    email?: string;
    familyGroup?: string;
  };
  paymentMode?: string;
  paymentDetails?: string;
  paymentDate?: Date;
  amount?: number;
  notes: INote[];
  gDriveFileId: string;
  gDriveViewUrl: string;
  status: 'PENDING' | 'PROCESSED';
  lockedBy?: string | null;
  lockedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>({
  text: { type: String, required: true },
  addedBy: { type: String, required: true },
  addedAt: { type: Date, required: true, default: Date.now },
}, { _id: false });

const ReceiptSchema = new Schema<IReceipt>({
  operatorName: {
    type: String,
    required: true,
  },
  processedBy: {
    type: String,
    default: null,
  },
  processedAt: {
    type: Date,
    default: null,
  },
  clientDetails: {
    nom: { type: String, required: true },
    telephone: { type: String, required: true },
    classe: { type: String, required: false },
    email: { type: String, required: false },
    familyGroup: { type: String, required: false },
  },
  paymentMode: {
    type: String,
    required: false,
  },
  paymentDetails: {
    type: String,
    required: false,
  },
  paymentDate: {
    type: Date,
    required: false,
  },
  amount: {
    type: Number,
    required: false,
  },
  notes: {
    type: [NoteSchema],
    default: [],
  },
  gDriveFileId: {
    type: String,
    required: true,
  },
  gDriveViewUrl: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'PROCESSED'], default: 'PENDING' },
  lockedBy: { type: String, default: null },
  lockedAt: { type: Date, default: null }
}, {
  timestamps: true,
});

// Purge the old model if it exists to avoid overwrite errors during hot-reload
const Receipt: Model<IReceipt> = mongoose.models.Receipt || mongoose.model<IReceipt>('Receipt', ReceiptSchema);

export default Receipt;
