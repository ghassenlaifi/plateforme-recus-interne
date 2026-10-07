export type User = {
  name: string;
  dot: string;
  bg: string;
  fg: string;
};

export const THEMES: Record<string, { dot: string; bg: string; fg: string; label: string }> = {
  navy:    { label: 'Marine (Officiel)', dot: '#23356E', bg: '#EEF1F7', fg: '#23356E' },
  amber:   { label: 'Ambre (Officiel)', dot: '#F49E1F', bg: '#FFF7ED', fg: '#B45309' },
  olive:   { label: 'Olive (Officiel)', dot: '#7BA25B', bg: '#F3F7F0', fg: '#4D6938' },
  indigo:  { label: 'Indigo', dot: '#3D4E7F', bg: '#EEF1F7', fg: '#23356E' },
  sky:     { label: 'Bleu', dot: '#67759F', bg: '#F0F4FA', fg: '#23356E' },
  rose:    { label: 'Rose', dot: '#F43F5E', bg: '#FFF1F2', fg: '#BE123C' },
  teal:    { label: 'Émeraude', dot: '#92B277', bg: '#F3F7F0', fg: '#3D532C' },
  purple:  { label: 'Violet', dot: '#A855F7', bg: '#FAF5FF', fg: '#7E22CE' },
  gray:    { label: 'Gris', dot: '#6B7280', bg: '#F9FAFB', fg: '#374151' },
  red:     { label: 'Rouge', dot: '#EF4444', bg: '#FEF2F2', fg: '#B91C1C' },
  green:   { label: 'Vert', dot: '#7BA25B', bg: '#F3F7F0', fg: '#4D6938' },
  orange:  { label: 'Orange', dot: '#F49E1F', bg: '#FFF7ED', fg: '#C2410C' },
  cyan:    { label: 'Cyan', dot: '#06B6D4', bg: '#ECFEFF', fg: '#0E7490' },
  fuchsia: { label: 'Fuchsia', dot: '#D946EF', bg: '#FDF4FF', fg: '#A21CAF' },
};

export const getThemeColors = (themeKey: string) => {
  return THEMES[themeKey] || THEMES['gray'];
};

export interface OperatorThemeColors {
  dot: string;
  bg: string;
  fg: string;
  label: string;
}

/**
 * Résolution dynamique de la couleur d'un opérateur :
 * 1. Recherche par nom dans les opérateurs BDD (respecte le thème attribué).
 * 2. Si non trouvé ou nouvel opérateur, calcul déterministe par hachage du nom parmi la palette complète.
 * 3. Gestion élégante des statuts spéciaux ("Système", "Non assigné").
 */
export const getOperatorColors = (
  name?: string | null,
  operatorsList?: Operator[]
): OperatorThemeColors => {
  const clean = (name || '').trim();
  if (!clean || clean.toLowerCase() === 'système' || clean.toLowerCase() === 'systeme') {
    return { dot: '#94a3b8', bg: '#f1f5f9', fg: '#475569', label: 'Système' };
  }
  if (clean.toLowerCase() === 'non assigné' || clean.toLowerCase() === 'non assigne') {
    return { dot: '#a1a1aa', bg: '#f4f4f5', fg: '#71717a', label: 'Non assigné' };
  }

  // 1. Recherche exacte dans les opérateurs enregistrés
  if (Array.isArray(operatorsList) && operatorsList.length > 0) {
    const found = operatorsList.find(o => o.name && o.name.trim().toLowerCase() === clean.toLowerCase());
    if (found && found.theme && THEMES[found.theme]) {
      return THEMES[found.theme];
    }
  }

  // 2. Attribution dynamique et déterministe pour tout nouvel opérateur
  const dynamicKeys = [
    'indigo',
    'rose',
    'sky',
    'amber',
    'teal',
    'purple',
    'green',
    'orange',
    'cyan',
    'fuchsia'
  ];
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const key = dynamicKeys[Math.abs(hash) % dynamicKeys.length];
  return THEMES[key] || THEMES['indigo'];
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
  author?: string;
  date?: string;
  text: string;
  addedBy?: string;
  addedAt?: Date | string;
};

export type Receipt = {
  _id: string; // Identifiant MongoDB
  operatorName: string; // anciennement uploadedBy
  processedBy: string | null;
  processedAt?: string | null;
  lastModifiedBy?: string | null;
  clientDetails: {
    nom?: string;
    telephone: string;
    classe?: string;
    email?: string;
    familyGroup?: string;
  };
  paymentMode?: string;
  paymentDetails?: string;
  paymentDate?: string;
  amount?: number;
  reference?: string;
  notes: Note[];
  gDriveFileId: string;
  gDriveViewUrl: string;
  status: 'PENDING' | 'PROCESSED' | 'ARCHIVED';
  lockedBy?: string | null;
  lockedAt?: string | null;
  createdAt: string; // ISO date string
  updatedAt: string;
};

export * from './session';
