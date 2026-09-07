import type { NextFunction, Request, Response } from "express";
import {
  hasPlatformPermission,
  isPlatformPermission,
  resolvePlatformAuthority,
  type PlatformAuthorityReadPort,
  type PlatformAuthorityResolution,
  type PlatformPermission,
  type SessionAssurance,
} from "./platform-authority/index.js";
import { getSessionAssurance } from "./session-assurance/index.js";
import { satisfiesAdminActionAssurance } from "./admin-security/index.js";

export interface AdminSession {
  readonly userId: string;
  readonly principalId: string;
  readonly roles: PlatformAuthorityResolution["activeRoles"];
  readonly permissions: PlatformAuthorityResolution["permissions"];
  readonly assurance: SessionAssurance;
  readonly authority: PlatformAuthorityResolution;
}

let authorityReadPort: PlatformAuthorityReadPort | null = null;

export function configurePrivilegedAdminAuthorization(readPort: PlatformAuthorityReadPort): void {
  authorityReadPort = readPort;
}

export async function requireAdminAuth(
  req: Request & { adminSession?: AdminSession },
  res: Response,
  next: NextFunction,
) {
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(401).json({ message: "Authentication required" });
  if (!authorityReadPort) return res.status(503).json({ message: "Platform administration unavailable" });
  try {
    const authority = await resolvePlatformAuthority(userId, authorityReadPort);
    const assurance = getSessionAssurance(req.session);
    if (authority.state !== "resolved" || !authority.principalId || authority.permissions.length === 0 || !assurance) {
      return res.status(403).json({ message: "Platform access denied" });
    }
    req.adminSession = Object.freeze({
      userId,
      principalId: authority.principalId,
      roles: authority.activeRoles,
      permissions: authority.permissions,
      assurance: assurance.level,
      authority,
    });
    return next();
  } catch {
    return res.status(503).json({ message: "Platform administration unavailable" });
  }
}

export function requirePermission(permission: PlatformPermission) {
  if (!isPlatformPermission(permission)) throw new Error("PLATFORM_PERMISSION_INVALID");
  return (req: Request & { adminSession?: AdminSession }, res: Response, next: NextFunction) => {
    const admin = req.adminSession;
    if (!admin || !hasPlatformPermission(admin.authority, permission)) {
      return res.status(403).json({ message: "Permission denied", required_permission: permission });
    }
    if (!satisfiesAdminActionAssurance(permission, admin.assurance)) {
      return res.status(403).json({ message: "Additional session assurance required" });
    }
    return next();
  };
}

export const adminRateLimit = Object.freeze({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many admin requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
