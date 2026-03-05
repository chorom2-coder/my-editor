const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Static & view engine
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

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

// 로그인 화면
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// 로그인 처리
app.post('/login', (req, res) => {
  const { id, pw } = req.body;
  if (id === 'admin' && pw === 'test') {
    res.redirect('/');
  } else {
    res.render('login', { error: 'ID 또는 PW가 틀렸습니다.' });
  }
});

// 글쓰기 페이지
app.get('/', (req, res) => {
  res.render('index', { title: config.title });
});

// 글 제출
app.post('/submit', (req, res) => {
  const content = req.body.content || '';
  const entry = { content, date: new Date().toLocaleString() };
  submissions.push(entry);
  fs.writeFileSync(dataPath, JSON.stringify(submissions, null, 2));
  res.send('제출 완료!');
});

// 관리자 페이지
app.get('/admin', (req, res) => {
  res.render('admin', { submissions });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));