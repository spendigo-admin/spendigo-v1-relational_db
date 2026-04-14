import React, { useState, useMemo } from 'react';
import '../../styles/design-system.css';
import { useAudit, sha256 } from '../../context/AuditContext';

// Security Utilities
const maskIP = (ip: string) => ip.replace(/\.\d+$/, '.***');
const getSeverityBadge = (action: string) => {
    let severity = 'info';
    let color = 'bg-blue-50 text-blue-700 border-blue-200';

    if (action.includes('ERROR') || action.includes('FAILURE')) {
        severity = 'error';
        color = 'bg-red-50 text-red-700 border-red-200';
    } else if (action.includes('WARNING') || action.includes('SUSPEND')) {
        severity = 'warning';
        color = 'bg-orange-50 text-orange-700 border-orange-200';
    } else if (action.includes('SUCCESS') || action.includes('APPROVE') || action.includes('CREATE')) {
        severity = 'success';
        color = 'bg-green-50 text-green-700 border-green-200';
    }

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${color}`}>
            {severity}
        </span>
    );
};

const AuditLogs: React.FC = () => {
    const { logs, verifyIntegrity, isVerified } = useAudit();
    const [search, setSearch] = useState('');
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Dynamically get unique actions for the filter
    const actionTypes = useMemo(() => {
        const types = new Set(logs.map(log => log.action));
        return Array.from(types).sort();
    }, [logs]);

    const filteredLogs = useMemo(() => {
        const query = search.toLowerCase();
        
        let processed = logs.filter(log => {
            // 1. Text Search
            const matchesSearch = 
                log.action.toLowerCase().includes(query) ||
                log.id.toLowerCase().includes(query) ||
                (log.actor.email && log.actor.email.toLowerCase().includes(query)) ||
                (log.resource && log.resource.toLowerCase().includes(query)) ||
                Object.values(log.metadata || {}).some(val => 
                    String(val).toLowerCase().includes(query)
                );

            // 2. Action Filter
            const matchesAction = actionFilter === 'all' || log.action === actionFilter;

            // 3. Date Filter
            let matchesDate = true;
            if (startDate) {
                matchesDate = matchesDate && log.timestamp >= startDate;
            }
            if (endDate) {
                // Add time to end date to include the full day
                matchesDate = matchesDate && log.timestamp <= `${endDate}T23:59:59`;
            }

            return matchesSearch && matchesAction && matchesDate;
        });

        // 4. Sorting
        return processed.sort((a, b) => {
            const dateA = new Date(a.timestamp).getTime();
            const dateB = new Date(b.timestamp).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });
    }, [logs, search, actionFilter, startDate, endDate, sortOrder]);

    const resetFilters = () => {
        setSearch('');
        setActionFilter('all');
        setStartDate('');
        setEndDate('');
        setSortOrder('desc');
    };

    const handleExport = async () => {
        const dataStr = JSON.stringify(logs, null, 2);
        const timestamp = new Date().toISOString();
        
        // 1. Export Data File
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const dataFileName = `spendigo_audit_ledger_${timestamp}.json`;

        const dataLink = document.createElement('a');
        dataLink.setAttribute('href', dataUri);
        dataLink.setAttribute('download', dataFileName);
        dataLink.click();

        // 2. Export Checksum File (SHA-256)
        const hash = await sha256(dataStr);
        const hashFileName = `${dataFileName}.sha256`;
        const hashUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(hash);

        const hashLink = document.createElement('a');
        hashLink.setAttribute('href', hashUri);
        hashLink.setAttribute('download', hashFileName);
        // Delay slightly for browser download sequentiality
        setTimeout(() => hashLink.click(), 500);
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
                    <div className="text-right">
                        <div className="flex gap-2 text-xs mb-2 justify-end">
                            <span className="px-2 py-1 bg-gray-100 rounded text-gray-600 flex items-center gap-1">🔒 Encryption: AES-256</span>
                            <span className="px-2 py-1 bg-gray-100 rounded text-gray-600 flex items-center gap-1">👁️ PII Monitoring: Active</span>
                        </div>
                        <button
                            onClick={() => verifyIntegrity()}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 transition-all ${isVerified === true ? 'bg-green-50 text-green-700 border-green-200' :
                                    isVerified === false ? 'bg-red-50 text-red-700 border-red-200' :
                                        'bg-gray-50 text-gray-700 border-gray-200'
                                 }`}
                        >
                            {isVerified === null ? '↻ Verify Integrity' :
                                isVerified === true ? '✓ Chain Valid' :
                                    '⚠ CHAIN BROKEN'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm mb-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">🔍</span>
                        <input
                            type="text"
                            placeholder="Search logs by Trace ID, Action, or Actor..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-[var(--glass-border)] rounded-lg outline-none focus:border-[var(--brand-primary)] text-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleExport}
                            className="px-4 py-2 border border-[var(--glass-border)] rounded-lg text-sm hover:bg-[var(--surface-1)] flex items-center gap-2 font-medium"
                        >
                            📥 Export JSON
                        </button>
                        <button 
                            onClick={resetFilters}
                            className="px-4 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] underline font-medium"
                        >
                            Reset Filters
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-[var(--glass-border)]">
                    <div>
                        <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Action Type</label>
                        <select 
                            value={actionFilter}
                            onChange={e => setActionFilter(e.target.value)}
                            className="w-full p-2 border border-[var(--glass-border)] rounded-lg text-xs outline-none bg-white font-medium"
                        >
                            <option value="all">All Actions</option>
                            {actionTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Sort Order</label>
                        <select 
                            value={sortOrder}
                            onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
                            className="w-full p-2 border border-[var(--glass-border)] rounded-lg text-xs outline-none bg-white font-medium"
                        >
                            <option value="desc">Newest First</option>
                            <option value="asc">Oldest First</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Start Date</label>
                        <input 
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full p-2 border border-[var(--glass-border)] rounded-lg text-xs outline-none bg-white font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">End Date</label>
                        <input 
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full p-2 border border-[var(--glass-border)] rounded-lg text-xs outline-none bg-white font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Secure Log Table */}
            <div className="bg-white rounded-xl border border-[var(--glass-border)] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--surface-1)] text-[var(--text-muted)] text-xs uppercase font-bold border-b border-[var(--glass-border)]">
                            <tr>
                                <th className="p-4 w-48">Timestamp (UTC)</th>
                                <th className="p-4 w-24">Level</th>
                                <th className="p-4 w-48">Action</th>
                                <th className="p-4">Actor</th>
                                <th className="p-4 w-32">Integrity</th>
                                <th className="p-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--glass-border)]">
                            {filteredLogs.length > 0 ? filteredLogs.slice(0, 50).map(log => (
                                <React.Fragment key={log.id}>
                                    <tr
                                        onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                        className={`hover:bg-[var(--surface-1)] transition-colors cursor-pointer ${expandedLogId === log.id ? 'bg-[var(--surface-1)]' : ''}`}
                                    >
                                        <td className="p-4 text-[var(--text-muted)] whitespace-nowrap text-xs font-mono">
                                            {log.timestamp.replace('T', ' ').slice(0, 19)}
                                        </td>
                                        <td className="p-4">
                                            {getSeverityBadge(log.action)}
                                        </td>
                                        <td className="p-4 text-xs font-medium text-[var(--text-main)]">
                                            {log.action}
                                        </td>
                                        <td className="p-4 text-sm text-[var(--text-main)]">
                                            {log.actor.email} <span className="text-[var(--text-muted)] text-xs">({maskIP(log.actor.ip)})</span>
                                        </td>
                                        <td className="p-4 text-xs font-mono text-green-600 truncate max-w-[100px]" title={log.hash}>
                                            {log.hash.substring(0, 8)}...
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
                                                            {log.resource && (
                                                                <div className="mt-2 text-yellow-500">Resource: {log.resource}</div>
                                                            )}
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
                                                                <span>Previous Hash:</span>
                                                                <span className="text-zinc-500">{log.prevHash.substring(0, 16)}...</span>
                                                            </div>
                                                            <div className="mt-2">
                                                                <span className="block mb-1">Integrity Hash (SHA-256):</span>
                                                                <div className="p-2 bg-slate-800 break-all text-[10px] text-slate-400 border-l-2 border-green-500">
                                                                    {log.hash}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-[var(--text-muted)]">
                                        No logs found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AuditLogs;
