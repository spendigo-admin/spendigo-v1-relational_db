import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';

const ResetPassword = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const oobCode = searchParams.get('oobCode');
    const mode = searchParams.get('mode'); // Firebase adds mode=resetPassword

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [email, setEmail] = useState(''); // To show who we are resetting for
    const [verifying, setVerifying] = useState(true);

    useEffect(() => {
        if (!oobCode) {
            setError('Invalid or missing reset code. Please try requesting a new link.');
            setVerifying(false);
            return;
        }

        // Verify the code
        verifyPasswordResetCode(auth, oobCode)
            .then((email) => {
                setEmail(email);
                setVerifying(false);
            })
            .catch((err) => {
                console.error(err);
                setError('This link has expired or has already been used.');
                setVerifying(false);
            });
    }, [oobCode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            if (!oobCode) throw new Error("Missing Code");
            await confirmPasswordReset(auth, oobCode, password);
            setMessage('Password has been reset successfully! You can now log in.');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to result password.');
            setIsSubmitting(false);
        }
    };

    if (verifying) {
        return <div className="min-h-screen flex items-center justify-center">Verifying link...</div>;
    }

    return (
        <div className="min-h-screen bg-[var(--surface-color)] flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <SEO title="Set New Password" description="Set a new password for your Spendigo account." noIndex />
            {/* Background Elements */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[var(--brand-primary)] rounded-full opacity-[0.03] blur-[120px]" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[var(--brand-secondary)] rounded-full opacity-[0.03] blur-[100px]" />

            <div className="w-full max-w-md animate-scale-in">
                <div className="text-center mb-8">
                    <Link to="/" className="inline-block text-4xl font-black tracking-tighter mb-4 gradient-text">
                        spendigo
                    </Link>
                    <h2 className="text-2xl font-bold text-[var(--text-main)]">Set New Password</h2>
                    {email && <p className="text-sm text-[var(--text-muted)] mt-2">for {email}</p>}
                </div>

                <div className="glass-card p-8 rounded-[var(--radius-lg)] shadow-xl border border-[var(--glass-border)] bg-[var(--surface-1)] backdrop-blur-md">
                    {error ? (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-[var(--radius-sm)] text-sm flex items-start gap-2">
                            <span className="mt-0.5">⚠️</span>
                            <div>
                                <p className="font-bold">Error</p>
                                <p>{error}</p>
                                <Link to="/forgot-password" className="underline mt-2 inline-block">Request new link</Link>
                            </div>
                        </div>
                    ) : message ? (
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-600 rounded-[var(--radius-sm)] text-center">
                            <h3 className="text-xl font-bold mb-2">✅ Success!</h3>
                            <p>{message}</p>
                            <Link to="/login" className="mt-4 inline-block px-6 py-2 bg-green-600 text-white rounded-lg font-bold">Go to Login</Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-[var(--text-main)]">New Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-[var(--text-main)]">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`w-full py-3.5 rounded-[var(--radius-sm)] font-semibold text-white shadow-lg shadow-[var(--brand-primary)]/20 transition-all ${isSubmitting
                                    ? 'bg-[var(--text-muted)] cursor-not-allowed opacity-70'
                                    : 'bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]'
                                    }`}
                            >
                                {isSubmitting ? 'Resetting...' : 'Update Password'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
