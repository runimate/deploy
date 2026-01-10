// [파일 경로: api/connect.js] 여기에 덮어씌우세요!

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

// [1] 정적 파일 연결
app.use(express.static(path.join(__dirname, '../')));

// [2] 스트라바 로그인 (인증 페이지로 이동)
app.get('/api/strava/login', (req, res) => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  // ★ 중요: 환경변수 redirect_uri는 반드시 ".../api/strava/callback"으로 끝나야 함
  const redirectUri = process.env.STRAVA_REDIRECT_URI; 

  if (!clientId || !redirectUri) return res.status(500).send("환경변수(ID, URI) 설정이 필요합니다.");

  const scope = "read,activity:read_all"; 
  const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=auto&scope=${scope}`;
  
  res.redirect(url);
});

// [3] ★ [신규 추가] 콜백 핸들러 (스트라바에서 돌아올 때 토큰 교환)
app.get('/api/strava/callback', (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send("인증 코드가 없습니다.");

    // 토큰 교환 요청
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
                    // 성공! 토큰을 들고 메인 화면으로 복귀
                    res.redirect(`/?strava_token=${result.access_token}`);
                } else {
                    res.status(500).send("토큰 발급 실패: " + JSON.stringify(result));
                }
            } catch (e) { res.status(500).send("서버 에러"); }
        });
    });
    tokenReq.write(postData);
    tokenReq.end();
});

// [4] 운동 기록 조회 API
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
                // 러닝 데이터만 필터링 & 포맷팅
                const formatted = activities
                    .filter(a => a.type === 'Run')
                    .map(a => ({
                        date: a.start_date_local.substring(0, 10).replace(/-/g, '.'),
                        km: a.distance / 1000,
                        timeSec: a.moving_time,
                        paceSec: (a.distance > 0) ? (a.moving_time / (a.distance / 1000)) : 0
                    }));
                res.json({ success: true, data: formatted });
            } catch (e) { res.status(500).json({ success: false, msg: "데이터 파싱 에러" }); }
        });
    });
    stravaReq.end();
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
