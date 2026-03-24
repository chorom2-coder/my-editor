require("dotenv").config()

const express = require("express")
const path = require("path")
const bodyParser = require("body-parser")
const session = require("express-session")
const { createClient } = require("@supabase/supabase-js")
const app = express()
const PORT = process.env.PORT || 3000
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)
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

async function readJSON(file) {
  try {
    if (file.includes("admins")) {
      const { data, error } = await supabase.from("admins").select("*")
      if (error) throw error
      return (data || []).map(row => ({
        id: row.id,
        password: row.password,
        name: row.name || row.id,
        role: row.role || "prof"
      }))
    }

    if (file.includes("students")) {
      const { data, error } = await supabase.from("students").select("*")
      if (error) throw error
      return (data || []).map(row => ({
        name: row.name,
        studentId: row.student_id,
        class: row.class_name || "",
        ownerId: row.owner_id || ""
      }))
    }

    if (file.includes("submissions")) {
      const { data, error } = await supabase.from("submissions").select("*")
      if (error) throw error
      const submissions = {}
      ;(data || []).forEach(row => {
        submissions[row.student_id] = {
          name: row.name || "",
          studentId: row.student_id,
          class: row.class_name || "",
          text: row.text || "",
          submitted: row.submitted === true,
          comment: row.comment || "",
          warningCount: row.warning_count || 0,
          locked: row.locked === true,
          approvalRequested: row.approval_requested === true,
          submittedAt: row.submitted_at || null,
          submitTime: row.submit_time || "",
          duration: row.duration || "",
          withSpace: row.with_space || 0,
          withoutSpace: row.without_space || 0
        }
      })
      return submissions
    }

    if (file.includes("config")) {
      const { data, error } = await supabase.from("class_configs").select("*")
      if (error) throw error

      const classes = {}
      ;(data || []).forEach(row => {
        classes[row.class_name] = {
          ownerId: row.owner_id || "",
          topic: row.topic || "주제를 입력하세요",
          minChars: row.min_chars ?? 500,
          durationMinutes: row.duration_minutes ?? 50,
          started: row.started === true,
          startTime: row.start_time ?? null,
          endTime: row.end_time ?? null
        }
      })

      return {
        studentListRaw: "",
        classes
      }
    }

    return defaultValueByFile(file)
  } catch (e) {
    console.error("readJSON fallback:", file, e.message || e)
    return defaultValueByFile(file)
  }
}

