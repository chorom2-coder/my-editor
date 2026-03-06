const editor = document.getElementById("editor")

function count(){

 let text = editor.value

 document.getElementById("withSpace").innerText = text.length
 document.getElementById("withoutSpace").innerText =
 text.replace(/\s/g,"").length

}

editor.addEventListener("input",count)

count()

function autoSave(){

 fetch("/autosave",{

  method:"POST",

  headers:{'Content-Type':'application/json'},

  body:JSON.stringify({

   id,

   text:editor.value

  })

 })

}

function manualSave(){

 fetch("/autosave",{

  method:"POST",

  headers:{'Content-Type':'application/json'},

  body:JSON.stringify({

   id,

   text:editor.value

  })

 })

 .then(res=>res.json())

 .then(data=>{

  if(data.ok){

   alert("임시저장 완료")

  }else{

   alert("저장 실패")

  }

 })

}

function submitExam(){

 let text = editor.value

 let charCount = text.replace(/\s/g,"").length

 if(charCount < minChars){

  alert("최소 "+minChars+"자 이상 작성해야 합니다")

  return

 }

 const ok = confirm("제출하면 수정할 수 없습니다. 제출하시겠습니까?")

 if(!ok) return

 fetch("/submit",{

  method:"POST",

  headers:{'Content-Type':'application/json'},

  body:JSON.stringify({

   id,

   text

  })

 })

 .then(r=>r.json())

 .then(d=>{

  if(d.ok){

   alert("제출 완료")

   location.reload()

  }else{

   alert(d.msg)

  }

 })

}

setInterval(autoSave,60000)

document.addEventListener("copy",e=>e.preventDefault())

document.addEventListener("paste",e=>e.preventDefault())

document.addEventListener("cut",e=>e.preventDefault())

document.addEventListener("visibilitychange",()=>{

 if(document.hidden){

  alert("외부창 사용이 감지되었습니다")

 }

})