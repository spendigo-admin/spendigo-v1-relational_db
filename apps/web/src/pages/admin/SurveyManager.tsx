import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getCountFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';

interface SurveyQuestion {
    id: string;
    text: string;
    type: 'single_choice' | 'multiple_choice';
    options: string[];
}

interface Survey {
    id?: string;
    title: string;
    description: string;
    status: 'active' | 'draft' | 'closed';
    questions: SurveyQuestion[];
    startDate: string;
    endDate: string;
    createdAt?: any;
    responseCount?: number;
}

const AdminSurveyManager: React.FC = () => {
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSurvey, setEditingSurvey] = useState<Partial<Survey>>({});

    // Fetch surveys
    const fetchSurveys = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'surveys'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const surveyList = await Promise.all(snapshot.docs.map(async (docSnap) => {
                // Get response count
                const respColl = collection(db, 'surveys', docSnap.id, 'responses');
                const countSnap = await getCountFromServer(respColl);

                return {
                    id: docSnap.id,
                    ...docSnap.data(),
                    responseCount: countSnap.data().count
                } as Survey;
            }));
            setSurveys(surveyList);
        } catch (error) {
            console.error("Error fetching surveys:", error);
            addNotification({ type: 'alert', title: 'Error', message: 'Failed to load surveys.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSurveys();
    }, []);

    const handleSave = async () => {
        if (!editingSurvey.title || !editingSurvey.questions || editingSurvey.questions.length === 0) {
            addNotification({ type: 'alert', title: 'Validation Error', message: 'Please add a title and at least one question.' });
            return;
        }

        try {
            const surveyData = {
                title: editingSurvey.title,
                description: editingSurvey.description || '',
                status: editingSurvey.status || 'draft',
                questions: editingSurvey.questions,
                startDate: editingSurvey.startDate || new Date().toISOString().split('T')[0],
                endDate: editingSurvey.endDate || '',
                updatedAt: serverTimestamp()
            };

            if (editingSurvey.id) {
                await updateDoc(doc(db, 'surveys', editingSurvey.id), surveyData);
                addNotification({ type: 'system', title: 'Survey Updated', message: 'Survey saved successfully.' });
            } else {
                await addDoc(collection(db, 'surveys'), {
                    ...surveyData,
                    createdAt: serverTimestamp()
                });
                addNotification({ type: 'system', title: 'Survey Created', message: 'New survey created.' });
            }
            setShowModal(false);
            setEditingSurvey({});
            fetchSurveys();
        } catch (error) {
            console.error("Error saving survey:", error);
            addNotification({ type: 'alert', title: 'Error', message: 'Failed to save survey.' });
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: 'Delete Survey?',
            message: 'This will permanently delete the survey and all responses.',
            confirmText: 'Delete',
            type: 'danger'
        });

        if (confirmed) {
            try {
                await deleteDoc(doc(db, 'surveys', id));
                addNotification({ type: 'system', title: 'Deleted', message: 'Survey deleted.' });
                fetchSurveys();
            } catch (error) {
                addNotification({ type: 'alert', title: 'Error', message: 'Failed to delete survey.' });
            }
        }
    };

    // Helper to manage questions in modal
    const addQuestion = () => {
        const currentQuestions = editingSurvey.questions || [];
        setEditingSurvey({
            ...editingSurvey,
            questions: [
                ...currentQuestions,
                { id: Date.now().toString(), text: '', type: 'single_choice', options: ['Yes', 'No'] }
            ]
        });
    };

    const updateQuestion = (idx: number, field: string, value: any) => {
        const currentQuestions = [...(editingSurvey.questions || [])];
        currentQuestions[idx] = { ...currentQuestions[idx], [field]: value };
        setEditingSurvey({ ...editingSurvey, questions: currentQuestions });
    };

    const removeQuestion = (idx: number) => {
        const currentQuestions = [...(editingSurvey.questions || [])];
        currentQuestions.splice(idx, 1);
        setEditingSurvey({ ...editingSurvey, questions: currentQuestions });
    };

    return (
        <div className="p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Survey Board</h1>
                    <p className="text-[var(--text-muted)]">Manage polls and surveys for user feedback.</p>
                </div>
                <button
                    onClick={() => { setEditingSurvey({ status: 'draft', questions: [] }); setShowModal(true); }}
                    className="btn-primary flex items-center gap-2"
                >
                    <span>➕</span> New Survey
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading surveys...</div>
            ) : surveys.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-[var(--glass-border)]">
                    <p className="text-gray-400 mb-4 text-5xl">📋</p>
                    <p className="text-gray-500">No surveys found. Create one to get started.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {surveys.map(survey => (
                        <div key={survey.id} className="bg-white p-4 rounded-xl border border-[var(--glass-border)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full uppercase ${survey.status === 'active' ? 'bg-green-100 text-green-700' :
                                        survey.status === 'closed' ? 'bg-gray-100 text-gray-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {survey.status}
                                    </span>
                                    {survey.endDate && <span className="text-xs text-gray-400">Ends: {survey.endDate}</span>}
                                </div>
                                <h3 className="font-bold text-lg text-[var(--text-main)]">{survey.title}</h3>
                                <p className="text-sm text-[var(--text-muted)] mt-1">{survey.questions.length} Question(s) • {survey.responseCount} Responses</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { setEditingSurvey(survey); setShowModal(true); }}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => handleDelete(survey.id!)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                        <div className="p-6 border-b border-[var(--glass-border)] sticky top-0 bg-white z-10 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingSurvey.id ? 'Edit Survey' : 'New Survey'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Title</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        value={editingSurvey.title || ''}
                                        onChange={e => setEditingSurvey({ ...editingSurvey, title: e.target.value })}
                                        placeholder="e.g. Weekly Feedback"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                                    <textarea
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        value={editingSurvey.description || ''}
                                        onChange={e => setEditingSurvey({ ...editingSurvey, description: e.target.value })}
                                        placeholder="Optional instructions..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        value={editingSurvey.startDate || ''}
                                        onChange={e => setEditingSurvey({ ...editingSurvey, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        value={editingSurvey.endDate || ''}
                                        onChange={e => setEditingSurvey({ ...editingSurvey, endDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        value={editingSurvey.status || 'draft'}
                                        onChange={e => setEditingSurvey({ ...editingSurvey, status: e.target.value as any })}
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="active">Active</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                </div>
                            </div>

                            <div className="border-t border-gray-200 pt-4 mt-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-lg">Questions</h3>
                                    <button onClick={addQuestion} className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-lg font-bold hover:bg-blue-100">+ Add Question</button>
                                </div>

                                <div className="space-y-6">
                                    {editingSurvey.questions?.map((q, idx) => (
                                        <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative">
                                            <button
                                                onClick={() => removeQuestion(idx)}
                                                className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                                            >✕</button>

                                            <div className="mb-3">
                                                <input
                                                    type="text"
                                                    className="w-full p-2 border border-gray-300 rounded-lg font-bold"
                                                    placeholder="Question Text"
                                                    value={q.text}
                                                    onChange={e => updateQuestion(idx, 'text', e.target.value)}
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label className="text-xs uppercase font-bold text-gray-500">Answer Options (Comma separated)</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                                    placeholder="Yes, No, Maybe"
                                                    value={q.options.join(', ')}
                                                    onChange={e => updateQuestion(idx, 'options', e.target.value.split(',').map(s => s.trim()))}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-[var(--glass-border)] bg-gray-50 rounded-b-2xl flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-200 rounded-lg">Cancel</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg hover:brightness-110">Save Survey</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSurveyManager;
