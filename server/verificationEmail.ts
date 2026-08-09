import type { VerificationEmailSender } from "./registration.js";

export interface VerificationEmailConfiguration {
  apiKey: string;
  sender: string;
  applicationBaseUrl: string;
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
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${configuration.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: configuration.sender,
          to: [recipient],
          subject: "Verify your Tutela account",
          text:
            "Verify your Tutela account by opening this link:\n\n" +
            verificationUrl +
            "\n\nThis link expires in 24 hours.",
        }),
      });

      if (!response.ok) {
        throw new Error("EMAIL_VERIFICATION_DELIVERY_FAILED");
      }
    },
  };
}
