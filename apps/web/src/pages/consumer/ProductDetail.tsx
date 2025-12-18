import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import '../../styles/design-system.css';

// Mock Product Data
const MOCK_PRODUCT = {
    id: 'p123',
    name: 'Organic Avocados (Bag of 5)',
    price: 6.99,
    originalPrice: 8.99,
    storeId: '1',
    storeName: 'FreshMart Toronto',
    storeLegalName: 'FreshMart Ontario Inc.',
    storeAddress: '123 Queen St W, Toronto, ON',
    category: 'Fresh Produce',
    description: 'Freshly imported organic avocados from Mexico. Perfect for guacamole, salads, or toast. Ripens in 2-3 days.',
    images: [
        'https://via.placeholder.com/600x600/228B22/fff?text=Avocado+1',
        'https://via.placeholder.com/600x600/2E8B57/fff?text=Avocado+2',
        'https://via.placeholder.com/600x600/3CB371/fff?text=Avocado+3',
    ],
    nutrition: { calories: 160, fat: '15g', carbs: '9g', protein: '2g' }
};

const ProductDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { addToCart } = useCart();
    const [quantity, setQuantity] = useState(1);
    const [activeImage, setActiveImage] = useState(0);
    const [added, setAdded] = useState(false);

    const handleAddToCart = () => {
        addToCart({
            productId: MOCK_PRODUCT.id,
            productName: MOCK_PRODUCT.name,
            price: MOCK_PRODUCT.price,
            quantity,
            storeId: MOCK_PRODUCT.storeId,
            storeName: MOCK_PRODUCT.storeName,
            image: MOCK_PRODUCT.images[0]
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
    };

    return (
        <div className="animate-fade-in pb-28">
            {/* BREADCRUMBS */}
            <nav className="px-4 py-3 text-sm text-[var(--text-muted)] overflow-x-auto whitespace-nowrap">
                <Link to="/" className="hover:text-[var(--brand-primary)]">Home</Link>
                <span className="mx-2">›</span>
                <Link to={`/store/${MOCK_PRODUCT.storeId}`} className="hover:text-[var(--brand-primary)]">{MOCK_PRODUCT.storeName}</Link>
                <span className="mx-2">›</span>
                <span className="text-[var(--text-muted)]">{MOCK_PRODUCT.category}</span>
                <span className="mx-2">›</span>
                <span className="text-[var(--text-main)]">{MOCK_PRODUCT.name}</span>
            </nav>

            <div className="max-w-5xl mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* IMAGE GALLERY */}
                    <div className="space-y-4">
                        {/* Main Image */}
                        <div className="aspect-square rounded-2xl overflow-hidden bg-[var(--surface-2)]">
                            <img
                                src={MOCK_PRODUCT.images[activeImage]}
                                alt={MOCK_PRODUCT.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {/* Thumbnails */}
                        <div className="flex gap-3 justify-center">
                            {MOCK_PRODUCT.images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveImage(idx)}
                                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${activeImage === idx
                                        ? 'border-[var(--brand-primary)] scale-105'
                                        : 'border-transparent opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* PRODUCT INFO */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl font-bold text-[var(--text-main)] mb-2">{MOCK_PRODUCT.name}</h1>

                            {/* Price */}
                            <div className="flex items-baseline gap-3 mb-4">
                                <span className="text-4xl font-bold text-[var(--brand-primary)]">
                                    ${MOCK_PRODUCT.price.toFixed(2)}
                                </span>
                                {MOCK_PRODUCT.originalPrice && (
                                    <span className="text-xl text-[var(--text-muted)] line-through">
                                        ${MOCK_PRODUCT.originalPrice.toFixed(2)}
                                    </span>
                                )}
                                <span className="bg-[var(--brand-secondary)] text-white text-xs font-bold px-2 py-1 rounded">
                                    SAVE ${(MOCK_PRODUCT.originalPrice - MOCK_PRODUCT.price).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* SOLD BY - REGULATORY DISCLOSURE */}
                        <div className="glass-panel p-4 border-l-4 border-[var(--brand-primary)]">
                            <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">Sold & Fulfilled By</p>
                            <p className="font-bold text-[var(--text-main)]">{MOCK_PRODUCT.storeLegalName}</p>
                            <p className="text-sm text-[var(--text-muted)]">{MOCK_PRODUCT.storeAddress}</p>
                        </div>

                        {/* Description */}
                        <div>
                            <h3 className="font-bold text-[var(--text-main)] mb-2">Description</h3>
                            <p className="text-[var(--text-muted)] leading-relaxed">{MOCK_PRODUCT.description}</p>
                        </div>

                        {/* Nutrition (Optional) */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                            {Object.entries(MOCK_PRODUCT.nutrition).map(([key, val]) => (
                                <div key={key} className="bg-[var(--surface-2)] rounded-lg p-3">
                                    <p className="text-lg font-bold text-[var(--text-main)]">{val}</p>
                                    <p className="text-xs text-[var(--text-muted)] capitalize">{key}</p>
                                </div>
                            ))}
                        </div>

                        {/* Quantity Selector */}
                        <div className="flex items-center gap-4">
                            <span className="text-[var(--text-muted)]">Quantity:</span>
                            <div className="flex items-center bg-[var(--surface-2)] rounded-full">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-10 h-10 flex items-center justify-center text-xl font-bold hover:bg-[var(--surface-1)] rounded-l-full transition-colors"
                                >
                                    −
                                </button>
                                <span className="w-12 text-center font-mono text-lg">{quantity}</span>
                                <button
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="w-10 h-10 flex items-center justify-center text-xl font-bold hover:bg-[var(--surface-1)] rounded-r-full transition-colors"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* STICKY ADD TO CART BUTTON */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-[var(--surface-0)] to-transparent pointer-events-none">
                <div className="max-w-xl mx-auto pointer-events-auto">
                    <button
                        onClick={handleAddToCart}
                        className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all active:scale-95 flex items-center justify-between px-6 ${added
                            ? 'bg-[var(--status-success)] text-white'
                            : 'bg-[var(--brand-primary)] text-white hover:brightness-110 shadow-[var(--brand-primary)]/30'
                            }`}
                    >
                        <span>{added ? '✓ Added to Cart!' : 'Add to Cart'}</span>
                        <span className="font-mono">${(MOCK_PRODUCT.price * quantity).toFixed(2)}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductDetail;
