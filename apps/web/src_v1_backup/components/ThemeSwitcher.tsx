import React, { useState, useEffect } from 'react';

export const themes = [
    { 
        id: 'default', 
        name: 'Clean Minimal', 
        className: '', 
        previewColors: 'from-blue-500 to-blue-600',
        bg: 'bg-white',
        text: 'text-gray-800',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
        )
    },
    { 
        id: 'night', 
        name: 'Midnight Navigator', 
        className: 'theme-night', 
        previewColors: 'from-indigo-900 to-purple-900',
        bg: 'bg-slate-900',
        text: 'text-white',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        )
    },
    { 
        id: 'eco', 
        name: 'Eco-Organic', 
        className: 'theme-eco', 
        previewColors: 'from-emerald-400 to-teal-600',
        bg: 'bg-amber-50',
        text: 'text-emerald-900',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
        )
    },
    { 
        id: 'deal', 
        name: 'Cyber Deals', 
        className: 'theme-deal', 
        previewColors: 'from-fuchsia-600 to-yellow-400',
        bg: 'bg-black',
        text: 'text-white',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        )
    }
];

export const initTheme = () => {
    const saved = localStorage.getItem('spendigo_theme') || 'default';
    const theme = themes.find(t => t.id === saved);
    if (theme) document.body.className = theme.className;
};

interface Props {
    variant?: 'floating' | 'inline';
}

const ThemeSwitcher: React.FC<Props> = ({ variant = 'floating' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem('spendigo_theme') || 'default');

    useEffect(() => {
        const theme = themes.find(t => t.id === activeTheme);
        if (theme) {
            document.body.className = theme.className;
            localStorage.setItem('spendigo_theme', activeTheme);
            window.dispatchEvent(new Event('themechange'));
        }
    }, [activeTheme]);

    useEffect(() => {
        const handler = () => setActiveTheme(localStorage.getItem('spendigo_theme') || 'default');
        window.addEventListener('themechange', handler);
        return () => window.removeEventListener('themechange', handler);
    }, []);

    if (variant === 'inline') {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {themes.map((theme) => (
                    <button
                        key={theme.id}
                        onClick={() => setActiveTheme(theme.id)}
                        className={`group relative overflow-hidden text-left rounded-2xl border-2 transition-all duration-300 ${theme.bg} ${theme.text} ${
                            activeTheme === theme.id 
                                ? 'border-blue-500 shadow-lg scale-[1.02]' 
                                : 'border-transparent shadow-sm hover:scale-[1.02] hover:shadow-md'
                        }`}
                    >
                        {/* Gradient Preview Header */}
                        <div className={`h-12 w-full bg-gradient-to-br ${theme.previewColors} opacity-90 group-hover:opacity-100 transition-opacity`}></div>
                        
                        {/* Content */}
                        <div className="p-4 pt-3">
                            <div className="flex items-center gap-2 font-bold text-sm sm:text-base mb-1">
                                {theme.icon}
                                {theme.name}
                            </div>
                            
                            {/* Active Indicator */}
                            {activeTheme === theme.id && (
                                <div className="absolute top-2 right-2 bg-white/20 backdrop-blur-md p-1 rounded-full text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                </div>
                            )}
                        </div>
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className="fixed bottom-24 md:bottom-4 right-4 z-50">
            {isOpen && (
                <div className="absolute bottom-full mb-3 right-0 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-2xl p-2 w-64 text-sm transform origin-bottom-right transition-all animate-fade-in">
                    <div className="font-bold mb-2 pb-2 border-b px-2 text-gray-800 flex items-center justify-between">
                        <span>Select Theme</span>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    <div className="space-y-1">
                        {themes.map((theme) => (
                            <button
                                key={theme.id}
                                onClick={() => {
                                    setActiveTheme(theme.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg transition-all ${
                                    activeTheme === theme.id 
                                        ? 'bg-blue-50 border border-blue-100 shadow-sm' 
                                        : 'hover:bg-gray-50 border border-transparent'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${theme.previewColors} flex items-center justify-center text-white/90 shadow-inner flex-shrink-0`}>
                                    {React.cloneElement(theme.icon as React.ReactElement, { width: 14, height: 14 })}
                                </div>
                                <span className={`font-medium ${activeTheme === theme.id ? 'text-blue-700' : 'text-gray-700'}`}>
                                    {theme.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-gray-900 text-white p-3.5 rounded-full flex items-center justify-center shadow-xl hover:bg-gray-800 transition transform hover:scale-105 active:scale-95"
                title="Switch Theme"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                    <path d="M12 4a8 8 0 0 0 0 16v-8Z" />
                </svg>
            </button>
        </div>
    );
};

export default ThemeSwitcher;
