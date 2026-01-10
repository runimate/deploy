import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https'; // [중요] 스트라바 통신용

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

// ----------------------------------------------------
// [1] 정적 파일 연결
// ----------------------------------------------------
app.use(express.static(path.join(__dirname, '../')));

// ----------------------------------------------------
// [2] 스트라바 로그인 (인증 페이지로 이동)
// ----------------------------------------------------
app.get('/api/strava/login', (req, res) => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;

  if (!clientId || !redirectUri) return res.status(500).send("환경변수 설정 필요");

  const state = Math.random().toString(36).substring(7);
  res.cookie('strava_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 600000 });

  const scope = "read,activity:read_all"; 
  const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=auto&scope=${scope}&state=${state}`;
  
  res.redirect(url);
});

// ----------------------------------------------------
// [3] 운동 기록 조회 API (새로 추가된 핵심 기능!)
// ----------------------------------------------------
app.get('/api/strava/activities', (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(400).json({ success: false, msg: "토큰이 없습니다." });

    // 스트라바 서버에 기록 요청
    const options = {
        hostname: 'www.strava.com',
        path: '/api/v3/athlete/activities?per_page=30', // 최근 30개만
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Runimate/2.0'
        }
    };

    const stravaReq = https.request(options, (stravaRes) => {
        let data = '';
        stravaRes.on('data', (chunk) => { data += chunk; });
        stravaRes.on('end', () => {
            try {
                if (stravaRes.statusCode !== 200) {
                    throw new Error(`Strava Error: ${stravaRes.statusCode}`);
                }
                const activities = JSON.parse(data);
                
                // [데이터 가공] 우리 앱 입맛에 맞게 변환
                const formatted = activities
                    .filter(a => a.type === 'Run') // 러닝만 필터링
                    .map(a => {
                        const km = a.distance / 1000;
                        const timeSec = a.moving_time;
                        const paceSec = km > 0 ? (timeSec / km) : 0;
                        
                        // 날짜 포맷 (YYYY-MM-DD -> YYYY.MM.DD)
                        const date = a.start_date_local.substring(0, 10).replace(/-/g, '.');

                        return {
                            date: date,
                            km: km,            // 숫자 그대로 (프론트에서 포맷팅)
                            timeSec: timeSec,  // 초 단위
                            paceSec: paceSec   // 초 단위 (페이스)
                        };
                    });

                res.json({ success: true, data: formatted });

            } catch (err) {
                console.error(err);
                res.status(500).json({ success: false, msg: "데이터 불러오기 실패" });
            }
        });
    });

    stravaReq.on('error', (e) => {
        console.error(e);
        res.status(500).json({ success: false, msg: "네트워크 에러" });
    });
    stravaReq.end();
});

// ----------------------------------------------------
// [4] 서버 시작
// ----------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 RUNIMATE Server running on port ${port}`);
});
