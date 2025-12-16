import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/design-system.css';

const MerchantDashboard: React.FC = () => {
    const navigate = useNavigate();

    // Mock stats
    const stats = [
        { label: 'Today\'s Sales', value: '$1,245.00', change: '+12%', icon: '💰', color: 'bg-green-100 text-green-700' },
        { label: 'Active Orders', value: '8', change: '3 new', icon: '🛍️', color: 'bg-blue-100 text-blue-700' },
        { label: 'Total Products', value: '45', change: '2 low stock', icon: '📦', color: 'bg-purple-100 text-purple-700' },
        { label: 'Store Rating', value: '4.8', change: '⭐', icon: '🏆', color: 'bg-yellow-100 text-yellow-700' },
    ];

    const quickActions = [
        { label: 'Add Product', icon: '📦', path: '/merchant/products', desc: 'Add new items to your catalog' },
        { label: 'Create Flyer', icon: '📰', path: '/merchant/flyers', desc: 'Upload weekly digital flyer' },
        { label: 'New Deal', icon: '🏷️', path: '/merchant/deals', desc: 'Create a sale or offer' },
        { label: 'View Orders', icon: '📋', path: '/merchant/orders', desc: 'Manage active orders' },
    ];

    const recentOrders = [
        { id: '#ORD-123', customer: 'Alice M.', items: '3 items', total: '$45.20', status: 'Pending', time: '10 mins ago' },
        { id: '#ORD-122', customer: 'Bob K.', items: '12 items', total: '$124.50', status: 'Processing', time: '25 mins ago' },
        { id: '#ORD-121', customer: 'Charlie', items: '1 item', total: '$8.99', status: 'Ready', time: '1 hour ago' },
    ];

    return (
        <div className="p-6 animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-[var(--text-main)]">👋 Welcome back, Manager!</h1>
                <p className="text-[var(--text-muted)]">Here's what's happening in your store today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${stat.color}`}>
                                {stat.icon}
                            </div>
                            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                {stat.change}
                            </span>
                        </div>
                        <p className="text-[var(--text-muted)] text-sm">{stat.label}</p>
                        <p className="text-2xl font-bold text-[var(--text-main)]">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Quick Actions */}
                    <section>
                        <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {quickActions.map((action, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => navigate(action.path)}
                                    className="bg-white p-4 rounded-xl border border-[var(--glass-border)] hover:border-[var(--brand-primary)] hover:shadow-md transition-all text-left group"
                                >
                                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform origin-left">{action.icon}</div>
                                    <p className="font-bold text-[var(--text-main)] text-sm">{action.label}</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">{action.desc}</p>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Analytics Graph Preview (Mock) */}
                    <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-[var(--text-main)]">Revenue Overview</h2>
                            <select className="bg-[var(--surface-1)] border-none text-sm rounded-lg p-2">
                                <option>Last 7 Days</option>
                                <option>This Month</option>
                            </select>
                        </div>
                        <div className="h-48 flex items-end justify-between gap-2 px-2">
                            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                                <div key={i} className="w-full bg-[var(--brand-primary)] opacity-10 rounded-t-lg hover:opacity-20 transition-all relative group" style={{ height: `${h}%` }}>
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                        ${h * 20}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-[var(--text-muted)]">
                            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                        </div>
                    </section>
                </div>

                {/* Sidebar / Recent Orders */}
                <div className="space-y-6">
                    <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)]">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-[var(--text-main)]">Recent Orders</h2>
                            <button onClick={() => navigate('/merchant/orders')} className="text-sm text-[var(--brand-primary)]">View All</button>
                        </div>
                        <div className="space-y-4">
                            {recentOrders.map((order, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-[var(--surface-1)] rounded-lg">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm text-[var(--text-main)]">{order.customer}</span>
                                            <span className="text-xs text-[var(--text-muted)]">{order.time}</span>
                                        </div>
                                        <p className="text-xs text-[var(--text-muted)]">{order.items} • {order.total}</p>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${order.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                            order.status === 'Processing' ? 'bg-blue-100 text-blue-700' :
                                                'bg-green-100 text-green-700'
                                        }`}>
                                        {order.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                        <h3 className="font-bold text-blue-900 mb-2">🚀 Pro Tip</h3>
                        <p className="text-sm text-blue-800 mb-4">
                            Adding a "One-Day Offer" creates urgency and can boost sales by 30%!
                        </p>
                        <button
                            onClick={() => navigate('/merchant/deals')}
                            className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                        >
                            Create Offer
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default MerchantDashboard;
