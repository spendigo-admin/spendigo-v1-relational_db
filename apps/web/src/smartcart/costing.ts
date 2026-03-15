import { SmartCartPriceMatrixCell } from '../types/smartCart';

export function getComparableCellCost(cell: SmartCartPriceMatrixCell): number | null {
    if (!cell.available) {
        return null;
    }

    if (cell.isComparableByUnitPrice && cell.unitPrice !== null) {
        return cell.unitPrice;
    }

    return cell.price;
}
