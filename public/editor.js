// 1. 필요한 요소들을 안전하게 가져오기
const editor = document.getElementById("editor");
// ID가 timeText인지 timer인지 확실하지 않으므로 둘 다 체크합니다.
const timeDisplay = document.getElementById("timeText") || document.getElementById("timer") || document.getElementById("time-display");
const lockBanner = document.getElementById("lockBanner") || document.getElementById("lock-message");

// 2. 변수 초기화 (서버 데이터 우선, 없으면 기본값)
let isLocked = (typeof initialLocked !== 'undefined') ? initialLocked : false;
let currentEndTime = (typeof endTime !== 'undefined') ? Number(endTime) : null;

// 3. 타이머 및 잠금 UI 통합 업데이트 함수
function refreshApp() {
    // [잠금 처리]
    if (editor) {
        // 교수자가 승인했으면(isLocked가 false면) disabled를 풉니다.
        editor.disabled = isLocked;
        if (lockBanner) lockBanner.style.display = isLocked ? "block" : "none";
    }

    // [타이머 처리]
    if (timeDisplay && currentEndTime) {
        const remainMs = currentEndTime - Date.now();
        if (remainMs <= 0) {
            timeDisplay.innerText = "00:00";
            if (editor) editor.disabled = true;
        } else {
            const totalSec = Math.floor(remainMs / 1000);
            const min = String(Math.floor(totalSec / 60)).padStart(2, "0");
            const sec = String(totalSec % 60).padStart(2, "0");
            timeDisplay.innerText = `${min}:${sec}`;
        }
    }
}

// 4. 서버 상태 실시간 확인 (폴링)
async function syncStatus() {
    try {
        const res = await fetch("/status/" + studentId);
        const data = await res.json();
        if (data.ok) {
            isLocked = data.locked === true;
            if (data.endTime) currentEndTime = Number(data.endTime);
            refreshApp();
        }
    } catch (e) {
        console.log("연결 확인 중...");
    }
}

// 5. 실행 스케줄러 (기존 setInterval 모두 무시하고 이것만 실행)
setInterval(refreshApp, 1000); // 1초마다 화면 갱신
setInterval(syncStatus, 3000); // 3초마다 서버 상태 동기화

// 페이지 로드 시 즉시 실행
document.addEventListener("DOMContentLoaded", () => {
    refreshApp();
    syncStatus();
});

// 나머지 저장/제출 함수들은 기존 그대로 사용 (필요시 아래에 추가)