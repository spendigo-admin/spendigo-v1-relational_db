import { optimize_cart } from '../../../smartcart_optimizer';
import { SmartCartOptimizedCart, SmartCartStoreData } from './types';

export function optimizeCart(
    shoppingList: string[],
    storeProducts: SmartCartStoreData[],
): SmartCartOptimizedCart {
    return optimize_cart(shoppingList, storeProducts);
}
