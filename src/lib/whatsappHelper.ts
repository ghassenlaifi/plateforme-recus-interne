import { PaymentMethod } from '@/types/settings';
import { normalizePhoneForUrl } from '@/lib/phoneUtils';

/**
 * Formate les modes de paiement actifs pour WhatsApp selon le standard exact d'Elios Academy
 */
export function formatPaymentMethodsForWhatsApp(methods: PaymentMethod[], lang: 'fr' | 'ar' = 'fr'): string {
  const activeMethods = methods.filter(m => m.enabled);
  if (activeMethods.length === 0) {
    return lang === 'ar' ? 'لا توجد طرق دفع مفعلة حالياً.' : 'Aucun mode de paiement actuellement actif.';
  }

  const sections: string[] = [lang === 'ar' ? 'طرق الدفع المتاحة :' : 'Les différents modes du paiement :'];

  activeMethods.forEach(m => {
    const lines: string[] = [];
    lines.push(`${m.label.trim()} :`);

    if (m.bank && m.bank.trim()) {
      if (m.holder && m.holder.trim()) {
        lines.push(lang === 'ar' ? `الاسم : ${m.holder.trim()}` : `Nom : ${m.holder.trim()}`);
      }
      lines.push(lang === 'ar' ? `البنك : ${m.bank.trim()}` : `Banque : ${m.bank.trim()}`);
      lines.push(lang === 'ar' ? `رقم الحساب (RIB) : ${m.account.trim()}` : `RIB : ${m.account.trim()}`);
    } else if (m.holder && m.holder.trim()) {
      lines.push(lang === 'ar' ? `رقم الحساب (RIB) : ${m.account.trim()}` : `RIB : ${m.account.trim()}`);
      lines.push(lang === 'ar' ? `باسم : ${m.holder.trim()}` : `Au nom de : ${m.holder.trim()}`);
    } else {
      if (m.label.trim().toLowerCase().includes('d17')) {
        // Pour D17 : D17 : 27943859
        lines[0] = `D17 : ${m.account.trim()}`;
      } else {
        lines.push(lang === 'ar' ? `الحساب : ${m.account.trim()}` : `Compte : ${m.account.trim()}`);
      }
    }

    sections.push(lines.join('\n'));
  });

  return sections.join('\n\n');
}

/**
 * Construit le message complet pour le statut Approved Prospect
 */
export function buildApprovedProspectMessage(
  headerTemplate: string,
  footerTemplate: string,
  studentName: string,
  methods: PaymentMethod[],
  lang: 'fr' | 'ar' = 'fr'
): string {
  const name = studentName?.trim() || (lang === 'ar' ? 'عزيزي التلميذ' : 'Cher élève');
  const header = headerTemplate.replace(/\{nom\}/gi, name).replace(/\{prenom\}/gi, name);
  const footer = footerTemplate.replace(/\{nom\}/gi, name).replace(/\{prenom\}/gi, name);
  const methodsText = formatPaymentMethodsForWhatsApp(methods, lang);

  return `${header}\n\n${methodsText}\n${footer}`.trim();
}

/**
 * Construit le message pour le statut N/A
 */
export function buildNaMessage(
  template: string,
  studentName: string,
  lang: 'fr' | 'ar' = 'fr'
): string {
  const name = studentName?.trim() || (lang === 'ar' ? 'عزيزي التلميذ' : 'Cher élève');
  return template.replace(/\{nom\}/gi, name).replace(/\{prenom\}/gi, name).trim();
}

/**
 * Construit le message pour le rappel de séance Groupe Élèves (sans lien Zoom)
 */
export function buildGroupReminderMessage(
  template: string,
  params: {
    matiere?: string;
    niveau?: string;
    heure?: string;
    enseignant?: string;
  }
): string {
  const matiere = params.matiere?.trim() || 'Séance';
  const niveau = params.niveau?.trim() || '';
  const heure = params.heure?.trim() || '18:00';
  const prof = params.enseignant?.trim() || 'Votre enseignant';

  return template
    .replace(/\{matiere\}/gi, matiere)
    .replace(/\{matière\}/gi, matiere)
    .replace(/\{subject\}/gi, matiere)
    .replace(/\{niveau\}/gi, niveau)
    .replace(/\{level\}/gi, niveau)
    .replace(/\{heure\}/gi, heure)
    .replace(/\{time\}/gi, heure)
    .replace(/\{prof\}/gi, prof)
    .replace(/\{enseignant\}/gi, prof)
    .trim();
}

/**
 * Construit le message pour le rappel Enseignant (sans lien Zoom)
 */
export function buildTeacherReminderMessage(
  template: string,
  params: {
    prof?: string;
    matiere?: string;
    niveau?: string;
    heure?: string;
  }
): string {
  const prof = params.prof?.trim() || 'Professeur';
  const matiere = params.matiere?.trim() || 'Séance';
  const niveau = params.niveau?.trim() || '';
  const heure = params.heure?.trim() || '18:00';

  return template
    .replace(/\{prof\}/gi, prof)
    .replace(/\{nom\}/gi, prof)
    .replace(/\{enseignant\}/gi, prof)
    .replace(/\{matiere\}/gi, matiere)
    .replace(/\{matière\}/gi, matiere)
    .replace(/\{subject\}/gi, matiere)
    .replace(/\{niveau\}/gi, niveau)
    .replace(/\{level\}/gi, niveau)
    .replace(/\{heure\}/gi, heure)
    .replace(/\{time\}/gi, heure)
    .trim();
}

/**
 * Nettoie le numéro de téléphone pour WhatsApp (format international compact : 216XXXXXXXX ou 968XXXXXXXX)
 */
export function cleanPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  return normalizePhoneForUrl(phone);
}

// Rétrocompatibilité
export const cleanTunisianPhone = cleanPhoneForWhatsApp;

/**
 * Génère le lien direct pour ouvrir WhatsApp Web ou Mobile
 */
export function getWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = cleanPhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(message);
  if (!cleanPhone) {
    return `https://wa.me/?text=${encodedText}`;
  }
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

