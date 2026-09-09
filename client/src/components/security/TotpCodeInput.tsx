import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export const TOTP_HELPER_TEXT =
  "Open the authenticator app linked to your TUTELA account and enter the current 6-digit code.";

export function TotpCodeInput({
  value,
  onChange,
  label = "Authenticator code",
  disabled = false,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label?: string;
  readonly disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <InputOTP
        aria-label={label}
        autoComplete="one-time-code"
        disabled={disabled}
        inputMode="numeric"
        maxLength={6}
        onChange={onChange}
        pattern={REGEXP_ONLY_DIGITS}
        value={value}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator aria-hidden="true" className="mx-2" />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
      <p className="text-xs text-neutral-600">{TOTP_HELPER_TEXT}</p>
      <p className="text-xs text-neutral-500">Compatible authenticator apps include Google Authenticator, Microsoft Authenticator, 2FAS, and other standard TOTP apps. Codes normally refresh every 30 seconds. This is not a recovery code.</p>
    </div>
  );
}
