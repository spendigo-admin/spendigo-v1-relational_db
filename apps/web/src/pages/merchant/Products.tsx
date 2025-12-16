import React, { useState } from 'react';
import '../../styles/design-system.css';

// Mock products for this merchant
const INITIAL_PRODUCTS = [
    { id: 'mp1', name: 'Organic Avocados (5pk)', price: 6.99, stock: 45, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=100', active: true },
    { id: 'mp2', name: 'Almond Milk (1L)', price: 4.49, stock: 120, category: 'Dairy', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=100', active: true },
    { id: 'mp3', name: 'Sourdough Loaf', price: 5.99, stock: 30, category: 'Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=100', active: true },
    { id: 'mp4', name: 'Greek Yogurt (500g)', price: 5.49, stock: 0, category: 'Dairy', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=100', active: false },
];

const MerchantProducts: React.FC = () => {
    const [products, setProducts] = useState(INITIAL_PRODUCTS);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<typeof INITIAL_PRODUCTS[0] | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [form, setForm] = useState({ name: '', price: '', stock: '', category: 'Fresh Produce', image: '' });

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSaveProduct = () => {
        if (editingProduct) {
            setProducts(prev => prev.map(p => p.id === editingProduct.id ? {
                ...p,
                name: form.name,
                price: parseFloat(form.price),
                stock: parseInt(form.stock),
                category: form.category,
            } : p));
        } else {
            const newProduct = {
                id: `mp${Date.now()}`,
                name: form.name,
                price: parseFloat(form.price),
                stock: parseInt(form.stock),
                category: form.category,
                image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100',
                active: true,
            };
            setProducts(prev => [...prev, newProduct]);
        }
        closeModal();
    };

    const openEditModal = (product: typeof INITIAL_PRODUCTS[0]) => {
        setEditingProduct(product);
        setForm({ name: product.name, price: String(product.price), stock: String(product.stock), category: product.category, image: product.image });
        setShowAddModal(true);
    };

    const closeModal = () => {
        setShowAddModal(false);
        setEditingProduct(null);
        setForm({ name: '', price: '', stock: '', category: 'Fresh Produce', image: '' });
    };

    const toggleProductActive = (id: string) => {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
    };

    const deleteProduct = (id: string) => {
        if (confirm('Are you sure you want to delete this product?')) {
            setProducts(prev => prev.filter(p => p.id !== id));
        }
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Products</h1>
                    <p className="text-sm text-[var(--text-muted)]">{products.length} total products</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110"
                >
                    + Add Product
                </button>
            </div>

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg"
                />
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden">
                <table className="w-full">
                    <thead className="bg-[var(--surface-1)]">
                        <tr>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Product</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Category</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Price</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Stock</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Status</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                        {filteredProducts.map(product => (
                            <tr key={product.id} className="hover:bg-[var(--surface-1)]">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <img src={product.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                        <span className="font-medium text-[var(--text-main)]">{product.name}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-[var(--text-muted)]">{product.category}</td>
                                <td className="p-4 font-medium text-[var(--text-main)]">${product.price.toFixed(2)}</td>
                                <td className="p-4">
                                    <span className={`${product.stock === 0 ? 'text-red-500' : product.stock < 20 ? 'text-yellow-600' : 'text-green-600'}`}>
                                        {product.stock}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={`text-xs px-2 py-1 rounded-full ${product.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {product.active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => openEditModal(product)} className="text-[var(--brand-primary)] text-sm">Edit</button>
                                        <button onClick={() => toggleProductActive(product.id)} className="text-yellow-600 text-sm">
                                            {product.active ? 'Disable' : 'Enable'}
                                        </button>
                                        <button onClick={() => deleteProduct(product.id)} className="text-red-500 text-sm">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-4">
                            {editingProduct ? 'Edit Product' : 'Add New Product'}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Product Name</label>
                                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Price ($)</label>
                                    <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Stock</label>
                                    <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Category</label>
                                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg">
                                    <option>Fresh Produce</option>
                                    <option>Dairy</option>
                                    <option>Bakery</option>
                                    <option>Pantry</option>
                                    <option>Snacks</option>
                                    <option>Drinks</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={handleSaveProduct} className="flex-1 py-3 bg-[var(--brand-primary)] text-white font-medium rounded-lg">
                                {editingProduct ? 'Save Changes' : 'Add Product'}
                            </button>
                            <button onClick={closeModal} className="flex-1 py-3 border border-[var(--glass-border)] rounded-lg">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MerchantProducts;
