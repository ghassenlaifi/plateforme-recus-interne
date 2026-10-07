import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReceiptImage extends Document {
  fileId: string;
  aliases: string[];
  mimeType: string;
  data: Buffer;
  size: number;
  originalName?: string;
  receiptId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReceiptImageSchema = new Schema<IReceiptImage>(
  {
    fileId: { type: String, required: true, unique: true, index: true },
    aliases: { type: [String], default: [], index: true },
    mimeType: { type: String, required: true, default: 'image/jpeg' },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
    originalName: { type: String, default: '' },
    receiptId: { type: Schema.Types.ObjectId, ref: 'Receipt', required: false, index: true },
  },
  {
    timestamps: true,
  }
);

// Éviter les erreurs d'écrasement de modèle lors du rechargement à chaud Next.js
const ReceiptImage: Model<IReceiptImage> =
  mongoose.models.ReceiptImage || mongoose.model<IReceiptImage>('ReceiptImage', ReceiptImageSchema);

export default ReceiptImage;

