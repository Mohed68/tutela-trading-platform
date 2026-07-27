import type { RequestHandler } from "express";

export const RECOVERY_MODE_VARIABLE = "TUTELA_RECOVERY_MODE";

const SAFE_RECOVERY_API_ROUTES = new Set([
  "/api/health",
  "/api/commodities",
  "/api/offers",
  "/api/auth/user",
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

export const recoveryModeGuard: RequestHandler = (request, response, next) => {
  if (!isRecoveryMode()) {
    next();
    return;
  }

  if (!request.path.startsWith("/api") && !request.path.startsWith("/admin")) {
    next();
    return;
  }

  if (
    (request.method === "GET" || request.method === "HEAD") &&
    SAFE_RECOVERY_API_ROUTES.has(request.path)
  ) {
    next();
    return;
  }

  response.status(503).json({
    message: "Route unavailable during controlled recovery characterization.",
  });
};
