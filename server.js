const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let isLoggedIn = false;

// Static & view engine
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Load config
const configPath = path.join(__dirname, 'config.json');
let config = { title: "글쓰기 진단평가" };
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

// Load or init data.json
const dataPath = path.join(__dirname, 'data.json');
let submissions = [];
if (fs.existsSync(dataPath)) {
  submissions = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} else {
  fs.writeFileSync(dataPath, JSON.stringify(submissions, null, 2));
}

// 로그인 페이지
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// 로그인 처리
let currentUser = null;

app.post('/login', (req, res) => {
  const { name, studentId } = req.body;

  currentUser = {
    name,
    studentId
  };

  isLoggedIn = true;

  res.redirect('/');
});

// 글쓰기 페이지
app.get('/', (req, res) => {
  if (!isLoggedIn) {
    return res.redirect('/login');
  }

  res.render('index', { title: config.title });
});

// 글 제출
app.post('/submit', (req, res) => {
  if (!isLoggedIn) {
    return res.redirect('/login');
  }

  const content = req.body.content || '';

  const entry = {
    name: currentUser.name,
    studentId: currentUser.studentId,
    content,
    date: new Date().toLocaleString()
  };

  submissions.push(entry);
  fs.writeFileSync(dataPath, JSON.stringify(submissions, null, 2));

  res.send('제출 완료!');
});

// 관리자 페이지
app.get('/admin', (req, res) => {
  if (!isLoggedIn) {
    return res.redirect('/login');
  }

  res.render('admin', { submissions });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});