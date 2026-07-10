
(function(){
  if(window.__schoolhubMenuScrollFinalFix) return;
  window.__schoolhubMenuScrollFinalFix = true;

  function unlockPageScrollIfNoModal(){
    try{
      var anyOpenModal = Array.from(document.querySelectorAll(
        '#custom-alert:not(.hidden),#custom-confirm:not(.hidden),#mobile-menu:not(.hidden),#admin-plan-popup-backdrop:not(.hidden),#schoolhub-plan-rights-popup-backdrop:not(.hidden),.fixed.inset-0:not(.hidden)'
      )).some(function(el){
        if(!el) return false;
        var id = el.id || '';
        // mobile-menu เป็นเมนูเอง ไม่ต้องปลด body ตอนเปิดเมนู
        if(id === 'mobile-menu') return true;
        return getComputedStyle(el).display !== 'none';
      });

      if(!anyOpenModal){
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    }catch(e){}
  }

  function fixDesktopSidebar(){
    try{
      document.querySelectorAll('#main-app > aside, aside').forEach(function(aside){
        aside.style.height = '100dvh';
        aside.style.maxHeight = '100dvh';
        aside.style.overflow = 'hidden';
        aside.style.display = 'flex';
        aside.style.flexDirection = 'column';

        var nav = aside.querySelector('nav');
        if(nav){
          nav.style.flex = '1 1 auto';
          nav.style.minHeight = '0';
          nav.style.overflowY = 'auto';
          nav.style.overflowX = 'hidden';
          nav.style.webkitOverflowScrolling = 'touch';
          nav.style.paddingBottom = '1rem';
        }
      });

      var mobilePanel = document.querySelector('#mobile-menu > div');
      if(mobilePanel){
        mobilePanel.style.maxHeight = '100dvh';
        mobilePanel.style.overflowY = 'auto';
        mobilePanel.style.overflowX = 'hidden';
        mobilePanel.style.webkitOverflowScrolling = 'touch';
      }
    }catch(e){}
  }

  function run(){
    fixDesktopSidebar();
    unlockPageScrollIfNoModal();
  }

  document.addEventListener('DOMContentLoaded', function(){
    run();
    setTimeout(run,300);
    setTimeout(run,1000);
  });
  document.addEventListener('click', function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(run,120); }, true);
  window.addEventListener('resize', function(){ setTimeout(run,80); });
  // Performance: removed polling; scroll state is refreshed on DOMContentLoaded/click/resize.
})();
