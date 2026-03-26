import React, { useState, useEffect } from 'react';

const themes = [
    { id: 'default', name: 'Default Theme', className: '' },
    { id: 'night', name: 'Night Navigator', className: 'theme-night' },
    { id: 'eco', name: 'Eco-Minimalist', className: 'theme-eco' },
    { id: 'deal', name: 'High-Velocity Deals', className: 'theme-deal' }
];

const ThemeSwitcher: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTheme, setActiveTheme] = useState('default');

    useEffect(() => {
        // Apply theme on mount/change
        const theme = themes.find(t => t.id === activeTheme);
        if (theme) {
            document.body.className = theme.className;
        }
    }, [activeTheme]);

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {isOpen && (
                <div className="absolute bottom-full mb-2 right-0 bg-white border border-gray-200 rounded-lg shadow-xl p-2 w-48 text-sm">
                    <div className="font-bold mb-2 pb-1 border-b px-2 text-gray-800">Select Theme</div>
                    {themes.map((theme) => (
                        <button
                            key={theme.id}
                            onClick={() => {
                                setActiveTheme(theme.id);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                                activeTheme === theme.id 
                                    ? 'bg-blue-100 text-blue-700 font-medium' 
                                    : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            {theme.name}
                        </button>
                    ))}
                </div>
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-gray-800 text-white p-3 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-700 transition transform hover:scale-105"
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
