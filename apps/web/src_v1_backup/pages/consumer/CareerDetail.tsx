import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import { db, storage } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { Job } from '../../data/careers';

const CareerDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    
    const [job, setJob] = React.useState<Job | null>(null);
    const [careersEnabled, setCareersEnabled] = React.useState(true);
    const [loading, setLoading] = React.useState(true);
    const [isApplying, setIsApplying] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [submissionStatus, setSubmissionStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

    React.useEffect(() => {
        if (!id) return;

        // 1. Fetch Global Setting
        const settingsRef = doc(db, 'settings', 'platform');
        const unsubscribeSettings = onSnapshot(settingsRef, (snap) => {
            if (snap.exists()) {
                setCareersEnabled(snap.data().careersEnabled !== false);
            }
        });

        // 2. Fetch Job Details
        const fetchJob = async () => {
            try {
                const jobSnap = await getDoc(doc(db, 'careers', id));
                if (jobSnap.exists()) {
                    setJob({ id: jobSnap.id, ...jobSnap.data() } as Job);
                }
            } catch (err) {
                console.error('Error fetching job:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchJob();
        return () => unsubscribeSettings();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!job || !careersEnabled || !job.isVisible) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <div className="text-6xl mb-6">🔍</div>
                <h2 className="text-2xl font-bold mb-2 text-[var(--text-main)]">
                    {!careersEnabled ? 'Careers Section Disabled' : 'Job Not Found'}
                </h2>
                <p className="text-[var(--text-muted)] mb-8 max-w-sm text-center">
                    {!careersEnabled 
                        ? 'The careers section is currently under maintenance. Please check back later.' 
                        : 'This position may have been filled or the link is incorrect.'}
                </p>
                <Link to="/careers" className="px-8 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-xl shadow-lg">
                    Back to Careers
                </Link>
            </div>
        );
    }

    const submitApplication = async (formData: FormData) => {
        setIsSubmitting(true);
        setUploadProgress(0);

        try {
            const resumeFile = formData.get('resume') as File;
            const name = formData.get('name') as string;
            const email = formData.get('email') as string;
            const phone = formData.get('phone') as string;
            const message = formData.get('message') as string;

            if (!resumeFile) throw new Error('Resume is required');

            // 1. Upload Resume
            const resumeRef = ref(storage, `resumes/${job.id}/${Date.now()}_${resumeFile.name}`);
            const uploadTask = uploadBytesResumable(resumeRef, resumeFile);

            const resumeUrl = await new Promise<string>((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress(progress);
                    }, 
                    (error) => reject(error), 
                    async () => {
                        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(downloadUrl);
                    }
                );
            });

            // 2. Save Metadata
            await addDoc(collection(db, 'job_applications'), {
                jobId: job.id,
                jobTitle: job.title,
                candidateName: name,
                candidateEmail: email,
                candidatePhone: phone,
                message: message,
                resumeUrl: resumeUrl,
                status: 'new',
                appliedAt: serverTimestamp()
            });

            setSubmissionStatus('success');
        } catch (error) {
            console.error('Application failed:', error);
            setSubmissionStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--surface-0)] pb-20">
            <SEO 
                title={`${job.title} | Careers at Spendigo`}
                description={job.description}
            />

            {/* HEADER / HERO */}
            <div className="bg-[var(--surface-1)] border-b border-[var(--glass-border)] pt-20 pb-12 px-4 text-center relative overflow-hidden">
                <div className="container mx-auto max-w-4xl relative z-10">
                    <Link to="/careers" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-primary)] mb-8 hover:translate-x-[-4px] transition-transform">
                        ← Back to Careers
                    </Link>
                    <h1 className="text-3xl md:text-5xl font-black text-[var(--text-main)] mb-4">{job.title}</h1>
                    <div className="flex flex-wrap justify-center gap-4 text-[var(--text-muted)] font-medium">
                        <span className="flex items-center gap-1.5">📍 {job.location}</span>
                        <span className="flex items-center gap-1.5">📁 {job.team}</span>
                        <span className="flex items-center gap-1.5">🕒 {job.type}</span>
                    </div>
                </div>
                {/* Background Blobs */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--brand-primary)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-[var(--brand-secondary)]/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            </div>

            {/* CONTENT SECTION */}
            <div className="container mx-auto max-w-4xl px-4 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-12">
                    <section>
                        <h2 className="text-2xl font-bold text-[var(--text-main)] mb-4 text-left">About the Role</h2>
                        <p className="text-[var(--text-muted)] leading-relaxed text-left">
                            {job.description}
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[var(--text-main)] mb-6 text-left">Requirements</h2>
                        <ul className="space-y-4">
                            {job.requirements.map((req: string, i: number) => (
                                <li key={i} className="flex items-start gap-3 group text-left">
                                    <span className="w-6 h-6 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center text-xs shrink-0 mt-1 font-bold">
                                        {i + 1}
                                    </span>
                                    <span className="text-[var(--text-muted)] leading-relaxed group-hover:text-[var(--text-main)] transition-colors">
                                        {req}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {job.responsibilities && (
                        <section>
                            <h2 className="text-2xl font-bold text-[var(--text-main)] mb-6 text-left">Key Responsibilities</h2>
                            <ul className="space-y-4">
                                {job.responsibilities.map((resp: string, i: number) => (
                                    <li key={i} className="flex items-start gap-3 group text-left">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] mt-2.5 shrink-0 shadow-[0_0_8px_var(--brand-primary)]"></div>
                                        <span className="text-[var(--text-muted)] leading-relaxed group-hover:text-[var(--text-main)] transition-colors">
                                            {resp}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                {/* Sidebar Sticky Actions */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24 glass-panel p-8 space-y-6">
                        <h3 className="text-xl font-bold text-[var(--text-main)] text-left">Ready to Apply?</h3>
                        <p className="text-sm text-[var(--text-muted)] text-left">
                            Join us in building the future of AI-powered shopping.
                        </p>
                        <button 
                            onClick={() => setIsApplying(true)}
                            className="w-full py-4 bg-[var(--brand-primary)] text-white font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Apply Now
                        </button>
                        <div className="pt-6 border-t border-[var(--glass-border)] space-y-4">
                            <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
                                <span>📧</span>
                                <span>Questions? support@spendigo.ca</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
                                <span>🚀</span>
                                <span>Rapid growth opportunity</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footnote */}
            <div className="container mx-auto max-w-4xl px-4 mt-20 text-center">
                <p className="text-sm text-[var(--text-muted)] italic">
                    Spendigo is an equal opportunity employer. We celebrate diversity and are committed to creating an inclusive environment for all employees.
                </p>
            </div>

            {/* APPLICATION MODAL (REUSED LOGIC) */}
            {isApplying && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[var(--surface-0)] w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden relative">
                        <button 
                            onClick={() => !isSubmitting && setIsApplying(false)}
                            className="absolute top-6 right-6 p-2 rounded-full hover:bg-[var(--surface-2)] transition-colors"
                        >
                            ✕
                        </button>

                        <div className="p-8">
                            {submissionStatus === 'success' ? (
                                <div className="text-center py-12">
                                    <div className="text-6xl mb-6">🎉</div>
                                    <h2 className="text-2xl font-black text-[var(--text-main)] mb-3">Application Sent!</h2>
                                    <p className="text-[var(--text-muted)] mb-8">
                                        Thank you for applying to the **{job.title}** role. Your application has been successfully sent to **support@spendigo.ca**.
                                    </p>
                                    <button 
                                        onClick={() => setIsApplying(false)}
                                        className="px-8 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-xl shadow-lg"
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <h2 className="text-2xl font-black text-[var(--text-main)] mb-6 text-left">Apply for {job.title}</h2>
                                    
                                    <form onSubmit={(e) => {
                                        e.preventDefault();
                                        submitApplication(new FormData(e.currentTarget));
                                    }} className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5 text-left">
                                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Full Name</label>
                                                <input required name="name" type="text" className="w-full h-11 px-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none" />
                                            </div>
                                            <div className="space-y-1.5 text-left">
                                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Email Address</label>
                                                <input required name="email" type="email" className="w-full h-11 px-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none" />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 text-left">
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Phone Number</label>
                                            <input required name="phone" type="tel" className="w-full h-11 px-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none" />
                                        </div>

                                        <div className="space-y-1.5 text-left">
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Resume (PDF only)</label>
                                            <div className="relative group">
                                                <input required name="resume" type="file" accept=".pdf" className="w-full h-20 opacity-0 absolute inset-0 z-10 cursor-pointer" />
                                                <div className="w-full h-20 border-2 border-dashed border-[var(--glass-border)] rounded-xl flex items-center justify-center gap-3 group-hover:border-[var(--brand-primary)] group-hover:bg-[var(--brand-primary)]/[0.02] transition-colors">
                                                    <span className="text-2xl opacity-40">📄</span>
                                                    <span className="text-sm font-medium text-[var(--text-muted)]">Click or drag your resume here</span>
                                                </div>
                                            </div>
                                        </div>

                                        {submissionStatus === 'error' && (
                                            <p className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-lg border border-red-100">
                                                ⚠️ Something went wrong. Please check your connection and try again.
                                            </p>
                                        )}

                                        <div className="pt-4">
                                            <button 
                                                disabled={isSubmitting}
                                                className={`w-full py-4 rounded-2xl font-black text-white shadow-xl transition-all relative overflow-hidden ${isSubmitting ? 'bg-[var(--text-muted)] cursor-not-allowed' : 'bg-[var(--brand-primary)] hover:scale-[1.01]'}`}
                                            >
                                                {isSubmitting ? (
                                                    <div className="flex items-center justify-center gap-3">
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                        <span>Uploading... {Math.round(uploadProgress)}%</span>
                                                    </div>
                                                ) : (
                                                    'Submit Application'
                                                )}
                                                {isSubmitting && (
                                                    <div 
                                                        className="absolute bottom-0 left-0 h-1 bg-white/30 transition-all duration-300" 
                                                        style={{ width: `${uploadProgress}%` }}
                                                    ></div>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CareerDetail;
