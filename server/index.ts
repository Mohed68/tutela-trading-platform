import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { securityHeaders, permissionsPolicy, additionalHeaders, productionHeaders } from "./security";
import { initializeServerMonitoring, setupSentryMiddleware, setupSentryErrorHandler } from "./monitoring";
import { verifyDatabaseSchema } from "./databaseHealth";
import { pool } from "./db";
import {
  assertRecoveryModeIsLocal,
  isRecoveryMode,
  recoveryModeGuard,
} from "./recoveryMode";
import { safeErrorMessage } from "./safeErrors";
import { startVerificationWorker } from "./verification/worker";

assertRecoveryModeIsLocal();
const recoveryMode = isRecoveryMode();

// Initialize Sentry monitoring first (disabled in controlled recovery mode).
initializeServerMonitoring();

const app = express();

// Setup Sentry middleware early
setupSentryMiddleware(app);

// Compression middleware for better performance
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Security Headers Configuration
app.use(helmet(securityHeaders));

// Disable x-powered-by header
app.disable('x-powered-by');

// Additional custom security headers
app.use((req, res, next) => {
  // Permissions Policy (formerly Feature Policy)
  res.setHeader('Permissions-Policy', permissionsPolicy);

  // Apply additional security headers
  Object.entries(additionalHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  // In production, add additional security headers
  if (process.env.NODE_ENV === 'production') {
    Object.entries(productionHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(recoveryModeGuard);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  const schemaVerification = await verifyDatabaseSchema({
    allowLegacyAuthenticationSchema: recoveryMode,
  });
  log("database connectivity and required schema verified");
  if (schemaVerification.legacyAuthenticationColumnsMissing.length > 0) {
    console.warn(
      "Controlled recovery mode: unresolved local-authentication columns " +
        "remain unavailable; authentication writes are blocked",
    );
  }

  const server = await registerRoutes(app);
  const verificationWorkerDisabled =
    recoveryMode &&
    process.env.NODE_ENV !== "production" &&
    process.env.TUTELA_VERIFICATION_WORKER_DISABLED === "true";
  const stopVerificationWorker = verificationWorkerDisabled
    ? () => undefined
    : startVerificationWorker({
        onError: (message) =>
          console.error(`Verification worker failed safely: ${message}`),
      });

  // Setup Sentry error handler after all routes
  setupSentryErrorHandler(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = Number(err?.status || err?.statusCode || 500);
    const isServerError = status >= 500;
    const message = isServerError && process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : (err?.message || "Internal Server Error");

    if (isServerError) {
      console.error("Unhandled request error:", err);
    }

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });

  const shutdown = (signal: string) => {
    log(`${signal} received; shutting down gracefully`);
    stopVerificationWorker();
    server.close(async () => {
      try {
        await pool.end();
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
})().catch((error) => {
  console.error(`TUTELA failed to start: ${safeErrorMessage(error)}`);
  process.exit(1);
});
