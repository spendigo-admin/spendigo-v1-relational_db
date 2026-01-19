import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import '../../styles/design-system.css';

const VerifyEmail: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [resending, setResending] = useState(false);
    const [message, setMessage] = useState('');
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);

    // Auto-refresh to check verification status
    useEffect(() => {
        const checkVerification = setInterval(async () => {
            await auth.currentUser?.reload();
            if (auth.currentUser?.emailVerified) {
                clearInterval(checkVerification);
                navigate('/');
            }
        }, 3000);

        return () => clearInterval(checkVerification);
    }, [navigate]);

    // Countdown timer for resend button
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanResend(true);
        }
    }, [countdown]);

    const handleResend = async () => {
        if (!auth.currentUser || !canResend) return;

        setResending(true);
        setMessage('');

        try {
            await sendEmailVerification(auth.currentUser, {
                url: `${window.location.origin}/`,
                handleCodeInApp: false,
            });
            setMessage('✅ Verification email sent! Check your inbox.');
            setCountdown(60);
            setCanResend(false);
        } catch (error: any) {
            if (error.code === 'auth/too-many-requests') {
                setMessage('⏱️ Too many requests. Please wait a few minutes.');
            } else {
                setMessage(`❌ Error: ${error.message}`);
            }
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[var(--brand-primary)]/10 to-[var(--brand-secondary)]/10">
            <div className="glass-panel max-w-md w-full p-8 text-center animate-fade-in">
                {/* Icon */}
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-secondary)] flex items-center justify-center text-4xl">
                    📧
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold mb-2 text-[var(--text-main)]">
                    Verify Your Email
                </h1>

                {/* Email Display */}
                <p className="text-[var(--text-muted)] mb-6">
                    We've sent a verification link to<br />
                    <strong className="text-[var(--text-main)]">{user?.email}</strong>
                </p>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                    <p className="text-sm text-blue-900 mb-2">
                        <strong>📋 Next Steps:</strong>
                    </p>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                        <li>Check your email inbox</li>
                        <li>Click the verification link</li>
                        <li>Return to this page (auto-refreshes)</li>
                    </ol>
                </div>

                {/* Message Display */}
                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${message.startsWith('✅')
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                        }`}>
                        {message}
                    </div>
                )}

                {/* Resend Button */}
                <button
                    onClick={handleResend}
                    disabled={resending || !canResend}
                    className="w-full py-3 mb-3 bg-[var(--brand-primary)] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all shadow-lg shadow-[var(--brand-primary)]/20"
                >
                    {resending
                        ? 'Sending...'
                        : canResend
                            ? 'Resend Verification Email'
                            : `Resend in ${countdown}s`
                    }
                </button>

                {/* Help Text */}
                <p className="text-xs text-[var(--text-muted)] mb-4">
                    Didn't receive the email? Check your spam folder or try resending.
                </p>

                {/* Divider */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[var(--glass-border)]"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                        <span className="px-2 bg-white text-[var(--text-muted)]">OR</span>
                    </div>
                </div>

                {/* Sign Out Button */}
                <button
                    onClick={logout}
                    className="w-full py-3 border border-[var(--glass-border)] rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-1)] transition-colors"
                >
                    Sign Out
                </button>

                {/* Footer Note */}
                <p className="mt-6 text-xs text-[var(--text-muted)]">
                    Need help? Contact <a href="mailto:support@spendigo.ca" className="text-[var(--brand-primary)] underline">support@spendigo.ca</a>
                </p>
            </div>
        </div>
    );
};

export default VerifyEmail;
