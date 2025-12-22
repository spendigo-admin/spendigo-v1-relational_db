import React from 'react';
import { FallbackProps } from 'react-error-boundary';

const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-fade-in">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                    ⚠️
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
                <p className="text-gray-500 mb-6">
                    We apologize for the inconvenience. The application encountered an unexpected error.
                </p>

                {/* Developer details (hidden in production typically, or behind toggle) */}
                <div className="bg-gray-100 rounded-lg p-4 mb-6 text-left overflow-auto max-h-40 text-xs font-mono text-gray-700">
                    {error.message}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => window.location.href = '/'}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                        Go Home
                    </button>
                    <button
                        onClick={resetErrorBoundary}
                        className="flex-1 px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg font-medium hover:brightness-110 transition-all shadow-lg shadow-[var(--brand-primary)]/20"
                    >
                        Try Again
                    </button>
                </div>
            </div>

            <p className="mt-8 text-xs text-gray-400">
                Error ID: {Date.now().toString(36)}
            </p>
        </div>
    );
};

export default ErrorFallback;
