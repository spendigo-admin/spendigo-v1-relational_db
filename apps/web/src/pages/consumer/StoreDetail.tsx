import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCart } from '../../context/CartContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useCatalog } from '../../hooks/useCatalog';
import { useStoreProducts } from '../../hooks/useStoreProducts'; // Standalone hook
import ReviewList from '../../components/ReviewList';
import ReviewForm from '../../components/ReviewForm';
import StarRating from '../../components/StarRating';
import { useReviews } from '../../context/ReviewContext';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';
import { isFlyerActive, filterActiveDeals } from '../../utils/date-helpers';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

import { useEffect } from 'react';

// New FlyerTab Component
const FlyerTab: React.FC<{ storeId: string; storeName: string; summary: any; viewMode: 'grid' | 'list' }> = ({ storeId, storeName, summary, viewMode }) => {
    const { subscribeToFlyers } = useMarketplace();
    const { addToCart } = useCart();
    const [flyer, setFlyer] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToFlyers(storeId, (flyers) => {
            const now = new Date();
            const activeFlyers = flyers.filter(f => {
                if (f.status !== 'active') return false;
                if (!f.validUntil) return true;
                const end = new Date(f.validUntil);
                if (f.validUntil.indexOf(':') === -1) end.setHours(23, 59, 59, 999);
                return end >= now;
            });

            // Find best matching active flyer
            const active = activeFlyers.find(f => f.title === summary?.title) || activeFlyers[0];
            setFlyer(active);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [storeId, subscribeToFlyers, summary]);

    const handleAdd = (item: any) => {
        addToCart({
            productId: item.productId,
            productName: item.name,
            price: item.salePrice,
            quantity: 1,
            storeId,
            storeName,
            image: item.image
        });
    };

    if (loading) return (
        <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
            </div>
        </div>
    );

    if (!flyer) return (
        <EmptyState icon="📰" heading="No active flyer" subtext="Check back soon for this week's deals." />
    );

    // Sort items by savings to feature the biggest deals
    const sortedItems = [...(flyer.items || [])].sort((a, b) => {
        const savingsA = (a.originalPrice - a.salePrice) / a.originalPrice;
        const savingsB = (b.originalPrice - b.salePrice) / b.originalPrice;
        return savingsB - savingsA;
    });

    const calculateDaysLeft = (date: string) => {
        const end = new Date(date);
        const now = new Date();
        const diff = end.getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const flyerDaysLeft = calculateDaysLeft(flyer.validUntil);

    return (
        <div className="animate-fade-in bg-white min-h-screen">
            {/* RETAIL FLYER HEADER */}
            <div className="bg-blue-600 text-white px-4 py-3 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-inner border-b-4 border-blue-700">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-1 rounded-lg">
                        <span className="text-2xl">🍁</span>
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black italic tracking-tighter mb-0 text-white drop-shadow-sm leading-none">
                            {storeName}'s Great Deals
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] bg-blue-800 px-1.5 py-0.5 rounded font-bold tracking-widest">Proudly canadian</span>
                            <span className="text-[10px] font-bold opacity-90 tracking-widest">SINCE 1922</span>
                        </div>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end">
                    <div className="text-xs font-bold bg-white text-blue-600 px-2 py-0.5 rounded-full mb-1">
                        {flyer.title || "WEEKLY SAVINGS"}
                    </div>
                    <div className="flex flex-col items-end leading-tight">
                        <p className="text-[10px] md:text-xs font-black tracking-widest text-yellow-300 drop-shadow-sm">
                            VALID: {new Date(flyer.validFrom).toLocaleDateString()} - {new Date(flyer.validUntil).toLocaleDateString()}
                        </p>
                        <p className="text-[9px] md:text-[10px] font-black tracking-tighter bg-blue-800 px-1.5 py-0.5 rounded mt-0.5 animate-pulse text-white">
                            ⏰ {flyerDaysLeft} {flyerDaysLeft === 1 ? 'DAY' : 'DAYS'} LEFT
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {viewMode === 'list' ? (
                    <div className="space-y-3">
                        {sortedItems.map((item: any, idx: number) => (
                            <div key={idx} className="bg-white rounded-xl border border-[var(--glass-border)] p-3 flex gap-4 items-center shadow-sm hover:shadow-md transition-all">
                                <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 relative overflow-hidden">
                                    <img src={item.image} className="w-full h-full object-cover" loading="lazy" />
                                    {item.salePrice < item.originalPrice && (
                                        <div className="absolute top-0 left-0 bg-teal-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-br tracking-tighter font-serif shadow-sm">
                                            SAVE {Math.round(((item.originalPrice - item.salePrice) / item.originalPrice) * 100)}%
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-[var(--text-main)] truncate">{item.name}</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-black text-blue-600">${item.salePrice.toFixed(2)}</span>
                                        <span className="text-[10px] text-[var(--text-muted)] line-through">Reg ${item.originalPrice.toFixed(2)}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleAdd(item)}
                                    className="px-4 py-2 bg-blue-600 text-white text-xs font-black rounded tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-md"
                                >
                                    + ADD
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* GRAPHICAL GRID VIEW */
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        {sortedItems.map((item: any, idx: number) => {
                            const isFeatured = idx < 2; // Feature top 2 deals
                            const savingsPercent = Math.round(((item.originalPrice - item.salePrice) / item.originalPrice) * 100);
                            const savingsAmount = (item.originalPrice - item.salePrice).toFixed(2);

                            return (
                                <div 
                                    key={idx} 
                                    className={`relative group bg-white border-2 ${isFeatured ? 'col-span-2 md:col-span-2 border-red-200' : 'border-gray-100'} p-3 flex flex-col shadow-sm transition-all hover:shadow-xl hover:z-10`}
                                >
                                    {/* Big Savings Circle Badge */}
                                    {savingsPercent >= 20 && (
                                        <div className={`absolute ${isFeatured ? '-top-3 -right-3 w-16 h-16 md:w-20 md:h-20' : '-top-2 -right-2 w-12 h-12 md:w-14 md:h-14'} z-20 bg-yellow-400 rounded-full flex flex-col items-center justify-center border-4 border-white shadow-lg rotate-12 group-hover:rotate-0 transition-transform duration-300`}>
                                            <span className="text-[8px] md:text-[10px] font-black text-teal-700 -mb-1">Save</span>
                                            <span className={`${isFeatured ? 'text-lg md:text-2xl' : 'text-xs md:text-lg'} font-black text-teal-700 leading-none`}>${Math.floor(Number(savingsAmount))}</span>
                                            {isFeatured && <span className="text-[8px] font-bold text-teal-700">Ltd time</span>}
                                        </div>
                                    )}

                                    {/* Product Image Section */}
                                    <div className={`relative ${isFeatured ? 'h-48 md:h-64' : 'h-32 md:h-40'} mb-3 bg-white overflow-hidden`}>
                                        <img 
                                            src={item.image} 
                                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" 
                                            loading={isFeatured ? "eager" : "lazy"}
                                        />
                                        {isFeatured && (
                                            <div className="absolute top-2 left-2 bg-teal-600 text-white text-[10px] font-black px-2 py-1 rounded skew-x-[-12deg] shadow-lg">
                                                HOT DEAL
                                            </div>
                                        )}
                                    </div>

                                    {/* Pricing Section - Retail Style */}
                                        <div className="flex flex-col">
                                            <div className="flex items-start gap-2 mb-1">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] md:text-[10px] font-black bg-blue-600 text-white px-1 w-max rounded-sm tracking-tighter">Sale</span>
                                                    <span className={`${isFeatured ? 'text-2xl md:text-4xl' : 'text-xl md:text-2xl'} font-black text-blue-700 tracking-tighter leading-none`}>
                                                        {item.salePrice.toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col mt-4">
                                                    <span className="text-[8px] md:text-[10px] font-bold text-gray-500 line-through">Reg {item.originalPrice.toFixed(2)}</span>
                                                    <span className="text-[8px] md:text-[10px] font-black text-blue-600 tracking-tighter">Limit 4</span>
                                                </div>
                                            </div>

                                            <p className={`${isFeatured ? 'text-sm md:text-lg' : 'text-xs md:text-sm'} font-black text-gray-800 leading-snug grow`}>
                                                {item.name}
                                            </p>

                                            {isFeatured && (
                                                <p className="text-[10px] text-gray-500 mb-2 font-medium italic">
                                                    Compare at store prices. While quantities last. 
                                                </p>
                                            )}

                                            <button
                                                onClick={() => handleAdd(item)}
                                                className="w-full mt-2 py-2 md:py-3 bg-blue-600 text-white text-[10px] md:text-xs font-black rounded tracking-widest hover:bg-black transition-colors shadow-md active:translate-y-0.5"
                                            >
                                                + Add To Cart
                                            </button>
                                        </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {(!flyer.items || flyer.items.length === 0) && (
                    <EmptyState icon="📰" heading="Flyer Specials Coming Soon!" subtext="Check back for weekly deals from this store." />
                )}
            </div>
            
            {/* FLYER FOOTER */}
            <div className="bg-gray-100 p-8 text-center text-[10px] text-gray-500 space-y-2 border-t border-gray-200">
                <p className="font-bold">Proudly serving our community</p>
                <p>Prices effective for the duration of this flyer. We reserve the right to limit quantities. Typography or photography errors are subject to correction.</p>
                <div className="flex justify-center gap-4 py-2 grayscale opacity-50">
                    <span className="text-xl">💳</span>
                    <span className="text-xl">📦</span>
                    <span className="text-xl">♻️</span>
                </div>
            </div>
        </div>
    );
};




// New OffersTab Component
const OffersTab: React.FC<{ storeId: string, storeName: string; viewMode: 'grid' | 'list' }> = ({ storeId, storeName, viewMode }) => {
    const { subscribeToDeals } = useMarketplace();
    const { addToCart } = useCart();
    const [deals, setDeals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToDeals(storeId, (data) => {
            const now = new Date();
            const filteredDeals = data.filter(d => {
                if (d.status !== 'active') return false;
                if (!d.endDate) return true;
                return new Date(d.endDate) >= now;
            });
            setDeals(filteredDeals);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [storeId, subscribeToDeals]);

    const handleQuickAdd = (item: any) => {
        addToCart({
            productId: item.productId,
            productName: item.productName || item.name || 'Product',
            price: item.salePrice ?? item.price,
            quantity: 1,
            storeId,
            storeName,
            image: item.productImage || item.image
        });
    };

    if (loading) return (
        <div className="p-6 flex gap-4 overflow-hidden">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-48 min-w-[180px] rounded-2xl flex-shrink-0" />)}
        </div>
    );

    const oneDayOffers = deals.filter(d => d.status === 'active' && d.isFlashSale);
    const saleItems = deals.filter(d => d.status === 'active' && !d.isFlashSale);

    if (oneDayOffers.length === 0 && saleItems.length === 0) {
        return <EmptyState icon="🍂" heading="No special deals right now" subtext="Check back soon for flash sales and offers." />;
    }

    // Sort items by savings for better impact
    const sortedFlashSales = [...oneDayOffers].sort((a, b) => {
        const saveA = ((a.originalPrice || a.price) - (a.salePrice || a.price));
        const saveB = ((b.originalPrice || b.price) - (b.salePrice || b.price));
        return saveB - saveA;
    });

    const sortedSaleItems = [...saleItems].sort((a, b) => {
        const saveA = ((a.originalPrice || a.price) - (a.salePrice || a.price));
        const saveB = ((b.originalPrice || b.price) - (b.salePrice || b.price));
        return saveB - saveA;
    });

    const calculateDaysLeft = (date: string) => {
        if (!date) return null;
        const end = new Date(date);
        const now = new Date();
        const diff = end.getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    return (
        <div className="animate-fade-in bg-white min-h-screen">
            {/* FLASH SALES SECTION */}
            {sortedFlashSales.length > 0 && (
                <div className="mb-8">
                    <div className="bg-orange-500 text-white px-4 py-3 md:py-4 flex items-center justify-between border-b-4 border-orange-600 shadow-inner">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl md:text-3xl animate-pulse">⏰</span>
                            <div>
                                <h3 className="text-lg md:text-xl font-black italic tracking-tighter leading-none m-0">
                                    Hurry! Flash Sales
                                </h3>
                                <p className="text-[10px] font-bold tracking-widest opacity-90 mt-1">LIMITED TIME ONLY • WHILE SUPPLIES LAST</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-black bg-white text-orange-600 px-3 py-1 rounded-full tracking-widest inline-block mb-1 shadow-sm">
                                HOT DEALS
                            </span>
                            {sortedFlashSales[0]?.endDate && (
                                <p className="text-[9px] md:text-[10px] font-black bg-orange-700 px-2 py-0.5 rounded text-white animate-pulse">
                                    {calculateDaysLeft(sortedFlashSales[0].endDate)} DAYS LEFT
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="p-4">
                        {viewMode === 'list' ? (
                            <div className="space-y-2">
                                {sortedFlashSales.map((offer) => (
                                    <div key={offer.id} className="bg-orange-50 rounded-xl border-2 border-orange-200 p-3 flex gap-4 items-center shadow-sm">
                                        <div className="w-16 h-16 rounded-lg bg-white p-1 flex-shrink-0 relative overflow-hidden border border-orange-100">
                                            <img src={offer.productImage || offer.image} className="w-full h-full object-contain" loading="lazy" />
                                            <div className="absolute top-0 left-0 bg-orange-600 text-white text-[8px] font-black px-1 rounded-br">HOT</div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-[var(--text-main)] truncate">{offer.productName || offer.name}</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-sm font-black text-orange-600">${(offer.salePrice ?? offer.price).toFixed(2)}</span>
                                                {offer.originalPrice && <span className="text-[10px] text-gray-500 line-through">Reg ${offer.originalPrice.toFixed(2)}</span>}
                                            </div>
                                        </div>
                                        <button onClick={() => handleQuickAdd(offer)} className="px-4 py-2 bg-orange-600 text-white text-xs font-black rounded tracking-widest shadow-md">
                                            + ADD
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                                {sortedFlashSales.map((offer, idx) => {
                                    const isFeatured = idx < 2;
                                    const sPrice = offer.salePrice ?? offer.price;
                                    const oPrice = offer.originalPrice || sPrice * 1.25;
                                    const savingsAmount = (oPrice - sPrice).toFixed(2);

                                    return (
                                        <div key={offer.id} className={`relative group bg-orange-50 border-2 ${isFeatured ? 'col-span-2 md:col-span-2 border-orange-300' : 'border-orange-200'} p-3 flex flex-col shadow-sm transition-all hover:shadow-xl`}>
                                            <div className="absolute top-2 left-2 z-20 bg-orange-600 text-white text-[10px] font-black px-2 py-1 rounded skew-x-[-12deg] shadow-lg">
                                                FLASH
                                            </div>
                                            
                                            {/* Savings Badge */}
                                            <div className={`absolute -top-3 -right-3 ${isFeatured ? 'w-16 h-16 md:w-20 md:h-20' : 'w-12 h-12 md:w-14 md:h-14'} z-20 bg-yellow-400 rounded-full flex flex-col items-center justify-center border-4 border-white shadow-lg rotate-12`}>
                                                <span className="text-[8px] md:text-[10px] font-black text-orange-800 -mb-1">Save</span>
                                                <span className={`${isFeatured ? 'text-lg md:text-2xl' : 'text-xs md:text-lg'} font-black text-orange-800 leading-none`}>${Math.floor(Number(savingsAmount))}</span>
                                            </div>

                                            <div className={`${isFeatured ? 'h-40 md:h-56' : 'h-32'} mb-3 bg-white rounded-lg p-2 overflow-hidden`}>
                                                <img src={offer.productImage || offer.image} className="w-full h-full object-contain group-hover:scale-105 transition-all duration-500" />
                                            </div>

                                            <div className="flex-1 flex flex-col px-1">
                                                <div className="flex items-start gap-2 mb-1">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] md:text-[10px] font-black bg-orange-600 text-white px-1 w-max rounded-sm tracking-tighter">Sale</span>
                                                        <span className={`${isFeatured ? 'text-2xl md:text-3xl' : 'text-xl'} font-black text-orange-700 tracking-tighter leading-none`}>
                                                            {sPrice.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="mt-4">
                                                        <span className="text-[10px] font-bold text-gray-400 line-through">Reg {oPrice.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                <p className={`${isFeatured ? 'text-sm md:text-base' : 'text-xs'} font-black text-gray-800 leading-snug grow`}>
                                                    {offer.productName || offer.name}
                                                </p>
                                                <button onClick={() => handleQuickAdd(offer)} className="w-full mt-2 py-2 bg-orange-600 text-white text-[10px] font-black rounded tracking-widest hover:bg-black transition-all shadow-md">
                                                    + QUICK ADD
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SALE ITEMS SECTION */}
            {sortedSaleItems.length > 0 && (
                <div>
                    <div className="bg-blue-600 text-white px-4 py-3 md:py-4 flex items-center justify-between border-b-4 border-blue-700 shadow-inner">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl md:text-3xl">🏷️</span>
                            <div>
                                <h3 className="text-lg md:text-xl font-black italic tracking-tighter leading-none m-0">
                                    Great Deals & Savings
                                </h3>
                                <p className="text-[10px] font-bold tracking-widest opacity-90 mt-1">THE PRICES YOU LOVE • EVERY DAY</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4">
                        {viewMode === 'list' ? (
                            <div className="space-y-2">
                                {sortedSaleItems.map((item) => (
                                    <div key={item.id} className="bg-white rounded-xl border border-[var(--glass-border)] p-3 flex gap-4 items-center shadow-sm hover:shadow-md transition-all">
                                        <div className="w-16 h-16 rounded-lg bg-gray-50 flex-shrink-0 relative overflow-hidden">
                                            <img src={item.productImage || item.image} className="w-full h-full object-contain" loading="lazy" />
                                            <div className="absolute top-0 left-0 bg-teal-600 text-white text-[8px] font-black px-1 rounded-br">Sale</div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-[var(--text-main)] truncate">{item.productName || item.name}</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-sm font-black text-teal-600">${(item.salePrice ?? item.price).toFixed(2)}</span>
                                                {item.originalPrice && <span className="text-[10px] text-gray-500 line-through">Reg ${item.originalPrice.toFixed(2)}</span>}
                                            </div>
                                        </div>
                                        <button onClick={() => handleQuickAdd(item)} className="px-4 py-2 bg-teal-600 text-white text-xs font-black rounded tracking-widest shadow-md">
                                            + ADD
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                                {sortedSaleItems.map((item, idx) => {
                                    const isFeatured = idx < 2;
                                    const sPrice = item.salePrice ?? item.price;
                                    const oPrice = item.originalPrice || sPrice * 1.15;
                                    const savingsAmount = (oPrice - sPrice).toFixed(2);

                                    return (
                                        <div key={item.id} className={`relative group bg-white border-2 ${isFeatured ? 'col-span-2 md:col-span-2 border-red-200' : 'border-gray-100'} p-3 flex flex-col shadow-sm transition-all hover:shadow-xl`}>
                                            {/* Savings Badge */}
                                            <div className={`absolute -top-3 -right-3 ${isFeatured ? 'w-16 h-16 md:w-20 md:h-20' : 'w-12 h-12 md:w-14 md:h-14'} z-20 bg-yellow-400 rounded-full flex flex-col items-center justify-center border-4 border-white shadow-lg rotate-12`}>
                                                <span className="text-[8px] md:text-[10px] font-black text-teal-700 -mb-1">Save</span>
                                                <span className={`${isFeatured ? 'text-lg md:text-2xl' : 'text-xs md:text-lg'} font-black text-teal-700 leading-none`}>${Math.floor(Number(savingsAmount))}</span>
                                            </div>

                                            <div className={`${isFeatured ? 'h-40 md:h-56' : 'h-32 md:h-40'} mb-3 bg-white overflow-hidden`}>
                                                <img src={item.productImage || item.image} className="w-full h-full object-contain group-hover:scale-105 transition-all duration-500" />
                                            </div>

                                            <div className="flex-1 flex flex-col px-1">
                                                <div className="flex items-start gap-2 mb-1">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] md:text-[10px] font-black bg-blue-600 text-white px-1 w-max rounded-sm tracking-tighter">Sale</span>
                                                        <span className={`${isFeatured ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'} font-black text-blue-700 tracking-tighter leading-none`}>
                                                            {sPrice.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="mt-4">
                                                        <span className="text-[10px] font-bold text-gray-400 line-through">Reg {oPrice.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                <p className={`${isFeatured ? 'text-sm md:text-lg' : 'text-xs md:text-sm'} font-black text-gray-800 leading-snug grow`}>
                                                    {item.productName || item.name}
                                                </p>
                                                <button onClick={() => handleQuickAdd(item)} className="w-full mt-2 py-2 md:py-3 bg-blue-600 text-white text-[10px] md:text-xs font-black rounded tracking-widest hover:bg-black transition-all shadow-md">
                                                    + ADD TO CART
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* DEALS FOOTER */}
            <div className="bg-gray-100 p-8 text-center text-xs text-gray-500 border-t border-gray-200 mt-8">
                <p className="font-bold tracking-widest mb-2">Exclusive Deals for Our Customers</p>
                <p className="max-w-2xl mx-auto">Flash sales are available for a limited time only. Prices and availability are subject to change. We reserve the right to limit quantities per customer.</p>
                <div className="flex justify-center gap-6 py-4 opacity-40 grayscale">
                    <span className="text-2xl">🔥</span>
                    <span className="text-2xl">⚡</span>
                    <span className="text-2xl">🏷️</span>
                </div>
                <p className="mt-4 text-[10px] opacity-70">© {new Date().getFullYear()} {storeName} • Powering Local Savings</p>
            </div>
        </div>
    );
};


const StoreDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation(); // Add useLocation import
    const { addToCart } = useCart();
    const { getStore } = useMarketplace();
    const { reviews, fetchReviews } = useReviews();

    useEffect(() => {
        if (id) {
            fetchReviews(id);
        }
    }, [id, fetchReviews]);

    useEffect(() => {
        if (!id) return;
        const today = new Date().toISOString().slice(0, 10);
        const ref = doc(db, 'stores', id, 'analytics', today);
        setDoc(ref, { views: increment(1), date: today }, { merge: true }).catch(() => {});
    }, [id]);


    const store = getStore(id || '') || null;
    const { products: catalogProducts, loading: loadingProducts } = useStoreProducts(id || '');

    // Check for initial tab in state
    const [activeTab, setActiveTab] = useState<'products' | 'flyer' | 'offers' | 'reviews' | 'info'>((location.state as any)?.initialTab || 'products');
    const [activeCategory, setActiveCategory] = useState('All');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    if (!store) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <p className="text-4xl mb-4">🏪</p>
                    <p className="text-[var(--text-muted)] mb-4">Store not found.</p>
                    <button onClick={() => navigate('/')} className="text-[var(--brand-primary)] hover:underline">Return Home</button>
                </div>
            </div>
        );
    }

    // Merge or Override products
    // Only fallback to legacy if the store hasn't been migrated (indicated by missing productCount)
    // If productCount is 0, it means it's a migrated store with empty inventory, so show empty.
    const isMigrated = store.productCount !== undefined;
    const displayProducts = isMigrated ? catalogProducts : (catalogProducts.length > 0 ? catalogProducts : (store.products || []));

    const filteredProducts = activeCategory === 'All'
        ? displayProducts
        : displayProducts.filter((p: any) => {
            // map category ID to name if needed, or simple check
            // For now assuming category field matches or we need a map
            // The hook returns 'category' as 'cat-id', but UI expects 'Dairy'. 
            // We might need to fetch category map. For now let's just show all if name mismatch or fix in hook.
            // Simplified:
            return p.category === activeCategory || (p.category && p.category.includes(activeCategory));
        });

    const handleQuickAdd = (product: any) => {
        addToCart({
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity: 1,
            storeId: store.id,
            storeName: store.name,
            image: product.image,
            is_canadian_local: product.is_canadian_local
        });
    };

    return (
        <div className="animate-fade-in pb-20 bg-gray-50/30 min-h-screen">
            <SEO title={store.name} description={`Shop at ${store.name} on Spendigo. Browse products, weekly flyers, and deals from this local store.`} path={`/store/${store.id}`} />
            
            {/* IMMERSIVE RETAIL HEADER */}
            <div className="relative h-72 md:h-96 lg:h-[400px] bg-gray-900 group">
                <img 
                    src={store.image} 
                    alt={store.name} 
                    className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity duration-700" 
                    decoding="async" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent"></div>

                {/* Premium Back Button */}
                <button
                    onClick={() => navigate('/')}
                    className="absolute top-6 left-6 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center gap-2 hover:bg-white/20 transition-all shadow-2xl z-50 group/back"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span>
                    <span className="text-[10px] font-black tracking-widest">Marketplace</span>
                </button>

                {/* Floating Store Identity */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-10 pb-12 md:pb-16">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-8">
                        {/* THE STORE SIGN */}
                        <div className="relative group/logo">
                            <div className="absolute -inset-1 bg-gradient-to-r from-teal-600 to-teal-400 rounded-3xl blur opacity-25 group-hover/logo:opacity-50 transition duration-1000 group-hover/logo:duration-200"></div>
                            <div className="w-20 h-20 md:w-32 md:h-32 relative rounded-3xl bg-white flex items-center justify-center text-3xl md:text-5xl shadow-2xl overflow-hidden border-4 border-white ring-4 ring-black/5">
                                {((store.logoUrl || store.logo || '').startsWith('http') || (store.logoUrl || store.logo || '').startsWith('/') || (store.logoUrl || store.logo || '').startsWith('data:')) ? (
                                    <img src={store.logoUrl || store.logo} alt="Logo" className="w-full h-full object-cover p-2" decoding="async" />
                                ) : (
                                    <span className="font-black text-gray-900">{store.logo || store.logoUrl || '🏪'}</span>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 pb-2">
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                <span className="text-[9px] font-black bg-blue-600 text-white px-2 py-0.5 rounded skew-x-[-12deg] shadow-lg tracking-widest">Verified Store</span>
                                <span className="text-[9px] font-black bg-white/10 backdrop-blur-md text-white px-2 py-0.5 rounded border border-white/20 tracking-widest">Open Now</span>
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none mb-2 drop-shadow-2xl italic">
                                {store.name}
                            </h1>
                            <p className="text-sm md:text-lg text-white/70 font-bold italic tracking-tight max-w-xl">{store.tagline}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* PREMIUM RETAIL INFO BOARD */}
            <div className="max-w-7xl mx-auto px-4 -mt-10 relative z-30">
                <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-1 md:p-3 flex flex-nowrap items-stretch gap-1">
                    <div className="flex-1 min-w-0 bg-gray-50/50 p-2 md:p-4 rounded-xl border border-gray-50 flex flex-col items-center justify-center text-center group hover:bg-black hover:shadow-lg transition-all">
                        <span className="text-[7px] md:text-[9px] font-black text-gray-600 tracking-widest mb-0.5 md:mb-1 group-hover:text-white/70 transition-colors">Store</span>
                        <div className="flex items-center gap-0.5 md:gap-2">
                            <span className="text-xs md:text-xl font-black text-gray-900 group-hover:text-white transition-colors">
                                {reviews.length > 0 
                                    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
                                    : store.rating}
                            </span>
                            <span className="text-yellow-400 text-[10px] md:text-lg group-hover:scale-125 transition-transform">★</span>
                        </div>
                    </div>
                    <div className="w-px bg-gray-100 hidden md:block my-2"></div>
                    <div className="flex-1 min-w-0 bg-gray-50/50 p-2 md:p-4 rounded-xl border border-gray-50 flex flex-col items-center justify-center text-center group hover:bg-black hover:shadow-lg transition-all">
                        <span className="text-[7px] md:text-[9px] font-black text-gray-600 tracking-widest mb-0.5 md:mb-1 group-hover:text-white/70 transition-colors truncate w-full px-1">Delivery</span>
                        <div className="flex items-center gap-0.5 md:gap-2">
                            <span className="text-xs md:text-xl font-black text-gray-900 group-hover:text-white transition-colors line-clamp-1 truncate px-1 max-w-full">{store.deliveryTime?.replace('MIN', '') || '25-45'}</span>
                            <span className="text-orange-500 text-[10px] md:text-lg group-hover:animate-pulse">⚡</span>
                        </div>
                    </div>
                    <div className="w-px bg-gray-100 hidden md:block my-2"></div>
                    <div className="flex-1 min-w-0 bg-gray-50/50 p-2 md:p-4 rounded-xl border border-gray-50 flex flex-col items-center justify-center text-center group hover:bg-black hover:shadow-lg transition-all">
                        <span className="text-[7px] md:text-[9px] font-black text-gray-600 tracking-widest mb-0.5 md:mb-1 group-hover:text-white/70 transition-colors">Fee</span>
                        <div className="flex items-center gap-0.5 md:gap-2">
                            <span className="text-xs md:text-xl font-black text-gray-900 group-hover:text-white transition-colors">{store.deliveryFee || 'FREE'}</span>
                            <span className="text-green-500 text-[10px] md:text-lg group-hover:rotate-12 transition-transform">💰</span>
                        </div>
                    </div>
                    <div className="w-px bg-gray-100 hidden md:block my-2"></div>
                    <div className="flex-1 min-w-0 bg-blue-600 p-2 md:p-4 rounded-xl flex flex-col items-center justify-center text-center shadow-lg group hover:bg-black transition-all cursor-help" title="Quality Guaranteed by Spendigo">
                        <span className="text-[7px] md:text-[9px] font-black text-white/70 tracking-widest mb-0.5 md:mb-1 leading-tight">Certified By</span>
                        <span className="text-[10px] md:text-lg font-black text-white italic tracking-tighter truncate max-w-[90%]">Spendigo🍁</span>
                    </div>
                </div>
            </div>

            {/* HIGH-IMPACT STICKY NAVIGATION */}
            <div className="sticky top-14 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-4 mt-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        {[
                            { id: 'products', label: 'Store Items', icon: '🛒' },
                            { id: 'flyer', label: 'Weekly Flyer', icon: '📰', badge: isFlyerActive(store.flyer) },
                            { id: 'offers', label: 'Flash Deals', icon: '🔥', badge: filterActiveDeals([...(store.oneDayOffers || []), ...(store.saleItems || [])]).length > 0 },
                            { id: 'reviews', label: 'Shopper Voice', icon: '⭐' },
                            { id: 'info', label: 'Store Info', icon: 'ℹ️' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-5 py-2.5 rounded-full text-xs font-semibold transition-all duration-150 whitespace-nowrap flex items-center gap-2 relative ${activeTab === tab.id
                                    ? 'bg-[var(--brand-primary)] text-white shadow-md'
                                    : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                            >
                                <span className={activeTab === tab.id ? 'scale-110' : 'opacity-80'}>{tab.icon}</span>
                                {tab.label}
                                {tab.badge && (
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-teal-600 rounded-full border-2 border-white animate-pulse"></span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Shared View Toggle UI - Redesigned */}
                    {(activeTab === 'products' || activeTab === 'flyer' || activeTab === 'offers') && (
                        <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 w-fit">
                            <span className="text-[9px] font-black text-gray-400 tracking-widest px-2 hidden lg:block">Layout:</span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow-md text-teal-600 shadow-teal-600/5' : 'text-gray-400'}`}
                                    title="Grid View"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow-md text-teal-600 shadow-teal-600/5' : 'text-gray-400'}`}
                                    title="List View"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'products' && (
                <div className="animate-fade-in">
                    {/* Premium Category Filters */}
                    <div className="px-4 py-4 bg-white border-b border-gray-100 flex items-center gap-4">
                        <span className="text-[10px] font-black text-gray-600 tracking-widest whitespace-nowrap">Filter By:</span>
                        <div className="overflow-x-auto scrollbar-hide flex gap-2 pb-1">
                            {store.categories.map((cat: string) => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${activeCategory === cat
                                        ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm'
                                        : 'bg-[var(--surface-2)] text-[var(--text-main)] border-[var(--glass-border)] hover:border-[var(--brand-primary)]'}`}
                                >
                                    {cat.replace(/^cat-/, '').replace(/-/g, ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Grid/List View */}
                    <div className="p-4 bg-gray-50/50 min-h-screen">
                        {filteredProducts.length === 0 ? (
                            <EmptyState icon="🛒" heading="No items in this aisle" subtext="Try a different category or check back later." />
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                                {filteredProducts.map((product: any) => {
                                    const savingsAmount = product.originalPrice ? (product.originalPrice - product.price).toFixed(2) : null;
                                    const savingsPercent = product.originalPrice ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
                                    const isOutOfStock = product.available_quantity !== undefined && product.available_quantity <= 0;

                                    return (
                                        <div 
                                            key={product.id} 
                                            className={`relative group bg-white border-2 border-gray-100 p-3 flex flex-col shadow-sm transition-all hover:shadow-xl hover:z-10 ${isOutOfStock ? 'opacity-75 grayscale-[0.5]' : ''}`}
                                        >
                                            {/* Retail Savings Sticker */}
                                            {savingsPercent >= 10 && !isOutOfStock && (
                                                <div className="absolute -top-2 -right-2 w-12 h-12 z-20 bg-yellow-400 rounded-full flex flex-col items-center justify-center border-4 border-white shadow-lg rotate-12 group-hover:rotate-0 transition-transform">
                                                    <span className="text-[10px] font-black text-teal-700 leading-none">-{savingsPercent}%</span>
                                                </div>
                                            )}

                                            {/* Product Image Section */}
                                            <div 
                                                onClick={() => navigate(`/product/${product.id}`)} 
                                                className="h-32 md:h-44 bg-white relative cursor-pointer overflow-hidden p-2 flex items-center justify-center bg-gradient-to-b from-gray-50/30 to-white"
                                            >
                                                <img
                                                    src={product.image}
                                                    alt={product.name}
                                                    className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-500"
                                                    loading="lazy"
                                                />
                                                {product.originalPrice && !isOutOfStock && (
                                                    <div className="absolute top-2 left-2 bg-teal-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded skew-x-[-10deg] shadow-lg">
                                                        HOT DEAL
                                                    </div>
                                                )}
                                                {isOutOfStock && (
                                                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 backdrop-blur-[1px]">
                                                        <span className="bg-gray-800 text-white text-[10px] font-black px-3 py-1 rounded-full tracking-widest shadow-xl">
                                                            Restocking
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-1 mt-2 flex-1 flex flex-col">
                                                {/* Meta Info */}
                                                <div className="flex items-center gap-1 mb-1 min-h-[14px]">
                                                    {product.is_canadian_local && (
                                                        <span className="text-[9px] font-black text-teal-600 bg-teal-50 px-1 rounded border border-teal-100 flex items-center gap-0.5 shadow-sm">
                                                            🍁 CANADIAN
                                                        </span>
                                                    )}
                                                </div>

                                                <p 
                                                    onClick={() => navigate(`/product/${product.id}`)} 
                                                    className="font-black text-xs md:text-sm text-gray-800 tracking-tight leading-snug grow cursor-pointer hover:text-teal-600 transition-colors line-clamp-2"
                                                >
                                                    {product.name}
                                                </p>

                                                {/* Pricing Block */}
                                                <div className="mt-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-xl md:text-2xl font-black text-[var(--brand-primary)] tracking-tighter">${product.price.toFixed(2)}</span>
                                                        {product.originalPrice && (
                                                            <span className="text-[10px] text-gray-400 line-through decoration-teal-600/30 font-bold">Reg {product.originalPrice.toFixed(2)}</span>
                                                        )}
                                                    </div>
                                                    {savingsAmount && Number(savingsAmount) > 0 && !isOutOfStock && (
                                                        <p className="text-xs font-semibold text-green-600">You Save ${savingsAmount}</p>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => !isOutOfStock && handleQuickAdd(product)}
                                                    disabled={isOutOfStock}
                                                    className={`w-full mt-3 py-2 md:py-3 text-xs font-bold rounded-full tracking-wide shadow-sm transition-all active:scale-95 ${isOutOfStock
                                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                                                        : 'bg-[var(--brand-primary)] text-white hover:brightness-110'
                                                        }`}
                                                >
                                                    {isOutOfStock ? 'Sold Out' : '+ Add to Trolley'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* List View Redesign */
                            <div className="space-y-3">
                                {filteredProducts.map((product: any) => {
                                    const isOutOfStock = product.available_quantity !== undefined && product.available_quantity <= 0;
                                    return (
                                        <div key={product.id} className={`bg-white rounded-xl border-2 border-gray-100 p-3 flex gap-4 items-center shadow-sm hover:shadow-lg transition-all ${isOutOfStock ? 'opacity-70' : ''}`}>
                                            <div 
                                                onClick={() => navigate(`/product/${product.id}`)} 
                                                className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-gray-50 flex-shrink-0 cursor-pointer overflow-hidden p-1 flex items-center justify-center border border-gray-100 relative"
                                            >
                                                <img src={product.image} alt={product.name} className="max-w-full max-h-full object-contain" />
                                                {isOutOfStock && <div className="absolute inset-0 bg-white/40 z-10"></div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p onClick={() => navigate(`/product/${product.id}`)} className="font-black text-xs md:text-sm text-gray-800 truncate cursor-pointer hover:text-teal-600">{product.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {product.is_canadian_local && (
                                                        <span className="text-[8px] font-black text-teal-600 bg-teal-50 px-1 rounded border border-teal-100">🍁 LOCAL</span>
                                                    )}
                                                    {product.originalPrice && (
                                                        <span className="text-[8px] font-black bg-teal-600 text-white px-1.5 py-0.5 rounded-sm skew-x-[-12deg]">Sale</span>
                                                    )}
                                                </div>
                                                <div className="flex items-baseline gap-2 mt-0.5">
                                                    <span className="text-lg font-black text-[var(--brand-primary)] tracking-tighter">${product.price.toFixed(2)}</span>
                                                    {product.originalPrice && (
                                                        <span className="text-[10px] text-gray-400 line-through font-bold">Reg ${product.originalPrice.toFixed(2)}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => !isOutOfStock && handleQuickAdd(product)}
                                                disabled={isOutOfStock}
                                                className={`px-4 md:px-6 py-2.5 rounded-full text-xs font-bold tracking-wide shadow-sm transition-all active:scale-95 ${isOutOfStock
                                                    ? 'bg-gray-100 text-gray-400 border border-gray-200'
                                                    : 'bg-[var(--brand-primary)] text-white hover:brightness-110'
                                                    }`}
                                            >
                                                {isOutOfStock ? 'Out' : '+ Add'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'flyer' && (
                <FlyerTab storeId={store.id} storeName={store.name} summary={store.flyer} viewMode={viewMode} />
            )}

            {activeTab === 'offers' && (
                <OffersTab storeId={store.id} storeName={store.name} viewMode={viewMode} />
            )}

            {activeTab === 'reviews' && (
                <div className="p-4 max-w-2xl mx-auto space-y-10 animate-fade-in">
                    {/* Premium Rating Distribution Summary */}
                    <div className="bg-white p-8 rounded-3xl border-2 border-gray-100 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                        
                        <div className="flex flex-col md:flex-row gap-10 items-center relative z-10">
                            <div className="text-center md:border-r-2 md:border-gray-50 md:pr-10">
                                <h4 className="text-7xl font-black text-gray-900 tracking-tighter mb-1">
                                    {reviews.length > 0 
                                        ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
                                        : store.rating}
                                </h4>
                                <div className="flex justify-center mb-2">
                                    <StarRating 
                                        rating={reviews.length > 0 
                                            ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length 
                                            : store.rating} 
                                        size="lg" 
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400 font-black tracking-[0.2em]">
                                    {reviews.length || store.reviewCount || 0} TOTAL REVIEWS
                                </p>
                            </div>

                            <div className="flex-1 w-full space-y-3">
                                {[5, 4, 3, 2, 1].map(stars => {
                                    const count = reviews.filter(r => Math.round(r.rating) === stars).length;
                                    const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;

                                    return (
                                        <div key={stars} className="flex items-center gap-4">
                                            <div className="flex items-center gap-1 w-8">
                                                <span className="text-xs font-black text-gray-700">{stars}</span>
                                                <span className="text-yellow-400 text-xs">★</span>
                                            </div>
                                            <div className="flex-1 h-3 bg-gray-50 rounded-full overflow-hidden border border-gray-100 shadow-inner">
                                                <div
                                                    className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-1000 ease-out shadow-sm"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-black text-gray-400 w-8 text-right font-mono">{pct}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Review Form Wrapper */}
                    <div className="bg-gray-50 p-1 rounded-3xl border border-gray-100">
                        <ReviewForm targetId={store.id} targetType="store" />
                    </div>

                    {/* Review List Section */}
                    <div className="pt-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b-2 border-gray-100 pb-4">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 tracking-tight m-0">Customer Voice</h3>
                                <p className="text-xs text-gray-400 font-bold tracking-widest mt-1">Real Feedback from Your Community</p>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                                <span className="text-[10px] font-black text-gray-400 tracking-widest whitespace-nowrap">Sort:</span>
                                <select className="text-xs font-black bg-transparent border-none outline-none text-gray-900 cursor-pointer">
                                    <option>Most Recent</option>
                                    <option>Highest Rated</option>
                                    <option>Most Helpful</option>
                                </select>
                            </div>
                        </div>
                        <ReviewList targetId={store.id} targetType="store" />
                    </div>
                </div>
            )}

            {activeTab === 'info' && (
                <div className="p-4 max-w-4xl mx-auto animate-fade-in space-y-6">
                    <div className="bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-gray-100">
                        <h2 className="text-3xl font-black text-gray-900 mb-8 italic tracking-tight">About {store.name}</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Location Section */}
                            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
                                <h3 className="text-sm font-black tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                                    <span className="text-xl">📍</span> LOCATION
                                </h3>
                                <p className="text-lg font-black text-gray-900 mb-1">{store.address}</p>
                                <p className="text-sm font-bold text-gray-600">{store.city}, {store.province}</p>
                                <p className="text-sm font-bold text-gray-600">{store.postalCode}</p>
                            </div>

                            {/* Delivery & Fees */}
                            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
                                <h3 className="text-sm font-black tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                                    <span className="text-xl">🚚</span> DELIVERY SERVICES
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                                        <span className="font-bold text-gray-700 text-sm">Delivery Available</span>
                                        <span className="font-black text-teal-700 bg-teal-100 px-3 py-1 rounded-full text-[10px] tracking-widest shadow-sm">YES</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                                        <span className="font-bold text-gray-700 text-sm">Estimated Time</span>
                                        <span className="font-black text-gray-900">{store.deliveryTime || '30-45 MIN'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-gray-700 text-sm">Delivery Fee</span>
                                        <span className="font-black text-gray-900">{store.deliveryFee || 'Free'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Opening Hours */}
                            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 md:col-span-2 hover:shadow-md transition-shadow">
                                <h3 className="text-sm font-black tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                                    <span className="text-xl">⏰</span> STORE HOURS
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, idx) => (
                                        <div key={day} className="flex justify-between items-center text-sm border-b border-gray-200 pb-2 sm:border-0 sm:pb-0">
                                            <span className="font-bold text-gray-500 w-12">{day.substring(0, 3)}</span>
                                            <span className="font-black text-gray-900">{store.hours?.[day] || '8:00 AM - 10:00 PM'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoreDetail;
