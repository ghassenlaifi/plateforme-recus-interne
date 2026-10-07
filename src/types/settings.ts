export interface PaymentMethod {
  id: string;
  enabled: boolean;
  label: string;
  account: string;
  holder?: string;
  bank?: string;
}

export interface WhatsAppTemplates {
  // Modèle 1 : Approved Prospect (Validation modes de paiement)
  approvedProspectLang?: 'fr' | 'ar';
  approvedProspectHeader: string;
  approvedProspectFooter: string;
  approvedProspectHeader_ar: string;
  approvedProspectFooter_ar: string;

  // Modèle 2 : Statut N/A (Prospect non joignable)
  naMessageLang?: 'fr' | 'ar';
  naMessage: string;
  naMessage_ar: string;

  // Modèle 3 : Rappel de Séance Groupe Élèves (dynamique : matière, aujourd'hui + heure exacte, sans lien Zoom)
  groupReminderLang?: 'fr' | 'ar';
  groupReminder: string;
  groupReminder_ar: string;

  // Modèle 4 : Rappel Enseignant (dynamique : salutation + nom prof + matière + niveau + aujourd'hui + heure exacte, sans lien Zoom)
  teacherReminderLang?: 'fr' | 'ar';
  teacherReminder: string;
  teacherReminder_ar: string;

  // Rétrocompatibilité éventuelle
  defaultLanguage?: 'fr' | 'ar';
}

export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'poste_edinars',
    enabled: true,
    label: 'Par Poste (carte e-dinars)',
    account: '5359 4017 4108 4335',
    holder: 'Elyes Laabidi',
    bank: ''
  },
  {
    id: 'd17',
    enabled: true,
    label: 'D17',
    account: '27943859',
    holder: '',
    bank: ''
  },
  {
    id: 'bank_elbaraka',
    enabled: true,
    label: 'Bank',
    account: '3200 9788 1161 9660 4122',
    holder: 'ELIOS ACADEMY',
    bank: 'El Baraka'
  }
];

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplates = {
  // 1. Approved Prospect
  approvedProspectLang: 'fr',
  approvedProspectHeader: 'Bonjour {nom},\n\nVoici les différents modes du paiement pour finaliser votre inscription chez Elios Academy :',
  approvedProspectFooter: '\nMerci de nous envoyer une capture ou photo du reçu dès que le paiement est effectué afin de valider définitivement votre accès.',
  approvedProspectHeader_ar: 'مرحباً {nom}،\n\nإليكم طرق الدفع المتاحة لتأكيد تسجيلكم في أكاديمية إليوس (Elios Academy) :',
  approvedProspectFooter_ar: '\nيرجى إرسال صورة أو وصل الدفع فور إتمامه لتفعيل حسابكم والتحاقكم رسمياً.',

  // 2. Relance N/A
  naMessageLang: 'fr',
  naMessage: 'Bonjour {nom},\n\nNous avons essayé de vous joindre sans succès concernant votre demande d\'inscription chez Elios Academy.\n\nN\'hésitez pas à nous répondre ou nous rappeler directement sur ce numéro dès que vous êtes disponible afin de finaliser votre orientation pédagogique.\n\nBien cordialement,\nL\'équipe Elios Academy',
  naMessage_ar: 'مرحباً {nom}،\n\nحاولنا الاتصال بكم بخصوص طلب تسجيلكم في أكاديمية إليوس (Elios Academy) ولكن لم نتمكن من الوصول إليكم.\n\nيرجى التواصل معنا أو معاودة الاتصال على هذا الرقم عند توفركم لإتمام إجراءات التسجيل والتوجيه البيداغوجي.\n\nمع خالص التحيات،\nفريق Elios Academy',

  // 3. Rappel Séance Groupe Élèves (sans lien Zoom, aujourd'hui + heure exacte)
  groupReminderLang: 'fr',
  groupReminder: '📢 *Rappel de séance - Elios Academy*\n\nChers élèves,\n\nNous vous rappelons que votre séance de {matiere} ({niveau}) aura lieu aujourd\'hui à {heure}.\n\nSoyez au rendez-vous et préparez vos cours !\n\nL\'équipe Elios Academy',
  groupReminder_ar: '📢 *تذكير بالحصّة - Elios Academy*\n\nأعزائنا التلاميذ،\n\nنذكركم بأن حصتكم في مادة {matiere} ({niveau}) ستكون اليوم على الساعة {heure}.\n\nيرجى الحضور في الموعد المحدد وتجهيز مستلزمات الدرس !\n\nفريق Elios Academy',

  // 4. Rappel Enseignant (Salutation + prof + matière + niveau + aujourd'hui + heure exacte, sans lien Zoom)
  teacherReminderLang: 'fr',
  teacherReminder: 'Bonjour {prof},\n\nRappel pour votre séance en direct de {matiere} ({niveau}) prévue aujourd\'hui à {heure}.\n\nMerci de confirmer votre disponibilité.',
  teacherReminder_ar: 'تحية طيبة أستاذ(ة) {prof}،\n\nنذكركم بحصتكم المباشرة في مادة {matiere} ({niveau}) المبرمجة اليوم على الساعة {heure}.\n\nيرجى تأكيد حضوركم وجاهزيتكم.',

  defaultLanguage: 'fr',
};

