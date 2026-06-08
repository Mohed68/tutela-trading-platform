import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// --- Auth mode configuration ----------------------------------------

const AUTH_MODE = process.env.AUTH_MODE ?? "local";
const IS_DEMO_MODE = process.env.DEMO_MODE === "true";
const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

if (IS_PRODUCTION && AUTH_MODE === "local") {
  throw new Error("AUTH_MODE=local is not allowed in production.");
}

if (IS_PRODUCTION && IS_DEMO_MODE) {
  throw new Error("DEMO_MODE=true is not allowed in production.");
}

if (
  IS_PRODUCTION &&
  (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
) {
  throw new Error("SESSION_SECRET must be set and at least 32 characters in production.");
}

// إذا كنا في local / demo / development نستخدم مستخدم محلي وهمي
const USE_LOCAL_AUTH = AUTH_MODE === "local" || IS_DEMO_MODE || IS_DEVELOPMENT;

const LOCAL_USER = {
  claims: {
    sub: "local-admin",
    email: "admin@tutela.local",
    first_name: "Local",
    last_name: "Admin",
    profile_image_url: "",
    // نجعل الصلاحية طويلة حتى لا ينتهي الـ session بسهولة في هذه الأوضاع
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  },
  access_token: undefined as string | undefined,
  refresh_token: undefined as string | undefined,
  expires_at: Number.MAX_SAFE_INTEGER,
};

if (AUTH_MODE === "replit" && !process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

// --- OIDC config helper (يُستخدم فقط في وضع replit) ----------------

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

// --- Session setup ---------------------------------------------------

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
    cookie: {
      maxAge: sessionTtl,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    resave: false,
    saveUninitialized: false,
  });
}

// --- Helpers to sync tokens into user object ------------------------

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

// --- Main auth setup -------------------------------------------------

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // في أوضاع local/demo/development نستخدم مستخدم محلي ولا نفعّل OIDC
  if (USE_LOCAL_AUTH) {
    return;
  }

  // من هنا وطالع يعمل فقط إذا AUTH_MODE ليس local/demo/dev
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // نكوّن إستراتيجية لكل domain مذكور في REPLIT_DOMAINS
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

    passport.serializeUser((user, done) => {
      done(null, user);
    });

    passport.deserializeUser((obj: any, done) => {
      done(null, obj);
    });
  }

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

// --- Auth middleware used by routes ---------------------------------

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // في local/demo/dev نحقن مستخدم محلي ثابت
  if (USE_LOCAL_AUTH) {
    req.user = { ...LOCAL_USER, claims: { ...LOCAL_USER.claims } } as any;
    return next();
  }

  const user = req.user as any;

  if (!req.isAuthenticated?.() || !user?.expires_at) {
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
