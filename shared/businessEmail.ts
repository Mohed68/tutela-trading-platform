export const BLOCKED_PUBLIC_EMAIL_DOMAINS = Object.freeze([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.fr",
  "yahoo.de",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "yandex.com",
  "yandex.ru",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "fastmail.com",
  "zoho.com",
] as const);

const blockedPublicEmailDomains = new Set<string>(BLOCKED_PUBLIC_EMAIL_DOMAINS);

export const BUSINESS_EMAIL_REJECTION = Object.freeze({
  code: "BUSINESS_EMAIL_REQUIRED",
  title: "Please use your company email address",
  message:
    "TUTELA is a B2B trading platform. Registration requires an official business email associated with your organization. Public email services such as Gmail, Outlook, Yahoo, and similar providers are not accepted.",
  supportText:
    "If your organization does not yet have a business email domain, contact TUTELA support.",
});

export function normalizedEmailDomain(email: string): string | undefined {
  const normalized = email.trim().toLowerCase();
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0 || separator === normalized.length - 1) return undefined;
  return normalized.slice(separator + 1);
}

export function usesBlockedPublicEmailDomain(email: string): boolean {
  const domain = normalizedEmailDomain(email);
  return domain !== undefined && blockedPublicEmailDomains.has(domain);
}
