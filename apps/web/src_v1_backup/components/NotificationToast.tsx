import React, { useEffect, useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

const NotificationToast: React.FC = () => {
    const { toast, setToast } = useNotifications();
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (toast) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => setToast(null), 300); // Wait for fade out animation
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [toast, setToast]);

    if (!toast) return null;

    const handleClick = () => {
        if (toast.link) {
            navigate(toast.link);
        }
        setIsVisible(false);
        setTimeout(() => setToast(null), 300);
    };

    return (
        <div 
            className={`fixed top-4 right-4 z-[9999] w-80 transform transition-all duration-300 ease-out ${
                isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'
            }`}
        >
            <div 
                onClick={handleClick}
                className="bg-white border border-[var(--glass-border)] rounded-2xl shadow-2xl p-4 cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform group overflow-hidden relative"
            >
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 h-1 bg-[var(--brand-primary)] animate-shrink-width" />
                
                <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shrink-0 text-xl">
                        {toast.type === 'order' ? '🛍️' : '🔔'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <h4 className="text-sm font-bold text-[var(--text-main)] truncate">{toast.title}</h4>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsVisible(false);
                                    setTimeout(() => setToast(null), 300);
                                }}
                                className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-1">{toast.message}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationToast;
