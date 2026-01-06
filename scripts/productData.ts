import { GROCERY_CATALOG } from './groceryCatalog.ts';

// Unified store data for the entire application
// All components should import STORE_DATA from this file
export const STORE_DATA: Record<string, any> = {
    '1': {
        id: '1',
        name: 'FreshMart',
        tagline: 'Fresh groceries, complete selection',
        image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=400&fit=crop',
        logo: '🥬',
        rating: 4.8,
        deliveryTime: '25-35 min',
        deliveryFee: 'Free over $35',
        coordinates: { lat: 43.6510, lng: -79.3820 },
        province: 'ON',
        subscriptionTier: 'growth',
        tags: ['Grocery', 'Organic'],
        categories: ['All', 'Dairy & Refrigerated', 'Bakery & Grains', 'Pantry Staples', 'Breakfast & Beverages', 'Produce & Frozen', 'Snacks & Household'],
        flyer: {
            title: 'Weekly Savings Flyer',
            validUntil: 'Dec 22, 2024',
            image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'GROC-PROD-001', name: 'Bananas (Bunch)', price: 1.99, originalPrice: 3.29, endsIn: '10 hours', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop' }
        ],
        saleItems: [
            { id: 'GROC-DAIRY-004', name: 'Eggs (6-pack)', price: 2.49, originalPrice: 3.49, discount: '20% OFF', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300&h=300&fit=crop' }
        ],
        products: GROCERY_CATALOG
    },
    '2': {
        id: '2',
        name: 'QuickPick',
        tagline: '24/7 convenience at your fingertips',
        image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1200&h=400&fit=crop',
        logo: '🏪',
        rating: 4.5,
        deliveryTime: '15-25 min',
        deliveryFee: '$2.99',
        coordinates: { lat: 43.6540, lng: -79.3850 },
        province: 'BC',
        subscriptionTier: 'free',
        tags: ['Convenience', '24/7'],
        categories: ['All', 'Snacks', 'Drinks', 'Essentials'],
        flyer: {
            title: 'Midnight Madness Sale',
            validUntil: 'Dec 20, 2024',
            image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od3', name: 'Coffee (Large)', price: 1.99, originalPrice: 3.99, endsIn: '5 hours', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's3', name: 'Candy Bars (3pk)', price: 2.99, originalPrice: 4.99, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1575377427642-087cf684f29d?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p7', name: 'Energy Drink (4pk)', price: 9.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1560689189-65b6ed6228e7?w=300&h=300&fit=crop' },
            { id: 'p8', name: 'Chips Party Size', price: 4.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300&h=300&fit=crop' },
            { id: 'p9', name: 'Ice Cream Pint', price: 6.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300&h=300&fit=crop' },
            { id: 'p54', name: 'Mountain Dew (12pk)', price: 7.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&h=300&fit=crop' },
            { id: 'p55', name: 'Gatorade (600ml)', price: 2.49, category: 'Drinks', image: 'https://images.unsplash.com/photo-1649345867132-e8bd35bedf76?w=300&h=300&fit=crop' },
            { id: 'p56', name: 'Beef Jerky (80g)', price: 5.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1601314167099-232775b3d6fd?w=300&h=300&fit=crop' },
            { id: 'p57', name: 'Gummy Bears', price: 3.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=300&h=300&fit=crop' },
            { id: 'p58', name: 'Pretzels (Large Bag)', price: 4.29, category: 'Snacks', image: 'https://images.unsplash.com/photo-1609438824822-5b3a0e9abb4e?w=300&h=300&fit=crop' },
            { id: 'p59', name: 'Advil (10pk)', price: 6.49, category: 'Essentials', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=300&fit=crop' },
            { id: 'p60', name: 'Phone Charging Cable', price: 12.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&h=300&fit=crop' },
            { id: 'p61', name: 'Paper Towels (Single)', price: 2.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&h=300&fit=crop' },
            { id: 'p62', name: 'Trail Mix', price: 4.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1763244420864-7e1eae94efff?w=300&h=300&fit=crop' },
            { id: 'p63', name: 'Instant Noodles Cup', price: 1.49, category: 'Essentials', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=300&h=300&fit=crop' },
            // Cross-store products for SmartCart optimization
            { id: 'p_qp_1', name: 'Sourdough Loaf', price: 6.49, category: 'Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
            { id: 'p_qp_2', name: 'Whole Milk (4L)', price: 6.29, category: 'Dairy', image: 'https://images.unsplash.com/photo-1711625826512-f0165fa3846d?w=300&h=300&fit=crop' },
            { id: 'p_qp_3', name: 'Almond Milk (1L)', price: 4.99, category: 'Dairy', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop' },
            { id: 'p_qp_4', name: 'Organic Bananas (bunch)', price: 3.49, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop' },
            { id: 'p_qp_5', name: 'Cheddar Cheese (400g)', price: 8.49, category: 'Dairy', image: 'https://images.unsplash.com/photo-1723473620176-8d26dc6314cf?w=300&h=300&fit=crop' },
            { id: 'p_qp_6', name: 'Greek Yogurt (500g)', price: 5.99, category: 'Dairy', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=300&fit=crop' },
            { id: 'p_qp_7', name: 'Olive Oil (750ml)', price: 13.99, category: 'Pantry', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&h=300&fit=crop' },
        ]
    },
    '3': {
        id: '3',
        name: 'Metro Express',
        tagline: 'Quality groceries, everyday low prices',
        image: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=1200&h=400&fit=crop',
        logo: '🛒',
        rating: 4.6,
        deliveryTime: '30-45 min',
        deliveryFee: 'Free over $50',
        coordinates: { lat: 43.6480, lng: -79.3780 },
        province: 'QC',
        subscriptionTier: 'core',
        tags: ['Grocery', 'Butcher'],
        categories: ['All', 'Meat', 'Seafood', 'Frozen', 'Dairy'],
        flyer: {
            title: 'Fresh Meat Specials',
            validUntil: 'Dec 21, 2024',
            image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od4', name: 'Prime Ribeye Steak', price: 14.99, originalPrice: 24.99, endsIn: '10 hours', image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=300&h=300&fit=crop' }
        ],
        saleItems: [
            { id: 's4', name: 'Frozen Shrimp (1lb)', price: 9.99, originalPrice: 15.99, discount: '37% OFF', image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=300&h=300&fit=crop' }
        ],
        products: [
            { id: 'p10', name: 'Chicken Breast (1kg)', price: 14.99, category: 'Meat', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300&h=300&fit=crop' },
            { id: 'p11', name: 'Salmon Fillet (500g)', price: 18.99, category: 'Seafood', image: 'https://images.unsplash.com/photo-1499125562588-29fb8a56b5d5?w=300&h=300&fit=crop' },
            // Cross-store products - Metro has lowest prices!
            { id: 'p_me_1', name: 'Almond Milk (1L)', price: 3.99, category: 'Dairy', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop' },
            { id: 'p_me_2', name: 'Organic Bananas (bunch)', price: 2.49, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop' },
            { id: 'p_me_3', name: 'Cheddar Cheese (400g)', price: 6.99, category: 'Dairy', image: 'https://images.unsplash.com/photo-1723473620176-8d26dc6314cf?w=300&h=300&fit=crop' },
            { id: 'p_me_4', name: 'Greek Yogurt (500g)', price: 4.99, category: 'Dairy', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=300&fit=crop' },
            { id: 'p_me_5', name: 'Olive Oil (750ml)', price: 11.99, category: 'Pantry', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&h=300&fit=crop' },
            { id: 'p_me_6', name: 'Sourdough Loaf', price: 5.49, category: 'Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
            { id: 'p_me_7', name: 'Whole Milk (4L)', price: 5.49, category: 'Dairy', image: 'https://images.unsplash.com/photo-1711625826512-f0165fa3846d?w=300&h=300&fit=crop' },
            { id: 'p64', name: 'Ground Beef (450g)', price: 8.99, category: 'Meat', image: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=300&h=300&fit=crop' },
            { id: 'p65', name: 'Pork Chops (Center Cut)', price: 11.49, category: 'Meat', image: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=300&h=300&fit=crop' },
            { id: 'p66', name: 'Beef Stew Chunks', price: 12.99, category: 'Meat', image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=300&h=300&fit=crop' },
            { id: 'p67', name: 'Frozen Pizza (Deluxe)', price: 6.99, category: 'Frozen', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&h=300&fit=crop' },
            { id: 'p68', name: 'Frozen Peas (750g)', price: 3.49, category: 'Frozen', image: 'https://images.unsplash.com/photo-1632640107798-75f2be4b9329?w=300&h=300&fit=crop' },
            { id: 'p69', name: 'Ice Cream Sandwich (6pk)', price: 5.49, category: 'Frozen', image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300&h=300&fit=crop' },
            { id: 'p70', name: 'Atlantic Cod Fillets', price: 15.99, category: 'Seafood', image: 'https://images.unsplash.com/photo-1664288377740-1bec924cd622?w=300&h=300&fit=crop' },
            { id: 'p71', name: 'Cooked Shrimp (340g)', price: 12.49, category: 'Seafood', image: 'https://images.unsplash.com/photo-1551462147-37885abb3e4a?w=300&h=300&fit=crop' },
            { id: 'p72', name: 'Frozen Berries (Mixed)', price: 9.99, category: 'Frozen', image: 'https://images.unsplash.com/photo-1549611016-3a70d82b5040?w=300&h=300&fit=crop' },
            { id: 'p73', name: 'Fish Sticks (Wild Caught)', price: 7.99, category: 'Seafood', image: 'https://images.unsplash.com/photo-1678969406337-1869bb0c0dc4?w=300&h=300&fit=crop' },
        ]
    },
    '4': {
        id: '4',
        name: 'Costco Business',
        tagline: 'Bulk savings for smart shoppers',
        image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=1200&h=400&fit=crop',
        logo: '📦',
        rating: 4.7,
        deliveryTime: '45-60 min',
        deliveryFee: '$4.99',
        coordinates: { lat: 43.6620, lng: -79.3950 },
        province: 'AB',
        subscriptionTier: 'growth',
        tags: ['Wholesale', 'Bulk'],
        categories: ['All', 'Bulk', 'Office', 'Cleaning'],
        flyer: {
            title: 'Bulk Buy Bonanza',
            validUntil: 'Dec 25, 2024',
            image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od5', name: 'Toilet Paper (48 rolls)', price: 19.99, originalPrice: 34.99, endsIn: '12 hours', image: 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's5', name: 'Laundry Detergent (5L)', price: 14.99, originalPrice: 24.99, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p12', name: 'Paper Towels (12pk)', price: 24.99, category: 'Cleaning', image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&h=300&fit=crop' },
            { id: 'p13', name: 'Bottled Water (24pk)', price: 8.99, category: 'Bulk', image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=300&h=300&fit=crop' },
            { id: 'p74', name: 'Klintland Mayonnaise (1.9L)', price: 11.49, category: 'Bulk', image: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=300&h=300&fit=crop' },
            { id: 'p75', name: 'Coffee Pods (100pk)', price: 42.99, category: 'Bulk', image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&h=300&fit=crop' },
            { id: 'p76', name: 'Dish Soap (5L)', price: 13.99, category: 'Cleaning', image: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=300&h=300&fit=crop' },
            { id: 'p77', name: 'Copy Paper (5 Reams)', price: 29.99, category: 'Office', image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&h=300&fit=crop' },
            { id: 'p78', name: 'Large Trash Bags (100pk)', price: 18.49, category: 'Cleaning', image: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=300&h=300&fit=crop' },
            { id: 'p79', name: 'Protein Bars (24pk)', price: 26.99, category: 'Bulk', image: 'https://images.unsplash.com/photo-1622484212850-eb596d769edc?w=300&h=300&fit=crop' },
        ]
    },
    '5': {
        id: '5',
        name: "Mac's Corner",
        tagline: 'Your neighborhood convenience store',
        image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1200&h=400&fit=crop',
        logo: '🏪',
        rating: 4.3,
        deliveryTime: '10-20 min',
        deliveryFee: '$1.99',
        coordinates: { lat: 43.6525, lng: -79.3835 },
        province: 'ON',
        subscriptionTier: 'free',
        tags: ['Convenience', 'Local'],
        categories: ['All', 'Snacks', 'Drinks', 'Tobacco', 'Lottery'],
        flyer: {
            title: 'Weekly Snack Deals',
            validUntil: 'Dec 22, 2024',
            image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od6', name: 'Slurpee (Large)', price: 0.99, originalPrice: 2.49, endsIn: '6 hours', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's6', name: 'Hot Dog Combo', price: 2.99, originalPrice: 4.99, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1612392166886-ee8475b03af2?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p14', name: 'Coca-Cola (2L)', price: 3.49, category: 'Drinks', image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&h=300&fit=crop' },
            { id: 'p15', name: "Lay's Classic Chips", price: 4.29, category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300&h=300&fit=crop' },
            { id: 'p16', name: 'Red Bull (4pk)', price: 9.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1560689189-65b6ed6228e7?w=300&h=300&fit=crop' },
            { id: 'p17', name: 'Doritos Nacho Cheese', price: 4.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300&h=300&fit=crop' },
            { id: 'p18', name: 'Gatorade (6pk)', price: 7.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1649345867132-e8bd35bedf76?w=300&h=300&fit=crop' },
            // Cross-store products for SmartCart
            { id: 'p_mc_1', name: 'Whole Milk (4L)', price: 6.49, category: 'Drinks', image: 'https://images.unsplash.com/photo-1711625826512-f0165fa3846d?w=300&h=300&fit=crop' },
            { id: 'p_mc_2', name: 'Organic Eggs (12pk)', price: 7.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300&h=300&fit=crop' },
            { id: 'p_mc_3', name: 'Organic Bananas (bunch)', price: 3.29, category: 'Snacks', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop' },
            { id: 'p_mc_4', name: 'Almond Milk (1L)', price: 5.29, category: 'Drinks', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop' },
        ]
    },
    '6': {
        id: '6',
        name: 'Hasty Mart',
        tagline: 'Fast service, great prices',
        image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=400&fit=crop',
        logo: '⚡',
        rating: 4.1,
        deliveryTime: '10-15 min',
        deliveryFee: '$1.49',
        coordinates: { lat: 43.6550, lng: -79.3800 },
        province: 'ON',
        subscriptionTier: 'core',
        tags: ['Convenience', '24/7'],
        categories: ['All', 'Snacks', 'Drinks', 'Candy', 'Essentials'],
        flyer: {
            title: 'Quick Grab Specials',
            validUntil: 'Dec 21, 2024',
            image: 'https://images.unsplash.com/photo-1601758124096-1fd661873b95?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od7', name: 'Coffee (Any Size)', price: 0.99, originalPrice: 2.29, endsIn: '8 hours', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's7', name: 'Candy Bar (3pk)', price: 1.99, originalPrice: 3.49, discount: '43% OFF', image: 'https://images.unsplash.com/photo-1575377427642-087cf684f29d?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p20', name: 'Monster Energy', price: 3.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300&h=300&fit=crop' },
            { id: 'p21', name: 'Snickers Bar', price: 1.79, category: 'Candy', image: 'https://images.unsplash.com/photo-1534260164206-2a3a4a72891d?w=300&h=300&fit=crop' },
            { id: 'p22', name: 'Pepsi (6pk)', price: 5.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=300&h=300&fit=crop' },
            { id: 'p23', name: 'Pringles Original', price: 3.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300&h=300&fit=crop' },
            { id: 'p24', name: 'Gum (5 packs)', price: 4.99, category: 'Candy', image: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=300&h=300&fit=crop' },
            { id: 'p25', name: 'Hand Sanitizer', price: 2.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=300&h=300&fit=crop' },
            // Cross-store products for SmartCart
            { id: 'p_hm_1', name: 'Whole Milk (4L)', price: 5.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1711625826512-f0165fa3846d?w=300&h=300&fit=crop' },
            { id: 'p_hm_2', name: 'Organic Eggs (12pk)', price: 6.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300&h=300&fit=crop' },
            { id: 'p_hm_3', name: 'Greek Yogurt (500g)', price: 5.29, category: 'Essentials', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=300&fit=crop' },
            { id: 'p_hm_4', name: 'Sourdough Loaf', price: 6.29, category: 'Essentials', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
            { id: 'p_hm_5', name: 'Almond Milk (1L)', price: 4.79, category: 'Drinks', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop' },
        ]
    },
    '7': {
        id: '7',
        name: 'Corner Bodega',
        tagline: 'Local favorites, fresh daily',
        image: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=1200&h=400&fit=crop',
        logo: '🏬',
        rating: 4.5,
        deliveryTime: '10-20 min',
        deliveryFee: '$1.99',
        coordinates: { lat: 43.6495, lng: -79.3815 },
        province: 'NS',
        subscriptionTier: 'free',
        tags: ['Convenience', 'Local'],
        categories: ['All', 'Deli', 'Drinks', 'Snacks', 'Grocery'],
        flyer: {
            title: 'Fresh Deli Deals',
            validUntil: 'Dec 23, 2024',
            image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od8', name: 'Bacon Egg & Cheese', price: 3.99, originalPrice: 6.99, endsIn: '10 hours', image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's8', name: 'Fresh Bagel w/ Cream Cheese', price: 1.99, originalPrice: 3.49, discount: '43% OFF', image: 'https://images.unsplash.com/photo-1707079266703-b67f36a881f1?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p26', name: 'Deli Sandwich', price: 7.99, category: 'Deli', image: 'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=300&h=300&fit=crop' },
            { id: 'p27', name: 'Arizona Iced Tea', price: 1.29, category: 'Drinks', image: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=300&h=300&fit=crop' },
            { id: 'p28', name: 'Takis Fuego', price: 3.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300&h=300&fit=crop' },
            { id: 'p29', name: 'Fresh OJ (Large)', price: 4.49, category: 'Drinks', image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300&h=300&fit=crop' },
            { id: 'p30', name: 'Chopped Cheese Sandwich', price: 8.99, category: 'Deli', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300&h=300&fit=crop' },
            { id: 'p31', name: 'Milk (1L)', price: 2.99, category: 'Grocery', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop' },
            // Cross-store products for SmartCart
            { id: 'p_cb_1', name: 'Organic Eggs (12pk)', price: 5.99, category: 'Grocery', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300&h=300&fit=crop' },
            { id: 'p_cb_2', name: 'Organic Bananas (bunch)', price: 2.79, category: 'Grocery', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop' },
            { id: 'p_cb_3', name: 'Greek Yogurt (500g)', price: 4.49, category: 'Grocery', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=300&fit=crop' },
            { id: 'p_cb_4', name: 'Cheddar Cheese (400g)', price: 6.79, category: 'Grocery', image: 'https://images.unsplash.com/photo-1723473620176-8d26dc6314cf?w=300&h=300&fit=crop' },
            { id: 'p_cb_5', name: 'Sourdough Loaf', price: 5.79, category: 'Grocery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
        ]
    },
    '8': {
        id: '8',
        name: "Green Valley Market",
        tagline: 'Fresh from local farms to your table',
        image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&h=400&fit=crop',
        logo: '🌽',
        rating: 4.9,
        deliveryTime: '30-45 min',
        deliveryFee: '$3.99',
        coordinates: { lat: 43.6420, lng: -79.3750 },
        province: 'BC',
        subscriptionTier: 'core',
        tags: ['Organic', 'Farmers Market'],
        categories: ['All', 'Produce', 'Honey', 'Preserves'],
        flyer: {
            title: 'Harvest Season',
            validUntil: 'Dec 24, 2024',
            image: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od9', name: 'Strawberries Box', price: 4.99, originalPrice: 8.99, endsIn: '5 hours', image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=300&h=300&fit=crop' }
        ],
        saleItems: [
            { id: 's9', name: 'Organic Kale', price: 2.99, originalPrice: 4.99, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1624300477446-d379e923eca8?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p32', name: 'Local Honey (500ml)', price: 12.99, category: 'Honey', image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300&h=300&fit=crop' },
            { id: 'p33', name: 'Fresh Carrots (Bunch)', price: 3.49, category: 'Produce', image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=300&h=300&fit=crop' },
            { id: 'p34', name: 'Strawberry Jam', price: 8.99, category: 'Preserves', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&h=300&fit=crop' },
            // Cross-store products (organic/premium pricing)
            { id: 'p_gv_1', name: 'Organic Eggs (12pk)', price: 8.49, category: 'Produce', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300&h=300&fit=crop' },
            { id: 'p_gv_2', name: 'Organic Bananas (bunch)', price: 3.99, category: 'Produce', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop' },
            { id: 'p_gv_3', name: 'Almond Milk (1L)', price: 5.49, category: 'Produce', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop' },
            { id: 'p_gv_4', name: 'Greek Yogurt (500g)', price: 6.49, category: 'Produce', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=300&fit=crop' },
            { id: 'p_gv_5', name: 'Olive Oil (750ml)', price: 15.99, category: 'Preserves', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&h=300&fit=crop' },
        ]
    },
    '9': {
        id: '9',
        name: "The Daily Loaf",
        tagline: 'Artisan sourdough & pastries',
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&h=400&fit=crop',
        logo: '🥖',
        rating: 4.8,
        deliveryTime: '20-30 min',
        deliveryFee: '$2.49',
        coordinates: { lat: 43.6580, lng: -79.3870 },
        province: 'ON',
        subscriptionTier: 'free',
        tags: ['Bakery', 'Coffee'],
        categories: ['All', 'Bread', 'Pastries', 'Coffee'],
        flyer: {
            title: 'Holiday Treats',
            validUntil: 'Dec 25, 2024',
            image: 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od10', name: 'Croissant Box (6pk)', price: 10.99, originalPrice: 15.99, endsIn: '3 hours', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300&h=300&fit=crop' }
        ],
        saleItems: [
            { id: 's10', name: 'Sourdough Loaf', price: 5.99, originalPrice: 7.99, discount: '25% OFF', image: 'https://images.unsplash.com/photo-1613396874083-2d5fbe59ae79?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p35', name: 'Baguette', price: 3.99, category: 'Bread', image: 'https://images.unsplash.com/photo-1554475659-9fd915c8f156?w=300&h=300&fit=crop' },
            { id: 'p36', name: 'Cinnamon Roll', price: 4.49, category: 'Pastries', image: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=300&h=300&fit=crop' },
            { id: 'p37', name: 'Cold Brew Coffee', price: 4.99, category: 'Coffee', image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=300&h=300&fit=crop' },
            // Cross-store products (bakery has best bread prices!)
            { id: 'p_dl_1', name: 'Sourdough Loaf', price: 4.99, category: 'Bread', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
            { id: 'p_dl_2', name: 'Whole Wheat Bread', price: 3.49, category: 'Bread', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
            { id: 'p_dl_3', name: 'Chocolate Croissant', price: 2.49, category: 'Pastries', image: 'https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=300&h=300&fit=crop' },
        ]
    },
    '10': {
        id: '10',
        name: "The Butcher's Block",
        tagline: 'Premium cuts, locally sourced',
        image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=1200&h=400&fit=crop',
        logo: '🥩',
        rating: 4.7,
        deliveryTime: '25-40 min',
        deliveryFee: '$4.99',
        coordinates: { lat: 43.6450, lng: -79.3900 },
        province: 'AB',
        subscriptionTier: 'core',
        tags: ['Butcher', 'Premium'],
        categories: ['All', 'Beef', 'Chicken', 'Pork', 'Sausages'],
        flyer: {
            title: 'BBQ Ready',
            validUntil: 'Dec 30, 2024',
            image: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od11', name: 'Wagyu Burger Patties (4pk)', price: 19.99, originalPrice: 29.99, endsIn: '7 hours', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=300&fit=crop' }
        ],
        saleItems: [
            { id: 's11', name: 'Pork Chops (2lb)', price: 12.99, originalPrice: 16.99, discount: '23% OFF', image: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=300&h=300&fit=crop' }
        ],
        products: [
            { id: 'p38', name: 'Ribeye Steak (10oz)', price: 18.99, category: 'Beef', image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=300&h=300&fit=crop' },
            { id: 'p39', name: 'Chicken Wings (2lb)', price: 14.99, category: 'Chicken', image: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=300&h=300&fit=crop' },
            { id: 'p40', name: 'Spicy Italian Sausages', price: 9.99, category: 'Sausages', image: 'https://images.unsplash.com/photo-1585325701165-351af916e581?w=300&h=300&fit=crop' },
        ]
    },
    '11': {
        id: '11',
        name: "The Book Nook",
        tagline: 'Best sellers & hidden gems',
        image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200&h=400&fit=crop',
        logo: '📚',
        rating: 4.9,
        deliveryTime: '40-50 min',
        deliveryFee: '$2.99',
        coordinates: { lat: 43.6600, lng: -79.3700 },
        province: 'QC',
        subscriptionTier: 'free',
        tags: ['Books', 'Gifts'],
        categories: ['All', 'Fiction', 'Non-Fiction', 'Kids', 'Gifts'],
        flyer: {
            title: 'Winter Reads',
            validUntil: 'Jan 15, 2025',
            image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od12', name: 'Mystery Box (3 Books)', price: 15.99, originalPrice: 30.00, endsIn: '12 hours', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=300&fit=crop' }
        ],
        saleItems: [
            { id: 's12', name: '2025 Planner', price: 12.99, originalPrice: 24.99, discount: '50% OFF', image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=300&h=300&fit=crop' }
        ],
        products: [
            { id: 'p41', name: 'Top Fiction Novel', price: 24.99, category: 'Fiction', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=300&fit=crop' },
            { id: 'p42', name: 'Cookbook: Local Eats', price: 34.99, category: 'Non-Fiction', image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=300&h=300&fit=crop' },
            { id: 'p43', name: 'Reading Light', price: 15.99, category: 'Gifts', image: 'https://images.unsplash.com/photo-1692864626388-27357518e5ea?w=300&h=300&fit=crop' },
        ]
    }
};
