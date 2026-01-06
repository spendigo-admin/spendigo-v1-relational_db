import React, { useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';

const MasterCatalog: React.FC = () => {
    const { catalog, searchCatalog, loading } = useCatalog();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    const categories = Array.from(new Set(catalog.map(item => item.category))).sort();

    const filteredItems = searchCatalog(searchQuery).filter(item =>
        filterCategory ? item.category === filterCategory : true
    );

    if (loading) return <div className="p-8">Loading Catalog...</div>;

    return (
        <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Master Product Catalog</h1>
                    <p className="text-sm text-[var(--text-muted)]">
                        Centralized database of {catalog.length} curated grocery items.
                    </p>
                </div>
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                        Read Only
                    </span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="Search items by name, category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] outline-none"
                    />
                </div>
                <div>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full sm:w-64 px-4 py-3 border border-[var(--glass-border)] rounded-lg outline-none"
                    >
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-[var(--glass-border)] shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[var(--surface-1)] border-b border-[var(--glass-border)]">
                        <tr>
                            <th className="p-4 font-medium text-[var(--text-muted)] text-sm">Product</th>
                            <th className="p-4 font-medium text-[var(--text-muted)] text-sm">Category</th>
                            <th className="p-4 font-medium text-[var(--text-muted)] text-sm">Unit</th>
                            <th className="p-4 font-medium text-[var(--text-muted)] text-sm">Type</th>
                            <th className="p-4 font-medium text-[var(--text-muted)] text-sm text-right">ID</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                        {filteredItems.length > 0 ? (
                            filteredItems.map(item => (
                                <tr key={item.id} className="hover:bg-[var(--surface-1)] transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-100">
                                                {item.image ? (
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-xl">🛍️</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-[var(--text-main)]">{item.name}</div>
                                                <div className="text-xs text-[var(--text-muted)] line-clamp-1">{item.description}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium border border-gray-200">
                                            {item.category}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-[var(--text-main)] capitalize">
                                        {item.unit}
                                    </td>
                                    <td className="p-4">
                                        {item.taxable ? (
                                            <span className="text-orange-600 text-xs font-bold flex items-center gap-1">
                                                <span>🏷️</span> Taxable
                                            </span>
                                        ) : (
                                            <span className="text-green-600 text-xs font-bold flex items-center gap-1">
                                                <span>❄️</span> Exempt
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-xs font-mono text-[var(--text-muted)] text-right">
                                        {item.id}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">
                                    No items found matching your filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 text-xs text-[var(--text-muted)] text-center">
                Showing {filteredItems.length} of {catalog.length} items
            </div>
        </div>
    );
};

export default MasterCatalog;
