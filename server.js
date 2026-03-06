const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

let currentUser = null;

// 파일 경로
const studentsPath = path.join(__dirname, 'students.json');
const submissionsPath = path.join(__dirname, 'submissions.json');
const configPath = path.join(__dirname, 'config.json');

// 데이터 로드
let students = fs.existsSync(studentsPath) ? JSON.parse(fs.readFileSync(studentsPath)) : [];
let submissions = fs.existsSync(submissionsPath) ? JSON.parse(fs.readFileSync(submissionsPath)) : [];

let config = {
  title: "글쓰기 시험",
  topic: "주제를 입력하세요",
  minChars: 500
};

if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath));
}

// 로그인 페이지
app.get('/login', (req, res) => {
  res.render('login', { title: config.title });
});

// 로그인 처리
app.post('/login', (req, res) => {

  const { name, studentId } = req.body;

  const student = students.find(s =>
    s.name === name && s.studentId === studentId
  );

  if (!student) {
    return res.send("명단에 없습니다.");
  }

  currentUser = student;

  res.redirect('/write');
});

// 글쓰기 페이지
app.get('/write', (req, res) => {

  if (!currentUser) {
    return res.redirect('/login');
  }

  const existing = submissions.find(s =>
    s.studentId === currentUser.studentId
  );

  res.render('write', {
    user: currentUser,
    config,
    submission: existing
  });
});

// 자동 저장
app.post('/autosave', (req, res) => {

  if (!currentUser) return res.sendStatus(401);

  const { content } = req.body;

  let sub = submissions.find(s => s.studentId === currentUser.studentId);

  if (!sub) {
    sub = {
      name: currentUser.name,
      studentId: currentUser.studentId,
      class: currentUser.class,
      content: "",
      comment: "",
      submitted: false
    };
    submissions.push(sub);
  }

  if (!sub.submitted) {
    sub.content = content;
  }

  fs.writeFileSync(submissionsPath, JSON.stringify(submissions, null, 2));

  res.sendStatus(200);
});

// 제출
app.post('/submit', (req, res) => {

  if (!currentUser) return res.redirect('/login');

  const { content } = req.body;

  const clean = content.replace(/\s/g, "");

  if (clean.length < config.minChars) {
    return res.send("최소 글자수 미달입니다.");
  }

  let sub = submissions.find(s => s.studentId === currentUser.studentId);

  if (!sub) {
    sub = {
      name: currentUser.name,
      studentId: currentUser.studentId,
      class: currentUser.class,
      comment: ""
    };
    submissions.push(sub);
  }

  sub.content = content;
  sub.submitted = true;
  sub.date = new Date().toLocaleString();

  fs.writeFileSync(submissionsPath, JSON.stringify(submissions, null, 2));

  res.render('result');
});

// 관리자 페이지
app.get('/admin', (req, res) => {

  res.render('admin', {
    submissions,
    config
  });
});

// 관리자 코멘트
app.post('/comment', (req, res) => {

  const { studentId, comment } = req.body;

  const sub = submissions.find(s => s.studentId === studentId);

  if (sub) {
    sub.comment = comment;
  }

  fs.writeFileSync(submissionsPath, JSON.stringify(submissions, null, 2));

  res.redirect('/admin');
});

// 설정 저장
app.post('/config', (req, res) => {

  config.topic = req.body.topic;
  config.minChars = parseInt(req.body.minChars);

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});