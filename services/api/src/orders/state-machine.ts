export enum OrderStatus {
    CREATED = 'confirmed', // Initial state, payment authorized
    ACCEPTED = 'accepted', // Merchant confirmed stock
    READY = 'ready_for_pickup', // Packet and ready
    FULFILLED = 'fulfilled', // Handed to customer/driver
    CANCELLED = 'cancelled', // By user or merchant
    SLA_BREACH = 'cancelled_sla' // Auto-cancelled
}

export interface OrderTransition {
    from: OrderStatus;
    to: OrderStatus;
    actor: 'system' | 'merchant' | 'consumer' | 'admin';
}

// Strict Transition Rules
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.CREATED]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED, OrderStatus.SLA_BREACH],
    [OrderStatus.ACCEPTED]: [OrderStatus.READY, OrderStatus.CANCELLED],
    [OrderStatus.READY]: [OrderStatus.FULFILLED, OrderStatus.CANCELLED],
    [OrderStatus.FULFILLED]: [], // Terminal
    [OrderStatus.CANCELLED]: [], // Terminal
    [OrderStatus.SLA_BREACH]: [] // Terminal
};

export class OrderStateMachine {
    async transition(orderId: string, currentStatus: OrderStatus, newStatus: OrderStatus, actor: string): Promise<OrderStatus> {
        const allowed = VALID_TRANSITIONS[currentStatus];

        if (!allowed || !allowed.includes(newStatus)) {
            throw new Error(`Invalid transition from ${currentStatus} to ${newStatus} by ${actor}`);
        }

        // SLA Check Logic (Mocked)
        // If currentStatus == CREATED and (now - createdAt) > 30 mins, force SLA_BREACH

        console.log(`[ORDER ${orderId}] Transitioning ${currentStatus} -> ${newStatus} by ${actor}`);

        // In production: await db.update(orders).set({ status: newStatus }).where(...)

        return newStatus;
    }

    // Called via cron/scheduled job
    async checkSLAs(order: { id: string, status: OrderStatus, createdAt: Date }) {
        if (order.status === OrderStatus.CREATED) {
            const diffMins = (new Date().getTime() - order.createdAt.getTime()) / 60000;
            if (diffMins > 30) {
                return this.transition(order.id, OrderStatus.CREATED, OrderStatus.SLA_BREACH, 'system');
            }
        }
        return order.status;
    }
}
