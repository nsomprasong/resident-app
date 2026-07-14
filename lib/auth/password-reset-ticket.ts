import { createHmac, timingSafeEqual } from "node:crypto";

export type PasswordResetTicketPayload = {
  employeeId: string;
  authUserId: string;
  email: string;
  exp: number;
};

const DEFAULT_TTL_SECONDS = 30 * 60;

function getTicketSecret() {
  const secret =
    process.env.PASSWORD_RESET_TICKET_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "Password reset ticket secret is not configured. Set PASSWORD_RESET_TICKET_SECRET or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return secret;
}

function signPayload(payloadB64: string) {
  return createHmac("sha256", getTicketSecret())
    .update(payloadB64)
    .digest("base64url");
}

export function createPasswordResetTicket(
  input: Omit<PasswordResetTicketPayload, "exp">,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const payload: PasswordResetTicketPayload = {
    ...input,
    email: input.email.trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${payloadB64}.${signPayload(payloadB64)}`;
}

export function verifyPasswordResetTicket(
  ticket: string,
): PasswordResetTicketPayload | null {
  const trimmed = ticket.trim();
  const separator = trimmed.lastIndexOf(".");
  if (separator <= 0) return null;

  const payloadB64 = trimmed.slice(0, separator);
  const signature = trimmed.slice(separator + 1);
  if (!payloadB64 || !signature) return null;

  const expected = signPayload(payloadB64);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as Partial<PasswordResetTicketPayload>;

    if (
      typeof parsed.employeeId !== "string" ||
      typeof parsed.authUserId !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }

    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      employeeId: parsed.employeeId,
      authUserId: parsed.authUserId,
      email: parsed.email.trim().toLowerCase(),
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}
