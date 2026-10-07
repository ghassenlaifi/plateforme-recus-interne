/**
 * Modèle et définitions des Groupes de Communication WhatsApp avec les Élèves.
 * Standardisés et synchronisés avec le module Gestion des Séances (Niveau & Section).
 */

export interface CommunicationGroup {
  _id?: string;
  name: string;
  code: string;
  level: string;
  section: string;
  whatsappLink: string;
  category: 'Collège' | 'Lycée' | 'Formatic' | 'Autre' | string;
  description?: string;
  active: boolean;
  order: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type CreateCommunicationGroupInput = {
  name: string;
  code?: string;
  level: string;
  section: string;
  whatsappLink?: string;
  category?: 'Collège' | 'Lycée' | 'Formatic' | 'Autre' | string;
  description?: string;
  active?: boolean;
  order?: number;
};

export type UpdateCommunicationGroupInput = Partial<CreateCommunicationGroupInput>;

export const DEFAULT_COMMUNICATION_GROUPS: Omit<CommunicationGroup, '_id' | 'createdAt' | 'updatedAt'>[] = [
  // Collège (Tronc commun)
  {
    name: 'Groupe 7ème de Base',
    code: 'groupe-7eme-de-base',
    level: '7ème de Base',
    section: 'Sans section',
    category: 'Collège',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves de 7ème Année de Base',
    active: true,
    order: 1,
  },
  {
    name: 'Groupe 8ème de Base',
    code: 'groupe-8eme-de-base',
    level: '8ème de Base',
    section: 'Sans section',
    category: 'Collège',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves de 8ème Année de Base',
    active: true,
    order: 2,
  },
  {
    name: 'Groupe 9ème de Base',
    code: 'groupe-9eme-de-base',
    level: '9ème de Base',
    section: 'Sans section',
    category: 'Collège',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves de 9ème Année de Base',
    active: true,
    order: 3,
  },

  // Lycée - 1ère Année
  {
    name: 'Groupe 1ère Année',
    code: 'groupe-1ere-annee',
    level: '1ère Année',
    section: 'Sans section',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves de 1ère Année Secondaire (Tronc commun)',
    active: true,
    order: 4,
  },

  // Lycée - 2ème Année (3 sections)
  {
    name: 'Groupe 2ème Année Science',
    code: 'groupe-2eme-annee-science',
    level: '2ème Année',
    section: 'Science',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves de 2ème Année Sciences',
    active: true,
    order: 5,
  },
  {
    name: 'Groupe 2ème Année Informatique',
    code: 'groupe-2eme-annee-informatique',
    level: '2ème Année',
    section: 'Informatique',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves de 2ème Année Informatique',
    active: true,
    order: 6,
  },
  {
    name: 'Groupe 2ème Année Économie',
    code: 'groupe-2eme-annee-economie',
    level: '2ème Année',
    section: 'Économie',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves de 2ème Année Économie & Services',
    active: true,
    order: 7,
  },

  // Lycée - 3ème Année (6 sections)
  {
    name: 'Groupe 3ème Année Science',
    code: 'groupe-3eme-annee-science',
    level: '3ème Année',
    section: 'Science',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves de 3ème Année Sciences Expérimentales',
    active: true,
    order: 8,
  },
  {
    name: 'Groupe 3ème Année Mathématiques',
    code: 'groupe-3eme-annee-mathematiques',
    level: '3ème Année',
    section: 'Mathématiques',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves de 3ème Année Mathématiques',
    active: true,
    order: 9,
  },
  {
    name: 'Groupe 3ème Année Informatique',
    code: 'groupe-3eme-annee-informatique',
    level: '3ème Année',
    section: 'Informatique',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves de 3ème Année Sciences de l’Informatique',
    active: true,
    order: 10,
  },
  {
    name: 'Groupe 3ème Année Technique',
    code: 'groupe-3eme-annee-technique',
    level: '3ème Année',
    section: 'Technique',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves de 3ème Année Sciences Techniques',
    active: true,
    order: 11,
  },
  {
    name: 'Groupe 3ème Année Économie',
    code: 'groupe-3eme-annee-economie',
    level: '3ème Année',
    section: 'Économie',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves de 3ème Année Économie & Gestion',
    active: true,
    order: 12,
  },
  {
    name: 'Groupe 3ème Année Lettres',
    code: 'groupe-3eme-annee-lettres',
    level: '3ème Année',
    section: 'Lettres',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves de 3ème Année Lettres',
    active: true,
    order: 13,
  },

  // Lycée - BAC (5 sections)
  {
    name: 'Groupe BAC Science',
    code: 'groupe-bac-science',
    level: 'BAC',
    section: 'Science',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves du BAC Sciences Expérimentales',
    active: true,
    order: 14,
  },
  {
    name: 'Groupe BAC Mathématiques',
    code: 'groupe-bac-mathematiques',
    level: 'BAC',
    section: 'Mathématiques',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves du BAC Mathématiques',
    active: true,
    order: 15,
  },
  {
    name: 'Groupe BAC Technique',
    code: 'groupe-bac-technique',
    level: 'BAC',
    section: 'Technique',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves du BAC Sciences Techniques',
    active: true,
    order: 16,
  },
  {
    name: 'Groupe BAC Informatique',
    code: 'groupe-bac-informatique',
    level: 'BAC',
    section: 'Informatique',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves du BAC Sciences de l’Informatique',
    active: true,
    order: 17,
  },
  {
    name: 'Groupe BAC Économie',
    code: 'groupe-bac-economie',
    level: 'BAC',
    section: 'Économie',
    category: 'Lycée',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel des élèves du BAC Économie & Gestion',
    active: true,
    order: 18,
  },

  // Formatic
  {
    name: 'Groupe Formatic',
    code: 'groupe-formatic',
    level: 'Formatic',
    section: 'Toutes sections',
    category: 'Formatic',
    whatsappLink: '',
    description: 'Groupe WhatsApp officiel pour les séances et élèves Formatic',
    active: true,
    order: 19,
  },
];

