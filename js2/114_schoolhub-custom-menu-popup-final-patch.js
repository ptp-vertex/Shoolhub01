
(function(){
  if(window.__schoolhubCustomMenuPopupFinalPatch) return;
  window.__schoolhubCustomMenuPopupFinalPatch = true;

  var lastVisibleViewId = null;

  function getView(){ return document.getElementById('schoolhub-custom-menu-user-view'); }

  function closePopup(){
    var view = getView();
    if(!view) return;
    view.classList.add('hidden');
    view.classList.remove('shcm-popup-mode');
    document.body.classList.remove('schoolhub-custom-menu-popup-open');
    if(lastVisibleViewId){
      document.querySelectorAll('.view-section').forEach(function(v){ v.classList.add('hidden'); });
      var prev = document.getElementById(lastVisibleViewId);
      if(prev) prev.classList.remove('hidden');
      lastVisibleViewId = null;
    }
  }
  window.closeCustomMenuUserPopup = closePopup;

  function ensureChrome(){
    var view = getView();
    if(!view) return;
    var panel = view.querySelector(':scope > div');
    if(!panel) return;
    panel.style.position = panel.style.position || 'relative';

    // เอาปุ่ม "กลับ" ข้อความเดิมออก เหลือไว้แค่ปุ่มกากบาท (X) มุมขวาบนอย่างเดียว
    var backBtn = panel.querySelector('button[onclick*="goToHome"]');
    if(backBtn && !backBtn.dataset.shcmPopupRemoved){
      backBtn.dataset.shcmPopupRemoved = '1';
      backBtn.style.display = 'none';
    }
    // เพิ่มปุ่มปิด (X) มุมขวาบนของป็อปอัพ
    if(!panel.querySelector('#shcm-popup-close-x')){
      var x = document.createElement('button');
      x.type = 'button';
      x.id = 'shcm-popup-close-x';
      x.setAttribute('aria-label','ปิด');
      x.innerHTML = '<i class="fas fa-times"></i>';
      x.addEventListener('click', function(e){ e.preventDefault(); closePopup(); });
      panel.appendChild(x);
    }
  }

  function wrapUserOpen(){
    var fn = window.openCustomMenuUser;
    if(typeof fn !== 'function' || fn.__shcmPopupFinal) return;
    var original = fn;
    var wrapped = function(id){
      var visible = document.querySelector('.view-section:not(.hidden)');
      if(visible && visible.id !== 'schoolhub-custom-menu-user-view') lastVisibleViewId = visible.id;
      var r = original.apply(this, arguments);
      var view = getView();
      if(view){
        view.classList.remove('hidden');
        view.classList.add('shcm-popup-mode');
        document.body.classList.add('schoolhub-custom-menu-popup-open');
        ensureChrome();
      }
      return r;
    };
    wrapped.__shcmPopupFinal = true;
    // ตั้งค่า flag เดิมไว้ด้วย กันสคริปต์แพตช์รุ่นก่อนหน้าห่อฟังก์ชันนี้ซ้ำวนไม่รู้จบ
    wrapped.__safeFramePatchWrapped = true;
    window.openCustomMenuUser = wrapped;
  }

  document.addEventListener('click', function(e){
    var view = getView();
    if(view && view.classList.contains('shcm-popup-mode') && e.target === view){ closePopup(); }
  }, true);
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      var view = getView();
      if(view && view.classList.contains('shcm-popup-mode')) closePopup();
    }
  });

  var tries = 0;
  var iv = setInterval(function(){
    wrapUserOpen();
    tries++;
    if(tries > 60) clearInterval(iv);
  }, 1000);
  document.addEventListener('DOMContentLoaded', wrapUserOpen);
  wrapUserOpen();
})();
