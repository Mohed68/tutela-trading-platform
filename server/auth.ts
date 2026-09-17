import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { randomBytes } from "node:crypto";
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { Pool as PgPool } from "pg";
import { storage } from "./storage";
import { hashPassword, verifyPassword } from "./password";
import { isRecoveryMode } from "./recoveryMode";
import {
  activateLocalAccount,
  registerLocalAccount,
  registerTemporaryDirectLocalAccount,
  requestAuthenticatedEmailVerification,
  registrationSchema,
} from "./registration";
import { getRegistrationActivationMode } from "./registrationPolicy";
import {
  createResendVerificationEmailSender,
  getVerificationEmailConfiguration,
} from "./verificationEmail";
import {
  ACTIVE_CREDENTIAL_STATUS,
  LOCAL_AUTH_PROVIDER,
  RECOVERY_PROVENANCE,
  TEMPORARY_DIRECT_REGISTRATION_PROVENANCE,
  type AuthenticationIdentity,
  type CurrentUserDto,
} from "@shared/auth";
import {
  BUSINESS_EMAIL_REJECTION,
  usesBlockedPublicEmailDomain,
} from "@shared/businessEmail";
import {
  hasMfaAssurance,
  hasRecentStepUp,
  markAuthenticated,
  markMfaSatisfied,
  markStepUpSatisfied,
} from "./session-assurance/index.js";
import { createPostgresSessionInvalidationPort } from "./admin-security/index.js";
import {
  TotpMfaService,
  requireMfaEncryptionKey,
} from "./mfa/index.js";
import { createPasswordRecoveryService } from "./passwordRecovery.js";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = "tutela.sid";
let sessionPool: PgPool | undefined;
let unavailableCredentialHash: Promise<string> | undefined;
let mfaService: TotpMfaService | null | undefined;

export function getSessionCookieSettings(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: environment.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}

function getSessionPool(): PgPool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set before starting the server.");
  }
  sessionPool ??= new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.SESSION_DB_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return sessionPool;
}

function getMfaService(): TotpMfaService | null {
  if (mfaService !== undefined) return mfaService;
  try {
    mfaService = new TotpMfaService({
      pool: getSessionPool(),
      encryptionKey: requireMfaEncryptionKey(),
    });
  } catch {
    mfaService = null;
  }
  return mfaService;
}

function toPassportUser(user: AuthenticationIdentity): Express.User {
  return {
    id: user.id,
    email: null,
    firstName: null,
    lastName: null,
    profileImageUrl: null,
    claims: {
      sub: user.id,
      email: null,
      first_name: null,
      last_name: null,
      profile_image_url: null,
    },
  };
}

export function isLocallyAuthenticatable(
  user: AuthenticationIdentity | undefined,
): user is AuthenticationIdentity & { passwordHash: string } {
  if (!user) return false;
  const hasApprovedAuthority =
    user.recoveryProvenance === RECOVERY_PROVENANCE ||
    user.recoveryProvenance === TEMPORARY_DIRECT_REGISTRATION_PROVENANCE ||
    (user.recoveryProvenance === null && user.emailVerifiedAt instanceof Date);
  return Boolean(
      user.authProvider === LOCAL_AUTH_PROVIDER &&
      user.loginEnabled === true &&
      user.credentialStatus === ACTIVE_CREDENTIAL_STATUS &&
      user.passwordHash &&
      user.role === "trader" &&
      hasApprovedAuthority,
  );
}

export function isPendingEmailVerification(
  user: AuthenticationIdentity | undefined,
): user is AuthenticationIdentity & { passwordHash: string } {
  return Boolean(
    user?.authProvider === LOCAL_AUTH_PROVIDER &&
      user.loginEnabled === false &&
      user.credentialStatus === ACTIVE_CREDENTIAL_STATUS &&
      user.passwordHash &&
      user.role === "trader" &&
      user.recoveryProvenance === null &&
      (user.emailVerifiedAt === null || user.emailVerifiedAt === undefined),
  );
}

