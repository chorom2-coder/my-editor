const editor = document.getElementById("editor");

function updateCount(){

const text = editor.value;

const noSpace = text.replace(/\s/g,'');

document.getElementById("count").innerText = text.length;

document.getElementById("count2").innerText = noSpace.length;

}

editor.addEventListener("input",updateCount);

setInterval(()=>{

fetch("/autosave",{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
content:editor.value
})
})

},30000)

function confirmSubmit(){

return confirm("제출 후 수정할 수 없습니다. 제출하시겠습니까?")

}