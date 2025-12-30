// /api/strava/envcheck.js
export default function handler(req, res) {
  res.status(200).json({
    hasClientId: !!process.env.STRAVA_CLIENT_ID,
    hasClientSecret: !!process.env.STRAVA_CLIENT_SECRET,
    hasRedirectUri: !!process.env.STRAVA_REDIRECT_URI,
    nodeEnv: process.env.NODE_ENV || null,
  });
}
