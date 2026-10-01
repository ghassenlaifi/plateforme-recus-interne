import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema({
  id: { type: String, required: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  offer: { type: String, default: 'Zero to Hero' },
  amount: { type: String, default: '' },
  source: { type: String, default: 'Facebook' },
  grade: { type: String, default: '' },
  section: { type: String, default: '' },
  status: { type: String, default: 'Lead' },
  staff: { type: String, default: 'Système' },
  date: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastModifiedBy: { type: String, default: 'Système' },
  notes: { type: Array, default: [] },
  familyGroup: { type: String, default: '' },
  toElios: { type: Boolean, default: false },
  fromFormatic: { type: Boolean, default: false },
  crmType: { type: String, enum: ['elios', 'formatic'], required: true },
});

// Indexes for ultra-fast query performance and robust lookups
LeadSchema.index({ phone: 1, crmType: 1 }, { unique: false });
LeadSchema.index({ crmType: 1, status: 1 });
LeadSchema.index({ crmType: 1, toElios: 1 });
LeadSchema.index({ crmType: 1, fromFormatic: 1 });
LeadSchema.index({ crmType: 1, updatedAt: -1 });
LeadSchema.index({ crmType: 1, date: -1 });
LeadSchema.index({ id: 1, crmType: 1 });
LeadSchema.index({ phone: 1 });

// Ensure in-memory cached model has new fields during dev reload
if (mongoose.models.Lead) {
  if (!mongoose.models.Lead.schema.path('amount')) {
    mongoose.models.Lead.schema.add({ amount: { type: String, default: '' } });
  }
  if (!mongoose.models.Lead.schema.path('firstName')) {
    mongoose.models.Lead.schema.add({ firstName: { type: String, default: '' } });
  }
  if (!mongoose.models.Lead.schema.path('lastName')) {
    mongoose.models.Lead.schema.add({ lastName: { type: String, default: '' } });
  }
  if (!mongoose.models.Lead.schema.path('familyGroup')) {
    mongoose.models.Lead.schema.add({ familyGroup: { type: String, default: '' } });
  }
  if (!mongoose.models.Lead.schema.path('toElios')) {
    mongoose.models.Lead.schema.add({ toElios: { type: Boolean, default: false } });
  }
  if (!mongoose.models.Lead.schema.path('fromFormatic')) {
    mongoose.models.Lead.schema.add({ fromFormatic: { type: Boolean, default: false } });
  }
  if (!mongoose.models.Lead.schema.path('updatedAt')) {
    mongoose.models.Lead.schema.add({ updatedAt: { type: Date, default: Date.now } });
  }
  if (!mongoose.models.Lead.schema.path('lastModifiedBy')) {
    mongoose.models.Lead.schema.add({ lastModifiedBy: { type: String, default: 'Système' } });
  }
}

export default mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
