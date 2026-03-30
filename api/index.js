import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import cors from 'cors';
import bodyParser from 'body-parser';
import { GarminConnect } from 'garmin-connect'; // 가민 라이브러리 추가

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

// [필수 추가] 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../')));

// ----------------------------------------------------
// [핵심] 가민 세션 저장소 (서버 메모리에 로그인 상태 유지)
// ----------------------------------------------------
const garminSessions = new Map();

// ----------------------------------------------------
// [신규] 가민 운동 기록 조회 API (429 차단 방지 적용)
// ----------------------------------------------------
app.post('/api/garmin', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, msg: "이메일과 비밀번호가 필요합니다." });
    }

    try {
        let client;

        // 1. 이미 로그인된 세션이 있는지 확인 (매번 로그인 방지)
        if (garminSessions.has(email)) {
            console.log(`[Garmin] 캐시된 세션 사용: ${email}`);
            client = garminSessions.get(email);
        } else {
            // 2. 세션이 없으면 신규 로그인 시도
            console.log(`[Garmin] 신규 로그인 시도: ${email}`);
            client = new GarminConnect();
            await client.login(email, password);
            
            // 로그인 성공 시 세션 저장소에 보관
            garminSessions.set(email, client);
        }

        // 3. 활동 데이터 가져오기 (최근 20개)
        const activities = await client.getActivities(0, 20);
        
        // 4. 데이터 가공 (러니메이트 형식에 맞춤)
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
        
        // 에러 발생 시 해당 계정의 세션 삭제 (재로그인 유도)
        garminSessions.delete(email);
        
        // 가민 서버가 429 에러를 뱉을 경우의 처리
        if (err.message.includes('429')) {
            return res.status(429).json({ 
                success: false, 
                msg: "가민 서버의 요청 제한에 걸렸습니다. 1시간 뒤에 다시 시도해주세요." 
            });
        }
        
        res.status(500).json({ success: false, msg: "가민 연동 중 에러가 발생했습니다." });
    }
});

// ----------------------------------------------------
// [기존] 스트라바 로그인 (유지)
// ----------------------------------------------------
app.get('/api/strava/login', (req, res) => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const redirectUri = process.env.STRAVA_REDIRECT_URI;
    if (!clientId || !redirectUri) return res.status(500).send("환경변수 설정 필요");
    const state = Math.random().toString(36).substring(7);
    const scope = "read,activity:read_all"; 
    const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=auto&scope=${scope}&state=${state}`;
    res.redirect(url);
});

// ----------------------------------------------------
// [기존] 스트라바 운동 기록 조회 (유지)
// ----------------------------------------------------
app.get('/api/strava/activities', (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(400).json({ success: false, msg: "토큰이 없습니다." });

    const options = {
        hostname: 'www.strava.com',
        path: '/api/v3/athlete/activities?per_page=30',
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
                if (stravaRes.statusCode !== 200) throw new Error(`Strava Error: ${stravaRes.statusCode}`);
                const activities = JSON.parse(data);
                const formatted = activities
                    .filter(a => a.type === 'Run')
                    .map(a => {
                        const km = a.distance / 1000;
                        const timeSec = a.moving_time;
                        return {
                            date: a.start_date_local.substring(0, 10).replace(/-/g, '.'),
                            km: km,
                            timeSec: timeSec,
                            paceSec: km > 0 ? (timeSec / km) : 0
                        };
                    });
                res.json({ success: true, data: formatted });
            } catch (err) {
                res.status(500).json({ success: false, msg: "데이터 불러오기 실패" });
            }
        });
    });
    stravaReq.on('error', (e) => res.status(500).json({ success: false, msg: "네트워크 에러" }));
    stravaReq.end();
});

app.listen(port, () => {
    console.log(`🚀 RUNIMATE Server running on port ${port}`);
});
