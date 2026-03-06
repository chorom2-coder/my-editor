const express = require("express")
const fs = require("fs")
const bodyParser = require("body-parser")
const session = require("express-session")

const app = express()
const PORT = process.env.PORT || 3000

app.set("view engine","ejs")
app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json())
app.use(express.static("public"))
app.use(session({
 secret:"exam-secret",
 resave:false,
 saveUninitialized:true
}))

function readJSON(file){
 if(!fs.existsSync(file)) return {}
 return JSON.parse(fs.readFileSync(file))
}

function writeJSON(file,data){
 fs.writeFileSync(file,JSON.stringify(data,null,2))
}

app.get("/",(req,res)=>{
 res.redirect("/login")
})

app.get("/login",(req,res)=>{
 res.render("login")
})

app.post("/login",(req,res)=>{

 const {name,id,password} = req.body

 const admins = readJSON("admins.json")

 const admin = admins.find(a=>a.id===id && a.password===password)

 if(admin){
  return res.redirect("/admin")
 }

 const students = readJSON("students.json")

 const student = students.find(s=>s.studentId===id && s.name===name)

 if(!student){
  return res.send("학생 정보 없음")
 }

 let submissions = readJSON("submissions.json")

 if(!submissions[id]){
  submissions[id] = {
   name:name,
   text:"",
   submitted:false,
   comment:""
  }
 }

 writeJSON("submissions.json",submissions)

 res.redirect("/waiting/"+id)

})

app.get("/waiting/:id",(req,res)=>{

 const config = readJSON("config.json")

 if(config.examStarted){
  return res.redirect("/write/"+req.params.id)
 }

 res.send(`
 <h2>대기중입니다</h2>
 <script>
 setInterval(()=>{
  location.reload()
 },3000)
 </script>
 `)

})

app.get("/write/:id",(req,res)=>{

 const id = req.params.id
 const submissions = readJSON("submissions.json")
 const config = readJSON("config.json")

 res.render("write",{
  id,
  topic:config.topic,
  minChars:config.minChars,
  text:submissions[id]?.text || ""
 })

})

app.post("/autosave",(req,res)=>{

 const {id,text} = req.body

 const submissions = readJSON("submissions.json")

 if(submissions[id]?.submitted){
  return res.json({ok:false})
 }

 submissions[id].text = text

 writeJSON("submissions.json",submissions)

 res.json({ok:true})

})

app.post("/submit",(req,res)=>{

 const {id,text} = req.body
 const config = readJSON("config.json")

 const count = text.replace(/\s/g,"").length

 if(count < config.minChars){
  return res.json({ok:false,msg:"글자수가 부족합니다"})
 }

 const submissions = readJSON("submissions.json")

 submissions[id].text = text
 submissions[id].submitted = true

 writeJSON("submissions.json",submissions)

 res.json({ok:true})

})

app.get("/admin",(req,res)=>{
if(!req.session.admin){
 return res.redirect("/admin-login")
}
 const students = readJSON("students.json")
 const submissions = readJSON("submissions.json")
 const config = readJSON("config.json")

 res.render("admin",{students,submissions,config})

})

app.get("/admin-login",(req,res)=>{
 res.render("admin-login")
})

app.post("/admin-login",(req,res)=>{

 const {id,password} = req.body

 const admins = readJSON("admins.json")

 const admin = admins.find(a=>a.id===id && a.password===password)

 if(!admin){
  return res.send("관리자 로그인 실패")
 }
req.session.admin = true
 res.redirect("/admin")

})



app.post("/addStudents",(req,res)=>{

 const list = req.body.list

 let students = readJSON("students.json")

 const lines = list.split("\n")

 lines.forEach(line=>{

  const parts = line.split(",")

  if(parts.length >= 2){

   const name = parts[0].trim()
   const studentId = parts[1].trim()

   students.push({
    name,
    studentId
   })

  }

 })

 writeJSON("students.json",students)

 res.redirect("/admin")

})

app.post("/setTopic",(req,res)=>{

 const {topic,minChars} = req.body

 writeJSON("config.json",{
  topic,
  minChars:Number(minChars),
  examStarted:false
 })

 res.redirect("/admin")

})

app.post("/startExam",(req,res)=>{

 const config = readJSON("config.json")

 config.examStarted = true

 writeJSON("config.json",config)

 res.redirect("/admin")

})

app.listen(PORT,()=>{
 console.log("server running")
})
