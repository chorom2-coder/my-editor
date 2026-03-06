const express = require("express")
const fs = require("fs")
const bodyParser = require("body-parser")
const session = require("express-session")
const { Parser } = require("json2csv")

const app = express()
const PORT = process.env.PORT || 3000

app.set("view engine", "ejs")
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(express.static("public"))

app.use(session({
  secret: "writing-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 6
  }
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
  return {}
}

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) {
      const defaultValue = defaultValueByFile(file)
      fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2), "utf8")
      return defaultValue
    }

    const raw = fs.readFileSync(file, "utf8")
    if (!raw.trim()) return defaultValueByFile(file)

    return JSON.parse(raw)
  } catch (error) {
    console.error("JSON read error:", file, error)
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

function ensureClassConfig(className) {
  const config = readJSON("config.json")

  if (!config.classes) config.classes = {}

  if (!config.classes[className]) {
    config.classes[className] = {
      topic: "주제를 입력하세요",
      minChars: 500,
      durationMinutes: 50,
      started: false,
      startTime: null,
      endTime: null
    }
    writeJSON("config.json", config)
  }

  return config.classes[className]
}

function getClassConfig(className) {
  const config = readJSON("config.json")
  if (!config.classes) config.classes = {}
  if (!config.classes[className]) {
    config.classes[className] = {
      topic: "주제를 입력하세요",
      minChars: 500,
      durationMinutes: 50,
      started: false,
      startTime: null,
      endTime: null
    }
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
      allowRelogin: false
    }
    writeJSON("submissions.json", submissions)
  }

  return submissions
}

