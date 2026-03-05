const editor = document.getElementById('editor');
const charCount = document.getElementById('charCount');
const timerEl = document.getElementById('timer');
const saveBtn = document.getElementById('saveBtn');
const submitBtn = document.getElementById('submitBtn');

let seconds = 0;
setInterval(() => {
  seconds++;
  let min = String(Math.floor(seconds/60)).padStart(2,'0');
  let sec = String(seconds%60).padStart(2,'0');
  timerEl.textContent = `${min}:${sec}`;
}, 1000);

editor.addEventListener('input', () => {
  charCount.textContent = editor.value.length;
});

// 임시저장
saveBtn.addEventListener('click', () => {
  localStorage.setItem('draft', editor.value);
  alert('임시저장 완료!');
});

// 페이지 로드 시 복원
window.onload = () => {
  if (localStorage.getItem('draft')) {
    editor.value = localStorage.getItem('draft');
    charCount.textContent = editor.value.length;
  }
};

// 제출
submitBtn.addEventListener('click', () => {
  fetch('/submit', {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: `content=${encodeURIComponent(editor.value)}`
  }).then(res => res.text())
    .then(msg => alert(msg));
});