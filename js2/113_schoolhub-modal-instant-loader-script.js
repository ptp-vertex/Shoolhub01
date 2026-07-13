
(function(){
  if(window.__schoolhubModalInstantLoaderPatched) return;
  window.__schoolhubModalInstantLoaderPatched = true;

  var MIN_SHOW_MS = 250;
  var SAFETY_MS   = 6000;

  // FIX: เดิมสปินเนอร์ถูกแทรกเป็น "ลูกตัวแรก" ของ modal (modal.insertBefore(sp, modal.firstChild))
  // แต่ window.openModal ต้นฉบับ (007.js) มีโค้ด `const box = m.children[0];` สมมติว่าลูกตัวแรก
  // ของ modal คือกล่องป็อปอัพเสมอ แล้วใส่ class scale-95/opacity-0 + transition ให้ตัวนั้น
  // พอสปินเนอร์แซงมาเป็น children[0] แทน โค้ดเดิมเลยไปหยิบ "สปินเนอร์" ไปใส่ class เข้าฉากแทนกล่องจริง
  // ทำให้สปินเนอร์เพี้ยน (เล็ก/เบี้ยว/ไม่เต็มจอ) และไม่ครอบพื้นหลังเฟดดำแบบที่ควรเป็น
  //
  // วิธีแก้: ไม่แทรกสปินเนอร์เข้าไปเป็นลูกของ modal อีกต่อไป แต่ต่อเข้า document.body เป็น overlay
  // อิสระของตัวเอง (fixed inset:0 เต็มจอเสมอ ไม่ขึ้นกับโครงสร้างลูกของ modal) แล้วคุม z-index ให้อยู่
  // เหนือพื้นหลังเฟดดำของ modal แต่อยู่ใต้กล่องป็อปอัพจริงเสมอ วิธีนี้ modal.children[0] จะยังคงเป็น
  // กล่องป็อปอัพจริงเหมือนเดิมทุกกรณี ไม่ถูกรบกวน

  function getModalBox(modal){
    if(!modal) return null;
    for(var i=0;i<modal.children.length;i++){
      var c = modal.children[i];
      if(c.nodeType === 1) return c;
    }
    return null;
  }

  function hasEnoughContent(box){
    if(!box) return false;
    var textLen = (box.textContent || '').trim().length;
    if(textLen <= 30) return false;
    var rect = box.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getModalZIndex(modal){
    try{
      var z = parseInt(getComputedStyle(modal).zIndex, 10);
      if(!isNaN(z)) return z;
    }catch(e){}
    return 900000;
  }

  function showSpinner(modal){
    if(!modal) return;
    if(modal.__schoolhubSpinnerEl && document.body.contains(modal.__schoolhubSpinnerEl)) return;

    var sp = document.createElement('div');
    sp.className = 'schoolhub-modal-mini-spinner';
    sp.innerHTML = '<div class="sh-spin"></div><span>กำลังโหลด...</span>';
    var z = getModalZIndex(modal);
    // ตั้งต่ำกว่า modal 1 ระดับ: ตอน modal ยัง hidden อยู่ (ยังไม่ paint) สปินเนอร์จะเห็นเต็มจอ
    // พอ modal โผล่ขึ้นมา (พื้นหลังเฟดดำ + กล่องป็อปอัพ) จะซ้อนทับบังสปินเนอร์ไปเองตามธรรมชาติ
    sp.style.zIndex = String(z - 1);
    document.body.appendChild(sp);
    modal.__schoolhubSpinnerEl = sp;

    var shownAt = Date.now();
    var removed = false;
    var mo, safety, closeWatcher;

    function removeSpinner(force){
      if(removed) return;
      var elapsed = Date.now() - shownAt;
      if(!force && elapsed < MIN_SHOW_MS){
        setTimeout(function(){ removeSpinner(force); }, MIN_SHOW_MS - elapsed);
        return;
      }
      removed = true;
      try{ if(mo) mo.disconnect(); }catch(e){}
      try{ clearTimeout(safety); }catch(e){}
      try{ if(closeWatcher) closeWatcher.disconnect(); }catch(e){}
      sp.style.opacity = '0';
      setTimeout(function(){ try{ sp.remove(); }catch(e){} }, 150);
      if(modal.__schoolhubSpinnerEl === sp) modal.__schoolhubSpinnerEl = null;
    }

    mo = new MutationObserver(function(){
      var b = getModalBox(modal);
      if(hasEnoughContent(b)) removeSpinner(false);
    });
    try{ mo.observe(modal, {childList:true, subtree:true, characterData:true}); }catch(e){}

    safety = setTimeout(function(){ removeSpinner(true); }, SAFETY_MS);

    closeWatcher = new MutationObserver(function(){
      if(modal.classList.contains('hidden')) removeSpinner(true);
    });
    try{ closeWatcher.observe(modal, {attributes:true, attributeFilter:['class']}); }catch(e){}

    if(hasEnoughContent(getModalBox(modal))) removeSpinner(false);
  }

  function wrapOpenModalOnce(){
    var base = window.openModal;
    if(typeof base !== 'function' || base.__schoolhubModalInstantLoaderWrapped) return;
    var wrapped = function(id){
      var modal = document.getElementById(id);
      try{ if(modal) showSpinner(modal); }catch(e){}
      var r = base.apply(this, arguments);
      try{ if(modal) showSpinner(modal); }catch(e){}
      return r;
    };
    wrapped.__schoolhubModalInstantLoaderWrapped = true;
    window.openModal = wrapped;
  }

  function isOverlayBackdrop(el){
    if(!el || el.nodeType !== 1) return false;
    var cs;
    try{ cs = getComputedStyle(el); }catch(e){ return false; }
    if(cs.position !== 'fixed') return false;
    var coversScreen = cs.top === '0px' && cs.left === '0px' && cs.right === '0px' && cs.bottom === '0px';
    if(!coversScreen) return false;
    var hasBlur = cs.backdropFilter && cs.backdropFilter !== 'none';
    var hasDarkBg = /rgba?\(/.test(cs.backgroundColor) && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
    return hasBlur || hasDarkBg;
  }

  var globalWatcher = new MutationObserver(function(mutations){
    for(var i=0;i<mutations.length;i++){
      var t = mutations[i].target;
      if(!t || t.nodeType !== 1 || !t.classList) continue;
      if(!t.classList.contains('hidden') && isOverlayBackdrop(t)){
        try{ showSpinner(t); }catch(e){}
      }
    }
  });
  try{
    globalWatcher.observe(document.documentElement, {attributes:true, attributeFilter:['class'], subtree:true});
  }catch(e){}

  wrapOpenModalOnce();
  document.addEventListener('DOMContentLoaded', wrapOpenModalOnce);
  setTimeout(wrapOpenModalOnce, 0);
  setTimeout(wrapOpenModalOnce, 500);
})();
