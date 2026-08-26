export interface AuthErrorPresentation {
  title?: string;
  message: string;
  supportText?: string;
}

export function authErrorPresentation(
  error: unknown,
  fallback: string,
): AuthErrorPresentation {
  if (!(error instanceof Error)) return { message: fallback };
  const raw = error.message.replace(/^\d+:\s*/, "");
  try {
    const parsed = JSON.parse(raw) as Partial<AuthErrorPresentation>;
    if (typeof parsed.message !== "string") return { message: fallback };
    return {
      ...(typeof parsed.title === "string" ? { title: parsed.title } : {}),
      message: parsed.message,
      ...(typeof parsed.supportText === "string"
        ? { supportText: parsed.supportText }
        : {}),
    };
  } catch {
    return { message: raw || fallback };
  }
}
