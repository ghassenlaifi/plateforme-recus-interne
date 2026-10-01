export interface PaymentMethod {
  id: string;
  enabled: boolean;
  label: string;
  account: string;
  holder?: string;
  bank?: string;
}

export interface WhatsAppTemplates {
  approvedProspectHeader: string;
  approvedProspectFooter: string;
  naMessage: string;
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
  approvedProspectHeader: 'Bonjour {nom},\n\nVoici les différents modes du paiement pour finaliser votre inscription chez Elios Academy :',
  approvedProspectFooter: '\nMerci de nous envoyer une capture ou photo du reçu dès que le paiement est effectué afin de valider définitivement votre accès.',
  naMessage: 'Bonjour {nom},\n\nNous avons essayé de vous joindre sans succès concernant votre demande d\'inscription chez Elios Academy.\n\nN\'hésitez pas à nous répondre ou nous rappeler directement sur ce numéro dès que vous êtes disponible afin de finaliser votre orientation pédagogique.\n\nBien cordialement,\nL\'équipe Elios Academy'
};

