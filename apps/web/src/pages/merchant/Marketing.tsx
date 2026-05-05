import React from 'react';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';
import QRCode from 'react-qr-code';

const MerchantMarketing: React.FC = () => {
    const { getStore } = useMarketplace();
    const { user } = useAuth();
    const storeId = user?.storeId || '1';
    const store = getStore(storeId);

    return (
        <>
            {/* Printable QR Code Section (Hidden on screen, visible on print) */}
            <div className="hidden print:flex flex-col items-center justify-center w-[100vw] h-[100vh] bg-white text-black text-center print:p-0 print:m-0 overflow-hidden box-border">
                <h1 className="text-5xl md:text-6xl font-black mb-2 leading-tight max-w-[90%]">{store?.name || 'Spendigo Store'}</h1>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-500 mb-10">{store?.businessType || 'Spendigo Partner'}</h2>
                
                <div className="p-6 md:p-8 bg-white border-4 border-gray-100 rounded-[2rem] inline-block mb-10 shadow-sm">
                    <QRCode
                        value={`${window.location.origin}/store/${store?.id}`}
                        size={350}
                        level="H"
                    />
                </div>
                
                <p className="text-xl md:text-2xl font-black text-black mb-10 px-4 max-w-xl">Scan this code to view our deals and order online!</p>
                
                <div className="mt-auto pb-10">
                    <p className="text-lg md:text-xl font-bold text-gray-400">Powered by Spendigo</p>
                </div>
            </div>

            <div className="p-4 md:p-6 animate-fade-in pb-20 space-y-6 print:hidden">
                <div className="mb-6">
                    <h1 className="text-3xl font-black text-[var(--text-main)] mb-2 flex items-center gap-2">
                        <span>📢</span> Digital Marketing
                    </h1>
                    <p className="text-[var(--text-muted)] text-sm">Tools to promote your store, grow visibility, and reach more customers.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 1. Direct Store Link Widget */}
                    <div className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                        <div>
                            <h3 className="font-bold text-xl mb-2 flex items-center gap-2 text-[var(--text-main)]">
                                <span>🔗</span> Direct Link
                            </h3>
                            <p className="text-[var(--text-muted)] text-sm mb-6">
                                Copy your direct store link to share anywhere you'd like.
                            </p>
                        </div>

                        <div className="mt-auto">
                            <div className="flex flex-col gap-2 bg-[var(--surface-1)] p-2 rounded-xl border border-[var(--glass-border)]">
                                <input
                                    readOnly
                                    value={`${window.location.origin}/store/${store?.id}`}
                                    className="w-full bg-white border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-main)] placeholder-gray-400 focus:ring-2 focus:ring-[var(--brand-primary)] px-3 py-2 outline-none"
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/store/${store?.id}`);
                                        const btn = document.getElementById('copy-btn');
                                        if (btn) btn.innerText = '✅ Copied!';
                                        setTimeout(() => { if (btn) btn.innerText = '📋 Copy Link'; }, 2000);
                                    }}
                                    id="copy-btn"
                                    className="w-full py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-bold shadow-md hover:bg-black transition-colors"
                                >
                                    📋 Copy Link
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 2. Social Media Share Widget */}
                    <div className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                        <div>
                            <h3 className="font-bold text-xl mb-2 flex items-center gap-2 text-[var(--text-main)]">
                                <span>📱</span> Social Media
                            </h3>
                            <p className="text-[var(--text-muted)] text-sm mb-6">
                                Instantly share your store on popular social networks.
                            </p>
                        </div>

                        <div className="mt-auto flex flex-col gap-3">
                            <a
                                href={`https://twitter.com/intent/tweet?text=Check%20out%20${encodeURIComponent(store?.name || 'our store')}%20on%20Spendigo!&url=${encodeURIComponent(`${window.location.origin}/store/${store?.id}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3 bg-[#000000] hover:bg-gray-900 rounded-xl text-center text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"
                            >
                                𝕏 Post on X
                            </a>
                            <a
                                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/store/${store?.id}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3 bg-[#1877F2] hover:bg-[#1864D9] rounded-xl text-center text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"
                            >
                                Share on Facebook
                            </a>
                        </div>
                    </div>

                    {/* 3. Printable QR Code Widget */}
                    <div className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                        <div>
                            <h3 className="font-bold text-xl mb-2 flex items-center gap-2 text-[var(--text-main)]">
                                <span>🖨️</span> Store QR Code
                            </h3>
                            <p className="text-[var(--text-muted)] text-sm mb-6">
                                Display this QR code at checkout for easy physical access.
                            </p>
                        </div>
                        
                        <div className="mt-auto">
                            <button
                                onClick={() => window.print()}
                                className="w-full py-3 bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--glass-border)] rounded-xl text-base font-bold shadow-sm hover:bg-[var(--glass-border)] transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                🖨️ Print High-Res Poster
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default MerchantMarketing;
