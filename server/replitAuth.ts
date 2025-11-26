import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// ---------------------------------------------------------------------------
// Auth mode configuration
// ---------------------------------------------------------------------------

const AUTH_MODE = (process.env.AUTH_MODE ?? "local").toLowerCase();
const IS_DEMO_MODE = process.env.DEMO_MODE === "true";
const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

// في Render نستخدم always local unless أنت تغير المتغيرات يدويًا
const USE_LOCAL_AUTH =
  AUTH_MODE === "local" || IS_DEMO_MODE || IS_DEVELOPMENT;

// هذا الـ user اللي بنستخدمه في الـ local/dev/demo
const LOCAL_USER = {
  // حقول top-level بحيث أي كود يقرأ user.sub أو user.email يشتغل
  sub: "local-admin",
  email: "admin@tutela.local",
  first_name: "Local",
  last_name: "Admin",
  profile_image_url: "",

  // claims بنفس البنية اللي ترجع من OIDC
  claims: {
    sub: "local-admin",
    email: "admin@tutela.local",
    first_name: "Local",
    last_name: "Admin",
    profile_image_url: "",
    // نعطيه expiration بعيد جداً
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  },

  access_token: undefined as string | undefined,
  refresh_token: undefined as string | undefined,
  expires_at: Number.MAX_SAFE_INTEGER,
} as const;

// لو فعلياً حابين نشغّل Replit OIDC لازم تتوفر REPLIT_DOMAINS
if (AUTH_MODE === "replit" && !process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

// ---------------------------------------------------------------------------
// OIDC config + session store
// ---------------------------------------------------------------------------

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

  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
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
      maxAge: sessionTtl,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
}

function updateUserSession(
  user: any,
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
  });
}

// ---------------------------------------------------------------------------
// setupAuth: تشغيل الـ session و/أو Replit OIDC حسب الـ mode
// ---------------------------------------------------------------------------

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // في local/dev/demo ما نفعّل OIDC إطلاقاً
  if (USE_LOCAL_AUTH) {
    return;
  }

  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {};
    updateUserSession(user, tokens);
    await upsertUserFromClaims(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env.REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });

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

// ---------------------------------------------------------------------------
// isAuthenticated middleware
// ---------------------------------------------------------------------------

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (USE_LOCAL_AUTH) {
    // نحقن local-admin بشكل صريح وبنفس البنية المتوقعة
    const localUser: any = {
      ...LOCAL_USER,
      claims: { ...LOCAL_USER.claims },
    };

    req.user = localUser;

    // نحاول نتأكد أن المستخدم موجود في الـ DB (لأجل /api/auth/user وغيره)
    try {
      await storage.upsertUser({
        id: localUser.sub,
        email: localUser.email,
        firstName: localUser.first_name,
        lastName: localUser.last_name,
        profileImageUrl: localUser.profile_image_url,
      });
    } catch (err) {
      console.error("Failed to upsert local user:", err);
    }

    return next();
  }

  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    console.error("Failed to refresh token:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
