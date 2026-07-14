
(function(){
  if(window.__schoolhubSaveBtnLoaderPatched) return;
  window.__schoolhubSaveBtnLoaderPatched = true;

  // ป้องกันปุ่มค้างสถานะ "กำลังโหลด" ตลอดไป เผื่อกรณีบันทึกไม่สำเร็จ/ไม่มี toast ขึ้นเลย
  var SAFETY_MS = 6000;
  // หน่วงเล็กน้อยหลัง toast/alert ขึ้น ก่อนคืนปุ่มกลับ เพื่อให้ผู้ใช้เห็นสถานะกำลังโหลดจริงๆ
  var MIN_SHOW_MS = 250;

  function isActionable(el){
    if(!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if(tag === 'BUTTON' || tag === 'A') return true;
    if(tag === 'INPUT' && (el.type === 'submit' || el.type === 'button')) return true;
    if(el.getAttribute && el.getAttribute('role') === 'button') return true;
    return false;
  }

  // หาปุ่ม/ลิงก์ที่ใกล้ที่สุดจากจุดคลิก แล้วเช็กว่ามีคำว่า "บันทึก" หรือไม่
  // หยุดที่ตัว actionable ตัวแรกที่เจอเท่านั้น (ไม่ไต่ขึ้นไปไกลกว่านั้น) กันเผลอไปจับปุ่มอื่นที่ไม่เกี่ยวข้อง
  function findSaveButton(target){
    var el = target;
    while(el && el !== document.body && el !== document.documentElement){
      if(isActionable(el)){
        var label = (el.textContent || el.value || '');
        if(label.indexOf('บันทึก') !== -1) return el;
        return null;
      }
      el = el.parentElement;
    }
    return null;
  }

  function showLoading(btn){
    if(!btn || btn.__shSaving) return;
    if(btn.disabled) return;

    btn.__shSaving = true;
    var originalHTML = btn.innerHTML;
    var originalDisabled = btn.disabled;
    var originalPointerEvents = btn.style.pointerEvents;
    var originalOpacity = btn.style.opacity;
    var shownAt = Date.now();
    var restored = false;
    var mo1, mo2, safetyTimer, minDelayTimer;

    btn.classList.add('sh-save-btn-loading');
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.72';
    try{ btn.disabled = true; }catch(e){}

    var spin = document.createElement('i');
    spin.className = 'fas fa-spinner fa-spin sh-save-btn-spinner';
    spin.style.cssText = 'margin-right:6px;display:inline-block;animation:schoolhubSpin .6s linear infinite;';
    btn.insertBefore(spin, btn.firstChild);

    function cleanupWatchers(){
      if(mo1){ mo1.disconnect(); mo1 = null; }
      if(mo2){ mo2.disconnect(); mo2 = null; }
      if(safetyTimer){ clearTimeout(safetyTimer); safetyTimer = null; }
      if(minDelayTimer){ clearTimeout(minDelayTimer); minDelayTimer = null; }
    }

    function doRestore(){
      if(restored) return;
      restored = true;
      cleanupWatchers();
      if(!btn.isConnected) return;
      btn.innerHTML = originalHTML;
      btn.classList.remove('sh-save-btn-loading');
      btn.style.pointerEvents = originalPointerEvents;
      btn.style.opacity = originalOpacity;
      try{ btn.disabled = originalDisabled; }catch(e){}
      btn.__shSaving = false;
    }

    function requestRestore(){
      var elapsed = Date.now() - shownAt;
      var wait = Math.max(0, MIN_SHOW_MS - elapsed);
      minDelayTimer = setTimeout(doRestore, wait);
    }

    // ถ้ามี popup แจ้งผล (สำเร็จ/ผิดพลาด) ขึ้นมา ให้คืนสถานะปุ่มทันทีที่รู้ผลแล้ว
    function watch(el){
      if(!el || typeof MutationObserver === 'undefined') return null;
      var m = new MutationObserver(function(){
        if(!el.classList.contains('hidden')) requestRestore();
      });
      m.observe(el, { attributes: true, attributeFilter: ['class'] });
      return m;
    }
    mo1 = watch(document.getElementById('custom-alert-toast'));
    mo2 = watch(document.getElementById('custom-alert'));

    // กันเผื่อไม่มี popup ใดๆ ขึ้นเลย ปุ่มจะไม่ค้างสถานะโหลดตลอดไป
    safetyTimer = setTimeout(doRestore, SAFETY_MS);
  }

  // ใช้ capture phase ที่ document เพื่อให้ทำงานก่อน handler เดิมของปุ่มเสมอ (ขึ้นสัญลักษณ์โหลดทันทีที่กด)
  document.addEventListener('click', function(e){
    var btn = findSaveButton(e.target);
    if(btn) showLoading(btn);
  }, true);
})();
