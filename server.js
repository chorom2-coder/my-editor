const express = require("express")
const fs = require("fs")
const path = require("path")
const bodyParser = require("body-parser")
const session = require("express-session")

const app = express()
const PORT = 3000

app.set("view engine","ejs")
app.set("views",path.join(__dirname,"views"))

app.use(express.static("public"))
app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json())

app.use(session({
  secret:"writing-secret",
  resave:false,
  saveUninitialized:true
}))

function readJSON(file){
  try{
    return JSON.parse(fs.readFileSync(file))
  }catch{
    return {}
  }
}

function writeJSON(file,data){
  fs.writeFileSync(file,JSON.stringify(data,null,2))
}

function requireAdmin(req,res,next){
  if(!req.session.admin){
    return res.redirect("/admin-login")
  }
  next()
}

app.get("/",(req,res)=>{
  res.redirect("/login")
})

/* 학생 로그인 */

app.get("/login",(req,res)=>{
  res.render("login")
})

app.post("/login",(req,res)=>{

  const {name,id}=req.body

  const students=readJSON("students.json")

  const student=students.find(
    s=>s.studentId===id && s.name===name
  )

  if(!student){
    return res.send("학생 정보가 없습니다.")
  }

  req.session.studentId=student.studentId
  req.session.studentName=student.name
  req.session.studentClass=student.class

  const config=readJSON("config.json")
  const classConfig=config.classes?.[student.class]

  if(!classConfig || !classConfig.started){
    return res.redirect("/waiting/"+student.studentId)
  }

  return res.redirect("/write/"+student.studentId)

})

/* 대기 화면 */

app.get("/waiting/:id",(req,res)=>{

  const id=req.params.id

  res.render("waiting",{
    studentId:id,
    studentName:req.session.studentName
  })

})

/* 글쓰기 화면 */

app.get("/write/:id",(req,res)=>{

  const id=req.params.id
  const studentClass=req.session.studentClass

  const config=readJSON("config.json")
  const classConfig=config.classes?.[studentClass]

  if(!classConfig || !classConfig.started){
    return res.send("현재 글 작성이 시작되지 않았습니다.")
  }

  const submissions=readJSON("submissions.json")
  const sub=submissions[id]

  if(sub && sub.submitted){
    return res.redirect("/result/"+id)
  }

  res.render("write",{
    studentName:req.session.studentName,
    studentId:id,
    topic:classConfig.topic,
    minChars:classConfig.minChars
  })

})

/* 자동 저장 */

app.post("/save",(req,res)=>{

  const {studentId,text}=req.body

  const submissions=readJSON("submissions.json")

  if(!submissions[studentId]){
    submissions[studentId]={}
  }

  submissions[studentId].text=text

  writeJSON("submissions.json",submissions)

  res.send({ok:true})

})

/* 제출 */

app.post("/submit",(req,res)=>{

  const {studentId,text}=req.body

  const submissions=readJSON("submissions.json")

  if(!submissions[studentId]){
    submissions[studentId]={}
  }

  submissions[studentId].text=text
  submissions[studentId].submitted=true

  writeJSON("submissions.json",submissions)

  res.send({ok:true})

})

/* 결과 */

app.get("/result/:id",(req,res)=>{

  const id=req.params.id

  const submissions=readJSON("submissions.json")

  const sub=submissions[id] || {}

  res.render("result",{
    text:sub.text || "",
    comment:sub.comment || ""
  })

})

/* 관리자 로그인 */

app.get("/admin-login",(req,res)=>{
  res.render("admin-login")
})

app.post("/admin-login",(req,res)=>{

  const {id,password}=req.body

  const admins=readJSON("admins.json")

  const admin=admins.find(
    a=>a.id===id && a.password===password
  )

  if(!admin){
    return res.send("로그인 실패")
  }

  req.session.admin=true
  req.session.adminId=admin.id
  req.session.adminName=admin.name
  req.session.adminRole=admin.role

  res.redirect("/admin")

})

/* 관리자 페이지 */

app.get("/admin",requireAdmin,(req,res)=>{

  const students=readJSON("students.json")
  const submissions=readJSON("submissions.json")
  const config=readJSON("config.json")

  const classList=[...new Set(students.map(s=>s.class))]

  const approvalCount=students.filter(s=>{
    const sub=submissions[s.studentId] || {}
    return sub.approvalRequested===true
  }).length

  res.render("admin",{
    students,
    submissions,
    config,
    classList,
    adminName:req.session.adminName,
    adminId:req.session.adminId,
    adminRole:req.session.adminRole,
    approvalCount
  })

})

/* 분반 시작 */

app.post("/startClass",(req,res)=>{

  const {className}=req.body

  const config=readJSON("config.json")

  if(!config.classes){
    config.classes={}
  }

  if(!config.classes[className]){
    config.classes[className]={}
  }

  config.classes[className].started=true

  writeJSON("config.json",config)

  res.redirect("/admin")

})

/* 분반 종료 */

app.post("/stopClass",(req,res)=>{

  const {className}=req.body

  const config=readJSON("config.json")

  if(config.classes?.[className]){
    config.classes[className].started=false
  }

  writeJSON("config.json",config)

  res.redirect("/admin")

})

/* 관리자 로그아웃 */

app.get("/logout",(req,res)=>{
  req.session.destroy(()=>{
    res.redirect("/admin-login")
  })
})

app.listen(PORT,()=>{
  console.log("server running on port "+PORT)
})