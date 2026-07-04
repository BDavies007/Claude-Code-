import { createServiceClient } from "@/lib/supabase/service";
import { decryptToken, encryptToken } from "../tokens";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Return a valid Google access token for a user, refreshing it if expired.
 * Uses the service-role client so it works in background sync (no session).
 */
export async function getGoogleAccessToken(userId: string): Promise<string> {
  const svc = createServiceClient();
  const { data: account } = await svc
    .from("integration_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (!account) throw new Error("Google is not connected for this user.");

  const expiresAt = account.expires_at
    ? new Date(account.expires_at).getTime()
    : 0;
  // Reuse the current token if it has >60s of life left.
  if (account.access_token && expiresAt > Date.now() + 60_000) {
    const tok = decryptToken(account.access_token);
    if (tok) return tok;
  }

  const refresh = decryptToken(account.refresh_token);
  if (!refresh) {
    await svc
      .from("integration_accounts")
      .update({ status: "error" })
      .eq("id", account.id);
    throw new Error("Missing refresh token — reconnect Google.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured.");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    await svc
      .from("integration_accounts")
      .update({ status: "error" })
      .eq("id", account.id);
    throw new Error(`Google token refresh failed (${res.status}).`);
  }

  const token = await res.json();
  const newExpiresAt = new Date(
    Date.now() + (token.expires_in ?? 3600) * 1000,
  ).toISOString();

  await svc
    .from("integration_accounts")
    .update({
      access_token: encryptToken(token.access_token),
      expires_at: newExpiresAt,
      status: "connected",
    })
    .eq("id", account.id);

  return token.access_token;
}

/** Authorized GET against the Google APIs; returns { status, json }. */
export async function googleGet(
  accessToken: string,
  url: string,
): Promise<{ status: number; json: any }> {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, json };
}
