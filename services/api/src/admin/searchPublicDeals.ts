import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// In-memory cache for the Cloud Function instance
// This persists across invocations as long as the instance stays warm, saving Firestore reads
let cachedDeals: any[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour TTL

export const searchPublicDeals = functions.https.onCall(async (data, _context) => {
    const db = admin.firestore();
    const now = Date.now();
    
    // Refresh cache if it's empty or TTL has expired
    if (!cachedDeals.length || (now - lastFetchTime) > CACHE_TTL_MS) {
        try {
            const flyersSnapshot = await db.collection('public_flyers').get();
            const allDeals: any[] = [];
            
            // Note: This reads all flyer deals, but only ONCE per instance lifecycle.
            for (const flyerDoc of flyersSnapshot.docs) {
                const dealsSnapshot = await db.collection('public_flyers').doc(flyerDoc.id).collection('deals').get();
                dealsSnapshot.forEach(doc => {
                    allDeals.push({ ...doc.data(), flyerId: flyerDoc.id });
                });
            }
            
            cachedDeals = allDeals;
            lastFetchTime = now;
            functions.logger.info(`Refreshed public deals cache. Loaded ${cachedDeals.length} deals.`);
        } catch (error) {
            functions.logger.error('Error refreshing deals cache:', error);
            throw new functions.https.HttpsError('internal', 'Failed to fetch public deals');
        }
    }
    
    const { searchTerm, filters, listTerms } = data;
    
    const lowerSearch = (searchTerm || '').toLowerCase().trim();
    const activeFilters = filters || [];
    const activeListTerms = (listTerms || []).map((t: string) => t.toLowerCase().trim());
    
    const filteredDeals = cachedDeals.filter(deal => {
        const lowerName = (deal.name || '').toLowerCase();
        
        // Exact substring match for the search term
        const matchesSearch = lowerSearch === '' || lowerName.includes(lowerSearch);
        
        // At least one category filter must match if any are active
        const matchesCategories = activeFilters.length === 0 || activeFilters.some((f: string) => lowerName.includes(f.toLowerCase()));
        
        // List terms matching (Wishlist support)
        let matchesList = activeListTerms.length === 0;
        if (activeListTerms.length > 0) {
            matchesList = activeListTerms.some((term: string) => {
                // If the term is long, we split it to find meaningful overlap, or do a direct includes
                // e.g. "Seedless Cucumbers" -> matches "Cucumbers"
                return lowerName.includes(term) || term.includes(lowerName) || 
                       term.split(' ').some(word => word.length > 3 && lowerName.includes(word));
            });
        }
        
        return matchesSearch && matchesCategories && matchesList;
    });

    // Return up to 3000 results to support showing all comparisons on load
    const maxResults = 3000;
    
    return { 
        deals: filteredDeals.slice(0, maxResults),
        totalCached: cachedDeals.length,
        returnedCount: Math.min(filteredDeals.length, maxResults)
    };
});
