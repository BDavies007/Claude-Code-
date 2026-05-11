import { startPkceOAuth, refreshPkceToken, PkceTokens } from "./pkce.js";

export type WhoopTokens = PkceTokens;

const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

/**
 * Whoop developer API OAuth 2.0 with PKCE.
 *
 * Register a client at https://developer-dashboard.whoop.com/. Redirect
 * URIs must be registered exactly — but the loopback flow uses a random
 * port, so the developer dashboard accepts a `http://localhost` pattern
 * with a wildcard port for desktop apps; if not, register a single
 * fixed-port URI and we'll match it. (Default here: any port via PKCE.)
 *
 * The `offline` scope is required to get a refresh token.
 */
export function startWhoopOAuth(opts: {
  clientId: string;
  clientSecret?: string;
  scopes: string[];
}): Promise<WhoopTokens> {
  return startPkceOAuth({
    provider: "Whoop",
    authUrl: AUTH_URL,
    tokenUrl: TOKEN_URL,
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    scopes: opts.scopes,
  });
}

export function refreshWhoopToken(opts: {
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
}): Promise<WhoopTokens> {
  return refreshPkceToken({
    provider: "Whoop",
    tokenUrl: TOKEN_URL,
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    refreshToken: opts.refreshToken,
  });
}
