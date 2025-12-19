import React, { useState, useEffect, useMemo } from 'react';
import '../../styles/design-system.css';

// --- SECURITY COMPLIANCE UTILITIES ---

// 1. PII Masking: Ensure no raw sensitive data is exposed in logs (GDPR/PCI-DSS)
const maskIP = (ip: string) => ip.replace(/\.\d+$/, '.***');
const maskCard = (last4: string) => `****-****-****-${last4}`;
const hashUserId = (id: string) => `uid_${id.substring(0, 3)}***${id.substring(id.length - 2)}`;

// 2. Integrity: Mock hashing to simulate tamper-proof logging standards
const generateIntegrityHash = (data: any) => {
    // In production, this would be a real SHA-256 of the log entry
    return `sha256:${Math.random().toString(36).substring(2)}...${Math.random().toString(36).substring(2)}`;
};

// Enhanced Secure Mock Data Generator
const generateLogs = () => {
    const logs = [];
    const now = new Date();

    // Standardized Security Categories (NIST/OWASP)
    const types = [
        { id: 'SEC_AUTH', label: 'Authentication', severity: 'info' },
        { id: 'SEC_ACCESS', label: 'Access Control', severity: 'warning' },
        { id: 'APP_PAY', label: 'Payment Processing', severity: 'success' },
        { id: 'SYS_ERR', label: 'System Error', severity: 'error' },
        { id: 'DAT_MOD', label: 'Data Modification', severity: 'info' },
    ];

    for (let i = 0; i < 50; i++) {
        const date = new Date(now.getTime() - i * 1000 * 60 * 45);
        const typeConfig = types[i % types.length];
        const rawIp = `192.168.1.${100 + i}`;
        const maskedIp = maskIP(rawIp);

        let message = '';
        let context = {};

        // Generate context-aware messages without PII
        switch (typeConfig.id) {
            case 'SEC_AUTH':
                message = `User login success`;
                context = { actor: hashUserId(`user_${i}`), method: 'mfa_v2', ip: maskedIp };
                break;
            case 'SEC_ACCESS':
                message = `Unauthorized resource access attempt blocked`;
                context = { actor: 'anonymous', resource: `/admin/settings/${i}`, ip: maskedIp };
                typeConfig.severity = 'warning';
                break;
            case 'APP_PAY':
                message = `Payment processed via gateway`;
                context = { mount: '$45.00', card_mask: maskCard('4242'), currency: 'USD' };
                break;
            case 'SYS_ERR':
                message = `Database connection timeout`;
                context = { error_code: 'DB_T_OUT', retry: 2 };
                break;
            case 'DAT_MOD':
                message = `Merchant profile updated`;
                context = { actor: hashUserId(`admin_${i}`), field: 'business_hours' };
                break;
        }

        const logEntry = {
            id: `txn_${Date.now()}_${i}`,
            type: typeConfig.id,
            category: typeConfig.label,
            severity: typeConfig.severity,
            message,
            timestamp: date.toISOString(),
            integrity_hash: '', // Filled below
            actor_ip: maskedIp,
            metadata: context,
            compliance_tags: ['PII_REDACTED', 'IMMUTABLE']
        };

        logEntry.integrity_hash = generateIntegrityHash(logEntry);
        logs.push(logEntry);
    }
    return logs;
};

const INITIAL_LOGS = generateLogs();

