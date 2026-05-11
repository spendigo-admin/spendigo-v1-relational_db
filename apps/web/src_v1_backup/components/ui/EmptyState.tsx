import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  heading: string;
  subtext?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, heading, subtext, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center text-3xl mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--text-main)] mb-1">{heading}</h3>
      {subtext && (
        <p className="text-sm text-[var(--text-muted)] max-w-xs mb-5">{subtext}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