export function toCurrentUserDto(
  user: AuthenticationIdentity & { passwordHash: string },
): CurrentUserDto {
  if (!isLocallyAuthenticatable(user)) {
    throw new Error("AUTHENTICATION_AUTHORITY_REQUIRED");
  }
  const recoveryAccount = user.recoveryProvenance === RECOVERY_PROVENANCE;
  const temporaryDirectAccount =
    user.recoveryProvenance === TEMPORARY_DIRECT_REGISTRATION_PROVENANCE;
  const displayName = recoveryAccount
    ? "Recovery trader"
    : [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
  return {
    id: user.id,
    displayName,
    email: user.email ?? null,
    role: "trader",
    authenticated: true,
    accountState: "active",
    organizationDisplayName: user.companyName ?? null,
    emailVerified: recoveryAccount || temporaryDirectAccount ? "unknown" : "verified",
    userVerified: "unknown",
    kybState: "unknown",
    organizationVerification: "unknown",
  };
}

async function getUnavailableCredentialHash(): Promise<string> {
  unavailableCredentialHash ??= hashPassword(
    randomBytes(32).toString("base64url"),
  );
  return unavailableCredentialHash;
}

export function getSession() {
  const isProduction = process.env.NODE_ENV === "production";
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set before starting the server.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set before starting the server.");
  }
  const PgStore = connectPgSimple(session);
  return session({
    name: COOKIE_NAME,
    store: new PgStore({
      pool: getSessionPool(),
      tableName: "sessions",
      createTableIfMissing: false,
      ...(isRecoveryMode() ? { pruneSessionInterval: false } : {}),
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    proxy: isProduction,
    cookie: getSessionCookieSettings(),
  });
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many authentication attempts. Please try again later." },
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many registration attempts. Please try again later.",
  },
});

const verificationResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { message: "Too many verification email requests. Please try again later." },
});
const passwordRecoveryLimiter=rateLimit({windowMs:60*60*1000,limit:6,standardHeaders:true,legacyHeaders:false,
  message:{message:"Too many password recovery attempts. Please try again later."}});

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

const totpCodeSchema = z.string().trim().regex(/^\d{6}$/u);
const mfaChallengeCodeSchema = z.string().trim().min(6).max(32);
const enrollmentConfirmationSchema = z.object({
  credentialId: z.string().uuid(),
  code: totpCodeSchema,
});
const mfaRevocationSchema = z.object({ reason: z.string().trim().min(10).max(500) });

const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many MFA attempts. Please try again later." },
});

function mfaUnavailable(res: Parameters<RequestHandler>[1]) {
  return res.status(503).json({ message: "MFA is temporarily unavailable." });
}

function challengeResponse(
  result: Awaited<ReturnType<TotpMfaService["verifyChallenge"]>>,
  res: Parameters<RequestHandler>[1],
) {
  if (result.status === "locked") {
    res.setHeader("Retry-After", result.retryAfterSeconds.toString());
    return res.status(429).json({
      message: "MFA verification is temporarily locked.",
    });
  }
  if (result.status === "invalid") {
    return res.status(401).json({ message: "The code could not be verified. Wait for a new authenticator code and try again." });
  }
  return null;
}

