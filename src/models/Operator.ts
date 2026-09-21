import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOperator extends Document {
  name: string;
  theme: string;
  createdAt: Date;
  updatedAt: Date;
}

const OperatorSchema = new Schema<IOperator>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  theme: {
    type: String,
    required: true,
    default: 'gray',
  },
}, {
  timestamps: true,
});

const Operator: Model<IOperator> = mongoose.models.Operator || mongoose.model<IOperator>('Operator', OperatorSchema);

export default Operator;

