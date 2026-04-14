import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, query, orderBy, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

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
    verifyIntegrity: () => Promise<boolean>;
    isVerified: boolean | null; // null = checking/unknown, true = valid, false = tampered
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

    // Sync logs from Firestore
    useEffect(() => {
        const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const fetchedLogs: AuditLog[] = [];
                snapshot.forEach((doc) => {
                    fetchedLogs.push({ id: doc.id, ...doc.data() } as AuditLog);
                });

                console.log(`[AuditContext] Synced ${fetchedLogs.length} logs.`);
                setLogs(fetchedLogs);
            },
            (error) => {
                console.error("[AuditContext] Snapshot error:", error);
            }
        );

        return () => unsubscribe();
    }, []);

    // Verify Integrity Chain
    const verifyIntegrity = async (): Promise<boolean> => {
        setIsVerified(null); // validating...
        if (logs.length === 0) return true;

        let isValid = true;

        // Find Genesis
        const genesis = logs.find(l => l.prevHash === GENESIS_HASH);
        if (!genesis) {
            // If no explicit genesis block with 000... hash, maybe we just verify the chain we have
            // But technically the first block MUST have GENESIS_HASH as prevHash
            // If we migrated and existing logs are there, we check from start.
        }

        let previousHash = GENESIS_HASH;

        for (const log of logs) {
            // 1. Check Linkage
            if (log.prevHash !== previousHash) {
                console.error(`Broken Chain at ${log.id}: prevHash mismatch. Expected ${previousHash}, got ${log.prevHash}`);
                isValid = false;
                break;
            }

            // 2. Check Data Integrity (Re-hash content using canonical key order)
            const contentToHash = { ...log, hash: undefined };

            const calculated = await sha256(canonicalize(contentToHash));

            if (calculated !== log.hash) {
                console.error(`Tampered Data at ${log.id}: hash mismatch`);
                isValid = false;
                break;
            }

            previousHash = log.hash;
        }

        setIsVerified(isValid);
        return isValid;
    };

    // Auto-verify on load if logs exist
    useEffect(() => {
        if (logs.length > 0) {
            verifyIntegrity();
        }
    }, [logs.length]);

    const logEvent = async (action: string, metadata: Record<string, any> = {}, resource: string = '') => {
        // Calculate Prev Hash
        const lastLog = logs[logs.length - 1];
        const prevHash = lastLog ? lastLog.hash : GENESIS_HASH;

        // Mock IP
        const ip = '192.168.1.' + Math.floor(Math.random() * 255);

        const newLogData = {
            timestamp: new Date().toISOString(),
            actor: {
                id: user?.id || 'anonymous', // Rules will reject 'anonymous' for writes
                email: user?.email || 'unauthenticated',
                ip: ip
            },
            action,
            resource,
            metadata,
            prevHash,
            hash: ''
        };

        const id = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const logEntry = { id, ...newLogData };
        const hash = await sha256(canonicalize({ ...logEntry, hash: undefined }));
        logEntry.hash = hash;

        // Write to Firestore
        // We use setDoc to preserve our generated ID, ensuring the hash matches the ID
        try {
            await setDoc(doc(db, 'audit_logs', id), logEntry);
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
        <AuditContext.Provider value={{ logs, logEvent, testLog, verifyIntegrity, isVerified }}>
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
