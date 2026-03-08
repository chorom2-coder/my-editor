const express = require("express")
const fs = require("fs")
const path = require("path")
const bodyParser = require("body-parser")
const session = require("express-session")

const app = express()
const PORT = process.env.PORT || 3000

app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))

app.use(express.static("public"))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.use(session({
  secret: "writing-secret",
  resave: false,
  saveUninitialized: false
}))

function defaultValueByFile(file) {
  if (file.includes("students")) return []
  if (file.includes("admins")) return []
  if (file.includes("config")) {
    return {
      studentListRaw: "",
      classes: {}
    }
  }
  if (file.includes("submissions")) return {}
  return {}
}

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) {
      const def = defaultValueByFile(file)
      fs.writeFileSync(file, JSON.stringify(def, null, 2), "utf8")
      return def
    }
    const raw = fs.readFileSync(file, "utf8")
    if (!raw.trim()) return defaultValueByFile(file)
    return JSON.parse(raw)
  } catch (e) {
    return defaultValueByFile(file)
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8")
}

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect("/admin-login")
  next()
}

function defaultClassConfig() {
  return {
    ownerId: "",
    topic: "주제를 입력하세요",
    minChars: 500,
    durationMinutes: 50,
    started: false,
    startTime: null,
    endTime: null
  }
}

function ensureClassConfig(className) {
  const config = readJSON("config.json")
  if (!config.classes) config.classes = {}

  if (!config.classes[className]) {
    config.classes[className] = defaultClassConfig()
    writeJSON("config.json", config)
  }

  return config.classes[className]
}

function ensureSubmission(student) {
  const submissions = readJSON("submissions.json")
  if (!submissions[student.studentId]) {
    submissions[student.studentId] = {
      name: student.name,
      studentId: student.studentId,
      class: student.class || "",
      text: "",
      submitted: false,
      comment: "",
      warningCount: 0,
      locked: false,
      approvalRequested: false,
      submittedAt: null,
      submitTime: "",
      duration: "",
      withSpace: 0,
      withoutSpace: 0
    }
    writeJSON("submissions.json", submissions)
  }
  return submissions
}

function parseStudentLine(line) {
  const clean = (line || "").trim()
  if (!clean) return null

  let parts = []

  if (clean.includes(",")) {
    parts = clean.split(",").map(v => v.trim()).filter(Boolean)
  } else if (clean.includes("\t")) {
    parts = clean.split("\t").map(v => v.trim()).filter(Boolean)
  } else {
    parts = clean.split(/\s+/).map(v => v.trim()).filter(Boolean)
  }

  if (parts.length < 3) return null

  return {
    name: parts[0],
    studentId: parts[1],
    className: parts[2]
  }
}

