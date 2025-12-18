import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import '../../styles/design-system.css';

// Mock Store Data with flyers, discounts, sale items, and one-day offers
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
        // Weekly Flyer
        flyer: {
            title: 'Weekly Savings Flyer',
            validUntil: 'Dec 22, 2024',
            image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&h=400&fit=crop'
        },
        // One Day Offers
        oneDayOffers: [
            { id: 'od1', name: 'Fresh Strawberries', price: 2.99, originalPrice: 5.99, endsIn: '8 hours', image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=300&h=300&fit=crop' },
            { id: 'od2', name: 'Orange Juice (2L)', price: 3.49, originalPrice: 6.99, endsIn: '8 hours', image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300&h=300&fit=crop' },
        ],
        // Sale Items
        saleItems: [
            { id: 's1', name: 'Organic Eggs (12pk)', price: 4.99, originalPrice: 7.99, discount: '38% OFF', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300&h=300&fit=crop' },
            { id: 's2', name: 'Whole Wheat Bread', price: 2.49, originalPrice: 3.99, discount: '38% OFF', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
        ],
        // Regular Products
        products: [
            { id: 'p1', name: 'Organic Avocados (5pk)', price: 6.99, originalPrice: 8.99, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=300&h=300&fit=crop' },
            { id: 'p2', name: 'Almond Milk (1L)', price: 4.49, category: 'Dairy', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop' },
            { id: 'p3', name: 'Sourdough Loaf', price: 5.99, category: 'Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
            { id: 'p4', name: 'Organic Bananas (bunch)', price: 2.99, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop' },
            { id: 'p5', name: 'Greek Yogurt (500g)', price: 5.49, category: 'Dairy', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=300&fit=crop' },
            { id: 'p6', name: 'Olive Oil (750ml)', price: 12.99, category: 'Pantry', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&h=300&fit=crop' },
            { id: 'p44', name: 'Gala Apples (3lb)', price: 4.99, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=300&h=300&fit=crop' },
            { id: 'p45', name: 'Baby Spinach (5oz)', price: 3.49, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=300&h=300&fit=crop' },
            { id: 'p46', name: 'Whole Milk (4L)', price: 5.89, category: 'Dairy', image: 'https://images.unsplash.com/photo-1711625826512-f0165fa3846d?w=300&h=300&fit=crop' },
            { id: 'p47', name: 'Cheddar Cheese (400g)', price: 7.49, category: 'Dairy', image: 'https://images.unsplash.com/photo-1723473620176-8d26dc6314cf?w=300&h=300&fit=crop' },
            { id: 'p48', name: 'Baguette', price: 3.29, category: 'Bakery', image: 'https://images.unsplash.com/photo-1554475659-9fd915c8f156?w=300&h=300&fit=crop' },
            { id: 'p49', name: 'Chocolate Croissant', price: 2.99, category: 'Bakery', image: 'https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=300&h=300&fit=crop' },
            { id: 'p50', name: 'Basmati Rice (2kg)', price: 8.99, category: 'Pantry', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&h=300&fit=crop' },
            { id: 'p51', name: 'Penne Rigate (900g)', price: 2.49, category: 'Pantry', image: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?w=300&h=300&fit=crop' },
            { id: 'p52', name: 'Peanut Butter (1kg)', price: 6.99, category: 'Pantry', image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=300&h=300&fit=crop' },
            { id: 'p53', name: 'Black Beans (540ml)', price: 1.79, category: 'Pantry', image: 'https://images.unsplash.com/photo-1627424497008-a529767e5de4?w=300&h=300&fit=crop' },
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
            { id: 'p10', name: 'Chicken Breast (1kg)', price: 14.99, category: 'Meat', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300&h=300&fit=crop' },
            { id: 'p11', name: 'Salmon Fillet (500g)', price: 18.99, category: 'Seafood', image: 'https://images.unsplash.com/photo-1499125562588-29fb8a56b5d5?w=300&h=300&fit=crop' },
            { id: 'p64', name: 'Ground Beef (450g)', price: 8.99, category: 'Meat', image: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=300&h=300&fit=crop' },
            { id: 'p65', name: 'Pork Chops (Center Cut)', price: 11.49, category: 'Meat', image: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=300&h=300&fit=crop' },
            { id: 'p66', name: 'Beef Stew Chunks', price: 12.99, category: 'Meat', image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=300&h=300&fit=crop' },
            { id: 'p67', name: 'Frozen Pizza (Deluxe)', price: 6.99, category: 'Frozen', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&h=300&fit=crop' },
            { id: 'p68', name: 'Frozen Peas (750g)', price: 3.49, category: 'Frozen', image: 'https://images.unsplash.com/photo-1632640107798-75f2be4b9329?w=300&h=300&fit=crop' },
            { id: 'p69', name: 'Ice Cream Sandwich (6pk)', price: 5.49, category: 'Frozen', image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300&h=300&fit=crop' },
            { id: 'p70', name: 'Atlantic Cod Fillets', price: 15.99, category: 'Seafood', image: 'https://images.unsplash.com/photo-1664288377740-1bec924cd622?w=300&h=300&fit=crop' },
            { id: 'p71', name: 'Cooked Shrimp (340g)', price: 12.49, category: 'Seafood', image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=300&h=300&fit=crop' },
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
            { id: 'p80', name: 'Disinfecting Wipes (3pk)', price: 15.99, category: 'Cleaning', image: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=300&h=300&fit=crop' },
            { id: 'p81', name: 'AA Batteries (48pk)', price: 22.49, category: 'Office', image: 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=300&h=300&fit=crop' },
            { id: 'p82', name: 'Olive Oil (3L Bulk)', price: 34.99, category: 'Bulk', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&h=300&fit=crop' },
            { id: 'p83', name: 'Dishwasher Tabs (115pk)', price: 21.99, category: 'Cleaning', image: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=300&h=300&fit=crop' },
        ]
    },
    // LOCAL CONVENIENCE STORES
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
            { id: 'p19', name: 'Cigarettes Pack', price: 15.99, category: 'Tobacco', image: 'https://images.unsplash.com/photo-1528671839653-1f8ab2e4bda1?w=300&h=300&fit=crop' },
            { id: 'p84', name: 'Cheetos Puffs', price: 4.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300&h=300&fit=crop' },
            { id: 'p85', name: 'Sprite (2L)', price: 3.49, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300&h=300&fit=crop' },
            { id: 'p86', name: 'KitKat Bar', price: 1.89, category: 'Snacks', image: 'https://images.unsplash.com/photo-1534260164206-2a3a4a72891d?w=300&h=300&fit=crop' },
            { id: 'p87', name: 'Beef Sticks', price: 2.19, category: 'Snacks', image: 'https://images.unsplash.com/photo-1601314167099-232775b3d6fd?w=300&h=300&fit=crop' },
            { id: 'p88', name: 'Pepsi (500ml)', price: 2.29, category: 'Drinks', image: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=300&h=300&fit=crop' },
            { id: 'p89', name: 'Orange Juice Bottle', price: 2.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300&h=300&fit=crop' },
            { id: 'p90', name: 'Lighter', price: 2.49, category: 'Tobacco', image: 'https://images.unsplash.com/photo-1533560904424-a0c61dc306fc?w=300&h=300&fit=crop' },
            { id: 'p91', name: 'Gum (Fruit)', price: 1.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=300&h=300&fit=crop' },
            { id: 'p92', name: 'Lottery Ticket XL', price: 5.00, category: 'Lottery', image: 'https://images.unsplash.com/photo-1518133835878-5a93cc3f89e5?w=300&h=300&fit=crop' },
            { id: 'p93', name: 'Instant Win Card', price: 2.00, category: 'Lottery', image: 'https://images.unsplash.com/photo-1518133835878-5a93cc3f89e5?w=300&h=300&fit=crop' },
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
            { id: 'p20', name: 'Monster Energy', price: 3.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300&h=300&fit=crop' },
            { id: 'p21', name: 'Snickers Bar', price: 1.79, category: 'Candy', image: 'https://images.unsplash.com/photo-1534260164206-2a3a4a72891d?w=300&h=300&fit=crop' },
            { id: 'p22', name: 'Pepsi (6pk)', price: 5.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=300&h=300&fit=crop' },
            { id: 'p23', name: 'Pringles Original', price: 3.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300&h=300&fit=crop' },
            { id: 'p24', name: 'Gum (5 packs)', price: 4.99, category: 'Candy', image: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=300&h=300&fit=crop' },
            { id: 'p25', name: 'Hand Sanitizer', price: 2.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=300&h=300&fit=crop' },
            { id: 'p94', name: 'Skittles (Original)', price: 1.99, category: 'Candy', image: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=300&h=300&fit=crop' },
            { id: 'p95', name: 'Dr. Pepper Bottle', price: 2.29, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300&h=300&fit=crop' },
            { id: 'p96', name: 'Beef Jerky Mini', price: 2.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1601314167099-232775b3d6fd?w=300&h=300&fit=crop' },
            { id: 'p97', name: 'Granola Bar', price: 1.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=300&h=300&fit=crop' },
            { id: 'p98', name: 'M&Ms Peanut', price: 1.99, category: 'Candy', image: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=300&h=300&fit=crop' },
            { id: 'p99', name: 'Naphtha Lighter', price: 4.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1527099908998-5c4960c81d21?w=300&h=300&fit=crop' },
            { id: 'p100', name: 'Ibuprofen (20pk)', price: 7.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=300&fit=crop' },
            { id: 'p101', name: 'Vitamin Water', price: 2.79, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300&h=300&fit=crop' },
            { id: 'p102', name: 'Licorice Twists', price: 3.29, category: 'Candy', image: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=300&h=300&fit=crop' },
            { id: 'p103', name: 'Pocket Tissues', price: 0.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&h=300&fit=crop' },
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
            { id: 's8', name: 'Fresh Bagel w/ Cream Cheese', price: 1.99, originalPrice: 3.49, discount: '43% OFF', image: 'https://images.unsplash.com/photo-1707079266703-b67f36a881f1?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p26', name: 'Deli Sandwich', price: 7.99, category: 'Deli', image: 'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=300&h=300&fit=crop' },
            { id: 'p27', name: 'Arizona Iced Tea', price: 1.29, category: 'Drinks', image: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=300&h=300&fit=crop' },
            { id: 'p28', name: 'Takis Fuego', price: 3.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300&h=300&fit=crop' },
            { id: 'p29', name: 'Fresh OJ (Large)', price: 4.49, category: 'Drinks', image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300&h=300&fit=crop' },
            { id: 'p30', name: 'Chopped Cheese Sandwich', price: 8.99, category: 'Deli', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300&h=300&fit=crop' },
            { id: 'p31', name: 'Milk (1L)', price: 2.99, category: 'Grocery', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop' },
            { id: 'p104', name: 'Pastrami on Rye', price: 9.49, category: 'Deli', image: 'https://images.unsplash.com/photo-1640290982696-758e885f1859?w=300&h=300&fit=crop' },
            { id: 'p105', name: 'Hot Coffee', price: 1.50, category: 'Drinks', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&h=300&fit=crop' },
            { id: 'p106', name: 'Plantain Chips', price: 2.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300&h=300&fit=crop' },
            { id: 'p107', name: 'Loaf of Bread', price: 3.29, category: 'Grocery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
            { id: 'p108', name: 'Dozens of Eggs', price: 5.99, category: 'Grocery', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300&h=300&fit=crop' },
            { id: 'p109', name: 'Butter Block', price: 4.99, category: 'Grocery', image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=300&h=300&fit=crop' },
            { id: 'p110', name: 'Ginger Beer', price: 2.79, category: 'Drinks', image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=300&h=300&fit=crop' },
            { id: 'p111', name: 'Sunflower Seeds', price: 1.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300&h=300&fit=crop' },
            { id: 'p112', name: 'Ham & Cheese Wrap', price: 6.99, category: 'Deli', image: 'https://images.unsplash.com/photo-1705131187470-9458824c0d79?w=300&h=300&fit=crop' },
            { id: 'p113', name: 'Avocado (Single)', price: 1.49, category: 'Grocery', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=300&h=300&fit=crop' },
        ]
    },
    // LOCAL SPECIALTY STORES
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
            { id: 's9', name: 'Organic Kale', price: 2.99, originalPrice: 4.99, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1624300477446-d379e923eca8?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p32', name: 'Local Honey (500ml)', price: 12.99, category: 'Honey', image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300&h=300&fit=crop' },
            { id: 'p33', name: 'Fresh Carrots (Bunch)', price: 3.49, category: 'Produce', image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=300&h=300&fit=crop' },
            { id: 'p34', name: 'Strawberry Jam', price: 8.99, category: 'Preserves', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&h=300&fit=crop' },
            { id: 'p114', name: 'Organic Spinach', price: 4.49, category: 'Produce', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=300&h=300&fit=crop' },
            { id: 'p115', name: 'Artisan Maple Syrup', price: 18.99, category: 'Honey', image: 'https://images.unsplash.com/photo-1584473457406-6240486418e9?w=300&h=300&fit=crop' },
            { id: 'p116', name: 'Red Onions (2lb Bag)', price: 3.99, category: 'Produce', image: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=300&h=300&fit=crop' },
            { id: 'p117', name: 'Raspberry Preserves', price: 7.49, category: 'Preserves', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&h=300&fit=crop' },
            { id: 'p118', name: 'Farm Fresh Garlic', price: 2.99, category: 'Produce', image: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=300&h=300&fit=crop' },
            { id: 'p119', name: 'Bee Pollen (Small)', price: 24.99, category: 'Honey', image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300&h=300&fit=crop' },
            { id: 'p120', name: 'Vine-Ripened Tomatoes', price: 5.49, category: 'Produce', image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=300&h=300&fit=crop' },
            { id: 'p121', name: 'Pickled Beets Jar', price: 6.99, category: 'Preserves', image: 'https://images.unsplash.com/photo-1573426667638-18ccdd988a39?w=300&h=300&fit=crop' },
            { id: 'p122', name: 'Wildflower Honey', price: 14.49, category: 'Honey', image: 'https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=300&h=300&fit=crop' },
            { id: 'p123', name: 'Fresh Cilantro', price: 1.29, category: 'Produce', image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=300&h=300&fit=crop' },
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
            { id: 's10', name: 'Sourdough Loaf', price: 5.99, originalPrice: 7.99, discount: '25% OFF', image: 'https://images.unsplash.com/photo-1613396874083-2d5fbe59ae79?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p35', name: 'Baguette', price: 3.99, category: 'Bread', image: 'https://images.unsplash.com/photo-1554475659-9fd915c8f156?w=300&h=300&fit=crop' },
            { id: 'p36', name: 'Cinnamon Roll', price: 4.49, category: 'Pastries', image: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=300&h=300&fit=crop' },
            { id: 'p37', name: 'Cold Brew Coffee', price: 4.99, category: 'Coffee', image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=300&h=300&fit=crop' },
            { id: 'p124', name: 'Whole Wheat Loaf', price: 4.99, category: 'Bread', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
            { id: 'p125', name: 'Almond Croissant', price: 4.29, category: 'Pastries', image: 'https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=300&h=300&fit=crop' },
            { id: 'p126', name: 'Cappuccino', price: 4.50, category: 'Coffee', image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=300&h=300&fit=crop' },
            { id: 'p127', name: 'Focaccia with Herbs', price: 6.99, category: 'Bread', image: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=300&h=300&fit=crop' },
            { id: 'p128', name: 'Blueberry Muffin', price: 3.49, category: 'Pastries', image: 'https://images.unsplash.com/photo-1558401391-7899b4bd5bbf?w=300&h=300&fit=crop' },
            { id: 'p129', name: 'Latte', price: 4.75, category: 'Coffee', image: 'https://images.unsplash.com/photo-1593443320739-77f74939d0da?w=300&h=300&fit=crop' },
            { id: 'p130', name: 'Rye Bread', price: 5.49, category: 'Bread', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
            { id: 'p131', name: 'Cheese Danish', price: 3.99, category: 'Pastries', image: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=300&h=300&fit=crop' },
            { id: 'p132', name: 'Espresso Shot', price: 2.50, category: 'Coffee', image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=300&h=300&fit=crop' },
            { id: 'p133', name: 'Multigrain Roll', price: 1.25, category: 'Bread', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
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
            { id: 'p38', name: 'Ribeye Steak (10oz)', price: 18.99, category: 'Beef', image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=300&h=300&fit=crop' },
            { id: 'p39', name: 'Chicken Wings (2lb)', price: 14.99, category: 'Chicken', image: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=300&h=300&fit=crop' },
            { id: 'p40', name: 'Spicy Italian Sausages', price: 9.99, category: 'Sausages', image: 'https://images.unsplash.com/photo-1585325701165-351af916e581?w=300&h=300&fit=crop' },
            { id: 'p134', name: 'T-Bone Steak', price: 24.49, category: 'Beef', image: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=300&h=300&fit=crop' },
            { id: 'p135', name: 'Chicken Thighs (Family Pack)', price: 12.99, category: 'Chicken', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300&h=300&fit=crop' },
            { id: 'p136', name: 'Pork Tenderloin', price: 14.99, category: 'Pork', image: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=300&h=300&fit=crop' },
            { id: 'p137', name: 'Bratwurst Sausages', price: 8.49, category: 'Sausages', image: 'https://images.unsplash.com/photo-1585325701165-351af916e581?w=300&h=300&fit=crop' },
            { id: 'p138', name: 'Beef Brisket (2lb)', price: 22.99, category: 'Beef', image: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=300&h=300&fit=crop' },
            { id: 'p139', name: 'Rotisserie Chicken', price: 10.99, category: 'Chicken', image: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=300&h=300&fit=crop' },
            { id: 'p140', name: 'Bacon Slabs (Local)', price: 11.49, category: 'Pork', image: 'https://images.unsplash.com/photo-1523905491727-d82018a34d75?w=300&h=300&fit=crop' },
            { id: 'p141', name: 'Breakfast Sausages', price: 7.99, category: 'Sausages', image: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=300&h=300&fit=crop' },
            { id: 'p142', name: 'Sirloin Tip Roast', price: 16.99, category: 'Beef', image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=300&h=300&fit=crop' },
            { id: 'p143', name: 'Smoked Pork Shoulder', price: 19.49, category: 'Pork', image: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=300&h=300&fit=crop' },
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
            { id: 'od12', name: 'Mystery Box (3 Books)', price: 15.99, originalPrice: 30.00, endsIn: '12 hours', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=300&fit=crop' }
        ],
        saleItems: [
            { id: 's12', name: '2025 Planner', price: 12.99, originalPrice: 24.99, discount: '50% OFF', image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=300&h=300&fit=crop' }
        ],
        products: [
            { id: 'p41', name: 'Top Fiction Novel', price: 24.99, category: 'Fiction', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=300&fit=crop' },
            { id: 'p42', name: 'Cookbook: Local Eats', price: 34.99, category: 'Non-Fiction', image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=300&h=300&fit=crop' },
            { id: 'p43', name: 'Reading Light', price: 15.99, category: 'Gifts', image: 'https://images.unsplash.com/photo-1692864626388-27357518e5ea?w=300&h=300&fit=crop' },
            { id: 'p144', name: 'Fantasy Epic Vol 1', price: 22.49, category: 'Fiction', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=300&fit=crop' },
            { id: 'p145', name: 'History of Space', price: 28.99, category: 'Non-Fiction', image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=300&h=300&fit=crop' },
            { id: 'p146', name: 'Picture Book: Tiny Ant', price: 14.99, category: 'Kids', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=300&fit=crop' },
            { id: 'p147', name: 'Fancy Bookmark Set', price: 9.99, category: 'Gifts', image: 'https://images.unsplash.com/photo-1561865406-62a037159577?w=300&h=300&fit=crop' },
            { id: 'p148', name: 'The Art of Cooking', price: 39.99, category: 'Non-Fiction', image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=300&h=300&fit=crop' },
            { id: 'p149', name: 'Mystery Thriller', price: 18.49, category: 'Fiction', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=300&fit=crop' },
            { id: 'p150', name: 'Lego Creator Set', price: 49.99, category: 'Kids', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=300&fit=crop' },
            { id: 'p151', name: 'Journaling Kit', price: 25.99, category: 'Gifts', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=300&fit=crop' },
            { id: 'p152', name: 'Classic Poetry Book', price: 12.99, category: 'Fiction', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=300&fit=crop' },
            { id: 'p153', name: 'Animal Encyclopedia', price: 19.99, category: 'Kids', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=300&fit=crop' },
        ]
    }
};

const StoreDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const store = STORE_DATA[id || ''] || null;
    const [activeTab, setActiveTab] = useState<'products' | 'flyer' | 'offers'>('products');
    const [activeCategory, setActiveCategory] = useState('All');

    if (!store) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-[var(--text-muted)]">Store not found.</p>
            </div>
        );
    }

    const filteredProducts = activeCategory === 'All'
        ? store.products
        : store.products.filter((p: any) => p.category === activeCategory);

    const handleQuickAdd = (product: any) => {
        addToCart({
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity: 1,
            storeId: store.id,
            storeName: store.name,
            image: product.image
        });
    };

    return (
        <div className="animate-fade-in pb-20">
            {/* STORE HEADER */}
            <div className="relative h-48 md:h-64 bg-[var(--surface-2)]">
                <img src={store.image} alt={store.name} className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-0)] via-transparent to-transparent"></div>

                {/* Back Button */}
                <button
                    onClick={() => navigate('/')}
                    className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 shadow-lg text-[var(--text-main)] flex items-center justify-center hover:bg-white transition-colors"
                >
                    ←
                </button>

                {/* Store Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                    <div className="flex items-end gap-4">
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white border-2 border-[var(--glass-border)] flex items-center justify-center text-3xl md:text-4xl shadow-lg">
                            {store.logo}
                        </div>
                        <div className="flex-1">
                            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-main)]">{store.name}</h1>
                            <p className="text-sm text-[var(--text-muted)]">{store.tagline}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* STORE STATS */}
            <div className="px-4 py-4 flex items-center gap-4 text-sm border-b border-[var(--glass-border)] overflow-x-auto">
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <span className="text-yellow-500">★</span>
                    <span className="font-medium text-[var(--text-main)]">{store.rating}</span>
                </div>
                <div className="w-px h-4 bg-[var(--glass-border)]"></div>
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <span>🚚</span>
                    <span className="text-[var(--text-muted)]">{store.deliveryTime}</span>
                </div>
                <div className="w-px h-4 bg-[var(--glass-border)]"></div>
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <span>💰</span>
                    <span className="text-[var(--text-muted)]">{store.deliveryFee}</span>
                </div>
            </div>

            {/* MAIN TABS: Products | Flyer | Offers */}
            <div className="px-4 py-3 sticky top-14 z-40 bg-[var(--surface-0)] border-b border-[var(--glass-border)]">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'products' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                    >
                        🛒 Products
                    </button>
                    <button
                        onClick={() => setActiveTab('flyer')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'flyer' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                    >
                        📰 Weekly Flyer
                    </button>
                    <button
                        onClick={() => setActiveTab('offers')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'offers' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                    >
                        🔥 Deals
                    </button>
                </div>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'products' && (
                <>
                    {/* Category Filters */}
                    <div className="px-4 py-3 bg-[var(--surface-1)] border-b border-[var(--glass-border)]">
                        <div className="overflow-x-auto scrollbar-hide">
                            <div className="flex gap-2 min-w-max">
                                {store.categories.map((cat: string) => (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeCategory === cat ? 'bg-[var(--text-main)] text-white' : 'bg-white text-[var(--text-muted)] border border-[var(--glass-border)]'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className="p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredProducts.map((product: any) => (
                                <div key={product.id} className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
                                    <div onClick={() => navigate(`/product/${product.id}`)} className="h-32 md:h-40 bg-[var(--surface-1)] relative cursor-pointer overflow-hidden">
                                        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        {product.originalPrice && (
                                            <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">SALE</div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <p onClick={() => navigate(`/product/${product.id}`)} className="font-medium text-sm text-[var(--text-main)] truncate cursor-pointer hover:text-[var(--brand-primary)]">{product.name}</p>
                                        <div className="flex items-baseline gap-2 mt-1">
                                            <span className="font-bold text-[var(--brand-primary)]">${product.price.toFixed(2)}</span>
                                            {product.originalPrice && (
                                                <span className="text-xs text-[var(--text-muted)] line-through">${product.originalPrice.toFixed(2)}</span>
                                            )}
                                        </div>
                                        <button onClick={() => handleQuickAdd(product)} className="w-full mt-3 py-2 bg-[var(--brand-primary)] text-white text-sm font-medium rounded-lg hover:brightness-110 transition-all">
                                            + Add to Cart
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'flyer' && (
                <div className="p-4">
                    {/* Flyer Card */}
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                        <img src={store.flyer.image} alt={store.flyer.title} className="w-full h-48 object-cover" />
                        <div className="p-4">
                            <h3 className="text-xl font-bold text-[var(--text-main)]">{store.flyer.title}</h3>
                            <p className="text-sm text-[var(--text-muted)] mt-1">Valid until {store.flyer.validUntil}</p>
                            <button className="mt-4 w-full py-3 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110">
                                View Full Flyer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'offers' && (
                <div className="p-4 space-y-6">
                    {/* One Day Offers */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl">⏰</span>
                            <h3 className="text-lg font-bold text-[var(--text-main)]">One-Day Offers</h3>
                            <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">Limited Time</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {store.oneDayOffers?.map((offer: any) => (
                                <div key={offer.id} className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-100 p-3">
                                    <img src={offer.image} alt={offer.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                                    <p className="font-medium text-sm text-[var(--text-main)] truncate">{offer.name}</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="font-bold text-red-600">${offer.price.toFixed(2)}</span>
                                        <span className="text-xs text-[var(--text-muted)] line-through">${offer.originalPrice.toFixed(2)}</span>
                                    </div>
                                    <p className="text-xs text-red-500 mt-1">⏱ Ends in {offer.endsIn}</p>
                                    <button onClick={() => handleQuickAdd(offer)} className="w-full mt-2 py-2 bg-red-500 text-white text-xs font-medium rounded-lg">
                                        + Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sale Items */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl">🏷️</span>
                            <h3 className="text-lg font-bold text-[var(--text-main)]">Items on Sale</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {store.saleItems?.map((item: any) => (
                                <div key={item.id} className="bg-white rounded-xl border border-[var(--glass-border)] p-3 shadow-sm">
                                    <div className="relative">
                                        <img src={item.image} alt={item.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                                        <span className="absolute top-1 left-1 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">{item.discount}</span>
                                    </div>
                                    <p className="font-medium text-sm text-[var(--text-main)] truncate">{item.name}</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="font-bold text-green-600">${item.price.toFixed(2)}</span>
                                        <span className="text-xs text-[var(--text-muted)] line-through">${item.originalPrice.toFixed(2)}</span>
                                    </div>
                                    <button onClick={() => handleQuickAdd(item)} className="w-full mt-2 py-2 bg-[var(--brand-primary)] text-white text-xs font-medium rounded-lg">
                                        + Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoreDetail;