async function writeJSON(file, data) {
  if (file.includes("admins")) {
    const rows = (Array.isArray(data) ? data : []).map(a => ({
      id: a.id,
      password: a.password,
      name: a.name || a.id,
      role: a.role || "prof"
    }))

    const ids = rows.map(r => r.id).filter(Boolean)
    if (ids.length > 0) {
      const { error: deleteError } = await supabase
        .from("admins")
        .delete()
        .not("id", "in", `(${ids.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(",")})`)
      if (deleteError) throw deleteError
    } else {
      const { error: deleteError } = await supabase.from("admins").delete().neq("id", "__never__")
      if (deleteError) throw deleteError
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("admins").upsert(rows, { onConflict: "id" })
      if (error) throw error
    }
    return
  }

  if (file.includes("students")) {
    const rows = (Array.isArray(data) ? data : []).map(s => ({
      name: s.name,
      student_id: s.studentId,
      class_name: s.class || "",
      owner_id: s.ownerId || ""
    }))
    const ids = rows.map(r => r.student_id).filter(Boolean)
    if (ids.length > 0) {
      const { error: deleteError } = await supabase
        .from("students")
        .delete()
        .not("student_id", "in", `(${ids.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(",")})`)
      if (deleteError) throw deleteError
    } else {
      const { error: deleteError } = await supabase.from("students").delete().neq("student_id", "__never__")
      if (deleteError) throw deleteError
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("students").upsert(rows, { onConflict: "student_id" })
      if (error) throw error
    }
    return
  }

  if (file.includes("config")) {
    const classes = data?.classes || {}
    const classNames = Object.keys(classes)

    if (classNames.length > 0) {
      const rows = classNames.map(className => {
        const cfg = classes[className] || defaultClassConfig()
        return {
          class_name: className,
          owner_id: cfg.ownerId || "",
          topic: cfg.topic || "주제를 입력하세요",
          min_chars: Number(cfg.minChars ?? 500),
          duration_minutes: Number(cfg.durationMinutes ?? 50),
          started: cfg.started === true,
          start_time: cfg.startTime ?? null,
          end_time: cfg.endTime ?? null
        }
      })
      const { error: upsertError } = await supabase.from("class_configs").upsert(rows, { onConflict: "class_name" })
      if (upsertError) throw upsertError
      const { error: deleteError } = await supabase
        .from("class_configs")
        .delete()
        .not("class_name", "in", `(${classNames.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(",")})`)
      if (deleteError) throw deleteError
    } else {
      const { error: deleteError } = await supabase.from("class_configs").delete().neq("class_name", "__never__")
      if (deleteError) throw deleteError
    }
    return
  }

  if (file.includes("submissions")) {
    const values = data && typeof data === "object" ? Object.values(data) : []
    const rows = values.map(sub => ({
      student_id: sub.studentId,
      name: sub.name || "",
      class_name: sub.class || "",
      text: sub.text || "",
      submitted: sub.submitted === true,
      comment: sub.comment || "",
      warning_count: Number(sub.warningCount || 0),
      locked: sub.locked === true,
      approval_requested: sub.approvalRequested === true,
      submitted_at: sub.submittedAt ?? null,
      submit_time: sub.submitTime || "",
      duration: sub.duration || "",
      with_space: Number(sub.withSpace || 0),
      without_space: Number(sub.withoutSpace || 0)
    }))
    const ids = rows.map(r => r.student_id).filter(Boolean)
    if (ids.length > 0) {
      const { error: deleteError } = await supabase
        .from("submissions")
        .delete()
        .not("student_id", "in", `(${ids.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(",")})`)
      if (deleteError) throw deleteError
    } else {
      const { error: deleteError } = await supabase.from("submissions").delete().neq("student_id", "__never__")
      if (deleteError) throw deleteError
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("submissions").upsert(rows, { onConflict: "student_id" })
      if (error) throw error
    }
  }
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

async function getClassConfigFromDb(className) {
  const { data, error } = await supabase
    .from("class_configs")
    .select("*")
    .eq("class_name", className)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    const defaults = defaultClassConfig()

    const { data: inserted, error: insertError } = await supabase
      .from("class_configs")
      .insert({
        class_name: className,
        owner_id: defaults.ownerId,
        topic: defaults.topic,
        min_chars: defaults.minChars,
        duration_minutes: defaults.durationMinutes,
        started: defaults.started,
        start_time: defaults.startTime,
        end_time: defaults.endTime
      })
      .select()
      .single()

    if (insertError) throw insertError

    return {
      ownerId: inserted.owner_id || "",
      topic: inserted.topic || "주제를 입력하세요",
      minChars: inserted.min_chars ?? 500,
      durationMinutes: inserted.duration_minutes ?? 50,
      started: inserted.started === true,
      startTime: inserted.start_time ?? null,
      endTime: inserted.end_time ?? null
    }
  }

  return {
    ownerId: data.owner_id || "",
    topic: data.topic || "주제를 입력하세요",
    minChars: data.min_chars ?? 500,
    durationMinutes: data.duration_minutes ?? 50,
    started: data.started === true,
    startTime: data.start_time ?? null,
    endTime: data.end_time ?? null
  }
}

async function ensureClassConfig(className) {
  const config = await readJSON("config.json")
  if (!config.classes) config.classes = {}

  if (!config.classes[className]) {
    config.classes[className] = defaultClassConfig()
    await writeJSON("config.json", config)
  }

  return config.classes[className]
}

