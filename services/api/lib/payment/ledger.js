"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerService = void 0;
// In-memory mock for now, would write to 'payments' table
class LedgerService {
    async record(entry) {
        console.log(`[LEDGER] ${entry.transactionType}: $${entry.amountCents / 100} -> ${entry.destinationReference} (Ref: ${entry.sourceReference})`);
        // TODO: Insert into DB
        // await db.insert('payments').values(entry);
    }
    async reconcileDaily() {
        // Placeholder for reconciliation logic (Stripe API vs DB Sums)
        return true;
    }
}
exports.LedgerService = LedgerService;
//# sourceMappingURL=ledger.js.map