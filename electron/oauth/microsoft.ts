import { startPkceOAuth, refreshPkceToken, PkceTokens } from "./pkce.js";

export type MicrosoftTokens = PkceTokens;

const AUTH_BASE = "https://login.microsoftonline.com";

/**
 * Microsoft identity platform OAuth 2.0 with PKCE.
 *
 * Tenant defaults to `common` so both personal Microsoft accounts and
 * work/school accounts work without further config. Use a specific tenant
 * ID if you've restricted the app registration.
 *
 * Azure App Registration:
 *  - Type: "Mobile and desktop applications"
 *  - Redirect URI: `http://localhost` (any port at runtime)
 *  - "Allow public client flows" must be enabled.
 */
export function startMicrosoftOAuth(opts: {
  clientId: string;
  clientSecret?: string;
  scopes: string[];
  tenant?: string;
}): Promise<MicrosoftTokens> {
  const tenant = opts.tenant || "common";
  return startPkceOAuth({
    provider: "Microsoft",
    authUrl: `${AUTH_BASE}/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `${AUTH_BASE}/${tenant}/oauth2/v2.0/token`,
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    scopes: opts.scopes,
    // MS only allows ANY port on the loopback when the registered URI is the
    // bare `http://localhost`. Anything with a path requires exact match.
    redirectPath: "/",
    extraAuthParams: { prompt: "select_account" },
  });
}

export function refreshMicrosoftToken(opts: {
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  scopes: string[];
  tenant?: string;
}): Promise<MicrosoftTokens> {
  const tenant = opts.tenant || "common";
  return refreshPkceToken({
    provider: "Microsoft",
    tokenUrl: `${AUTH_BASE}/${tenant}/oauth2/v2.0/token`,
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    refreshToken: opts.refreshToken,
    scopes: opts.scopes,
  });
}
