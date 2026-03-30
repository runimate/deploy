import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import cors from 'cors';
import bodyParser from 'body-parser';
import { GarminConnect } from 'garmin-connect';
import rateLimit from 'express-rate-limit'; // [추가] 요청 제한 라이브러리

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../')));

// ----------------------------------------------------
// [보안] 가민 연동 전용 Rate Limiter 설정
// 15분당 한 IP에서 최대 5번의 로그인/조회만 허용합니다.
// ----------------------------------------------------
const garminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 5, // IP당 최대 요청 횟수
    message: { 
        success: false, 
        msg: "너무 많은 시도가 감지되었습니다. 보안을 위해 15분 뒤에 다시 시도해주세요." 
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// ----------------------------------------------------
// [핵심] 가민 세션 저장소 (서버 메모리에 세션 토큰 보관)
// ----------------------------------------------------
const garminSessionTokens = new Map();

// ----------------------------------------------------
// [가민 API] 요청 제한(garminLimiter) 적용
// ----------------------------------------------------
app.post('/api/garmin', garminLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, msg: "이메일과 비밀번호가 필요합니다." });
    }

    try {
        const client = new GarminConnect();
        let isSessionValid = false;

        // 1. 저장된 세션 토큰 확인 (불필요한 로그인 방지)
        if (garminSessionTokens.has(email)) {
            try {
                console.log(`[Garmin] 세션 복원 시도: ${email}`);
                await client.importSession(garminSessionTokens.get(email));
                isSessionValid = true;
            } catch (sessionErr) {
                console.log(`[Garmin] 세션 만료됨`);
                garminSessionTokens.delete(email);
            }
        }

        // 2. 세션이 없을 때만 실제 로그인 (가장 위험한 단계)
        if (!isSessionValid) {
            console.log(`[Garmin] 신규 로그인 시도: ${email}`);
            await client.login(email, password);
            // 로그인 성공 시 세션 추출 및 저장
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
        
        // 차단(429) 에러 발생 시 처리
        if (err.message.includes('429')) {
            return res.status(429).json({ 
                success: false, 
                msg: "가민 서버가 일시적으로 접근을 차단했습니다. 약 1시간 후 다시 시도해 주세요." 
            });
        }

        garminSessionTokens.delete(email);
        res.status(500).json({ success: false, msg: "가민 연동 실패: 아이디/비번을 확인해주세요." });
    }
});

// --- 스트라바 로직 (기본 유지) ---
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
