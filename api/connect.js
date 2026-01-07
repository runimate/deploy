// /api/strava/connect.js
export default function handler(req, res) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).send("Missing STRAVA_CLIENT_ID or STRAVA_REDIRECT_URI");
  }

  // CSRF 방지용 state (간단 버전: 쿠키에 저장)
  const state = cryptoRandomString(24);
  setCookie(res, "strava_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 10 * 60, // 10분
  });

  const scope = "read,activity:read_all"; // 기록 선택용(필요 최소)
  const url =
    "https://www.strava.com/oauth/authorize" +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&approval_prompt=auto` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}`;

  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
}

function cryptoRandomString(len) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[(Math.random() * chars.length) | 0];
  return out;
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
