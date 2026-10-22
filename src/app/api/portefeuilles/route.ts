import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Receipt from '@/models/Receipt';
import { PREDEFINED_WALLETS, normalizeWallet } from '@/lib/walletUtils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    await connectDB();

    // Validation et normalisation de la date demandée (format strict YYYY-MM-DD)
    const validDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const targetDateStr = dateParam && validDateRegex.test(dateParam) ? dateParam : null;

    // Détermination de la date du jour en fuseau horaire Tunisie (UTC+1)
    const now = new Date();
    const tunisTime = new Date(now.getTime() + 60 * 60 * 1000);
    const todayStr = tunisTime.toISOString().slice(0, 10);
    const referenceDayStr = targetDateStr || todayStr;

    // Pipeline d'agrégation robuste avec gestion d'intégrité des dates
    const aggregation = await Receipt.aggregate([
      { 
        $match: { 
          status: { $in: ['PENDING', 'PROCESSED', 'ARCHIVED'] },
          paymentMode: { $exists: true, $nin: [null, ''] }
        } 
      },
      {
        $addFields: {
          effectiveDate: { $ifNull: ["$paymentDate", "$createdAt"] }
        }
      },
      {
        $addFields: {
          dateStr: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $toDate: "$effectiveDate" },
              timezone: "+01:00"
            }
          }
        }
      },
      { 
        $group: {
          _id: {
            mode: "$paymentMode",
            details: "$paymentDetails"
          },
          allTimeTotalAmount: { $sum: "$amount" },
          allTimeCount: { $sum: 1 },
          cumulativeAmount: {
            $sum: {
              $cond: [
                {
                  $lte: [
                    "$dateStr",
                    targetDateStr || "9999-12-31"
                  ]
                },
                "$amount",
                0
              ]
            }
          },
          cumulativeCount: {
            $sum: {
              $cond: [
                {
                  $lte: [
                    "$dateStr",
                    targetDateStr || "9999-12-31"
                  ]
                },
                1,
                0
              ]
            }
          },
          // Solde encaissé le jour mentionné (montants positifs reçus ce jour)
          dayAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$dateStr", referenceDayStr] },
                    { $gt: ["$amount", 0] }
                  ]
                },
                "$amount",
                0
              ]
            }
          },
          // Montants sortis le jour mentionné (retraits négatifs)
          dayOut: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$dateStr", referenceDayStr] },
                    { $lt: ["$amount", 0] }
                  ]
                },
                { $abs: "$amount" },
                0
              ]
            }
          },
          // Nombre de mouvements sur ce jour spécifique
          dayCount: {
            $sum: {
              $cond: [
                { $eq: ["$dateStr", referenceDayStr] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Indexation dans un Map pour un accès rapide O(1) et agrégation canonique sécurisée
    const aggMap = new Map();
    aggregation.forEach((item: any) => {
      const { mode, details, key } = normalizeWallet(item._id.mode, item._id.details);
      const existing = aggMap.get(key) || {
        totalAmount: 0,
        count: 0,
        currentTotalAmount: 0,
        currentCount: 0,
        dayAmount: 0,
        dayOut: 0,
        dayCount: 0
      };

      const computedTotal = targetDateStr ? item.cumulativeAmount : item.allTimeTotalAmount;
      const computedCount = targetDateStr ? item.cumulativeCount : item.allTimeCount;

      aggMap.set(key, {
        totalAmount: existing.totalAmount + computedTotal,
        count: existing.count + computedCount,
        currentTotalAmount: existing.currentTotalAmount + item.allTimeTotalAmount,
        currentCount: existing.currentCount + item.allTimeCount,
        dayAmount: existing.dayAmount + item.dayAmount,
        dayOut: existing.dayOut + item.dayOut,
        dayCount: existing.dayCount + item.dayCount,
      });
    });

    const usedKeys = new Set();

    // Mappage sur les portefeuilles prédéfinis pour s'assurer qu'ils existent tous (même avec solde 0)
    const wallets: Array<{
      mode: string;
      details: string;
      totalAmount: number;
      count: number;
      currentTotalAmount: number;
      currentCount: number;
      dayAmount: number;
      dayOut: number;
      dayCount: number;
      selectedDate: string | null;
    }> = PREDEFINED_WALLETS.map(wallet => {
      const key = `${wallet.mode}-${wallet.details}`;
      usedKeys.add(key);
      const data = aggMap.get(key) || {
        totalAmount: 0,
        count: 0,
        currentTotalAmount: 0,
        currentCount: 0,
        dayAmount: 0,
        dayOut: 0,
        dayCount: 0
      };
      return {
        mode: wallet.mode,
        details: wallet.details,
        totalAmount: data.totalAmount,
        count: data.count,
        currentTotalAmount: data.currentTotalAmount,
        currentCount: data.currentCount,
        dayAmount: data.dayAmount,
        dayOut: data.dayOut,
        dayCount: data.dayCount,
        selectedDate: targetDateStr
      };
    });

    // Ajouter toute autre combinaison trouvée en base (uniquement si non couverte par les portefeuilles prédéfinis)
    aggregation.forEach((item: any) => {
      const { mode: normMode, details: normDetails, key } = normalizeWallet(item._id.mode, item._id.details);
      if (!usedKeys.has(key)) {
        usedKeys.add(key);
        const data = aggMap.get(key) || {
          totalAmount: 0,
          count: 0,
          currentTotalAmount: 0,
          currentCount: 0,
          dayAmount: 0,
          dayOut: 0,
          dayCount: 0
        };
        wallets.push({
          mode: normMode,
          details: normDetails,
          totalAmount: data.totalAmount,
          count: data.count,
          currentTotalAmount: data.currentTotalAmount,
          currentCount: data.currentCount,
          dayAmount: data.dayAmount,
          dayOut: data.dayOut,
          dayCount: data.dayCount,
          selectedDate: targetDateStr
        });
      }
    });

    return NextResponse.json(wallets, { status: 200 });
  } catch (error: any) {
    console.error('Erreur dans GET /api/portefeuilles:', error);
    return NextResponse.json({ error: 'Erreur Serveur' }, { status: 500 });
  }
}
