export interface Session {
  _id: string;
  sessionId?: string;
  title: string;
  subject: string;
  level: string; // e.g. "Baccalauréat", "3e secondaire", etc.
  section: string; // e.g. "Sciences techniques", "Mathématiques", etc.
  room?: string; // e.g. "Bac / Tech"
  group?: string; // e.g. "Normal Time"
  groupId?: string;
  teacherName: string;
  teacherPhone?: string;
  teacherEmail?: string;
  teacherId?: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate?: string;
  endTime?: string;
  durationMinutes?: number;
  timeZone?: string;
  zoomMeetingId?: string;
  zoomJoinUrl?: string;
  zoomHost?: string;
  zoomProvisioningState?: string;
  state?: 'scheduled' | 'completed' | 'cancelled';
  // Suivi pédagogique et rappels
  remTeacher: boolean; // Rappel WhatsApp envoyé au professeur
  remGroup: boolean; // Rappel WhatsApp envoyé au groupe des élèves
  done: boolean; // Séance effectuée/terminée
  pdf: boolean; // Support de cours PDF reçu/confirmé
  rec: boolean; // Enregistrement vidéo reçu/prêt
  notes?: string;
  // Métadonnées sources brutes préservées (Zero Data Loss)
  rawGrade?: string;
  rawSpec?: string;
  rawSubject?: string;
  rawSubjectId?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Teacher {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  subject?: string;
  externalId?: string;
  active: boolean;
  notes?: string;
  sessionCount?: number;
  missingDocsCount?: number;
  nextSession?: Session | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface SessionStats {
  totalSessions: number;
  completedSessions: number;
  missingDocs: number;
  todayReminders: number;
  monthSessions?: number;
  toCloseSessions?: number;
}
