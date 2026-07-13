
(function(){
  if(window.__schoolhubModalInstantLoaderPatched) return;
  window.__schoolhubModalInstantLoaderPatched = true;

  var MIN_SHOW_MS = 250;
  var SAFETY_MS   = 6000;

  // ปัญหาที่เจอมาแล้ว 2 รอบ และวิธีแก้สุดท้ายที่ใช้อยู่ตอนนี้:
  //
  // รอบ 1: แทรกสปินเนอร์เป็น "ลูกตัวแรก" ของ modal (insertBefore ... modal.firstChild)
  //   -> window.openModal ต้นฉบับ (007.js) มีโค้ด `const box = m.children[0];` ที่สมมติว่าลูกตัวแรก
  //      คือกล่องป็อปอัพเสมอ แล้วใส่ class scale-95/opacity-0 + transition ให้ตัวนั้น
  //      พอสปินเนอร์แซงมาเป็น children[0] แทน เลยโดนใส่ class เข้าฉากผิดตัว ทำให้สปินเนอร์เพี้ยน
  //
  // รอบ 2: ย้ายสปินเนอร์ออกไปต่อกับ document.body แยกจาก modal ไปเลย เพื่อเลี่ยงปัญหารอบ 1
  //   -> แต่ modal มี backdrop-blur (เบลอ/มืดพื้นหลัง) ของตัวเอง ซึ่ง blur จะบังทุกอย่างที่อยู่
  //      "ข้างหลัง/ใต้" มันในลำดับการวาดภาพ พอสปินเนอร์อยู่นอก modal มันเลยโดนเบลอจนมองไม่เห็น
  //
  // วิธีแก้สุดท้าย: แทรกสปินเนอร์กลับเข้าไปเป็นลูกของ modal เหมือนเดิม (จะได้ไม่โดน backdrop-blur บัง)
  // แต่แทรกเป็น "ลูกตัวสุดท้าย" (ท้ายสุด ไม่ใช่ตัวแรก) เพื่อไม่ให้กระทบ modal.children[0] ที่โค้ด
  // openModal ต้นฉบับใช้อ้างอิงกล่องป็อปอัพ แล้วบังคับกล่องป็อปอัพให้มี z-index สูงกว่าสปินเนอร์ตรงๆ
  // ผ่าน JS (ensureBoxAboveSpinner) แทนการพึ่ง CSS sibling-selector ซึ่งเปราะบางถ้าลำดับ DOM เปลี่ยน

  function getModalBox(modal){
    if(!modal) return null;
    for(var i=0;i<modal.children.length;i++){
      var c = modal.children[i];
      if(c.nodeType === 1 && !c.classList.contains('schoolhub-modal-mini-spinner')) return c;
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

  // บังคับให้กล่องป็อปอัพจริง (children[0] ของ modal) ลอยอยู่เหนือสปินเนอร์เสมอด้วย z-index ที่ชัดเจน
  // ผ่าน JS ตรงๆ (ไม่พึ่ง CSS sibling-selector ซึ่งพังง่ายถ้าลำดับ DOM เปลี่ยน)
  function ensureBoxAboveSpinner(box){
    if(!box) return;
    var cs;
    try{ cs = getComputedStyle(box); }catch(e){ cs = null; }
    if(!box.style.position && (!cs || cs.position === 'static')) box.style.position = 'relative';
    var curZ = parseInt((cs && cs.zIndex) || box.style.zIndex, 10);
    if(isNaN(curZ) || curZ < 1) box.style.zIndex = '1';
  }

  function showSpinner(modal){
    if(!modal) return;
    if(modal.__schoolhubSpinnerEl && modal.contains(modal.__schoolhubSpinnerEl)) return;

    var sp = document.createElement('div');
    sp.className = 'schoolhub-modal-mini-spinner';
    // สำคัญ: บังคับ position/inset ผ่าน inline style (cssText + !important) โดยตรง แทนที่จะพึ่ง
    // css/096 อย่างเดียว เพราะ modal บางตัว (plan-modal, plan-payment-modal, slip-result-popup,
    // grade-criteria-modal) มี CSS patch อื่นที่ไป match selector "> div" ของลูกโดยไม่ได้ตั้งใจ
    // แล้วทับ position:absolute ของสปินเนอร์ด้วย specificity/ลำดับไฟล์ที่สูงกว่า ทำให้สปินเนอร์
    // กลายเป็น flex item ธรรมดาที่เบียดไปข้างๆกล่องป็อปอัพแทนที่จะคลุมเต็ม modal อย่างที่ควรเป็น
    // การตั้ง inline style ตรงนี้จะชนะทุก external stylesheet เสมอ
    sp.style.cssText = 'position:absolute!important;inset:0!important;top:0!important;left:0!important;right:0!important;bottom:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:.6rem;background:transparent;pointer-events:none;z-index:0;margin:0!important;width:auto!important;height:auto!important;max-width:none!important;max-height:none!important;';
    sp.innerHTML = '<div class="sh-spin" style="width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.28);border-top-color:#fff;animation:schoolhubSpin .6s linear infinite;"></div><span style="font-size:.78rem;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.4);">กำลังโหลด...</span>';
    // สำคัญ: ต้องอยู่ "ข้างใน" modal (ไม่ใช่ body) เพราะ modal มี backdrop-blur ของตัวเอง
    // ถ้าสปินเนอร์อยู่นอก/ข้างหลัง modal จะโดน backdrop-blur เบลอ/บังจนมองไม่เห็น
    // และต้องแทรกเป็น "ลูกตัวสุดท้าย" (ไม่ใช่ตัวแรก) เพื่อไม่ให้ modal.children[0] เพี้ยนไปเป็นสปินเนอร์
    // (โค้ด openModal ต้นฉบับใช้ children[0] อ้างอิงกล่องป็อปอัพสำหรับ animation ตอนเปิด)
    modal.appendChild(sp);
    modal.__schoolhubSpinnerEl = sp;
    ensureBoxAboveSpinner(getModalBox(modal));

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
