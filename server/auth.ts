import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { Pool as PgPool } from "pg";
import { storage } from "./storage";
import { hashPassword, verifyPassword } from "./password";
import { isRecoveryMode } from "./recoveryMode";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = "tutela.sid";
let sessionPool: PgPool | undefined;

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

function toPassportUser(user: any): Express.User {
  return {
    id: user.id,
    email: user.email ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    profileImageUrl: user.profileImageUrl ?? null,
    claims: {
      sub: user.id,
      email: user.email ?? null,
      first_name: user.firstName ?? null,
      last_name: user.lastName ?? null,
      profile_image_url: user.profileImageUrl ?? null,
    },
  };
}

function publicUser(user: any) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
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

const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(200),
});

export async function setupAuth(app: Express) {
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy({ usernameField: "email", passwordField: "password" }, async (email, password, done) => {
    try {
      const user = await storage.getUserByEmail(email);
      if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
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
      const user = await storage.getUser(id);
      done(null, user ? toPassportUser(user) : false);
    } catch (error) {
      done(error);
    }
  });

  app.get("/api/login", (_req, res) => res.redirect("/login"));

  app.post("/api/auth/register", authLimiter, async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid registration details.", errors: parsed.error.flatten().fieldErrors });
      if (await storage.getUserByEmail(parsed.data.email)) return res.status(409).json({ message: "An account with this email already exists." });
      const user = await storage.createLocalUser({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        authProvider: "local",
      });
      req.login(toPassportUser(user), (error) => {
        if (error) return next(error);
        res.status(201).json(publicUser(user));
      });
    } catch (error) { next(error); }
  });

  app.post("/api/auth/login", authLimiter, (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "A valid email and password are required." });
    req.body = parsed.data;
    passport.authenticate("local", (error: unknown, user: Express.User | false, info?: { message?: string }) => {
      if (error) return next(error);
      if (!user) return res.status(401).json({ message: info?.message ?? "Invalid email or password." });
      req.login(user, async (loginError) => {
        if (loginError) return next(loginError);
        const storedUser = await storage.getUser(user.id);
        res.json(storedUser ? publicUser(storedUser) : user);
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
    const user = await storage.getUser(req.user!.claims.sub);
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json(publicUser(user));
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (process.env.DEMO_AUTH_BYPASS === "true" && process.env.NODE_ENV !== "production") {
    const demoUserId = "demo-user";
    let user = await storage.getUser(demoUserId);
    if (!user) user = await storage.upsertUser({ id: demoUserId, email: "demo@tutela.com", firstName: "Demo", lastName: "User" });
    req.user = toPassportUser(user);
    return next();
  }
  if (!req.isAuthenticated() || !req.user?.claims?.sub) return res.status(401).json({ message: "Unauthorized" });
  next();
};
