import { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export interface SmartInsightsPayload {
    items: { name: string; category: string; options: { storeName: string; price: number }[] }[];
    totalCost: number;
    storeCount: number;
    potentialSavings: number;
    missingCount: number;
}

export function useSmartInsights(payload: SmartInsightsPayload) {
    const [insights, setInsights] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const payloadKey = JSON.stringify(payload);

    useEffect(() => {
        if (payload.items.length === 0) {
            setInsights([]);
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const prompt = `You are a grocery shopping assistant. Given this basket summary, produce exactly 2–3 short insight lines (under 25 words each) about: savings opportunities, trip efficiency, or missing complementary items. Be concise and friendly. Reply ONLY as a JSON array of strings — no markdown, no extra text.

Basket: ${JSON.stringify(payload)}`;

                const result = await model.generateContent(prompt);
                const text = result.response.text().trim();

                const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
                const parsed: string[] = JSON.parse(cleaned);
                if (Array.isArray(parsed)) {
                    setInsights(parsed.filter(s => typeof s === 'string'));
                }
            } catch (err) {
                console.error('[SmartInsights] Gemini call failed:', err);
                setInsights([]);
            } finally {
                setLoading(false);
            }
        }, 1500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [payloadKey]);

    return { insights, loading };
}
