import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type DealQualityBadge =
    | 'historic_low'
    | 'great_deal'
    | 'average'
    | 'above_average'
    | 'high_price'
    | 'insufficient_data';

export interface DealQuality {
    badge: DealQualityBadge;
    label: string;
    percentileRank: number | null;
    predictedNextSaleDate: Date | null;
    avgWeeksBetweenSales: number | null;
    sampleSize: number;
}

/**
 * Normalize a product name to a canonical token-sorted key for cross-retailer matching.
 * "Natrel Milk 2% 2L" and "2% Milk Natrel 2L" both produce "2%_2l_milk_natrel".
 *
 * CRITICAL: Must produce identical output to normalizeProductName in
 * services/api/src/admin/indexFlyerDeals.ts. Keep them in sync.
 */
function normalizeProductName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s%]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(t => t.length > 0)
        .sort()
        .join('_');
}

function analyticsDocId(normalizedKey: string, retailer: string): string {
    return `${normalizedKey.substring(0, 200)}::${retailer.replace(/\s+/g, '_')}`;
}

/**
 * Returns historical deal quality for a product at a given price point.
 *
 * Pass retailer='ALL' for a cross-chain market baseline (used for merchant deals on /deals page).
 * Pass the actual retailer name for Flipp-sourced public deals (e.g. 'No Frills').
 *
 * Returns null while loading. Returns badge='insufficient_data' when fewer than 3 data points exist.
 */
export function useDealQuality(
    dealName: string | undefined,
    retailer: string,
    currentPrice: number | undefined
): DealQuality | null {
    const [quality, setQuality] = useState<DealQuality | null>(null);

    useEffect(() => {
        if (!dealName || currentPrice == null || currentPrice <= 0) {
            setQuality(null);
            return;
        }

        const normalizedKey = normalizeProductName(dealName);
        const docId = analyticsDocId(normalizedKey, retailer);

        getDoc(doc(db, 'flyer_analytics', docId))
            .then(snap => {
                if (!snap.exists()) {
                    setQuality({
                        badge: 'insufficient_data',
                        label: '',
                        percentileRank: null,
                        predictedNextSaleDate: null,
                        avgWeeksBetweenSales: null,
                        sampleSize: 0,
                    });
                    return;
                }

                const data = snap.data();
                const { pricePercentiles, avgOriginalPrice, sampleSize, predictedNextSaleDate, avgWeeksBetweenSales } = data;

                if (!pricePercentiles || (sampleSize ?? 0) < 3) {
                    setQuality({
                        badge: 'insufficient_data',
                        label: '',
                        percentileRank: null,
                        predictedNextSaleDate: null,
                        avgWeeksBetweenSales: null,
                        sampleSize: sampleSize ?? 0,
                    });
                    return;
                }

                const { p10, p25, p50, p75 } = pricePercentiles;

                // Estimate which percentile bucket the current price falls into
                let percentileRank: number;
                if (currentPrice <= p10) percentileRank = 5;
                else if (currentPrice <= p25) percentileRank = 20;
                else if (currentPrice <= p50) percentileRank = 40;
                else if (currentPrice <= p75) percentileRank = 65;
                else percentileRank = 85;

                let badge: DealQualityBadge;
                let label: string;

                // If current price is at or above the historical avg original price,
                // the "original price" shown by the retailer is likely inflated
                if (avgOriginalPrice && currentPrice >= avgOriginalPrice * 0.95) {
                    badge = 'high_price';
                    label = 'Typical Price';
                } else if (currentPrice <= p10) {
                    badge = 'historic_low';
                    label = 'Historic Low';
                } else if (currentPrice <= p25) {
                    badge = 'great_deal';
                    label = 'Great Deal';
                } else if (currentPrice <= p50) {
                    badge = 'average';
                    label = 'Average Price';
                } else if (currentPrice <= p75) {
                    badge = 'above_average';
                    label = 'Above Average';
                } else {
                    badge = 'high_price';
                    label = 'High Price';
                }

                const predictedDate: Date | null =
                    predictedNextSaleDate &&
                    typeof predictedNextSaleDate.toDate === 'function'
                        ? predictedNextSaleDate.toDate()
                        : null;

                setQuality({
                    badge,
                    label,
                    percentileRank,
                    predictedNextSaleDate: predictedDate,
                    avgWeeksBetweenSales: avgWeeksBetweenSales ?? null,
                    sampleSize,
                });
            })
            .catch(err => {
                console.error('[useDealQuality]', err);
                setQuality(null);
            });
    }, [dealName, retailer, currentPrice]);

    return quality;
}
