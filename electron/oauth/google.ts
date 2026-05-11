import { startPkceOAuth, refreshPkceToken, PkceTokens } from "./pkce.js";

export type GoogleTokens = PkceTokens;

export function startGoogleOAuth(opts: {
  clientId: string;
  clientSecret?: string;
  scopes: string[];
}): Promise<GoogleTokens> {
  return startPkceOAuth({
    provider: "Google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    scopes: opts.scopes,
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  });
}

export function refreshGoogleToken(opts: {
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
}): Promise<GoogleTokens> {
  return refreshPkceToken({
    provider: "Google",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    refreshToken: opts.refreshToken,
  });
}
