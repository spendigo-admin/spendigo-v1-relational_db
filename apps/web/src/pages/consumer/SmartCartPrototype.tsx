import React, { useMemo } from 'react';
import {
    SmartCartOptimizationInput,
    SmartCartOptimizationResult,
    SmartCartStoreInput,
    SmartCartPriceInput,
    SmartCartListItemInput
} from '../../types/smartCart';
import '../../styles/design-system.css';

const mockShoppingList: SmartCartListItemInput[] = [
    { id: 'list-milk', name: 'Milk 2L', quantity: 1, preferredMasterProductId: 'mp-milk-2l', category: 'Dairy' },
    { id: 'list-eggs', name: 'Large Eggs 12pk', quantity: 1, preferredMasterProductId: 'mp-eggs-12', category: 'Dairy' },
    { id: 'list-bread', name: 'Whole Wheat Bread', quantity: 2, preferredMasterProductId: 'mp-bread-wholewheat', category: 'Bakery' },
    { id: 'list-bananas', name: 'Bananas', quantity: 1, preferredMasterProductId: 'mp-bananas-bunch', category: 'Produce' }
];

const mockStores: SmartCartStoreInput[] = [
    { id: 'freshmart', name: 'FreshMart', province: 'ON', deliveryFee: 3.99, freeDeliveryThreshold: 35, pickupEnabled: true, deliveryEnabled: true },
    { id: 'budgetfoods', name: 'Budget Foods', province: 'ON', deliveryFee: 2.99, freeDeliveryThreshold: 30, pickupEnabled: true, deliveryEnabled: true },
    { id: 'greenbasket', name: 'Green Basket', province: 'ON', deliveryFee: 4.49, freeDeliveryThreshold: 40, pickupEnabled: true, deliveryEnabled: false }
];

const mockPrices: SmartCartPriceInput[] = [
    { merchantProductId: 'freshmart_milk', storeId: 'freshmart', masterProductId: 'mp-milk-2l', productName: 'Sealtest 2L Milk', unit: '2L', price: 4.89, originalPrice: 5.29, currency: 'CAD', inStock: true, availableQuantity: 12 },
    { merchantProductId: 'budgetfoods_milk', storeId: 'budgetfoods', masterProductId: 'mp-milk-2l', productName: 'Dairyland 2L Milk', unit: '2L', price: 4.59, currency: 'CAD', inStock: true, availableQuantity: 4 },
    { merchantProductId: 'greenbasket_milk', storeId: 'greenbasket', masterProductId: 'mp-milk-2l', productName: 'Organic 2L Milk', unit: '2L', price: 5.49, currency: 'CAD', inStock: true, availableQuantity: 8 },

    { merchantProductId: 'freshmart_eggs', storeId: 'freshmart', masterProductId: 'mp-eggs-12', productName: 'Large Eggs 12pk', unit: '12pk', price: 5.79, currency: 'CAD', inStock: true, availableQuantity: 10 },
    { merchantProductId: 'budgetfoods_eggs', storeId: 'budgetfoods', masterProductId: 'mp-eggs-12', productName: 'Farm Eggs 12pk', unit: '12pk', price: 5.29, originalPrice: 5.99, currency: 'CAD', inStock: true, availableQuantity: 6 },
    { merchantProductId: 'greenbasket_eggs', storeId: 'greenbasket', masterProductId: 'mp-eggs-12', productName: 'Free Run Eggs 12pk', unit: '12pk', price: 6.49, currency: 'CAD', inStock: false, availableQuantity: 0 },

    { merchantProductId: 'freshmart_bread', storeId: 'freshmart', masterProductId: 'mp-bread-wholewheat', productName: 'Whole Wheat Bread', unit: '675g', price: 3.49, currency: 'CAD', inStock: true, availableQuantity: 20 },
    { merchantProductId: 'budgetfoods_bread', storeId: 'budgetfoods', masterProductId: 'mp-bread-wholewheat', productName: 'Whole Wheat Bread', unit: '675g', price: 3.19, currency: 'CAD', inStock: true, availableQuantity: 3 },
    { merchantProductId: 'greenbasket_bread', storeId: 'greenbasket', masterProductId: 'mp-bread-wholewheat', productName: 'Artisan Wheat Bread', unit: '700g', price: 4.19, currency: 'CAD', inStock: true, availableQuantity: 5 },

    { merchantProductId: 'freshmart_bananas', storeId: 'freshmart', masterProductId: 'mp-bananas-bunch', productName: 'Bananas Bunch', unit: 'bunch', price: 2.39, currency: 'CAD', inStock: true, availableQuantity: 18 },
    { merchantProductId: 'budgetfoods_bananas', storeId: 'budgetfoods', masterProductId: 'mp-bananas-bunch', productName: 'Bananas Bunch', unit: 'bunch', price: 2.19, currency: 'CAD', inStock: true, availableQuantity: 7 },
    { merchantProductId: 'greenbasket_bananas', storeId: 'greenbasket', masterProductId: 'mp-bananas-bunch', productName: 'Organic Bananas Bunch', unit: 'bunch', price: 2.89, currency: 'CAD', inStock: true, availableQuantity: 9 }
];

