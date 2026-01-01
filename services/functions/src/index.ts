import * as admin from 'firebase-admin';

admin.initializeApp();

// Export Triggers
export * from './triggers/userTriggers';
