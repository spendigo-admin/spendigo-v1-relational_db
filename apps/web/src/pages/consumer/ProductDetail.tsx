import React, { useState } from 'react';
import '../../styles/design-system.css';

const MOCK_PRODUCT = {
    id: 'p123',
    name: 'Organic Avocados (Bag of 5)',
    price: 6.99,
    storeName: 'FreshMart Toronto',
    storeAddress: '123 Queen St W',
    description: 'Freshly imported organic avocados. Perfect for guacamole.',
    image: 'https://via.placeholder.com/400x400/228B22/fff?text=Avocados'
};

const ProductDetail: React.FC = () => {
    const [quantity, setQuantity] = useState(1);

    return (
        <div className="min-h-screen bg-[var(--surface-0)] pb-24">
            {/* Back Nav */}
            <div className="p-4 z-10 sticky top-0 flex items-center gap-2 bg-gradient-to-b from-black/50 to-transparent">
                <button className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center">←</button>
            </div>

            {/* Image */}
            <div className="-mt-16 h-80 bg-gray-800">
                <img src={MOCK_PRODUCT.image} alt={MOCK_PRODUCT.name} className="w-full h-full object-cover" />
            </div>

            {/* Content */}
            <div className="glass-panel -mt-6 rounded-t-[var(--radius-lg)] p-6 min-h-[50vh] relative z-0 border-b-0 rounded-b-none">
                <h1 className="text-2xl font-bold text-[var(--text-main)] mb-2">{MOCK_PRODUCT.name}</h1>

                <div className="flex justify-between items-baseline mb-6">
                    <span className="text-3xl font-bold font-mono text-[var(--brand-primary)]">${MOCK_PRODUCT.price.toFixed(2)}</span>
                    <div className="flex items-center gap-3 bg-[var(--surface-2)] rounded-full px-2 py-1">
                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 flex items-center justify-center text-xl font-bold">-</button>
                        <span className="font-mono text-lg">{quantity}</span>
                        <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 flex items-center justify-center text-xl font-bold">+</button>
                    </div>
                </div>

                {/* REGULATORY DISCLOSURE */}
                <div className="mb-6 p-4 rounded-[var(--radius-sm)] border border-[var(--glass-border)] bg-[var(--surface-1)]">
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">Sold & Fulfilled By</p>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-secondary)] flex items-center justify-center text-xs font-bold text-white">FM</div>
                        <div>
                            <p className="font-bold text-sm text-[var(--text-main)]">{MOCK_PRODUCT.storeName}</p>
                            <p className="text-xs text-[var(--text-muted)]">{MOCK_PRODUCT.storeAddress}</p>
                        </div>
                    </div>
                </div>

                <h3 className="font-bold mb-2">Description</h3>
                <p className="text-[var(--text-muted)] leading-relaxed mb-6">
                    {MOCK_PRODUCT.description}
                </p>

                <div className="fixed bottom-6 left-4 right-4 max-w-lg mx-auto">
                    <button className="w-full py-4 bg-[var(--brand-primary)] text-white font-bold rounded-[var(--radius-md)] shadow-lg shadow-[var(--brand-primary)]/20 active:scale-95 transition-transform flex justify-between px-6">
                        <span>Add to Cart</span>
                        <span>${(MOCK_PRODUCT.price * quantity).toFixed(2)}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductDetail;
