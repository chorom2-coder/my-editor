const editor = document.getElementById("editor")
const submitBtn = document.getElementById("submitBtn")
const timerText = document.getElementById("timerText")
const lockBanner = document.getElementById("lockBanner")

const modalOverlay = document.getElementById("modalOverlay")
const modalTitle = document.getElementById("modalTitle")
const modalMessage = document.getElementById("modalMessage")
const modalButtons = document.getElementById("modalButtons")

let isLocked = initialLocked
let timeEnded = false
let warned5 = false
let warned1 = false

function showModal(title, message, buttons) {
  modalTitle.innerText = title
  modalMessage.innerText = message
  modalButtons.innerHTML = ""

  buttons.forEach(btn => {
    const button = document.createElement("button")
    button.type = "button"
    button.className = btn.className || "soft-btn"
    button.innerText = btn.label
    button.onclick = btn.onClick
    modalButtons.appendChild(button)
  })

  modalOverlay.style.display = "flex"
}

function closeModal() {
  modalOverlay.style.display = "none"
}

function updateLockUI() {
  if (isLocked) {
    editor.disabled = true
    submitBtn.disabled = true
    lockBanner.style.display = "block"
  } else {
    lockBanner.style.display = "none"
    editor.disabled = false
    submitBtn.disabled = false
  }

  if (timeEnded) {
    editor.disabled = true
    submitBtn.disabled = false
  }
}

function countChars() {
  const text = editor.value
  document.getElementById("withSpace").innerText = text.length
  document.getElementById("withoutSpace").innerText = text.replace(/\s/g, "").length
}

function requestFullscreenMode() {
  const el = document.documentElement

  if (document.fullscreenElement) return

  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {})
  }
}

function sendWarn() {
  fetch("/warn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  })
    .then(res => res.json())
    .then(data => {
      if (!data.ok) return

      if (data.locked) {
        isLocked = true
        updateLockUI()

        showModal(
          "입력창 차단",
          "화면 이탈 2회 감지: 입력창 차단\n잠금을 해제하려면 교수자의 승인이 필요합니다.",
          [
            {
              label: "확인",
              className: "subtle-btn",
              onClick: closeModal
            },
            {
              label: "승인 요청",
              className: "soft-btn",
              onClick: requestApproval
            }
          ]
        )
      } else if (data.warningCount === 1) {
        showModal(
          "화면 이탈 감지",
          "화면 이탈이 감지되었습니다. 다시 이탈하면 입력창이 차단될 수 있습니다.",
          [
            {
              label: "확인",
              className: "soft-btn",
              onClick: closeModal
            }
          ]
        )
      }
    })
}

function requestApproval() {
  fetch("/request-approval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        closeModal()
        showModal(
          "승인 요청 완료",
          "교수자에게 승인 요청을 보냈습니다.",
          [
            {
              label: "확인",
              className: "soft-btn",
              onClick: closeModal
            }
          ]
        )
      }
    })
}

function autoSave() {
  if (isLocked || timeEnded) return

  fetch("/autosave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      text: editor.value
    })
  })
}

function manualSave() {
  if (isLocked) {
    showModal(
      "입력창 차단",
      "현재 입력이 차단되어 있습니다. 교수자 승인 후 다시 작성할 수 있습니다.",
      [{ label: "확인", className: "soft-btn", onClick: closeModal }]
    )
    return
  }

  if (timeEnded) {
    showModal(
      "작성 종료",
      "작성 시간이 종료되어 더 이상 저장할 수 없습니다.",
      [{ label: "확인", className: "soft-btn", onClick: closeModal }]
    )
    return
  }

  fetch("/autosave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      text: editor.value
    })
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        showModal(
          "임시저장 완료",
          "현재 내용이 저장되었습니다.",
          [{ label: "확인", className: "soft-btn", onClick: closeModal }]
        )
      } else {
        showModal(
          "저장 실패",
          data.msg || "저장에 실패했습니다.",
          [{ label: "확인", className: "soft-btn", onClick: closeModal }]
        )
      }
    })
}

