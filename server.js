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
  saveUninitialized: true
}))

function readJSON(file) {
  if (!fs.existsSync(file)) {
    if (file.includes("students")) return []
    if (file.includes("admins")) return []
    return {}
  }

  const data = fs.readFileSync(file, "utf8")

  if (!data.trim()) {
    if (file.includes("students")) return []
    if (file.includes("admins")) return []
    return {}
  }

  return JSON.parse(data)
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8")
}

/* =========================
   기본 페이지
========================= */

app.get("/", (req, res) => {
  res.redirect("/login")
})

app.get("/login", (req, res) => {
  res.render("login")
})

app.get("/admin-login", (req, res) => {
  res.render("admin-login")
})

/* =========================
   관리자 로그인
========================= */

app.post("/admin-login", (req, res) => {
  const { id, password } = req.body
  const admins = readJSON("admins.json")

  const admin = admins.find(a => a.id === id && a.password === password)

  if (!admin) {
    return res.send("관리자 로그인 실패")
  }

  req.session.admin = true
  req.session.adminId = admin.id
  req.session.adminRole = admin.role

  res.redirect("/admin")
})

/* =========================
   학생 로그인
========================= */

app.post("/login", (req, res) => {
  const { name, id } = req.body

  const students = readJSON("students.json")
  const student = students.find(s => s.studentId === id && s.name === name)

  if (!student) {
    return res.send("학생 정보 없음")
  }

  let submissions = readJSON("submissions.json")

  if (!submissions[id]) {
    submissions[id] = {
      name: name,
      studentId: id,
      class: student.class || "",
      text: "",
      submitted: false,
      comment: ""
    }
  }

  writeJSON("submissions.json", submissions)

  res.redirect("/waiting/" + id)
})

/* =========================
   대기화면
========================= */

app.get("/waiting/:id", (req, res) => {
  const config = readJSON("config.json")

  if (config.examStarted) {
    return res.redirect("/write/" + req.params.id)
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>시험 대기</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <div class="login-page">
        <div class="login-box">
          <h1>시험 대기중입니다</h1>
          <p>교수자가 시험을 시작하면 자동으로 이동합니다.</p>
        </div>
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
    return res.send("접근 오류")
  }

  res.render("write", {
    id,
    topic: config.topic || "주제를 설정하세요",
    minChars: config.minChars || 500,
    text: submission.text || ""
  })
})

/* =========================
   자동저장
========================= */

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

/* =========================
   제출
========================= */

app.post("/submit", (req, res) => {
  const { id, text } = req.body
  const config = readJSON("config.json")
  const submissions = readJSON("submissions.json")

  if (!submissions[id]) {
    return res.json({ ok: false, msg: "학생 정보 없음" })
  }

  if (submissions[id].submitted) {
    return res.json({ ok: false, msg: "이미 제출되었습니다" })
  }

  const count = text.replace(/\s/g, "").length

  if (count < Number(config.minChars || 500)) {
    return res.json({ ok: false, msg: "글자수가 부족합니다" })
  }

  submissions[id].text = text
  submissions[id].submitted = true

  writeJSON("submissions.json", submissions)

  res.json({ ok: true })
})

/* =========================
   관리자 페이지
========================= */

app.get("/admin", (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin-login")
  }

  const students = readJSON("students.json")
  const submissions = readJSON("submissions.json")
  const config = readJSON("config.json")

  res.render("admin", { students, submissions, config })
})

/* =========================
   학생 일괄 등록
   형식: 이름,학번,분반
========================= */

app.post("/addStudents", (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin-login")
  }

  const list = req.body.list || ""
  let students = readJSON("students.json")

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

  writeJSON("students.json", students)

  res.redirect("/admin")
})

/* =========================
   시험 설정 저장
========================= */

app.post("/setTopic", (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin-login")
  }

  const { topic, minChars } = req.body

  let oldConfig = readJSON("config.json")

  oldConfig.topic = topic
  oldConfig.minChars = Number(minChars)
  if (typeof oldConfig.examStarted !== "boolean") {
    oldConfig.examStarted = false
  }

  writeJSON("config.json", oldConfig)

  res.redirect("/admin")
})

/* =========================
   시험 시작
========================= */

app.post("/startExam", (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin-login")
  }

  let config = readJSON("config.json")
  config.examStarted = true

  writeJSON("config.json", config)

  res.redirect("/admin")
})

/* =========================
   코멘트 저장
========================= */

app.post("/comment", (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin-login")
  }

  const { studentId, comment } = req.body
  let submissions = readJSON("submissions.json")

  if (submissions[studentId]) {
    submissions[studentId].comment = comment
    writeJSON("submissions.json", submissions)
  }

  res.redirect("/admin")
})

/* =========================
   CSV 다운로드
========================= */

app.get("/csv", (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin-login")
  }

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

/* =========================
   로그아웃
========================= */

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin-login")
  })
})

app.listen(PORT, () => {
  console.log("server running on port " + PORT)
})