async function ensureSubmission(student) {
  const submissions = await readJSON("submissions.json")
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
    await writeJSON("submissions.json", submissions)
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


app.post("/login", async (req, res) => {
  try {
    const { name, id } = req.body

    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("name", name)
      .eq("student_id", id)
      .maybeSingle()

    if (error || !data) {
      return res.send("학생 정보가 없습니다. 이름과 학번을 다시 확인하세요.")
    }

    req.session.studentId = data.student_id
    req.session.studentName = data.name
    req.session.studentClass = data.class_name || ""

    return res.redirect("/waiting/" + data.student_id)
  } catch (err) {
    console.error(err)
    res.status(500).send("로그인 중 오류가 발생했습니다.")
  }
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

app.get("/waiting/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("student_id", req.params.id)
      .maybeSingle()

    if (error || !data) {
      return res.send("학생 정보를 찾을 수 없습니다.")
    }

    res.render("waiting", {
      studentName: data.name,
      studentClass: data.class_name || "",
      studentId: data.student_id
    })
  } catch (err) {
    console.error(err)
    res.status(500).send("오류가 발생했습니다.")
  }
})

app.get("/status/:id", async (req, res) => {
  try {
    const studentId = req.params.id

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle()

    if (studentError || !student) {
      return res.json({ ok: false })
    }

    const { data: sub } = await supabase
      .from("submissions")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle()

    const classConfig = await getClassConfigFromDb(student.class_name || "")

    res.json({
      ok: true,
      started: classConfig.started === true,
      submitted: sub?.submitted === true,
      locked: sub?.locked === true,
      approvalRequested: sub?.approval_requested === true,
      endTime: classConfig.endTime || null
    })
  } catch (err) {
    console.error(err)
    res.json({ ok: false })
  }
})
/* -------------------------
   글쓰기 화면
------------------------- */

app.get("/write/:id", async (req, res) => {
  try {
    const studentId = req.params.id

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle()

    if (studentError || !student) {
      return res.send("학생 정보를 찾을 수 없습니다.")
    }

    const { data: sub } = await supabase
      .from("submissions")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle()

const classConfig = await getClassConfigFromDb(student.class_name)

    if (!classConfig || classConfig.started !== true) {
      return res.redirect("/waiting/" + student.student_id)
    }

    if (sub?.submitted) {
      return res.redirect("/result/" + student.student_id)
    }

    res.render("write", {
      id: student.student_id,
      studentName: student.name,
      studentClass: student.class_name || "",
      topic: classConfig.topic || "주제를 입력하세요",
      minChars: classConfig.minChars || 500,
      text: sub?.text || "",
      locked: sub?.locked === true,
      endTime: classConfig.endTime || null
    })
  } catch (err) {
    console.error(err)
    res.status(500).send("오류가 발생했습니다.")
  }
})
app.post("/save", async (req, res) => {
  try {
    const { studentId, text } = req.body

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle()

    if (studentError || !student) {
      return res.json({ ok: false, msg: "학생 정보 없음" })
    }

  const classConfig = await getClassConfigFromDb(student.class_name)

    if (!classConfig || classConfig.started !== true) {
      return res.json({ ok: false, msg: "현재 진행 중이 아닙니다." })
    }

    const { data: sub } = await supabase
      .from("submissions")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle()

    if (sub?.locked) {
      return res.json({ ok: false, msg: "입력창이 차단되었습니다." })
    }

    if (sub?.submitted) {
      return res.json({ ok: false, msg: "이미 제출되었습니다." })
    }

    // 👉 핵심: insert or update
    const { error: upsertError } = await supabase
      .from("submissions")
      .upsert({
        student_id: studentId,
        name: student.name,
        class_name: student.class_name,
        text: text
      })

    if (upsertError) {
      console.error(upsertError)
      return res.json({ ok: false, msg: "저장 실패" })
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.json({ ok: false })
  }
})

app.post("/submit", async (req, res) => {
  try {
    const { studentId, text } = req.body

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle()

    if (studentError || !student) {
      return res.json({ ok: false, msg: "학생 정보 없음" })
    }

const classConfig = await getClassConfigFromDb(student.class_name)

    if (!classConfig || classConfig.started !== true) {
      return res.json({ ok: false, msg: "현재 진행 중이 아닙니다." })
    }

    const { data: sub } = await supabase
      .from("submissions")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle()

    if (!sub) {
      return res.json({ ok: false, msg: "작성 정보 없음" })
    }

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

    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        text: text,
        submitted: true,
        submitted_at: submittedAt,
        submit_time: `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`,
        duration: durationText,
        with_space: withSpace,
        without_space: withoutSpace
      })
      .eq("student_id", studentId)

    if (updateError) {
      console.error(updateError)
      return res.json({ ok: false, msg: "제출 실패" })
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.json({ ok: false, msg: "제출 중 오류가 발생했습니다." })
  }
})

app.post("/warn", async (req, res) => {
  try {
    const { id } = req.body

    const { data: sub, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("student_id", id)
      .maybeSingle()

    if (error || !sub) {
      return res.json({ ok: false })
    }

    const warningCount = (sub.warning_count || 0) + 1
    const locked = warningCount >= 2

    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        warning_count: warningCount,
        locked: locked
      })
      .eq("student_id", id)

    if (updateError) {
      console.error(updateError)
      return res.json({ ok: false })
    }

    res.json({
      ok: true,
      warningCount,
      locked
    })
  } catch (err) {
    console.error(err)
    res.json({ ok: false })
  }
})

app.post("/request-approval", async (req, res) => {
  try {
    const { id } = req.body

    const { data: sub, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("student_id", id)
      .maybeSingle()

    if (error || !sub) {
      return res.json({ ok: false })
    }

    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        approval_requested: true
      })
      .eq("student_id", id)

    if (updateError) {
      console.error(updateError)
      return res.json({ ok: false })
    }

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.json({ ok: false })
  }
})

