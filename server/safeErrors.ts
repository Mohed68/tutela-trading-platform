const SENSITIVE_ENVIRONMENT_KEYS = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "STRIPE_SECRET_KEY",
  "OPENAI_API_KEY",
  "SENTRY_BACKEND_DSN",
  "SENTRY_DSN",
] as const;

function replaceAllLiteral(
  source: string,
  sensitiveValue: string | undefined,
): string {
  if (!sensitiveValue) return source;
  return source.split(sensitiveValue).join("[REDACTED]");
}

export function safeErrorMessage(
  error: unknown,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const source = error instanceof Error ? error.message : String(error);
  let redacted = source;

  for (const key of SENSITIVE_ENVIRONMENT_KEYS) {
    redacted = replaceAllLiteral(redacted, environment[key]);
  }

  redacted = redacted
    .replace(
      /\b(postgres(?:ql)?):\/\/[^@\s/]+@/gi,
      "$1://[REDACTED]@",
    )
    .replace(/\bhttps:\/\/[^@\s/]+@/gi, "https://[REDACTED]@");

  return redacted || "Unknown error";
}
