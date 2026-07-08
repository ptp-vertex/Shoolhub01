
(function(){
  if(window.__schoolhubModalInstantLoaderPatched) return;
  window.__schoolhubModalInstantLoaderPatched = true;

  // ขึ้นสปินเนอร์ทับพื้นหลังที่เบลอ/มืดลง "ทุกครั้ง" ที่เปิดป็อปอัพ อย่างน้อยเป็นเวลาสั้นๆ
  // เพื่อไม่ให้ผู้ใช้เห็นแค่พื้นหลังมัวๆ ค้างอยู่เฉยๆ ระหว่างรอป็อปอัพจริงเด้งขึ้นมา (บางทีโหลดช้า)
  var MIN_SHOW_MS = 250;   // เวลาขั้นต่ำที่ต้องโชว์สปินเนอร์เสมอ แม้เนื้อหาจะพร้อมเร็วก็ตาม
  var SAFETY_MS   = 6000;  // กันค้าง: เอาสปินเนอร์ออกสูงสุดใน 6 วิ ไม่ว่ากรณีใด

  function getModalBox(modal){
    if(!modal) return null;
    for(var i=0;i<modal.children.length;i++){
      var c = modal.children[i];
      if(c.nodeType === 1 && !c.classList.contains('schoolhub-modal-mini-spinner')) return c;
    }
    return null;
  }

  // เนื้อหาข้างในถือว่า "พร้อมจริง" เมื่อมีทั้งความยาวข้อความและมีขนาดที่มองเห็นได้จริง
  // (ของเดิมเช็คแค่ความยาวข้อความ ทำให้ป็อปอัพที่มีป้าย/หัวข้อ static อยู่แล้วโดนข้ามสปินเนอร์ไป
  //  ทั้งที่รายการข้อมูลจริงข้างในยังโหลดไม่เสร็จ)
  function hasEnoughContent(box){
    if(!box) return false;
    var textLen = (box.textContent || '').trim().length;
    if(textLen <= 30) return false;
    var rect = box.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function showSpinner(modal){
    if(!modal) return;
    if(modal.querySelector(':scope > .schoolhub-modal-mini-spinner')) return; // กำลังโชว์อยู่แล้ว ไม่ต้องซ้ำ

    var cs = getComputedStyle(modal);
    if(cs.position === 'static') modal.style.position = 'relative';

    var sp = document.createElement('div');
    sp.className = 'schoolhub-modal-mini-spinner';
    sp.innerHTML = '<div class="sh-spin"></div><span>กำลังโหลด...</span>';
    // แทรกเป็นตัวแรกสุด (ก่อนกล่องป็อปอัพ) ให้สปินเนอร์อยู่ "หลัง" กล่องป็อปอัพเสมอ
    // เมื่อกล่องป็อปอัพ (ซึ่งมีพื้นหลังทึบ) เด้งขึ้นมาแล้ว มันจะซ้อนทับบังสปินเนอร์ไปเองตามธรรมชาติ
    // ไม่ใช่สปินเนอร์ไปทับบังกล่องป็อปอัพแบบเดิม
    modal.insertBefore(sp, modal.firstChild);

    var shownAt = Date.now();
    var removed = false;
    var mo, safety;

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
      try{ closeWatcher.disconnect(); }catch(e){}
      sp.style.opacity = '0';
      setTimeout(function(){ try{ sp.remove(); }catch(e){} }, 150);
    }

    mo = new MutationObserver(function(){
      var b = getModalBox(modal);
      if(hasEnoughContent(b)) removeSpinner(false);
    });
    try{ mo.observe(modal, {childList:true, subtree:true, characterData:true}); }catch(e){}

    safety = setTimeout(function(){ removeSpinner(true); }, SAFETY_MS);

    // เผื่อ modal ถูกปิดไปเองระหว่างรอ ก็เอาสปินเนอร์ออกด้วย
    var closeWatcher = new MutationObserver(function(){
      if(modal.classList.contains('hidden')) removeSpinner(true);
    });
    try{ closeWatcher.observe(modal, {attributes:true, attributeFilter:['class']}); }catch(e){}

    // เช็คทันทีเผื่อเนื้อหาพร้อมอยู่แล้วตั้งแต่แรก (แต่ยังคงโชว์อย่างน้อย MIN_SHOW_MS เสมอ ตามที่ขอ)
    if(hasEnoughContent(getModalBox(modal))) removeSpinner(false);
  }

  function wrapOpenModalOnce(){
    var base = window.openModal;
    if(typeof base !== 'function' || base.__schoolhubModalInstantLoaderWrapped) return;
    var wrapped = function(id){
      var modal = document.getElementById(id);
      // โชว์สปินเนอร์ "ก่อน" ที่โค้ดเดิมจะเริ่มเปิด/เรนเดอร์ ป็อปอัพ ให้ทันจังหวะที่พื้นหลังเพิ่งมัวลง
      try{ if(modal) showSpinner(modal); }catch(e){}
      var r = base.apply(this, arguments);
      // เผื่อกรณี modal element ถูกสร้าง/ย้ายใหม่ระหว่าง base() ทำงาน เช็คซ้ำอีกที
      try{ if(modal) showSpinner(modal); }catch(e){}
      return r;
    };
    wrapped.__schoolhubModalInstantLoaderWrapped = true;
    window.openModal = wrapped;
  }

  // ---- ดักจับป็อปอัพที่ไม่ได้เปิดผ่าน window.openModal() โดยตรง ----
  // บางจุดในระบบสั่ง classList.remove('hidden') ตรงๆ กับ backdrop โดยไม่ผ่าน openModal()
  // เลยต้องคอยดักทั้งหน้าเว็บด้วย เพื่อให้ "ทุก" ป็อปอัพที่เบลอพื้นหลังได้สปินเนอร์เหมือนกันหมด
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

  // ห่ออีกทีหลังสคริปต์อื่นๆ ทำงานหมดแล้ว เผื่อมี openModal เวอร์ชันใหม่กว่ามาทับทีหลัง
  wrapOpenModalOnce();
  document.addEventListener('DOMContentLoaded', wrapOpenModalOnce);
  setTimeout(wrapOpenModalOnce, 0);
  setTimeout(wrapOpenModalOnce, 500);
})();
