import { expect, test } from "@playwright/test";

const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const authKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const authEmail = process.env.E2E_AUTH_EMAIL;
const authPassword = process.env.E2E_AUTH_PASSWORD;
const enabled = process.env.E2E_RUN_WALL_CLOCK_EXPIRY === "true";

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
};

test.describe("wall-clock Auth expiry", () => {
  test.skip(!enabled, "Set E2E_RUN_WALL_CLOCK_EXPIRY=true for the controlled expiry window.");
  test.skip(
    !authUrl || !authKey || !authEmail || !authPassword,
    "Dedicated Auth E2E environment is not configured.",
  );

  test.describe.configure({ mode: "serial" });
  test.setTimeout(420_000);

  async function signIn(): Promise<AuthSession> {
    const response = await fetch(`${authUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: authKey ?? "", "content-type": "application/json" },
      body: JSON.stringify({ email: authEmail, password: authPassword }),
    });

    expect(response.ok).toBe(true);
    return (await response.json()) as AuthSession;
  }

  async function getUser(accessToken: string) {
    return fetch(`${authUrl}/auth/v1/user`, {
      headers: {
        apikey: authKey ?? "",
        authorization: `Bearer ${accessToken}`,
      },
    });
  }

  async function refresh(refreshToken: string) {
    return fetch(`${authUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: authKey ?? "", "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  test("access token expires by wall clock and refresh restores access", async () => {
    const session = await signIn();
    expect(session.expires_in).toBeGreaterThanOrEqual(295);
    expect(session.expires_in).toBeLessThanOrEqual(305);

    const waitMs = Math.max(0, session.expires_at * 1000 - Date.now() + 2_000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    expect((await getUser(session.access_token)).ok).toBe(false);

    const refreshResponse = await refresh(session.refresh_token);
    expect(refreshResponse.ok).toBe(true);
    const refreshed = (await refreshResponse.json()) as AuthSession;
    expect(refreshed.access_token).not.toBe(session.access_token);
    expect((await getUser(refreshed.access_token)).ok).toBe(true);
  });

  test("revoked session cannot use its refresh token", async () => {
    const session = await signIn();
    const logoutResponse = await fetch(`${authUrl}/auth/v1/logout?scope=global`, {
      method: "POST",
      headers: {
        apikey: authKey ?? "",
        authorization: `Bearer ${session.access_token}`,
      },
    });
    expect(logoutResponse.ok).toBe(true);
    expect((await refresh(session.refresh_token)).ok).toBe(false);

    const cleanupSession = await signIn();
    await fetch(`${authUrl}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: {
        apikey: authKey ?? "",
        authorization: `Bearer ${cleanupSession.access_token}`,
      },
    });
  });
});
