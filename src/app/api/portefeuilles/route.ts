import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Receipt from '@/models/Receipt';

// Toutes les combinaisons possibles exigées par le CTO
const PREDEFINED_WALLETS = [
  { mode: 'Espèces', details: 'Bab Saadoun' },
  { mode: 'Espèces', details: 'Soumaya' },
  { mode: 'Espèces', details: 'Douar Hicher' },
  { mode: 'Edinar - D17', details: 'Soumaya' },
  { mode: 'Edinar - D17', details: 'Elyes' },
  { mode: 'Virement Bancaire', details: 'ATB Safa' },
  { mode: 'Virement Bancaire', details: 'ATB Elyes' },
  { mode: 'Virement Bancaire', details: 'El Baraka Elios' },
];

export async function GET() {
  try {
    await connectDB();

    const aggregation = await Receipt.aggregate([
      { 
        $match: { 
          status: { $in: ['PENDING', 'PROCESSED', 'ARCHIVED'] },
          paymentMode: { $exists: true, $nin: [null, ''] }
        } 
      },
      { 
        $group: {
          _id: {
            mode: "$paymentMode",
            details: "$paymentDetails"
          },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    const normalizeMode = (m: string) => {
      if (!m) return '';
      const s = m.trim().toLowerCase();
      if (s.startsWith('virement')) return 'Virement Bancaire';
      if (s.startsWith('edinar') || s.includes('d17')) return 'Edinar - D17';
      if (s.includes('esp')) return 'Espèces';
      return m.trim();
    };

    // Convertir l'agrégation en dictionnaire pour un accès rapide (O(1))
    const aggMap = new Map();
    aggregation.forEach(item => {
      const mode = normalizeMode(item._id.mode);
      const details = (item._id.details || '').trim();
      const key = `${mode}-${details}`;
      const existing = aggMap.get(key) || { totalAmount: 0, count: 0 };
      aggMap.set(key, {
        totalAmount: existing.totalAmount + item.totalAmount,
        count: existing.count + item.count
      });
    });

    const usedKeys = new Set();

    // Mappage sur les portefeuilles prédéfinis pour s'assurer qu'ils existent tous (même soldés à 0)
    const wallets = PREDEFINED_WALLETS.map(wallet => {
      const key = `${wallet.mode}-${wallet.details}`;
      usedKeys.add(key);
      const data = aggMap.get(key) || { totalAmount: 0, count: 0 };
      return {
        mode: wallet.mode,
        details: wallet.details,
        totalAmount: data.totalAmount,
        count: data.count
      };
    });

    // Ajouter toute autre combinaison trouvée en base (ex: anciennes données, erreurs de frappe avant les listes strictes)
    aggregation.forEach(item => {
      const key = `${item._id.mode}-${item._id.details}`;
      if (!usedKeys.has(key)) {
        wallets.push({
          mode: item._id.mode,
          details: item._id.details,
          totalAmount: item.totalAmount,
          count: item.count
        });
      }
    });

    return NextResponse.json(wallets, { status: 200 });
  } catch (error: any) {
    console.error('Erreur dans GET /api/portefeuilles:', error);
    return NextResponse.json({ error: 'Erreur Serveur' }, { status: 500 });
  }
}

