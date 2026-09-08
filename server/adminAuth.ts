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
import { ADMIN_ACTION_ASSURANCE, satisfiesAdminActionAssurance } from "./admin-security/index.js";
import { PLATFORM_OWNER_ADMIN_PERMISSIONS } from "./admin-security/index.js";
import { createPlatformOwnershipService, type PlatformOwnershipReadPort } from "./platform-ownership/index.js";

export interface AdminSession {
  readonly userId: string;
  readonly principalId: string;
  readonly roles: PlatformAuthorityResolution["activeRoles"];
  readonly permissions: PlatformAuthorityResolution["permissions"];
  readonly assurance: SessionAssurance;
  readonly isPlatformOwner: boolean;
  readonly authority: PlatformAuthorityResolution;
}

let authorityReadPort: PlatformAuthorityReadPort | null = null;
let ownershipReadPort: PlatformOwnershipReadPort | null = null;

export function configurePrivilegedAdminAuthorization(readPort: PlatformAuthorityReadPort, ownership?: PlatformOwnershipReadPort): void {
  authorityReadPort = readPort;
  ownershipReadPort = ownership ?? null;
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
    const ownership = ownershipReadPort ? await createPlatformOwnershipService({ read: ownershipReadPort, mutations: { async commitOwnershipGrant(){ throw new Error("READ_ONLY"); }, async commitOwnershipRevocation(){ throw new Error("READ_ONLY"); } } }).resolveOwner(userId) : null;
    const assurance = getSessionAssurance(req.session);
    const isPlatformOwner = ownership?.state === "active_owner" && ownership.principalId === authority.principalId;
    if (authority.state !== "resolved" || !authority.principalId || (authority.permissions.length === 0 && !isPlatformOwner) || !assurance) {
      return res.status(403).json({ message: "Platform access denied" });
    }
    req.adminSession = Object.freeze({
      userId,
      principalId: authority.principalId,
      roles: authority.activeRoles,
      permissions: Object.freeze([...new Set([...authority.permissions, ...(isPlatformOwner ? PLATFORM_OWNER_ADMIN_PERMISSIONS : [])])].sort()),
      assurance: assurance.level,
      isPlatformOwner,
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
    const ownerPermission = Boolean(admin?.isPlatformOwner && PLATFORM_OWNER_ADMIN_PERMISSIONS.includes(permission));
    if (!admin || (!hasPlatformPermission(admin.authority, permission) && !ownerPermission)) {
      return res.status(403).json({ message: "Permission denied", required_permission: permission });
    }
    if (!satisfiesAdminActionAssurance(permission, admin.assurance)) {
      const required = ADMIN_ACTION_ASSURANCE[permission];
      return res.status(403).json({ message: "Additional session assurance required", code: `${required}_required`, required_assurance: required });
    }
    return next();
  };
}

export function requirePlatformOwner(req: Request & { adminSession?: AdminSession }, res: Response, next: NextFunction) {
  if (!req.adminSession?.isPlatformOwner) return res.status(403).json({ message: "Platform Owner authority required", code: "platform_owner_required" });
  return next();
}

export const adminRateLimit = Object.freeze({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many admin requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
