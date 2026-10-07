import { DEFAULT_COMMUNICATION_GROUPS, CommunicationGroup } from '@/types/communicationGroup';

/**
 * Normalise une chaîne de caractères pour faciliter la recherche et la comparaison (sans accents, minuscules).
 */
export function normalizeKey(str?: string | null): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Nettoie et normalise un lien de groupe WhatsApp.
 * Si l'utilisateur colle "chat.whatsapp.com/XYZ", ajoute automatiquement "https://".
 */
export function normalizeWhatsappLink(raw?: string | null): string {
  if (!raw) return '';
  let url = raw.trim();
  if (!url) return '';

  if (url.startsWith('chat.whatsapp.com/')) {
    url = `https://${url}`;
  } else if (url.startsWith('http://chat.whatsapp.com/')) {
    url = url.replace('http://', 'https://');
  }

  return url;
}

/**
 * Résout avec une rigueur absolue le Nom du Groupe de Communication WhatsApp
 * associé à une séance en fonction de son Niveau, de sa Section et de ses métadonnées.
 */
export function resolveCommunicationGroupName(session?: {
  level?: string;
  section?: string;
  title?: string;
  group?: string;
  subject?: string;
}): string {
  if (!session) return 'Groupe BAC Science';

  const l = normalizeKey(session.level);
  const s = normalizeKey(session.section);
  const t = normalizeKey(session.title);
  const g = normalizeKey(session.group);

  // 1. Détection Formatic prioritaire (titre, groupe ou niveau Formatic)
  if (t.includes('formatic') || g.includes('formatic') || l.includes('formatic')) {
    return 'Groupe Formatic';
  }

  // 2. Collège : 7ème, 8ème, 9ème de Base
  if (l.includes('7eme') || l.includes('7e') || l.includes('7')) {
    return 'Groupe 7ème de Base';
  }
  if (l.includes('8eme') || l.includes('8e') || l.includes('8')) {
    return 'Groupe 8ème de Base';
  }
  if (l.includes('9eme') || l.includes('9e') || l.includes('9')) {
    return 'Groupe 9ème de Base';
  }

  // 3. Lycée : 1ère Année (Tronc commun)
  if (l.includes('1ere') || l.includes('1er') || l === '1' || l.includes('1ere annee')) {
    return 'Groupe 1ère Année';
  }

  // 4. Lycée : 2ème Année (Science, Informatique, Économie)
  if (l.includes('2eme') || l.includes('2e') || l.includes('2')) {
    if (s.includes('info')) return 'Groupe 2ème Année Informatique';
    if (s.includes('eco')) return 'Groupe 2ème Année Économie';
    return 'Groupe 2ème Année Science';
  }

  // 5. Lycée : 3ème Année (Science, Mathématiques, Informatique, Technique, Économie, Lettres)
  if (l.includes('3eme') || l.includes('3e') || l.includes('3')) {
    if (s.includes('math')) return 'Groupe 3ème Année Mathématiques';
    if (s.includes('info')) return 'Groupe 3ème Année Informatique';
    if (s.includes('tech')) return 'Groupe 3ème Année Technique';
    if (s.includes('eco')) return 'Groupe 3ème Année Économie';
    if (s.includes('lettre')) return 'Groupe 3ème Année Lettres';
    return 'Groupe 3ème Année Science';
  }

  // 6. Lycée : BAC (Science, Mathématiques, Technique, Informatique, Économie)
  if (l.includes('bac') || l.includes('terminale') || l.includes('4eme')) {
    if (s.includes('math')) return 'Groupe BAC Mathématiques';
    if (s.includes('tech')) return 'Groupe BAC Technique';
    if (s.includes('info')) return 'Groupe BAC Informatique';
    if (s.includes('eco')) return 'Groupe BAC Économie';
    return 'Groupe BAC Science';
  }

  // Fallback universel sécurisé
  return 'Groupe BAC Science';
}

/**
 * Retourne le code slug du groupe de communication pour une séance.
 */
export function getCommunicationGroupCode(session?: {
  level?: string;
  section?: string;
  title?: string;
  group?: string;
  subject?: string;
}): string {
  const name = resolveCommunicationGroupName(session);
  const found = DEFAULT_COMMUNICATION_GROUPS.find((g) => g.name === name);
  return found ? found.code : 'groupe-bac-science';
}

/**
 * Résout le groupe de communication complet depuis la liste synchronisée en base,
 * avec repli sur les définitions par défaut si nécessaire.
 */
export function resolveCommunicationGroup(
  session?: {
    level?: string;
    section?: string;
    title?: string;
    group?: string;
    subject?: string;
  },
  groups?: CommunicationGroup[]
): CommunicationGroup {
  if (groups && groups.length > 0 && session) {
    const sLevel = normalizeKey(session.level);
    const sSection = normalizeKey(session.section);
    if (sLevel) {
      const match = groups.find((g) => 
        normalizeKey(g.level) === sLevel && 
        (sSection && normalizeKey(g.section) !== 'sans section' ? normalizeKey(g.section) === sSection : true)
      );
      if (match) return match;
    }
    const code = getCommunicationGroupCode(session);
    const found = groups.find((g) => g.code === code);
    if (found) return found;
  }
  const code = getCommunicationGroupCode(session);
  const defaultDef = DEFAULT_COMMUNICATION_GROUPS.find((g) => g.code === code);
  return (
    defaultDef || {
      code: 'groupe-bac-science',
      name: 'Groupe BAC Science',
      level: 'BAC',
      section: 'Sciences Expérimentales',
      category: 'Lycée',
      order: 14,
      whatsappLink: '',
      active: true,
    }
  );
}

