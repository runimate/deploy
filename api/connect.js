// [파일: api/connect.js]

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../')));

// 1. 로그인 요청
app.get('/api/strava/login', (req, res) => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI; // Railway 주소여야 함

  if (!clientId || !redirectUri) return res.status(500).send("환경변수 설정 필요");

  const scope = "read,activity:read_all"; 
  const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=auto&scope=${scope}`;
  
  res.redirect(url);
});

// 2. 콜백 처리 (스트라바 -> Railway)
app.get('/api/strava/callback', (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send("인증 코드가 없습니다.");

    const postData = JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code'
    });

    const options = {
        hostname: 'www.strava.com',
        path: '/oauth/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    };

    const tokenReq = https.request(options, (tokenRes) => {
        let data = '';
        tokenRes.on('data', chunk => data += chunk);
        tokenRes.on('end', () => {
            try {
                const result = JSON.parse(data);
                if (result.access_token) {
                    // ★★★ [여기가 수정됨] ★★★
                    // 인증 성공! 토큰을 들고 "Vercel 화면"으로 복귀시킴
                    // Vercel 주소를 정확히 적어주세요. (끝에 슬래시 주의)
                    const vercelUrl = "https://runimate.vercel.app"; 
                    res.redirect(`${vercelUrl}/?strava_token=${result.access_token}`);
                } else {
                    res.status(500).send("토큰 발급 실패");
                }
            } catch (e) { res.status(500).send("서버 에러"); }
        });
    });
    tokenReq.write(postData);
    tokenReq.end();
});

// 3. 데이터 조회
app.get('/api/strava/activities', (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(400).json({ success: false, msg: "토큰 없음" });

    const options = {
        hostname: 'www.strava.com',
        path: '/api/v3/athlete/activities?per_page=30',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    };

    const stravaReq = https.request(options, (stravaRes) => {
        let data = '';
        stravaRes.on('data', chunk => data += chunk);
        stravaRes.on('end', () => {
            try {
                const activities = JSON.parse(data);
                const formatted = activities
                    .filter(a => a.type === 'Run')
                    .map(a => ({
                        date: a.start_date_local.substring(0, 10).replace(/-/g, '.'),
                        km: a.distance / 1000,
                        timeSec: a.moving_time,
                        paceSec: (a.distance > 0) ? (a.moving_time / (a.distance / 1000)) : 0
                    }));
                res.json({ success: true, data: formatted });
            } catch (e) { res.status(500).json({ success: false, msg: "파싱 에러" }); }
        });
    });
    stravaReq.end();
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
