import {
    compareOptimizedCartToSingleStore,
    SmartCartComparisonResult,
} from './smartcart_comparison_engine';
import {
    optimizeSmartCart,
    SmartCartOptimizedCart,
    SmartCartOptimizerInput,
    SmartCartOptimizerProductOffer,
    SmartCartOptimizerStoreEntry,
} from './smartcart_optimizer';
import {
    simulateSingleStoreCart,
    SmartCartSingleStoreSimulationResult,
} from './smartcart_single_store_simulator';

const VOLUME_PACKAGE_SIZES = [
    { package_size: '500ml', multiplier: 5 },
    { package_size: '750ml', multiplier: 7.5 },
    { package_size: '1L', multiplier: 10 },
];

const WEIGHT_PACKAGE_SIZES = [
    { package_size: '500g', multiplier: 5 },
    { package_size: '750g', multiplier: 7.5 },
    { package_size: '1kg', multiplier: 10 },
];

export interface SmartCartSimulationConfig {
    storeCount?: number;
    productCount?: number;
    iterations?: number;
    seed?: number;
}

export interface SmartCartSimulationCase {
    shopping_list: string[];
    store_products: SmartCartOptimizerStoreEntry[];
}

export interface SmartCartSimulationRun {
    iteration: number;
    optimized_cart_cost: number;
    best_single_store_cost: number | null;
    savings_percentage: number | null;
    recommendation: SmartCartComparisonResult['recommendation'];
}

export interface SmartCartSimulationValidation {
    eachProductAppearsOnce: boolean;
    noUnavailableProductSelected: boolean;
    totalCostIsMinimized: boolean;
}

export interface SmartCartSimulationSummary {
    config: Required<SmartCartSimulationConfig>;
    runs: SmartCartSimulationRun[];
    validations: SmartCartSimulationValidation[];
    printedReport: string;
}