app.get("/result/:id", async (req, res) => {
  try {
    const { data: sub, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("student_id", req.params.id)
      .maybeSingle()

    if (error) {
      console.error(error)
      return res.status(500).send("오류가 발생했습니다.")
    }

    res.render("result", {
      studentName: sub?.name || req.session.studentName || "",
      studentClass: sub?.class_name || req.session.studentClass || "",
      text: sub?.text || "",
      comment: sub?.comment || ""
    })
  } catch (err) {
    console.error(err)
    res.status(500).send("오류가 발생했습니다.")
  }
})
/* -------------------------
   관리자 로그인
------------------------- */

app.get("/admin-login", (req, res) => {
  res.render("admin-login")
})


app.post("/admin-login", async (req, res) => {
try {
const id = req.body.id
const password = req.body.password

const { data: admin, error } = await supabase
  .from("admins")
  .select("*")
  .eq("id", id)
  .eq("password", password)
  .maybeSingle()

if (error || !admin) {
  return res.send("관리자 로그인 실패. 아이디와 비밀번호를 확인하세요.")
}

req.session.admin = true
req.session.adminId = admin.id
req.session.adminName = admin.name || admin.id
req.session.adminRole = admin.role || "prof"

res.redirect("/admin")


} catch (err) {
console.error(err)
res.status(500).send("관리자 로그인 중 오류가 발생했습니다.")
}
})


app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin-login")
  })
})

/* -------------------------
   관리자 페이지
------------------------- */

app.get("/admin", requireAdmin, async (req, res) => {
  const { data: studentRows, error: studentError } = await supabase
  .from("students")
  .select("*")

if (studentError) {
  console.error(studentError)
  return res.send("학생 목록 오류")
}

const allStudents = (studentRows || []).map(s => ({
  name: s.name,
  studentId: s.student_id,
  class: s.class_name || "",
  ownerId: s.owner_id || ""
}))
 

const { data: submissionRows, error: submissionError } = await supabase
  .from("submissions")
  .select("*")

if (submissionError) {
  console.error(submissionError)
  return res.send("제출 목록을 불러오는 중 오류가 발생했습니다.")
}

const submissions = {}
;(submissionRows || []).forEach(row => {
  submissions[row.student_id] = {
    name: row.name || "",
    studentId: row.student_id,
    class: row.class_name || "",
    text: row.text || "",
    submitted: row.submitted === true,
    comment: row.comment || "",
    warningCount: row.warning_count || 0,
    locked: row.locked === true,
    approvalRequested: row.approval_requested === true,
    submittedAt: row.submitted_at || null,
    submitTime: row.submit_time || "",
    duration: row.duration || "",
    withSpace: row.with_space || 0,
    withoutSpace: row.without_space || 0
  }
})


  const config = await readJSON("config.json")

const { data: adminRows, error: adminError } = await supabase
  .from("admins")
  .select("*")

if (adminError) {
  console.error(adminError)
  return res.send("관리자 목록을 불러오는 중 오류가 발생했습니다.")
}

const admins = (adminRows || []).map(a => ({
  id: a.id,
  password: a.password,
  name: a.name || a.id,
  role: a.role || "prof"
}))

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
 const profQuery = Array.isArray(req.query.prof) ? req.query.prof[0] : req.query.prof
const professorFilter = String(profQuery || "").trim()

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
  selectedClassConfig = await getClassConfigFromDb(selectedManageClass)
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

app.post("/add-professor", requireAdmin, async (req, res) => {
try {
if (req.session.adminRole !== "super") {
return res.send("초관리자만 교수자를 추가할 수 있습니다.")
}



const name = req.body.name
const id = req.body.id
const password = req.body.password

const { data: existing, error: checkError } = await supabase
  .from("admins")
  .select("id")
  .eq("id", id)
  .maybeSingle()

if (checkError) {
  console.error(checkError)
  return res.redirect("/admin?msg=" + encodeURIComponent("교수자 확인 중 오류가 발생했습니다."))
}

if (existing) {
  return res.redirect("/admin?msg=" + encodeURIComponent("이미 존재하는 교수자 ID입니다."))
}

const { error: insertError } = await supabase
  .from("admins")
  .insert({
    id: id,
    password: password,
    role: "prof",
    name: name
  })

if (insertError) {
  console.error(insertError)
  return res.redirect("/admin?msg=" + encodeURIComponent("교수자 추가 중 오류가 발생했습니다."))
}

res.redirect("/admin?msg=" + encodeURIComponent("교수자를 추가했습니다."))

} catch (err) {
console.error(err)
res.redirect("/admin?msg=" + encodeURIComponent("교수자 추가 중 오류가 발생했습니다."))
}
})

app.post("/change-password", requireAdmin, async (req, res) => {
  try {
  const { currentPassword, newPassword } = req.body
  const admins = await readJSON("admins.json")

  const target = admins.find(a => a.id === req.session.adminId)
  if (!target) return res.redirect("/admin?msg=" + encodeURIComponent("계정을 찾을 수 없습니다."))

  if (target.password !== currentPassword) {
    return res.redirect("/admin?msg=" + encodeURIComponent("현재 비밀번호가 다릅니다."))
  }

  target.password = newPassword
  await writeJSON("admins.json", admins)
  res.redirect("/admin?msg=" + encodeURIComponent("비밀번호를 변경했습니다."))
  } catch (err) {
    console.error(err)
    res.redirect("/admin?msg=" + encodeURIComponent("비밀번호 변경 중 오류가 발생했습니다."))
  }
})


app.post("/addStudents", requireAdmin, async (req, res) => {
  try {
    const list = req.body.list || ""
    const config = await readJSON("config.json")

    if (!config.classes) config.classes = {}

    let added = 0
    let skipped = 0

    const lines = list.split("\n")
    const rowsToInsert = []

    for (const line of lines) {
      const parsed = parseStudentLine(line)
      if (!parsed) continue

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
          continue
        }
      }

      const ownerId = config.classes[className].ownerId || ""

      const { data: existing } = await supabase
        .from("students")
        .select("student_id")
        .eq("student_id", parsed.studentId)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

 rowsToInsert.push({
  name: parsed.name,
  student_id: parsed.studentId,
  password: parsed.studentId,
  class_name: className,
  owner_id: ownerId
})

      added++
    }

    if (rowsToInsert.length > 0) {
      const { error } = await supabase
        .from("students")
        .insert(rowsToInsert)

      if (error) {
        console.error(error)
        return res.redirect("/admin?msg=" + encodeURIComponent("학생 저장 중 오류가 발생했습니다."))
      }

      const submissionRows = rowsToInsert.map(student => ({
        student_id: student.student_id,
        name: student.name,
        class_name: student.class_name,
        text: "",
        submitted: false,
        comment: "",
        warning_count: 0,
        locked: false,
        approval_requested: false,
        submitted_at: null,
        submit_time: "",
        duration: "",
        with_space: 0,
        without_space: 0
      }))

      const { error: submissionError } = await supabase
        .from("submissions")
        .upsert(submissionRows, { onConflict: "student_id" })

      if (submissionError) {
        console.error(submissionError)
        return res.redirect("/admin?msg=" + encodeURIComponent("제출 정보 생성 중 오류가 발생했습니다."))
      }
    }

    await writeJSON("config.json", config)

    const message = `학생 명단을 저장했습니다 (${added}명)`
    res.redirect("/admin?msg=" + encodeURIComponent(message))
  } catch (err) {
    console.error(err)
    res.redirect("/admin?msg=" + encodeURIComponent("학생 명단 저장 중 오류가 발생했습니다."))
  }
})


   
 
