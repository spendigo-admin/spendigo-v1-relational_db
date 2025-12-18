// Shared store data for the application
export const STORE_DATA: Record<string, any> = {
    '1': {
        id: '1',
        name: 'FreshMart',
        products: [
            { id: 'p1', name: 'Organic Avocados (5pk)', price: 6.99, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=300&h=300&fit=crop' },
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
        products: [
            { id: 'p7', name: 'Energy Drink (4pk)', price: 9.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1560689189-65b6ed6228e7?w=300&h=300&fit=crop' },
            { id: 'p8', name: 'Chips Party Size', price: 4.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300&h=300&fit=crop' },
            { id: 'p9', name: 'Ice Cream Pint', price: 6.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300&h=300&fit=crop' },
            { id: 'p54', name: 'Mountain Dew (12pk)', price: 7.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622766815178-641bef2b0cf5?w=300&h=300&fit=crop' },
            { id: 'p55', name: 'Gatorade (600ml)', price: 2.49, category: 'Drinks', image: 'https://images.unsplash.com/photo-1649345867132-e8bd35bedf76?w=300&h=300&fit=crop' },
            { id: 'p56', name: 'Beef Jerky (80g)', price: 5.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1601314167099-232775b3d6fd?w=300&h=300&fit=crop' },
            { id: 'p57', name: 'Gummy Bears', price: 3.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=300&h=300&fit=crop' },
            { id: 'p58', name: 'Pretzels (Large Bag)', price: 4.29, category: 'Snacks', image: 'https://images.unsplash.com/photo-1609438824822-5b3a0e9abb4e?w=300&h=300&fit=crop' },
            { id: 'p59', name: 'Advil (10pk)', price: 6.49, category: 'Essentials', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=300&fit=crop' },
            { id: 'p60', name: 'Phone Charging Cable', price: 12.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&h=300&fit=crop' },
            { id: 'p61', name: 'Paper Towels (Single)', price: 2.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&h=300&fit=crop' },
            { id: 'p62', name: 'Trail Mix', price: 4.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1763244420864-7e1eae94efff?w=300&h=300&fit=crop' },
            { id: 'p63', name: 'Instant Noodles Cup', price: 1.49, category: 'Essentials', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=300&h=300&fit=crop' },
            { id: 'p_qp_1', name: 'Sourdough Loaf', price: 6.49, category: 'Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' }, // More expensive than Store 1
            { id: 'p_qp_2', name: 'Whole Milk (4L)', price: 6.29, category: 'Dairy', image: 'https://images.unsplash.com/photo-1711625826512-f0165fa3846d?w=300&h=300&fit=crop' }, // More expensive than Store 1
            { id: 'p_qp_3', name: 'Almond Milk (1L)', price: 4.99, category: 'Dairy', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop' }, // Expensive
            { id: 'p_qp_4', name: 'Organic Bananas (bunch)', price: 3.49, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop' }, // Expensive
            { id: 'p_qp_5', name: 'Cheddar Cheese (400g)', price: 8.49, category: 'Dairy', image: 'https://images.unsplash.com/photo-1723473620176-8d26dc6314cf?w=300&h=300&fit=crop' }, // Expensive
        ]
    },
    '3': {
        id: '3',
        name: 'Metro Express',
        products: [
            { id: 'p10', name: 'Chicken Breast (1kg)', price: 14.99, category: 'Meat', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300&h=300&fit=crop' },
            { id: 'p11', name: 'Salmon Fillet (500g)', price: 18.99, category: 'Seafood', image: 'https://images.unsplash.com/photo-1499125562588-29fb8a56b5d5?w=300&h=300&fit=crop' },
            { id: 'p_me_1', name: 'Almond Milk (1L)', price: 3.99, category: 'Dairy', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop' }, // Cheapest!
            { id: 'p_me_2', name: 'Organic Bananas (bunch)', price: 2.49, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop' }, // Cheapest!
            { id: 'p_me_3', name: 'Cheddar Cheese (400g)', price: 6.99, category: 'Dairy', image: 'https://images.unsplash.com/photo-1723473620176-8d26dc6314cf?w=300&h=300&fit=crop' }, // Cheapest!
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
    }
};

// Build product price database from store data
export function buildProductDatabase() {
    const productMap: Record<string, {
        name: string;
        category: string;
        image: string;
        stores: { storeId: string; storeName: string; price: number; inStock: boolean }[]
    }> = {};

    Object.values(STORE_DATA).forEach(store => {
        store.products?.forEach((product: any) => {
            if (!productMap[product.id]) {
                productMap[product.id] = {
                    name: product.name,
                    category: product.category,
                    image: product.image,
                    stores: []
                };
            }
            productMap[product.id].stores.push({
                storeId: store.id,
                storeName: store.name,
                price: product.price,
                inStock: true
            });
        });
    });

    return productMap;
}

// Get all available items for wishlist
export function getAllAvailableItems() {
    const productDb = buildProductDatabase();
    return Object.entries(productDb).map(([id, data]) => ({
        id,
        name: data.name,
        category: data.category,
        image: data.image,
    }));
}