function createSeededRandom(seed: number): () => number {
    let state = seed >>> 0;

    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function randomInt(random: () => number, min: number, max: number): number {
    return Math.floor(random() * (max - min + 1)) + min;
}

function randomFloat(random: () => number, min: number, max: number, decimals = 2): number {
    const value = min + random() * (max - min);
    return Number(value.toFixed(decimals));
}

function pickRandomPackage(random: () => number, productIndex: number) {
    const packagePool = productIndex % 2 === 0 ? VOLUME_PACKAGE_SIZES : WEIGHT_PACKAGE_SIZES;
    return packagePool[randomInt(random, 0, packagePool.length - 1)];
}

function createOffer(
    random: () => number,
    productId: string,
    productIndex: number,
    forceAvailable: boolean,
): SmartCartOptimizerProductOffer {
    const selectedPackage = pickRandomPackage(random, productIndex);
    const normalizedUnitPrice = randomFloat(random, 0.25, 2.5, 4);
    const price = Number((normalizedUnitPrice * selectedPackage.multiplier).toFixed(2));
    const available = forceAvailable || random() < 0.8;

    return {
        product_id: productId,
        price,
        package_size: selectedPackage.package_size,
        unit_price: normalizedUnitPrice,
        available,
    };
}

export function generateSmartCartSimulationCase(
    storeCount = 5,
    productCount = 100,
    seed = 1,
): SmartCartSimulationCase {
    const random = createSeededRandom(seed);
    const shopping_list = Array.from({ length: productCount }, (_, index) => `product-${index + 1}`);

    const store_products: SmartCartOptimizerStoreEntry[] = Array.from({ length: storeCount }, (_, storeIndex) => ({
        store_id: `store-${storeIndex + 1}`,
        products: [],
    }));

    shopping_list.forEach((productId, productIndex) => {
        const forcedStoreIndex = randomInt(random, 0, storeCount - 1);

        store_products.forEach((store, storeIndex) => {
            store.products.push(
                createOffer(random, productId, productIndex, storeIndex === forcedStoreIndex),
            );
        });
    });

    return {
        shopping_list,
        store_products,
    };
}

function simulateAllSingleStoreCarts(
    simulationCase: SmartCartSimulationCase,
): SmartCartSingleStoreSimulationResult[] {
    return simulationCase.store_products.map(store =>
        simulateSingleStoreCart({
            shopping_list: simulationCase.shopping_list,
            store_product_data: {
                store_id: store.store_id,
                products: store.products,
            },
        }),
    );
}

function calculateTheoreticalMinimumCost(
    simulationCase: SmartCartSimulationCase,
): number {
    return simulationCase.shopping_list.reduce((total, productId) => {
        const bestUnitPrice = simulationCase.store_products
            .flatMap(store => store.products)
            .filter(product => product.product_id === productId && product.available)
            .reduce((best, product) => Math.min(best, product.unit_price), Number.POSITIVE_INFINITY);

        if (!Number.isFinite(bestUnitPrice)) {
            throw new Error(`Synthetic simulation generated an unavailable product: "${productId}".`);
        }

        return total + bestUnitPrice;
    }, 0);
}

function validateOptimizedCart(
    simulationCase: SmartCartSimulationCase,
    optimizedCart: SmartCartOptimizedCart,
): SmartCartSimulationValidation {
    const selectedIds = optimizedCart.optimized_items.map(item => item.product_id);
    const uniqueSelectedIds = new Set(selectedIds);

    const eachProductAppearsOnce = optimizedCart.optimized_items.length === simulationCase.shopping_list.length
        && uniqueSelectedIds.size === simulationCase.shopping_list.length
        && simulationCase.shopping_list.every(productId => uniqueSelectedIds.has(productId));

    const noUnavailableProductSelected = optimizedCart.optimized_items.every(item => {
        const store = simulationCase.store_products.find(entry => entry.store_id === item.chosen_store);

        if (!store) {
            return false;
        }

        return store.products.some(product =>
            product.product_id === item.product_id
            && product.available
            && product.unit_price === item.unit_price
            && product.price === item.price,
        );
    });

    const theoreticalMinimumCost = calculateTheoreticalMinimumCost(simulationCase);
    const totalCostIsMinimized = Math.abs(optimizedCart.total_cost - theoreticalMinimumCost) < 0.000001;

    return {
        eachProductAppearsOnce,
        noUnavailableProductSelected,
        totalCostIsMinimized,
    };
}

function buildSimulationRun(
    iteration: number,
    optimizedCart: SmartCartOptimizedCart,
    comparisonResult: SmartCartComparisonResult,
): SmartCartSimulationRun {
    const savingsPercentage = comparisonResult.best_single_store_cost === null || comparisonResult.best_single_store_cost === 0
        ? null
        : (comparisonResult.savings ?? 0) / comparisonResult.best_single_store_cost * 100;

    return {
        iteration,
        optimized_cart_cost: optimizedCart.total_cost,
        best_single_store_cost: comparisonResult.best_single_store_cost,
        savings_percentage: savingsPercentage,
        recommendation: comparisonResult.recommendation,
    };
}

function buildPrintedReport(runs: SmartCartSimulationRun[]): string {
    return runs.map(run => {
        const bestSingleStoreText = run.best_single_store_cost === null
            ? 'N/A'
            : run.best_single_store_cost.toFixed(4);
        const savingsText = run.savings_percentage === null
            ? 'N/A'
            : `${run.savings_percentage.toFixed(2)}%`;

        return [
            `Test ${run.iteration}`,
            `optimized cart cost: ${run.optimized_cart_cost.toFixed(4)}`,
            `best single-store cost: ${bestSingleStoreText}`,
            `savings percentage: ${savingsText}`,
        ].join(' | ');
    }).join('\n');
}

export function runSmartCartOptimizerSimulation(
    config: SmartCartSimulationConfig = {},
): SmartCartSimulationSummary {
    const resolvedConfig: Required<SmartCartSimulationConfig> = {
        storeCount: config.storeCount ?? 5,
        productCount: config.productCount ?? 100,
        iterations: config.iterations ?? 200,
        seed: config.seed ?? 1,
    };

    const runs: SmartCartSimulationRun[] = [];
    const validations: SmartCartSimulationValidation[] = [];

    for (let index = 0; index < resolvedConfig.iterations; index += 1) {
        const simulationCase = generateSmartCartSimulationCase(
            resolvedConfig.storeCount,
            resolvedConfig.productCount,
            resolvedConfig.seed + index,
        );

        const optimizerInput: SmartCartOptimizerInput = {
            shopping_list: simulationCase.shopping_list,
            store_products: simulationCase.store_products,
        };

        const optimizedCart = optimizeSmartCart(optimizerInput);
        const singleStoreResults = simulateAllSingleStoreCarts(simulationCase);
        const comparisonResult = compareOptimizedCartToSingleStore(optimizedCart, singleStoreResults);

        runs.push(buildSimulationRun(index + 1, optimizedCart, comparisonResult));
        validations.push(validateOptimizedCart(simulationCase, optimizedCart));
    }

    return {
        config: resolvedConfig,
        runs,
        validations,
        printedReport: buildPrintedReport(runs),
    };
}