app.post("/setClassConfig", requireAdmin, async (req, res) => { 
try { 

const className = req.body.className
const topic = req.body.topic
const minChars = req.body.minChars
const durationMinutes = req.body.durationMinutes
const ownerId = req.body.ownerId


const currentConfig = await getClassConfigFromDb(className)

let finalOwnerId = currentConfig.ownerId || ""

if (req.session.adminRole !== "super") {
  if (finalOwnerId && finalOwnerId !== req.session.adminId) {
    return res.redirect("/admin?msg=" + encodeURIComponent("해당 분반은 수정할 수 없습니다."))
  }
  finalOwnerId = req.session.adminId
} else {
  if (ownerId !== undefined) {
    finalOwnerId = ownerId || ""
  }
}

const { error } = await supabase
  .from("class_configs")
  .upsert({
    class_name: className,
    owner_id: finalOwnerId,
    topic: topic,
    min_chars: Number(minChars || 500),
    duration_minutes: Number(durationMinutes || 50),
    started: currentConfig.started,
    start_time: currentConfig.startTime,
    end_time: currentConfig.endTime
  })

if (error) {
  console.error(error)
  return res.redirect("/admin?msg=" + encodeURIComponent("분반 설정 저장 중 오류가 발생했습니다."))
}

await supabase
  .from("students")
  .update({ owner_id: finalOwnerId })
  .eq("class_name", className)

res.redirect("/admin?manageClass=" + encodeURIComponent(className) + "&msg=" + encodeURIComponent("분반 설정을 저장했습니다."))

 } catch (err) { 
console.error(err) 
res.redirect("/admin?msg=" + encodeURIComponent("분반 설정 저장 중 오류가 발생했습니다."))
 }
 })


