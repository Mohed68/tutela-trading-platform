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
  ACTIVE_CREDENTIAL_STATUS,
  LOCAL_AUTH_PROVIDER,
  RECOVERY_PROVENANCE,
  type AuthenticationIdentity,
  type CurrentUserDto,
} from "@shared/auth";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = "tutela.sid";
let sessionPool: PgPool | undefined;
let unavailableCredentialHash: Promise<string> | undefined;

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
  return Boolean(
    user &&
      user.authProvider === LOCAL_AUTH_PROVIDER &&
      user.loginEnabled === true &&
      user.credentialStatus === ACTIVE_CREDENTIAL_STATUS &&
      user.passwordHash &&
      user.role === "trader" &&
      user.recoveryProvenance === RECOVERY_PROVENANCE,
  );
}

export function toCurrentUserDto(
  user: AuthenticationIdentity & { passwordHash: string },
): CurrentUserDto {
  if (!isLocallyAuthenticatable(user)) {
    throw new Error("AUTHENTICATION_AUTHORITY_REQUIRED");
  }
  return {
    id: user.id,
    displayName: "Recovery trader",
    role: "trader",
    authenticated: true,
    accountState: "active",
    organizationDisplayName: null,
    emailVerified: "unknown",
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
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: SESSION_TTL_MS,
    },
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

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

export async function setupAuth(app: Express) {
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy({ usernameField: "email", passwordField: "password" }, async (email, password, done) => {
    try {
      const user = await storage.getAuthenticationUserByEmail(email);
      const authorized = isLocallyAuthenticatable(user);
      const passwordValid = await verifyPassword(
        password,
        authorized ? user.passwordHash : await getUnavailableCredentialHash(),
      );
      if (!authorized || !passwordValid) {
        return done(null, false, { message: "Invalid email or password." });
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

  app.post("/api/auth/register", (_req, res) => {
    res.status(403).json({ message: "Registration is unavailable." });
  });

  app.post("/api/auth/login", authLimiter, (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    req.body = parsed.data;
    passport.authenticate("local", (error: unknown, user: Express.User | false, info?: { message?: string }) => {
      if (error) return next(error);
      if (!user) return res.status(401).json({ message: info?.message ?? "Invalid email or password." });
      req.login(user, async (loginError) => {
        if (loginError) return next(loginError);
        const storedUser = await storage.getAuthenticationUser(user.id);
        if (!isLocallyAuthenticatable(storedUser)) {
          return res.status(401).json({ message: "Invalid email or password." });
        }
        res.json(toCurrentUserDto(storedUser));
      });
    })(req, res, next);
  });

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