function parseStudentLine(line) {
  const clean = line.trim()
  if (!clean) return null

  let parts = []

  if (clean.includes(",")) {
    parts = clean.split(",").map(v => v.trim()).filter(Boolean)
  } else if (clean.includes("\t")) {
    parts = clean.split("\t").map(v => v.trim()).filter(Boolean)
  } else {
    parts = clean.split(/\s{2,}/).map(v => v.trim()).filter(Boolean)
  }

  if (parts.length < 3) return null

  return {
    name: parts[0],
    studentId: parts[1],
    className: parts[2]
  }
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
  const student = students.find(
    s => s.studentId === id && s.name === name
  )

  if (!student) {
    return res.send("학생 정보가 없습니다. 이름과 학번을 다시 확인하세요.")
  }

  ensureClassConfig(student.class || "")
  const submissions = ensureSubmission(student)
  const sub = submissions[id]

  if (sub.locked) {
    return res.send("현재 입력이 차단되어 있습니다. 교수자 승인 후 다시 접속하세요.")
  }

  if (sub.submitted && !sub.allowRelogin) {
    return res.send("제출이 완료되었습니다. 교수자가 다시 열어주면 결과를 확인할 수 있습니다.")
  }

  req.session.studentId = student.studentId
  req.session.studentName = student.name
  req.session.studentClass = student.class || ""

  if (sub.submitted && sub.allowRelogin) {
    return res.redirect("/result/" + student.studentId)
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
        <link rel="stylesheet" href="/style.css">
        <title>로그아웃</title>
      </head>
      <body class="center-page">
        <div class="portal-card">
          <h1 class="portal-title">제출이 완료되었습니다</h1>
          <p class="portal-subtitle">자동으로 로그아웃되었습니다.</p>
          <a class="soft-btn" href="/login">로그인 화면으로 이동</a>
        </div>
      </body>
      </html>
    `)
  })
})

/* -------------------------
   관리자 로그인
------------------------- */

app.get("/admin-login", (req, res) => {
  if (req.session.admin) return res.redirect("/admin")
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
  req.session.adminRole = admin.role || "prof"
  req.session.adminName = admin.name || admin.id

  res.redirect("/admin")
})

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin-login")
  })
})

/* -------------------------
   대기 화면
------------------------- */

app.get("/waiting/:id", (req, res) => {
  const students = readJSON("students.json")
  const student = students.find(s => s.studentId === req.params.id)

  if (!student) return res.send("학생 정보를 찾을 수 없습니다.")

  const classConfig = getClassConfig(student.class || "")

  if (classConfig.started) {
    return res.redirect("/write/" + student.studentId)
  }

  res.render("waiting", {
    studentName: student.name,
    studentClass: student.class || ""
  })
})

/* -------------------------
   글쓰기 화면
------------------------- */

app.get("/write/:id", (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")

  const student = students.find(s => s.studentId === req.params.id)
  if (!student) return res.send("학생 정보를 찾을 수 없습니다.")

  const sub = submissions[req.params.id]
  if (!sub) return res.send("작성 정보를 찾을 수 없습니다.")

  const classConfig = getClassConfig(student.class || "")

  res.render("write", {
    id: student.studentId,
    studentName: student.name,
    studentClass: student.class || "",
    topic: classConfig.topic || "주제를 입력하세요",
    minChars: classConfig.minChars || 500,
    durationMinutes: classConfig.durationMinutes || 50,
    startTime: classConfig.startTime || null,
    endTime: classConfig.endTime || null,
    started: !!classConfig.started,
    text: sub.text || "",
    locked: !!sub.locked
  })
})

app.get("/status/:id", (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")

  const student = students.find(s => s.studentId === req.params.id)
  if (!student) return res.json({ ok: false })

  const classConfig = getClassConfig(student.class || "")
  const sub = submissions[req.params.id]

  return res.json({
    ok: true,
    started: !!classConfig.started,
    startTime: classConfig.startTime,
    endTime: classConfig.endTime,
    locked: !!(sub && sub.locked),
    submitted: !!(sub && sub.submitted),
    approvalRequested: !!(sub && sub.approvalRequested)
  })
})

app.post("/autosave", (req, res) => {
  const { id, text } = req.body
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")

  const student = students.find(s => s.studentId === id)
  if (!student) return res.json({ ok: false, msg: "학생 정보 없음" })

  const classConfig = getClassConfig(student.class || "")
  const sub = submissions[id]
  if (!sub) return res.json({ ok: false, msg: "작성 정보 없음" })

  if (sub.submitted) {
    return res.json({ ok: false, msg: "이미 제출되었습니다." })
  }

  if (sub.locked) {
    return res.json({ ok: false, msg: "현재 입력이 차단되어 있습니다." })
  }

  if (!classConfig.started) {
    return res.json({ ok: false, msg: "현재 진행 중이 아닙니다." })
  }

  const now = Date.now()
  const ended = classConfig.endTime && now > classConfig.endTime

  if (ended) {
    return res.json({ ok: false, msg: "작성 시간이 종료되었습니다." })
  }

  sub.text = text
  submissions[id] = sub
  writeJSON("submissions.json", submissions)

  return res.json({ ok: true })
})

app.post("/submit", (req, res) => {
  const { id, text } = req.body
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")

  const student = students.find(s => s.studentId === id)
  if (!student) return res.json({ ok: false, msg: "학생 정보 없음" })

  const classConfig = getClassConfig(student.class || "")
  const sub = submissions[id]
  if (!sub) return res.json({ ok: false, msg: "작성 정보 없음" })

  if (sub.submitted) {
    return res.json({ ok: false, msg: "이미 제출되었습니다." })
  }

  if (sub.locked) {
    return res.json({ ok: false, msg: "현재 입력이 차단되어 있습니다." })
  }

  const charCount = text.replace(/\s/g, "").length
  if (charCount < Number(classConfig.minChars || 500)) {
    return res.json({
      ok: false,
      msg: "최소 " + Number(classConfig.minChars || 500) + "자 이상 작성해야 합니다."
    })
  }

  sub.text = text
  sub.submitted = true
  sub.allowRelogin = false
  sub.approvalRequested = false
  submissions[id] = sub
  writeJSON("submissions.json", submissions)

  return res.json({ ok: true })
})

app.post("/warn", (req, res) => {
  const { id } = req.body
  const submissions = readJSON("submissions.json")
  const sub = submissions[id]

  if (!sub) {
    return res.json({ ok: false, msg: "학생 정보 없음" })
  }

  if (sub.locked) {
    return res.json({
      ok: true,
      warningCount: sub.warningCount || 2,
      locked: true
    })
  }

  sub.warningCount = (sub.warningCount || 0) + 1

  if (sub.warningCount >= 2) {
    sub.locked = true
  }

  submissions[id] = sub
  writeJSON("submissions.json", submissions)

  return res.json({
    ok: true,
    warningCount: sub.warningCount,
    locked: !!sub.locked
  })
})

app.post("/request-approval", (req, res) => {
  const { id } = req.body
  const submissions = readJSON("submissions.json")
  const sub = submissions[id]

  if (!sub) return res.json({ ok: false, msg: "학생 정보 없음" })

  sub.approvalRequested = true
  submissions[id] = sub
  writeJSON("submissions.json", submissions)

  return res.json({ ok: true })
})

app.get("/result/:id", (req, res) => {
  const submissions = readJSON("submissions.json")
  const sub = submissions[req.params.id]

  if (!sub) return res.send("결과를 찾을 수 없습니다.")

  res.render("result", {
    studentName: sub.name || "",
    studentClass: sub.class || "",
    text: sub.text || "",
    comment: sub.comment || ""
  })
})

/* -------------------------
   관리자 페이지
------------------------- */

app.get("/admin", requireAdmin, (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  const search = (req.query.search || "").trim()
  const classFilter = (req.query.class || "").trim()
  const manageClass = (req.query.manageClass || classFilter || "").trim()

  const classList = [...new Set(students.map(s => s.class).filter(Boolean))].sort()

  let filteredStudents = students

  if (search) {
    filteredStudents = filteredStudents.filter(s =>
      s.name.includes(search) || s.studentId.includes(search)
    )
  }

  if (classFilter) {
    filteredStudents = filteredStudents.filter(s => s.class === classFilter)
  }

  let selectedManageClass = manageClass
  if (!selectedManageClass && classList.length > 0) {
    selectedManageClass = classList[0]
  }

  if (selectedManageClass) {
    ensureClassConfig(selectedManageClass)
  }

  const selectedClassConfig = selectedManageClass
    ? getClassConfig(selectedManageClass)
    : null

  res.render("admin", {
    students: filteredStudents,
    submissions,
    config,
    classList,
    search,
    classFilter,
    manageClass: selectedManageClass,
    selectedClassConfig,
    adminName: req.session.adminName,
    adminId: req.session.adminId,
    adminRole: req.session.adminRole
  })
})

app.post("/add-professor", requireAdmin, (req, res) => {
  if (req.session.adminRole !== "super") {
    return res.send("초관리자만 교수자를 추가할 수 있습니다.")
  }

  const { name, id, password } = req.body
  const admins = readJSON("admins.json")

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
  res.redirect("/admin")
})

app.post("/addStudents", requireAdmin, (req, res) => {
  const list = req.body.list || ""
  const students = readJSON("students.json")
  const config = readJSON("config.json")

  const lines = list.split("\n")
  let changed = false

  lines.forEach(line => {
    const parsed = parseStudentLine(line)
    if (!parsed) return

    const exists = students.find(s => s.studentId === parsed.studentId)
    if (!exists) {
      students.push({
        name: parsed.name,
        studentId: parsed.studentId,
        class: parsed.className
      })
      changed = true
    }

    if (!config.classes) config.classes = {}
    if (!config.classes[parsed.className]) {
      config.classes[parsed.className] = {
        topic: "주제를 입력하세요",
        minChars: 500,
        durationMinutes: 50,
        started: false,
        startTime: null,
        endTime: null
      }
    }
  })

  config.studentListRaw = list

  if (changed) {
    writeJSON("students.json", students)
  } else {
    writeJSON("students.json", students)
  }

  writeJSON("config.json", config)
  students.forEach(student => ensureSubmission(student))

  res.redirect("/admin")
})

app.post("/setClassConfig", requireAdmin, (req, res) => {
  const { className, topic, minChars, durationMinutes } = req.body
  const config = readJSON("config.json")

  if (!config.classes) config.classes = {}
  if (!config.classes[className]) {
    config.classes[className] = {
      topic: "주제를 입력하세요",
      minChars: 500,
      durationMinutes: 50,
      started: false,
      startTime: null,
      endTime: null
    }
  }

  config.classes[className].topic = topic
  config.classes[className].minChars = Number(minChars || 500)
  config.classes[className].durationMinutes = Number(durationMinutes || 50)

  writeJSON("config.json", config)
  res.redirect("/admin?manageClass=" + encodeURIComponent(className))
})

app.post("/startClass", requireAdmin, (req, res) => {
  const { className } = req.body
  const config = readJSON("config.json")

  if (!config.classes) config.classes = {}
  if (!config.classes[className]) {
    config.classes[className] = {
      topic: "주제를 입력하세요",
      minChars: 500,
      durationMinutes: 50,
      started: false,
      startTime: null,
      endTime: null
    }
  }

  const now = Date.now()
  const durationMinutes = Number(config.classes[className].durationMinutes || 50)

  config.classes[className].started = true
  config.classes[className].startTime = now
  config.classes[className].endTime = now + durationMinutes * 60 * 1000

  writeJSON("config.json", config)
  res.redirect("/admin?manageClass=" + encodeURIComponent(className))
})

app.post("/stopClass", requireAdmin, (req, res) => {
  const { className } = req.body
  const config = readJSON("config.json")

  if (!config.classes || !config.classes[className]) {
    return res.redirect("/admin")
  }

  config.classes[className].started = false
  config.classes[className].endTime = Date.now()

  writeJSON("config.json", config)
  res.redirect("/admin?manageClass=" + encodeURIComponent(className))
})

app.post("/comment", requireAdmin, (req, res) => {
  const { studentId, comment } = req.body
  const submissions = readJSON("submissions.json")

  if (submissions[studentId]) {
    submissions[studentId].comment = comment
    writeJSON("submissions.json", submissions)
  }

  res.redirect("/admin")
})

app.post("/unlock-student", requireAdmin, (req, res) => {
  const { studentId } = req.body
  const submissions = readJSON("submissions.json")

  if (submissions[studentId]) {
    submissions[studentId].locked = false
    submissions[studentId].warningCount = 0
    submissions[studentId].approvalRequested = false
    writeJSON("submissions.json", submissions)
  }

  res.redirect("/admin")
})

app.post("/reopen-student", requireAdmin, (req, res) => {
  const { studentId } = req.body
  const submissions = readJSON("submissions.json")

  if (submissions[studentId]) {
    submissions[studentId].allowRelogin = true
    writeJSON("submissions.json", submissions)
  }

  res.redirect("/admin")
})

app.get("/admin/student/:studentId", requireAdmin, (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")

  const student = students.find(s => s.studentId === req.params.studentId)
  if (!student) return res.send("학생 정보를 찾을 수 없습니다.")

  const submission = submissions[req.params.studentId] || {
    text: "",
    comment: "",
    submitted: false,
    locked: false,
    approvalRequested: false
  }

  res.render("student-detail", {
    student,
    submission
  })
})

app.get("/download/student/:studentId", requireAdmin, (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")

  const student = students.find(s => s.studentId === req.params.studentId)
  const sub = submissions[req.params.studentId]

  if (!student) return res.send("학생 정보를 찾을 수 없습니다.")

  const content = [
    "이름: " + student.name,
    "학번: " + student.studentId,
    "분반: " + (student.class || ""),
    "제출 상태: " + ((sub && sub.submitted) ? "제출 완료" : "미제출"),
    "잠금 상태: " + ((sub && sub.locked) ? "차단" : "정상"),
    "",
    "[글 내용]",
    (sub && sub.text) ? sub.text : "",
    "",
    "[코멘트]",
    (sub && sub.comment) ? sub.comment : ""
  ].join("\n")

  res.setHeader("Content-Type", "text/plain; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="${student.studentId}_${student.name}.txt"`)
  res.send(content)
})

app.get("/csv", requireAdmin, (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const classFilter = (req.query.class || "").trim()

  const targetStudents = classFilter
    ? students.filter(s => s.class === classFilter)
    : students

  const data = targetStudents.map(student => {
    const sub = submissions[student.studentId] || {}

    return {
      name: student.name || "",
      studentId: student.studentId || "",
      class: student.class || "",
      submitted: sub.submitted ? "제출 완료" : "미제출",
      text: sub.text || "",
      comment: sub.comment || "",
      locked: sub.locked ? "차단" : "",
      approvalRequested: sub.approvalRequested ? "요청" : ""
    }
  })

  const parser = new Parser({
    fields: [
      "name",
      "studentId",
      "class",
      "submitted",
      "text",
      "comment",
      "locked",
      "approvalRequested"
    ]
  })

  const csv = parser.parse(data)

  res.header("Content-Type", "text/csv; charset=utf-8")
  res.attachment(classFilter ? `writing_${classFilter}.csv` : "writing_all.csv")
  res.send("\uFEFF" + csv)
})

app.listen(PORT, () => {
  console.log("server running on port " + PORT)
})