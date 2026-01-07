export default async function handler(request, response) {
    // 1. 프론트엔드에서 보낸 'code' 받기
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return response.status(400).json({ error: 'Missing code' });
    }

    // 2. 환경변수에서 비밀키 꺼내기 (Vercel 설정에서 넣어줄 예정)
    const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
    const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

    try {
        // 3. 스트라바에 진짜 토큰 요청
        const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code'
            })
        });

        const data = await tokenResponse.json();

        // 4. 결과 반환
        return response.status(200).json(data);

    } catch (error) {
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
