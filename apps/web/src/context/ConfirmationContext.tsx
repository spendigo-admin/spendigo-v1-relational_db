import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import '../styles/design-system.css';

interface ConfirmationOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info' | 'warning' | 'success';
}

interface ConfirmationContextType {
    confirm: (options: ConfirmationOptions) => Promise<boolean>;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export const ConfirmationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [modalConfig, setModalConfig] = useState<ConfirmationOptions | null>(null);
    const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const confirm = useCallback((options: ConfirmationOptions) => {
        return new Promise<boolean>((resolve) => {
            setModalConfig({
                confirmText: 'Confirm',
                cancelText: 'Cancel',
                type: 'info',
                ...options
            });
            setResolveRef(() => resolve);
            setIsOpen(true);
        });
    }, []);

    const handleClose = (result: boolean) => {
        setIsOpen(false);
        if (resolveRef) {
            resolveRef(result);
            setResolveRef(null);
        }
    };

    return (
        <ConfirmationContext.Provider value={{ confirm }}>
            {children}
            {isOpen && modalConfig && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl border border-[var(--glass-border)] text-center scale-in-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 
                            ${modalConfig.type === 'danger' ? 'bg-red-100 text-red-500' :
                                modalConfig.type === 'success' ? 'bg-green-100 text-green-500' :
                                    modalConfig.type === 'warning' ? 'bg-orange-100 text-orange-500' :
                                        'bg-blue-100 text-blue-500'
                            }`}>
                            {modalConfig.type === 'danger' ? '🗑️' :
                                modalConfig.type === 'success' ? '✅' :
                                    modalConfig.type === 'warning' ? '⚠️' : 'ℹ️'}
                        </div>
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">{modalConfig.title}</h2>
                        <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed whitespace-pre-wrap">
                            {modalConfig.message}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleClose(false)}
                                className="flex-1 py-2.5 font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                {modalConfig.cancelText}
                            </button>
                            <button
                                onClick={() => handleClose(true)}
                                className={`flex-1 py-2.5 text-white font-bold rounded-xl shadow-lg transition-all
                                    ${modalConfig.type === 'danger' ? 'bg-red-500 shadow-red-500/30 hover:bg-red-600' :
                                        modalConfig.type === 'success' ? 'bg-green-600 shadow-green-600/30 hover:bg-green-700' :
                                            modalConfig.type === 'warning' ? 'bg-orange-500 shadow-orange-500/30 hover:bg-orange-600' :
                                                'bg-blue-600 shadow-blue-600/30 hover:bg-blue-700'
                                    }`}
                            >
                                {modalConfig.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmationContext.Provider>
    );
};

export const useConfirmation = () => {
    const context = useContext(ConfirmationContext);
    if (!context) {
        throw new Error('useConfirmation must be used within a ConfirmationProvider');
    }
    return context;
};