function submitExam() {
  if (isLocked) {
    showModal(
      "입력창 차단",
      "현재 입력이 차단되어 있습니다. 교수자 승인 후 다시 작성할 수 있습니다.",
      [{ label: "확인", className: "soft-btn", onClick: closeModal }]
    )
    return
  }

  const text = editor.value
  const charCount = text.replace(/\s/g, "").length

  if (charCount < minChars) {
    showModal(
      "제출 불가",
      "최소 " + minChars + "자 이상 작성해야 합니다.",
      [{ label: "확인", className: "soft-btn", onClick: closeModal }]
    )
    return
  }

  showModal(
    "제출 확인",
    "제출하면 더 이상 수정할 수 없습니다.",
    [
      { label: "취소", className: "subtle-btn", onClick: closeModal },
      {
        label: "제출",
        className: "danger-btn",
        onClick: actuallySubmit
      }
    ]
  )
}

function actuallySubmit() {
  closeModal()

  fetch("/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      text: editor.value
    })
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        showModal(
          "제출 완료",
          "제출이 완료되었습니다. 잠시 후 자동으로 로그아웃됩니다.",
          [
            {
              label: "확인",
              className: "soft-btn",
              onClick: () => {
                closeModal()
                setTimeout(() => {
                  location.href = "/student-logout"
                }, 300)
              }
            }
          ]
        )

        setTimeout(() => {
          location.href = "/student-logout"
        }, 2500)
      } else {
        showModal(
          "제출 불가",
          data.msg || "제출에 실패했습니다.",
          [{ label: "확인", className: "soft-btn", onClick: closeModal }]
        )
      }
    })
}

function updateTimer() {
  if (!startTime || !endTime) {
    timerText.innerText = "--:--"
    return
  }

  const now = Date.now()
  let remain = endTime - now

  if (remain <= 0) {
    remain = 0

    if (!timeEnded) {
      timeEnded = true
      updateLockUI()
      showModal(
        "작성 종료",
        "작성 시간이 종료되었습니다. 더 이상 수정할 수 없습니다. 작성된 내용을 제출할 수 있습니다.",
        [{ label: "확인", className: "soft-btn", onClick: closeModal }]
      )
    }
  }

  const totalSec = Math.floor(remain / 1000)
  const min = String(Math.floor(totalSec / 60)).padStart(2, "0")
  const sec = String(totalSec % 60).padStart(2, "0")
  timerText.innerText = `${min}:${sec}`

  if (totalSec <= 300 && !warned5 && totalSec > 60) {
    warned5 = true
    showModal(
      "시간 안내",
      "5분 남았습니다.",
      [{ label: "확인", className: "soft-btn", onClick: closeModal }]
    )
  }

  if (totalSec <= 60 && !warned1 && totalSec > 0) {
    warned1 = true
    showModal(
      "시간 안내",
      "1분 남았습니다.",
      [{ label: "확인", className: "soft-btn", onClick: closeModal }]
    )
  }
}

function pollStatus() {
  fetch("/status/" + id)
    .then(res => res.json())
    .then(data => {
      if (!data.ok) return

      if (data.locked && !isLocked) {
        isLocked = true
        updateLockUI()
      }

      if (!data.locked && isLocked) {
        isLocked = false
        updateLockUI()
      }

      if (!data.started && !timeEnded) {
        timeEnded = true
        updateLockUI()
      }
    })
}

document.addEventListener("keydown", function(e) {
  const key = e.key.toLowerCase()

  if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a"].includes(key)) {
    e.preventDefault()
  }

  if (e.key === "F11") {
    e.preventDefault()
  }

  if (e.altKey && e.key === "Tab") {
    e.preventDefault()
  }
})

document.addEventListener("contextmenu", function(e) {
  e.preventDefault()
})

document.addEventListener("copy", function(e) {
  e.preventDefault()
})

document.addEventListener("paste", function(e) {
  e.preventDefault()
})

document.addEventListener("cut", function(e) {
  e.preventDefault()
})

document.addEventListener("visibilitychange", function() {
  if (document.hidden) {
    sendWarn()
  }
})

window.addEventListener("blur", function() {
  if (!document.hidden) {
    sendWarn()
  }
})

document.addEventListener("fullscreenchange", function() {
  if (!document.fullscreenElement) {
    sendWarn()
  }
})

editor.addEventListener("input", countChars)

countChars()
updateLockUI()
requestFullscreenMode()
updateTimer()
pollStatus()

setInterval(autoSave, 60000)
setInterval(updateTimer, 1000)
setInterval(pollStatus, 5000)