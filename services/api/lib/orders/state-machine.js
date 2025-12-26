"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderStateMachine = exports.OrderStatus = void 0;
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["CREATED"] = "confirmed";
    OrderStatus["ACCEPTED"] = "accepted";
    OrderStatus["READY"] = "ready_for_pickup";
    OrderStatus["FULFILLED"] = "fulfilled";
    OrderStatus["CANCELLED"] = "cancelled";
    OrderStatus["SLA_BREACH"] = "cancelled_sla"; // Auto-cancelled
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
// Strict Transition Rules
const VALID_TRANSITIONS = {
    [OrderStatus.CREATED]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED, OrderStatus.SLA_BREACH],
    [OrderStatus.ACCEPTED]: [OrderStatus.READY, OrderStatus.CANCELLED],
    [OrderStatus.READY]: [OrderStatus.FULFILLED, OrderStatus.CANCELLED],
    [OrderStatus.FULFILLED]: [], // Terminal
    [OrderStatus.CANCELLED]: [], // Terminal
    [OrderStatus.SLA_BREACH]: [] // Terminal
};
class OrderStateMachine {
    async transition(orderId, currentStatus, newStatus, actor) {
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
    async checkSLAs(order) {
        if (order.status === OrderStatus.CREATED) {
            const diffMins = (new Date().getTime() - order.createdAt.getTime()) / 60000;
            if (diffMins > 30) {
                return this.transition(order.id, OrderStatus.CREATED, OrderStatus.SLA_BREACH, 'system');
            }
        }
        return order.status;
    }
}
exports.OrderStateMachine = OrderStateMachine;
//# sourceMappingURL=state-machine.js.map