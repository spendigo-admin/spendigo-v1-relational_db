import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { auditBridge } from '../../utils/auditBridge';

import { Job } from '../../data/careers';

const CareerManagement: React.FC = () => {
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [currentJob, setCurrentJob] = useState<Partial<Job> | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'careers'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const jobsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Job));
            setJobs(jobsData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentJob?.title || !currentJob?.location) {
            addNotification({ type: 'alert', title: 'Error', message: 'Title and Location are required.' });
            return;
        }

        try {
            const jobData = {
                ...currentJob,
                updatedAt: serverTimestamp(),
                isVisible: currentJob.isVisible ?? true
            };

            if (currentJob.id) {
                await setDoc(doc(db, 'careers', currentJob.id.toString()), jobData);
                auditBridge.emit('JOB_POST_UPDATE', {
                    jobId: currentJob.id,
                    title: jobData.title,
                    team: jobData.team
                });
                addNotification({ type: 'system', title: 'Updated', message: 'Job posting updated successfully.' });
            } else {
                const docRef = await addDoc(collection(db, 'careers'), {
                    ...jobData,
                    createdAt: serverTimestamp()
                });
                auditBridge.emit('JOB_POST_CREATE', {
                    jobId: docRef.id,
                    title: jobData.title,
                    team: jobData.team
                });
                addNotification({ type: 'system', title: 'Created', message: 'Job posting created successfully.' });
            }
            setIsEditing(false);
            setCurrentJob(null);
        } catch (err) {
            console.error(err);
            addNotification({ type: 'alert', title: 'Error', message: 'Failed to save job posting.' });
        }
    };

    const handleDelete = async (id: string) => {
        if (await confirm({
            title: 'Delete Job Posting?',
            message: 'Are you sure you want to remove this vacancy? This action cannot be undone.',
            confirmText: 'Delete',
            type: 'danger'
        })) {
            try {
                const job = jobs.find(j => j.id === id);
                await deleteDoc(doc(db, 'careers', id));
                auditBridge.emit('JOB_POST_DELETE', {
                    jobId: id,
                    title: job?.title || 'Unknown Job'
                });
                addNotification({ type: 'system', title: 'Deleted', message: 'Job posting removed.' });
            } catch (err) {
                console.error(err);
                addNotification({ type: 'alert', title: 'Error', message: 'Failed to delete job posting.' });
            }
        }
    };

    const toggleVisibility = async (job: Job) => {
        try {
            await setDoc(doc(db, 'careers', job.id.toString()), {
                ...job,
                isVisible: !job.isVisible,
                updatedAt: serverTimestamp()
            });
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in text-left">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Career Management</h1>
                    <p className="text-sm text-[var(--text-muted)] text-left">Manage dynamic job postings for the Spendigo Careers page.</p>
                </div>
                <button 
                    onClick={() => {
                        setCurrentJob({ requirements: [], responsibilities: [], team: 'Marketing', type: 'Full-time' });
                        setIsEditing(true);
                    }}
                    className="px-4 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg hover:brightness-110 shadow-md transition-all active:scale-95"
                >
                    + Add New Posting
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="w-8 h-8 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : jobs.length === 0 ? (
                <div className="glass-panel p-12 text-center">
                    <p className="text-[var(--text-muted)]">No job postings found. Use the seeding tool or add one manually.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {jobs.map((job: Job) => (
                        <div key={job.id} className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[var(--brand-primary)]/30 transition-colors">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-lg font-bold text-[var(--text-main)]">{job.title}</h3>
                                    {!job.isVisible && (
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded uppercase">Hidden</span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                                    <span>📍 {job.location}</span>
                                    <span>📁 {job.team}</span>
                                    <span>🕒 {job.type}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => toggleVisibility(job)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${job.isVisible ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {job.isVisible ? 'Visible' : 'Hidden'}
                                </button>
                                <button 
                                    onClick={() => {
                                        setCurrentJob(job);
                                        setIsEditing(true);
                                    }}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                                >
                                    Edit
                                </button>
                                <button 
                                    onClick={() => handleDelete(job.id.toString())}
                                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* EDIT MODAL */}
            {isEditing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[var(--surface-0)] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-[var(--glass-border)] flex justify-between items-center">
                            <h2 className="text-xl font-bold text-[var(--text-main)]">{currentJob?.id ? 'Edit Posting' : 'Add New Posting'}</h2>
                            <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-[var(--surface-2)] rounded-full transition-colors">✕</button>
                        </div>
                        
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 text-left">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Job Title</label>
                                    <input 
                                        required 
                                        value={currentJob?.title || ''} 
                                        onChange={e => setCurrentJob({...currentJob, title: e.target.value})}
                                        className="w-full h-11 px-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none" 
                                        placeholder="e.g. Senior Product Designer"
                                    />
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Location</label>
                                    <input 
                                        required 
                                        value={currentJob?.location || ''} 
                                        onChange={e => setCurrentJob({...currentJob, location: e.target.value})}
                                        className="w-full h-11 px-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none" 
                                        placeholder="e.g. Toronto, ON"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 text-left">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Team</label>
                                    <select 
                                        value={currentJob?.team || ''} 
                                        onChange={e => setCurrentJob({...currentJob, team: e.target.value})}
                                        className="w-full h-11 px-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none"
                                    >
                                        <option value="Engineering">Engineering</option>
                                        <option value="Marketing">Marketing</option>
                                        <option value="Product">Product</option>
                                        <option value="Design">Design</option>
                                        <option value="Sales">Sales</option>
                                        <option value="Operations">Operations</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Type</label>
                                    <select 
                                        value={currentJob?.type || ''} 
                                        onChange={e => setCurrentJob({...currentJob, type: e.target.value})}
                                        className="w-full h-11 px-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none"
                                    >
                                        <option value="Full-time">Full-time</option>
                                        <option value="Contract">Contract</option>
                                        <option value="Internship">Internship</option>
                                        <option value="Part-time">Part-time</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase">About the Role (Description)</label>
                                <textarea 
                                    rows={4}
                                    value={currentJob?.description || ''} 
                                    onChange={e => setCurrentJob({...currentJob, description: e.target.value})}
                                    className="w-full p-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none resize-none" 
                                    placeholder="Brief summary of the role..."
                                />
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Requirements (One per line)</label>
                                <textarea 
                                    rows={4}
                                    value={currentJob?.requirements?.join('\n') || ''} 
                                    onChange={e => setCurrentJob({...currentJob, requirements: e.target.value.split('\n').filter(l => l.trim())})}
                                    className="w-full p-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none resize-none" 
                                    placeholder="List the job requirements..."
                                />
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Responsibilities (One per line)</label>
                                <textarea 
                                    rows={4}
                                    value={currentJob?.responsibilities?.join('\n') || ''} 
                                    onChange={e => setCurrentJob({...currentJob, responsibilities: e.target.value.split('\n').filter(l => l.trim())})}
                                    className="w-full p-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-sm focus:border-[var(--brand-primary)] outline-none resize-none" 
                                    placeholder="List the key responsibilities..."
                                />
                            </div>
                        </form>

                        <div className="p-6 border-t border-[var(--glass-border)] bg-gray-50 flex justify-end gap-3">
                            <button 
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-6 py-2 rounded-xl text-sm font-bold text-[var(--text-muted)] hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                onClick={handleSave}
                                className="px-8 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all"
                            >
                                Save Posting
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CareerManagement;
