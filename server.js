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

// 간단 로그인 상태 변수
let isLoggedIn = false;

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
app.post('/login', (req, res) => {
  const { id, pw } = req.body;

  if (id === 'admin' && pw === 'test') {
    isLoggedIn = true;
    res.redirect('/');
  } else {
    res.render('login', { error: 'ID 또는 PW가 틀렸습니다.' });
  }
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
<<<<<<< HEAD
  const entry = {
    content,
    date: new Date().toLocaleString()
  };
=======
  const entry = { content, date: new Date().toLocaleString() };
>>>>>>> dbfcb2bb5ac689bfd01c80f96e6d58ac8ef0a1be

  submissions.push(entry);
  fs.writeFileSync(dataPath, JSON.stringify(submissions, null, 2));

  res.send('제출 완료!');
});

// 관리자 페이지
app.get('/admin', (req, res) => {
  if (!isLoggedIn) {
    return res.redirect('/login');
  }
<<<<<<< HEAD

  res.render('admin', { submissions });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
=======
  res.render('admin', { submissions });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
>>>>>>> dbfcb2bb5ac689bfd01c80f96e6d58ac8ef0a1be
