
(function(){
  if(window.__schoolhubTeamBoxOpenWithoutPopupFix) return;
  window.__schoolhubTeamBoxOpenWithoutPopupFix = true;

  function removeInvitePopup(){
    var p=document.getElementById('schoolhub-team-invite-popup');
    if(p) p.remove();
  }
  function runTeamCheck(delay){
    setTimeout(function(){
      removeInvitePopup();
      try{
        var view=document.getElementById('view-user-plans');
        if(view && view.classList.contains('hidden')) return;
        if(typeof window.schoolhubEnsureTeamBox === 'function') window.schoolhubEnsureTeamBox();
      }catch(e){}
    }, delay||0);
  }
  function wrap(name){
    var old=window[name];
    if(typeof old !== 'function' || old.__teamBoxOpenNoPopupWrapped) return;
    window[name]=function(){
      var r=old.apply(this, arguments);
      runTeamCheck(0);
      runTeamCheck(250);
      runTeamCheck(900);
      return r;
    };
    window[name].__teamBoxOpenNoPopupWrapped=true;
  }
  function install(){
    wrap('openUserPlanSelector');
    var oldSwitch=window.switchView;
    if(typeof oldSwitch === 'function' && !oldSwitch.__teamBoxOpenNoPopupWrapped){
      window.switchView=function(viewId){
        var r=oldSwitch.apply(this, arguments);
        if(viewId==='user-plans'){
          runTeamCheck(0);
          runTeamCheck(250);
          runTeamCheck(900);
        }
        return r;
      };
      window.switchView.__teamBoxOpenNoPopupWrapped=true;
    }
    runTeamCheck(800);
  }
  document.addEventListener('DOMContentLoaded', function(){ install(); setTimeout(install,500); setTimeout(install,1500); });
  document.addEventListener('click', function(e){
    var t=e.target && e.target.closest && e.target.closest('[onclick*="openUserPlanSelector"],[data-target="user-plans"],[onclick*="user-plans"]');
    if(t){ runTeamCheck(80); runTeamCheck(600); }
    removeInvitePopup();
  }, true);
})();
