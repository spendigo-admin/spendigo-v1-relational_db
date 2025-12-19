import React from 'react';
import '../../styles/design-system.css';

const AdminDashboard: React.FC = () => {
    // Mock stats
    // Mock stats
    const stats = [
        { label: 'Total Users', value: '12,450', change: '+125 this week', icon: '👥', color: 'bg-blue-100 text-blue-700' },
        { label: 'Pending Stores', value: '1', change: 'Needs action', icon: '🏪', color: 'bg-orange-100 text-orange-700' },
        { label: 'Total Revenue', value: '$45,200', change: '+12% vs last month', icon: '💰', color: 'bg-purple-100 text-purple-700' },
        { label: 'System Health', value: '99.9%', change: 'All systems operational', icon: '✅', color: 'bg-green-50 text-green-600' },
    ];

    const recentActivities = [
        { id: 1, user: 'FreshMart (Merchant)', action: 'Updated product catalog', time: '5 mins ago' },
        { id: 2, user: 'Alice Smith', action: 'Reported an issue with Order #1234', time: '15 mins ago' },
        { id: 3, user: 'QuickPick (Merchant)', action: 'Onboarding application submitted', time: '1 hour ago' },
        { id: 4, user: 'System', action: 'Daily database backup completed', time: '3 hours ago' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-[var(--text-main)]">System Dashboard</h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-xl border border-[var(--glass-border)] shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${stat.color}`}>
                                {stat.icon}
                            </div>
                        </div>
                        <p className="text-[var(--text-muted)] text-sm">{stat.label}</p>
                        <p className="text-2xl font-bold text-[var(--text-main)] mt-1">{stat.value}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{stat.change}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6">
                    <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Recent Activity</h2>
                    <div className="space-y-4">
                        {recentActivities.map((activity) => (
                            <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-[var(--surface-2)] last:border-0 last:pb-0">
                                <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)] mt-2"></div>
                                <div>
                                    <p className="text-sm font-medium text-[var(--text-main)]">{activity.user}</p>
                                    <p className="text-sm text-[var(--text-muted)]">{activity.action}</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">{activity.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* System Alerts */}
                <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-[var(--text-main)]">System Alerts</h2>
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">1 Warning</span>
                    </div>
                    <div className="space-y-3">
                        <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">⚠️</span>
                                <p className="font-bold text-yellow-800 text-sm">High Server Load</p>
                            </div>
                            <p className="text-xs text-yellow-700 pl-7">Server CPU usage user-service reached 85% at 14:00 EST.</p>
                        </div>
                        <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">✅</span>
                                <p className="font-bold text-green-800 text-sm">Database Optimization</p>
                            </div>
                            <p className="text-xs text-green-700 pl-7">Weekly index maintenance completed successfully.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
