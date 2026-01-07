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
  const payload = {
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token,
    expires_at: tokenJson.expires_at,
  };

  // 암호화
  const enc = encryptJSON(payload, sessionSecret);

  // 1. 세션 쿠키 저장 (로그인 성공)
  setCookie(res, "strava_session", enc, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30일
  });

  // 2. 임시 state 쿠키 삭제 (중요: setCookie가 덮어쓰지 않도록 수정됨)
  setCookie(res, "strava_oauth_state", "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });

  // 메인 페이지로 돌아가기
  res.statusCode = 302;
  res.setHeader("Location", "/?strava=connected");
  res.end();
}

// --- Helpers ---

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

// ✅ [수정됨] 기존 헤더를 덮어쓰지 않고 추가하는 방식
function setCookie(res, name, value, opt = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opt.maxAge != null) parts.push(`Max-Age=${opt.maxAge}`);
  if (opt.path) parts.push(`Path=${opt.path}`);
  if (opt.httpOnly) parts.push("HttpOnly");
  if (opt.secure) parts.push("Secure");
  if (opt.sameSite) parts.push(`SameSite=${opt.sameSite}`);
  
  const cookieString = parts.join("; ");
  
  // 기존 Set-Cookie 헤더가 있는지 확인
  const prev = res.getHeader("Set-Cookie");
  
  if (prev) {
    if (Array.isArray(prev)) {
      // 배열이면 추가
      res.setHeader("Set-Cookie", [...prev, cookieString]);
    } else {
      // 문자열이면 배열로 변환해서 추가
      res.setHeader("Set-Cookie", [prev, cookieString]);
    }
  } else {
    // 없으면 그냥 설정
    res.setHeader("Set-Cookie", cookieString);
  }
}

function encryptJSON(obj, secret) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(String(secret)).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
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