const mockResult: SmartCartOptimizationResult = {
    items: [
        {
            shoppingListItemId: 'list-milk',
            quantity: 1,
            selectedStoreId: 'budgetfoods',
            selectedStoreName: 'Budget Foods',
            selectedMerchantProductId: 'budgetfoods_milk',
            unitPrice: 4.59,
            lineTotal: 4.59,
            candidateCount: 3
        },
        {
            shoppingListItemId: 'list-eggs',
            quantity: 1,
            selectedStoreId: 'budgetfoods',
            selectedStoreName: 'Budget Foods',
            selectedMerchantProductId: 'budgetfoods_eggs',
            unitPrice: 5.29,
            lineTotal: 5.29,
            candidateCount: 2
        },
        {
            shoppingListItemId: 'list-bread',
            quantity: 2,
            selectedStoreId: 'budgetfoods',
            selectedStoreName: 'Budget Foods',
            selectedMerchantProductId: 'budgetfoods_bread',
            unitPrice: 3.19,
            lineTotal: 6.38,
            candidateCount: 3
        },
        {
            shoppingListItemId: 'list-bananas',
            quantity: 1,
            selectedStoreId: 'freshmart',
            selectedStoreName: 'FreshMart',
            selectedMerchantProductId: 'freshmart_bananas',
            unitPrice: 2.39,
            lineTotal: 2.39,
            candidateCount: 3
        }
    ],
    summary: {
        selectedStoreCount: 2,
        totalCartCost: 18.65,
        bestSingleStoreCost: 19.46,
        savingsVsSingleStore: 0.81,
        unavailableItemCount: 0
    },
    bestSingleStore: {
        storeId: 'budgetfoods',
        storeName: 'Budget Foods',
        totalCost: 19.46,
        missingItemCount: 0,
        isFullyAvailable: true
    },
    singleStoreComparisons: [
        { storeId: 'budgetfoods', storeName: 'Budget Foods', totalCost: 19.46, missingItemCount: 0, isFullyAvailable: true },
        { storeId: 'freshmart', storeName: 'FreshMart', totalCost: 20.05, missingItemCount: 0, isFullyAvailable: true },
        { storeId: 'greenbasket', storeName: 'Green Basket', totalCost: 23.25, missingItemCount: 1, isFullyAvailable: false }
    ],
    explanations: [
        {
            shoppingListItemId: 'list-milk',
            selectedStoreId: 'budgetfoods',
            reasonCode: 'lowest_price',
            summary: 'Budget Foods is selected for milk because it has the lowest in-stock price.',
            consideredStoreIds: ['freshmart', 'budgetfoods', 'greenbasket']
        },
        {
            shoppingListItemId: 'list-eggs',
            selectedStoreId: 'budgetfoods',
            reasonCode: 'lowest_price',
            summary: 'Budget Foods wins eggs on price, and Green Basket is excluded because it is out of stock.',
            consideredStoreIds: ['freshmart', 'budgetfoods']
        },
        {
            shoppingListItemId: 'list-bread',
            selectedStoreId: 'budgetfoods',
            reasonCode: 'matched_by_master_product',
            summary: 'Bread stays at Budget Foods because it matches the requested master product and keeps the split cart efficient.',
            consideredStoreIds: ['freshmart', 'budgetfoods', 'greenbasket']
        },
        {
            shoppingListItemId: 'list-bananas',
            selectedStoreId: 'freshmart',
            reasonCode: 'better_than_single_store',
            summary: 'FreshMart is selected for bananas because that one item creates the lowest overall split-cart total.',
            consideredStoreIds: ['freshmart', 'budgetfoods', 'greenbasket']
        }
    ]
};

