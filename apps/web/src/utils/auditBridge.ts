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

type AuditListener = (params: AuditParams) => void | Promise<void>;

class AuditBridge {
    private listeners: AuditListener[] = [];

    subscribe(listener: AuditListener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    async emit(actionOrParams: string | AuditParams, metadata?: Record<string, any>, resource?: string, actor?: any) {
        const params = typeof actionOrParams === 'string' 
            ? { action: actionOrParams, metadata, resource, actor } 
            : actionOrParams;
            
        // Execute all listeners and wait for them to complete (forensic guarantee)
        await Promise.all(this.listeners.map(l => {
            try {
                const result = l(params);
                return result instanceof Promise ? result : Promise.resolve();
            } catch (e) {
                console.error('Audit listener failed:', e);
                return Promise.resolve();
            }
        }));
    }
}

export const auditBridge = new AuditBridge();

/**
 * Convenience wrapper for logging events from anywhere in the app.
 */
export const logSystemEvent = (action: string, metadata: Record<string, any> = {}, resource: string = '', actor?: any) => {
    auditBridge.emit({ action, metadata, resource, actor });
};
