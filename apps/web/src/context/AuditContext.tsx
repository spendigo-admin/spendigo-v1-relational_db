import React, { createContext, useContext, useState, useEffect, useLayoutEffect, ReactNode, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, doc, runTransaction, limit, getDocs } from 'firebase/firestore';
import { db, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
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
    verifyIntegrity: () => Promise<{ isValid: boolean; breakAt?: string; isPartialChain?: boolean }>;
    isVerified: boolean | null;
    isPartialChain: boolean;
    errorLogId: string | null;
    logIntegrityMap: Map<string, { hashValid: boolean; chainValid: boolean }>;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

// Canonicalize an object to a deterministic JSON string (sorted keys, recursive, excludes 'hash')
const canonicalize = (val: any): string => {
    if (val === null || val === undefined) return 'null';
    if (typeof val !== 'object') return JSON.stringify(val);
    if (Array.isArray(val)) return '[' + val.map(canonicalize).join(',') + ']';
    
    // Sort keys and explicitly exclude the 'hash' field which is being calculated
    const sortedKeys = Object.keys(val)
        .filter(k => k !== 'hash' && val[k] !== undefined)
        .sort();
        
    return '{' + sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalize(val[k])}`).join(',') + '}';
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
    const [isPartialChain, setIsPartialChain] = useState<boolean>(false);
    const [logIntegrityMap, setLogIntegrityMap] = useState<Map<string, { hashValid: boolean; chainValid: boolean }>>(new Map());

    // 1. Snapshot Listener: Sync logs (Admin Only)
    useEffect(() => {
        if (!user || (user.role !== 'admin' && !user.adminRole)) {
            console.log('[AuditContext] User is not an admin, skipping sync.', user?.id, user?.role, user?.adminRole);
            setLogs([]);
            return;
        }

        console.log('[AuditContext] Starting admin audit log sync...');
        const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'asc'));

        const unsubscribeLogs = onSnapshot(q, 
            (snapshot) => {
                console.log(`[AuditContext] Received ${snapshot.size} logs from Firestore`);
                const fetchedLogs: AuditLog[] = [];
                snapshot.forEach((doc) => {
                    fetchedLogs.push({ id: doc.id, ...doc.data() } as AuditLog);
                });
                setLogs(fetchedLogs);
            },
            (error) => {
                console.error('[AuditContext] Snapshot error (Permission Denied?):', error);
            }
        );

        return () => unsubscribeLogs();
    }, [user?.id, user?.role]);

    // 2. Bridge Listener: Record system-wide events (Active from app load)
    // useLayoutEffect fires before any useEffect in the tree, guaranteeing the bridge
    // subscription is registered before AuthContext's useEffect emits its first auth event.
    useLayoutEffect(() => {
        console.log('[AuditContext] Initializing forensic event capture bridge...');
        const unsubscribeBridge = auditBridge.subscribe((params) => {
            console.log(`[AuditBridge] Capture: ${params.action}`, params.metadata);
            return logEvent(params.action, params.metadata, params.resource);
        });

        return () => unsubscribeBridge();
    }, []); // Run once on mount to ensure early events (like login) are caught

    // Verify Integrity Chain
    const verifyIntegrity = async (): Promise<{ isValid: boolean; breakAt?: string; isPartialChain?: boolean }> => {
        setIsVerified(null); // validating...
        setErrorLogId(null);

        if (logs.length === 0) {
            setIsVerified(true);
            setIsPartialChain(false);
            setLogIntegrityMap(new Map());
            return { isValid: true };
        }

        let isValid = true;
        let breakAtId: string | undefined;
        const map = new Map<string, { hashValid: boolean; chainValid: boolean }>();

        // Verify relative linkage among the fetched logs only.
        // We cannot guarantee the chain starts at genesis unless we have every log ever written
        // (e.g. older logs outside the current window). Starting from logs[0].prevHash means the
        // first log always passes the linkage check; subsequent logs must each reference the
        // exact hash of the entry before them. Any tampering in the visible window still breaks.
        const startsFromGenesis = logs[0].prevHash === GENESIS_HASH;
        let previousHash = logs[0].prevHash;

        // Note: logs are ordered by timestamp asc from firestore query
        for (const log of logs) {
            // 1. Check Linkage
            const chainValid = log.prevHash === previousHash;
            if (!chainValid && !breakAtId) {
                console.error(`Broken Chain at ${log.id}: prevHash mismatch. Expected ${previousHash}, got ${log.prevHash}`);
                breakAtId = log.id;
                isValid = false;
            }

            // 2. Check Data Integrity (Re-hash content)
            const calculated = await sha256(canonicalize(log));
            const hashValid = calculated === log.hash;
            if (!hashValid && !breakAtId) {
                console.error(`Tampered Data at ${log.id}: hash mismatch`);
                breakAtId = log.id;
                isValid = false;
            }

            map.set(log.id, { hashValid, chainValid });

            // Advance using the stored hash so subsequent chain checks reflect actual Firestore state
            previousHash = log.hash;
        }

        setIsVerified(isValid);
        setIsPartialChain(!startsFromGenesis);
        setLogIntegrityMap(map);
        if (!isValid) setErrorLogId(breakAtId || 'unknown');
        return { isValid, breakAt: breakAtId, isPartialChain: !startsFromGenesis };
    };

    // Auto-verify on load if logs exist
    useEffect(() => {
        if (logs.length > 0) {
            verifyIntegrity();
        }
    }, [logs.length]);
    const logEvent = useCallback(async (action: string, metadata: Record<string, any> = {}, resource: string = '') => {
        try {
            console.log(`[AuditContext] Requesting server-side log for: ${action}`);
            
            const recordAuditEvent = httpsCallable(functions, 'recordAuditEvent');
            const result = await recordAuditEvent({
                action,
                metadata,
                resource
            });
            
            console.log(`[AuditContext] Server-side log successful: ${action}`, result.data);
        } catch (e: any) {
            console.error(`[AuditContext] Failed to record audit event [${action}]:`, e.message, e.details);
        }
    }, []); // functions is a stable module-level import — no dep needed

    const testLog = async () => {
        await logEvent('SYSTEM_TEST_EVENT', { 
            note: 'This is a manual integrity test event.',
            environment: window.location.hostname
        });
    };

    return (
        <AuditContext.Provider value={{ logs, logEvent, testLog, verifyIntegrity, isVerified, isPartialChain, errorLogId, logIntegrityMap }}>
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
