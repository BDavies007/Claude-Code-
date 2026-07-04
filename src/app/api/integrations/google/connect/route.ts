import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { allGoogleScopes } from "@/lib/integrations/registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/google/connect
 * Starts the Google OAuth flow (Calendar + Gmail + Drive in one grant,
 * offline access for refresh tokens). Redirects to Google's consent screen.
 *
 * Requires GOOGLE_CLIENT_ID and GOOGLE_OAUTH_REDIRECT_URL. If unset, we bounce
 * back to Settings with a clear message rather than a broken redirect.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URL ??
    `${origin}/api/integrations/google/callback`;

  if (!clientId) {
    return NextResponse.redirect(
      `${origin}/settings?integration=google&error=not_configured`,
    );
  }

  // `state` carries the user id (signed verification happens in the callback).
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    scope: allGoogleScopes().join(" "),
    state: user.id,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
