export default async function handler(req, res) {
    // 프론트엔드에서 보낸 토큰을 확인합니다.
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ error: '인증 토큰이 없습니다.' });
    }

    try {
        // 스트라바 API 호출 (운동 기록 30개 가져오기)
        const response = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
            headers: {
                'Authorization': authHeader // 프론트에서 받은 토큰 그대로 전달
            }
        });

        const data = await response.json();

        if (response.status !== 200) {
            return res.status(response.status).json({ error: data.message });
        }

        // 성공적으로 데이터를 반환
        // (필요한 데이터만 추려서 보내줄 수도 있지만, 일단 통째로 넘깁니다)
        return res.status(200).json({ ok: true, workouts: transformData(data) });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: '데이터를 가져오는 중 오류가 발생했습니다.' });
    }
}

// 스트라바 데이터를 우리 앱 형식에 맞게 예쁘게 다듬는 함수
function transformData(stravaList) {
    if (!Array.isArray(stravaList)) return [];
    
    return stravaList.map(item => {
        // 날짜 포맷 (YYYY.MM.DD)
        const dateObj = new Date(item.start_date_local);
        const dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')}`;

        return {
            id: item.id,
            date: dateStr,
            km: item.distance / 1000, // 미터 -> 킬로미터
            paceSec: (item.moving_time / (item.distance / 1000)), // 초/km
            timeSec: item.moving_time, // 초
            raw: item // 나중에 디테일이 필요할 수 있으니 원본도 보관
        };
    });
}
