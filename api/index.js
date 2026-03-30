import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import cors from 'cors';
import bodyParser from 'body-parser';
import { GarminConnect } from 'garmin-connect';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../')));

// ----------------------------------------------------
// [개선] 가민 세션 저장소 (문자열 형태의 토큰 세션 보관)
// ----------------------------------------------------
const garminSessionTokens = new Map();

app.post('/api/garmin', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, msg: "이메일과 비밀번호가 필요합니다." });
    }

    try {
        const client = new GarminConnect();
        let isSessionValid = false;

        // 1. 저장된 토큰 세션이 있는지 확인
        if (garminSessionTokens.has(email)) {
            try {
                console.log(`[Garmin] 저장된 세션 토큰 복원 시도: ${email}`);
                // 저장된 JSON 세션 정보를 불러와서 로그인을 건너뜀
                await client.importSession(garminSessionTokens.get(email));
                isSessionValid = true;
            } catch (sessionErr) {
                console.log(`[Garmin] 기존 세션 만료, 다시 로그인합니다.`);
                garminSessionTokens.delete(email);
            }
        }

        // 2. 세션이 없거나 만료된 경우만 실제 로그인 시도 (429 차단의 주범 방지)
        if (!isSessionValid) {
            console.log(`[Garmin] 신규 로그인 시도 (SSO 호출): ${email}`);
            await client.login(email, password);
            
            // 로그인 성공 시 세션 정보를 문자열로 내보내서 저장 (Garth 세션)
            const sessionJson = client.exportSession();
            garminSessionTokens.set(email, sessionJson);
        }

        // 3. 활동 데이터 가져오기
        const activities = await client.getActivities(0, 20);
        
        const formatted = activities
            .filter(a => a.activityType.typeKey.includes('run'))
            .map(a => {
                const km = a.distance / 1000;
                const timeSec = a.duration;
                return {
                    date: a.startTimeLocal.substring(0, 10).replace(/-/g, '.'),
                    km: km,
                    timeSec: timeSec,
                    paceSec: km > 0 ? (timeSec / km) : 0,
                    sportType: a.activityType.typeKey
                };
            });

        res.json({ success: true, data: formatted });

    } catch (err) {
        console.error("[Garmin Error]", err.message);
        
        // 429 에러(Too Many Requests) 특별 처리
        if (err.message.includes('429')) {
            return res.status(429).json({ 
                success: false, 
                msg: "가민 서버가 일시적으로 접근을 차단했습니다. 약 1시간 후 다시 시도해 주세요." 
            });
        }

        // 기타 에러 발생 시 세션 삭제
        garminSessionTokens.delete(email);
        res.status(500).json({ success: false, msg: err.message });
    }
});

// --- 스트라바 로그인 및 활동 조회 로직 (기존과 동일하므로 생략 가능하나 그대로 유지) ---
app.get('/api/strava/login', (req, res) => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const redirectUri = process.env.STRAVA_REDIRECT_URI;
    if (!clientId || !redirectUri) return res.status(500).send("환경변수 설정 필요");
    const state = Math.random().toString(36).substring(7);
    const scope = "read,activity:read_all"; 
    const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=auto&scope=${scope}&state=${state}`;
    res.redirect(url);
});

app.get('/api/strava/activities', (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(400).json({ success: false, msg: "토큰이 없습니다." });
    const options = {
        hostname: 'www.strava.com',
        path: '/api/v3/athlete/activities?per_page=30',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'Runimate/2.0' }
    };
    const stravaReq = https.request(options, (stravaRes) => {
        let data = '';
        stravaRes.on('data', (chunk) => { data += chunk; });
        stravaRes.on('end', () => {
            try {
                if (stravaRes.statusCode !== 200) throw new Error(`Strava Error: ${stravaRes.statusCode}`);
                const activities = JSON.parse(data);
                const formatted = activities.filter(a => a.type === 'Run').map(a => {
                    const km = a.distance / 1000;
                    const timeSec = a.moving_time;
                    return { date: a.start_date_local.substring(0, 10).replace(/-/g, '.'), km: km, timeSec: timeSec, paceSec: km > 0 ? (timeSec / km) : 0 };
                });
                res.json({ success: true, data: formatted });
            } catch (err) { res.status(500).json({ success: false, msg: "데이터 불러오기 실패" }); }
        });
    });
    stravaReq.on('error', (e) => res.status(500).json({ success: false, msg: "네트워크 에러" }));
    stravaReq.end();
});

app.listen(port, () => {
    console.log(`🚀 RUNIMATE Server running on port ${port}`);
});
