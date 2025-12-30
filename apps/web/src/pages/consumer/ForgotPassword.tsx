import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';

const ForgotPassword = () => {
    const navigate = useNavigate();
    const { resetPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        setMessage('');

        if (!email) {
            setError('Please enter your email address.');
            setIsSubmitting(false);
            return;
        }

        try {
            await resetPassword(email);
            setMessage('Verification code has been sent to your email. Please check your inbox (and spam folder).');
        } catch (err: any) {
            // Friendly error messages
            if (err.message.includes('auth/user-not-found')) {
                setError('No account found with this email.');
            } else if (err.message.includes('auth/invalid-email')) {
                setError('Please enter a valid email address.');
            } else {
                setError('Failed to send reset email. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--surface-color)] flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[var(--brand-primary)] rounded-full opacity-[0.03] blur-[120px]" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[var(--brand-secondary)] rounded-full opacity-[0.03] blur-[100px]" />

            <div className="w-full max-w-md animate-scale-in">
                {/* Header */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-block text-4xl font-black tracking-tighter mb-4 gradient-text hover:opacity-80 transition-opacity">
                        spendigo
                    </Link>
                    <h2 className="text-2xl font-bold text-[var(--text-main)]">Reset Password</h2>
                    <p className="text-[var(--text-muted)] mt-2">Enter your email for the verification code.</p>
                </div>

                {/* Form Card */}
                <div className="glass-card p-8 rounded-[var(--radius-lg)] shadow-xl border border-[var(--glass-border)] bg-[var(--surface-1)] backdrop-blur-md">

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-[var(--radius-sm)] text-sm flex items-start gap-2">
                            <span className="mt-0.5">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {message && (
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-600 rounded-[var(--radius-sm)] text-sm flex items-start gap-2">
                            <span className="mt-0.5">✅</span>
                            <span>{message}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-[var(--text-main)]">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-all placeholder:text-[var(--text-muted)]/50"
                                placeholder="name@example.com"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || !!message}
                            className={`w-full py-3.5 rounded-[var(--radius-sm)] font-semibold text-white shadow-lg shadow-[var(--brand-primary)]/20 transition-all ${isSubmitting || message
                                    ? 'bg-[var(--text-muted)] cursor-not-allowed opacity-70'
                                    : 'bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]'
                                }`}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Sending...
                                </span>
                            ) : message ? (
                                'Email Sent'
                            ) : (
                                'Send Verification Code'
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-[var(--glass-border)] text-center">
                        <Link to="/login" className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors flex items-center justify-center gap-2">
                            <span>←</span> Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
