function getQueryStateFromUrl() {
  const url = new URL(window.location.href)
  return {
    search: url.searchParams.get("search") || "",
    classFilter: url.searchParams.get("class") || "",
    submissionFilter: url.searchParams.get("submissionFilter") || "",
    approvalOnly: url.searchParams.get("approvalOnly") || "",
    manageClass: url.searchParams.get("manageClass") || "",
    prof: url.searchParams.get("prof") || "",
    loadFull: url.searchParams.get("loadFull") || ""
  }
}

function persistFilterState() {
  localStorage.setItem("adminFilters", JSON.stringify(getQueryStateFromUrl()))
}

function applySavedFiltersIfEmpty() {
  const url = new URL(window.location.href)
  if ([...url.searchParams.keys()].length > 0) return
  const raw = localStorage.getItem("adminFilters")
  if (!raw) return
  try {
    const saved = JSON.parse(raw)
    Object.entries(saved || {}).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, String(v))
    })
    if ([...url.searchParams.keys()].length > 0) {
      window.location.replace(url.toString())
    }
  } catch (e) {
  }
}

async function refreshStudentListPanel(forceFull) {
  try {
    const currentY = window.scrollY
    const url = new URL(window.location.href)
    if (forceFull) url.searchParams.set("loadFull", "1")
    url.searchParams.set("_ts", Date.now())

    const res = await fetch(url.toString(), { cache: "no-store" })
    const html = await res.text()

    const doc = new DOMParser().parseFromString(html, "text/html")
    const nextPanel = doc.getElementById("studentListPanel")
    const currentPanel = document.getElementById("studentListPanel")

    if (nextPanel && currentPanel) {
      currentPanel.innerHTML = nextPanel.innerHTML
      window.scrollTo(0, currentY)
      if (forceFull) {
        const currentUrl = new URL(window.location.href)
        currentUrl.searchParams.set("loadFull", "1")
        history.replaceState({}, "", currentUrl.toString())
      }
      persistFilterState()
    }
  } catch (e) {
    console.log("student list refresh skipped")
  }
}

const NORMAL_STATUS_HTML = `<span class="badge badge-gray">정상</span>`

function renderStatusCell(studentId, state) {
  const row = document.querySelector(`tr[data-student-id="${studentId}"]`)
  if (!row) return
  const cell = row.querySelector(".student-status-cell")
  if (!cell) return

  if (state.approvalRequested) {
    cell.innerHTML = `
      <form method="POST" action="/approve-request" class="inline-mini-form js-student-status-form">
        <input type="hidden" name="studentId" value="${studentId}">
        <button type="submit" class="status-action action-approve">입력 제한</button>
      </form>
    `
    return
  }

  if (state.locked) {
    cell.innerHTML = `
      <form method="POST" action="/unlock-student" class="inline-mini-form js-student-status-form">
        <input type="hidden" name="studentId" value="${studentId}">
        <button type="submit" class="status-action action-lock">입력 제한</button>
      </form>
    `
    return
  }

  cell.innerHTML = NORMAL_STATUS_HTML
}

function renderStudentRow(studentId, nextState) {
  renderStatusCell(studentId, nextState)
}

function hookStatusForms() {
  document.addEventListener("submit", async e => {
    const form = e.target
    if (!(form instanceof HTMLFormElement)) return
    if (!form.classList.contains("js-student-status-form")) return
    e.preventDefault()

    const formData = new FormData(form)
    const body = new URLSearchParams()
    for (const [k, v] of formData.entries()) body.append(k, String(v))

    const res = await fetch(form.action, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: body.toString()
    })
    const data = await res.json()
    if (!data.ok) return
    renderStudentRow(data.studentId, {
      approvalRequested: data.approvalRequested === true,
      locked: data.locked === true
    })
  })
}

function connectAdminEvents() {
  const source = new EventSource("/events/admin")
  source.addEventListener("student-status-changed", e => {
    try {
      const payload = JSON.parse(e.data || "{}")
      if (!payload.studentId) return
      renderStudentRow(payload.studentId, payload)
    } catch (err) {
    }
  })
  source.onerror = function () {}
}

function toggleAll() {
  const checked = document.getElementById("checkAll")?.checked === true
  document.querySelectorAll(".student-check").forEach(el => {
    el.checked = checked
  })
}

function submitBulkDownload() {
  const ids = []
  document.querySelectorAll(".student-check:checked").forEach(el => {
    ids.push(el.value)
  })
  if (ids.length === 0) {
    alert("학생을 선택하세요.")
    return
  }
  document.getElementById("bulkIds").value = ids.join(",")
  document.getElementById("bulkDownloadForm").submit()
}

window.toggleAll = toggleAll
window.submitBulkDownload = submitBulkDownload

window.addEventListener("beforeunload", function () {
  sessionStorage.setItem("adminScrollY", String(window.scrollY))
  persistFilterState()
})

window.addEventListener("load", function () {
  applySavedFiltersIfEmpty()

  const y = sessionStorage.getItem("adminScrollY")
  if (y) window.scrollTo(0, Number(y))

  const toast = document.getElementById("flashToast")
  if (toast) {
    setTimeout(function () {
      toast.style.opacity = "0"
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast)
      }, 300)
    }, 2200)
  }

  hookStatusForms()
  connectAdminEvents()
  setInterval(refreshStudentListPanel, 5000)

  if (window.ADMIN_PAGE_BOOT?.isInitialLoad === true) {
    setTimeout(function () {
      refreshStudentListPanel(true)
    }, 100)
  }
})
