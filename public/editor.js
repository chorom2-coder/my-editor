const editor = document.getElementById("editor")

function count(){

let text = editor.value

document.getElementById("withSpace").innerText = text.length
document.getElementById("withoutSpace").innerText =
text.replace(/\s/g,"").length

}

editor.addEventListener("input",count)

function save(){

fetch("/autosave",{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
id,
text:editor.value
})
})

alert("임시저장 완료")

}

function submitExam(){

let text = editor.value
let count = text.replace(/\s/g,"").length

if(count < minChars){

alert("최소 "+minChars+"자 이상 작성해야 합니다")

return

}

fetch("/submit",{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
id,
text
})
}).then(r=>r.json()).then(d=>{

if(d.ok){
alert("제출 완료")
location.reload()
}else{
alert(d.msg)
}

})

}

setInterval(save,10000)

document.addEventListener("copy",e=>e.preventDefault())
document.addEventListener("paste",e=>e.preventDefault())

document.addEventListener("visibilitychange",()=>{

if(document.hidden){
alert("외부창 감지")
}

})