if (process.env.RENDER) {
  throw new Error("Controlled recovery startup is not permitted on Render.");
}
if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) {
  throw new Error(
    "DATABASE_URL and SESSION_SECRET are required for controlled recovery startup.",
  );
}

process.env.NODE_ENV = "development";
process.env.TUTELA_RECOVERY_MODE = "true";
process.env.DEMO_AUTH_BYPASS = "false";
process.env.DEMO_MODE = "false";
process.env.AUTO_VERIFY_DEMO = "false";
process.env.VITE_SENTRY_DSN = "";
process.env.PORT = process.env.TUTELA_RECOVERY_PORT || "5055";

await import("../server/index.js");
