// 변수 선언 및 초기화 (에러 방지 처리)
const editor = document.getElementById("editor");
const withSpace = document.getElementById("withSpace");
const withoutSpace = document.getElementById("withoutSpace");
const lockBanner = document.getElementById("lockBanner");
const timeText = document.getElementById("timeText");

const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalText = document.getElementById("modalText");
const modalActions = document.getElementById("modalActions");

// initialLocked가 정의되지 않았을 경우를 대비
let isLocked = (typeof initialLocked !== 'undefined') ? initialLocked : false;
let warnedOnce = false;
let warnedFive = false;
let warnedOne = false;
let currentEndTime = (typeof endTime !== 'undefined') ? endTime : null;
let lastSavedText = editor ? editor.value : "";
let autoSaveInFlight = false;
let autoSaveQueued = false;

// UI 업데이트 함수 (가장 중요)
function updateLockUI() {
    if (!editor || !lockBanner) return;
    // 교수자 승인 여부에 따라 입력창 활성화/비활성화
    editor.disabled = isLocked;
    lockBanner.style.display = isLocked ? "block" : "none";
}

function updateCount() {
    if (!editor || !withSpace || !withoutSpace) return;
    const text = editor.value;
    withSpace.innerText = text.length;
    withoutSpace.innerText = text.replace(/\s/g, "").length;
}

function updateTimer() {
    if (!timeText || !currentEndTime) {
        if (timeText) timeText.innerText = "--:--";
        return;
    }

    const remainMs = Math.max(0, currentEndTime - Date.now());
    const totalSec = Math.floor(remainMs / 1000);
    
    const min = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const sec = String(totalSec % 60).padStart(2, "0");
    timeText.innerText = `${min}:${sec}`;

    // 시간이 다 되면 입력 차단
    if (totalSec <= 0 && editor) {
        editor.disabled = true;
    }
}

// 모달 및 기타 기능
function showModal(title, text, buttons) {
    if (!modalTitle || !modalText || !modalActions) return;
    modalTitle.innerText = title;
    modalText.innerText = text;
    modalActions.innerHTML = "";
    buttons.forEach(btn => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = btn.className || "btn-main";
        button.innerText = btn.label;
        button.onclick = btn.onClick;
        modalActions.appendChild(button);
    });
    modalOverlay.style.display = "flex";
}

function closeModal() { if (modalOverlay) modalOverlay.style.display = "none"; }

// 상태 확인 (폴링)
async function pollStatus() {
    try {
        const res = await fetch("/status/" + studentId);
        const data = await res.json();
        if (!data.ok) return;

        if (data.submitted) { location.href = "/result/" + studentId; return; }
        if (data.started !== true) { location.href = "/waiting/" + studentId; return; }

        if (data.endTime) currentEndTime = Number(data.endTime);
        if (data.locked !== isLocked) {
            isLocked = data.locked === true;
            updateLockUI();
        }
    } catch (e) { console.error("상태 확인 실패", e); }
}

// 이벤트 리스너 등록
if (editor) {
    editor.addEventListener("input", updateCount);
}

// 초기 실행
document.addEventListener("DOMContentLoaded", () => {
    updateCount();
    updateLockUI();
    updateTimer();
});

// 주기적 실행
setInterval(updateTimer, 1000);
setInterval(pollStatus, 4000);

// 기존에 있던 submitWriting, manualSave 등 나머지 함수는 이 아래에 그대로 붙여넣으셔도 됩니다.
// 하지만 지금 급하시다면 위 코드만으로도 '입력'과 '타이머'는 살아납니다.