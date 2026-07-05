
(function(){
  if(window.__schoolhubMobileMenuAsPopupFix) return;
  window.__schoolhubMobileMenuAsPopupFix = true;
  function fixMobileMenuLayout(){
    var menu = document.getElementById('mobile-menu');
    if(!menu) return;
    menu.classList.remove('justify-end');
    menu.classList.add('items-center','justify-center');
    var box = menu.querySelector(':scope > div');
    if(box){
      box.classList.remove('w-4/5','max-w-sm','h-full','animate-fadeInRight');
      box.classList.add('max-h-[85vh]','rounded-[2rem]','overflow-hidden');
    }
  }
  var oldToggle = window.toggleMobileMenu;
  if(typeof oldToggle === 'function' && !oldToggle.__schoolhubMobileMenuAsPopupFixWrapped){
    var wrapped = function(){
      var r = oldToggle.apply(this, arguments);
      fixMobileMenuLayout();
      return r;
    };
    wrapped.__schoolhubMobileMenuAsPopupFixWrapped = true;
    window.toggleMobileMenu = wrapped;
  }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(fixMobileMenuLayout, 0); });
  fixMobileMenuLayout();
})();
