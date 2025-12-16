import React from 'react';
import '../../styles/design-system.css';

// Mock Data representing `payments` ledger + system events
const LOGS = [
    { id: 'ev1', type: 'PAYMENT_INTENT', severity: 'info', message: 'Charge $45.00 succeeded for Cart #C123', timestamp: '2023-12-16 10:45:00' },
    { id: 'ev2', type: 'FRAUD_ALERT', severity: 'warning', message: 'Velocity Check flagged User #U999 (High Risk)', timestamp: '2023-12-16 10:42:15' },
    { id: 'ev3', type: 'PAYOUT', severity: 'success', message: 'Transferred $240.50 to Store #S55', timestamp: '2023-12-16 09:00:00' },
    { id: 'ev4', type: 'ADMIN_ACTION', severity: 'error', message: 'Admin banned User #U888', timestamp: '2023-12-15 14:30:00' }
];

const AuditLogs: React.FC = () => {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-[var(--text-main)]">System Audit Logs</h1>

            <div className="glass-panel overflow-hidden">
                <table className="w-full text-left bg-[var(--surface-1)]">
                    <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] text-xs uppercase">
                        <tr>
                            <th className="p-4">Timestamp</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Message</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                        {LOGS.map(log => (
                            <tr key={log.id} className="hover:bg-[var(--surface-2)] transition-colors">
                                <td className="p-4 text-[var(--text-muted)] whitespace-nowrap text-sm font-mono">{log.timestamp}</td>
                                <td className="p-4">
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${log.severity === 'error' ? 'bg-[var(--status-error)]/20 text-[var(--status-error)]' :
                                            log.severity === 'warning' ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]' :
                                                log.severity === 'success' ? 'bg-[var(--status-success)]/20 text-[var(--status-success)]' :
                                                    'bg-blue-500/20 text-blue-400'
                                        }`}>
                                        {log.type}
                                    </span>
                                </td>
                                <td className="p-4 text-[var(--text-main)] text-sm">{log.message}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AuditLogs;
