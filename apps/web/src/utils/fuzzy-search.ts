/**
 * Advanced Fuzzy Matching Engine for Spendigo SmartCart
 * Implements Levenshtein distance + semantic scoring
 */

export interface SearchResult {
    productId: string;
    productName: string;
    brand?: string;
    category?: string;
    confidenceScore: number; // 0-100
    matchType: 'exact' | 'partial' | 'fuzzy' | 'typo';
}

/**
 * Calculate Levenshtein Edit Distance between two strings
 * Returns the minimum number of single-character edits needed
 */
export function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize matrix dimensions
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    // Fill the matrix
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity ratio (0-1) based on edit distance
 */
export function calculateSimilarity(str1: string, str2: string): number {
    const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
}

/**
 * Tokenize product name into meaningful components
 */
export function tokenizeProduct(name: string): string[] {
    // Split by common delimiters but preserve brand names
    const tokens = name
        .toLowerCase()
        .replace(/[\d.-]/g, ' ') // Normalize numbers/dots
        .split(/\s+/)
        .filter(token => token.length > 0);

    return tokens;
}

/**
 * Main fuzzy search function with confidence scoring
 */
export function performFuzzySearch(
    query: string,
    candidates: Array<{ id: string; name: string; brand?: string; category?: string }>,
    options?: {
        maxEditDistance?: number;      // Default: 3
        minSimilarityRatio?: number;   // Default: 0.65
        boostBrandMatch?: boolean;     // Default: true
    }
): SearchResult[] {
    const defaultOptions = {
        maxEditDistance: 3,
        minSimilarityRatio: 0.65,
        boostBrandMatch: true
    };

    const config = { ...defaultOptions, ...options };
    const queryTokens = tokenizeProduct(query);
    const results: SearchResult[] = [];

    for (const candidate of candidates) {
        let score = 0;
        let matchType: SearchResult['matchType'] = 'fuzzy';

        const nameLower = candidate.name.toLowerCase();
        const brandLower = candidate.brand?.toLowerCase() || '';
        const queryLower = query.toLowerCase();

        // Check for exact match (100 points)
        if (nameLower === queryLower) {
            score = 100;
            matchType = 'exact';
        }
        // Check brand + keyword match (85 points boost)
        else if (config.boostBrandMatch && brandLower.includes(queryLower)) {
            score = 85;
            matchType = 'partial';
        }
        // Check token overlap (70 points)
        else {
            const candidateTokens = tokenizeProduct(nameLower);
            const matchCount = queryTokens.filter(q =>
                candidateTokens.some(c => c.includes(q) || q.includes(c))
            ).length;

            if (matchCount >= Math.ceil(queryTokens.length * 0.5)) {
                score = 70 + (matchCount / queryTokens.length) * 20; // 70-90 range
                matchType = 'partial';
            } else {
                // Fuzzy matching with Levenshtein (40-65 points based on similarity)
                const similarity = calculateSimilarity(queryLower, nameLower);

                if (similarity >= config.minSimilarityRatio) {
                    score = 40 + (similarity * 25); // Scale to 40-65 range
                    matchType = 'fuzzy';

                    // Bonus for typo detection (short queries with high similarity)
                    if (queryLower.length < 10 && similarity > 0.85) {
                        score += 10;
                        matchType = 'typo';
                    }
                }
            }
        }

        // Apply brand boost if configured
        if (config.boostBrandMatch && candidate.brand && nameLower.includes(brandLower)) {
            score = Math.min(score + 5, 100); // Cap at 100
        }

        results.push({
            productId: candidate.id,
            productName: candidate.name,
            brand: candidate.brand,
            category: candidate.category,
            confidenceScore: Math.floor(score),
            matchType
        });
    }

    // Sort by confidence score descending
    return results.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

/**
 * Batch search with caching for repeated queries
 */
const searchCache = new Map<string, SearchResult[]>();
const CACHE_TTL_MS = 60000; // 1 minute cache

export function performCachedSearch(
    query: string,
    candidates: Array<{ id: string; name: string; brand?: string; category?: string }>
): SearchResult[] {
    const cacheKey = `${query}_${candidates.length}`;

    const cached = searchCache.get(cacheKey);
    if (cached) return cached;

    const results = performFuzzySearch(query, candidates);
    searchCache.set(cacheKey, results);

    // Clean old cache entries periodically
    setTimeout(() => {
        searchCache.delete(cacheKey);
    }, CACHE_TTL_MS);

    return results;
}