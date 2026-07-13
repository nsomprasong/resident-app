import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHealthResponse,
  getMissingEnvironment,
  productionSecurityHeaders,
  requiredProductionEnvironment,
} from "../../lib/production/readiness";

test("production readiness reports missing required environment", () => {
  assert.deepEqual(
    getMissingEnvironment({
      DATABASE_URL: "postgres://example",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    }),
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
  );
});

test("production security headers include baseline browser hardening", () => {
  const headerMap = new Map(
    productionSecurityHeaders.map((header) => [header.key, header.value]),
  );

  assert.equal(headerMap.get("X-Frame-Options"), "DENY");
  assert.equal(headerMap.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headerMap.has("Referrer-Policy"), true);
  assert.equal(headerMap.has("Permissions-Policy"), true);
});

test("health response is stable and non-secret", () => {
  assert.deepEqual(buildHealthResponse(new Date("2026-07-12T12:00:00.000Z")), {
    status: "ok",
    service: "resident-app",
    timestamp: "2026-07-12T12:00:00.000Z",
  });
});

test("required production environment names stay explicit", () => {
  assert.deepEqual(requiredProductionEnvironment, [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ]);
});
