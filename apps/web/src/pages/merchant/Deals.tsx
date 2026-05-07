import React, { useState, useMemo } from 'react';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { doc, writeBatch, serverTimestamp, updateDoc, deleteField } from 'firebase/firestore';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { useStoreProducts } from '../../hooks/useStoreProducts';

// Types
type DealType = 'percentage' | 'fixed' | 'bogo';

interface Deal {
    id: string;
    productId: string;
    productName: string;
    productImage: string;
    category: string;

    type: DealType;
    value: number;
    bogoType?: '1_1' | '2_1' | '50_2nd' | null;

    originalPrice: number;
    salePrice: number;

    startDate: string;
    endDate: string;

    isFlashSale: boolean;
    status: 'active' | 'scheduled' | 'expired';

    stats: {
        views: number;
        claims: number;
    };
}

const INITIAL_DEALS: Deal[] = [
    {
        id: 'd1',
        productId: 'p_mc_1',
        productName: 'Organic Avocados (5pk)',
        productImage: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=300&h=300&fit=crop',
        category: 'Fresh Produce',
        type: 'percentage',
        value: 20,
        originalPrice: 8.99,
        salePrice: 7.19,
        startDate: '2025-12-16T09:00',
        endDate: '2025-12-23T18:00',
        isFlashSale: false,
        status: 'active',
        stats: { views: 245, claims: 42 }
    }
];

