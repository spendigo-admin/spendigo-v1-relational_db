import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import { db, storage } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, onSnapshot, query, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { jobs, values, benefits } from '../../data/careers';

const Careers: React.FC = () => {
    const { t } = useTranslation();
    const [selectedJob, setSelectedJob] = React.useState<any>(null);
    const [isApplying, setIsApplying] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [submissionStatus, setSubmissionStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
    const [careersEnabled, setCareersEnabled] = React.useState(true);
    const [dynamicJobs, setDynamicJobs] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        // 1. Fetch Platform Settings
        const settingsRef = doc(db, 'settings', 'platform');
        const unsubscribeSettings = onSnapshot(settingsRef, (snap) => {
            if (snap.exists()) {
                setCareersEnabled(snap.data().careersEnabled !== false);
            }
        });

        // 2. Fetch Active Careers
        const careersRef = collection(db, 'careers');
        const q = query(careersRef, where('isVisible', '==', true));
        const unsubscribeCareers = onSnapshot(q, (snap) => {
            const jobsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDynamicJobs(jobsList);
            setLoading(false);
        });

        return () => {
            unsubscribeSettings();
            unsubscribeCareers();
        };
    }, []);

    const handleApply = (job: any, e: React.MouseEvent) => {
        e.preventDefault();
        setSelectedJob(job);
        setIsApplying(true);
        setSubmissionStatus('idle');
    };

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

            // 1. Upload Resume to Firebase Storage
            const resumeRef = ref(storage, `resumes/${selectedJob.id}/${Date.now()}_${resumeFile.name}`);
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

            // 2. Save Application Metadata to Firestore
            await addDoc(collection(db, 'job_applications'), {
                jobId: selectedJob.id,
                jobTitle: selectedJob.title,
                candidateName: name,
                candidateEmail: email,
                candidatePhone: phone,
                message: message,
                resumeUrl: resumeUrl,
                status: 'new',
                appliedAt: serverTimestamp()
            });

            console.log(`Application for ${selectedJob.title} sent to support@spendigo.ca`);
            setSubmissionStatus('success');
        } catch (error) {
            console.error('Application failed:', error);
            setSubmissionStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="min-h-screen bg-[var(--surface-0)] overflow-hidden">
            <SEO 
                title="Careers | Join the Spendigo Team"
                description="Help us build the future of AI-powered shopping. Explore open roles and learn about our culture at Spendigo."
            />

            {/* HERO SECTION */}
            <section className="relative py-20 px-4">
                <div className="container mx-auto max-w-6xl relative z-10">
                    <div className="text-center">
                        <span className="inline-block px-4 py-1.5 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-sm font-bold mb-6 animate-fade-in">
                            We're Hiring!
                        </span>
                        <h1 className="text-4xl md:text-6xl font-black text-[var(--text-main)] mb-6 tracking-tight leading-tight">
                            Build the <span className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] bg-clip-text text-transparent">Future of Shopping</span> with Us
                        </h1>
                        <p className="text-lg md:text-xl text-[var(--text-muted)] max-w-2xl mx-auto mb-10">
                            We're a team of dreamers, builders, and AI enthusiasts on a mission to make smart shopping accessible to everyone.
                        </p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <a href="#open-roles" className="px-8 py-4 bg-[var(--brand-primary)] text-white font-bold rounded-xl shadow-xl shadow-[var(--brand-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                View Open Roles
                            </a>
                        </div>
                    </div>
                </div>

                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[500px] h-[500px] bg-[var(--brand-primary)]/5 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-[var(--brand-secondary)]/5 rounded-full blur-[100px]"></div>
            </section>

            {/* OUR VALUES */}
            <section className="py-20 bg-[var(--surface-1)] border-y border-[var(--glass-border)]">
                <div className="container mx-auto max-w-6xl px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-[var(--text-main)] mb-4">Our Core Values</h2>
                        <p className="text-[var(--text-muted)] max-w-xl mx-auto">
                            Our values guide everything we do—from how we build our product to how we support each other.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {values.map((value, idx) => (
                            <div key={idx} className="glass-panel p-8 hover:translate-y-[-4px] transition-transform duration-300">
                                <div className="text-4xl mb-4">{value.icon}</div>
                                <h3 className="text-xl font-bold text-[var(--text-main)] mb-3">{value.title}</h3>
                                <p className="text-[var(--text-muted)] text-sm leading-relaxed">{value.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* WHY JOIN US / BENEFITS */}
            <section className="py-20">
                <div className="container mx-auto max-w-6xl px-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="order-2 lg:order-1">
                            <h2 className="text-3xl font-bold text-[var(--text-main)] mb-8">Why Join Spendigo?</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {benefits.map((benefit, idx) => (
                                    <div key={idx} className="flex gap-4">
                                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-2xl border border-[var(--glass-border)]">
                                            {benefit.icon}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-[var(--text-main)] mb-1">{benefit.title}</h4>
                                            <p className="text-sm text-[var(--text-muted)] leading-snug">{benefit.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="order-1 lg:order-2">
                            <div className="relative">
                                <div className="rounded-3xl overflow-hidden aspect-video shadow-2xl">
                                    <img 
                                        src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=1200" 
                                        alt="Our Team" 
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="absolute -bottom-6 -right-6 glass-panel p-6 max-w-[240px] hidden md:block">
                                    <p className="text-sm font-medium italic text-[var(--text-main)]">
                                        "Working at Spendigo has been the most fulfilling experience of my career. The energy is incredible."
                                    </p>
                                    <div className="mt-4 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                                        <div>
                                            <p className="text-xs font-bold">Sarah Chen</p>
                                            <p className="text-[10px] text-[var(--text-muted)]">Senior Engineer</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* OPEN ROLES */}
            <section id="open-roles" className="py-20 bg-[var(--surface-1)] border-t border-[var(--glass-border)]">
                <div className="container mx-auto max-w-4xl px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-[var(--text-main)] mb-4">Open Positions</h2>
                        <p className="text-[var(--text-muted)]">
                            {careersEnabled 
                                ? 'Join us in reshaping the digital shopping experience.' 
                                : 'We currently have no open vacancies at this time.'}
                        </p>
                    </div>

                    {!careersEnabled || (dynamicJobs.length === 0 && !loading) ? (
                        <div className="text-center py-16 glass-panel">
                            <div className="text-5xl mb-4">✨</div>
                            <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">No Open Vacancies</h3>
                            <p className="text-[var(--text-muted)] max-w-sm mx-auto">
                                We're not actively hiring for any roles right now, but we're always looking for talented dreamers to join our talent pool.
                            </p>
                        </div>
                    ) : loading ? (
                        <div className="flex justify-center p-20">
                            <div className="w-10 h-10 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {dynamicJobs.map((job) => (
                                <Link 
                                    key={job.id} 
                                    to={`/careers/${job.id}`} 
                                    className="block glass-panel p-6 hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/[0.02] transition-colors"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                                <div>
                                                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">{job.title}</h3>
                                                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                                                        <span className="text-sm text-[var(--text-muted)] flex items-center gap-1">📍 {job.location}</span>
                                                        <span className="text-sm text-[var(--text-muted)] flex items-center gap-1">📁 {job.team}</span>
                                                        <span className="text-sm text-[var(--text-muted)] flex items-center gap-1">🕒 {job.type}</span>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={(e) => handleApply(job, e)}
                                                    className="px-5 py-2 rounded-lg border border-[var(--brand-primary)] text-[var(--brand-primary)] font-bold text-sm hover:bg-[var(--brand-primary)] hover:text-white transition-colors self-start md:self-center"
                                                >
                                                    Apply Now
                                                </button>
                                            </div>
                                            
                                            {/* Requirements List */}
                                            <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
                                                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Requirements:</p>
                                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                                    {(job.requirements || []).map((req, i) => (
                                                        <li key={i} className="text-sm text-[var(--text-muted)] flex items-start gap-3">
                                                            <span className="text-[10px] mt-1.5 text-[var(--brand-primary)]">●</span>
                                                            <span className="text-left">{req}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* TALENT POOL CTA */}
                    <div className="mt-16 text-center glass-panel p-8">
                        <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">Don't see a fit?</h3>
                        <p className="text-[var(--text-muted)] text-sm mb-6">
                            We're always looking for talented individuals. Join our talent pool to stay updated on future opportunities.
                        </p>
                        <button className="px-8 py-3 bg-[var(--surface-2)] text-[var(--text-main)] font-bold rounded-xl hover:bg-[var(--surface-3)] transition-colors">
                            Join Talent Pool
                        </button>
                    </div>
                </div>
            </section>

            {/* FINAL CTA */}
            <section className="py-20 px-4">
                <div className="container mx-auto max-w-4xl">
                    <div className="bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-secondary)] rounded-[2rem] p-12 text-center text-white shadow-2xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h2 className="text-3xl md:text-4xl font-black mb-6">Ready to make an impact?</h2>
                            <p className="text-lg opacity-90 mb-10 max-w-xl mx-auto">
                                The future of shopping is being built right here at Spendigo. We'd love for you to be a part of it.
                            </p>
                            <Link to="/register" className="inline-block px-10 py-5 bg-white text-[var(--brand-primary)] font-black rounded-2xl shadow-xl hover:scale-105 transition-transform">
                                Explore Our Platform
                            </Link>
                        </div>
                        {/* Abstract Shapes */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                    </div>
                </div>
            </section>
        </div>

        {/* APPLICATION MODAL */}
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
                                    Thank you, {selectedJob.title} candidate. Your application has been successfully sent to **support@spendigo.ca**. We'll get back to you soon.
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
                                <h2 className="text-2xl font-black text-[var(--text-main)] mb-2">Apply for {selectedJob.title}</h2>
                                <p className="text-sm text-[var(--text-muted)] mb-8 flex items-center gap-2">
                                    📍 {selectedJob.location} • 🕒 {selectedJob.type}
                                </p>

                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    submitApplication(new FormData(e.currentTarget));
                                }} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Full Name</label>
                                            <input required name="name" type="text" className="w-full h-11 px-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Email Address</label>
                                            <input required name="email" type="email" className="w-full h-11 px-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none" />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Phone Number</label>
                                        <input required name="phone" type="tel" className="w-full h-11 px-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none" />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Resume (PDF only)</label>
                                        <div className="relative group">
                                            <input required name="resume" type="file" accept=".pdf" className="w-full h-20 opacity-0 absolute inset-0 z-10 cursor-pointer" />
                                            <div className="w-full h-20 border-2 border-dashed border-[var(--glass-border)] rounded-xl flex items-center justify-center gap-3 group-hover:border-[var(--brand-primary)] group-hover:bg-[var(--brand-primary)]/[0.02] transition-colors">
                                                <span className="text-2xl opacity-40">📄</span>
                                                <span className="text-sm font-medium text-[var(--text-muted)]">Click or drag your resume here</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Message (Optional)</label>
                                        <textarea name="message" rows={3} className="w-full p-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none resize-none" placeholder="Tell us why you're a great fit..."></textarea>
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
                                        <p className="text-[10px] text-center text-[var(--text-muted)] mt-4 font-medium italic">
                                            By submitting, your data will be securely processed and sent to support@spendigo.ca
                                        </p>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}
    </>
    );
};

export default Careers;
