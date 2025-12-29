// /api/strava/activities.js
import crypto from "crypto";

export default async function handler(req, res) {
  const sessionSecret = process.env.SESSION_SECRET;
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!sessionSecret || !clientId || !clientSecret) {
    return res.status(500).json({ ok: false, error: "Missing env vars" });
  }

  const sessionEnc = getCookie(req, "strava_session");
  if (!sessionEnc) {
    return res.status(401).json({ ok: false, error: "Not connected" });
  }

  let session;
  try {
    session = decryptJSON(sessionEnc, sessionSecret);
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid session" });
  }

  // 만료되었으면 refresh
  const nowSec = Math.floor(Date.now() / 1000);
  if (!session.access_token || !session.expires_at || session.expires_at <= nowSec + 60) {
    const refreshed = await refreshToken(session.refresh_token, clientId, clientSecret);
    session = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at,
    };
    // 갱신된 세션 다시 쿠키 저장
    const enc = encryptJSON(session, sessionSecret);
    setCookie(res, "strava_session", enc, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  // 활동 리스트 가져오기
  const perPage = Math.min(50, Math.max(1, Number(req.query?.per_page || 30)));
  const page = Math.min(5, Math.max(1, Number(req.query?.page || 1)));

  const apiRes = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  );

  if (!apiRes.ok) {
    const txt = await apiRes.text();
    return res.status(500).json({ ok: false, error: `Strava API failed: ${txt}` });
  }

  const list = await apiRes.json();

  // RUNIMATE용 최소 필드로 변환 (RUN만 보여주고 싶으면 아래 filter 유지)
  const workouts = (Array.isArray(list) ? list : [])
    .filter((a) => a && (a.type === "Run" || a.sport_type === "Run")) // 러닝만
    .map((a) => {
      const distanceM = Number(a.distance || 0);
      const moving = Number(a.moving_time || 0);

      const km = distanceM / 1000;
      const timeSec = moving;

      // paceSec = (timeSec / km)
      const paceSec = km > 0 ? Math.round(timeSec / km) : 0;

      // 날짜 포맷: YYYY.MM.DD
      const date = formatDate(a.start_date_local || a.start_date);

      return {
        source: "strava",
        id: a.id,
        date,
        km: round2(km),
        paceSec,
        timeSec,
        name: a.name || "",
      };
    });

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).json({ ok: true, workouts });
}

async function refreshToken(refresh_token, clientId, clientSecret) {
  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: String(clientId),
      client_secret: String(clientSecret),
      grant_type: "refresh_token",
      refresh_token: String(refresh_token),
    }),
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}`;
  } catch {
    return "0000.00.00";
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
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
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptJSON(b64, secret) {
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
