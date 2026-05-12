import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLocation as useGeoLocation } from '../context/LocationContext';

const LocationPopover: React.FC = () => {
    const { address, handleSearch, isLocating, searchDistance, setSearchDistance, handleLocateMe } = useGeoLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [localSearch, setLocalSearch] = useState(address || '');
    const popoverRef = useRef<HTMLDivElement>(null);

    // Sync local search when address changes
    useEffect(() => {
        if (address) setLocalSearch(address);
    }, [address]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const onSearch = async () => {
        if (localSearch.trim()) {
            await handleSearch(localSearch);
            setIsOpen(false);
        }
    };

    const distances = [5, 10, 25, 50];

    return (
        <div className="relative flex items-center gap-3" ref={popoverRef}>
            {/* LOGO: HOME LINK */}
            <Link 
                to="/" 
                className="shrink-0 hover:scale-105 transition-transform"
            >
                <img src="/logo-app.png" alt="Spendigo Logo" className="w-10 h-10 rounded-xl shadow-lg shadow-blue-500/20" />
            </Link>

            {/* TRIGGER: LOCATION TEXT */}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="flex flex-col cursor-pointer group"
            >
                <span className="text-2xl font-black text-[var(--brand-navy)] tracking-tighter group-hover:text-[var(--brand-primary)] transition-colors leading-none italic">Spendigo</span>
                <div className="flex items-center gap-1 mt-1">
                    <svg className="w-2.5 h-2.5 text-[#007AFF]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[10px] font-bold text-[#007AFF] truncate max-w-[120px]">{address || 'Quebec, QC'}</span>
                    <svg className={`w-2 h-2 text-[#007AFF] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {/* POPOVER CONTENT */}
            {isOpen && (
                <div className="fixed md:absolute left-6 md:left-12 top-[5rem] md:top-[4rem] w-64 bg-white rounded-[2rem] shadow-2xl border border-gray-100 z-[100] animate-fade-in origin-top-left overflow-hidden">
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Shopping Area</span>
                            {isLocating && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[8px] font-black text-blue-500 animate-pulse">Detecting...</span>
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></div>
                                </div>
                            )}
                        </div>

                        {/* COMPACT LOCATION INPUT - REORDERED */}
                        <div className="space-y-3 mb-4">
                            <button 
                                onClick={handleLocateMe}
                                disabled={isLocating}
                                className="flex items-center gap-2 text-[9px] font-black text-[#007AFF] uppercase tracking-widest hover:opacity-70 transition-opacity disabled:opacity-50 group"
                            >
                                <svg className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                {isLocating ? 'Detecting...' : 'Use My Location'}
                            </button>

                            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100/50">
                                <button 
                                    onClick={handleLocateMe}
                                    disabled={isLocating}
                                    className="hover:scale-110 transition-transform active:scale-95 shrink-0 disabled:opacity-50"
                                >
                                    <svg className={`w-3.5 h-3.5 ${isLocating ? 'text-gray-300 animate-spin' : 'text-[#007AFF]'}`} fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <input 
                                    type="text" 
                                    value={localSearch}
                                    onChange={(e) => setLocalSearch(e.target.value)}
                                    placeholder="City or Postal Code..."
                                    className="bg-transparent border-none outline-none text-xs font-bold text-[#112244] w-full placeholder:text-gray-300"
                                    onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                                />
                                <button 
                                    onClick={onSearch}
                                    className="text-[#112244] hover:text-[#007AFF] transition-colors shrink-0"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* COMPACT DISTANCE SELECTOR */}
                        <div className="pt-2.5 border-t border-gray-50">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Search Radius</span>
                                <button 
                                    onClick={() => {
                                        const currentIndex = distances.indexOf(searchDistance);
                                        const nextIndex = (currentIndex + 1) % distances.length;
                                        setSearchDistance(distances[nextIndex]);
                                    }}
                                    className="flex items-center gap-2 bg-[#007AFF] hover:bg-[#0066D6] px-2.5 py-1 rounded-full transition-all active:scale-95 shadow-md shadow-blue-500/20"
                                >
                                    <span className="text-[8px] font-black text-white tracking-widest uppercase">{searchDistance}KM</span>
                                    <div className="flex items-center gap-1">
                                        {distances.map(dist => (
                                            <div 
                                                key={dist} 
                                                className={`rounded-full transition-all duration-500 ${searchDistance === dist ? 'bg-white w-1.2 h-1.2' : 'bg-white/30 w-0.8 h-0.8'}`} 
                                                style={{ width: searchDistance === dist ? '5px' : '3px', height: searchDistance === dist ? '5px' : '3px' }}
                                            />
                                        ))}
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="px-5 py-2 bg-gray-50/50 border-t border-gray-50">
                         <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 leading-tight">Set distance for hyper-local results</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LocationPopover;
