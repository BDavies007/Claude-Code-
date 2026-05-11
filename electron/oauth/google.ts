import http from "node:http";
import crypto from "node:crypto";
import { URL } from "node:url";
import { shell } from "electron";

export interface GoogleOAuthOptions {
  clientId: string;
  clientSecret?: string;
  scopes: string[];
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

export async function startGoogleOAuth(opts: GoogleOAuthOptions): Promise<GoogleTokens> {
  if (!opts.clientId) throw new Error("Missing Google OAuth client ID");

  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const state = base64url(crypto.randomBytes(16));

  const { redirectUri, codePromise, close } = await listenForCode(state);

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", opts.clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", opts.scopes.join(" "));
  auth.searchParams.set("code_challenge", challenge);
  auth.searchParams.set("code_challenge_method", "S256");
  auth.searchParams.set("state", state);
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent");

  try {
    await shell.openExternal(auth.toString());
    const code = await withTimeout(codePromise, 5 * 60 * 1000, "Authentication timed out");
    return await exchangeCode({
      code,
      verifier,
      redirectUri,
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
    });
  } finally {
    close();
  }
}

export async function refreshGoogleToken(args: {
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
}): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    client_id: args.clientId,
    refresh_token: args.refreshToken,
    grant_type: "refresh_token",
  });
  if (args.clientSecret) body.set("client_secret", args.clientSecret);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: args.refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
    scope: json.scope,
    tokenType: json.token_type,
  };
}

async function exchangeCode(args: {
  code: string;
  verifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string;
}): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code: args.code,
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    grant_type: "authorization_code",
    code_verifier: args.verifier,
  });
  if (args.clientSecret) body.set("client_secret", args.clientSecret);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    scope: json.scope,
    tokenType: json.token_type,
  };
}

function listenForCode(
  expectedState: string,
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
    if (u.pathname !== "/oauth2callback") {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end(htmlPage("Not found"));
      return;
    }
    const code = u.searchParams.get("code");
    const state = u.searchParams.get("state");
    const error = u.searchParams.get("error");
    if (error) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage(`Authentication failed: ${error}`));
      rejectCode(new Error(error));
      return;
    }
    if (!code || state !== expectedState) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(htmlPage("Invalid OAuth response"));
      rejectCode(new Error("Invalid OAuth response"));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(htmlPage("Atlas Hub is connected. You can close this tab and return to the app."));
    resolveCode(code);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
      resolve({
        redirectUri,
        codePromise,
        close: () => server.close(),
      });
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

function htmlPage(message: string): string {
  return `<!doctype html><html><head><title>Atlas Hub</title><meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           display:grid; place-items:center; height:100vh; margin:0;
           background:#0b0d12; color:#e2e8f0; }
    .card { padding:2rem 2.25rem; border-radius:14px; background:#161a23;
            border:1px solid #272d3a; max-width:440px; text-align:center;
            box-shadow:0 4px 24px rgba(0,0,0,.4); }
    h1 { margin:0 0 .5rem; font-size:1.05rem; font-weight:600; letter-spacing:-0.01em; }
    p  { margin:0; color:#94a3b8; font-size:.9rem; line-height:1.5; }
  </style></head>
  <body><div class="card"><h1>Atlas Hub</h1><p>${escapeHtml(message)}</p></div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c,
  );
}
