import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// ----------------------------------------------------
// [설정] 파일 경로 관련 (복잡해 보이면 패스하세요!)
// ----------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

// ----------------------------------------------------
// [1] 정적 파일 연결 (화면 깨짐 방지 - 아까 해결한 부분)
// ----------------------------------------------------
// api 폴더의 상위(../) 폴더를 통째로 서비스합니다.
app.use(express.static(path.join(__dirname, '../')));


// ----------------------------------------------------
// [2] 스트라바 로그인 로직 (보여주신 코드 이식)
// ----------------------------------------------------
app.get('/api/strava/login', (req, res) => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).send("환경변수(STRAVA_CLIENT_ID, STRAVA_REDIRECT_URI)가 없습니다.");
  }

  // 간단한 난수 생성
  const state = Math.random().toString(36).substring(7);

  // 쿠키 설정 (보안상 필요한 부분)
  res.cookie('strava_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 10 * 60 * 1000 // 10분
  });

  const scope = "read,activity:read_all"; 
  
  // 스트라바 로그인 페이지 주소 만들기
  const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=auto&scope=${scope}&state=${state}`;

  // 사용자를 스트라바 로그인 페이지로 튕겨줌
  res.redirect(url);
});


// ----------------------------------------------------
// [3] 서버 시작
// ----------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 서버가 포트 ${port}에서 실행 중입니다.`);
  console.log(`👉 http://localhost:${port}`);
});
