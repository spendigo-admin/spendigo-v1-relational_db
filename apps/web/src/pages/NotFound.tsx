import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

const NotFound: React.FC = () => {
    return (
        <div className="min-h-screen bg-[var(--surface-0)] flex flex-col items-center justify-center p-4">
            <SEO title="Page Not Found" description="The page you are looking for doesn't exist." noIndex />
            <div className="text-center max-w-lg">
                <div className="text-9xl mb-4 animate-bounce">🦖</div>
                <h1 className="text-4xl font-bold text-[var(--text-main)] mb-4">Page Not Found</h1>
                <p className="text-lg text-[var(--text-muted)] mb-8">
                    Oops! The page you are looking for feels like it has gone extinct.
                </p>

                <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--brand-primary)] text-white rounded-full font-bold hover:brightness-110 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                    <span>🏠</span> Back to Home
                </Link>
            </div>
        </div>
    );
};

export default NotFound;
