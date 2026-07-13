export const requiredProductionEnvironment = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

export const requiredProductionFiles = ["certs/prod-ca-2021.crt"] as const;

export const productionSecurityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
] as const;

type Environment = Record<string, string | undefined>;

export function getMissingEnvironment(
  environment: Environment,
  requiredKeys: readonly string[] = requiredProductionEnvironment,
) {
  return requiredKeys.filter((key) => !environment[key]);
}

export function buildHealthResponse(now = new Date()) {
  return {
    status: "ok",
    service: "resident-app",
    timestamp: now.toISOString(),
  };
}
