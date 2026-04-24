import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, query, orderBy, onSnapshot, doc, runTransaction, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { auditBridge } from '../utils/auditBridge';

// Standardized Log Entry
export interface AuditLog {
    id: string;
    timestamp: string;
    actor: {
        id: string;
        email: string; // Redacted in UI, kept here for record
        ip: string;
    };
    action: string; // e.g., 'AUTH_LOGIN', 'STORE_APPROVE'
    resource?: string;
    metadata?: Record<string, any>;
    prevHash: string; // The hash of the previous log
    hash: string; // The hash of this log (including prevHash)
}

interface AuditContextType {
    logs: AuditLog[];
    logEvent: (action: string, metadata?: Record<string, any>, resource?: string) => Promise<void>;
    testLog: () => Promise<void>;
    verifyIntegrity: () => Promise<{ isValid: boolean; breakAt?: string }>;
    isVerified: boolean | null;
    errorLogId: string | null;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

// Canonicalize an object to a deterministic JSON string (sorted keys, recursive)
const canonicalize = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
    const sorted = Object.keys(value as Record<string, unknown>).sort();
    return '{' + sorted.map(k => JSON.stringify(k) + ':' + canonicalize((value as Record<string, unknown>)[k])).join(',') + '}';
};


export const sha256 = async (message: string): Promise<string> => {
    try {
        if (window.crypto && window.crypto.subtle) {
            const msgBuffer = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
        throw new Error('Crypto API unavailable');
    } catch (e) {
        // Fallback for non-secure contexts (development only)
        console.warn('Using insecure fallback hashing (Crypto API unavailable)');
        let h = 0xdeadbeef;
        for (let i = 0; i < message.length; i++) {
            h = Math.imul(h ^ message.charCodeAt(i), 2654435761);
        }
        return ((h ^ h >>> 16) >>> 0).toString(16).padStart(64, '0');
    }
};

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';


export const AuditProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isVerified, setIsVerified] = useState<boolean | null>(null);
    const [errorLogId, setErrorLogId] = useState<string | null>(null);

    // Sync logs and Listen to Global Bridge
    useEffect(() => {
        const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'asc'));

        const unsubscribeLogs = onSnapshot(q, 
            (snapshot) => {
                const fetchedLogs: AuditLog[] = [];
                snapshot.forEach((doc) => {
                    fetchedLogs.push({ id: doc.id, ...doc.data() } as AuditLog);
                });
                setLogs(fetchedLogs);
            }
        );

        // Listen for system-wide events (e.g. from AuthContext)
        const unsubscribeBridge = auditBridge.subscribe((params) => {
            console.log(`[AuditBridge] Received event: ${params.action}`, params.metadata);
            logEvent(params.action, params.metadata, params.resource);
        });

        return () => {
            unsubscribeLogs();
            unsubscribeBridge();
        };
    }, [user?.id]); // Re-subscribe if user changes

    // Verify Integrity Chain
    const verifyIntegrity = async (): Promise<{ isValid: boolean; breakAt?: string }> => {
        setIsVerified(null); // validating...
        setErrorLogId(null);

        if (logs.length === 0) {
            setIsVerified(true);
            return { isValid: true };
        }

        let isValid = true;
        let breakAtId: string | undefined;
        let previousHash = GENESIS_HASH;

        // Note: logs are ordered by timestamp asc from firestore query
        for (const log of logs) {
            // 1. Check Linkage
            if (log.prevHash !== previousHash) {
                console.error(`Broken Chain at ${log.id}: prevHash mismatch. Expected ${previousHash}, got ${log.prevHash}`);
                isValid = false;
                breakAtId = log.id;
                break;
            }

            // 2. Check Data Integrity (Re-hash content)
            const contentToHash = { ...log, hash: undefined };
            const calculated = await sha256(canonicalize(contentToHash));

            if (calculated !== log.hash) {
                console.error(`Tampered Data at ${log.id}: hash mismatch`);
                isValid = false;
                breakAtId = log.id;
                break;
            }

            previousHash = log.hash;
        }

        setIsVerified(isValid);
        if (!isValid) setErrorLogId(breakAtId || 'unknown');
        return { isValid, breakAt: breakAtId };
    };

    // Auto-verify on load if logs exist
    useEffect(() => {
        if (logs.length > 0) {
            verifyIntegrity();
        }
    }, [logs.length]);

    const logEvent = async (action: string, metadata: Record<string, any> = {}, resource: string = '') => {
        const id = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        try {
            // 1. Get the very last log to find the prevHash
            // Note: Transactions don't support queries in Web SDK. 
            // For 100% forensic accuracy, this should be a Cloud Function.
            // For now, we fetch the last log manually.
            const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(1));
            const lastLogSnapshot = await getDocs(q);
            
            let prevHash = GENESIS_HASH;
            if (!lastLogSnapshot.empty) {
                prevHash = lastLogSnapshot.docs[0].data().hash;
            }

            const logEntry: any = {
                id,
                timestamp: new Date().toISOString(),
                actor: {
                    id: user?.id || 'anonymous',
                    email: user?.email || 'unauthenticated',
                    ip: 'redacted' // IP capture usually happens server-side
                },
                action,
                resource,
                metadata,
                prevHash,
                hash: ''
            };

            const hash = await sha256(canonicalize({ ...logEntry, hash: undefined }));
            logEntry.hash = hash;

            // Simple set is more reliable for client-side linkage than a failing transaction
            await runTransaction(db, async (transaction) => {
                const logRef = doc(db, 'audit_logs', id);
                transaction.set(logRef, logEntry);
            });
            
            console.log(`[AuditContext] Logged event: ${action} (${id})`);
        } catch (e) {
            console.error("Failed to write audit log", e);
        }
    };

    const testLog = async () => {
        await logEvent('SYSTEM_TEST_EVENT', { 
            note: 'This is a manual integrity test event.',
            environment: window.location.hostname
        });
    };

    return (
        <AuditContext.Provider value={{ logs, logEvent, testLog, verifyIntegrity, isVerified, errorLogId }}>
            {children}
        </AuditContext.Provider>
    );
};

export const useAudit = () => {
    const context = useContext(AuditContext);
    if (context === undefined) {
        throw new Error('useAudit must be used within an AuditProvider');
    }
    return context;
};