function csvEscape(value) {
  const str = String(value ?? "")
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function getAllClassNames(students, config) {
  const studentClasses = students.map(s => s.class).filter(Boolean)
  const configClasses = Object.keys(config.classes || {})
  return [...new Set([...studentClasses, ...configClasses])].sort()
}

function classOwnerId(config, className) {
  return config.classes?.[className]?.ownerId || ""
}

function canManageClass(req, config, className) {
  if (req.session.adminRole === "super") return true
  const ownerId = classOwnerId(config, className)
  return ownerId === req.session.adminId
}


function visibleClassNamesForAdmin(req, students, config) {
  const all = getAllClassNames(students, config)
  if (req.session.adminRole === "super") return all

  return all.filter(className => {
    const ownerId = classOwnerId(config, className)
    if (ownerId === req.session.adminId) return true

    const hasOwnedStudent = students.some(s => {
      return s.class === className && s.ownerId === req.session.adminId
    })

    return hasOwnedStudent
  })
}


function visibleStudentsForAdmin(req, students, config) {
  if (req.session.adminRole === "super") return students

  return students.filter(s => {
    const classOwner = classOwnerId(config, s.class)
    if (classOwner === req.session.adminId) return true
    return s.ownerId === req.session.adminId
  })
}



function studentVisibleToAdmin(req, student, config) {
  if (!student) return false
  if (req.session.adminRole === "super") return true

  return (
    classOwnerId(config, student.class) === req.session.adminId ||
    student.ownerId === req.session.adminId
  )
}

app.get("/", (req, res) => {
  res.redirect("/login")
})

/* -------------------------
   학생 로그인
------------------------- */

app.get("/login", (req, res) => {
  res.render("login")
})

app.post("/login", (req, res) => {
  const { name, id } = req.body

  const students = readJSON("students.json")
  const student = students.find(s => s.studentId === id && s.name === name)

  if (!student) {
    return res.send("학생 정보가 없습니다. 이름과 학번을 다시 확인하세요.")
  }

  ensureClassConfig(student.class || "")
  const submissions = ensureSubmission(student)
  const sub = submissions[id]
  const config = readJSON("config.json")
  const classConfig = config.classes?.[student.class] || {}

  req.session.studentId = student.studentId
  req.session.studentName = student.name
  req.session.studentClass = student.class || ""

  if (classConfig.started === true) {
    if (sub.submitted) {
      return res.redirect("/result/" + student.studentId)
    }
    return res.redirect("/write/" + student.studentId)
  }

  return res.redirect("/waiting/" + student.studentId)
})

app.get("/student-logout", (req, res) => {
  req.session.destroy(() => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="/style.css?v=70">
        <title>로그아웃</title>
      </head>
      <body class="center-page">
        <div class="portal-card">
          <h1 class="portal-title">제출이 완료되었습니다</h1>
          <p class="portal-subtitle">자동으로 로그아웃되었습니다.</p>
          <a class="btn-main" href="/login">로그인 화면으로 이동</a>
        </div>
      </body>
      </html>
    `)
  })
})

/* -------------------------
   대기화면
------------------------- */

app.get("/waiting/:id", (req, res) => {
  const students = readJSON("students.json")
  const student = students.find(s => s.studentId === req.params.id)

  if (!student) return res.send("학생 정보를 찾을 수 없습니다.")

  res.render("waiting", {
    studentName: student.name,
    studentClass: student.class || "",
    studentId: student.studentId
  })
})

app.get("/status/:id", (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  const student = students.find(s => s.studentId === req.params.id)
  if (!student) return res.json({ ok: false })

  const sub = submissions[student.studentId] || {}
  const classConfig = config.classes?.[student.class] || {}

  res.json({
    ok: true,
    started: classConfig.started === true,
    submitted: sub.submitted === true,
    locked: sub.locked === true,
    approvalRequested: sub.approvalRequested === true,
    endTime: classConfig.endTime || null
  })
})

/* -------------------------
   글쓰기 화면
------------------------- */

app.get("/write/:id", (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  const student = students.find(s => s.studentId === req.params.id)
  if (!student) return res.send("학생 정보를 찾을 수 없습니다.")

  const classConfig = config.classes?.[student.class]
  if (!classConfig || classConfig.started !== true) {
    return res.redirect("/waiting/" + student.studentId)
  }

  const sub = submissions[student.studentId] || {}
  if (sub.submitted) {
    return res.redirect("/result/" + student.studentId)
  }

  res.render("write", {
    id: student.studentId,
    studentName: student.name,
    studentClass: student.class || "",
    topic: classConfig.topic || "주제를 입력하세요",
    minChars: classConfig.minChars || 500,
    text: sub.text || "",
    locked: sub.locked === true,
    endTime: classConfig.endTime || null
  })
})

app.post("/save", (req, res) => {
  const { studentId, text } = req.body

  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  const student = students.find(s => s.studentId === studentId)
  if (!student) return res.json({ ok: false, msg: "학생 정보 없음" })

  const classConfig = config.classes?.[student.class]
  if (!classConfig || classConfig.started !== true) {
    return res.json({ ok: false, msg: "현재 진행 중이 아닙니다." })
  }

  const sub = submissions[studentId]
  if (!sub) return res.json({ ok: false, msg: "작성 정보 없음" })

  if (sub.locked) {
    return res.json({ ok: false, msg: "입력창이 차단되었습니다." })
  }

  if (sub.submitted) {
    return res.json({ ok: false, msg: "이미 제출되었습니다." })
  }

  submissions[studentId].text = text
  writeJSON("submissions.json", submissions)

  return res.json({ ok: true })
})

app.post("/submit", (req, res) => {
  const { studentId, text } = req.body

  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  const student = students.find(s => s.studentId === studentId)
  if (!student) return res.json({ ok: false, msg: "학생 정보 없음" })

  const classConfig = config.classes?.[student.class]
  if (!classConfig || classConfig.started !== true) {
    return res.json({ ok: false, msg: "현재 진행 중이 아닙니다." })
  }

  const sub = submissions[studentId]
  if (!sub) return res.json({ ok: false, msg: "작성 정보 없음" })

  if (sub.locked) {
    return res.json({ ok: false, msg: "입력창이 차단되었습니다." })
  }

  const withoutSpace = String(text || "").replace(/\s/g, "").length
  const withSpace = String(text || "").length

  if (withoutSpace < Number(classConfig.minChars || 500)) {
    return res.json({
      ok: false,
      msg: `최소 ${Number(classConfig.minChars || 500)}자 이상 작성해야 합니다.`
    })
  }

  const submittedAt = Date.now()
  const startTime = Number(classConfig.startTime || submittedAt)
  const durationMs = Math.max(0, submittedAt - startTime)

  const totalMinutes = Math.floor(durationMs / 60000)
  const remainSeconds = Math.floor((durationMs % 60000) / 1000)

  const durationText =
    totalMinutes > 0
      ? `${totalMinutes}분 ${remainSeconds}초`
      : `${remainSeconds}초`

  const submitDate = new Date(submittedAt)
  const yyyy = submitDate.getFullYear()
  const mm = String(submitDate.getMonth() + 1).padStart(2, "0")
  const dd = String(submitDate.getDate()).padStart(2, "0")
  const hh = String(submitDate.getHours()).padStart(2, "0")
  const mi = String(submitDate.getMinutes()).padStart(2, "0")
  const ss = String(submitDate.getSeconds()).padStart(2, "0")

  submissions[studentId].text = text
  submissions[studentId].submitted = true
  submissions[studentId].submittedAt = submittedAt
  submissions[studentId].submitTime = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  submissions[studentId].duration = durationText
  submissions[studentId].withSpace = withSpace
  submissions[studentId].withoutSpace = withoutSpace

  writeJSON("submissions.json", submissions)

  return res.json({ ok: true })
})

app.post("/warn", (req, res) => {
  const { id } = req.body
  const submissions = readJSON("submissions.json")
  const sub = submissions[id]

  if (!sub) return res.json({ ok: false })

  sub.warningCount = (sub.warningCount || 0) + 1

  if (sub.warningCount >= 2) {
    sub.locked = true
  }

  writeJSON("submissions.json", submissions)

  res.json({
    ok: true,
    warningCount: sub.warningCount,
    locked: sub.locked === true
  })
})

app.post("/request-approval", (req, res) => {
  const { id } = req.body
  const submissions = readJSON("submissions.json")
  const sub = submissions[id]

  if (!sub) return res.json({ ok: false })

  sub.approvalRequested = true
  writeJSON("submissions.json", submissions)

  res.json({ ok: true })
})

app.get("/result/:id", (req, res) => {
  const submissions = readJSON("submissions.json")
  const sub = submissions[req.params.id] || {}

  res.render("result", {
    studentName: sub.name || req.session.studentName || "",
    studentClass: sub.class || req.session.studentClass || "",
    text: sub.text || "",
    comment: sub.comment || ""
  })
})

/* -------------------------
   관리자 로그인
------------------------- */

app.get("/admin-login", (req, res) => {
  res.render("admin-login")
})

app.post("/admin-login", (req, res) => {
  const { id, password } = req.body
  const admins = readJSON("admins.json")

  const admin = admins.find(a => a.id === id && a.password === password)
  if (!admin) {
    return res.send("관리자 로그인 실패. 아이디와 비밀번호를 확인하세요.")
  }

  req.session.admin = true
  req.session.adminId = admin.id
  req.session.adminName = admin.name || admin.id
  req.session.adminRole = admin.role || "prof"

  res.redirect("/admin")
})

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin-login")
  })
})

/* -------------------------
   관리자 페이지
------------------------- */

app.get("/admin", requireAdmin, (req, res) => {
  const allStudents = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")
  const admins = readJSON("admins.json")

const professorCount = admins.filter(a => (a.role || "prof") !== "super").length

const totalClassCount = Object.keys(config.classes || {}).length

const totalStudentCount = allStudents.length

const totalSubmittedCount = allStudents.filter(s => {
  const sub = submissions[s.studentId] || {}
  return sub.submitted === true
}).length

  const search = (req.query.search || "").trim()
  const classFilter = (req.query.class || "").trim()
  const approvalOnly = (req.query.approvalOnly || "").trim()
  const manageClass = (req.query.manageClass || "").trim()
  const submissionFilter = (req.query.submissionFilter || "").trim()
  const professorFilter = (req.query.prof || "").trim()


const visibleStudentsBase = visibleStudentsForAdmin(req, allStudents, config)

const classStats = {}

visibleStudentsBase.forEach(s => {
  if (!classStats[s.class]) {
    classStats[s.class] = { total: 0, submitted: 0 }
  }

  classStats[s.class].total++

  const sub = submissions[s.studentId] || {}
  if (sub.submitted === true) {
    classStats[s.class].submitted++
  }
})

let baseStudents = visibleStudentsBase

if (req.session.adminRole === "super" && professorFilter) {
  baseStudents = baseStudents.filter(s => String(s.ownerId || "") === professorFilter)
}

const classList = req.session.adminRole === "super" && professorFilter
  ? [...new Set(baseStudents.map(s => s.class).filter(Boolean))]
  : visibleClassNamesForAdmin(req, allStudents, config)

let students = baseStudents



if (search) {
  students = students.filter(s =>
    String(s.name || "").includes(search) ||
    String(s.studentId || "").includes(search)
  )
}

if (classFilter) {
  students = students.filter(s => String(s.class || "") === classFilter)
}

if (submissionFilter === "submitted") {
  students = students.filter(s => {
    const sub = submissions[s.studentId] || {}
    return sub.submitted === true
  })
}

if (submissionFilter === "pending") {
  students = students.filter(s => {
    const sub = submissions[s.studentId] || {}
    return !sub.submitted
  })
}

if (approvalOnly === "yes") {
  students = students.filter(s => {
    const sub = submissions[s.studentId] || {}
    return sub.approvalRequested === true
  })
}



  let selectedManageClass = manageClass
  if (!selectedManageClass && classList.length > 0) {
    selectedManageClass = classList[0]
  }

  let selectedClassConfig = null
  if (selectedManageClass) {
    selectedClassConfig = config.classes?.[selectedManageClass] || defaultClassConfig()
  }

  const visibleStudentsForCount = visibleStudentsBase
  const approvalCount = visibleStudentsForCount.filter(s => {
    const sub = submissions[s.studentId] || {}
    return sub.approvalRequested === true
  }).length

  const professorOptions = admins
    .filter(a => (a.role || "prof") !== "super")
    .map(a => ({ id: a.id, name: a.name || a.id }))
const professorSummaries = professorOptions.map(prof => {
  const profStudents = allStudents.filter(s => String(s.ownerId || "") === prof.id)

  const ownedClasses = Object.keys(config.classes || {})
    .filter(cls => String(config.classes[cls]?.ownerId || "") === prof.id)


const submittedCount = profStudents.filter(s => {
  const sub = submissions[s.studentId] || {}
  return sub.submitted === true
}).length
const submitRate = profStudents.length
  ? Math.round((submittedCount / profStudents.length) * 100)
  : 0

return {
submitRate,
  id: prof.id,
  name: prof.name,
  classNames: ownedClasses,
  studentCount: profStudents.length,
  submittedCount,
  submitRate
}
}).sort((a, b) => a.name.localeCompare(b.name))

  const visibleStudentListRaw = visibleStudentsBase
    .map(s => `${s.name}, ${s.studentId}, ${s.class}`)
    .join("\n")

  res.render("admin", {
professorCount,
totalClassCount,
totalStudentCount,
totalSubmittedCount,
    professorCount,
totalClassCount,
totalStudentCount,
totalSubmittedCount,
professorFilter,
    professorSummaries,
    students,
    submissions,
    config,
    classList,
    classStats,
    search,
    classFilter,
    approvalOnly,
    submissionFilter,
    manageClass: selectedManageClass,
    selectedClassConfig,
    adminName: req.session.adminName,
    adminId: req.session.adminId,
    adminRole: req.session.adminRole,
    approvalCount,
    msg: req.query.msg || "",
    professorOptions,
    studentListText: req.session.adminRole === "super"
      ? (config.studentListRaw || visibleStudentListRaw)
      : visibleStudentListRaw
  })
})


app.post("/add-professor", requireAdmin, (req, res) => {
  if (req.session.adminRole !== "super") {
    return res.send("초관리자만 교수자를 추가할 수 있습니다.")
  }

  const { name, id, password } = req.body
  const admins = readJSON("admins.json")

const professorCount = admins.filter(a => (a.role || "prof") !== "super").length
const totalClassCount = Object.keys(config.classes || {}).length
const totalStudentCount = allStudents.length
const totalSubmittedCount = allStudents.filter(s => {
  const sub = submissions[s.studentId] || {}
  return sub.submitted === true
}).length

  if (admins.find(a => a.id === id)) {
    return res.send("이미 존재하는 교수자 ID입니다.")
  }

  admins.push({
    id,
    password,
    role: "prof",
    name
  })

  writeJSON("admins.json", admins)
  res.redirect("/admin?msg=" + encodeURIComponent("교수자를 추가했습니다."))
})

app.post("/change-password", requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body
  const admins = readJSON("admins.json")

  const target = admins.find(a => a.id === req.session.adminId)
  if (!target) return res.redirect("/admin?msg=" + encodeURIComponent("계정을 찾을 수 없습니다."))

  if (target.password !== currentPassword) {
    return res.redirect("/admin?msg=" + encodeURIComponent("현재 비밀번호가 다릅니다."))
  }

  target.password = newPassword
  writeJSON("admins.json", admins)
  res.redirect("/admin?msg=" + encodeURIComponent("비밀번호를 변경했습니다."))
})

app.post("/addStudents", requireAdmin, (req, res) => {

  const list = req.body.list || ""
  const students = readJSON("students.json")
  const config = readJSON("config.json")

  if (!config.classes) config.classes = {}

  let added = 0
  let skipped = 0

  const lines = list.split("\n")

  lines.forEach(line => {

    const parsed = parseStudentLine(line)
    if (!parsed) return

    const className = parsed.className

    if (!config.classes[className]) {
      config.classes[className] = defaultClassConfig()
    }

    if (req.session.adminRole !== "super") {

      if (!config.classes[className].ownerId) {
        config.classes[className].ownerId = req.session.adminId
      }

      if (config.classes[className].ownerId !== req.session.adminId) {
        skipped++
        return
      }
    }

    const existing = students.find(s => s.studentId === parsed.studentId)


    if (existing) {

      skipped++
      return

    } else {

      students.push({
        name: parsed.name,
        studentId: parsed.studentId,
        class: className,
        ownerId: config.classes[className].ownerId || ""
      })

    }

    added++
  })

  writeJSON("students.json", students)
  writeJSON("config.json", config)

  students.forEach(student => ensureSubmission(student))

  const message = `학생 명단을 저장했습니다 (${added}명)`
  res.redirect("/admin?msg=" + encodeURIComponent(message))

})



   
 

app.post("/setClassConfig", requireAdmin, (req, res) => {
  const { className, topic, minChars, durationMinutes, ownerId } = req.body
  const config = readJSON("config.json")

  if (!config.classes) config.classes = {}

  if (!config.classes[className]) {
    config.classes[className] = defaultClassConfig()
  }

  if (req.session.adminRole !== "super") {
    const owner = config.classes[className].ownerId || ""
    if (owner && owner !== req.session.adminId) {
      return res.redirect("/admin?msg=" + encodeURIComponent("해당 분반은 수정할 수 없습니다."))
    }
    config.classes[className].ownerId = req.session.adminId
  } else {
    if (ownerId !== undefined) {
      config.classes[className].ownerId = ownerId
    }
  }

  config.classes[className].topic = topic
  config.classes[className].minChars = Number(minChars || 500)
  config.classes[className].durationMinutes = Number(durationMinutes || 50)

  writeJSON("config.json", config)
  res.redirect("/admin?manageClass=" + encodeURIComponent(className) + "&msg=" + encodeURIComponent("분반 설정을 저장했습니다."))
})

app.post("/startClass", requireAdmin, (req, res) => {
  const { className } = req.body
  const config = readJSON("config.json")

  if (!config.classes) config.classes = {}
  if (!config.classes[className]) {
    config.classes[className] = defaultClassConfig()
  }

  if (req.session.adminRole !== "super") {
    const owner = config.classes[className].ownerId || ""
    if (owner && owner !== req.session.adminId) {
      return res.redirect("/admin?msg=" + encodeURIComponent("해당 분반은 시작할 수 없습니다."))
    }
    config.classes[className].ownerId = req.session.adminId
  }

  const now = Date.now()
  const duration = Number(config.classes[className].durationMinutes || 50)

  config.classes[className].started = true
  config.classes[className].startTime = now
  config.classes[className].endTime = now + duration * 60 * 1000

  writeJSON("config.json", config)

  res.redirect("/admin?manageClass=" + encodeURIComponent(className) + "&msg=" + encodeURIComponent("시작되었습니다."))
})

app.post("/stopClass", requireAdmin, (req, res) => {
  const { className } = req.body
  const config = readJSON("config.json")

  if (!config.classes?.[className]) {
    return res.redirect("/admin?msg=" + encodeURIComponent("분반을 찾을 수 없습니다."))
  }

  if (req.session.adminRole !== "super") {
    const owner = config.classes[className].ownerId || ""
    if (owner !== req.session.adminId) {
      return res.redirect("/admin?msg=" + encodeURIComponent("해당 분반은 종료할 수 없습니다."))
    }
  }

  config.classes[className].started = false
  config.classes[className].endTime = Date.now()

  writeJSON("config.json", config)

  res.redirect("/admin?manageClass=" + encodeURIComponent(className) + "&msg=" + encodeURIComponent("종료되었습니다."))
})

app.post("/unlock-student", requireAdmin, (req, res) => {
  const students = readJSON("students.json")
  students.sort((a,b)=>{
    if (a.class === b.class) {
      return a.studentId.localeCompare(b.studentId)
  }
    return a.class.localeCompare(b.class)
})


  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  const student = students.find(s => s.studentId === req.body.studentId)
  if (!student || !studentVisibleToAdmin(req, student, config)) {
    return res.redirect("/admin?msg=" + encodeURIComponent("해당 학생을 처리할 수 없습니다."))
  }

  if (submissions[req.body.studentId]) {
    submissions[req.body.studentId].locked = false
    submissions[req.body.studentId].warningCount = 0
    submissions[req.body.studentId].approvalRequested = false
    writeJSON("submissions.json", submissions)
  }

  res.redirect("/admin?msg=" + encodeURIComponent("입력 잠금을 해제했습니다."))
})

app.post("/approve-request", requireAdmin, (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  const student = students.find(s => s.studentId === req.body.studentId)
  if (!student || !studentVisibleToAdmin(req, student, config)) {
    return res.redirect("/admin?msg=" + encodeURIComponent("해당 학생을 처리할 수 없습니다."))
  }

  if (submissions[req.body.studentId]) {
    submissions[req.body.studentId].locked = false
    submissions[req.body.studentId].warningCount = 0
    submissions[req.body.studentId].approvalRequested = false
    writeJSON("submissions.json", submissions)
  }

  res.redirect("/admin?msg=" + encodeURIComponent("승인 요청을 처리했습니다."))
})

app.post("/comment", requireAdmin, (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  const student = students.find(s => s.studentId === req.body.studentId)
  if (!student || !studentVisibleToAdmin(req, student, config)) {
    return res.redirect("/admin?msg=" + encodeURIComponent("해당 학생을 처리할 수 없습니다."))
  }

  if (submissions[req.body.studentId]) {
    submissions[req.body.studentId].comment = req.body.comment
    writeJSON("submissions.json", submissions)
  }

  res.redirect("/admin/student/" + req.body.studentId + "?msg=" + encodeURIComponent("코멘트를 저장했습니다."))
})

app.get("/admin/student/:studentId", requireAdmin, (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  const student = students.find(s => s.studentId === req.params.studentId)
  if (!student || !studentVisibleToAdmin(req, student, config)) {
    return res.send("학생 정보를 찾을 수 없습니다.")
  }

  const raw = submissions[req.params.studentId] || {
    text: "",
    comment: "",
    submitted: false,
    locked: false,
    approvalRequested: false
  }

  const text = raw.text || ""
  const withSpace = raw.withSpace ?? text.length
  const withoutSpace = raw.withoutSpace ?? text.replace(/\s/g, "").length

  let submitTime = raw.submitTime || "-"
  if (submitTime === "-" && raw.submittedAt) {
    const d = new Date(raw.submittedAt)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    const hh = String(d.getHours()).padStart(2, "0")
    const mi = String(d.getMinutes()).padStart(2, "0")
    const ss = String(d.getSeconds()).padStart(2, "0")
    submitTime = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  }

  let duration = raw.duration || "-"
  if (duration === "-" && raw.submittedAt) {
    const classStartTime = config.classes?.[student.class]?.startTime
    if (classStartTime) {
      const durationMs = Math.max(0, raw.submittedAt - classStartTime)
      const totalMinutes = Math.floor(durationMs / 60000)
      const remainSeconds = Math.floor((durationMs % 60000) / 1000)
      duration = totalMinutes > 0 ? `${totalMinutes}분 ${remainSeconds}초` : `${remainSeconds}초`
    }
  }

  const submission = {
    ...raw,
    text,
    withSpace,
    withoutSpace,
    submitTime,
    duration
  }

  res.render("student-detail", {
    student,
    submission,
    msg: req.query.msg || ""
  })
})

app.get("/download/student/:studentId", requireAdmin, (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  const student = students.find(s => s.studentId === req.params.studentId)
  const sub = submissions[req.params.studentId] || {}

  if (!student || !studentVisibleToAdmin(req, student, config)) {
    return res.send("학생 정보를 찾을 수 없습니다.")
  }

  const text = sub.text || ""
  const withSpace = sub.withSpace ?? text.length
  const withoutSpace = sub.withoutSpace ?? text.replace(/\s/g, "").length

  let submitTime = sub.submitTime || "-"
  if (submitTime === "-" && sub.submittedAt) {
    const d = new Date(sub.submittedAt)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    const hh = String(d.getHours()).padStart(2, "0")
    const mi = String(d.getMinutes()).padStart(2, "0")
    const ss = String(d.getSeconds()).padStart(2, "0")
    submitTime = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  }

  let duration = sub.duration || "-"
  if (duration === "-" && sub.submittedAt) {
    const classStartTime = config.classes?.[student.class]?.startTime
    if (classStartTime) {
      const durationMs = Math.max(0, sub.submittedAt - classStartTime)
      const totalMinutes = Math.floor(durationMs / 60000)
      const remainSeconds = Math.floor((durationMs % 60000) / 1000)
      duration = totalMinutes > 0 ? `${totalMinutes}분 ${remainSeconds}초` : `${remainSeconds}초`
    }
  }

  const content = [
    "이름: " + student.name,
    "학번: " + student.studentId,
    "분반: " + (student.class || ""),
    "제출 상태: " + (sub.submitted ? "제출 완료" : "미제출"),
    "제출 시각: " + submitTime,
    "작성 소요시간: " + duration,
    "글자수(공백 포함): " + withSpace,
    "글자수(공백 제외): " + withoutSpace,
    "",
    "[글 내용]",
    text,
    "",
    "[코멘트]",
    sub.comment || ""
  ].join("\n")

  const safeName = `${student.studentId}_${student.name}`.replace(/[^\w\d]/g, "_")

  res.setHeader("Content-Type", "text/plain; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}.txt"`)
  res.send(content)
})

app.post("/bulk-download", requireAdmin, (req, res) => {
  const idsRaw = req.body.ids || ""
  const ids = String(idsRaw).split(",").map(v => v.trim()).filter(Boolean)

  const allStudents = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  const visibleStudents = visibleStudentsForAdmin(req, allStudents, config)
  const visibleIds = new Set(visibleStudents.map(s => s.studentId))

  const rows = [
    ["name", "studentId", "class", "submitted", "submitTime", "duration", "withSpace", "withoutSpace", "text", "comment"].join(",")
  ]

  ids.forEach(id => {
    if (!visibleIds.has(id)) return

    const student = visibleStudents.find(s => s.studentId === id)
    const sub = submissions[id] || {}
    if (!student) return

    rows.push([
      csvEscape(student.name),
      csvEscape(student.studentId),
      csvEscape(student.class || ""),
      csvEscape(sub.submitted ? "제출 완료" : "미제출"),
      csvEscape(sub.submitTime || ""),
      csvEscape(sub.duration || ""),
      csvEscape(sub.withSpace || 0),
      csvEscape(sub.withoutSpace || 0),
      csvEscape(sub.text || ""),
      csvEscape(sub.comment || "")
    ].join(","))
  })

  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", 'attachment; filename="selected_students.csv"')
  res.send("\uFEFF" + rows.join("\n"))
})

app.post("/download-class", requireAdmin, (req, res) => {

  const className = req.body.className

  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")

  const archiver = require("archiver")

  res.attachment(`class_${className}_submissions.zip`)

  const archive = archiver("zip")
  archive.pipe(res)

  students
    .filter(s => s.class === className)
    .forEach(student => {

      const sub = submissions[student.studentId]

      if (sub && sub.text) {
        archive.append(sub.text, {
          name: `${student.class}_${student.studentId}_${student.name}.txt`
        })
      }

    })

  archive.finalize()

})

app.listen(PORT, () => {
  console.log("server running on port " + PORT)
})