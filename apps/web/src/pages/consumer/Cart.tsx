import React from 'react';
import '../../styles/design-system.css';

const MOCK_CART = {
    stores: [
        {
            id: 's1',
            name: 'FreshMart Toronto',
            subtotal: 14.50,
            items: [
                { name: 'Milk 2L', price: 4.99, qty: 1 },
                { name: 'Eggs 12pk', price: 9.51, qty: 1 }
            ]
        },
        {
            id: 's2',
            name: 'QuickPick',
            subtotal: 3.99,
            items: [
                { name: 'Lays Chips', price: 3.99, qty: 1 }
            ]
        }
    ],
    total: 18.49
};

const Cart: React.FC = () => {
    return (
        <div className="min-h-screen bg-[var(--surface-0)] p-4 pb-32">
            <h1 className="text-2xl font-bold mb-6">Your Cart</h1>

            {/* Smart Optimizer Banner */}
            <div className="mb-6 rounded-[var(--radius-md)] bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-xl">✨</div>
                <div className="flex-1">
                    <h3 className="text-emerald-400 font-bold text-sm">SmartCart Active</h3>
                    <p className="text-xs text-[var(--text-muted)]">We split your order to save you $2.40!</p>
                </div>
            </div>

            <div className="space-y-6">
                {MOCK_CART.stores.map(store => (
                    <div key={store.id} className="glass-panel p-4">
                        <div className="flex items-center gap-3 mb-4 border-b border-[var(--glass-border)] pb-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--surface-2)]"></div>
                            <h2 className="font-bold flex-1">{store.name}</h2>
                            <span className="text-sm font-mono text-[var(--text-muted)]">Subtotal: ${store.subtotal.toFixed(2)}</span>
                        </div>

                        <div className="space-y-3">
                            {store.items.map((item, i) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-[var(--brand-primary)]">x{item.qty}</span>
                                        <span>{item.name}</span>
                                    </div>
                                    <span>${item.price.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 w-full bg-[var(--surface-1)] border-t border-[var(--glass-border)] p-4 backdrop-blur bg-opacity-90">
                <div className="max-w-2xl mx-auto space-y-4">
                    <div className="flex justify-between text-sm text-[var(--text-muted)]">
                        <span>Subtotal (3 items)</span>
                        <span>${MOCK_CART.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span>${MOCK_CART.total.toFixed(2)}</span>
                    </div>
                    <button className="w-full py-4 bg-[var(--brand-primary)] text-white font-bold rounded-[var(--radius-md)] shadow-lg shadow-[var(--brand-primary)]/20 hover:brightness-110">
                        Proceed to Checkout
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Cart;
