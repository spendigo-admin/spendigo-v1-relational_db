import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
    verifyIntegrity: () => Promise<boolean>;
    isVerified: boolean | null; // null = checking/unknown, true = valid, false = tampered
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

// Simple SHA-256 Helper with Fallback
const sha256 = async (message: string): Promise<string> => {
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
const LOG_KEY = 'spendigo_audit_ledger';

export const AuditProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isVerified, setIsVerified] = useState<boolean | null>(null);

    // Load logs on mount
    useEffect(() => {
        const savedLogs = localStorage.getItem(LOG_KEY);
        if (savedLogs) {
            try {
                const parsed = JSON.parse(savedLogs);
                setLogs(parsed);
            } catch (e) {
                console.error("Audit Ledger Corruption Detected", e);
                setLogs([]);
            }
        } else {
            // Genesis Log
            const genesisLog: AuditLog = {
                id: 'genesis',
                timestamp: new Date().toISOString(),
                actor: { id: 'system', email: 'system', ip: '127.0.0.1' },
                action: 'LEDGER_INIT',
                prevHash: GENESIS_HASH,
                hash: '' // Will calculate below
            };
            // Calculate genesis hash
            sha256(JSON.stringify({ ...genesisLog, hash: undefined })).then(hash => {
                genesisLog.hash = hash;
                setLogs([genesisLog]);
                localStorage.setItem(LOG_KEY, JSON.stringify([genesisLog]));
            });
        }
    }, []);

    // Verify Integrity Chain
    const verifyIntegrity = async (): Promise<boolean> => {
        setIsVerified(null); // validating...
        if (logs.length === 0) return true;

        let isValid = true;
        let previousHash = GENESIS_HASH;

        for (const log of logs) {
            // 1. Check Linkage
            if (log.prevHash !== previousHash) {
                console.error(`Broken Chain at ${log.id}: prevHash mismatch`);
                isValid = false;
                break;
            }

            // 2. Check Data Integrity (Re-hash content)
            const calculatedHash = await sha256(JSON.stringify({ ...log, hash: undefined }));
            if (calculatedHash !== log.hash) {
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
    }, [logs.length]); // Re-verify when length changes (new log added)

    const logEvent = async (action: string, metadata: Record<string, any> = {}, resource: string = '') => {
        const lastLog = logs[logs.length - 1];
        const prevHash = lastLog ? lastLog.hash : GENESIS_HASH;

        // Mock IP - In real app, this comes from headers/backend
        // @ts-ignore
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        // Simple mock IP generation based on user status
        const ip = '192.168.1.' + Math.floor(Math.random() * 255);

        const newLog: AuditLog = {
            id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: new Date().toISOString(),
            actor: {
                id: user?.id || 'anonymous',
                email: user?.email || 'unauthenticated',
                ip: ip
            },
            action,
            resource,
            metadata,
            prevHash,
            hash: ''
        };

        // Calculate Hash (Proof of Work could go here, but omitted for speed)
        const hash = await sha256(JSON.stringify({ ...newLog, hash: undefined }));
        newLog.hash = hash;

        const updatedLogs = [...logs, newLog];
        setLogs(updatedLogs);
        localStorage.setItem(LOG_KEY, JSON.stringify(updatedLogs));
    };

    return (
        <AuditContext.Provider value={{ logs, logEvent, verifyIntegrity, isVerified }}>
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
