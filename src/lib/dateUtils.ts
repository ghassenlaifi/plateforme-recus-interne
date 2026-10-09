/**
 * Utilitaires universels de résolution et d'intégrité temporelle pour ReceiptHub / Elios.
 * Garantit que les horodatages des reçus et des portefeuilles reflètent l'heure exacte et réelle
 * et élimine définitivement les artefacts d'heures tronquées (ex: 01:00 ou 13:00 dues à UTC 00:00 ou 12:00).
 */

/**
 * Résout la date et heure exacte et authentique d'un reçu de paiement.
 * Si paymentDate a été tronqué (ex: minuit 00:00:00 UTC ou midi 12:00:00 UTC),
 * combine le jour civil de paymentDate avec l'heure/minute/seconde réelle de createdAt.
 */
export function resolveExactReceiptDate(
  paymentDate?: Date | string | null,
  createdAt?: Date | string | null
): Date {
  if (paymentDate) {
    const pDate = new Date(paymentDate);
    if (!isNaN(pDate.getTime())) {
      const h = pDate.getUTCHours();
      const m = pDate.getUTCMinutes();
      const s = pDate.getUTCSeconds();
      const ms = pDate.getUTCMilliseconds();

      const isDummyMidnight = h === 0 && m === 0 && s === 0 && ms === 0;
      const isDummyNoon = h === 12 && m === 0 && s === 0 && ms === 0;

      if ((isDummyMidnight || isDummyNoon) && createdAt) {
        const cDate = new Date(createdAt);
        if (!isNaN(cDate.getTime())) {
          return new Date(
            pDate.getFullYear(),
            pDate.getMonth(),
            pDate.getDate(),
            cDate.getHours(),
            cDate.getMinutes(),
            cDate.getSeconds(),
            cDate.getMilliseconds()
          );
        }
      }
      return pDate;
    }
  }

  if (createdAt) {
    const cDate = new Date(createdAt);
    if (!isNaN(cDate.getTime())) return cDate;
  }

  return new Date();
}

/**
 * Formate un horodatage complet (date courte + heure exacte) en français.
 * Ex: "09 oct. 2026 17:31"
 */
export function formatFullDateTimeFR(
  paymentDate?: Date | string | null,
  createdAt?: Date | string | null
): string {
  if (!paymentDate && !createdAt) return '—';
  const d = resolveExactReceiptDate(paymentDate, createdAt);
  if (isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );
}

/**
 * Formate une date et heure pour les cartes de reçus de paiement.
 * Ex: dateStr = "09/10/2026", timeStr = "17:31"
 */
export function formatReceiptCardDateTime(
  paymentDate?: Date | string | null,
  createdAt?: Date | string | null
): { dateStr: string; timeStr: string } {
  const d = resolveExactReceiptDate(paymentDate, createdAt);
  return {
    dateStr: d.toLocaleDateString('fr-FR'),
    timeStr: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  };
}

