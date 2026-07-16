export const SESSION_EPOCH_CLAIM = "session_epoch";

type ClaimsLike = {
  app_metadata?: unknown;
  user_metadata?: unknown;
} | null;

function readAppMetadata(claims: ClaimsLike): Record<string, unknown> {
  if (!claims || typeof claims !== "object") return {};
  const meta = claims.app_metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  return meta as Record<string, unknown>;
}

/** Epoch embedded in the current JWT (defaults to 0 when absent). */
export function readSessionEpochFromClaims(claims: ClaimsLike): number {
  const raw = readAppMetadata(claims)[SESSION_EPOCH_CLAIM];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return 0;
}

export function sessionEpochMatches(
  claims: ClaimsLike,
  employeeEpoch: number,
): boolean {
  return readSessionEpochFromClaims(claims) === employeeEpoch;
}
