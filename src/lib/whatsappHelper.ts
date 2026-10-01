import { PaymentMethod } from '@/types/settings';

/**
 * Formate les modes de paiement actifs pour WhatsApp selon le standard exact d'Elios Academy
 */
export function formatPaymentMethodsForWhatsApp(methods: PaymentMethod[]): string {
  const activeMethods = methods.filter(m => m.enabled);
  if (activeMethods.length === 0) {
    return "Aucun mode de paiement actuellement actif.";
  }

  const sections: string[] = ['Les différents modes du paiement :'];

  activeMethods.forEach(m => {
    const lines: string[] = [];
    lines.push(`${m.label.trim()} :`);

    if (m.bank && m.bank.trim()) {
      if (m.holder && m.holder.trim()) {
        lines.push(`Nom : ${m.holder.trim()}`);
      }
      lines.push(`Banque : ${m.bank.trim()}`);
      lines.push(`RIB : ${m.account.trim()}`);
    } else if (m.holder && m.holder.trim()) {
      lines.push(`RIB : ${m.account.trim()}`);
      lines.push(`Au nom de : ${m.holder.trim()}`);
    } else {
      if (m.label.trim().toLowerCase().includes('d17')) {
        // Pour D17 : D17 : 27943859
        lines[0] = `D17 : ${m.account.trim()}`;
      } else {
        lines.push(`Compte : ${m.account.trim()}`);
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
  methods: PaymentMethod[]
): string {
  const name = studentName?.trim() || 'Cher élève';
  const header = headerTemplate.replace(/\{nom\}/gi, name).replace(/\{prenom\}/gi, name);
  const footer = footerTemplate.replace(/\{nom\}/gi, name).replace(/\{prenom\}/gi, name);
  const methodsText = formatPaymentMethodsForWhatsApp(methods);

  return `${header}\n\n${methodsText}\n${footer}`.trim();
}

/**
 * Construit le message pour le statut N/A
 */
export function buildNaMessage(
  template: string,
  studentName: string
): string {
  const name = studentName?.trim() || 'Cher élève';
  return template.replace(/\{nom\}/gi, name).replace(/\{prenom\}/gi, name).trim();
}

/**
 * Nettoie le numéro de téléphone pour WhatsApp (format international tunisien +216)
 */
export function cleanTunisianPhone(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');

  // Si 8 chiffres tunisiens (ex: 98123456)
  if (digits.length === 8) {
    return `216${digits}`;
  }
  // Si commence déjà par 216 et a 11 chiffres
  if (digits.length === 11 && digits.startsWith('216')) {
    return digits;
  }
  // Si commence par 00216
  if (digits.startsWith('00216')) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Génère le lien direct pour ouvrir WhatsApp Web ou Mobile
 */
export function getWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = cleanTunisianPhone(phone);
  const encodedText = encodeURIComponent(message);
  if (!cleanPhone) {
    return `https://wa.me/?text=${encodedText}`;
  }
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

