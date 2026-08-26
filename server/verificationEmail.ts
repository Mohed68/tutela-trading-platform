import type { VerificationEmailSender } from "./registration.js";

export interface VerificationEmailConfiguration {
  apiKey: string;
  sender: string;
  applicationBaseUrl: string;
}

export interface VerificationEmailContent {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildVerificationEmailContent(
  configuration: Pick<VerificationEmailConfiguration, "applicationBaseUrl">,
  verificationUrl: string,
): VerificationEmailContent {
  const logoUrl = new URL(
    "/tutela-logo.png",
    configuration.applicationBaseUrl,
  ).toString();
  const safeVerificationUrl = escapeHtml(verificationUrl);
  const safeLogoUrl = escapeHtml(logoUrl);
  const subject = "Verify your TUTELA account";
  const text = [
    "Hello,",
    "",
    "Welcome to TUTELA.",
    "",
    "You’re one step away from activating your account and accessing a trusted environment for physical commodity trading.",
    "",
    "TUTELA is designed to make B2B commodity transactions more transparent and structured by connecting organization identity, trade evidence, eligibility checks, offers, orders, and contracts within one trusted workflow.",
    "",
    "Verify my account:",
    verificationUrl,
    "",
    "This verification link expires in 24 hours.",
    "",
    "If you did not create a TUTELA account, you can safely ignore this email.",
    "",
    "Once verified, you can continue setting up your organization and move through TUTELA’s trust and trading workflow.",
    "",
    "Best regards,",
    "TUTELA Team",
    "Secure Physical Commodity Trading",
    "tutelaworld.com",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f6f5;color:#17211d;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f4f6f5;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #e1e7e3;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #e8ece9;">
            <img src="${safeLogoUrl}" width="120" alt="TUTELA" style="display:block;width:120px;max-width:100%;height:auto;border:0;margin:0 0 14px;">
            <div style="font-size:13px;line-height:20px;letter-spacing:1.5px;color:#237a4b;font-weight:700;">SECURE PHYSICAL COMMODITY TRADING</div>
          </td></tr>
          <tr><td style="padding:32px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:25px;">Hello,</p>
            <h1 style="margin:0 0 18px;font-size:28px;line-height:36px;color:#17211d;">Welcome to TUTELA.</h1>
            <p style="margin:0 0 18px;font-size:16px;line-height:25px;">You’re one step away from activating your account and accessing a trusted environment for physical commodity trading.</p>
            <p style="margin:0 0 26px;font-size:16px;line-height:25px;">TUTELA is designed to make B2B commodity transactions more transparent and structured by connecting organization identity, trade evidence, eligibility checks, offers, orders, and contracts within one trusted workflow.</p>
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 26px;"><tr><td bgcolor="#16794b" style="border-radius:7px;">
              <a href="${safeVerificationUrl}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;line-height:20px;">Verify my account</a>
            </td></tr></table>
            <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#5c6b63;">If the button does not work, copy and paste this link into your browser:</p>
            <p style="margin:0 0 24px;font-size:13px;line-height:20px;word-break:break-all;"><a href="${safeVerificationUrl}" style="color:#16794b;">${safeVerificationUrl}</a></p>
            <p style="margin:0 0 18px;font-size:14px;line-height:22px;color:#46534c;"><strong>This verification link expires in 24 hours.</strong></p>
            <p style="margin:0 0 18px;font-size:14px;line-height:22px;color:#46534c;">If you did not create a TUTELA account, you can safely ignore this email.</p>
            <p style="margin:0 0 26px;font-size:14px;line-height:22px;color:#46534c;">Once verified, you can continue setting up your organization and move through TUTELA’s trust and trading workflow.</p>
            <p style="margin:0;font-size:14px;line-height:22px;color:#46534c;">Best regards,<br><strong>TUTELA Team</strong><br>Secure Physical Commodity Trading<br><a href="https://tutelaworld.com" style="color:#16794b;text-decoration:none;">tutelaworld.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export function getVerificationEmailConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): VerificationEmailConfiguration | undefined {
  const apiKey = environment.RESEND_API_KEY?.trim();
  const sender = environment.EMAIL_FROM?.trim();
  const applicationBaseUrl = environment.APP_BASE_URL?.trim();
  if (!apiKey || !sender || !applicationBaseUrl) return undefined;

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(applicationBaseUrl);
  } catch {
    return undefined;
  }
  if (
    environment.NODE_ENV === "production" &&
    parsedBaseUrl.protocol !== "https:"
  ) {
    return undefined;
  }

  return { apiKey, sender, applicationBaseUrl: parsedBaseUrl.toString() };
}

export function createResendVerificationEmailSender(
  configuration: VerificationEmailConfiguration,
): VerificationEmailSender {
  return {
    async send({ recipient, verificationUrl }) {
      const content = buildVerificationEmailContent(
        configuration,
        verificationUrl,
      );
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${configuration.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: configuration.sender,
          to: [recipient],
          ...content,
        }),
      });

      if (!response.ok) {
        throw new Error("EMAIL_VERIFICATION_DELIVERY_FAILED");
      }
    },
  };
}