const MerchantDeals: React.FC = () => {
    const { getStore, updateStoreDeals, subscribeToDeals, saveDeal, deleteDeal } = useMarketplace();
    const can = (action: string) => true;
    const { user } = useAuth();
    const storeId = user?.storeId || '1';
    const { confirm } = useConfirmation();
    const store = getStore(storeId);
    // const availableProducts = useMemo(() => store?.products || [], [store?.products]);
    const { products: availableProducts } = useStoreProducts(storeId);
    const hasWriteAccess = true;


    const isRestrictedPlan = (user?.subscriptionTier || 'free') !== 'growth';

    const [deals, setDeals] = useState<Deal[]>([]); // Initial empty, populated by subscription
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'scheduled' | 'expired'>('all');
    const [isSyncing, setIsSyncing] = useState(false);
    const { addNotification } = useNotifications();

    // Subscribe to Deals
    const getEffectiveStatus = (deal: Partial<Deal>): Deal['status'] => {
        const now = new Date();
        const start = deal.startDate ? new Date(deal.startDate) : now;
        const end = deal.endDate ? new Date(deal.endDate) : null;

        if (end && end < now) return 'expired';
        if (start > now) return 'scheduled';
        return 'active';
    };

    React.useEffect(() => {
        if (!storeId) return;
        const unsubscribe = subscribeToDeals(storeId, (data) => {
            const normalized = (data as Deal[]).map(d => ({
                ...d,
                status: getEffectiveStatus(d)
            }));
            setDeals(normalized);
        });
        return () => unsubscribe();
    }, [storeId, subscribeToDeals]);

    // Wizard State
    const [showWizard, setShowWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState<1 | 2>(1);

    // Form State
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [pickerSearch, setPickerSearch] = useState('');

    const [dealConfig, setDealConfig] = useState({
        type: 'percentage' as DealType,
        value: '20',
        bogoType: '1_1' as const,
        startDate: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        endDate: '',
        isFlashSale: false
    });

    const filteredDeals = useMemo(() => {
        if (filterStatus === 'all') return deals;
        return deals.filter(d => d.status === filterStatus);
    }, [deals, filterStatus]);

    const filteredPickerProducts = useMemo(() => {
        if (!pickerSearch) return availableProducts;
        return availableProducts.filter((p: any) =>
            p.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
            p.category.toLowerCase().includes(pickerSearch.toLowerCase())
        );
    }, [pickerSearch, availableProducts]);

    const calculateStats = () => {
        return {
            totalActive: deals.filter(d => d.status === 'active').length,
            totalViews: deals.reduce((acc, d) => acc + d.stats.views, 0),
            totalClaims: deals.reduce((acc, d) => acc + d.stats.claims, 0)
        };
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700 border border-green-200';
            case 'scheduled': return 'bg-blue-100 text-blue-700 border border-blue-200';
            case 'expired': return 'bg-red-100 text-red-700 border border-red-200';
            default: return 'bg-gray-100 text-gray-600 border border-gray-200';
        }
    };

    const getDealLabel = (deal: Deal) => {
        if (deal.type === 'bogo') {
            if (deal.bogoType === '1_1') return 'BUY 1 GET 1 FREE';
            if (deal.bogoType === '2_1') return 'BUY 2 GET 1 FREE';
            if (deal.bogoType === '50_2nd') return 'BUY 1 GET 2nd 50% OFF';
        }
        if (deal.type === 'fixed') return `FIXED PRICE: $${deal.value}`;
        return `${deal.value}% OFF`;
    };

    const calculateSalePrice = (original: number, type: DealType, value: number) => {
        if (type === 'fixed') return value;
        if (type === 'percentage') return original * (1 - value / 100);
        return original;
    };

    const handleProductSelect = (product: any) => {
        setSelectedProduct(product);
        setWizardStep(2);
        const end = new Date();
        end.setDate(end.getDate() + 3);
        setDealConfig(prev => ({ ...prev, endDate: end.toISOString().slice(0, 16) }));
    };

    const handleCreateDeal = async () => {
        if (!selectedProduct || !dealConfig.endDate) return;

        const originalPrice = selectedProduct.originalPrice || selectedProduct.price || 0;
        const valueNum = parseFloat(dealConfig.value);
        const salePrice = calculateSalePrice(originalPrice, dealConfig.type, valueNum);

        const now = new Date();
        const start = new Date(dealConfig.startDate);
        const end = new Date(dealConfig.endDate);

        const status = getEffectiveStatus({ startDate: dealConfig.startDate, endDate: dealConfig.endDate });

        const newDeal: Deal = {
            id: `d${Date.now()}`,
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            productImage: selectedProduct.image,
            category: selectedProduct.category,
            type: dealConfig.type,
            value: valueNum,
            bogoType: dealConfig.type === 'bogo' ? dealConfig.bogoType : null,
            originalPrice: originalPrice,
            salePrice: salePrice,
            startDate: dealConfig.startDate,
            endDate: dealConfig.endDate,
            isFlashSale: dealConfig.isFlashSale,
            status: status,
            stats: { views: 0, claims: 0 }
        };

        // 1. Save Full Config for Merchant
        try {
            await saveDeal(storeId, newDeal);

            // 2. Sync with Global Marketplace Context (Consumer View)
            if (status === 'active') {
                if (newDeal.isFlashSale) {
                    const currentOffers = store?.oneDayOffers || [];
                    const hours = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60)));

                    const updatedOffers = [...currentOffers, {
                        id: newDeal.id,
                        productId: newDeal.productId,
                        name: newDeal.productName,
                        price: newDeal.salePrice,
                        originalPrice: newDeal.originalPrice,
                        endsIn: `${hours} hours`,
                        image: newDeal.productImage,
                        validUntil: newDeal.endDate
                    }];
                    updateStoreDeals(storeId, 'oneDayOffers', updatedOffers);
                } else {
                    const currentSales = store?.saleItems || [];
                    const updatedSales = [...currentSales, {
                        id: newDeal.id,
                        productId: newDeal.productId,
                        name: newDeal.productName,
                        price: newDeal.salePrice,
                        originalPrice: newDeal.originalPrice,
                        discount: `${newDeal.value}% OFF`,
                        image: newDeal.productImage,
                        validUntil: newDeal.endDate
                    }];
                    updateStoreDeals(storeId, 'saleItems', updatedSales);
                }

                // 3. Sync individual merchant product document
                const pRef = doc(db, 'merchant_products', newDeal.productId);
                await updateDoc(pRef, {
                    price: newDeal.salePrice,
                    sale_price: newDeal.salePrice, // Explicitly set for trigger robustness
                    on_sale: true,                 // Explicitly set for trigger robustness
                    original_price: newDeal.originalPrice,
                    discount_label: newDeal.type === 'percentage' ? `${newDeal.value}% OFF` : 'Special Offer',
                    discount_valid_until: newDeal.endDate,
                    updated_at: serverTimestamp()
                });
            }

            closeWizard();
        } catch (error) {
            console.error("Failed to save deal:", error);
            addNotification({
                type: 'alert',
                title: 'Save Failed',
                message: `Failed to save deal. Error: ${(error as Error).message}`
            });
        }
    };

    const handleExtendDeal = async (deal: Deal) => {
        const confirmed = await confirm({
            title: 'Extend Deal?',
            message: `Do you want to extend "${deal.productName}" for another 3 days? It will be reactivated immediately.`,
            confirmText: 'Extend 3 Days',
            type: 'info'
        });

        if (confirmed) {
            try {
                const now = new Date();
                const newEnd = new Date();
                newEnd.setDate(newEnd.getDate() + 3);
                const endDateStr = newEnd.toISOString().slice(0, 16);

                const updatedDeal: Deal = {
                    ...deal,
                    endDate: endDateStr,
                    status: 'active'
                };

                // 1. Update Merchant DB
                await saveDeal(storeId, updatedDeal);

                // 2. Sync with Global Marketplace Context (Immediate UX)
                if (updatedDeal.isFlashSale) {
                    const currentOffers = store?.oneDayOffers || [];
                    const hours = Math.max(1, Math.ceil((newEnd.getTime() - now.getTime()) / (1000 * 60 * 60)));
                    const updatedOffers = [...currentOffers.filter((o: any) => o.id !== deal.id), {
                        id: updatedDeal.id,
                        productId: updatedDeal.productId,
                        name: updatedDeal.productName,
                        price: updatedDeal.salePrice,
                        originalPrice: updatedDeal.originalPrice,
                        endsIn: `${hours} hours`,
                        image: updatedDeal.productImage,
                        validUntil: updatedDeal.endDate
                    }];
                    updateStoreDeals(storeId, 'oneDayOffers', updatedOffers);
                } else {
                    const currentSales = store?.saleItems || [];
                    const updatedSales = [...currentSales.filter((s: any) => s.id !== deal.id), {
                        id: updatedDeal.id,
                        productId: updatedDeal.productId,
                        name: updatedDeal.productName,
                        price: updatedDeal.salePrice,
                        originalPrice: updatedDeal.originalPrice,
                        discount: updatedDeal.type === 'percentage' ? `${updatedDeal.value}% OFF` : 'Special Offer',
                        image: updatedDeal.productImage,
                        validUntil: updatedDeal.endDate
                    }];
                    updateStoreDeals(storeId, 'saleItems', updatedSales);
                }

                // 3. Update individual merchant product document
                const pRef = doc(db, 'merchant_products', updatedDeal.productId);
                await updateDoc(pRef, {
                    price: updatedDeal.salePrice,
                    sale_price: updatedDeal.salePrice,
                    on_sale: true,
                    original_price: updatedDeal.originalPrice,
                    discount_label: updatedDeal.type === 'percentage' ? `${updatedDeal.value}% OFF` : 'Special Offer',
                    discount_valid_until: updatedDeal.endDate,
                    updated_at: serverTimestamp()
                });

                addNotification({
                    type: 'system',
                    title: 'Deal Extended',
                    message: `"${deal.productName}" has been extended by 3 days.`
                });
            } catch (error) {
                console.error("Failed to extend deal:", error);
                addNotification({
                    type: 'alert',
                    title: 'Extension Failed',
                    message: 'Could not extend the deal. Please try again.'
                });
            }
        }
    };

    const handleDeleteDeal = async (id: string) => {
        const dealToDelete = deals.find(d => d.id === id);
        
        const confirmed = await confirm({
            title: 'End this deal?',
            message: `Are you sure you want to end "${dealToDelete?.productName || 'this deal'}"? It will be removed from the marketplace immediately.`,
            confirmText: 'End Deal',
            type: 'danger'
        });

        if (confirmed) {
            try {
                // 1. Remove from Merchant DB
                await deleteDeal(storeId, id);

                // 2. Sync Removal with Global Store (Consumer View)
                if (dealToDelete && dealToDelete.status === 'active') {
                    if (dealToDelete.isFlashSale) {
                        const newOffers = (store?.oneDayOffers || []).filter((o: any) => o.id !== id);
                        updateStoreDeals(storeId, 'oneDayOffers', newOffers);
                    } else {
                        const newSales = (store?.saleItems || []).filter((s: any) => s.id !== id);
                        updateStoreDeals(storeId, 'saleItems', newSales);
                    }

                    // 3. Revert individual merchant product document
                    const pRef = doc(db, 'merchant_products', dealToDelete.productId);
                    await updateDoc(pRef, {
                        price: dealToDelete.originalPrice,
                        on_sale: false,
                        sale_price: deleteField(),
                        discount_label: deleteField(),
                        discount_valid_until: deleteField(),
                        updated_at: serverTimestamp()
                    });
                }

                addNotification({
                    type: 'system',
                    title: 'Deal Ended',
                    message: 'The deal has been successfully removed.'
                });
            } catch (error) {
                console.error("Failed to delete deal:", error);
                addNotification({
                    type: 'alert',
                    title: 'Delete Failed',
                    message: `Failed to delete deal. Error: ${(error as Error).message}`
                });
            }
        }
    };

    const [promotingDealId, setPromotingDealId] = useState<string | null>(null);

    const handlePromoteDeal = async (deal: Deal) => {
        const autoMessage = `New deal at ${store?.name || 'our store'}: ${deal.productName} — $${deal.salePrice.toFixed(2)} (was $${deal.originalPrice.toFixed(2)})!`;

        const confirmed = await confirm({
            title: 'Promote This Deal?',
            message: `Send a push notification to nearby customers:\n\n"${autoMessage}"`,
            confirmText: 'Send Now',
            type: 'info'
        });

        if (!confirmed) return;

        setPromotingDealId(deal.id);
        try {
            const sendCampaign = httpsCallable<
                { storeId: string; segment: string; message: string; title: string; dealId: string },
                { sentCount: number; failedCount: number }
            >(functions, 'sendCampaign');

            const result = await sendCampaign({
                storeId,
                segment: 'nearby',
                message: autoMessage,
                title: store?.name || 'Special Offer',
                dealId: deal.id,
            });

            addNotification({
                type: 'system',
                title: 'Campaign Sent',
                message: `Push notification sent to ${result.data.sentCount} nearby customer${result.data.sentCount !== 1 ? 's' : ''}.`
            });
        } catch (error: any) {
            addNotification({
                type: 'alert',
                title: 'Campaign Failed',
                message: error?.message || 'Could not send notification. Please try again.'
            });
        } finally {
            setPromotingDealId(null);
        }
    };

    const closeWizard = () => {
        setShowWizard(false);
        setWizardStep(1);
        setSelectedProduct(null);
        setDealConfig({
            type: 'percentage',
            value: '20',
            bogoType: '1_1',
            startDate: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
            endDate: '',
            isFlashSale: false
        });
    };

    const stats = calculateStats();

    return (
        <div className="p-4 sm:p-6 animate-fade-in pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="page-headline">🏷️ Deals & Offers</h1>
                    <p className="text-sm text-[var(--text-muted)]">Target customers with special limited-time offers</p>
                </div>
                {hasWriteAccess && !isRestrictedPlan && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <button
                            onClick={async () => {
                                if (isSyncing) return;
                                setIsSyncing(true);
                                try {
                                    // Add artificial delay for better UX
                                    await new Promise(resolve => setTimeout(resolve, 1000));

                                    const activeDeals = deals.filter(d => d.status === 'active');
                                    const oneDayOffers = activeDeals.filter(d => d.isFlashSale).map(d => ({
                                        id: d.id,
                                        productId: d.productId,
                                        name: d.productName,
                                        price: d.salePrice,
                                        originalPrice: d.originalPrice,
                                        endsIn: 'Ending soon',
                                        image: d.productImage,
                                        validUntil: d.endDate
                                    }));
                                    const saleItems = activeDeals.filter(d => !d.isFlashSale).map(d => ({
                                        id: d.id,
                                        productId: d.productId,
                                        name: d.productName,
                                        price: d.salePrice,
                                        originalPrice: d.originalPrice,
                                        discount: `${d.value}% OFF`,
                                        image: d.productImage,
                                        validUntil: d.endDate
                                    }));

                                    await updateStoreDeals(storeId, 'oneDayOffers', oneDayOffers);
                                    await updateStoreDeals(storeId, 'saleItems', saleItems);

                                    // 3. Batch Update Merchant Products to ensure they have the expiration field
                                    // This allows search and other views to correctly revert prices after expiration
                                    const batch = writeBatch(db);
                                    
                                    activeDeals.forEach(d => {
                                        const pRef = doc(db, 'merchant_products', d.productId);
                                        batch.update(pRef, {
                                            price: d.salePrice,
                                            sale_price: d.salePrice,
                                            on_sale: true,
                                            original_price: d.originalPrice,
                                            discount_label: d.type === 'percentage' ? `${d.value}% OFF` : 'Special Offer',
                                            discount_valid_until: d.endDate,
                                            updated_at: serverTimestamp()
                                        });
                                    });
                                    
                                    await batch.commit();

                                    addNotification({
                                        type: 'system',
                                        title: 'Listing Synced',
                                        message: 'Your store listing has been updated with active deals.'
                                    });
                                } catch (e) {
                                    console.error(e);
                                    addNotification({
                                        type: 'alert',
                                        title: 'Sync Failed',
                                        message: 'Could not sync deals. Please try again.'
                                    });
                                } finally {
                                    setIsSyncing(false);
                                }
                            }}
                            className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all border border-gray-200 flex items-center justify-center gap-2 w-full sm:w-auto"
                            disabled={isSyncing}
                        >
                            <span className={isSyncing ? 'animate-spin' : ''}>🔄</span>
                            {isSyncing ? 'Syncing...' : 'Sync Listing'}
                        </button>
                        <button
                            onClick={() => setShowWizard(true)}
                            className="px-4 py-2 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 transition-all w-full sm:w-auto justify-center flex items-center"
                        >
                            + Create New Deal
                        </button>
                    </div>
                )}
            </div>
            {isRestrictedPlan ? (

                <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <div className="text-6xl mb-4 grayscale opacity-50">🏷️</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Upgrade to Create Deals</h3>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">Deals and Flash Sales are premium features available exclusively on the Growth plan. Upgrade your subscription to engage more customers.</p>
                    <a href="/merchant/subscription" className="px-6 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 inline-block">
                        View Plans & Upgrade
                    </a>
                </div>
            ) : (
                <>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
                        <div className="glass-panel p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl text-blue-600">⚡</div>
                            <div>
                                <div className="text-2xl font-bold">{stats.totalActive}</div>
                                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold">Active Deals</div>
                            </div>
                        </div>
                        <div className="glass-panel p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-xl text-purple-600">👀</div>
                            <div>
                                <div className="text-2xl font-bold">{stats.totalViews}</div>
                                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold">Total Views</div>
                            </div>
                        </div>
                        <div className="glass-panel p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-xl text-green-600">🎟️</div>
                            <div>
                                <div className="text-2xl font-bold">{stats.totalClaims}</div>
                                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold">Claims Redeemed</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex overflow-x-auto gap-2 mb-6 border-b border-[var(--glass-border)] pb-4 whitespace-nowrap hide-scrollbar">
                        {(['all', 'active', 'scheduled', 'expired'] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors flex-shrink-0 ${filterStatus === status ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}
                            >
                                {status} Deals
                            </button>
                        ))}
                    </div>

                    <div className="space-y-4">
                        {filteredDeals.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-[var(--glass-border)]">
                                <div className="text-4xl mb-4 opacity-50">🏷️</div>
                                <p className="text-[var(--text-muted)]">No deals found with this status.</p>
                                {hasWriteAccess && (
                                    <button onClick={() => setShowWizard(true)} className="mt-4 text-[var(--brand-primary)] font-medium hover:underline">Create a deal now</button>
                                )}
                            </div>
                        ) : (
                            filteredDeals.map(deal => (
                                <div key={deal.id} className="bg-white rounded-xl border border-[var(--glass-border)] p-4 sm:p-5 hover:shadow-md transition-shadow">
                                    <div className="flex flex-col md:flex-row gap-4 sm:gap-6 items-start md:items-center justify-between">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="relative">
                                                <img src={deal.productImage} className="w-16 h-16 rounded-xl object-cover bg-gray-100" alt="" />
                                                {deal.isFlashSale && (
                                                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white flex items-center justify-center rounded-full text-xs shadow-sm" title="Flash Sale">⚡</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-bold text-[var(--text-main)] text-lg">{deal.productName}</h3>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-bold ${getStatusColor(deal.status)}`}>
                                                        {deal.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${deal.type === 'bogo' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                                                        {getDealLabel(deal)}
                                                    </span>
                                                    {deal.type !== 'bogo' && (
                                                        <div className="text-sm">
                                                            <span className="text-[var(--text-muted)] line-through mr-2">${deal.originalPrice.toFixed(2)}</span>
                                                            <span className="font-bold text-[var(--brand-primary)]">${deal.salePrice.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 sm:gap-6 w-full md:w-auto justify-between md:justify-end">
                                            <div className="text-right text-sm text-[var(--text-muted)]">
                                                <div>Ends: <strong>{new Date(deal.endDate).toLocaleDateString()}</strong></div>
                                                <div className="text-xs">{new Date(deal.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>

                                            <div className="flex items-center gap-2 border-l border-[var(--glass-border)] pl-4">
                                                <div className="text-center px-2">
                                                    <div className="text-sm font-bold">{deal.stats.claims}</div>
                                                    <div className="text-[10px] text-[var(--text-muted)]">Clipped</div>
                                                </div>
                                                {hasWriteAccess ? (
                                                    <div className="flex items-center gap-1">
                                                        {deal.status === 'active' && (
                                                            <button
                                                                onClick={() => handlePromoteDeal(deal)}
                                                                disabled={promotingDealId === deal.id}
                                                                className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                                                                title="Promote to nearby customers"
                                                            >
                                                                {promotingDealId === deal.id ? '⏳' : '📣'}
                                                            </button>
                                                        )}
                                                        {deal.status === 'expired' && (
                                                            <button
                                                                onClick={() => handleExtendDeal(deal)}
                                                                className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Extend Deal (3 Days)"
                                                            >
                                                                ⏳
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleDeleteDeal(deal.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="End Deal">
                                                            🗑️
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="p-2 opacity-30 grayscale cursor-not-allowed">🗑️</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {showWizard && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
                                <div className="p-4 sm:p-6 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--surface-1)] rounded-t-2xl">
                                    <div>
                                        <h2 className="text-xl font-bold text-[var(--text-main)]">Create New Deal</h2>
                                        <p className="text-xs text-[var(--text-muted)] mt-1">Step {wizardStep} of 2: {wizardStep === 1 ? 'Select Product' : 'Configure Offer'}</p>
                                    </div>
                                    <button onClick={closeWizard} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">❌</button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--surface-1)]">
                                    {wizardStep === 1 ? (
                                        <div className="space-y-4">
                                            <input
                                                type="text"
                                                placeholder="Search inventory..."
                                                value={pickerSearch}
                                                onChange={e => setPickerSearch(e.target.value)}
                                                className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-xl shadow-sm outline-none focus:border-[var(--brand-primary)]"
                                                autoFocus
                                            />
                                            <div className="space-y-2">
                                                {filteredPickerProducts.length === 0 ? (
                                                    <div className="text-center py-10 text-[var(--text-muted)]">No products found</div>
                                                ) : (
                                                    filteredPickerProducts.map((product: any) => (
                                                        <div
                                                            key={product.id}
                                                            onClick={() => handleProductSelect(product)}
                                                            className="flex items-center gap-4 p-4 bg-white rounded-xl border border-[var(--glass-border)] cursor-pointer hover:border-[var(--brand-primary)] hover:shadow-md transition-all group"
                                                        >
                                                            <img src={product.image} className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                                                            <div className="flex-1">
                                                                <div className="font-medium text-[var(--text-main)] group-hover:text-[var(--brand-primary)] transition-colors">{product.name}</div>
                                                                <div className="text-sm text-[var(--text-muted)]">{product.category} • ${(product.originalPrice || product.price || 0).toFixed(2)}</div>
                                                            </div>
                                                            <span className="text-[var(--brand-primary)] opacity-0 group-hover:opacity-100 transition-opacity font-medium text-sm">Select →</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                                <img src={selectedProduct.image} className="w-12 h-12 rounded-lg object-cover" />
                                                <div className="flex-1">
                                                    <div className="font-bold text-blue-900">{selectedProduct.name}</div>
                                                    <div className="text-xs text-blue-700">Original Price: ${(selectedProduct.originalPrice || selectedProduct.price || 0).toFixed(2)}</div>
                                                </div>
                                                <button onClick={() => setWizardStep(1)} className="text-xs text-blue-600 font-medium hover:underline">Change</button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                {(['percentage', 'fixed', 'bogo'] as const).map(type => (
                                                    <div
                                                        key={type}
                                                        onClick={() => setDealConfig({ ...dealConfig, type })}
                                                        className={`p-3 rounded-xl border-2 cursor-pointer text-center transition-all ${dealConfig.type === type ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-transparent bg-white hover:bg-gray-50'}`}
                                                    >
                                                        <div className="text-xl mb-1">{type === 'percentage' ? '%' : type === 'fixed' ? '$' : '🎁'}</div>
                                                        <div className="text-xs font-bold capitalize">{type} Off</div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="bg-white p-5 rounded-xl border border-[var(--glass-border)] space-y-4">
                                                {dealConfig.type === 'percentage' && (
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1 text-[var(--text-muted)]">Discount Percentage</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                value={dealConfig.value}
                                                                onChange={e => setDealConfig({ ...dealConfig, value: e.target.value })}
                                                                className="flex-1 px-3 py-2 border border-[var(--glass-border)] rounded-lg outline-none font-bold text-lg"
                                                            />
                                                            <span className="text-lg font-bold">%</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {dealConfig.type === 'fixed' && (
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1 text-[var(--text-muted)]">Sale Price</label>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg font-bold">$</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={dealConfig.value}
                                                                onChange={e => setDealConfig({ ...dealConfig, value: e.target.value })}
                                                                className="flex-1 px-3 py-2 border border-[var(--glass-border)] rounded-lg outline-none font-bold text-lg"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {dealConfig.type === 'bogo' && (
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1 text-[var(--text-muted)]">BOGO Type</label>
                                                        <select
                                                            value={dealConfig.bogoType}
                                                            onChange={e => setDealConfig({ ...dealConfig, bogoType: e.target.value as any })}
                                                            className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-lg outline-none"
                                                        >
                                                            <option value="1_1">Buy 1 Get 1 Free</option>
                                                            <option value="2_1">Buy 2 Get 1 Free</option>
                                                            <option value="50_2nd">Buy 1 Get 2nd 50% Off</option>
                                                        </select>
                                                    </div>
                                                )}

                                                {dealConfig.type !== 'bogo' && selectedProduct && (
                                                    <div className="text-sm text-[var(--text-muted)] bg-gray-50 p-2 rounded">
                                                        New Price: <strong className="text-green-600">${calculateSalePrice((selectedProduct.originalPrice || selectedProduct.price || 0), dealConfig.type, parseFloat(dealConfig.value) || 0).toFixed(2)}</strong>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium mb-1 text-[var(--text-muted)]">Starts</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={dealConfig.startDate}
                                                        onChange={e => setDealConfig({ ...dealConfig, startDate: e.target.value })}
                                                        className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-lg outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium mb-1 text-[var(--text-muted)]">Ends</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={dealConfig.endDate}
                                                        onChange={e => setDealConfig({ ...dealConfig, endDate: e.target.value })}
                                                        className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-lg outline-none text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100 cursor-pointer" onClick={() => setDealConfig({ ...dealConfig, isFlashSale: !dealConfig.isFlashSale })}>
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${dealConfig.isFlashSale ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-red-200'}`}>
                                                    {dealConfig.isFlashSale && '✓'}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-red-900 text-sm">Mark as FLASH SALE ⚡</div>
                                                    <div className="text-xs text-red-700">Creates urgency with a countdown timer for customers.</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 sm:p-6 border-t border-[var(--glass-border)] bg-white rounded-b-2xl flex justify-end gap-3">
                                    <button onClick={closeWizard} className="px-5 py-2 border border-[var(--glass-border)] rounded-lg hover:bg-gray-50 text-[var(--text-main)] transition-colors">
                                        Cancel
                                    </button>
                                    {wizardStep === 1 ? (
                                        <button disabled className="px-5 py-2 bg-[var(--brand-primary)]/50 text-white font-bold rounded-lg cursor-not-allowed">
                                            Next Step →
                                        </button>
                                    ) : (
                                        <button onClick={handleCreateDeal} className="px-6 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 transition-all flex items-center gap-2">
                                            🚀 Launch Deal
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )
            }
        </div >
    );
};

export default MerchantDeals;
