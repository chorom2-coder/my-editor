// ================================
// 0. DOM 요소
// ================================
const editor = document.getElementById("editor")
const withSpace = document.getElementById("withSpace")
const withoutSpace = document.getElementById("withoutSpace")
const lockBanner = document.getElementById("lockBanner")
const timeText = document.getElementById("timeText")

const modalOverlay = document.getElementById("modalOverlay")
const modalTitle = document.getElementById("modalTitle")
const modalText = document.getElementById("modalText")
const modalActions = document.getElementById("modalActions")

// ================================
// 1. 상태값 (안전 초기화)
// ================================
let isLocked = (typeof initialLocked !== "undefined") ? initialLocked === true : false
let currentEndTime = (typeof endTime !== "undefined") ? Number(endTime) : null

let warnedOnce = false
let warnedFive = false
let warnedOne = false

let lastSavedText = editor ? editor.value : ""
let autoSaveInFlight = false
let autoSaveQueued = false

// ================================
// 2. 모달
// ================================
function showModal(title, text, buttons) {
  modalTitle.innerText = title
  modalText.innerText = text
  modalActions.innerHTML = ""

  buttons.forEach(btn => {
    const button = document.createElement("button")
    button.type = "button"
    button.className = btn.className || "btn-main"
    button.innerText = btn.label
    button.onclick = btn.onClick
    modalActions.appendChild(button)
  })

  modalOverlay.style.display = "flex"
}

function closeModal() {
  modalOverlay.style.display = "none"
}

// ================================
// 3. 글자수
// ================================
function updateCount() {
  if (!editor) return
  const text = editor.value
  if (withSpace) withSpace.innerText = text.length
  if (withoutSpace) withoutSpace.innerText = text.replace(/\s/g, "").length
}

// ================================
// 4. UI 업데이트 (타이머 + 잠금)
// ================================
function refreshApp() {
  if (editor) {
    editor.disabled = isLocked
    if (lockBanner) lockBanner.style.display = isLocked ? "block" : "none"
  }

  if (timeText && currentEndTime) {
    const remainMs = currentEndTime - Date.now()

    if (remainMs <= 0) {
      timeText.innerText = "00:00"
      if (editor) editor.disabled = true
    } else {
      const totalSec = Math.floor(remainMs / 1000)
      const min = String(Math.floor(totalSec / 60)).padStart(2, "0")
      const sec = String(totalSec % 60).padStart(2, "0")
      timeText.innerText = `${min}:${sec}`

      if (totalSec <= 300 && totalSec > 60 && !warnedFive) {
        warnedFive = true
        showModal("시간 안내", "5분 남았습니다.", [{ label: "확인", onClick: closeModal }])
      }

      if (totalSec <= 60 && totalSec > 0 && !warnedOne) {
        warnedOne = true
        showModal("시간 안내", "1분 남았습니다.", [{ label: "확인", onClick: closeModal }])
      }
    }
  }
}

// ================================
// 5. 서버 상태 동기화
// ================================
async function syncStatus() {
  try {
    const res = await fetch("/status/" + studentId)
    const data = await res.json()

    if (!data.ok) return

    if (data.submitted === true) {
      location.href = "/result/" + studentId
      return
    }

    if (data.started !== true) {
      location.href = "/waiting/" + studentId
      return
    }

    isLocked = data.locked === true
    if (data.endTime) currentEndTime = Number(data.endTime)

    refreshApp()
  } catch (e) {}
}

// ================================
// 6. 저장
// ================================
async function manualSave() {
  if (isLocked) return

  const res = await fetch("/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId,
      text: editor.value
    })
  })

  const data = await res.json()

  if (data.ok) {
    lastSavedText = editor.value
    showModal("임시저장 완료", "저장되었습니다.", [
      { label: "확인", onClick: closeModal }
    ])
  }
}

async function autoSave() {
  if (isLocked || autoSaveInFlight) return

  const text = editor.value
  if (text === lastSavedText) return

  autoSaveInFlight = true

  try {
    const res = await fetch("/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, text })
    })

    const data = await res.json()
    if (data.ok) lastSavedText = text
  } catch (e) {}

  autoSaveInFlight = false
}

// ================================
// 7. 제출
// ================================
function submitWriting() {
  if (isLocked) return

  const chars = editor.value.replace(/\s/g, "").length

  if (chars < minChars) {
    showModal("제출 불가", `최소 ${minChars}자 이상 필요`, [
      { label: "확인", onClick: closeModal }
    ])
    return
  }

  showModal("제출 확인", "제출하면 수정 불가", [
    { label: "취소", onClick: closeModal },
    { label: "제출", onClick: reallySubmit }
  ])
}

async function reallySubmit() {
  closeModal()

  // 파일 다운로드
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)

  const fullContent =
`${topic}
${studentName} | ${dateStr}

${editor.value}`

  const blob = new Blob([fullContent])
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${topic}_${studentName}_${dateStr}.txt`
  a.click()

  // 서버 제출
  const res = await fetch("/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId,
      text: editor.value
    })
  })

  const data = await res.json()

  if (!data.ok) {
    showModal("제출 실패", "오류 발생", [
      { label: "확인", onClick: closeModal }
    ])
    return
  }

  showModal("제출 완료", "로그아웃됩니다.", [
    {
      label: "확인",
      onClick: () => location.href = "/student-logout"
    }
  ])

  setTimeout(() => {
    location.href = "/student-logout"
  }, 2000)
}

// ================================
// 8. 다운로드
// ================================
function downloadTxt() {
  const blob = new Blob([editor.value])
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = "writing.txt"
  a.click()
}

// ================================
// 9. 이벤트
// ================================
if (editor) editor.addEventListener("input", updateCount)

document.addEventListener("DOMContentLoaded", () => {
  updateCount()
  refreshApp()
  syncStatus()
})

// ================================
// 10. 반복 실행
// ================================
setInterval(refreshApp, 1000)
setInterval(syncStatus, 3000)
setInterval(autoSave, 15000)