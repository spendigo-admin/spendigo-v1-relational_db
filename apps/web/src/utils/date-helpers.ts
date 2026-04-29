/**
 * Centralized date helpers for consistent flyer and deal expiration logic.
 */

/**
 * Checks if a date-only string (like "2026-04-03" or "Mar 24, 2026") or ISO string has passed.
 * Sets to end of day (23:59:59.999) if no time is specified.
 */
export const isDateActive = (dateString: string | Date | null | undefined): boolean => {
  if (!dateString) return false;
  
  try {
    const end = new Date(dateString);
    if (isNaN(end.getTime())) return false;

    const now = new Date();
    
    // If it's a string and doesn't contain a time portion (no colon), assume end of day
    if (typeof dateString === 'string' && dateString.indexOf(':') === -1) {
      end.setHours(23, 59, 59, 999);
    }
    
    return end >= now;
  } catch (e) {
    return false;
  }
};

/**
 * Checks if a flyer object is currently active.
 */
export const isFlyerActive = (flyer: any): boolean => {
  if (!flyer || !flyer.title) return false;
  
  // 1. Check status if present
  if (flyer.status && flyer.status !== 'active') return false;

  // 2. Check expiry
  if (!flyer.validUntil) return false; // Strict: Active promos must have an end date
  return isDateActive(flyer.validUntil);
};

/**
 * Filters an array of deals (one-day offers or sale items) to only include non-expired and active ones.
 */
export const filterActiveDeals = (deals: any[]): any[] => {
  if (!Array.isArray(deals)) return [];
  return deals.filter(deal => {
    if (!deal) return false;
    
    // 1. Check status if present
    if (deal.status && deal.status !== 'active') return false;

    // 2. Check expiry
    const expiry = deal.validUntil || deal.endDate || deal.expiryDate;
    
    if (!expiry) return false; // Strict: Active deals must have an expiry date
    
    return isDateActive(expiry);
  });
};

/**
 * Formats a timestamp for notification display.
 * Shows time if today, otherwise shows date.
 */
export const formatNotificationTime = (timestamp: string | number | Date): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  
  const isToday = date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // If not today, show date (e.g. "Oct 24")
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
