import http from "node:http";
import crypto from "node:crypto";
import { URL } from "node:url";
import { shell } from "electron";

export interface PkceOAuthOptions {
  /** Provider label for error messages. */
  provider: string;
  /** Authorization endpoint (e.g. https://accounts.google.com/o/oauth2/v2/auth) */
  authUrl: string;
  /** Token endpoint */
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  scopes: string[];
  /** Path on the loopback redirect URI. Default "/oauth2callback".
   *  Microsoft accepts any port for redirect URI `http://localhost`, so for MS use "/". */
  redirectPath?: string;
  /** Extra params merged into the authorization URL. */
  extraAuthParams?: Record<string, string>;
  /** Extra params merged into POST body of code-exchange + refresh. */
  extraTokenParams?: Record<string, string>;
}

export interface PkceTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType: string;
}

export async function startPkceOAuth(opts: PkceOAuthOptions): Promise<PkceTokens> {
  if (!opts.clientId) throw new Error(`Missing ${opts.provider} OAuth client ID`);

  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const state = base64url(crypto.randomBytes(16));
  const redirectPath = opts.redirectPath ?? "/oauth2callback";

  const { redirectUri, codePromise, close } = await listenForCode(state, redirectPath, opts.provider);

  const auth = new URL(opts.authUrl);
  auth.searchParams.set("client_id", opts.clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", opts.scopes.join(" "));
  auth.searchParams.set("code_challenge", challenge);
  auth.searchParams.set("code_challenge_method", "S256");
  auth.searchParams.set("state", state);
  for (const [k, v] of Object.entries(opts.extraAuthParams ?? {})) {
    auth.searchParams.set(k, v);
  }

  try {
    await shell.openExternal(auth.toString());
    const code = await withTimeout(codePromise, 5 * 60 * 1000, "Authentication timed out");
    return await exchangeCode(opts, code, verifier, redirectUri);
  } finally {
    close();
  }
}

export async function refreshPkceToken(opts: {
  provider: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  extraTokenParams?: Record<string, string>;
  scopes?: string[];
}): Promise<PkceTokens> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    refresh_token: opts.refreshToken,
    grant_type: "refresh_token",
  });
  if (opts.clientSecret) body.set("client_secret", opts.clientSecret);
  if (opts.scopes?.length) body.set("scope", opts.scopes.join(" "));
  for (const [k, v] of Object.entries(opts.extraTokenParams ?? {})) {
    body.set(k, v);
  }

  const res = await fetch(opts.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`${opts.provider} token refresh failed: ${res.status} ${await res.text()}`);
  }
  return toTokens((await res.json()) as TokenResponse, opts.refreshToken);
}

async function exchangeCode(
  opts: PkceOAuthOptions,
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<PkceTokens> {
  const body = new URLSearchParams({
    code,
    client_id: opts.clientId,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  if (opts.clientSecret) body.set("client_secret", opts.clientSecret);
  for (const [k, v] of Object.entries(opts.extraTokenParams ?? {})) {
    body.set(k, v);
  }

  const res = await fetch(opts.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`${opts.provider} token exchange failed: ${res.status} ${await res.text()}`);
  }
  return toTokens((await res.json()) as TokenResponse);
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

function toTokens(json: TokenResponse, fallbackRefresh?: string): PkceTokens {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? fallbackRefresh,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    scope: json.scope,
    tokenType: json.token_type,
  };
}

function listenForCode(
  expectedState: string,
  redirectPath: string,
  provider: string,
): Promise<{ redirectUri: string; codePromise: Promise<string>; close: () => void }> {
  let resolveCode!: (code: string) => void;
  let rejectCode!: (err: Error) => void;
  const codePromise = new Promise<string>((res, rej) => {
    resolveCode = res;
    rejectCode = rej;
  });

  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(400);
      res.end();
      return;
    }
    const u = new URL(req.url, "http://127.0.0.1");
    if (u.pathname !== redirectPath) {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end(htmlPage(provider, "Not found"));
      return;
    }
    const code = u.searchParams.get("code");
    const state = u.searchParams.get("state");
    const error = u.searchParams.get("error");
    if (error) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage(provider, `Authentication failed: ${error}`));
      rejectCode(new Error(error));
      return;
    }
    if (!code || state !== expectedState) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(htmlPage(provider, "Invalid OAuth response"));
      rejectCode(new Error("Invalid OAuth response"));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(htmlPage(provider, "Atlas Hub is connected. You can close this tab and return to the app."));
    resolveCode(code);
  });

  return new Promise((resolve) => {
    // Microsoft only accepts http://localhost (not 127.0.0.1) for the special
    // "any port" rule, so we bind on the loopback hostname and report it as `localhost`.
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const redirectUri = `http://localhost:${port}${redirectPath === "/" ? "" : redirectPath}`;
      resolve({ redirectUri, codePromise, close: () => server.close() });
    });
  });
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function htmlPage(provider: string, message: string): string {
  return `<!doctype html><html><head><title>Atlas Hub · ${escapeHtml(provider)}</title><meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           display:grid; place-items:center; height:100vh; margin:0;
           background:#0b0d12; color:#e2e8f0; }
    .card { padding:2rem 2.25rem; border-radius:14px; background:#161a23;
            border:1px solid #272d3a; max-width:440px; text-align:center;
            box-shadow:0 4px 24px rgba(0,0,0,.4); }
    h1 { margin:0 0 .5rem; font-size:1.05rem; font-weight:600; letter-spacing:-0.01em; }
    p  { margin:0; color:#94a3b8; font-size:.9rem; line-height:1.5; }
    .provider { color:#818cf8; font-size:.7rem; text-transform:uppercase; letter-spacing:.1em; margin-bottom:.5rem; }
  </style></head>
  <body><div class="card"><div class="provider">${escapeHtml(provider)}</div><h1>Atlas Hub</h1><p>${escapeHtml(message)}</p></div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c,
  );
}
