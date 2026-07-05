
(function(){
  if(window.__schoolhubModalInstantLoaderPatched) return;
  window.__schoolhubModalInstantLoaderPatched = true;

  function getModalBox(modal){
    if(!modal) return null;
    for(var i=0;i<modal.children.length;i++){
      var c = modal.children[i];
      if(c.nodeType === 1 && !c.classList.contains('schoolhub-modal-mini-spinner')) return c;
    }
    return null;
  }

  // ถ้าเนื้อหาข้างในมีอยู่แล้วพอสมควร (กรณีปกติที่โหลดเร็วอยู่แล้ว) ไม่ต้องขึ้น spinner ให้กระพริบรบกวน
  function hasEnoughContent(box){
    if(!box) return false;
    return (box.textContent || '').trim().length > 30;
  }

  function showMiniSpinnerIfSlow(modal){
    var box = getModalBox(modal);
    if(hasEnoughContent(box)) return; // เนื้อหาพร้อมอยู่แล้ว ไม่ต้องขึ้น
    if(modal.querySelector(':scope > .schoolhub-modal-mini-spinner')) return;

    var cs = getComputedStyle(modal);
    if(cs.position === 'static') modal.style.position = 'relative';

    var sp = document.createElement('div');
    sp.className = 'schoolhub-modal-mini-spinner';
    sp.innerHTML = '<div class="sh-spin"></div><span>กำลังโหลด...</span>';
    modal.appendChild(sp);

    var removed = false;
    function removeSpinner(){
      if(removed) return; removed = true;
      try{ if(mo) mo.disconnect(); }catch(e){}
      try{ clearTimeout(safety); }catch(e){}
      sp.style.opacity = '0';
      setTimeout(function(){ try{ sp.remove(); }catch(e){} }, 150);
    }

    var mo = new MutationObserver(function(){
      var b = getModalBox(modal);
      if(hasEnoughContent(b)) removeSpinner();
    });
    try{ mo.observe(modal, {childList:true, subtree:true, characterData:true}); }catch(e){}

    // กันค้าง: ไม่ว่าจะโหลดเสร็จหรือยัง เอา spinner ออกสูงสุดใน 6 วิ
    var safety = setTimeout(removeSpinner, 6000);

    // เผื่อ modal ถูกปิดไปเองระหว่างรอ ก็เอา spinner ออกด้วย
    var closeWatcher = new MutationObserver(function(){
      if(modal.classList.contains('hidden')) { removeSpinner(); closeWatcher.disconnect(); }
    });
    try{ closeWatcher.observe(modal, {attributes:true, attributeFilter:['class']}); }catch(e){}
  }

  function wrapOpenModalOnce(){
    var base = window.openModal;
    if(typeof base !== 'function' || base.__schoolhubModalInstantLoaderWrapped) return;
    var wrapped = function(id){
      var modal = document.getElementById(id);
      var r = base.apply(this, arguments);
      try{ if(modal) showMiniSpinnerIfSlow(modal); }catch(e){}
      return r;
    };
    wrapped.__schoolhubModalInstantLoaderWrapped = true;
    window.openModal = wrapped;
  }

  // ห่ออีกทีหลังสคริปต์อื่นๆ ทำงานหมดแล้ว เผื่อมี openModal เวอร์ชันใหม่กว่ามาทับทีหลัง
  wrapOpenModalOnce();
  document.addEventListener('DOMContentLoaded', wrapOpenModalOnce);
  setTimeout(wrapOpenModalOnce, 0);
  setTimeout(wrapOpenModalOnce, 500);
})();
