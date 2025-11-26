import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

//
// ────────────────────────────────────────────────────────────────
//  Auth mode flags
// ────────────────────────────────────────────────────────────────
//

const AUTH_MODE = (process.env.AUTH_MODE ?? "local").toLowerCase();
const IS_DEMO_MODE = process.env.DEMO_MODE === "true";
const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

const USE_LOCAL_AUTH =
  AUTH_MODE === "local" || IS_DEMO_MODE || IS_DEVELOPMENT;

type AuthUser = {
  claims?: any;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  [key: string]: any;
};

//
// ────────────────────────────────────────────────────────────────
//  Session store (Postgres via connect-pg-simple)
// ────────────────────────────────────────────────────────────────
//

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const PgStore = connectPg(session);

  const sessionStore = new PgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: AuthUser,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUserFromClaims(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
    companyName: claims["company_name"],
    role: claims["role"],
  });
}

//
// ────────────────────────────────────────────────────────────────
//  setupAuth: session + passport + routes
// ────────────────────────────────────────────────────────────────
//

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  //
  // Local / demo / dev mode: NO Replit OIDC at all
  //
  if (USE_LOCAL_AUTH) {
    // مسارات بسيطة للـ login/callback/logout في الوضع المحلي
    app.get("/api/login", (_req, res) => res.redirect("/"));
    app.get("/api/callback", (_req, res) => res.redirect("/"));
    app.get("/api/logout", (req, res) => {
      req.logout?.(() => undefined);
      req.session?.destroy(() => undefined);
      res.redirect("/");
    });

    // لا نجهز أي Strategies لـ Replit في هذا الوضع
    return;
  }

  //
  // Replit OIDC mode: require REPLIT_DOMAINS and configure passport
  //
  if (AUTH_MODE === "replit" && !process.env.REPLIT_DOMAINS) {
    throw new Error("Environment variable REPLIT_DOMAINS not provided");
  }

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: AuthUser = {};
    updateUserSession(user, tokens);
    await upsertUserFromClaims(tokens.claims());
    verified(null, user);
  };

  const domains = (process.env.REPLIT_DOMAINS ?? "").split(",");
  for (const domain of domains) {
    const trimmed = domain.trim();
    if (!trimmed) continue;

    const strategy = new Strategy(
      {
        name: `replitauth:${trimmed}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${trimmed}/api/callback`,
      },
      verify
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

//
// ────────────────────────────────────────────────────────────────
//  isAuthenticated: local/demo/dev vs Replit OIDC
// ────────────────────────────────────────────────────────────────
//

// هنا دمجت منطق Codex اللي أرسلته لي (demo/local user من storage)
// مع منطق الـ OIDC الأصلي
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const isLocalMode =
    AUTH_MODE === "local" ||
    IS_DEMO_MODE ||
    IS_DEVELOPMENT;

  if (isLocalMode) {
    const demoUserId =
      AUTH_MODE === "local" ? "local-admin" : "demo-user";

    try {
      let demoUser = await storage.getUser(demoUserId);

      if (!demoUser) {
        demoUser = await storage.upsertUser({
          id: demoUserId,
          email: `${demoUserId}@example.com`,
          firstName: "Demo",
          lastName: "User",
          profileImageUrl: undefined,
          companyName: "Demo Company",
          role: "admin",
        });
      }

      (req as any).user = demoUser as any;
    } catch (error) {
      console.error("Failed to ensure demo user:", error);
      (req as any).user = { id: demoUserId } as any;
    }

    return next();
  }

  const user = req.user as AuthUser;

  if (!req.isAuthenticated?.() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
