import React, { useState, useMemo } from 'react';
import '../../styles/design-system.css';
import { useAudit, sha256 } from '../../context/AuditContext';
import { useAuth } from '../../context/AuthContext';
import { redactPII, redactString, formatToEST, isWithinMinutes } from '../../utils/security';

// Security Utilities
// Security UI Helpers
const getSeverityBadge = (action: string) => {
    let color = 'bg-blue-50 text-blue-700 border-blue-200';
    let icon = 'ℹ️';

    if (action.includes('ERROR') || action.includes('FAILURE')) {
        color = 'bg-red-50 text-red-700 border-red-200';
        icon = '🚫';
    } else if (action.includes('WARNING') || action.includes('SUSPEND')) {
        color = 'bg-amber-50 text-amber-700 border-amber-200';
        icon = '⚠️';
    } else if (action.includes('SUCCESS') || action.includes('APPROVE') || action.includes('CREATE')) {
        color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        icon = '✅';
    }

    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border flex items-center gap-1.5 ${color} shadow-sm transition-transform hover:scale-105`}>
            <span>{icon}</span>
            {action.split('_')[0]}
        </span>
    );
};

const AuditLogs: React.FC = () => {
    const { user } = useAuth();
    const { logs, verifyIntegrity, isVerified, testLog, errorLogId } = useAudit();
    const [isLiveView, setIsLiveView] = useState(true);
    const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());
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
                (log.resource && log.resource.toLowerCase().includes(query));

            // 2. Action Filter
            const matchesAction = actionFilter === 'all' || log.action === actionFilter;

            // 3. Time Filter
            let matchesTime = true;
            const logDate = new Date(log.timestamp).getTime();

            if (isLiveView) {
                // Default view: Last 60 minutes for better visibility
                matchesTime = isWithinMinutes(log.timestamp, 60);
            } else {
                // Custom view: Date ranges
                if (startDate) {
                    const start = new Date(startDate).getTime();
                    if (!isNaN(start)) {
                        matchesTime = matchesTime && logDate >= start;
                    }
                }
                if (endDate) {
                    const end = new Date(endDate).getTime();
                    if (!isNaN(end)) {
                        matchesTime = matchesTime && logDate <= end;
                    }
                }
            }

            return matchesSearch && matchesAction && matchesTime;
        });

        // 4. Sorting
        return processed.sort((a, b) => {
            const dateA = new Date(a.timestamp).getTime();
            const dateB = new Date(b.timestamp).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });
    }, [logs, search, actionFilter, startDate, endDate, sortOrder, isLiveView, lastFetchTime]);

    const handleSearch = () => {
        setIsLiveView(false);
        setLastFetchTime(Date.now()); // Force re-memo
    };

    const resetFilters = () => {
        setSearch('');
        setActionFilter('all');
        setStartDate('');
        setEndDate('');
        setSortOrder('desc');
        setIsLiveView(true);
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
                        <h1 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-3">
                            <span className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200">🛡️</span>
                            Security Audit Ledger
                        </h1>
                        <div className="flex items-center gap-3 mt-1.5">
                            <p className="text-[var(--text-muted)] text-sm">
                                Tamper-evident logs of all system events.
                            </p>
                            <span className="h-1 w-1 rounded-full bg-gray-300"></span>
                            <div className="flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Live & Redacted</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex gap-2 text-[10px] mb-3 justify-end font-bold uppercase tracking-tight">
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md border border-blue-100 flex items-center gap-1">🔒 AES-256-GCM</span>
                            <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded-md border border-purple-100 flex items-center gap-1">👁️ SOC2/GDPR REDACTED</span>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => verifyIntegrity()}
                                className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all shadow-sm ${
                                    isVerified === true 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-2 ring-emerald-100' 
                                    : isVerified === false 
                                    ? 'bg-red-50 text-red-700 border-red-200 animate-bounce' 
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {isVerified === null ? (
                                    <><span className="animate-spin">↻</span> Verifying...</>
                                ) : isVerified === true ? (
                                    <><span className="text-emerald-500">✓</span> Integrity Chain Valid</>
                                ) : (
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-2 text-red-500">
                                            <span>⚠</span> CHAIN COMPROMISED
                                        </div>
                                        {errorLogId && (
                                            <span className="text-[9px] font-mono opacity-60">Break at: {errorLogId.substring(0, 12)}...</span>
                                        )}
                                    </div>
                                )}
                            </button>
                        </div>
                        {user?.adminRole === 'SUPER_ADMIN' && (
                            <button
                                onClick={async () => {
                                    await testLog();
                                    verifyIntegrity();
                                }}
                                className="mt-2 text-[10px] text-blue-600 hover:underline font-bold"
                            >
                                + Create Test Event
                            </button>
                        )}
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

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4 border-t border-[var(--glass-border)] items-end">
                    <div>
                        <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Action Type</label>
                        <select 
                            value={actionFilter}
                            onChange={e => setActionFilter(e.target.value)}
                            className="w-full p-2 border border-[var(--glass-border)] rounded-lg text-xs outline-none bg-white font-medium hover:border-[var(--brand-primary)] transition-colors"
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
                            className="w-full p-2 border border-[var(--glass-border)] rounded-lg text-xs outline-none bg-white font-medium hover:border-[var(--brand-primary)] transition-colors"
                        >
                            <option value="desc">Newest First</option>
                            <option value="asc">Oldest First</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Start Date & Time (EST)</label>
                        <div className="relative">
                            <input 
                                type="datetime-local"
                                value={startDate}
                                onChange={e => {
                                    setStartDate(e.target.value);
                                    setIsLiveView(false);
                                }}
                                className="w-full p-2 border border-[var(--glass-border)] rounded-lg text-xs outline-none bg-white font-medium hover:border-[var(--brand-primary)] transition-colors pr-8"
                            />
                            {startDate && (
                                <button 
                                    onClick={() => setStartDate('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">End Date & Time (EST)</label>
                        <div className="relative">
                            <input 
                                type="datetime-local"
                                value={endDate}
                                onChange={e => {
                                    setEndDate(e.target.value);
                                    setIsLiveView(false);
                                }}
                                className="w-full p-2 border border-[var(--glass-border)] rounded-lg text-xs outline-none bg-white font-medium hover:border-[var(--brand-primary)] transition-colors pr-8"
                            />
                            {endDate && (
                                <button 
                                    onClick={() => setEndDate('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                    <div>
                        <button 
                            onClick={handleSearch}
                            disabled={!startDate && !endDate}
                            className={`w-full py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                                !startDate && !endDate 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                : 'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-dark)] active:scale-95'
                            }`}
                        >
                            🔍 Fetch Custom Logs
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="flex justify-between items-center mb-4 px-1">
                <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-[var(--glass-border)] shadow-sm">
                        <span className="text-[var(--text-muted)] font-medium">Filtered:</span>
                        <span className="font-bold text-[var(--brand-primary)]">{filteredLogs.length} events</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-[var(--glass-border)] shadow-sm">
                        <span className="text-[var(--text-muted)] font-medium">Total Ledger:</span>
                        <span className="font-bold text-gray-700">{logs.length}</span>
                    </div>
                </div>
                {isLiveView && (
                    <div className="text-[10px] font-bold text-blue-500 uppercase flex items-center gap-2">
                        <span className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                        Viewing last 60 minutes
                    </div>
                )}
            </div>

            {/* Secure Log Table */}
            <div className="bg-white rounded-2xl border border-[var(--glass-border)] shadow-xl shadow-gray-100/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--surface-1)] text-[var(--text-muted)] text-xs uppercase font-bold border-b border-[var(--glass-border)]">
                            <tr>
                                <th className="p-4 w-48">Timestamp (EST)</th>
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
                                            {formatToEST(log.timestamp)}
                                        </td>
                                        <td className="p-4">
                                            {getSeverityBadge(log.action)}
                                        </td>
                                        <td className="p-4 text-xs font-medium text-[var(--text-main)]">
                                            {log.action}
                                        </td>
                                        <td className="p-4 text-sm text-[var(--text-main)]">
                                            <span className="font-medium">{redactString(log.actor.email)}</span>
                                            <span className="text-[var(--text-muted)] text-xs ml-2">({redactString(log.actor.ip)})</span>
                                        </td>
                                        <td className="p-4 text-xs font-mono text-green-600 truncate max-w-[100px]" title={log.hash}>
                                            {log.hash.substring(0, 8)}...
                                        </td>
                                        <td className="p-4 text-right text-[var(--text-muted)] text-xs">
                                            <div className={`transition-transform duration-200 ${expandedLogId === log.id ? 'rotate-180' : ''}`}>
                                                ▼
                                            </div>
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
                                                            <div className="p-3 bg-slate-800 rounded border border-slate-700 overflow-auto max-h-60">
                                                                <pre>{JSON.stringify(redactPII(log.metadata), null, 2)}</pre>
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
