import { useState, useEffect, useCallback } from 'react';
import { useMarketplace } from '../context/MarketplaceContext';
import { filterActiveDeals, isFlyerActive } from '../utils/date-helpers';

/**
 * Builds a live cheapest-price map for a store across all active deals and flyers.
 * Used so that adding to cart from ANY tab always applies the lowest valid price.
 */
export function useStoreActivePrices(storeId: string) {
    const { subscribeToDeals, subscribeToFlyers, getStore } = useMarketplace();
    const [dealPrices, setDealPrices] = useState<Map<string, number>>(new Map());
    const [flyerPrices, setFlyerPrices] = useState<Map<string, number>>(new Map());

    const hasDealsAccess = getStore(storeId)?.subscriptionTier === 'pro';

    useEffect(() => {
        if (!storeId || !hasDealsAccess) return;
        return subscribeToDeals(storeId, (data: any[]) => {
            const map = new Map<string, number>();
            filterActiveDeals(data).forEach((d: any) => {
                const p = d.salePrice ?? d.price;
                if (d.productId && p != null) {
                    const prev = map.get(d.productId);
                    if (prev === undefined || p < prev) map.set(d.productId, p);
                }
            });
            setDealPrices(map);
        });
    }, [storeId, subscribeToDeals, hasDealsAccess]);

    useEffect(() => {
        if (!storeId) return;
        return subscribeToFlyers(storeId, (flyers: any[]) => {
            const map = new Map<string, number>();
            flyers.filter(isFlyerActive).forEach((flyer: any) => {
                (flyer.items || []).forEach((item: any) => {
                    if (item.productId && item.salePrice != null) {
                        const prev = map.get(item.productId);
                        if (prev === undefined || item.salePrice < prev) map.set(item.productId, item.salePrice);
                    }
                });
            });
            setFlyerPrices(map);
        });
    }, [storeId, subscribeToFlyers]);

    const getMinPrice = useCallback((productId: string, candidatePrice: number): number => {
        const prices = [candidatePrice];
        const dp = dealPrices.get(productId);
        if (dp !== undefined) prices.push(dp);
        const fp = flyerPrices.get(productId);
        if (fp !== undefined) prices.push(fp);
        return Math.min(...prices);
    }, [dealPrices, flyerPrices]);

    return { getMinPrice };
}
