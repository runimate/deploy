export default async function handler(req, res) {
    // [수정된 부분] new URL()을 쓰지 않고, req.query에서 바로 꺼냅니다.
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: '인증 코드가 전달되지 않았습니다.' });
    }

    // 환경변수 확인
    const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
    const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
        // 이 에러가 뜨면 Vercel 환경변수 설정을 다시 확인해야 합니다.
        return res.status(500).json({ error: '서버 설정 오류: 스트라바 키가 없습니다.' });
    }

    try {
        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code'
            })
        });

        const data = await response.json();

        if (data.errors) {
            return res.status(500).json({ error: JSON.stringify(data) });
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: '서버 내부 오류 발생' });
    }
}
