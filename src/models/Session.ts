import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISession extends Document {
  sessionId?: string;
  title: string;
  subject: string;
  level: string;
  section: string;
  room?: string;
  group?: string;
  groupId?: string;
  teacherName: string;
  teacherPhone?: string;
  teacherEmail?: string;
  teacherId?: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate?: string;
  endTime?: string;
  durationMinutes: number;
  timeZone: string;
  zoomMeetingId?: string;
  zoomJoinUrl?: string;
  zoomHost?: string;
  zoomProvisioningState?: string;
  state: 'scheduled' | 'completed' | 'cancelled';
  remTeacher: boolean;
  remGroup: boolean;
  done: boolean;
  pdf: boolean;
  rec: boolean;
  notes?: string;
  rawGrade?: string;
  rawSpec?: string;
  rawSubject?: string;
  rawSubjectId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>({
  sessionId: { type: String, sparse: true, index: true },
  title: { type: String, required: true, trim: true },
  subject: { type: String, required: true, trim: true, index: true },
  level: { type: String, required: true, trim: true, index: true },
  section: { type: String, default: 'Sans section', trim: true },
  room: { type: String, default: '' },
  group: { type: String, default: 'Normal Time' },
  groupId: { type: String, default: '' },
  teacherName: { type: String, required: true, trim: true, index: true },
  teacherPhone: { type: String, default: '', trim: true },
  teacherEmail: { type: String, default: '', trim: true },
  teacherId: { type: String, default: '' },
  startDate: { type: String, required: true, index: true },
  startTime: { type: String, required: true },
  endDate: { type: String, default: '' },
  endTime: { type: String, default: '' },
  durationMinutes: { type: Number, default: 90 },
  timeZone: { type: String, default: 'Africa/Tunis' },
  zoomMeetingId: { type: String, default: '' },
  zoomJoinUrl: { type: String, default: '' },
  zoomHost: { type: String, default: '' },
  zoomProvisioningState: { type: String, default: 'ready' },
  state: { type: String, default: 'scheduled', index: true },
  remTeacher: { type: Boolean, default: false },
  remGroup: { type: Boolean, default: false },
  done: { type: Boolean, default: false, index: true },
  pdf: { type: Boolean, default: false },
  rec: { type: Boolean, default: false },
  notes: { type: String, default: '' },
  rawGrade: { type: String, default: '' },
  rawSpec: { type: String, default: '' },
  rawSubject: { type: String, default: '' },
  rawSubjectId: { type: String, default: '' },
}, {
  timestamps: true,
});

const Session: Model<ISession> = mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);

export default Session;
