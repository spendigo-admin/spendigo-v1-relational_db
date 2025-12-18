export const STORE_DATA: Record<string, any> = {
    '1': {
        id: '1',
        name: 'FreshMart',
        tagline: 'Fresh groceries, delivered fast',
        image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=400&fit=crop',
        logo: '🥬',
        rating: 4.8,
        deliveryTime: '25-35 min',
        deliveryFee: 'Free over $35',
        categories: ['All', 'Fresh Produce', 'Dairy', 'Bakery', 'Pantry'],
        flyer: {
            title: 'Weekly Savings Flyer',
            validUntil: 'Dec 22, 2024',
            image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od1', name: 'Fresh Strawberries', price: 2.99, originalPrice: 5.99, endsIn: '8 hours', image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=300&h=300&fit=crop' },
            { id: 'od2', name: 'Orange Juice (2L)', price: 3.49, originalPrice: 6.99, endsIn: '8 hours', image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's1', name: 'Organic Eggs (12pk)', price: 4.99, originalPrice: 7.99, discount: '38% OFF', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300&h=300&fit=crop' },
            { id: 's2', name: 'Whole Wheat Bread', price: 2.49, originalPrice: 3.99, discount: '38% OFF', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p1', name: 'Organic Avocados (5pk)', price: 6.99, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=300' },
            { id: 'p2', name: 'Almond Milk (1L)', price: 4.49, category: 'Dairy', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300' },
            { id: 'p3', name: 'Sourdough Loaf', price: 5.99, category: 'Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300' },
            { id: 'p4', name: 'Organic Bananas (bunch)', price: 2.99, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300' },
            { id: 'p5', name: 'Greek Yogurt (500g)', price: 5.49, category: 'Dairy', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300' },
            { id: 'p6', name: 'Olive Oil (750ml)', price: 12.99, category: 'Pantry', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300' },
            { id: 'p44', name: 'Gala Apples (3lb)', price: 4.99, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=300' },
            { id: 'p45', name: 'Baby Spinach (5oz)', price: 3.49, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=300' },
            { id: 'p46', name: 'Whole Milk (4L)', price: 5.89, category: 'Dairy', image: 'https://images.unsplash.com/photo-1563636619-e910fa4a839a?w=300' },
            { id: 'p47', name: 'Cheddar Cheese (400g)', price: 7.49, category: 'Dairy', image: 'https://images.unsplash.com/photo-1618067425547-734794820658?w=300' },
        ]
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
            { id: 'p7', name: 'Energy Drink (4pk)', price: 9.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300' },
            { id: 'p8', name: 'Chips Party Size', price: 4.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300' },
            { id: 'p9', name: 'Ice Cream Pint', price: 6.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300' },
            { id: 'p54', name: 'Mountain Dew (12pk)', price: 7.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622766815178-641bef2b0cf5?w=300' },
            { id: 'p55', name: 'Gatorade (600ml)', price: 2.49, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622766815178-641bef2b0cf5?w=300' },
            { id: 'p56', name: 'Beef Jerky (80g)', price: 5.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1601314167099-232775b3d6fd?w=300' },
            { id: 'p57', name: 'Gummy Bears', price: 3.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=300' },
            { id: 'p58', name: 'Pretzels (Large Bag)', price: 4.29, category: 'Snacks', image: 'https://images.unsplash.com/photo-1599599594582-84936d127a35?w=300' },
            { id: 'p59', name: 'Advil (10pk)', price: 6.49, category: 'Essentials', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300' },
            { id: 'p60', name: 'Phone Charging Cable', price: 12.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300' },
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
        categories: ['All', 'Meat', 'Seafood', 'Frozen'],
        flyer: {
            title: 'Fresh Meat Specials',
            validUntil: 'Dec 21, 2024',
            image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od4', name: 'Prime Ribeye Steak', price: 14.99, originalPrice: 24.99, endsIn: '10 hours', image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's4', name: 'Frozen Shrimp (1lb)', price: 9.99, originalPrice: 15.99, discount: '37% OFF', image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p10', name: 'Chicken Breast (1kg)', price: 14.99, category: 'Meat', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300' },
            { id: 'p11', name: 'Salmon Fillet (500g)', price: 18.99, category: 'Seafood', image: 'https://images.unsplash.com/photo-1499125562588-29fb8a56b5d5?w=300' },
            { id: 'p64', name: 'Ground Beef (450g)', price: 8.99, category: 'Meat', image: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=300' },
            { id: 'p65', name: 'Pork Chops (Center Cut)', price: 11.49, category: 'Meat', image: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=300' },
            { id: 'p66', name: 'Beef Stew Chunks', price: 12.99, category: 'Meat', image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=300' },
            { id: 'p67', name: 'Frozen Pizza (Deluxe)', price: 6.99, category: 'Frozen', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300' },
            { id: 'p68', name: 'Frozen Peas (750g)', price: 3.49, category: 'Frozen', image: 'https://images.unsplash.com/photo-1592394031448-6d863f6848ec?w=300' },
            { id: 'p69', name: 'Ice Cream Sandwich (6pk)', price: 5.49, category: 'Frozen', image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300' },
            { id: 'p70', name: 'Atlantic Cod Fillets', price: 15.99, category: 'Seafood', image: 'https://images.unsplash.com/photo-1626071465942-870020140683?w=300' },
            { id: 'p71', name: 'Cooked Shrimp (340g)', price: 12.49, category: 'Seafood', image: 'https://images.unsplash.com/photo-1551462147-37885abb3e4a?w=300' },
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
            { id: 'p12', name: 'Paper Towels (12pk)', price: 24.99, category: 'Cleaning', image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300' },
            { id: 'p13', name: 'Bottled Water (24pk)', price: 8.99, category: 'Bulk', image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=300' },
            { id: 'p74', name: 'Klintland Mayonnaise (1.9L)', price: 11.49, category: 'Bulk', image: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=300' },
            { id: 'p75', name: 'Coffee Pods (100pk)', price: 42.99, category: 'Bulk', image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300' },
            { id: 'p76', name: 'Dish Soap (5L)', price: 13.99, category: 'Cleaning', image: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=300' },
            { id: 'p77', name: 'Copy Paper (5 Reams)', price: 29.99, category: 'Office', image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300' },
            { id: 'p78', name: 'Large Trash Bags (100pk)', price: 18.49, category: 'Cleaning', image: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=300' },
            { id: 'p79', name: 'Protein Bars (24pk)', price: 26.99, category: 'Bulk', image: 'https://images.unsplash.com/photo-1551462147-37885abb3e4a?w=300' },
            { id: 'p80', name: 'Disinfecting Wipes (3pk)', price: 15.99, category: 'Cleaning', image: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=300' },
            { id: 'p81', name: 'AA Batteries (48pk)', price: 22.49, category: 'Office', image: 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=300' },
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
        categories: ['All', 'Snacks', 'Drinks', 'Tobacco', 'Lottery'],
        flyer: {
            title: 'Weekly Snack Deals',
            validUntil: 'Dec 22, 2024',
            image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od1', name: 'Slurpee (Large)', price: 0.99, originalPrice: 2.49, endsIn: '6 hours', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's1', name: 'Hot Dog Combo', price: 2.99, originalPrice: 4.99, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1612392166886-ee8475b03af2?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p14', name: 'Coca-Cola (2L)', price: 3.49, category: 'Drinks', image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300' },
            { id: 'p15', name: "Lay's Classic Chips", price: 4.29, category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300' },
            { id: 'p16', name: 'Red Bull (4pk)', price: 9.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1613214153279-af3eb67fc2c9?w=300' },
            { id: 'p17', name: 'Doritos Nacho Cheese', price: 4.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300' },
            { id: 'p18', name: 'Gatorade (6pk)', price: 7.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622766815178-641bef2b0cf5?w=300' },
            { id: 'p19', name: 'Cigarettes Pack', price: 15.99, category: 'Tobacco', image: 'https://images.unsplash.com/photo-1527099908998-5c4960c81d21?w=300' },
            { id: 'p84', name: 'Cheetos Puffs', price: 4.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300' },
            { id: 'p85', name: 'Sprite (2L)', price: 3.49, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300' },
            { id: 'p86', name: 'KitKat Bar', price: 1.89, category: 'Snacks', image: 'https://images.unsplash.com/photo-1534260164206-2a3a4a72891d?w=300' },
            { id: 'p87', name: 'Beef Sticks', price: 2.19, category: 'Snacks', image: 'https://images.unsplash.com/photo-1601314167099-232775b3d6fd?w=300' },
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
            { id: 'p20', name: 'Monster Energy', price: 3.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300' },
            { id: 'p21', name: 'Snickers Bar', price: 1.79, category: 'Candy', image: 'https://images.unsplash.com/photo-1534260164206-2a3a4a72891d?w=300' },
            { id: 'p22', name: 'Pepsi (6pk)', price: 5.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=300' },
            { id: 'p23', name: 'Pringles Original', price: 3.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300' },
            { id: 'p24', name: 'Gum (5 packs)', price: 4.99, category: 'Candy', image: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=300' },
            { id: 'p25', name: 'Hand Sanitizer', price: 2.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=300' },
            { id: 'p94', name: 'Skittles (Original)', price: 1.99, category: 'Candy', image: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=300' },
            { id: 'p95', name: 'Dr. Pepper Bottle', price: 2.29, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300' },
            { id: 'p96', name: 'Beef Jerky Mini', price: 2.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1601314167099-232775b3d6fd?w=300' },
            { id: 'p97', name: 'Granola Bar', price: 1.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=300' },
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
            { id: 's8', name: 'Fresh Bagel w/ Cream Cheese', price: 1.99, originalPrice: 3.49, discount: '43% OFF', image: 'https://images.unsplash.com/photo-1585535375030-3de2f1da06f2?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p26', name: 'Deli Sandwich', price: 7.99, category: 'Deli', image: 'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=300' },
            { id: 'p27', name: 'Arizona Iced Tea', price: 1.29, category: 'Drinks', image: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=300' },
            { id: 'p28', name: 'Takis Fuego', price: 3.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300' },
            { id: 'p29', name: 'Fresh OJ (Large)', price: 4.49, category: 'Drinks', image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300' },
            { id: 'p30', name: 'Chopped Cheese Sandwich', price: 8.99, category: 'Deli', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300' },
            { id: 'p31', name: 'Milk (1L)', price: 2.99, category: 'Grocery', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300' },
            { id: 'p104', name: 'Pastrami on Rye', price: 9.49, category: 'Deli', image: 'https://images.unsplash.com/photo-1534422298391-e4f8c170db76?w=300' },
            { id: 'p105', name: 'Hot Coffee', price: 1.50, category: 'Drinks', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300' },
            { id: 'p106', name: 'Plantain Chips', price: 2.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300' },
            { id: 'p107', name: 'Loaf of Bread', price: 3.29, category: 'Grocery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300' },
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
            { id: 's9', name: 'Organic Kale', price: 2.99, originalPrice: 4.99, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1524179091875-bf99a9a6da79?w=300&h=300&fit=crop' }
        ],
        products: [
            { id: 'p32', name: 'Local Honey (500ml)', price: 12.99, category: 'Honey', image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300' },
            { id: 'p33', name: 'Fresh Carrots (Bunch)', price: 3.49, category: 'Produce', image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=300' },
            { id: 'p34', name: 'Strawberry Jam', price: 8.99, category: 'Preserves', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300' },
            { id: 'p114', name: 'Organic Spinach', price: 4.49, category: 'Produce', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=300' },
            { id: 'p115', name: 'Artisan Maple Syrup', price: 18.99, category: 'Honey', image: 'https://images.unsplash.com/photo-1584473457406-6240486418e9?w=300' },
            { id: 'p116', name: 'Red Onions (2lb Bag)', price: 3.99, category: 'Produce', image: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=300' },
            { id: 'p117', name: 'Raspberry Preserves', price: 7.49, category: 'Preserves', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300' },
            { id: 'p118', name: 'Farm Fresh Garlic', price: 2.99, category: 'Produce', image: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=300' },
            { id: 'p119', name: 'Bee Pollen (Small)', price: 24.99, category: 'Honey', image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300' },
            { id: 'p120', name: 'Vine-Ripened Tomatoes', price: 5.49, category: 'Produce', image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=300' },
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
            { id: 's10', name: 'Sourdough Loaf', price: 5.99, originalPrice: 7.99, discount: '25% OFF', image: 'https://images.unsplash.com/photo-1585478259525-408fb9a3d4d4?w=300&h=300&fit=crop' }
        ],
        products: [
            { id: 'p35', name: 'Baguette', price: 3.99, category: 'Bread', image: 'https://images.unsplash.com/photo-1597079916967-640a233b4b88?w=300' },
            { id: 'p36', name: 'Cinnamon Roll', price: 4.49, category: 'Pastries', image: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=300' },
            { id: 'p37', name: 'Cold Brew Coffee', price: 4.99, category: 'Coffee', image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=300' },
            { id: 'p124', name: 'Whole Wheat Loaf', price: 4.99, category: 'Bread', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300' },
            { id: 'p125', name: 'Almond Croissant', price: 4.29, category: 'Pastries', image: 'https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=300' },
            { id: 'p126', name: 'Cappuccino', price: 4.50, category: 'Coffee', image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=300' },
            { id: 'p127', name: 'Focaccia with Herbs', price: 6.99, category: 'Bread', image: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=300' },
            { id: 'p128', name: 'Blueberry Muffin', price: 3.49, category: 'Pastries', image: 'https://images.unsplash.com/photo-1558401391-7899b4bd5bbf?w=300' },
            { id: 'p129', name: 'Latte', price: 4.75, category: 'Coffee', image: 'https://images.unsplash.com/photo-1536964541826-05a460c33e21?w=300' },
            { id: 'p130', name: 'Rye Bread', price: 5.49, category: 'Bread', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300' },
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
            { id: 'p38', name: 'Ribeye Steak (10oz)', price: 18.99, category: 'Beef', image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=300' },
            { id: 'p39', name: 'Chicken Wings (2lb)', price: 14.99, category: 'Chicken', image: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=300' },
            { id: 'p40', name: 'Spicy Italian Sausages', price: 9.99, category: 'Sausages', image: 'https://images.unsplash.com/photo-1595486894562-436854188fa6?w=300' },
            { id: 'p134', name: 'T-Bone Steak', price: 24.49, category: 'Beef', image: 'https://images.unsplash.com/photo-1600123547265-f938d823674b?w=300' },
            { id: 'p135', name: 'Chicken Thighs (Family Pack)', price: 12.99, category: 'Chicken', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300' },
            { id: 'p136', name: 'Pork Tenderloin', price: 14.99, category: 'Pork', image: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=300' },
            { id: 'p137', name: 'Bratwurst Sausages', price: 8.49, category: 'Sausages', image: 'https://images.unsplash.com/photo-1595486894562-436854188fa6?w=300' },
            { id: 'p138', name: 'Beef Brisket (2lb)', price: 22.99, category: 'Beef', image: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=300' },
            { id: 'p139', name: 'Rotisserie Chicken', price: 10.99, category: 'Chicken', image: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=300' },
            { id: 'p140', name: 'Bacon Slabs (Local)', price: 11.49, category: 'Pork', image: 'https://images.unsplash.com/photo-1523905491727-d82018a34d75?w=300' },
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
        categories: ['All', 'Fiction', 'Non-Fiction', 'Kids', 'Gifts'],
        flyer: {
            title: 'Winter Reads',
            validUntil: 'Jan 15, 2025',
            image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od12', name: 'Mystery Box (3 Books)', price: 15.99, originalPrice: 30.00, endsIn: '12 hours', image: 'https://images.unsplash.com/photo-1519682337058-a69d6e3537b0?w=300&h=300&fit=crop' }
        ],
        saleItems: [
            { id: 's12', name: '2025 Planner', price: 12.99, originalPrice: 24.99, discount: '50% OFF', image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=300&h=300&fit=crop' }
        ],
        products: [
            { id: 'p41', name: 'Top Fiction Novel', price: 24.99, category: 'Fiction', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300' },
            { id: 'p42', name: 'Cookbook: Local Eats', price: 34.99, category: 'Non-Fiction', image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=300' },
            { id: 'p43', name: 'Reading Light', price: 15.99, category: 'Gifts', image: 'https://images.unsplash.com/photo-1513506003013-19c6cd96ef06?w=300' },
            { id: 'p144', name: 'Fantasy Epic Vol 1', price: 22.49, category: 'Fiction', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300' },
            { id: 'p145', name: 'History of Space', price: 28.99, category: 'Non-Fiction', image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=300' },
            { id: 'p146', name: 'Picture Book: Tiny Ant', price: 14.99, category: 'Kids', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300' },
            { id: 'p147', name: 'Fancy Bookmark Set', price: 9.99, category: 'Gifts', image: 'https://images.unsplash.com/photo-1513506003013-19c6cd96ef06?w=300' },
            { id: 'p148', name: 'The Art of Cooking', price: 39.99, category: 'Non-Fiction', image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=300' },
            { id: 'p149', name: 'Mystery Thriller', price: 18.49, category: 'Fiction', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300' },
            { id: 'p150', name: 'Lego Creator Set', price: 49.99, category: 'Kids', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300' },
        ]
    }
};
