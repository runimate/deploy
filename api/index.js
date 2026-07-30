import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import cors from 'cors';
import bodyParser from 'body-parser';
import { GarminConnect } from '@gooin/garmin-connect';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../')));

// ----------------------------------------------------
// [1] 가민 (Garmin) 로직
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

const garminSessionTokens = new Map();

app.post('/api/garmin', garminLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, msg: "이메일과 비밀번호가 필요합니다." });
    }

    try {
        const client = new GarminConnect();
        let isSessionValid = false;

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

        if (!isSessionValid) {
            console.log(`[Garmin] 신규 로그인 시도: ${email}`);
            await client.login(email, password);
            const sessionJson = client.exportSession();
            garminSessionTokens.set(email, sessionJson);
        }

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
                    elevGain: a.elevationGain || 0,
                    sportType: a.activityType.typeKey
                };
            });

        res.json({ success: true, data: formatted });

    } catch (err) {
        console.error("[Garmin Error]", err.message);
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

// ----------------------------------------------------
// [2] 스트라바 (Strava) 로직 통합
// ----------------------------------------------------
app.post('/api/strava', async (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({ success: false, msg: "인증 코드가 없습니다." });
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    // 1단계: 프론트엔드에서 넘어온 'code'를 사용해 스트라바 '토큰' 발급받기
    const postData = JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code'
    });

    const tokenOptions = {
        hostname: 'www.strava.com',
        path: '/oauth/token',
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData) 
        }
    };

    const tokenReq = https.request(tokenOptions, (tokenRes) => {
        let tokenData = '';
        tokenRes.on('data', chunk => tokenData += chunk);
        tokenRes.on('end', () => {
            try {
                const tokenResult = JSON.parse(tokenData);
                if (tokenResult.access_token) {
                    // 2단계: 토큰 발급에 성공하면 곧바로 활동 데이터(Activities) 조회
                    fetchStravaActivities(tokenResult.access_token, res);
                } else {
                    res.status(500).json({ success: false, msg: "스트라바 토큰 발급에 실패했습니다." });
                }
            } catch (e) {
                res.status(500).json({ success: false, msg: "스트라바 인증 정보 처리 중 에러가 발생했습니다." });
            }
        });
    });

    tokenReq.on('error', (e) => res.status(500).json({ success: false, msg: "스트라바 서버 연결 에러" }));
    tokenReq.write(postData);
    tokenReq.end();
});

// 스트라바 활동 데이터 파싱 및 전달 함수
function fetchStravaActivities(token, res) {
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
                    .filter(a => a.type === 'Run' || a.type === 'TrailRun') // 러닝과 트레일러닝 모두 포함
                    .map(a => {
                        const km = a.distance / 1000;
                        const timeSec = a.moving_time;
                        return {
                            date: a.start_date_local.substring(0, 10).replace(/-/g, '.'),
                            km: km,
                            timeSec: timeSec,
                            paceSec: (km > 0) ? (timeSec / km) : 0,
                            elevGain: a.total_elevation_gain || 0,
                            sportType: a.type
                        };
                    });
                res.json({ success: true, data: formatted });
            } catch (e) {
                res.status(500).json({ success: false, msg: "운동 데이터를 불러오는 중 에러가 발생했습니다." });
            }
        });
    });

    stravaReq.on('error', (e) => res.status(500).json({ success: false, msg: "스트라바 데이터 요청 에러" }));
    stravaReq.end();
}

app.listen(port, () => {
    console.log(`🚀 RUNIMATE Server running on port ${port}`);
});
