import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { STORE_DATA } from '../../data/productData';
import '../../styles/design-system.css';

const ProductDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const [quantity, setQuantity] = useState(1);
    const [activeImage, setActiveImage] = useState(0);
    const [added, setAdded] = useState(false);

    // Find product in STORE_DATA
    const productData = useMemo(() => {
        for (const storeId in STORE_DATA) {
            const store = STORE_DATA[storeId];
            const product = store.products?.find((p: any) => p.id === id);

            // Also check special collections if needed, but usually they are subsets of products
            // If strictly separate lists:
            if (!product && store.oneDayOffers) {
                const offer = store.oneDayOffers.find((p: any) => p.id === id);
                if (offer) return { ...offer, storeId: store.id, storeName: store.name, storeAddress: '123 Main St' }; // Add mock address
            }
            if (!product && store.saleItems) {
                const sale = store.saleItems.find((p: any) => p.id === id);
                if (sale) return { ...sale, storeId: store.id, storeName: store.name, storeAddress: '123 Main St' };
            }

            if (product) {
                return {
                    ...product,
                    storeId: store.id,
                    storeName: store.name,
                    storeAddress: '123 Spendigo Way, Toronto, ON', // Mock address for now
                    description: product.description || `Fresh ${product.name} sourced directly from ${store.name}. High quality guaranteed.`,
                    images: product.images || [product.image], // Fallback to single image if array not present
                    nutrition: product.nutrition || { calories: 150, fat: '5g', carbs: '10g', protein: '2g' } // Mock nutrition if missing
                };
            }
        }
        return null;
    }, [id]);

    if (!productData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <p className="text-[var(--text-muted)] text-lg">Product not found.</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:brightness-110"
                >
                    Back to Home
                </button>
            </div>
        );
    }

    const handleAddToCart = () => {
        addToCart({
            productId: productData.id,
            productName: productData.name,
            price: productData.price,
            quantity,
            storeId: productData.storeId,
            storeName: productData.storeName,
            image: productData.images[0]
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
                <Link to={`/store/${productData.storeId}`} className="hover:text-[var(--brand-primary)]">{productData.storeName}</Link>
                <span className="mx-2">›</span>
                <span className="text-[var(--text-muted)]">{productData.category}</span>
                <span className="mx-2">›</span>
                <span className="text-[var(--text-main)]">{productData.name}</span>
            </nav>

            <div className="max-w-5xl mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* IMAGE GALLERY */}
                    <div className="space-y-4">
                        {/* Main Image */}
                        <div className="aspect-square rounded-2xl overflow-hidden bg-[var(--surface-2)]">
                            <img
                                src={productData.images[activeImage]}
                                alt={productData.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {/* Thumbnails */}
                        {productData.images.length > 1 && (
                            <div className="flex gap-3 justify-center">
                                {productData.images.map((img: string, idx: number) => (
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
                        )}
                    </div>

                    {/* PRODUCT INFO */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl font-bold text-[var(--text-main)] mb-2">{productData.name}</h1>

                            {/* Price */}
                            <div className="flex items-baseline gap-3 mb-4">
                                <span className="text-4xl font-bold text-[var(--brand-primary)]">
                                    ${productData.price.toFixed(2)}
                                </span>
                                {productData.originalPrice && (
                                    <span className="text-xl text-[var(--text-muted)] line-through">
                                        ${productData.originalPrice.toFixed(2)}
                                    </span>
                                )}
                                {productData.originalPrice && (
                                    <span className="bg-[var(--brand-secondary)] text-white text-xs font-bold px-2 py-1 rounded">
                                        SAVE ${(productData.originalPrice - productData.price).toFixed(2)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* SOLD BY */}
                        <div className="glass-panel p-4 border-l-4 border-[var(--brand-primary)]">
                            <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">Sold & Fulfilled By</p>
                            <p className="font-bold text-[var(--text-main)]">{productData.storeName}</p>
                            <p className="text-sm text-[var(--text-muted)]">{productData.storeAddress}</p>
                        </div>

                        {/* Description */}
                        <div>
                            <h3 className="font-bold text-[var(--text-main)] mb-2">Description</h3>
                            <p className="text-[var(--text-muted)] leading-relaxed">{productData.description}</p>
                        </div>

                        {/* Nutrition (Optional) */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                            {Object.entries(productData.nutrition).map(([key, val]) => (
                                <div key={key} className="bg-[var(--surface-2)] rounded-lg p-3">
                                    <p className="text-lg font-bold text-[var(--text-main)]">{val as string}</p>
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
                        <span className="font-mono">${(productData.price * quantity).toFixed(2)}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductDetail;
