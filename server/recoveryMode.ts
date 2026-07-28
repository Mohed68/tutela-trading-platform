import type { RequestHandler } from "express";

export const RECOVERY_MODE_VARIABLE = "TUTELA_RECOVERY_MODE";

const SAFE_RECOVERY_API_ROUTES = new Set([
  "/api/health",
  "/api/commodities",
  "/api/offers",
  "/api/offers/options",
  "/api/offers/search",
  "/api/offers/summary",
  "/api/auth/user",
  "/api/dashboard/overview",
]);

const SAFE_RECOVERY_AUTH_WRITES = new Map([
  ["/api/auth/login", new Set(["POST"])],
  ["/api/auth/logout", new Set(["POST"])],
  ["/api/drafts", new Set(["GET", "POST"])],
  ["/api/drafts/options", new Set(["GET"])],
]);
const SAFE_RECOVERY_DRAFT_DETAIL_METHODS = new Set([
  "GET",
  "PATCH",
  "DELETE",
]);

export type RecoveryEnvironment = Readonly<
  Record<string, string | undefined>
>;

export function isRecoveryMode(
  environment: RecoveryEnvironment = process.env,
): boolean {
  return environment.TUTELA_RECOVERY_MODE === "true";
}

export function assertRecoveryModeIsLocal(
  environment: RecoveryEnvironment = process.env,
): void {
  if (!isRecoveryMode(environment)) return;
  if (environment.NODE_ENV === "production") {
    throw new Error(
      "TUTELA recovery mode cannot run with NODE_ENV=production.",
    );
  }
  if (environment.RENDER) {
    throw new Error("TUTELA recovery mode cannot run on Render.");
  }
}

export function shouldRunStartupSeeding(
  environment: RecoveryEnvironment = process.env,
): boolean {
  return !isRecoveryMode(environment);
}

export function shouldInitializeExternalMonitoring(
  environment: RecoveryEnvironment = process.env,
): boolean {
  return !isRecoveryMode(environment);
}

export function isSafeRecoveryRequest(method: string, path: string): boolean {
  if (SAFE_RECOVERY_AUTH_WRITES.get(path)?.has(method)) {
    return true;
  }
  if (
    /^\/api\/drafts\/[^/]+\/submit$/.test(path) &&
    method === "POST"
  ) {
    return true;
  }
  if (
    /^\/api\/drafts\/[^/]+$/.test(path) &&
    SAFE_RECOVERY_DRAFT_DETAIL_METHODS.has(method)
  ) {
    return true;
  }
  return (
    (method === "GET" || method === "HEAD") &&
    SAFE_RECOVERY_API_ROUTES.has(path)
  );
}

export const recoveryModeGuard: RequestHandler = (request, response, next) => {
  if (!isRecoveryMode()) {
    next();
    return;
  }

  if (!request.path.startsWith("/api") && !request.path.startsWith("/admin")) {
    next();
    return;
  }

  if (isSafeRecoveryRequest(request.method, request.path)) {
    next();
    return;
  }

  response.status(503).json({
    message: "Route unavailable during controlled recovery characterization.",
  });
};
