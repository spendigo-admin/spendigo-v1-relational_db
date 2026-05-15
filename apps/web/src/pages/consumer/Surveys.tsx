import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import SEO from '../../components/SEO';
import { useTranslation } from 'react-i18next';

interface SurveyQuestion {
    id: string;
    text: string;
    type: 'single_choice' | 'multiple_choice';
    options: string[];
}

interface Survey {
    id: string;
    title: string;
    description: string;
    status: 'active';
    questions: SurveyQuestion[];
    startDate: string;
    endDate: string;
}

const ConsumerSurveys: React.FC = () => {
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const { t } = useTranslation();
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [loading, setLoading] = useState(true);
    const [responses, setResponses] = useState<Record<string, Record<string, any>>>({}); // surveyId -> { questId -> answer }
    const [completedSurveys, setCompletedSurveys] = useState<string[]>([]); // List of survey IDs user has completed

    useEffect(() => {
        const fetchSurveys = async () => {
            setLoading(true);
            try {
                // Get active surveys
                const today = new Date().toISOString().split('T')[0];
                const q = query(
                    collection(db, 'surveys'),
                    where('status', '==', 'active'),
                    where('startDate', '<=', today)
                );

                const snapshot = await getDocs(q);
                let activeSurveys = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Survey));

                // Filter by endDate (client-side to avoid complex index for now)
                activeSurveys = activeSurveys.filter(s => !s.endDate || s.endDate >= today);

                setSurveys(activeSurveys);

                // Check which ones user has completed if logged in
                if (user) {
                    const completed = [];
                    for (const survey of activeSurveys) {
                        const respRef = doc(db, 'surveys', survey.id, 'responses', user.id);
                        const respSnap = await getDoc(respRef);
                        if (respSnap.exists()) {
                            completed.push(survey.id);
                        }
                    }
                    setCompletedSurveys(completed);
                }

            } catch (error) {
                console.error("Error loading surveys:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSurveys();
    }, [user]);

    const handleOptionSelect = (surveyId: string, questionId: string, option: string) => {
        setResponses(prev => ({
            ...prev,
            [surveyId]: {
                ...(prev[surveyId] || {}),
                [questionId]: option
            }
        }));
    };

    const handleSubmit = async (survey: Survey) => {
        if (!user) {
            addNotification({ type: 'alert', title: 'Login Required', message: 'Please sign in to participate.' });
            return;
        }

        const surveyResponses = responses[survey.id] || {};

        // Validation: All questions answered?
        if (Object.keys(surveyResponses).length < survey.questions.length) {
            addNotification({ type: 'alert', title: 'Incomplete', message: 'Please answer all questions.' });
            return;
        }

        try {
            await setDoc(doc(db, 'surveys', survey.id, 'responses', user.id), {
                answers: surveyResponses,
                submittedAt: new Date().toISOString(),
                userId: user.id,
                userEmail: user.email
            });

            setCompletedSurveys(prev => [...prev, survey.id]);

            addNotification({ type: 'system', title: 'Thank You!', message: 'Your feedback has been recorded.' });
        } catch (error) {
            console.error(error);
            addNotification({ type: 'alert', title: 'Error', message: 'Submission failed.' });
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-400">{t('surveysLoading')}</div>;

    if (surveys.length === 0) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
                <span className="text-6xl mb-4">📭</span>
                <h2 className="text-2xl font-bold text-[var(--text-main)]">{t('surveysNoActiveSurveys')}</h2>
                <p className="text-[var(--text-muted)]">{t('surveysNoActiveSurveysHint')}</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-6 pb-24 relative">
            <SEO title="Community Surveys" description="Share your feedback and help improve the Spendigo platform." path="/surveys" noIndex />
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] bg-clip-text text-transparent">
                    {t('surveysCommunityBoard')}
                </h1>
                <p className="text-[var(--text-muted)]">{t('surveysHelpImprove')}</p>
            </div>

            <div className="space-y-8">
                {surveys.map(survey => {
                    const isCompleted = completedSurveys.includes(survey.id);
                    return (
                        <div key={survey.id} className={`bg-white rounded-2xl border border-[var(--glass-border)] shadow-sm overflow-hidden transition-all ${isCompleted ? 'opacity-75 grayscale-[0.5]' : 'hover:shadow-lg'}`}>
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                                            {survey.title}
                                            {isCompleted && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{t('surveysCompleted')}</span>}
                                        </h2>
                                        {survey.description && <p className="text-sm text-[var(--text-muted)] mt-1">{survey.description}</p>}
                                    </div>
                                </div>
                            </div>

                            {!isCompleted ? (
                                <div className="p-6 bg-gray-50/50">
                                    <div className="space-y-6">
                                        {survey.questions.map((q, idx) => (
                                            <div key={q.id}>
                                                <p className="font-bold text-[var(--text-main)] mb-3">
                                                    <span className="text-[var(--brand-primary)] mr-2">{idx + 1}.</span>
                                                    {q.text}
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                                                    {q.options.map(opt => (
                                                        <button
                                                            key={opt}
                                                            onClick={() => handleOptionSelect(survey.id, q.id, opt)}
                                                            className={`text-left px-4 py-3 rounded-xl border transition-all ${responses[survey.id]?.[q.id] === opt
                                                                    ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-md transform scale-[1.02]'
                                                                    : 'bg-white border-gray-200 text-gray-600 hover:border-[var(--brand-primary)] hover:bg-blue-50'
                                                                }`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-8 flex justify-end">
                                        <button
                                            onClick={() => handleSubmit(survey)}
                                            className="btn-primary px-8 py-3 rounded-full text-lg shadow-lg shadow-blue-500/20"
                                        >
                                            {t('surveysSubmitFeedback')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-green-50">
                                    <span className="text-4xl mb-2 block">🎉</span>
                                    <h3 className="font-bold text-green-800">{t('surveysParticipationThanks')}</h3>
                                    <p className="text-sm text-green-700 mt-1">{t('surveysResponseRecorded')}</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ConsumerSurveys;
