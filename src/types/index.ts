export type User = {
  name: string;
  dot: string;
  bg: string;
  fg: string;
};

export const THEMES: Record<string, { dot: string; bg: string; fg: string; label: string }> = {
  indigo:  { label: 'Indigo', dot: '#6366f1', bg: '#eef2ff', fg: '#4338ca' },
  sky:     { label: 'Bleu', dot: '#0ea5e9', bg: '#f0f9ff', fg: '#0369a1' },
  rose:    { label: 'Rose', dot: '#f43f5e', bg: '#fff1f2', fg: '#be123c' },
  amber:   { label: 'Ambre', dot: '#f59e0b', bg: '#fffbeb', fg: '#b45309' },
  teal:    { label: 'Émeraude', dot: '#14b8a6', bg: '#f0fdfa', fg: '#0f766e' },
  purple:  { label: 'Violet', dot: '#a855f7', bg: '#faf5ff', fg: '#7e22ce' },
  gray:    { label: 'Gris', dot: '#6b7280', bg: '#f9fafb', fg: '#374151' },
  red:     { label: 'Rouge', dot: '#ef4444', bg: '#fef2f2', fg: '#b91c1c' },
  green:   { label: 'Vert', dot: '#22c55e', bg: '#f0fdf4', fg: '#15803d' },
  orange:  { label: 'Orange', dot: '#f97316', bg: '#fff7ed', fg: '#c2410c' },
  cyan:    { label: 'Cyan', dot: '#06b6d4', bg: '#ecfeff', fg: '#0e7490' },
  fuchsia: { label: 'Fuchsia', dot: '#d946ef', bg: '#fdf4ff', fg: '#a21caf' },
};

export const getThemeColors = (themeKey: string) => {
  return THEMES[themeKey] || THEMES['gray'];
};

// Fallback for old receipts that don't match any dynamic operator
export const FALLBACK_USER = { name: 'Inconnu', ...THEMES['gray'] };

export type Operator = {
  _id: string;
  name: string;
  theme: string;
  createdAt: string;
};

export type Note = {
  author: string;
  date: string;
  text: string;
  addedBy: string; // From the backend INote schema
  addedAt: Date | string; // From the backend INote schema
};

export type Receipt = {
  _id: string; // Identifiant MongoDB
  operatorName: string; // anciennement uploadedBy
  processedBy: string | null;
  processedAt?: string | null;
  clientDetails: {
    nom: string;
    telephone: string;
    classe?: string;
    email?: string;
    familyGroup?: string;
  };
  paymentMode?: string;
  paymentDetails?: string;
  paymentDate?: string;
  notes: Note[];
  gDriveFileId: string;
  gDriveViewUrl: string;
  status: 'PENDING' | 'PROCESSED';
  lockedBy?: string | null;
  lockedAt?: string | null;
  createdAt: string; // ISO date string
  updatedAt: string;
};
