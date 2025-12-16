export interface LedgerEntry {
    id?: string;
    transactionType: 'CHARGE' | 'TRANSFER' | 'REFUND' | 'COMMISSION';
    amountCents: number;
    currency: 'CAD';
    sourceReference: string; // e.g. stripe_charge_id
    destinationReference: string; // e.g. store_account_id or 'PLATFORM'
    orderId?: string;
    cartId?: string;
    metadata?: any;
    timestamp: Date;
}

// In-memory mock for now, would write to 'payments' table
export class LedgerService {
    async record(entry: LedgerEntry): Promise<void> {
        console.log(`[LEDGER] ${entry.transactionType}: $${entry.amountCents / 100} -> ${entry.destinationReference} (Ref: ${entry.sourceReference})`);

        // TODO: Insert into DB
        // await db.insert('payments').values(entry);
    }

    async reconcileDaily(): Promise<boolean> {
        // Placeholder for reconciliation logic (Stripe API vs DB Sums)
        return true;
    }
}