app.post("/startClass", requireAdmin, async (req, res) => {
  try {
    const { className } = req.body

    const classConfig = await getClassConfigFromDb(className)

    if (req.session.adminRole !== "super") {
      const owner = classConfig.ownerId || ""
      if (owner && owner !== req.session.adminId) {
        return res.redirect("/admin?msg=" + encodeURIComponent("해당 분반은 시작할 수 없습니다."))
      }
    }

    const now = Date.now()
    const duration = Number(classConfig.durationMinutes || 50)

    const { error } = await supabase
      .from("class_configs")
      .update({
        started: true,
        start_time: now,
        end_time: now + duration * 60 * 1000
      })
      .eq("class_name", className)

    if (error) {
      console.error(error)
      return res.redirect("/admin?msg=" + encodeURIComponent("분반 시작 중 오류가 발생했습니다."))
    }

    res.redirect(
      "/admin?manageClass=" +
        encodeURIComponent(className) +
        "&msg=" +
        encodeURIComponent("시작되었습니다.")
    )
  } catch (err) {
    console.error(err)
    res.redirect("/admin?msg=" + encodeURIComponent("분반 시작 중 오류가 발생했습니다."))
  }
})


  app.post("/stopClass", requireAdmin, async (req, res) => {
    try {
      const { className } = req.body

      const classConfig = await getClassConfigFromDb(className)

      if (req.session.adminRole !== "super") {
        const owner = classConfig.ownerId || ""
        if (owner && owner !== req.session.adminId) {
         return res.redirect("/admin?msg=" + encodeURIComponent("해당 분반은 종료할 수 없습니다."))
       }
     }
     const { error } = await supabase
       .from("class_configs")
       .update({
         started: false,
         end_time: Date.now()
       })
       .eq("class_name", className)

     if (error) {
       console.error(error)
       return res.redirect("/admin?msg=" + encodeURIComponent("분반 종료 중 오류가 발생했습니다."))
     }

    res.redirect(
       "/admin?manageClass=" +
       encodeURIComponent(className) +
       "&msg=" +
       encodeURIComponent("종료되었습니다.")
     )
   } catch (err) {
     console.error(err)
     res.redirect("/admin?msg=" + encodeURIComponent("분반 종료 중 오류가 발생했습니다."))
   }
 })

app.post("/unlock-student", requireAdmin, async (req, res) => {
try {
const studentId = req.body.studentId

await supabase
  .from("submissions")
  .update({
    locked: false,
    warning_count: 0,
    approval_requested: false
  })
  .eq("student_id", studentId)

res.redirect("/admin?msg=" + encodeURIComponent("입력 잠금을 해제했습니다."))

} catch (err) {
console.error(err)
res.redirect("/admin?msg=" + encodeURIComponent("오류 발생"))
}
})

app.post("/approve-request", requireAdmin, async (req, res) => {
try {
const studentId = req.body.studentId

await supabase
  .from("submissions")
  .update({
    locked: false,
    warning_count: 0,
    approval_requested: false
  })
  .eq("student_id", studentId)

res.redirect("/admin?msg=" + encodeURIComponent("승인 요청을 처리했습니다."))

} catch (err) {
console.error(err)
res.redirect("/admin?msg=" + encodeURIComponent("오류 발생"))
}
})

app.post("/comment", requireAdmin, async (req, res) => {
try {
const studentId = req.body.studentId
const comment = req.body.comment

await supabase
  .from("submissions")
  .update({
    comment: comment
  })
  .eq("student_id", studentId)

res.redirect(
  "/admin/student/" +
    studentId +
    "?msg=" +
    encodeURIComponent("코멘트를 저장했습니다.")
)

} catch (err) {
console.error(err)
res.redirect("/admin?msg=" + encodeURIComponent("오류 발생"))
}
})





