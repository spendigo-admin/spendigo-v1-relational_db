/**
 * Security and Compliance Utilities
 * Handles PII redaction and timezone formatting per SOC2/GDPR standards.
 */

/**
 * Redacts PII from a string (Email, IP, Name, etc.)
 */
export const redactString = (str: string): string => {
    if (!str) return str;

    // Email Redaction: f***@example.com
    if (str.includes('@')) {
        const [user, domain] = str.split('@');
        if (user.length <= 2) return `${user}***@${domain}`;
        return `${user.charAt(0)}***${user.charAt(user.length - 1)}@${domain}`;
    }

    // IP Redaction: 192.168.1.***
    const ipRegex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}$/;
    if (ipRegex.test(str)) {
        return str.replace(ipRegex, '$1***');
    }

    // Potential Name Redaction (if it looks like a full name, keep first initial)
    if (str.includes(' ') && str.length > 5) {
        const parts = str.split(' ');
        return `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`;
    }

    return str;
};

/**
 * Recursively redacts PII from an object or array
 */
export const redactPII = (data: any): any => {
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') {
        return redactString(data);
    }

    if (Array.isArray(data)) {
        return data.map(redactPII);
    }

    if (typeof data === 'object') {
        const redacted: any = {};
        const piiKeys = ['email', 'phone', 'ip', 'address', 'fullName', 'lastName', 'firstName', 'ssn', 'taxId'];
        
        for (const [key, value] of Object.entries(data)) {
            if (piiKeys.some(piiKey => key.toLowerCase().includes(piiKey.toLowerCase()))) {
                redacted[key] = typeof value === 'string' ? redactString(value) : '[REDACTED]';
            } else {
                redacted[key] = redactPII(value);
            }
        }
        return redacted;
    }

    return data;
};

/**
 * Formats a date string to EST (America/New_York)
 */
export const formatToEST = (dateStr: string | Date): string => {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date).replace(',', '');
};

/**
 * Checks if a timestamp is within the last N minutes
 */
export const isWithinMinutes = (timestamp: string, minutes: number): boolean => {
    const logTime = new Date(timestamp).getTime();
    const now = new Date().getTime();
    return (now - logTime) <= minutes * 60 * 1000;
};
