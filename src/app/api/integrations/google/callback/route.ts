import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/integrations/tokens";
import { allGoogleScopes } from "@/lib/integrations/registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/google/callback
 * Exchanges the OAuth `code` for tokens and stores the connected account.
 * The account row is owned by the signed-in user (RLS-protected); refresh
 * tokens are encrypted at rest via encryptToken().
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const settings = (msg: string) =>
    NextResponse.redirect(`${origin}/settings?integration=google&${msg}`);

  if (oauthError) return settings(`error=${encodeURIComponent(oauthError)}`);
  if (!code) return settings("error=missing_code");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // Verify the state matches the signed-in user (CSRF / mix-up protection).
  if (state && state !== user.id) return settings("error=state_mismatch");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URL ??
    `${origin}/api/integrations/google/callback`;

  if (!clientId || !clientSecret) return settings("error=not_configured");

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) return settings("error=token_exchange_failed");
    const token = await res.json();

    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;

    const { error } = await supabase.from("integration_accounts").upsert(
      {
        user_id: user.id,
        provider: "google",
        email: user.email ?? null,
        scopes: allGoogleScopes(),
        access_token: encryptToken(token.access_token),
        // Google only returns a refresh_token on first consent; keep any prior.
        refresh_token: token.refresh_token
          ? encryptToken(token.refresh_token)
          : undefined,
        expires_at: expiresAt,
        status: "connected",
      },
      { onConflict: "user_id,provider" },
    );
    if (error) return settings("error=save_failed");

    return settings("connected=1");
  } catch {
    return settings("error=unexpected");
  }
}
