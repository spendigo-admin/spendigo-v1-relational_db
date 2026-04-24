/**
 * Global Audit Bridge
 * Allows any part of the application (even outside the AuditProvider) to trigger audit logs.
 */

type AuditParams = {
    action: string;
    metadata?: Record<string, any>;
    resource?: string;
    actor?: {
        id: string;
        email: string;
        ip?: string;
    };
};

type AuditListener = (params: AuditParams) => void;

class AuditBridge {
    private listeners: AuditListener[] = [];

    subscribe(listener: AuditListener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    emit(actionOrParams: string | AuditParams, metadata?: Record<string, any>, resource?: string, actor?: any) {
        if (typeof actionOrParams === 'string') {
            this.listeners.forEach(l => l({ action: actionOrParams, metadata, resource, actor }));
        } else {
            this.listeners.forEach(l => l(actionOrParams));
        }
    }
}

export const auditBridge = new AuditBridge();

/**
 * Convenience wrapper for logging events from anywhere in the app.
 */
export const logSystemEvent = (action: string, metadata: Record<string, any> = {}, resource: string = '', actor?: any) => {
    auditBridge.emit({ action, metadata, resource, actor });
};
