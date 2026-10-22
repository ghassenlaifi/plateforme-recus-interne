/**
 * Utility functions for Multi-Wallet Management & Data Integrity
 * Assure la cohérence stricte entre Encaissements, Reçus, Retraits et Extrait
 */

export interface PredefinedWallet {
  mode: 'Espèces' | 'Edinar - D17' | 'Virement Bancaire';
  details: string;
}

export const PREDEFINED_WALLETS: PredefinedWallet[] = [
  { mode: 'Espèces', details: 'Bab Saadoun' },
  { mode: 'Espèces', details: 'Soumaya' },
  { mode: 'Espèces', details: 'Douar Hicher' },
  { mode: 'Edinar - D17', details: 'Soumaya' },
  { mode: 'Edinar - D17', details: 'Elyes' },
  { mode: 'Virement Bancaire', details: 'ATB Safa' },
  { mode: 'Virement Bancaire', details: 'ATB Elyes' },
  { mode: 'Virement Bancaire', details: 'El Baraka Elios' },
];

/**
 * Normalise de manière déterministe le couple (Mode, Détails) d'un portefeuille.
 * Résout tout alias historique, concaténation ou préfixe redondant (ex: "D17 - Soumaya" -> "Soumaya").
 */
export function normalizeWallet(
  rawMode?: string | null,
  rawDetails?: string | null
): { mode: string; details: string; key: string } {
  let m = (rawMode || '').trim();
  let d = (rawDetails || '').trim();

  // Cas où le mode contient la chaîne complète (ex: "Edinar - D17 - Soumaya")
  if (!d && m.includes(' - ')) {
    const lower = m.toLowerCase();
    if (lower.startsWith('edinar') || lower.includes('d17')) {
      m = 'Edinar - D17';
      d = rawMode!
        .replace(/^edinar\s*-\s*d17\s*-\s*/i, '')
        .replace(/^d17\s*-\s*/i, '')
        .replace(/^edinar\s*-\s*/i, '')
        .trim();
    } else if (lower.startsWith('vir')) {
      m = 'Virement Bancaire';
      d = rawMode!
        .replace(/^virement\s*bancaire\s*-\s*/i, '')
        .replace(/^virement\s*-\s*/i, '')
        .trim();
    } else if (lower.includes('esp')) {
      m = 'Espèces';
      d = rawMode!.replace(/^esp[èe]ces\s*-\s*/i, '').trim();
    }
  }

  // 1. Détection canonique du mode
  const lowerM = m.toLowerCase();
  let finalMode = m;
  if (lowerM.startsWith('vir') || lowerM.includes('banqu')) {
    finalMode = 'Virement Bancaire';
  } else if (lowerM.startsWith('edin') || lowerM.includes('d17')) {
    finalMode = 'Edinar - D17';
  } else if (lowerM.includes('esp')) {
    finalMode = 'Espèces';
  }

  // 2. Détection et nettoyage canonique des détails
  let finalDetails = d;
  const lowerD = d.toLowerCase();

  if (finalMode === 'Edinar - D17') {
    if (lowerD.includes('soumaya')) {
      finalDetails = 'Soumaya';
    } else if (lowerD.includes('elyes')) {
      finalDetails = 'Elyes';
    } else {
      finalDetails = d
        .replace(/^d17\s*-\s*/i, '')
        .replace(/^edinar\s*-\s*/i, '')
        .trim() || d;
    }
  } else if (finalMode === 'Espèces') {
    if (lowerD.includes('saadoun')) {
      finalDetails = 'Bab Saadoun';
    } else if (lowerD.includes('soumaya')) {
      finalDetails = 'Soumaya';
    } else if (lowerD.includes('douar') || lowerD.includes('hicher')) {
      finalDetails = 'Douar Hicher';
    }
  } else if (finalMode === 'Virement Bancaire') {
    if (lowerD.includes('safa')) {
      finalDetails = 'ATB Safa';
    } else if (lowerD.includes('elyes')) {
      finalDetails = 'ATB Elyes';
    } else if (lowerD.includes('baraka') || lowerD.includes('elios')) {
      finalDetails = 'El Baraka Elios';
    }
  }

  return {
    mode: finalMode,
    details: finalDetails,
    key: `${finalMode}-${finalDetails}`
  };
}

/**
 * Construit un filtre MongoDB insensible à la casse et tolérant aux variations
 * historiques pour retrouver TOUTES les écritures d'un portefeuille (dépôts, retraits, purges).
 */
export function buildWalletMongoMatch(rawMode: string, rawDetails: string) {
  const { mode, details } = normalizeWallet(rawMode, rawDetails);

  let modeRegex: RegExp;
  if (mode === 'Edinar - D17') {
    modeRegex = /^(Edinar\s*-\s*D17|Edinar|D17)$/i;
  } else if (mode === 'Virement Bancaire') {
    modeRegex = /^(Virement\s*Bancaire|Virement|Banque)$/i;
  } else if (mode === 'Espèces') {
    modeRegex = /^(Esp[èe]ces|Esp[èe]ce|Cash)$/i;
  } else {
    modeRegex = new RegExp(`^${mode.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');
  }

  let detailsRegex: RegExp;
  if (mode === 'Edinar - D17') {
    if (details.toLowerCase() === 'soumaya') {
      detailsRegex = /^(Soumaya|D17\s*-\s*Soumaya|D17\s*Soumaya)$/i;
    } else if (details.toLowerCase() === 'elyes') {
      detailsRegex = /^(Elyes|D17\s*-\s*Elyes|D17\s*Elyes)$/i;
    } else {
      detailsRegex = new RegExp(`^${details.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');
    }
  } else if (mode === 'Espèces') {
    if (details.toLowerCase().includes('saadoun')) {
      detailsRegex = /^(Bab\s*Saadoun|Saadoun)$/i;
    } else if (details.toLowerCase() === 'soumaya') {
      detailsRegex = /^Soumaya$/i;
    } else if (details.toLowerCase().includes('douar') || details.toLowerCase().includes('hicher')) {
      detailsRegex = /^(Douar\s*Hicher|Douar|Hicher)$/i;
    } else {
      detailsRegex = new RegExp(`^${details.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');
    }
  } else if (mode === 'Virement Bancaire') {
    if (details.toLowerCase().includes('safa')) {
      detailsRegex = /^(ATB\s*Safa|Safa)$/i;
    } else if (details.toLowerCase().includes('elyes')) {
      detailsRegex = /^(ATB\s*Elyes|Elyes)$/i;
    } else if (details.toLowerCase().includes('baraka')) {
      detailsRegex = /^(El\s*Baraka\s*Elios|El\s*Baraka|Baraka\s*Elios)$/i;
    } else {
      detailsRegex = new RegExp(`^${details.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');
    }
  } else {
    detailsRegex = new RegExp(`^${details.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');
  }

  return {
    paymentMode: { $regex: modeRegex },
    paymentDetails: { $regex: detailsRegex },
    canonicalMode: mode,
    canonicalDetails: details,
  };
}

