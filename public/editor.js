const editor = document.getElementById("editor");

function updateCount(){

const text = editor.value;
const noSpace = text.replace(/\s/g,'');

document.getElementById("count").innerText = text.length;
document.getElementById("count2").innerText = noSpace.length;

}

editor.addEventListener("input",updateCount);

/* 자동저장 */

setInterval(()=>{

fetch("/autosave",{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
content:editor.value
})
})

},30000)

/* 제출 확인 */

function confirmSubmit(){
return confirm("제출 후 수정할 수 없습니다. 제출하시겠습니까?");
}

/* 복사 붙여넣기 차단 */

document.addEventListener("copy",e=>{
alert("복사는 허용되지 않습니다.");
e.preventDefault();
});

document.addEventListener("paste",e=>{
alert("붙여넣기는 허용되지 않습니다.");
e.preventDefault();
});

/* 우클릭 차단 */

document.addEventListener("contextmenu",e=>{
e.preventDefault();
});

/* 외부창 탐지 */

let warningCount = 0;

window.addEventListener("blur",()=>{

warningCount++;

if(warningCount===1){

alert("경고: 시험 중 다른 창으로 이동했습니다.");

}

if(warningCount>=2){

alert("시험 입력이 1분간 잠깁니다.");

editor.disabled = true;

setTimeout(()=>{

editor.disabled = false;

},60000);

}

});