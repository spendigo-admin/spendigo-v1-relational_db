"import { describe, it, expect } from 'vitest';
import {
    levenshteinDistance,
    calculateSimilarity,
    tokenizeProduct,
    performFuzzySearch
} from '../../apps/web/src/utils/fuzzy-search';

describe('Levenshtein Distance', () => {
    it('returns 0 for identical strings', () => {
        expect(levenshteinDistance('milk', 'milk')).toBe(0);
        expect(levenshteinDistance('Bread', 'bread')).toBe(1); // case difference
    });

    it('returns correct distance for single character change', () => {
        expect(levenshteinDistance('milk', 'milks')).toBe(1);
        expect(levenshteinDistance('milk', 'milk2')).toBe(1);
        expect(levenshteinDistance('apple', 'apples')).toBe(1);
    });

    it('handles completely different strings', () => {
        const distance = levenshteinDistance('apple', 'banana');
        expect(distance).toBeGreaterThan(3);
    });

    it('handles empty strings correctly', () => {
        expect(levenshteinDistance('', 'test')).toBe(4);
        expect(levenshteinDistance('test', '')).toBe(4);
        expect(levenshteinDistance('', '')).toBe(0);
    });
});

describe('Similarity Calculation', () => {
    it('returns 1.0 for identical strings', () => {
        expect(calculateSimilarity('milk', 'milk')).toBeCloseTo(1, 3);
    });

    it('returns low similarity for different products', () => {
        const similarity = calculateSimilarity('bread', 'cheese');
        expect(similarity).toBeLessThan(0.5);
    });

    it('returns high similarity for similar strings', () => {
        const similarity = calculateSimilarity('milk', 'milks');
        expect(similarity).toBeGreaterThan(0.8);
    });
});

describe('Tokenization', () => {
    it('splits product names into tokens', () => {
        const tokens = tokenizeProduct('Kraft Dinner Macaroni');
        expect(tokens).toEqual(['kraft', 'dinner', 'macaroni']);
    });

    it('normalizes numbers and special characters', () => {
        const tokens = tokenizeProduct('2% Milk - 1L');
        expect(tokens).toContain('2');
        expect(tokens).toContain('milk');
        expect(tokens).not.toContain('-');
        expect(tokens).not.toContain('1');
    });
});

describe('Fuzzy Search Scoring', () => {
    const mockCandidates = [
        { id: '1', name: 'Kraft Dinner Macaroni & Cheese', brand: 'Kraft', category: 'Pantry' },
        { id: '2', name: 'Dairyland 2% Milk', brand: 'Dairyland', category: 'Dairy' },
        { id: '3', name: 'Sara Lee Bread', brand: 'Sara Lee', category: 'Bakery' },
        { id: '4', name: 'Cheez-It Crackers', brand: 'Cheez-It', category: 'Snacks' },
        { id: '5', name: 'Organic Brown Rice', brand: 'Lundberg', category: 'Pantry' },
    ];

    it('returns exact match with 100 score', () => {
        const results = performFuzzySearch('Dairyland 2% Milk', mockCandidates);
        const milkMatch = results.find(r => r.productId === '2');
        expect(milkMatch).toBeDefined();
        expect(milkMatch?.confidenceScore).toBe(100);
        expect(milkMatch?.matchType).toBe('exact');
    });

    it('handles partial keyword matches', () => {
        const results = performFuzzySearch('Kraft Dinner', mockCandidates);
        expect(results.length).toBeGreaterThan(0);
        
        // Should find Kraft Dinner with high score
        const kraftMatch = results.find(r => r.productId === '1');
        expect(kraftMatch?.confidenceScore).toBeGreaterThanOrEqual(85);
    });

    it('handles typos gracefully', () => {
        // User types "mil" instead of "milk"
        const results = performFuzzySearch('mil', mockCandidates);
        const milkMatch = results.find(r => r.productId === '2');
        
        expect(milkMatch).toBeDefined();
        expect(milkMatch?.confidenceScore).toBeGreaterThanOrEqual(60); // Should still match
    });

    it('ranks results by confidence score', () => {
        const results = performFuzzySearch('bread', mockCandidates);
        
        // First result should have highest score
        expect(results[0].confidenceScore).toBeGreaterThanOrEqual(
            results[results.length - 1].confidenceScore
        );
    });

    it('handles brand-specific searches', () => {
        const results = performFuzzySearch('Kraft', mockCandidates);
        
        expect(results.some(r => r.brand === 'Kraft')).toBe(true);
        const kraftMatch = results.find(r => r.productId === '1');
        expect(kraftMatch?.confidenceScore).toBeGreaterThanOrEqual(85); // Brand boost
    });
});

describe('Fuzzy Search Edge Cases', () => {
    it('returns empty array for no matches', () => {
        const results = performFuzzySearch('xyz123nonexistent', mockCandidates);
        expect(results.length).toBe(0);
    });

    it('handles very short queries', () => {
        const results = performFuzzySearch('a', mockCandidates);
        // Should still return some fuzzy matches
        expect(results.length).toBeGreaterThan(0);
    });

    it('is case-insensitive', () => {
        const results1 = performFuzzySearch('MILK', mockCandidates);
        const results2 = performFuzzySearch('milk', mockCandidates);
        
        expect(results1.length).toBe(results2.length);
    });
});