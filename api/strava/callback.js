// /api/strava/callback.js
import https from 'https'; // Node.js 내장 모듈 사용 (라이브러리 불필요)

export default function handler(req, res) {
  // 1. URL에서 code와 state 파싱
  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');

  // 2. 쿠키에서 내가 보낸 state 가져오기 (CSRF 검증)
  const cookies = parseCookies(req.headers.cookie);
  const savedState = cookies.strava_oauth_state;

  if (!code || !savedState || returnedState !== savedState) {
    return res.status(400).send("Invalid state or missing code");
  }

  // 3. 토큰 교환 요청 (POST to Strava)
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
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  const tokenReq = https.request(options, (tokenRes) => {
    let data = '';
    tokenRes.on('data', (chunk) => { data += chunk; });
    tokenRes.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.errors) throw new Error(JSON.stringify(result.errors));

        // 4. (중요) 토큰을 브라우저에 전달하며 메인으로 복귀
        // 여기서는 간단히 URL 뒤에 토큰을 붙여서 홈으로 보냅니다.
        // 실제 운영 시에는 세션 쿠키에 굽거나 DB에 저장해야 합니다.
        res.statusCode = 302;
        res.setHeader('Location', `/?strava_token=${result.access_token}`);
        res.end();

      } catch (err) {
        console.error('Token Exchange Error:', err);
        res.statusCode = 500;
        res.end("Token exchange failed");
      }
    });
  });

  tokenReq.on('error', (e) => {
    console.error(e);
    res.statusCode = 500;
    res.end("Network error");
  });

  tokenReq.write(postData);
  tokenReq.end();
}

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(`;`).forEach(function(cookie) {
    let [name, ...rest] = cookie.split(`=`);
    name = name?.trim();
    if (!name) return;
    const value = rest.join(`=`).trim();
    if (!value) return;
    list[name] = decodeURIComponent(value);
  });
  return list;
}
