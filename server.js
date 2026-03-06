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
  secret: "exam-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 4
  }
}))

function defaultValueByFile(file) {
  if (file.includes("students")) return []
  if (file.includes("admins")) return []
  if (file.includes("config")) {
    return {
      topic: "주제를 설정하세요",
      minChars: 500,
      examStarted: false,
      studentListRaw: ""
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

    if (!raw.trim()) {
      return defaultValueByFile(file)
    }

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
  if (!req.session.admin) {
    return res.redirect("/admin-login")
  }
  next()
}

app.get("/", (req, res) => {
  res.redirect("/login")
})

/* =========================
   학생 로그인 페이지
========================= */

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

  req.session.studentId = student.studentId
  req.session.studentName = student.name
  req.session.studentClass = student.class || ""

  const submissions = readJSON("submissions.json")

  if (!submissions[id]) {
    submissions[id] = {
      name: student.name,
      studentId: student.studentId,
      class: student.class || "",
      text: "",
      submitted: false,
      comment: ""
    }
    writeJSON("submissions.json", submissions)
  }

  res.redirect("/waiting/" + id)
})

/* =========================
   관리자 로그인 페이지
========================= */

app.get("/admin-login", (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin")
  }

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

/* =========================
   대기화면
========================= */

app.get("/waiting/:id", (req, res) => {
  const config = readJSON("config.json")

  if (config.examStarted) {
    return res.redirect("/write/" + req.params.id)
  }

  const studentName = req.session.studentName || ""
  const studentClass = req.session.studentClass || ""

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>시험 대기</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body class="center-page">
      <div class="portal-card">
        <div class="identity-badge">응시자: ${studentName} ${studentClass ? `(${studentClass})` : ""}</div>
        <h1 class="portal-title">대기 중</h1>
        <p class="portal-subtitle">교수자가 시작하면 자동으로 이동합니다.</p>
      </div>
      <script>
        setInterval(function(){
          location.reload()
        }, 3000)
      </script>
    </body>
    </html>
  `)
})

/* =========================
   글쓰기 페이지
========================= */

app.get("/write/:id", (req, res) => {
  const id = req.params.id
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  const submission = submissions[id]

  if (!submission) {
    return res.send("학생 정보가 없습니다.")
  }

  res.render("write", {
    id,
    topic: config.topic || "주제를 설정하세요",
    minChars: config.minChars || 500,
    text: submission.text || "",
    studentName: submission.name || req.session.studentName || "",
    studentClass: submission.class || req.session.studentClass || ""
  })
})

app.post("/autosave", (req, res) => {
  const { id, text } = req.body
  const submissions = readJSON("submissions.json")

  if (!submissions[id]) {
    return res.json({ ok: false, msg: "학생 정보 없음" })
  }

  if (submissions[id].submitted) {
    return res.json({ ok: false, msg: "이미 제출되었습니다" })
  }

  submissions[id].text = text
  writeJSON("submissions.json", submissions)

  res.json({ ok: true })
})

app.post("/submit", (req, res) => {
  const { id, text } = req.body
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  if (!submissions[id]) {
    return res.json({ ok: false, msg: "학생 정보 없음" })
  }

  if (submissions[id].submitted) {
    return res.json({ ok: false, msg: "이미 제출되었습니다" })
  }

  const charCount = text.replace(/\s/g, "").length

  if (charCount < Number(config.minChars || 500)) {
    return res.json({
      ok: false,
      msg: "최소 " + Number(config.minChars || 500) + "자 이상 작성해야 합니다."
    })
  }

  submissions[id].text = text
  submissions[id].submitted = true

  writeJSON("submissions.json", submissions)

  res.json({ ok: true })
})

/* =========================
   관리자 페이지
========================= */

app.get("/admin", requireAdmin, (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  res.render("admin", {
    students,
    submissions,
    config,
    adminId: req.session.adminId,
    adminRole: req.session.adminRole,
    adminName: req.session.adminName
  })
})

/* =========================
   학생 일괄 등록
   형식: 이름,학번,분반
========================= */

app.post("/addStudents", requireAdmin, (req, res) => {
  const list = req.body.list || ""
  let students = readJSON("students.json")
  let config = readJSON("config.json")

  const lines = list.split("\n")

  lines.forEach(line => {
    const cleanLine = line.trim()
    if (!cleanLine) return

    const parts = cleanLine.split(",")

    if (parts.length >= 3) {
      const name = parts[0].trim()
      const studentId = parts[1].trim()
      const className = parts[2].trim()

      const exists = students.find(s => s.studentId === studentId)

      if (!exists) {
        students.push({
          name,
          studentId,
          class: className
        })
      }
    }
  })

  config.studentListRaw = list

  writeJSON("students.json", students)
  writeJSON("config.json", config)

  res.redirect("/admin")
})

/* =========================
   설정 저장
========================= */

app.post("/setTopic", requireAdmin, (req, res) => {
  const { topic, minChars } = req.body
  const config = readJSON("config.json")

  config.topic = topic
  config.minChars = Number(minChars || 500)

  if (typeof config.examStarted !== "boolean") {
    config.examStarted = false
  }

  if (typeof config.studentListRaw !== "string") {
    config.studentListRaw = ""
  }

  writeJSON("config.json", config)
  res.redirect("/admin")
})

/* =========================
   시작 / 종료
========================= */

app.post("/startExam", requireAdmin, (req, res) => {
  const config = readJSON("config.json")
  config.examStarted = true
  writeJSON("config.json", config)
  res.redirect("/admin")
})

app.post("/stopExam", requireAdmin, (req, res) => {
  const config = readJSON("config.json")
  config.examStarted = false
  writeJSON("config.json", config)
  res.redirect("/admin")
})

/* =========================
   코멘트 저장
========================= */

app.post("/comment", requireAdmin, (req, res) => {
  const { studentId, comment } = req.body
  const submissions = readJSON("submissions.json")

  if (submissions[studentId]) {
    submissions[studentId].comment = comment
    writeJSON("submissions.json", submissions)
  }

  res.redirect("/admin")
})

/* =========================
   CSV 다운로드
========================= */

app.get("/csv", requireAdmin, (req, res) => {
  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")

  const data = students.map(student => {
    const sub = submissions[student.studentId] || {}

    return {
      name: student.name || "",
      studentId: student.studentId || "",
      class: student.class || "",
      submitted: sub.submitted ? "제출완료" : "미제출",
      text: sub.text || "",
      comment: sub.comment || ""
    }
  })

  const parser = new Parser({
    fields: ["name", "studentId", "class", "submitted", "text", "comment"]
  })

  const csv = parser.parse(data)

  res.header("Content-Type", "text/csv; charset=utf-8")
  res.attachment("submissions.csv")
  res.send("\uFEFF" + csv)
})

app.listen(PORT, () => {
  console.log("server running on port " + PORT)
})