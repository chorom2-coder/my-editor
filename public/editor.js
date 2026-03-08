const editor = document.getElementById("editor")
const withSpace = document.getElementById("withSpace")
const withoutSpace = document.getElementById("withoutSpace")
const lockBanner = document.getElementById("lockBanner")
const timeText = document.getElementById("timeText")

const modalOverlay = document.getElementById("modalOverlay")
const modalTitle = document.getElementById("modalTitle")
const modalText = document.getElementById("modalText")
const modalActions = document.getElementById("modalActions")

let isLocked = initialLocked === true
let warnedOnce = false
let warnedFive = false
let warnedOne = false

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

function updateCount() {
  const text = editor.value
  withSpace.innerText = text.length
  withoutSpace.innerText = text.replace(/\s/g, "").length
}

function updateLockUI() {
  if (isLocked) {
    editor.disabled = true
    lockBanner.style.display = "block"
  } else {
    editor.disabled = false
    lockBanner.style.display = "none"
  }
}

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
    showModal("임시저장 완료", "현재 내용이 저장되었습니다.", [
      { label: "확인", className: "btn-main", onClick: closeModal }
    ])
  } else {
    showModal("저장 불가", data.msg || "저장할 수 없습니다.", [
      { label: "확인", className: "btn-main", onClick: closeModal }
    ])
  }
}

async function autoSave() {
  if (isLocked) return
  await fetch("/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId,
      text: editor.value
    })
  })
}

function submitWriting() {
  if (isLocked) return

  const chars = editor.value.replace(/\s/g, "").length
  if (chars < minChars) {
    showModal("제출 불가", `최소 ${minChars}자 이상 작성해야 합니다.`, [
      { label: "확인", className: "btn-main", onClick: closeModal }
    ])
    return
  }

  showModal("제출 확인", "제출하면 수정할 수 없습니다.", [
    { label: "취소", className: "btn-outline", onClick: closeModal },
    { label: "제출", className: "btn-main", onClick: reallySubmit }
  ])
}

async function reallySubmit() {
  closeModal()

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
    showModal("제출 불가", data.msg || "제출할 수 없습니다.", [
      { label: "확인", className: "btn-main", onClick: closeModal }
    ])
    return
  }

  showModal("제출 완료", "제출이 완료되었습니다. 잠시 후 자동 로그아웃됩니다.", [
    {
      label: "확인",
      className: "btn-main",
      onClick: () => {
        closeModal()
        location.href = "/student-logout"
      }
    }
  ])

  setTimeout(() => {
    location.href = "/student-logout"
  }, 2200)
}

async function sendWarn() {
  const res = await fetch("/warn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: studentId })
  })

  const data = await res.json()
  if (!data.ok) return

  if (data.locked) {
    isLocked = true
    updateLockUI()

    showModal(
      "입력 제한",
      "입력창이 차단되었습니다. 교수자 승인 후 다시 작성할 수 있습니다.",
      [
        {
          label: "승인 요청",
          className: "btn-main",
          onClick: requestApproval
        }
      ]
    )
  } else if (data.warningCount === 1 && warnedOnce === false) {
    warnedOnce = true
    showModal(
      "화면 이탈 감지",
      "화면 이탈이 감지되었습니다. 다시 이탈하면 입력이 제한될 수 있습니다.",
      [
        {
          label: "확인",
          className: "btn-main",
          onClick: closeModal
        }
      ]
    )
  }
}

async function requestApproval() {
  await fetch("/request-approval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: studentId })
  })
  closeModal()
}

async function pollStatus() {
  const res = await fetch("/status/" + studentId)
  const data = await res.json()
  if (!data.ok) return

  if (data.locked !== isLocked) {
    isLocked = data.locked === true
    updateLockUI()
  }
}

function tryFullscreen() {
  const elem = document.documentElement
  if (document.fullscreenElement) return
  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(() => {})
  }
}

function updateTimer() {
  if (!endTime) {
    timeText.innerText = "--:--"
    return
  }

  const remainMs = Math.max(0, endTime - Date.now())
  const totalSec = Math.floor(remainMs / 1000)
  const min = String(Math.floor(totalSec / 60)).padStart(2, "0")
  const sec = String(totalSec % 60).padStart(2, "0")
  timeText.innerText = `${min}:${sec}`

  if (totalSec <= 300 && totalSec > 60 && !warnedFive) {
    warnedFive = true
    showModal("시간 안내", "5분 남았습니다.", [
      { label: "확인", className: "btn-main", onClick: closeModal }
    ])
  }

  if (totalSec <= 60 && totalSec > 0 && !warnedOne) {
    warnedOne = true
    showModal("시간 안내", "1분 남았습니다.", [
      { label: "확인", className: "btn-main", onClick: closeModal }
    ])
  }

  if (totalSec === 0) {
    editor.disabled = true
  }
}

editor.addEventListener("input", updateCount)

document.addEventListener("copy", e => e.preventDefault())
document.addEventListener("paste", e => e.preventDefault())
document.addEventListener("cut", e => e.preventDefault())
document.addEventListener("contextmenu", e => e.preventDefault())

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    sendWarn()
  }
})

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    sendWarn()
  }
})

document.addEventListener("DOMContentLoaded", () => {
  updateCount()
  updateLockUI()
  updateTimer()
  tryFullscreen()
  document.addEventListener("click", tryFullscreen, { once: true })
})

setInterval(autoSave, 60000)
setInterval(pollStatus, 4000)
setInterval(updateTimer, 1000)