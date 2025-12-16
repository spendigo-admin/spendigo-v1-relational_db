import React, { useState } from 'react';
import '../../styles/design-system.css';

interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
}

const ProductManager: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([
        { id: '1', name: 'Milk 2L', price: 4.99, stock: 10 },
        { id: '2', name: 'Bread Loaf', price: 2.50, stock: 5 }
    ]);

    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', price: '', stock: '' });

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const newProduct: Product = {
            id: Math.random().toString(36).substr(2, 9),
            name: formData.name,
            price: parseFloat(formData.price),
            stock: parseInt(formData.stock)
        };
        setProducts([...products, newProduct]);
        setAddModalOpen(false);
        setFormData({ name: '', price: '', stock: '' });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-[var(--text-main)]">Product Catalog</h1>
                <button
                    onClick={() => setAddModalOpen(true)}
                    className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-[var(--radius-sm)] font-medium hover:bg-[var(--brand-primary-dark)]"
                >
                    + Add Product
                </button>
            </div>

            <div className="glass-panel overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">Price</th>
                            <th className="p-4">Stock</th>
                            <th className="p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                        {products.map(product => (
                            <tr key={product.id} className="hover:bg-[var(--surface-2)] transition-colors">
                                <td className="p-4 text-[var(--text-main)] font-medium">{product.name}</td>
                                <td className="p-4 text-[var(--text-muted)]">${product.price.toFixed(2)}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs ${product.stock < 5 ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]' : 'bg-[var(--status-success)]/20 text-[var(--status-success)]'}`}>
                                        {product.stock} units
                                    </span>
                                </td>
                                <td className="p-4">
                                    <button className="text-[var(--brand-secondary)] hover:underline text-sm">Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="glass-panel w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-4">Add New Product</h2>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Product Name</label>
                                <input
                                    required
                                    className="w-full p-2 rounded-[var(--radius-sm)] bg-[var(--surface-0)] border border-[var(--glass-border)]"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Price ($)</label>
                                    <input
                                        type="number" step="0.01" required
                                        className="w-full p-2 rounded-[var(--radius-sm)] bg-[var(--surface-0)] border border-[var(--glass-border)]"
                                        value={formData.price}
                                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Stock</label>
                                    <input
                                        type="number" required
                                        className="w-full p-2 rounded-[var(--radius-sm)] bg-[var(--surface-0)] border border-[var(--glass-border)]"
                                        value={formData.stock}
                                        onChange={e => setFormData({ ...formData, stock: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-main)]">Cancel</button>
                                <button type="submit" className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-[var(--radius-sm)]">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductManager;
