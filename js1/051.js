
(function(){
document.addEventListener('DOMContentLoaded',function(){
  const _signOutAndRedirect=async function(){
    try{ if(typeof clearSchoolHubLoginState === 'function') clearSchoolHubLoginState(); }catch(e){}
    try{ if(window.auth && window.firebase && firebase.auth){ await firebase.auth().signOut(); } }catch(e){}
  };
});
if(window.sendEmailVerification){
 const __old=window.sendEmailVerification;
 window.sendEmailVerification=async function(){
   const r=await __old.apply(this,arguments);
   try{
     if(typeof clearSchoolHubLoginState === 'function') clearSchoolHubLoginState();
     if(window.auth?.signOut) await window.auth.signOut();
     location.reload();
   }catch(e){}
   return r;
 }
}
const oldAllow=window.allowTeam;
window.allowTeam=function(){
 try{
   const s=(window.currentUserStatus||'');
   if(s==='declined') return false;
 }catch(e){}
 return oldAllow?oldAllow():false;
}
})();