export async function setupAuth(app: Express) {
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy({ usernameField: "email", passwordField: "password" }, async (email, password, done) => {
    try {
      const user = await storage.getAuthenticationUserByEmail(email);
      const authorized = isLocallyAuthenticatable(user);
      const pendingEmailVerification = isPendingEmailVerification(user);
      const passwordValid = await verifyPassword(
        password,
        authorized || pendingEmailVerification
          ? user.passwordHash
          : await getUnavailableCredentialHash(),
      );
      if (pendingEmailVerification && passwordValid) {
        return done(null, false, { message: "Email verification required." });
      }
      if (!authorized || !passwordValid) {
        return done(null, false, { message: "Email or password is incorrect." });
      }
      await storage.updateLastLogin(user.id);
      return done(null, toPassportUser(user));
    } catch (error) {
      return done(error);
    }
  }));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getAuthenticationUser(id);
      done(null, isLocallyAuthenticatable(user) ? toPassportUser(user) : false);
    } catch (error) {
      done(error);
    }
  });

  app.get("/api/login", (_req, res) => res.redirect("/login"));

  app.post("/api/auth/password/forgot",passwordRecoveryLimiter,async(req,res)=>{
    const configuration=getVerificationEmailConfiguration();
    if(!configuration)return res.status(503).json({message:"Password recovery is temporarily unavailable."});
    try{await createPasswordRecoveryService(getSessionPool(),configuration).request(req.body?.email);}
    catch{/* Preserve the same non-enumerating response even when delivery fails. */}
    return res.status(202).json({message:"If an eligible account exists, a password reset email will arrive shortly."});
  });
  app.post("/api/auth/password/reset",authLimiter,async(req,res)=>{
    const configuration=getVerificationEmailConfiguration();
    if(!configuration)return res.status(503).json({message:"Password recovery is temporarily unavailable."});
    try{
      const reset=await createPasswordRecoveryService(getSessionPool(),configuration).reset(req.body?.token,req.body?.password);
      if(!reset)return res.status(400).json({message:"This password reset link is invalid or has expired."});
      return res.json({status:"reset",sessionsInvalidated:true,mfaPreserved:true});
    }catch{return res.status(503).json({message:"Password recovery is temporarily unavailable."});}
  });

  app.post("/api/auth/register", registrationLimiter, async (req, res, next) => {
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) {
      if (
        typeof req.body?.email === "string" &&
        usesBlockedPublicEmailDomain(req.body.email)
      ) {
        return res.status(400).json(BUSINESS_EMAIL_REJECTION);
      }
      return res.status(400).json({
        message:
          "Enter a valid name, email, and a 12-character password containing uppercase, lowercase, and numeric characters.",
      });
    }

    const activationMode = getRegistrationActivationMode();
    if (activationMode === "temporary_direct") {
      try {
        await registerTemporaryDirectLocalAccount(parsed.data, { storage });
        return res.status(201).json({
          activation: "direct",
          message: "Your account is ready to sign in.",
        });
      } catch {
        return res.status(503).json({
          message: "Account registration is temporarily unavailable.",
        });
      }
    }

    const configuration = getVerificationEmailConfiguration();
    if (!configuration) {
      return res.status(503).json({
        message: "Account registration is temporarily unavailable.",
      });
    }

    try {
      await registerLocalAccount(parsed.data, {
        storage,
        sender: createResendVerificationEmailSender(configuration),
        applicationBaseUrl: configuration.applicationBaseUrl,
      });
      return res.status(202).json({
        message:
          "If the address can be registered, a verification email will arrive shortly.",
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "EMAIL_VERIFICATION_DELIVERY_FAILED"
      ) {
        return res.status(503).json({
          message: "Account registration is temporarily unavailable.",
        });
      }
      return next(error);
    }
  });

  app.post(
    "/api/auth/email-verification/request",
    isAuthenticated,
    verificationResendLimiter,
    async (req, res, next) => {
      const configuration = getVerificationEmailConfiguration();
      if (!configuration) {
        return res.status(503).json({ message: "Email verification is temporarily unavailable." });
      }
      try {
        const result = await requestAuthenticatedEmailVerification(
          req.user!.claims.sub,
          {
            storage,
            sender: createResendVerificationEmailSender(configuration),
            applicationBaseUrl: configuration.applicationBaseUrl,
          },
        );
        if (result.status === "already_verified") {
          return res.json({ status: "already_verified" });
        }
        if (result.status === "cooldown") {
          res.setHeader("Retry-After", result.retryAfterSeconds.toString());
          return res.status(429).json({ message: "A verification email was sent recently. Please wait before trying again." });
        }
        if (result.status === "ineligible") {
          return res.status(403).json({ message: "Email verification is unavailable for this account." });
        }
        return res.json({ status: "sent", email: result.email });
      } catch (error) {
        if (error instanceof Error && error.message === "EMAIL_VERIFICATION_DELIVERY_FAILED") {
          return res.status(503).json({ message: "Email verification is temporarily unavailable." });
        }
        return next(error);
      }
    },
  );

  app.post("/api/auth/verify-email", authLimiter, async (req, res, next) => {
    try {
      const identity = await activateLocalAccount(req.body?.token, { storage });
      if (!identity || !isLocallyAuthenticatable(identity)) {
        return res.status(400).json({
          message: "This verification link is invalid or has expired.",
        });
      }

      const passportUser = toPassportUser(identity);
      req.login(passportUser, (error) => {
        if (error) return next(error);
        markAuthenticated(req.session);
        return res.json(toCurrentUserDto(identity));
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "This verification link is invalid or has expired.",
        });
      }
      return next(error);
    }
  });

  app.post("/api/auth/login", authLimiter, (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    req.body = parsed.data;
    passport.authenticate("local", (error: unknown, user: Express.User | false, info?: { message?: string }) => {
      if (error) return next(error);
      if (!user) return res.status(401).json({ message: info?.message ?? "Email or password is incorrect." });
      req.login(user, async (loginError) => {
        if (loginError) return next(loginError);
        markAuthenticated(req.session);
        const storedUser = await storage.getAuthenticationUser(user.id);
        if (!isLocallyAuthenticatable(storedUser)) {
          return res.status(401).json({ message: "Email or password is incorrect." });
        }
        res.json(toCurrentUserDto(storedUser));
      });
    })(req, res, next);
  });

  app.get("/api/auth/mfa/status", isAuthenticated, async (req, res, next) => {
    const service = getMfaService();
    if (!service) return mfaUnavailable(res);
    try {
      return res.json(await service.getStatus(req.user!.claims.sub));
    } catch (error) {
      return next(error);
    }
  });

  app.post(
    "/api/auth/mfa/enrollment",
    isAuthenticated,
    mfaLimiter,
    async (req, res, next) => {
      const service = getMfaService();
      if (!service) return mfaUnavailable(res);
      try {
        const user = await storage.getAuthenticationUser(req.user!.claims.sub);
        if (!isLocallyAuthenticatable(user) || !user.email) {
          return res.status(403).json({ message: "MFA enrollment unavailable." });
        }
        return res.status(201).json(
          await service.beginEnrollment(user.id, user.email),
        );
      } catch (error) {
        if (error instanceof Error && error.message === "MFA_ALREADY_ENROLLED") {
          return res.status(409).json({ message: "MFA is already enrolled." });
        }
        return next(error);
      }
    },
  );

  app.post(
    "/api/auth/mfa/enrollment/confirm",
    isAuthenticated,
    mfaLimiter,
    async (req, res, next) => {
      const parsed = enrollmentConfirmationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "The code could not be verified. Wait for a new authenticator code and try again." });
      }
      const service = getMfaService();
      if (!service) return mfaUnavailable(res);
      try {
        const result = await service.confirmEnrollment({
          userId: req.user!.claims.sub,
          ...parsed.data,
        });
        if (result.status === "invalid" || result.status === "locked") {
          return challengeResponse(result, res);
        }
        markMfaSatisfied(req.session, new Date());
        return res.json(result);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "MFA_PENDING_ENROLLMENT_NOT_FOUND"
        ) {
          return res.status(404).json({ message: "MFA enrollment not found." });
        }
        return next(error);
      }
    },
  );

  app.post(
    "/api/auth/mfa/challenge",
    isAuthenticated,
    mfaLimiter,
    async (req, res, next) => {
      const parsed = mfaChallengeCodeSchema.safeParse(req.body?.code);
      if (!parsed.success) {
        return res.status(400).json({ message: "The code could not be verified. Wait for a new authenticator code and try again." });
      }
      const service = getMfaService();
      if (!service) return mfaUnavailable(res);
      try {
        const result = await service.verifyChallenge(
          req.user!.claims.sub,
          parsed.data,
        );
        if (result.status === "invalid" || result.status === "locked") {
          return challengeResponse(result, res);
        }
        markMfaSatisfied(req.session, new Date());
        return res.json({ assurance: "mfa", method: result.method });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "MFA_ACTIVE_CREDENTIAL_NOT_FOUND"
        ) {
          return res.status(404).json({ message: "Active MFA not found." });
        }
        return next(error);
      }
    },
  );

  app.post(
    "/api/auth/mfa/step-up",
    isAuthenticated,
    mfaLimiter,
    async (req, res, next) => {
      const parsed = totpCodeSchema.safeParse(req.body?.code);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid authenticator code." });
      }
      const service = getMfaService();
      if (!service) return mfaUnavailable(res);
      try {
        const result = await service.verifyChallenge(
          req.user!.claims.sub,
          parsed.data,
        );
        if (result.status === "invalid" || result.status === "locked") {
          return challengeResponse(result, res);
        }
        if (result.method !== "totp") {
          return res.status(403).json({ message: "TOTP step-up required." });
        }
        // A fresh TOTP is itself the evidence required to establish MFA
        // assurance.  Step-up must work from an authenticated session; it
        // must not require a prior, separate MFA challenge that would consume
        // the same 30-second TOTP counter.
        const verifiedAt = new Date();
        markMfaSatisfied(req.session, verifiedAt);
        markStepUpSatisfied(req.session, verifiedAt);
        return res.json({ assurance: "recent_step_up" });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "MFA_ACTIVE_CREDENTIAL_NOT_FOUND"
        ) {
          return res.status(404).json({ message: "Active MFA not found." });
        }
        return next(error);
      }
    },
  );

  app.post(
    "/api/auth/mfa/revoke",
    isAuthenticated,
    mfaLimiter,
    async (req, res, next) => {
      const parsed = mfaRevocationSchema.safeParse(req.body);
      if (!parsed.success || !hasRecentStepUp(req.session)) {
        return res.status(403).json({ message: "Recent step-up required." });
      }
      const service = getMfaService();
      if (!service) return mfaUnavailable(res);
      try {
        const userId = req.user!.claims.sub;
        await service.revokeActiveCredential(userId, parsed.data.reason);
        await createPostgresSessionInvalidationPort(getSessionPool())
          .invalidateUserSessions(userId);
        req.logout((logoutError) => {
          if (logoutError) return next(logoutError);
          req.session.destroy((sessionError) => {
            if (sessionError) return next(sessionError);
            res.clearCookie(COOKIE_NAME, {
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/",
            });
            return res.json({ status: "revoked", sessionsInvalidated: true });
          });
        });
      } catch (error) {
        if (error instanceof Error && error.message === "MFA_ACTIVE_CREDENTIAL_NOT_FOUND") {
          return res.status(404).json({ message: "Active MFA not found." });
        }
        return next(error);
      }
    },
  );

  const logout = (req: any, res: any, redirect: boolean) => {
    req.logout((logoutError: unknown) => {
      if (logoutError) return res.status(500).json({ message: "Unable to log out." });
      req.session.destroy((sessionError: unknown) => {
        if (sessionError) return res.status(500).json({ message: "Unable to destroy session." });
        res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
        return redirect ? res.redirect("/") : res.json({ success: true });
      });
    });
  };

  app.get("/api/logout", (req, res) => logout(req, res, true));
  app.post("/api/auth/logout", (req, res) => logout(req, res, false));

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    const user = await storage.getAuthenticationUser(req.user!.claims.sub);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (!isLocallyAuthenticatable(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(toCurrentUserDto(user));
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (
    process.env.DEMO_AUTH_BYPASS === "true" &&
    process.env.NODE_ENV !== "production" &&
    !isRecoveryMode()
  ) {
    const demoUserId = "demo-user";
    let user = await storage.getUser(demoUserId);
    if (!user) user = await storage.upsertUser({ id: demoUserId, email: "demo@tutela.com", firstName: "Demo", lastName: "User" });
    req.user = toPassportUser(user);
    return next();
  }
  if (!req.isAuthenticated() || !req.user?.claims?.sub) return res.status(401).json({ message: "Unauthorized" });
  next();
};
