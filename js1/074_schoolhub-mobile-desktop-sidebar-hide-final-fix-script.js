
(function(){
  if(window.__schoolhubMobileDesktopSidebarHideFinalFix) return;
  window.__schoolhubMobileDesktopSidebarHideFinalFix = true;

  function isMobile(){
    return window.matchMedia && window.matchMedia('(max-width:767px)').matches;
  }

  function fixSidebarMode(){
    try{
      document.querySelectorAll('#main-app > aside').forEach(function(aside){
        if(isMobile()){
          aside.style.setProperty('display','none','important');
          aside.style.setProperty('visibility','hidden','important');
          aside.style.setProperty('opacity','0','important');
          aside.style.setProperty('pointer-events','none','important');
          aside.style.setProperty('width','0','important');
          aside.style.setProperty('min-width','0','important');
          aside.style.setProperty('max-width','0','important');
          aside.style.setProperty('height','0','important');
          aside.style.setProperty('overflow','hidden','important');
          aside.style.setProperty('flex','0 0 0','important');
        }else{
          aside.style.setProperty('display','flex','important');
          aside.style.setProperty('visibility','visible','important');
          aside.style.setProperty('opacity','1','important');
          aside.style.setProperty('pointer-events','auto','important');
          aside.style.removeProperty('width');
          aside.style.removeProperty('min-width');
          aside.style.removeProperty('max-width');
          aside.style.removeProperty('height');
          aside.style.setProperty('overflow','hidden','important');
          aside.style.setProperty('flex-direction','column','important');

          var nav = aside.querySelector('nav');
          if(nav){
            nav.style.setProperty('flex','1 1 auto','important');
            nav.style.setProperty('min-height','0','important');
            nav.style.setProperty('overflow-y','auto','important');
            nav.style.setProperty('overflow-x','hidden','important');
          }
        }
      });

      var main = document.querySelector('#main-app main');
      if(main && isMobile()){
        main.style.setProperty('width','100vw','important');
        main.style.setProperty('max-width','100vw','important');
        main.style.setProperty('margin-left','0','important');
      }
    }catch(e){}
  }

  var oldFixDesktopSidebar = window.fixDesktopSidebar;
  if(typeof oldFixDesktopSidebar === 'function' && !oldFixDesktopSidebar.__mobileSafeWrapped){
    window.fixDesktopSidebar = function(){
      if(!isMobile()) return oldFixDesktopSidebar.apply(this, arguments);
      fixSidebarMode();
    };
    window.fixDesktopSidebar.__mobileSafeWrapped = true;
  }

  document.addEventListener('DOMContentLoaded', function(){
    fixSidebarMode();
    setTimeout(fixSidebarMode,100);
    setTimeout(fixSidebarMode,500);
    setTimeout(fixSidebarMode,1200);
  });

  document.addEventListener('click', function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(fixSidebarMode,80); }, true);
  window.addEventListener('resize', function(){ setTimeout(fixSidebarMode,60); });
  window.addEventListener('orientationchange', function(){ setTimeout(fixSidebarMode,120); });
  // Performance: removed polling; sidebar mode refreshes on DOMContentLoaded/click/resize/orientationchange.

  window.schoolhubFixMobileSidebarNow = fixSidebarMode;
})();
