// Admin Authentication and Authorization System
import type { Request, Response, NextFunction } from "express";
import type { DatabaseStorage } from "./storage";

export type AdminRole = "admin" | "compliance" | "ops" | "support" | "auditor";

export interface AdminSession {
  userId: string;
  role: AdminRole;
  permissions: string[];
  requires2FA: boolean;
  is2FAVerified: boolean;
}

// Role permissions mapping
export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  admin: [
    "kyb:view", "kyb:approve", "kyb:reject", "kyb:request_docs",
    "users:view", "users:toggle", "users:reset_2fa",
    "offers:view", "offers:moderate", "offers:archive",
    "matches:view",
    "escrow:view", "escrow:note",
    "documents:view", "documents:link",
    "insights:view", "insights:export",
    "settings:view", "settings:update",
    "audit:view"
  ],
  compliance: [
    "kyb:view", "kyb:approve", "kyb:reject", "kyb:request_docs",
    "users:view", "documents:view", "documents:link",
    "insights:view", "audit:view"
  ],
  ops: [
    "offers:view", "offers:moderate", "offers:archive",
    "matches:view", "escrow:view", "escrow:note",
    "insights:view", "insights:export"
  ],
  support: [
    "users:view", "offers:view", "matches:view",
    "escrow:view", "insights:view"
  ],
  auditor: [
    "audit:view", "kyb:view", "users:view",
    "offers:view", "matches:view", "escrow:view",
    "insights:view", "insights:export"
  ]
};

// Roles that require 2FA
export const REQUIRES_2FA_ROLES: AdminRole[] = ["admin", "compliance", "ops"];

/**
 * Middleware to check if user has admin access
 */
export async function requireAdminAuth(req: any, res: Response, next: NextFunction) {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userId = req.user.claims.sub;
    const storage = req.storage as DatabaseStorage;
    const user = await storage.getUser(userId);
    
    if (!user || !user.adminRole) {
      console.log(`[ADMIN] Access denied for user ${userId}: no admin role`);
      return res.status(403).json({ message: "Admin access denied" });
    }

    // Check if role requires 2FA and if it's verified
    const requires2FA = REQUIRES_2FA_ROLES.includes(user.adminRole as AdminRole);
    if (requires2FA && !user.is2FAEnabled) {
      return res.status(403).json({ 
        message: "2FA required for this role",
        requires2FA: true 
      });
    }

    // Create admin session
    const adminSession: AdminSession = {
      userId,
      role: user.adminRole as AdminRole,
      permissions: ROLE_PERMISSIONS[user.adminRole as AdminRole] || [],
      requires2FA,
      is2FAVerified: user.is2FAEnabled || false
    };

    req.adminSession = adminSession;
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
}

/**
 * Middleware to check specific permission
 */
export function requirePermission(permission: string) {
  return (req: any, res: Response, next: NextFunction) => {
    const adminSession: AdminSession = req.adminSession;
    
    if (!adminSession || !adminSession.permissions.includes(permission)) {
      console.log(`[ADMIN] Permission denied for ${adminSession?.userId}: ${permission}`);
      return res.status(403).json({ 
        message: `Permission denied: ${permission}`,
        required_permission: permission
      });
    }
    
    next();
  };
}

/**
 * Rate limiting for admin routes
 */
export const adminRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs for admin routes
  message: "Too many admin requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Get user's admin role and permissions
 */
export async function getUserAdminInfo(userId: string, storage: DatabaseStorage) {
  const user = await storage.getUser(userId);
  if (!user || !user.adminRole) {
    return null;
  }

  return {
    role: user.adminRole as AdminRole,
    permissions: ROLE_PERMISSIONS[user.adminRole as AdminRole] || [],
    requires2FA: REQUIRES_2FA_ROLES.includes(user.adminRole as AdminRole),
    is2FAEnabled: user.is2FAEnabled || false
  };
}