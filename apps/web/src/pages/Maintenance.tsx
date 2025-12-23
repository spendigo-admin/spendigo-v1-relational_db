import React from 'react';

const MaintenancePage: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-lg w-full border border-gray-700 animate-fade-in">
                <div className="text-6xl mb-6">🚧</div>
                <h1 className="text-3xl font-bold text-white mb-4">Under Maintenance</h1>
                <p className="text-gray-300 text-lg mb-8">
                    Spendigo is currently undergoing scheduled upgrades to improve your experience.
                    We'll be back shortly!
                </p>

                <div className="flex flex-col gap-4">
                    <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <div className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Status</div>
                        <div className="text-yellow-400 font-mono">System Upgrade in Progress...</div>
                    </div>
                </div>

                <div className="mt-8 text-sm text-gray-500">
                    Need urgent help? Contact <a href="mailto:support@spendigo.ca" className="text-blue-400 hover:text-blue-300">support@spendigo.ca</a>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-700">
                    <a href="/login" className="text-xs text-gray-500 hover:text-white transition-colors">
                        Admin Login
                    </a>
                </div>
            </div>
        </div>
    );
};

export default MaintenancePage;