const currency = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD'
});

const SmartCartPrototype: React.FC = () => {
    const input: SmartCartOptimizationInput = useMemo(() => ({
        shoppingList: mockShoppingList,
        stores: mockStores,
        prices: mockPrices
    }), []);

    const decisionMap = useMemo(() => new Map(mockResult.items.map(item => [item.shoppingListItemId, item])), []);
    const explanationMap = useMemo(() => new Map(mockResult.explanations.map(item => [item.shoppingListItemId, item])), []);
    const storeMap = useMemo(() => new Map(input.stores.map(store => [store.id, store])), [input.stores]);

    const itemsByStore = useMemo(() => {
        const grouped = new Map<string, typeof mockResult.items>();
        mockResult.items.forEach(item => {
            const current = grouped.get(item.selectedStoreId) || [];
            current.push(item);
            grouped.set(item.selectedStoreId, current);
        });
        return grouped;
    }, []);

    const priceCountByListItem = useMemo(() => {
        const counts = new Map<string, number>();
        input.shoppingList.forEach(listItem => {
            const related = input.prices.filter(price => price.masterProductId === listItem.preferredMasterProductId && price.inStock);
            counts.set(listItem.id, related.length);
        });
        return counts;
    }, [input]);

    return (
        <div className="animate-fade-in pb-16">
            <section className="relative overflow-hidden border-b border-[var(--glass-border)] bg-[radial-gradient(circle_at_top_left,_rgba(33,150,243,0.15),_transparent_35%),linear-gradient(135deg,_#f7f3ea_0%,_#ffffff_55%,_#eef8f4_100%)]">
                <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            SmartCart Prototype
                        </div>
                        <h1 className="mt-5 text-4xl md:text-5xl font-black tracking-tight text-[var(--text-main)]">
                            Optimizer interface preview
                        </h1>
                        <p className="mt-4 text-base md:text-lg text-[var(--text-muted)] max-w-2xl">
                            This page mocks the future optimizer contract: inputs on the left, transparent item-by-item decisions on the right, and summary outputs at the top.
                        </p>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-4">
                        <div className="glass-panel rounded-3xl p-5">
                            <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Shopping List</div>
                            <div className="mt-2 text-3xl font-black text-[var(--text-main)]">{input.shoppingList.length}</div>
                            <div className="text-sm text-[var(--text-muted)]">requested items</div>
                        </div>
                        <div className="glass-panel rounded-3xl p-5">
                            <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Split Cart Total</div>
                            <div className="mt-2 text-3xl font-black text-[var(--text-main)]">{currency.format(mockResult.summary.totalCartCost)}</div>
                            <div className="text-sm text-[var(--text-muted)]">{mockResult.summary.selectedStoreCount} stores selected</div>
                        </div>
                        <div className="glass-panel rounded-3xl p-5">
                            <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Best Single Store</div>
                            <div className="mt-2 text-3xl font-black text-[var(--text-main)]">{currency.format(mockResult.summary.bestSingleStoreCost || 0)}</div>
                            <div className="text-sm text-[var(--text-muted)]">{mockResult.bestSingleStore?.storeName || 'No baseline'}</div>
                        </div>
                        <div className="glass-panel rounded-3xl p-5 bg-[linear-gradient(135deg,rgba(46,125,50,0.14),rgba(255,255,255,0.95))]">
                            <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Savings</div>
                            <div className="mt-2 text-3xl font-black text-[var(--status-success)]">{currency.format(mockResult.summary.savingsVsSingleStore || 0)}</div>
                            <div className="text-sm text-[var(--text-muted)]">versus single-store basket</div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="max-w-7xl mx-auto px-4 py-8 grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-5 space-y-6">
                    <div className="glass-panel rounded-[2rem] p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-[var(--text-main)]">Inputs</h2>
                                <p className="text-sm text-[var(--text-muted)]">Normalized request shape for the optimizer.</p>
                            </div>
                            <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-bold text-[var(--text-muted)]">
                                `SmartCartOptimizationInput`
                            </span>
                        </div>

                        <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-[var(--glass-border)] bg-white/80 p-4">
                                <h3 className="text-sm font-bold text-[var(--text-main)]">Shopping list</h3>
                                <div className="mt-3 space-y-3">
                                    {input.shoppingList.map(item => (
                                        <div key={item.id} className="rounded-xl bg-[var(--surface-1)] p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-semibold text-[var(--text-main)]">{item.name}</div>
                                                    <div className="text-xs text-[var(--text-muted)]">{item.category} · Qty {item.quantity}</div>
                                                </div>
                                                <div className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--brand-primary)]">
                                                    {priceCountByListItem.get(item.id) || 0} offers
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-[var(--glass-border)] bg-white/80 p-4">
                                <h3 className="text-sm font-bold text-[var(--text-main)]">Stores</h3>
                                <div className="mt-3 space-y-3">
                                    {input.stores.map(store => (
                                        <div key={store.id} className="flex items-center justify-between rounded-xl bg-[var(--surface-1)] p-3">
                                            <div>
                                                <div className="font-semibold text-[var(--text-main)]">{store.name}</div>
                                                <div className="text-xs text-[var(--text-muted)]">
                                                    {store.deliveryEnabled ? 'Delivery' : 'Pickup only'} · Fee {currency.format(store.deliveryFee || 0)}
                                                </div>
                                            </div>
                                            <div className="text-xs font-bold text-[var(--text-muted)]">{store.province}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel rounded-[2rem] p-6">
                        <h2 className="text-xl font-black text-[var(--text-main)]">Module boundaries</h2>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">The page is mocked, but the integration seam is already designed.</p>
                        <div className="mt-5 grid gap-3">
                            {[
                                ['Input normalizer', 'Builds optimizer input from list, stores, and offers.'],
                                ['Candidate resolver', 'Matches each requested item to purchasable store offers.'],
                                ['Optimizer engine', 'Chooses the selected store per item and computes totals.'],
                                ['Comparison builder', 'Calculates best single-store baseline and savings.'],
                                ['Decision explainer', 'Produces reason codes and shopper-facing explanations.']
                            ].map(([title, description]) => (
                                <div key={title} className="rounded-2xl border border-[var(--glass-border)] bg-white/80 p-4">
                                    <div className="font-bold text-[var(--text-main)]">{title}</div>
                                    <div className="mt-1 text-sm text-[var(--text-muted)]">{description}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-7 space-y-6">
                    <div className="glass-panel rounded-[2rem] p-6">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <h2 className="text-xl font-black text-[var(--text-main)]">Outputs</h2>
                                <p className="text-sm text-[var(--text-muted)]">Selected store for each item, total cost, and savings baseline.</p>
                            </div>
                            <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-bold text-[var(--text-muted)]">
                                `SmartCartOptimizationResult`
                            </span>
                        </div>

                        <div className="mt-5 grid gap-4">
                            {input.shoppingList.map(listItem => {
                                const decision = decisionMap.get(listItem.id);
                                const explanation = explanationMap.get(listItem.id);
                                if (!decision || !explanation) return null;

                                return (
                                    <div key={listItem.id} className="rounded-[1.5rem] border border-[var(--glass-border)] bg-white/85 p-5">
                                        <div className="flex items-start justify-between gap-4 flex-wrap">
                                            <div>
                                                <div className="text-lg font-black text-[var(--text-main)]">{listItem.name}</div>
                                                <div className="mt-1 text-sm text-[var(--text-muted)]">
                                                    Selected from <span className="font-bold text-[var(--text-main)]">{decision.selectedStoreName}</span> · {decision.candidateCount} candidates considered
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Line total</div>
                                                <div className="text-2xl font-black text-[var(--text-main)]">{currency.format(decision.lineTotal)}</div>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                                            <div className="rounded-2xl bg-[var(--surface-1)] p-3">
                                                <div className="text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Store</div>
                                                <div className="mt-1 font-bold text-[var(--text-main)]">{decision.selectedStoreName}</div>
                                            </div>
                                            <div className="rounded-2xl bg-[var(--surface-1)] p-3">
                                                <div className="text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Unit price</div>
                                                <div className="mt-1 font-bold text-[var(--text-main)]">{currency.format(decision.unitPrice)}</div>
                                            </div>
                                            <div className="rounded-2xl bg-[var(--surface-1)] p-3">
                                                <div className="text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Reason code</div>
                                                <div className="mt-1 font-bold text-[var(--brand-primary)]">{explanation.reasonCode}</div>
                                            </div>
                                        </div>

                                        <div className="mt-4 rounded-2xl bg-[linear-gradient(135deg,rgba(33,150,243,0.08),rgba(255,255,255,0.95))] p-4">
                                            <div className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Decision transparency</div>
                                            <p className="mt-2 text-sm text-[var(--text-main)]">{explanation.summary}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                        <div className="glass-panel rounded-[2rem] p-6">
                            <h2 className="text-xl font-black text-[var(--text-main)]">Split-cart grouping</h2>
                            <p className="mt-1 text-sm text-[var(--text-muted)]">How the chosen basket distributes across stores.</p>
                            <div className="mt-5 space-y-4">
                                {Array.from(itemsByStore.entries()).map(([storeId, items]) => {
                                    const store = storeMap.get(storeId);
                                    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
                                    return (
                                        <div key={storeId} className="rounded-[1.5rem] border border-[var(--glass-border)] bg-white/85 p-5">
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <div className="text-lg font-black text-[var(--text-main)]">{store?.name || storeId}</div>
                                                    <div className="text-sm text-[var(--text-muted)]">
                                                        {items.length} selected item{items.length === 1 ? '' : 's'}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Subtotal</div>
                                                    <div className="text-xl font-black text-[var(--text-main)]">{currency.format(subtotal)}</div>
                                                </div>
                                            </div>
                                            <div className="mt-4 space-y-2">
                                                {items.map(item => {
                                                    const source = input.shoppingList.find(listItem => listItem.id === item.shoppingListItemId);
                                                    return (
                                                        <div key={item.shoppingListItemId} className="flex items-center justify-between rounded-xl bg-[var(--surface-1)] px-3 py-2">
                                                            <span className="text-sm font-medium text-[var(--text-main)]">{source?.name}</span>
                                                            <span className="text-sm text-[var(--text-muted)]">{currency.format(item.lineTotal)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="glass-panel rounded-[2rem] p-6">
                            <h2 className="text-xl font-black text-[var(--text-main)]">Single-store baseline</h2>
                            <p className="mt-1 text-sm text-[var(--text-muted)]">The comparison the optimizer uses for savings.</p>
                            <div className="mt-5 space-y-3">
                                {mockResult.singleStoreComparisons.map(store => (
                                    <div key={store.storeId} className={`rounded-2xl border p-4 ${store.storeId === mockResult.bestSingleStore?.storeId ? 'border-[var(--brand-primary)] bg-[linear-gradient(135deg,rgba(33,150,243,0.08),rgba(255,255,255,0.96))]' : 'border-[var(--glass-border)] bg-white/80'}`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="font-bold text-[var(--text-main)]">{store.storeName}</div>
                                                <div className="text-xs text-[var(--text-muted)]">
                                                    {store.isFullyAvailable ? 'All items available' : `${store.missingItemCount} item missing`}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-[var(--text-main)]">{currency.format(store.totalCost)}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SmartCartPrototype;