app.get("/admin/student/:studentId", requireAdmin, async (req, res) => {
try {
const studentId = req.params.studentId

const { data: studentRow, error: studentError } = await supabase
  .from("students")
  .select("*")
  .eq("student_id", studentId)
  .maybeSingle()

if (studentError || !studentRow) {
  return res.send("학생 정보를 찾을 수 없습니다.")
}

const student = {
  name: studentRow.name,
  studentId: studentRow.student_id,
  class: studentRow.class_name || "",
  ownerId: studentRow.owner_id || ""
}

const { data: subRow } = await supabase
  .from("submissions")
  .select("*")
  .eq("student_id", studentId)
  .maybeSingle()

const classConfig = await getClassConfigFromDb(student.class || "")

const raw = subRow || {
  text: "",
  comment: "",
  submitted: false,
  locked: false,
  approval_requested: false,
  with_space: 0,
  without_space: 0,
  submit_time: "",
  submitted_at: null,
  duration: ""
}

const text = raw.text || ""
const withSpace = raw.with_space ?? text.length
const withoutSpace = raw.without_space ?? text.replace(/\s/g, "").length

let submitTime = raw.submit_time || "-"
if (submitTime === "-" && raw.submitted_at) {
  const d = new Date(raw.submitted_at)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  submitTime = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

let duration = raw.duration || "-"
if (duration === "-" && raw.submitted_at) {
  const classStartTime = classConfig.startTime
  if (classStartTime) {
    const durationMs = Math.max(0, raw.submitted_at - classStartTime)
    const totalMinutes = Math.floor(durationMs / 60000)
    const remainSeconds = Math.floor((durationMs % 60000) / 1000)
    duration = totalMinutes > 0 ? `${totalMinutes}분 ${remainSeconds}초` : `${remainSeconds}초`
  }
}

const submission = {
  text,
  comment: raw.comment || "",
  submitted: raw.submitted === true,
  locked: raw.locked === true,
  approvalRequested: raw.approval_requested === true,
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
} catch (err) {
console.error(err)
res.send("학생 정보를 찾을 수 없습니다.")
}
})

app.get("/download/student/:studentId", requireAdmin, async (req, res) => {
try {
const studentId = req.params.studentId

const { data: studentRow, error: studentError } = await supabase
  .from("students")
  .select("*")
  .eq("student_id", studentId)
  .maybeSingle()

if (studentError || !studentRow) {
  return res.send("학생 정보를 찾을 수 없습니다.")
}

const student = {
  name: studentRow.name,
  studentId: studentRow.student_id,
  class: studentRow.class_name || "",
  ownerId: studentRow.owner_id || ""
}

const { data: subRow } = await supabase
  .from("submissions")
  .select("*")
  .eq("student_id", studentId)
  .maybeSingle()

const classConfig = await getClassConfigFromDb(student.class || "")
const sub = subRow || {}

const text = sub.text || ""
const withSpace = sub.with_space ?? text.length
const withoutSpace = sub.without_space ?? text.replace(/\s/g, "").length

let submitTime = sub.submit_time || "-"
if (submitTime === "-" && sub.submitted_at) {
  const d = new Date(sub.submitted_at)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  submitTime = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

let duration = sub.duration || "-"
if (duration === "-" && sub.submitted_at) {
  const classStartTime = classConfig.startTime
  if (classStartTime) {
    const durationMs = Math.max(0, sub.submitted_at - classStartTime)
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
} catch (err) {
console.error(err)
res.send("학생 정보를 찾을 수 없습니다.")
}
})

app.post("/bulk-download", requireAdmin, async (req, res) => {
  try {
    const idsRaw = req.body.ids || ""
    const ids = String(idsRaw).split(",").map(v => v.trim()).filter(Boolean)

    // 학생 목록 (DB)
    const { data: studentRows, error: studentError } = await supabase
      .from("students")
      .select("*")

    if (studentError) {
      console.error(studentError)
      return res.redirect("/admin?msg=" + encodeURIComponent("학생 목록 조회 오류"))
    }

    const allStudents = (studentRows || []).map(s => ({
      name: s.name,
      studentId: s.student_id,
      class: s.class_name || "",
      ownerId: s.owner_id || ""
    }))

    // 제출 목록 (DB)
    const { data: submissionRows, error: submissionError } = await supabase
      .from("submissions")
      .select("*")

    if (submissionError) {
      console.error(submissionError)
      return res.redirect("/admin?msg=" + encodeURIComponent("제출 목록 조회 오류"))
    }

    const submissions = {}
    ;(submissionRows || []).forEach(row => {
      submissions[row.student_id] = {
        submitted: row.submitted === true,
        submitTime: row.submit_time || "",
        duration: row.duration || "",
        withSpace: row.with_space || 0,
        withoutSpace: row.without_space || 0,
        text: row.text || "",
        comment: row.comment || ""
      }
    })

    // 권한 필터
    const config = await readJSON("config.json")
    const visibleStudents = visibleStudentsForAdmin(req, allStudents, config)
    const visibleIds = new Set(visibleStudents.map(s => s.studentId))

    const rows = [
      ["name","studentId","class","submitted","submitTime","duration","withSpace","withoutSpace","text","comment"].join(",")
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

  } catch (err) {
    console.error(err)
    res.redirect("/admin?msg=" + encodeURIComponent("일괄 다운로드 오류"))
  }
})


app.post("/download-class", requireAdmin, async (req, res) => {
try {

  const className = req.body.className

  const { data: studentRows, error: studentError } = await supabase
  .from("students")
  .select("*")
  .eq("class_name", className)

if (studentError) {
  console.error(studentError)
  return res.redirect("/admin?msg=" + encodeURIComponent("분반 학생 조회 오류"))
}

const studentIds = (studentRows || []).map(s => s.student_id)

const { data: submissionRows, error: submissionError } = await supabase
  .from("submissions")
  .select("*")

if (submissionError) {
  console.error(submissionError)
  return res.redirect("/admin?msg=" + encodeURIComponent("분반 제출 조회 오류"))
}

const submissions = {}
;(submissionRows || []).forEach(row => {
  if (studentIds.includes(row.student_id)) {
    submissions[row.student_id] = row
  }
})

const archiver = require("archiver")

res.attachment(`class_${className}_submissions.zip`)

const archive = archiver("zip")
archive.pipe(res)

;(studentRows || []).forEach(student => {
  const sub = submissions[student.student_id]

if (sub && sub.text) {
  const text = sub.text || ""
  const withSpace = sub.with_space ?? text.length
  const withoutSpace = sub.without_space ?? text.replace(/\s/g, "").length

  let submitTime = sub.submit_time || "-"
  if (submitTime === "-" && sub.submitted_at) {
    const d = new Date(sub.submitted_at)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    const hh = String(d.getHours()).padStart(2, "0")
    const mi = String(d.getMinutes()).padStart(2, "0")
    const ss = String(d.getSeconds()).padStart(2, "0")
    submitTime = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  }

  let duration = sub.duration || "-"

  const content = [
    "이름: " + student.name,
    "학번: " + student.student_id,
    "분반: " + (student.class_name || ""),
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

  archive.append(content, {
    name: `${student.class_name || ""}_${student.student_id}_${student.name}.txt`
  })
}

})

archive.finalize()

} catch (err) {
console.error(err)
res.redirect("/admin?msg=" + encodeURIComponent("분반 다운로드 오류"))
}
})
    
app.post("/delete-professor", requireAdmin, async (req, res) => {
  try {
  if (req.session.adminRole !== "super") {
    return res.redirect("/admin?msg=" + encodeURIComponent("권한이 없습니다."))
  }

  const id = String(req.body.id || "").trim()
  if (!id) {
    return res.redirect("/admin?msg=" + encodeURIComponent("교수자 ID가 없습니다."))
  }

  const admins = await readJSON("admins.json")
  const students = await readJSON("students.json")
  const config = await readJSON("config.json")

  const target = admins.find(a => a.id === id)
  if (!target) {
    return res.redirect("/admin?msg=" + encodeURIComponent("교수자를 찾을 수 없습니다."))
  }

  if ((target.role || "prof") === "super") {
    return res.redirect("/admin?msg=" + encodeURIComponent("초관리자 계정은 삭제할 수 없습니다."))
  }

  const nextAdmins = admins.filter(a => a.id !== id)

  students.forEach(s => {
    if (String(s.ownerId || "") === id) {
      s.ownerId = ""
    }
  })

  if (config.classes) {
    Object.keys(config.classes).forEach(cls => {
      if (String(config.classes[cls].ownerId || "") === id) {
        config.classes[cls].ownerId = ""
      }
    })
  }

  await writeJSON("admins.json", nextAdmins)
  await writeJSON("students.json", students)
  await writeJSON("config.json", config)

  res.redirect("/admin?msg=" + encodeURIComponent("교수자를 삭제했습니다."))
  } catch (err) {
    console.error(err)
    res.redirect("/admin?msg=" + encodeURIComponent("교수자 삭제 중 오류가 발생했습니다."))
  }
})

app.post("/delete-student", requireAdmin, async (req, res) => {
  try {
    const studentId = String(req.body.studentId || "").trim()

    const { data: student } = await supabase
      .from("students")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle()

    if (!student) {
      return res.redirect("/admin?msg=" + encodeURIComponent("학생 없음"))
    }

    await supabase.from("submissions").delete().eq("student_id", studentId)
    await supabase.from("students").delete().eq("student_id", studentId)

    res.redirect("/admin?msg=" + encodeURIComponent("삭제 완료"))
  } catch (err) {
    console.error(err)
    res.redirect("/admin?msg=" + encodeURIComponent("삭제 오류"))
  }
})

app.get("/admin/student-edit/:id", requireAdmin, async (req, res) => {
  try {
  const studentId = req.params.id

  const students = await readJSON("students.json")
  const admins = await readJSON("admins.json")

  const student = students.find(s => s.studentId === studentId)
  if (!student) {
    return res.redirect("/admin?msg=" + encodeURIComponent("학생을 찾을 수 없습니다."))
  }

  if (req.session.adminRole !== "super") {
    if (String(student.ownerId || "") !== req.session.adminId) {
      return res.redirect("/admin")
    }
  }

  const professorOptions = admins
    .filter(a => (a.role || "prof") !== "super")
    .map(a => ({ id: a.id, name: a.name || a.id }))

  res.render("student-edit", {
    student,
    professorOptions,
    adminRole: req.session.adminRole
  })
  } catch (err) {
    console.error(err)
    res.redirect("/admin?msg=" + encodeURIComponent("학생 수정 화면 로딩 오류"))
  }
})

app.post("/update-student", requireAdmin, async (req, res) => {
  try {
  const { name, studentId, className, ownerId } = req.body

  const students = await readJSON("students.json")

  const student = students.find(s => s.studentId === studentId)
  if (!student) {
    return res.redirect("/admin")
  }

  if (req.session.adminRole !== "super") {
    if (String(student.ownerId || "") !== req.session.adminId) {
      return res.redirect("/admin")
    }
  }

  student.name = name
  student.class = className

  if (req.session.adminRole === "super") {
    student.ownerId = ownerId || ""
  }

  await writeJSON("students.json", students)

  res.redirect("/admin?msg=" + encodeURIComponent("학생 정보를 수정했습니다."))
  } catch (err) {
    console.error(err)
    res.redirect("/admin?msg=" + encodeURIComponent("학생 정보 수정 오류"))
  }
})




app.listen(PORT, () => {
  console.log("server running on port " + PORT)
})