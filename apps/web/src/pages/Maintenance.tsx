import React from 'react';
import Game2048 from '../components/Game2048';

const MaintenancePage: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-20 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500 rounded-full blur-[120px]"></div>
            </div>

            <div className="w-full max-w-4xl flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20">
                {/* Info Section */}
                <div className="flex flex-col items-center lg:items-start text-center lg:text-left max-w-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <img src="/app-icon.png" alt="Spendigo Logo" className="w-12 h-12 rounded-xl shadow-lg shadow-blue-500/20" />
                        <span className="text-3xl font-black text-white italic tracking-tighter">Spendigo</span>
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full mb-6">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Maintenance Mode</span>
                    </div>

                    <h1 className="text-4xl font-bold text-white mb-4">We're leveling up!</h1>
                    <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                        Spendigo is currently undergoing scheduled upgrades. While you wait, why not try to beat our high score?
                    </p>

                    <div className="flex flex-col gap-3 w-full">
                        <div className="text-xs text-gray-500 flex items-center gap-2 mb-2 uppercase tracking-widest font-bold">
                            Need help?
                        </div>
                        <a href="mailto:support@spendigo.ca" className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-bold">
                            support@spendigo.ca
                        </a>
                    </div>

                    <div className="mt-12 pt-8 border-t border-gray-800 w-full flex justify-center lg:justify-start">
                        <a href="/login" className="text-xs text-gray-600 hover:text-gray-400 transition-colors font-bold uppercase tracking-widest">
                            Admin Access
                        </a>
                    </div>
                </div>

                {/* Game Section */}
                <div className="relative animate-fade-in-up">
                    <Game2048 />
                </div>
            </div>

            <style>{`
                @keyframes fade-in-up {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
};

export default MaintenancePage;
