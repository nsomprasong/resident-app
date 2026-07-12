import { expect, test } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.E2E_AUTH_EMAIL;
const password = process.env.E2E_AUTH_PASSWORD;

if (!url || !publishableKey || !email || !password) {
  throw new Error("Supabase and dedicated E2E Auth environment must be configured.");
}

const authUrl = url;
const authKey = publishableKey;
const authEmail = email;
const authPassword = password;

type AuthSessionResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

async function signIn() {
  const response = await fetch(authUrl + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      apikey: authKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: authEmail, password: authPassword }),
  });

  expect(response.ok).toBe(true);
  return (await response.json()) as AuthSessionResponse;
}

async function signOut(accessToken: string, scope: "global" | "local") {
  return fetch(authUrl + "/auth/v1/logout?scope=" + scope, {
    method: "POST",
    headers: {
      apikey: authKey,
      authorization: "Bearer " + accessToken,
    },
  });
}

test("globally revoked refresh token cannot create a new session", async () => {
  const session = await signIn();

  expect(session.access_token).toBeTruthy();
  expect(session.refresh_token).toBeTruthy();
  expect(session.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));

  const revokeResponse = await signOut(session.access_token, "global");
  expect(revokeResponse.ok).toBe(true);

  const refreshResponse = await fetch(
    authUrl + "/auth/v1/token?grant_type=refresh_token",
    {
      method: "POST",
      headers: {
        apikey: authKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    },
  );

  expect(refreshResponse.ok).toBe(false);

  const recoveredSession = await signIn();
  const cleanupResponse = await signOut(recoveredSession.access_token, "local");
  expect(cleanupResponse.ok).toBe(true);
});
