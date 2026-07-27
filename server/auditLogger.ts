// Unified Audit Logging System
import type { DatabaseStorage } from "./storage";
import { nanoid } from "nanoid";

export interface AuditLogEntry {
  id: string;
  userId: string;
  userRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue?: any;
  afterValue?: any;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

/**
 * Log admin action for audit trail
 */
export async function logAdminAction(params: {
  userId: string;
  userRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue?: any;
  afterValue?: any;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const auditEntry: AuditLogEntry = {
    id: nanoid(),
    userId: params.userId,
    userRole: params.userRole,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    beforeValue: params.beforeValue,
    afterValue: params.afterValue,
    reason: params.reason,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    timestamp: new Date().toISOString()
  };

  try {
    // Get storage from global context - this will be passed from routes
    const storage = (global as any).adminStorage as DatabaseStorage;
    if (storage) {
      await storage.createAuditLog(auditEntry);
      console.log(`[AUDIT] ${params.action} on ${params.entityType}:${params.entityId} by user:${params.userId}`);
    }
  } catch (error) {
    console.error("Failed to log audit entry:", error);
    // Don't throw error - audit logging failure shouldn't break the main operation
  }
}

/**
 * Get audit logs with filtering
 */
export async function getAuditLogs(storage: DatabaseStorage, filters: {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  return await storage.getAuditLogs(filters);
}

/**
 * Common audit actions
 */
export const AUDIT_ACTIONS = {
  // KYB actions
  KYB_APPROVED: "kyb_approved",
  KYB_REJECTED: "kyb_rejected", 
  KYB_ENHANCED: "kyb_enhanced",
  KYB_DOC_REQUESTED: "kyb_doc_requested",
  
  // User actions
  USER_ENABLED: "user_enabled",
  USER_DISABLED: "user_disabled",
  USER_2FA_RESET: "user_2fa_reset",
  
  // Offer actions
  OFFER_HIDDEN: "offer_hidden",
  OFFER_UNHIDDEN: "offer_unhidden",
  OFFER_ARCHIVED: "offer_archived",
  
  // Escrow actions
  ESCROW_NOTE_ADDED: "escrow_note_added",
  ESCROW_STATUS_CHANGED: "escrow_status_changed",
  
  // Document actions
  DOC_LINK_CREATED: "doc_link_created",
  DOC_ACCESSED: "doc_accessed",
  
  // Settings actions
  SETTING_CHANGED: "setting_changed",
  
  // Admin actions
  ADMIN_LOGIN: "admin_login",
  ADMIN_LOGOUT: "admin_logout",
  ADMIN_ACCESS_DENIED: "admin_access_denied"
} as const;

/**
 * Helper function to log KYB decision
 */
export async function logKYBDecision(
  userId: string,
  userRole: string,
  companyId: string,
  decision: string,
  beforeStatus: string,
  afterStatus: string,
  reason: string,
  req?: any
) {
  await logAdminAction({
    userId,
    userRole,
    action: decision === 'approved' ? AUDIT_ACTIONS.KYB_APPROVED : 
            decision === 'rejected' ? AUDIT_ACTIONS.KYB_REJECTED :
            AUDIT_ACTIONS.KYB_ENHANCED,
    entityType: "company",
    entityId: companyId,
    beforeValue: { kybStatus: beforeStatus },
    afterValue: { kybStatus: afterStatus },
    reason,
    ipAddress: req?.ip,
    userAgent: req?.get('User-Agent')
  });
}

/**
 * Helper function to log offer moderation
 */
export async function logOfferModeration(
  userId: string,
  userRole: string,
  offerId: string,
  action: string,
  beforeStatus: string,
  afterStatus: string,
  reason: string,
  req?: any
) {
  await logAdminAction({
    userId,
    userRole,
    action: action === 'hide' ? AUDIT_ACTIONS.OFFER_HIDDEN :
            action === 'unhide' ? AUDIT_ACTIONS.OFFER_UNHIDDEN :
            AUDIT_ACTIONS.OFFER_ARCHIVED,
    entityType: "offer",
    entityId: offerId,
    beforeValue: { status: beforeStatus },
    afterValue: { status: afterStatus },
    reason,
    ipAddress: req?.ip,
    userAgent: req?.get('User-Agent')
  });
}