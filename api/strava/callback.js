// /api/strava/callback.js
import crypto from "crypto";

export default async function handler(req, res) {
  const { code, state } = req.query || {};

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(500).send("Missing STRAVA env vars");
  }
  if (!sessionSecret) {
    return res.status(500).send("Missing SESSION_SECRET");
  }
  if (!code) {
    return res.status(400).send("Missing code");
  }

  // state 검증
  const cookieState = getCookie(req, "strava_oauth_state");
  if (!cookieState || !state || cookieState !== state) {
    return res.status(400).send("Invalid state");
  }

  // code -> token 교환
  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: String(clientId),
      client_secret: String(clientSecret),
      code: String(code),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    return res.status(500).send(`Token exchange failed: ${txt}`);
  }

  const tokenJson = await tokenRes.json();
  // tokenJson: { access_token, refresh_token, expires_at, athlete... }
  const payload = {
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token,
    expires_at: tokenJson.expires_at, // unix seconds
  };

  // 쿠키에 암호화 저장 (HttpOnly)
  const enc = encryptJSON(payload, sessionSecret);

  setCookie(res, "strava_session", enc, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30일
  });

  // state 쿠키는 삭제
  setCookie(res, "strava_oauth_state", "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });

  // 메인 페이지로 돌아가기 (원하는 쿼리 붙여도 됨)
  res.statusCode = 302;
  res.setHeader("Location", "/?strava=connected");
  res.end();
}

function getCookie(req, name) {
  const raw = req.headers.cookie || "";
  const parts = raw.split(";").map((s) => s.trim());
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx < 0) continue;
    const k = p.slice(0, idx);
    const v = p.slice(idx + 1);
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

function setCookie(res, name, value, opt = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opt.maxAge != null) parts.push(`Max-Age=${opt.maxAge}`);
  if (opt.path) parts.push(`Path=${opt.path}`);
  if (opt.httpOnly) parts.push("HttpOnly");
  if (opt.secure) parts.push("Secure");
  if (opt.sameSite) parts.push(`SameSite=${opt.sameSite}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

function encryptJSON(obj, secret) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(String(secret)).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv + tag + data -> base64
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptJSON(b64, secret) {
  const buf = Buffer.from(String(b64), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const key = crypto.createHash("sha256").update(String(secret)).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(out.toString("utf8"));
}
