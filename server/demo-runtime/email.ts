import {
  sendResendEmail,
  type VerificationEmailConfiguration,
} from "../verificationEmail.js";
import type { DemoVerificationEmailSender } from "./ports.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createDemoResendEmailSender(
  configuration: VerificationEmailConfiguration,
): DemoVerificationEmailSender {
  return Object.freeze({
    async send({ recipient, token }: { recipient: string; token: string }) {
      const verificationUrl = new URL(
        "/api/demo/access/verify",
        configuration.applicationBaseUrl,
      );
      verificationUrl.searchParams.set("token", token);
      const safeUrl = escapeHtml(verificationUrl.toString());
      await sendResendEmail(configuration, {
        recipient,
        subject: "Verify your TUTELA interactive demo access",
        text: [
          "Verify your qualified TUTELA interactive demo access:",
          verificationUrl.toString(),
          "",
          "This link expires in 24 hours and can be used once.",
          "The demo is a simulation and does not create a trading account or legal transaction.",
        ].join("\n"),
        html: `<p>Verify your qualified TUTELA interactive demo access:</p><p><a href="${safeUrl}">Verify demo access</a></p><p>This link expires in 24 hours and can be used once.</p><p><strong>Simulation only. No trading account or legal transaction is created.</strong></p>`,
      });
    },
  });
}
