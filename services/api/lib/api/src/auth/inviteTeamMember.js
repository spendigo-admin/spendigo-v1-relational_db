"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.inviteTeamMember = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const rateLimiter_1 = require("../utils/rateLimiter");
const audit_1 = require("../utils/audit");
/**
 * Callable HTTPS Cloud Function to invite team members
 * Creates both Firebase Auth account and Firestore user record
 */
exports.inviteTeamMember = functions.https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    // 1. Verify caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to invite team members');
    }
    // Rate Limit Check: Max 10 invites per 15 minutes to prevent email spam
    await (0, rateLimiter_1.checkRateLimit)(context.auth.uid, 'inviteTeamMember', 10, 15 * 60 * 1000);
    // 2. Validate input
    const { email, name, merchantRole, storeId, tempPassword } = data;
    if (!email || !name || !merchantRole || !storeId || !tempPassword) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    // 3. Verify caller is a merchant (not consumer/admin)
    const callerDoc = await admin.firestore()
        .collection('users')
        .doc(context.auth.uid)
        .get();
    const callerData = callerDoc.data();
    if (!callerData || callerData.role !== 'merchant') {
        throw new functions.https.HttpsError('permission-denied', 'Only merchants can invite team members');
    }
    // 4. Verify caller is from the same store (owners/managers only)
    if (callerData.storeId !== storeId) {
        throw new functions.https.HttpsError('permission-denied', 'Can only invite members to your own store');
    }
    // 5. Verify caller has sufficient permissions (OWNER or MANAGER)
    const callerRole = callerData.merchantRole || 'STAFF';
    if (callerRole !== 'OWNER' && callerRole !== 'MANAGER') {
        throw new functions.https.HttpsError('permission-denied', 'Only store owners and managers can invite team members');
    }
    // 5b. Role-rank guard: caller may only assign roles strictly below their own.
    // Prevents a MANAGER from inviting a new OWNER (store takeover vector).
    const ROLE_RANK = { OWNER: 3, MANAGER: 2, STAFF: 1, MARKETING: 1 };
    if (((_a = ROLE_RANK[merchantRole]) !== null && _a !== void 0 ? _a : 0) >= ((_b = ROLE_RANK[callerRole]) !== null && _b !== void 0 ? _b : 0)) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot assign a role equal to or higher than your own');
    }
    try {
        // 6. Create Firebase Auth user with temporary password
        const authUser = await admin.auth().createUser({
            email: email,
            password: tempPassword,
            displayName: name,
            emailVerified: false,
        });
        functions.logger.info(`Created Auth user: ${authUser.uid} for ${email}`);
        // 7. Create Firestore user document
        await admin.firestore().collection('users').doc(authUser.uid).set({
            email: email,
            name: name,
            role: 'merchant',
            merchantRole: merchantRole,
            storeId: storeId,
            status: 'pending_invite',
            subscriptionTier: callerData.subscriptionTier || 'starter',
            invitedAt: admin.firestore.FieldValue.serverTimestamp(),
            invitedBy: context.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info(`Created Firestore user doc for ${email}`);
        // 8. Generate Email Verification Link and Add to Mail Collection
        const verificationLink = await admin.auth().generateEmailVerificationLink(email);
        const htmlContent = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; padding: 30px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; border-radius: 10px;">
        <h1 style="margin: 0;">You've Been Invited!</h1>
        <p style="margin: 10px 0 0 0;">Welcome to Spendigo</p>
    </div>
    
    <div style="padding: 30px; background: white; border: 1px solid #e5e7eb; margin-top: 20px; border-radius: 10px;">
        <p>Hi ${name},</p>
        <p>You have been invited to join the team for your store on Spendigo. Here are your login details:</p>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Role:</strong> ${merchantRole}</p>
            <p style="margin: 10px 0 0 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 10px 0 0 0;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
        </div>
        
        <p style="color: #ef4444; font-weight: bold;">Please verify your email and change your password immediately after logging in.</p>
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="${verificationLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px;">Verify Email & Login</a>
        </div>
    </div>
</body>
</html>`;
        await admin.firestore().collection('mail').add({
            to: [email],
            message: {
                subject: `You're invited to join a Spendigo Store Team!`,
                html: htmlContent,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info(`Queued invitation email for ${email}`);
        // 9. Audit log
        await (0, audit_1.logEvent)('TEAM_MEMBER_INVITE', (0, audit_1.buildActorFromContext)(context), { invitedEmail: email, merchantRole, storeId }, `stores/${storeId}`);
        // 10. Return success
        return {
            success: true,
            uid: authUser.uid,
            message: `Successfully invited ${email} to join your team. An email has been sent to them.`,
        };
    }
    catch (error) {
        // Handle specific Firebase errors
        if (error.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError('already-exists', `User with email ${email} already exists`);
        }
        // Log and throw generic error
        functions.logger.error('Error inviting team member:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create team member account');
    }
});
//# sourceMappingURL=inviteTeamMember.js.map