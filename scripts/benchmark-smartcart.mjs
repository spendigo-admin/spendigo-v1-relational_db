import { optimizeCart } from '../services/api/lib/smartcart/optimizer.js';
import { findBestSingleStoreOption } from '../services/api/lib/smartcart/singleStore.js';

const STORE_COUNT = 100;
const PRODUCT_COUNT = 10000;
const CART_SIZE = 25;
const WARMUP_RUNS = 3;
const MEASURED_RUNS = 10;
const TARGET_MS = 100;
const SEED = 20260314;

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomFloat(random, min, max, decimals = 4) {
  const value = min + random() * (max - min);
  return Number(value.toFixed(decimals));
}

function pickPackageSize(random, productIndex) {
  const volumeSizes = [
    { package_size: '500ml', multiplier: 5 },
    { package_size: '750ml', multiplier: 7.5 },
    { package_size: '1L', multiplier: 10 },
  ];
  const weightSizes = [
    { package_size: '500g', multiplier: 5 },
    { package_size: '750g', multiplier: 7.5 },
    { package_size: '1kg', multiplier: 10 },
  ];
  const pool = productIndex % 2 === 0 ? volumeSizes : weightSizes;
  return pool[randomInt(random, 0, pool.length - 1)];
}

function createOffer(random, productId, productIndex, forceAvailable) {
  const pkg = pickPackageSize(random, productIndex);
  const unit_price = randomFloat(random, 0.2, 2.5, 4);
  const price = Number((unit_price * pkg.multiplier).toFixed(2));

  return {
    product_id: productId,
    price,
    package_size: pkg.package_size,
    unit_price,
    available: forceAvailable || random() < 0.82,
  };
}

function generateBenchmarkData() {
  const random = createSeededRandom(SEED);
  const shopping_list = Array.from({ length: CART_SIZE }, (_, index) => `product-${index + 1}`);
  const store_products = Array.from({ length: STORE_COUNT }, (_, storeIndex) => ({
    store_id: `store-${storeIndex + 1}`,
    store_name: `Store ${storeIndex + 1}`,
    products: [],
  }));

  for (let productIndex = 0; productIndex < PRODUCT_COUNT; productIndex += 1) {
    const productId = `product-${productIndex + 1}`;
    const forcedStoreIndex = randomInt(random, 0, STORE_COUNT - 1);

    for (let storeIndex = 0; storeIndex < STORE_COUNT; storeIndex += 1) {
      store_products[storeIndex].products.push(
        createOffer(random, productId, productIndex, storeIndex === forcedStoreIndex),
      );
    }
  }

  return { shopping_list, store_products };
}

function calculateSavingsPercentage(optimizedCost, bestSingleStoreCost) {
  if (bestSingleStoreCost === null || bestSingleStoreCost === 0) {
    return null;
  }

  return ((bestSingleStoreCost - optimizedCost) / bestSingleStoreCost) * 100;
}

function formatMemory(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function measureRuntime(fn) {
  const start = process.hrtime.bigint();
  const result = fn();
  const end = process.hrtime.bigint();

  return {
    result,
    durationMs: Number(end - start) / 1_000_000,
  };
}

function runBenchmark() {
  const benchmarkData = generateBenchmarkData();

  for (let index = 0; index < WARMUP_RUNS; index += 1) {
    optimizeCart(benchmarkData.shopping_list, benchmarkData.store_products);
  }

  if (global.gc) {
    global.gc();
  }

  const memoryBefore = process.memoryUsage();
  const durations = [];
  let optimizedCart = null;

  for (let index = 0; index < MEASURED_RUNS; index += 1) {
    const measurement = measureRuntime(() =>
      optimizeCart(benchmarkData.shopping_list, benchmarkData.store_products),
    );

    durations.push(measurement.durationMs);
    optimizedCart = measurement.result;
  }

  const bestSingleStoreOption = findBestSingleStoreOption(
    benchmarkData.shopping_list,
    benchmarkData.store_products,
  );
  const memoryAfter = process.memoryUsage();

  const minRuntime = Math.min(...durations);
  const maxRuntime = Math.max(...durations);
  const avgRuntime = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  const heapDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
  const rssDelta = memoryAfter.rss - memoryBefore.rss;
  const savingsPercentage = calculateSavingsPercentage(
    optimizedCart.total_cost,
    bestSingleStoreOption?.cart_cost ?? null,
  );

  console.log('SmartCart Optimizer Benchmark');
  console.log(`stores: ${STORE_COUNT}`);
  console.log(`products: ${PRODUCT_COUNT}`);
  console.log(`cart size: ${CART_SIZE}`);
  console.log(`warmup runs: ${WARMUP_RUNS}`);
  console.log(`measured runs: ${MEASURED_RUNS}`);
  console.log('');
  console.log(`optimized cart cost: ${optimizedCart.total_cost.toFixed(4)}`);
  console.log(
    `best single-store cost: ${bestSingleStoreOption?.cart_cost !== null && bestSingleStoreOption?.cart_cost !== undefined
      ? bestSingleStoreOption.cart_cost.toFixed(4)
      : 'N/A'}`,
  );
  console.log(
    `savings percentage: ${savingsPercentage === null ? 'N/A' : `${savingsPercentage.toFixed(2)}%`}`,
  );
  console.log('');
  console.log(`optimizer runtime avg: ${avgRuntime.toFixed(2)} ms`);
  console.log(`optimizer runtime min: ${minRuntime.toFixed(2)} ms`);
  console.log(`optimizer runtime max: ${maxRuntime.toFixed(2)} ms`);
  console.log(`heap used before: ${formatMemory(memoryBefore.heapUsed)}`);
  console.log(`heap used after: ${formatMemory(memoryAfter.heapUsed)}`);
  console.log(`heap delta: ${formatMemory(heapDelta)}`);
  console.log(`rss delta: ${formatMemory(rssDelta)}`);
  console.log(`target (< ${TARGET_MS} ms): ${avgRuntime < TARGET_MS ? 'PASS' : 'FAIL'}`);
}

runBenchmark();
