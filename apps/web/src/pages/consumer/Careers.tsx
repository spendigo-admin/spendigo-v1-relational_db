import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import { db, storage } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, onSnapshot, query, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { jobs, values, benefits, Job } from '../../data/careers';

const Careers: React.FC = () => {
    const { t } = useTranslation();
    const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
    const [isApplying, setIsApplying] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [submissionStatus, setSubmissionStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
    const [careersEnabled, setCareersEnabled] = React.useState(true);
    const [dynamicJobs, setDynamicJobs] = React.useState<Job[]>([]);
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
            const jobsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
            setDynamicJobs(jobsList);
            setLoading(false);
        });

        return () => {
            unsubscribeSettings();
            unsubscribeCareers();
        };
    }, []);

    const handleApply = (job: Job, e: React.MouseEvent) => {
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

            if (!selectedJob) return;

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
        <div className="bg-[var(--surface-0)] min-h-screen">
            <SEO 
                title="Careers | Join the Spendigo Team"
                description="Help us build the future of AI-powered shopping. Explore open roles and learn about our culture at Spendigo."
            />

            {/* Hero Section */}
            <section className="relative pt-12 pb-16 md:pt-32 md:pb-40 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,var(--brand-primary-light),transparent_70%)]" />
                    <div className="absolute top-1/4 -right-20 w-64 h-64 md:w-96 md:h-96 bg-purple-100 rounded-full blur-3xl opacity-50 animate-pulse" />
                    <div className="absolute bottom-0 -left-20 w-64 h-64 md:w-96 md:h-96 bg-blue-100 rounded-full blur-3xl opacity-50 animate-pulse" style={{ animationDelay: '2s' }} />
                </div>

                <div className="container mx-auto max-w-6xl relative z-10 px-4 text-center">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white shadow-sm border border-gray-100 mb-6 md:mb-8 animate-fade-in">
                        <span className="flex h-2 w-2 rounded-full bg-[var(--brand-primary)] animate-ping" />
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            We're Hiring!
                        </span>
                    </span>
                    <h1 className="text-3xl sm:text-4xl md:text-7xl font-black tracking-tight text-[var(--text-main)] mb-4 md:mb-6 leading-[1.15] md:leading-[1.1]">
                        Build the <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--brand-primary)] to-indigo-600">
                            Future of Shopping
                        </span>
                    </h1>
                    <p className="text-base md:text-xl text-[var(--text-muted)] max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed px-2">
                        We're a team of dreamers, builders, and AI enthusiasts on a mission to make smart shopping accessible to everyone.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 px-4 sm:px-0">
                        <button 
                            onClick={() => document.getElementById('open-roles')?.scrollIntoView({ behavior: 'smooth' })} 
                            className="w-full sm:w-auto px-8 md:px-10 py-3.5 md:py-4 bg-[var(--brand-primary)] text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm md:text-base text-center cursor-pointer"
                        >
                            🔍 Explore Open Roles
                        </button>
                        <Link to="/register" className="w-full sm:w-auto px-8 md:px-10 py-3.5 md:py-4 bg-white text-[var(--text-main)] font-black rounded-2xl border-2 border-[var(--glass-border)] hover:bg-[var(--surface-1)] transition-all text-sm md:text-base text-center">
                            Try the App First
                        </Link>
                    </div>
                </div>
            </section>

            {/* Our Values */}
            <section className="py-16 md:py-24 bg-white border-y border-[var(--glass-border)]">
                <div className="container mx-auto max-w-6xl px-4">
                    <div className="text-center mb-12 md:mb-20">
                        <h2 className="text-2xl md:text-4xl font-black text-[var(--text-main)] mb-4">Our Core Values</h2>
                        <div className="w-16 md:w-20 h-1.5 bg-[var(--brand-primary)] mx-auto rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {values.map((value, idx) => (
                            <div key={idx} className="p-8 rounded-[2rem] bg-[var(--surface-1)] border border-[var(--glass-border)] hover:bg-white hover:shadow-xl transition-all group">
                                <div className="text-4xl mb-6 transform group-hover:scale-110 transition-transform">{value.icon}</div>
                                <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-3">{value.title}</h3>
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{value.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why Join Us */}
            <section className="py-16 md:py-24">
                <div className="container mx-auto max-w-6xl px-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 items-center">
                        <div className="order-2 lg:order-1">
                            <h2 className="text-2xl md:text-4xl font-black text-[var(--text-main)] mb-8 md:mb-12">Why Join Spendigo?</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-10">
                                {benefits.map((benefit, idx) => (
                                    <div key={idx} className="flex gap-4 md:gap-6">
                                        <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl border border-[var(--glass-border)] transform -rotate-3">
                                            {benefit.icon}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-base md:text-lg text-[var(--text-main)] mb-1.5 md:mb-2">{benefit.title}</h4>
                                            <p className="text-xs md:text-sm text-[var(--text-muted)] leading-relaxed">{benefit.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="order-1 lg:order-2">
                            <div className="relative group">
                                <div className="rounded-[2.5rem] overflow-hidden aspect-[4/3] md:aspect-video shadow-2xl relative">
                                    <img 
                                        src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=1200" 
                                        alt="Our Team" 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                </div>
                                <div className="absolute -bottom-6 -right-6 md:right-6 glass-panel p-6 max-w-[240px] hidden sm:block border-2 border-white/50 shadow-2xl animate-fade-in">
                                    <p className="text-sm font-medium italic text-[var(--text-main)] leading-relaxed">
                                        "Working at Spendigo has been the most fulfilling experience of my career. The energy is incredible."
                                    </p>
                                    <div className="mt-4 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center text-xl">👤</div>
                                        <div>
                                            <p className="text-xs font-bold text-[var(--text-main)]">Sarah Chen</p>
                                            <p className="text-[10px] text-[var(--text-muted)] font-medium">Senior Engineer</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Open Roles */}
            <section id="open-roles" className="py-20 md:py-32 bg-[var(--surface-1)] border-t border-[var(--glass-border)] scroll-mt-20">
                <div className="container mx-auto max-w-4xl px-4">
                    <div className="text-center mb-12 md:mb-20">
                        <h2 className="text-3xl md:text-5xl font-black text-[var(--text-main)] mb-4 tracking-tight">Open Opportunities</h2>
                        <p className="text-sm md:text-base text-[var(--text-muted)]">
                            {careersEnabled 
                                ? 'Join us in reshaping the digital shopping experience.' 
                                : 'We currently have no open vacancies at this time.'}
                        </p>
                    </div>

                    {!careersEnabled || (dynamicJobs.length === 0 && !loading) ? (
                        <div className="text-center py-16 md:py-20 bg-white rounded-[2rem] border-2 border-dashed border-[var(--glass-border)]">
                            <div className="text-5xl md:text-6xl mb-6">✨</div>
                            <h3 className="text-xl md:text-2xl font-bold text-[var(--text-main)] mb-3">No Open Vacancies</h3>
                            <p className="text-sm md:text-base text-[var(--text-muted)] max-w-sm mx-auto px-4">
                                We're not actively hiring for any roles right now, but we're always looking for talented dreamers to join our talent pool.
                            </p>
                        </div>
                    ) : loading ? (
                        <div className="flex justify-center p-20">
                            <div className="w-12 h-12 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="space-y-4 md:space-y-6">
                            {dynamicJobs.map((job: Job) => (
                                <Link 
                                    key={job.id} 
                                    to={`/careers/${job.id}`} 
                                    className="block bg-white rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 border border-[var(--glass-border)] hover:border-[var(--brand-primary)] hover:shadow-xl transition-all group"
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                        <div className="flex-1">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                                <div>
                                                    <h3 className="text-xl md:text-2xl font-black text-[var(--text-main)] mb-2 group-hover:text-[var(--brand-primary)] transition-colors">{job.title}</h3>
                                                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                                                        <span className="text-xs md:text-sm text-[var(--text-muted)] font-medium flex items-center gap-1.5">📍 {job.location}</span>
                                                        <span className="text-xs md:text-sm text-[var(--text-muted)] font-medium flex items-center gap-1.5">📁 {job.team}</span>
                                                        <span className="text-xs md:text-sm text-[var(--text-muted)] font-medium flex items-center gap-1.5">🕒 {job.type}</span>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={(e) => handleApply(job, e)}
                                                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[var(--brand-primary)] text-white font-black text-sm hover:scale-105 shadow-lg shadow-[var(--brand-primary)]/20 transition-all"
                                                >
                                                    Fast Apply →
                                                </button>
                                            </div>
                                            
                                            <div className="pt-6 border-t border-gray-50">
                                                <p className="text-[10px] md:text-xs font-black text-[var(--text-muted)] uppercase tracking-widest mb-4">Core Requirements:</p>
                                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                                                    {(job.requirements || []).map((req: string, i: number) => (
                                                        <li key={i} className="text-xs md:text-sm text-[var(--text-muted)] flex items-start gap-3 leading-relaxed">
                                                            <span className="text-[var(--brand-primary)] mt-1">✓</span>
                                                            <span className="text-left font-medium">{req}</span>
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

                    {/* Talent Pool CTA */}
                    <div className="mt-12 md:mt-20 text-center bg-white rounded-[2rem] md:rounded-[3rem] p-8 md:p-16 border-2 border-dashed border-[var(--brand-primary)]/20 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-[var(--brand-primary)]/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-[var(--brand-primary)]/10 rounded-2xl flex items-center justify-center text-3xl md:text-4xl mx-auto mb-6 md:mb-8 transform -rotate-6">🤝</div>
                        <h3 className="text-2xl md:text-3xl font-black text-[var(--text-main)] mb-3 md:mb-4">Don't see your fit?</h3>
                        <p className="text-sm md:text-base text-[var(--text-muted)] mb-8 md:mb-12 max-w-lg mx-auto leading-relaxed">
                            We're always growing! If you're a designer, engineer, or marketer who believes in our mission, join our talent pool.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4 px-4">
                            <button className="w-full sm:w-auto px-10 py-4 bg-[var(--brand-primary)] text-white font-black rounded-2xl shadow-xl shadow-[var(--brand-primary)]/20 hover:scale-[1.05] transition-all">
                                Join Talent Pool
                            </button>
                            <button className="w-full sm:w-auto px-10 py-4 bg-white text-[var(--text-main)] font-bold rounded-2xl border-2 border-[var(--glass-border)] hover:bg-gray-50 transition-colors">
                                Refer a Friend
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 md:py-32 bg-white px-4">
                <div className="container mx-auto max-w-4xl">
                    <div className="bg-[#112244] rounded-[2.5rem] md:rounded-[4rem] p-10 md:p-20 text-center text-white shadow-2xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h2 className="text-3xl md:text-5xl font-black mb-6 md:mb-8 text-white leading-tight">Ready to make an impact?</h2>
                            <p className="text-base md:text-lg mb-8 md:mb-12 max-w-xl mx-auto text-white/90">
                                The future of shopping is being built right here at Spendigo. We'd love for you to be a part of it.
                            </p>
                            <Link to="/register" className="inline-block px-10 py-4 md:px-12 md:py-5 bg-white text-[var(--brand-primary)] font-black rounded-2xl md:rounded-[2rem] shadow-xl hover:scale-105 transition-transform text-base md:text-lg">
                                Explore Our Platform
                            </Link>
                        </div>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                    </div>
                </div>
            </section>

            {/* Application Modal */}
            {isApplying && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in overflow-y-auto">
                    <div className="bg-white/90 backdrop-blur-xl w-full max-w-2xl rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden relative my-8 border border-white/50">
                        <button 
                            onClick={() => !isSubmitting && setIsApplying(false)}
                            className="absolute top-6 right-6 md:top-8 md:right-8 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors z-20"
                        >
                            ✕
                        </button>

                        <div className="p-8 md:p-12">
                            {submissionStatus === 'success' ? (
                                <div className="text-center py-12 md:py-16">
                                    <div className="text-6xl md:text-8xl mb-6 md:mb-8 animate-bounce">🎉</div>
                                    <h2 className="text-3xl md:text-4xl font-black text-[var(--text-main)] mb-4 md:mb-6">Application Sent!</h2>
                                    <p className="text-base md:text-lg text-[var(--text-muted)] mb-8 md:mb-12 leading-relaxed max-w-md mx-auto">
                                        Thank you, {selectedJob?.title} candidate. Your application has been successfully sent to **support@spendigo.ca**. We'll get back to you soon.
                                    </p>
                                    <button 
                                        onClick={() => setIsApplying(false)}
                                        className="px-12 py-4 bg-[var(--brand-primary)] text-white font-black rounded-2xl shadow-xl hover:scale-105 transition-all"
                                    >
                                        Back to Careers
                                    </button>
                                </div>
                            ) : (
                                selectedJob && (
                                    <>
                                        <div className="mb-8 md:mb-12">
                                            <h2 className="text-2xl md:text-4xl font-black text-[var(--text-main)] mb-2 md:mb-4">Apply for {selectedJob.title}</h2>
                                            <div className="flex flex-wrap gap-3">
                                                <span className="px-3 py-1 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-[10px] md:text-xs font-bold uppercase tracking-widest">📍 {selectedJob.location}</span>
                                                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-widest">🕒 {selectedJob.type}</span>
                                            </div>
                                        </div>

                                    <form onSubmit={(e) => {
                                        e.preventDefault();
                                        submitApplication(new FormData(e.currentTarget));
                                    }} className="space-y-6 md:space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] md:text-xs font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Full Name</label>
                                                <input required name="name" type="text" className="w-full h-12 md:h-14 px-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:bg-white focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/5 outline-none transition-all" placeholder="John Doe" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] md:text-xs font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Email Address</label>
                                                <input required name="email" type="email" className="w-full h-12 md:h-14 px-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:bg-white focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/5 outline-none transition-all" placeholder="john@example.com" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] md:text-xs font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Phone Number</label>
                                            <input required name="phone" type="tel" className="w-full h-12 md:h-14 px-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:bg-white focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/5 outline-none transition-all" placeholder="+1 (555) 000-0000" />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] md:text-xs font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Resume (PDF only)</label>
                                            <div className="relative group">
                                                <input required name="resume" type="file" accept=".pdf" className="w-full h-24 md:h-32 opacity-0 absolute inset-0 z-10 cursor-pointer" />
                                                <div className="w-full h-24 md:h-32 border-2 border-dashed border-gray-200 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 group-hover:border-[var(--brand-primary)] group-hover:bg-[var(--brand-primary)]/[0.02] transition-all bg-gray-50">
                                                    <span className="text-3xl md:text-4xl transform group-hover:scale-110 transition-transform">📄</span>
                                                    <span className="text-xs md:text-sm font-bold text-[var(--text-muted)]">Click or drag your resume here</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] md:text-xs font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Message (Optional)</label>
                                            <textarea name="message" rows={3} className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:bg-white focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/5 outline-none resize-none transition-all" placeholder="Tell us why you're a great fit..."></textarea>
                                        </div>

                                        {submissionStatus === 'error' && (
                                            <p className="text-xs md:text-sm text-red-600 font-bold bg-red-50 p-4 rounded-xl border border-red-100 animate-shake">
                                                ⚠️ Something went wrong. Please check your connection and try again.
                                            </p>
                                        )}

                                        <div className="pt-4 md:pt-6">
                                            <button 
                                                disabled={isSubmitting}
                                                className={`w-full py-4 md:py-5 rounded-2xl font-black text-white shadow-xl transition-all relative overflow-hidden ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--brand-primary)] hover:scale-[1.01] hover:brightness-110'}`}
                                            >
                                                {isSubmitting ? (
                                                    <div className="flex items-center justify-center gap-3">
                                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                        <span>Uploading... {Math.round(uploadProgress)}%</span>
                                                    </div>
                                                ) : (
                                                    'Submit Application'
                                                )}
                                                {isSubmitting && (
                                                    <div 
                                                        className="absolute bottom-0 left-0 h-1.5 bg-white/40 transition-all duration-300" 
                                                        style={{ width: `${uploadProgress}%` }}
                                                    ></div>
                                                )}
                                            </button>
                                            <p className="text-[10px] text-center text-[var(--text-muted)] mt-6 font-bold italic tracking-wide uppercase">
                                                Secure encrypted submission to support@spendigo.ca
                                            </p>
                                        </div>
                                    </form>
                                </>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Careers;
