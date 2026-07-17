
(function(){
  if(window.__schoolhubSaveBtnLoaderPatched) return;
  window.__schoolhubSaveBtnLoaderPatched = true;

  // ระยะเวลาที่ให้เห็นสัญลักษณ์กำลังโหลดก่อนคืนปุ่มกลับ (ไม่รอ popup ผลลัพธ์ใดๆ อีกต่อไป ตัดจบตรงนี้เลย)
  var SHOW_MS = 2000;

  function isActionable(el){
    if(!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if(tag === 'BUTTON' || tag === 'A') return true;
    if(tag === 'INPUT' && (el.type === 'submit' || el.type === 'button')) return true;
    if(el.getAttribute && el.getAttribute('role') === 'button') return true;
    return false;
  }

  function isNavOnly(el){
    // ปุ่มเมนู/แท็บนำทาง (เช่น "บันทึกคะแนน" ในเมนูข้าง ที่จริงๆ แค่สลับแท็บ ไม่ได้บันทึกอะไร)
    // ไม่ควรขึ้นไอคอนหมุนๆ แบบปุ่มบันทึกจริง
    if(!el || !el.classList) return false;
    return el.classList.contains('course-tab-btn') || el.classList.contains('nav-btn');
  }

  // หาปุ่ม/ลิงก์ที่ใกล้ที่สุดจากจุดคลิก แล้วเช็กว่ามีคำว่า "บันทึก" หรือไม่
  // หยุดที่ตัว actionable ตัวแรกที่เจอเท่านั้น (ไม่ไต่ขึ้นไปไกลกว่านั้น) กันเผลอไปจับปุ่มอื่นที่ไม่เกี่ยวข้อง
  function findSaveButton(target){
    var el = target;
    while(el && el !== document.body && el !== document.documentElement){
      if(isActionable(el)){
        if(isNavOnly(el)) return null;
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

    btn.__shSaving = true;
    var originalHTML = btn.innerHTML;
    var originalPointerEvents = btn.style.pointerEvents;
    var originalOpacity = btn.style.opacity;

    btn.classList.add('sh-save-btn-loading');
    // สำคัญ: ใช้ pointer-events:none กันกดซ้ำระหว่างรอเท่านั้น "ห้าม" ใช้ btn.disabled=true เด็ดขาด
    // เพราะปุ่มหลายตัวเป็น <button type="submit"> ในฟอร์ม ถ้าสั่ง disabled=true ตอน capture phase
    // (ก่อน handler จริง/การ submit ฟอร์มทำงาน) เบราว์เซอร์จะตัดไม่ยอม submit ฟอร์มเลย ทำให้บันทึกจริงไม่เกิดขึ้น
    // (ปุ่มค้างสถานะโหลดเพราะข้างในไม่มีอะไรทำงานต่อจริงๆ)
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.72';

    var spin = document.createElement('i');
    spin.className = 'fas fa-spinner fa-spin sh-save-btn-spinner';
    spin.style.cssText = 'margin-right:6px;display:inline-block;animation:schoolhubSpin .6s linear infinite;';
    btn.insertBefore(spin, btn.firstChild);

    setTimeout(function(){
      btn.__shSaving = false;
      if(!btn.isConnected) return;
      btn.innerHTML = originalHTML;
      btn.classList.remove('sh-save-btn-loading');
      btn.style.pointerEvents = originalPointerEvents;
      btn.style.opacity = originalOpacity;
    }, SHOW_MS);
  }

  // ใช้ capture phase ที่ document เพื่อให้ทำงานก่อน handler เดิมของปุ่มเสมอ (ขึ้นสัญลักษณ์โหลดทันทีที่กด)
  // แต่ "ไม่แตะ" การทำงานจริงของปุ่มเลย (ไม่ preventDefault, ไม่ stopPropagation, ไม่ disabled) ปล่อยให้บันทึกจริงทำงานตามปกติ
  document.addEventListener('click', function(e){
    var btn = findSaveButton(e.target);
    if(btn) showLoading(btn);
  }, true);
})();
