import React, { useState } from 'react';
import '../../styles/design-system.css';

// Mock Data
const MOCK_DEALS = [
    { id: '1', productName: 'Coca Cola 12pk', price: 6.99, confidence: 0.95, verified: true },
    { id: '2', productName: 'Lays Chips', price: 3.50, confidence: 0.45, verified: false }, // Low confidence
];

const FlyerModeration: React.FC = () => {
    const [deals, setDeals] = useState(MOCK_DEALS);
    const [selectedDeal, setSelectedDeal] = useState<string | null>(null);

    const handleVerify = (id: string, isCorrect: boolean) => {
        setDeals(deals.map(d => d.id === id ? { ...d, verified: isCorrect, confidence: 1.0 } : d));
    };

    return (
        <div className="h-screen flex flex-col bg-[var(--surface-0)]">
            {/* Header */}
            <header className="h-16 border-b border-[var(--glass-border)] flex items-center px-6 justify-between bg-[var(--surface-1)]">
                <h1 className="font-bold text-[var(--text-main)]">Flyer Moderation Queue</h1>
                <div className="flex gap-4">
                    <span className="text-[var(--text-muted)]">Pending: <b className="text-[var(--status-warning)]">12</b></span>
                    <button className="bg-[var(--brand-primary)] text-white px-4 py-1 rounded-[var(--radius-sm)]">Next Batch</button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Canvas / Image Area */}
                <div className="flex-1 bg-black/90 relative flex items-center justify-center">
                    {/* Placeholder for Canvas */}
                    <div className="w-[400px] h-[600px] bg-white opacity-80 relative border-2 border-dashed border-gray-500 flex items-center justify-center">
                        <span className="text-black font-bold">Flyer Image Canvas (Interactive BBox)</span>

                        {/* Mock BBox Overlay */}
                        <div
                            className="absolute border-2 border-[var(--status-warning)] bg-[var(--status-warning)]/20 cursor-pointer"
                            style={{ left: '20%', top: '30%', width: '150px', height: '50px' }}
                            title="Low Confidence Deal"
                        ></div>
                    </div>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[var(--surface-1)] px-4 py-2 rounded-full glass-panel">
                        Using Tesseract OCR Engine (Free Tier)
                    </div>
                </div>

                {/* Sidebar Controls */}
                <div className="w-96 border-l border-[var(--glass-border)] bg-[var(--surface-1)] flex flex-col">
                    <div className="p-4 border-b border-[var(--glass-border)]">
                        <h2 className="font-bold mb-2">Extracted Deals</h2>
                        <p className="text-xs text-[var(--text-muted)]">Please verify items with confidence &lt; 80%</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {deals.map(deal => (
                            <div
                                key={deal.id}
                                className={`p-3 rounded-[var(--radius-sm)] border ${deal.confidence < 0.8 && !deal.verified
                                    ? 'border-[var(--status-warning)] bg-[var(--status-warning)]/10'
                                    : 'border-[var(--glass-border)] bg-[var(--surface-2)]'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <input
                                            value={deal.productName}
                                            className="bg-transparent font-medium border-b border-transparent focus:border-[var(--brand-primary)] outline-none w-full"
                                        />
                                        <div className="flex items-center gap-1 mt-1 text-sm">
                                            <span className="text-[var(--text-muted)]">$</span>
                                            <input
                                                value={deal.price}
                                                className="bg-transparent font-mono border-b border-transparent focus:border-[var(--brand-primary)] outline-none w-16"
                                            />
                                        </div>
                                    </div>
                                    <div className={`text-xs px-2 py-1 rounded-full ${deal.confidence >= 0.8 ? 'bg-[var(--status-success)]/20 text-[var(--status-success)]' : 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]'
                                        }`}>
                                        {Math.round(deal.confidence * 100)}%
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={() => handleVerify(deal.id, true)}
                                        className="flex-1 py-1 text-xs font-bold bg-[var(--status-success)]/20 text-[var(--status-success)] hover:bg-[var(--status-success)]/30 rounded"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleVerify(deal.id, false)}
                                        className="flex-1 py-1 text-xs font-bold bg-[var(--status-error)]/20 text-[var(--status-error)] hover:bg-[var(--status-error)]/30 rounded"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 border-t border-[var(--glass-border)]">
                        <button className="w-full py-3 bg-[var(--brand-primary)] text-white font-bold rounded-[var(--radius-md)]">
                            Finalize & Publish
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlyerModeration;
