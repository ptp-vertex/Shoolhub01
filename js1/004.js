
document.addEventListener('click',function(){
 setTimeout(function(){
   var el=document.getElementById('schoolhub-mini-calendar-backdrop');
   if(el && el.parentElement!==document.body){
      document.body.appendChild(el);
   }
 },50);
});
