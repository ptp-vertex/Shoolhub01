
(function(){
  if(window.__schoolhubCustomMenuPopupFinalPatch) return;
  window.__schoolhubCustomMenuPopupFinalPatch = true;

  var lastVisibleViewId = null;

  function getView(){ return document.getElementById('schoolhub-custom-menu-user-view'); }

  function closePopup(){
    var view = getView();
    if(!view) return;
    view.classList.add('hidden');
    // หมายเหตุ: ไม่ถอดคลาส shcm-popup-mode ออกอีกต่อไป — คลาสนี้ถูกฝังไว้ถาวรใน HTML
    // ตั้งแต่สร้าง (js1/064) เพื่อให้ทุกครั้งที่เปิดเมนูนี้แสดงเป็นป็อปอัพเสมอ ไม่มีจังหวะ
    // ที่หน้าขาวเต็มจอ (ไม่ใช่ป็อปอัพ) โผล่มาก่อน ไม่ว่าสคริปต์นี้จะโหลด/ทำงานทันเวลาหรือไม่
    document.body.classList.remove('schoolhub-custom-menu-popup-open');
    view.classList.remove('sh-menu-maximized');
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

  function afterOpen(){
    var view = getView();
    if(!view) return;
    view.classList.remove('hidden');
    document.body.classList.add('schoolhub-custom-menu-popup-open');
    ensureChrome();
  }

  // ห่อฟังก์ชัน window.openCustomMenuUser แบบทันที ไม่ต้องรอ setInterval/DOMContentLoaded
  // ซึ่งเคยทำให้การคลิกเปิดเมนูครั้งแรกสุด (ก่อนสคริปต์นี้ห่อฟังก์ชันทัน) ไปเรียกฟังก์ชันดิบ
  // (ยังไม่ถูกห่อ) แล้วโชว์เป็นหน้าเปล่าแบบเต็มพื้นที่แทนที่จะเป็นป็อปอัพ — ใช้ getter/setter
  // ดักจับตอนที่ js1/064 (ซึ่งเป็น module โหลดช้ากว่า) กำหนดค่าฟังก์ชันนี้ ไม่ว่าจะช้าแค่ไหน
  var realOpenFn = (typeof window.openCustomMenuUser === 'function') ? window.openCustomMenuUser : null;

  function wrapped(id){
    var visible = document.querySelector('.view-section:not(.hidden)');
    if(visible && visible.id !== 'schoolhub-custom-menu-user-view') lastVisibleViewId = visible.id;
    var r = realOpenFn ? realOpenFn.apply(this, arguments) : undefined;
    afterOpen();
    return r;
  }
  wrapped.__shcmPopupFinal = true;
  wrapped.__safeFramePatchWrapped = true;

  try {
    Object.defineProperty(window, 'openCustomMenuUser', {
      configurable: true,
      enumerable: true,
      get: function(){ return wrapped; },
      set: function(fn){
        if(typeof fn === 'function' && !fn.__shcmPopupFinal) realOpenFn = fn;
      }
    });
  } catch(e) {
    // เผื่อ environment ไม่รองรับ defineProperty บน window (ไม่น่าเกิดในเบราว์เซอร์จริง)
    window.openCustomMenuUser = wrapped;
  }

  document.addEventListener('click', function(e){
    var view = getView();
    if(view && !view.classList.contains('hidden') && e.target === view){ closePopup(); }
  }, true);
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      var view = getView();
      if(view && !view.classList.contains('hidden')) closePopup();
    }
  });
})();