const AuditLogs: React.FC = () => {
    const [logs, setLogs] = useState(INITIAL_LOGS);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    // Filter Logic
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = log.message.toLowerCase().includes(search.toLowerCase()) ||
                log.id.toLowerCase().includes(search.toLowerCase());
            const matchesCategory = filterCategory === 'ALL' || log.type === filterCategory;
            return matchesSearch && matchesCategory;
        });
    }, [logs, search, filterCategory]);

    const getSeverityBadge = (severity: string) => {
        const styles = {
            error: 'bg-red-50 text-red-700 border-red-200',
            warning: 'bg-orange-50 text-orange-700 border-orange-200',
            success: 'bg-green-50 text-green-700 border-green-200',
            info: 'bg-blue-50 text-blue-700 border-blue-200'
        };
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${styles[severity as keyof typeof styles]}`}>
                {severity}
            </span>
        );
    };

    return (
        <div className="p-6 animate-fade-in pb-20">
            {/* Compliance Header */}
            <div className="mb-6 border-b border-[var(--glass-border)] pb-6">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-2">
                            🛡️ Security Audit Ledger
                        </h1>
                        <p className="text-[var(--text-muted)] text-sm mt-1">
                            Tamper-evident logs of all system events. PII is automatically redacted per SOC2/GDPR standards.
                        </p>
                    </div>
                    <div className="flex gap-2 text-xs">
                        <span className="px-2 py-1 bg-gray-100 rounded text-gray-600 flex items-center gap-1">🔒 Encryption: AES-256</span>
                        <span className="px-2 py-1 bg-gray-100 rounded text-gray-600 flex items-center gap-1">👁️ PII Monitoring: Active</span>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm mb-6 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">🔍</span>
                    <input
                        type="text"
                        placeholder="Search logs by Trace ID, or integrity hash..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-[var(--glass-border)] rounded-lg outline-none focus:border-[var(--brand-primary)] text-sm"
                    />
                </div>
                <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="px-4 py-2 border border-[var(--glass-border)] rounded-lg outline-none text-sm bg-white min-w-[150px]"
                >
                    <option value="ALL">All Event Categories</option>
                    <option value="SEC_AUTH">Authentication</option>
                    <option value="SEC_ACCESS">Access Control</option>
                    <option value="APP_PAY">Financial</option>
                    <option value="DAT_MOD">Data Changes</option>
                </select>
                <button className="px-4 py-2 border border-[var(--glass-border)] rounded-lg text-sm hover:bg-[var(--surface-1)]">
                    📥 Export Encrypted
                </button>
            </div>

            {/* Secure Log Table */}
            <div className="bg-white rounded-xl border border-[var(--glass-border)] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--surface-1)] text-[var(--text-muted)] text-xs uppercase font-bold border-b border-[var(--glass-border)]">
                            <tr>
                                <th className="p-4 w-48">Timestamp (UTC)</th>
                                <th className="p-4 w-24">Level</th>
                                <th className="p-4 w-48">Category</th>
                                <th className="p-4">Event Description (Masked)</th>
                                <th className="p-4 w-32">Integrity</th>
                                <th className="p-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--glass-border)]">
                            {filteredLogs.slice(0, 50).map(log => (
                                <React.Fragment key={log.id}>
                                    <tr
                                        onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                        className={`hover:bg-[var(--surface-1)] transition-colors cursor-pointer ${expandedLogId === log.id ? 'bg-[var(--surface-1)]' : ''}`}
                                    >
                                        <td className="p-4 text-[var(--text-muted)] whitespace-nowrap text-xs font-mono">
                                            {log.timestamp.replace('T', ' ').slice(0, 19)}
                                        </td>
                                        <td className="p-4">
                                            {getSeverityBadge(log.severity)}
                                        </td>
                                        <td className="p-4 text-xs font-medium text-[var(--text-main)]">
                                            {log.category}
                                        </td>
                                        <td className="p-4 text-sm text-[var(--text-main)]">
                                            {log.message}
                                        </td>
                                        <td className="p-4 text-xs font-mono text-green-600 truncate max-w-[100px]" title={log.integrity_hash}>
                                            Verified ✓
                                        </td>
                                        <td className="p-4 text-right text-[var(--text-muted)] text-xs">
                                            {expandedLogId === log.id ? '▲' : '▼'}
                                        </td>
                                    </tr>
                                    {/* Expanded Forensic View */}
                                    {expandedLogId === log.id && (
                                        <tr className="bg-[var(--surface-1)]">
                                            <td colSpan={6} className="p-0 border-b border-[var(--glass-border)]">
                                                <div className="bg-slate-900 p-6 text-slate-300 text-xs font-mono shadow-inner grid grid-cols-2 gap-8">
                                                    <div>
                                                        <div className="mb-4">
                                                            <h4 className="text-slate-500 uppercase tracking-wider font-bold mb-2 text-[10px]">Event Context</h4>
                                                            <div className="p-3 bg-slate-800 rounded border border-slate-700">
                                                                <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-slate-500 uppercase tracking-wider font-bold mb-2 text-[10px]">Security Checks</h4>
                                                            <div className="flex gap-2">
                                                                {log.compliance_tags.map(tag => (
                                                                    <span key={tag} className="px-2 py-1 bg-green-900/30 text-green-400 border border-green-800 rounded text-[10px]">{tag}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-slate-500 uppercase tracking-wider font-bold mb-2 text-[10px]">Verification Proof</h4>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between border-b border-slate-800 pb-1">
                                                                <span>Log ID:</span>
                                                                <span className="text-white">{log.id}</span>
                                                            </div>
                                                            <div className="flex justify-between border-b border-slate-800 pb-1">
                                                                <span>IP Address:</span>
                                                                <span className="text-yellow-400">{log.actor_ip} (Masked)</span>
                                                            </div>
                                                            <div className="mt-2">
                                                                <span className="block mb-1">Integrity Hash (SHA-256):</span>
                                                                <div className="p-2 bg-slate-800 break-all text-[10px] text-slate-400 border-l-2 border-green-500">
                                                                    {log.integrity_hash}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AuditLogs;
