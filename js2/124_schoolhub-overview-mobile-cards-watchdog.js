/*
  แก้ปัญหา: หน้า "ภาพรวม" การ์ดรายชื่อนักเรียน (มือถือ) ไม่ขึ้นเมื่อเปิดจากโทรศัพท์จริง
  แต่ขึ้นปกติเมื่อทดสอบบนคอมพิวเตอร์ด้วยการย่อหน้าต่างให้แคบ

  สาเหตุ: การสร้างการ์ดในหน้าภาพรวมถูกผูกกับ event 'resize' หรือ setTimeout ที่กำหนด
  เวลาคงที่ (patch เก่าหลายตัวรวมกัน) วิธีนี้ใช้ได้บนคอมเพราะข้อมูลโหลดเสร็จก่อนแล้ว
  การ resize แค่ไปกระตุ้นให้วาดใหม่เท่านั้น แต่บนมือถือจริงหน้าจอไม่มี resize เกิดขึ้น
  เลยตั้งแต่เปิดหน้า และถ้าเน็ตช้ากว่าที่ patch เดาไว้ ข้อมูลนักเรียน/คอร์สจะยังโหลดไม่
  เสร็จภายในเวลาที่ตั้งไว้ ทำให้การ์ดถูกสร้างตอนที่ยังไม่มีข้อมูล แล้วไม่มีอะไรมาสั่งให้
  สร้างใหม่อีกครั้งหลังข้อมูลมาจริง (ซ้ำเติมด้วย CSS #course-summary-mobile-cards:empty
  { display:none } ที่ซ่อนกล่องว่างไว้เฉย ๆ)

  วิธีแก้: เพิ่ม "watchdog" นี้ต่อท้ายทุก patch เดิม (ไม่แก้/ลบของเดิมเลย) ให้คอยตรวจสอบ
  เป็นระยะว่า "ตารางภาพรวมมีข้อมูลแล้ว แต่กล่องการ์ดมือถือยังว่างอยู่" ถ้าเจอสภาพนี้จะสั่ง
  renderCourseOverview() ใหม่ทันที ซึ่งจะ sync การ์ดให้ตรงกับตารางเสมอ ไม่ว่าจะเปิดจากคอม
  หรือมือถือจริง และไม่ว่าเน็ตจะช้าแค่ไหนก็ตาม
*/
(function(){

  function overviewTabVisible(){
    var el = document.getElementById('course-tab-overview');
    if(!el) return false;
    if(el.classList && el.classList.contains('hidden')) return false;
    try {
      var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
      if(cs && cs.display === 'none') return false;
    } catch(e) {}
    return true;
  }

  function cardsBox(){ return document.getElementById('course-summary-mobile-cards'); }

  function tableRowCount(){
    var t = document.getElementById('course-summary-table');
    var tb = t ? t.querySelector('tbody') : null;
    return tb ? tb.children.length : 0;
  }

  function needsRebuild(){
    if(!window.currentActiveCourseId) return false;
    if(!overviewTabVisible()) return false;
    var rows = tableRowCount();
    if(rows <= 0) return false; // ยังไม่มีข้อมูลจริง ๆ ไม่ต้องทำอะไร
    var box = cardsBox();
    var boxEmpty = !box || !box.innerHTML || box.innerHTML.trim() === '';
    return boxEmpty;
  }

  var rebuilding = false;
  function forceRebuild(){
    if(rebuilding) return;
    rebuilding = true;
    try {
      if (typeof window.renderCourseOverview === 'function') {
        window.renderCourseOverview();
      }
    } catch(e) { console.warn('[schoolhub-overview-watchdog] render failed:', e); }
    rebuilding = false;
  }

  function check(){ if (needsRebuild()) forceRebuild(); }

  // 1) เช็คถี่ ๆ ในช่วงแรกหลังโหลดหน้า เผื่อเน็ต/ข้อมูลมาช้ากว่าตอนทดสอบบนคอม
  document.addEventListener('DOMContentLoaded', function(){
    var tries = 0;
    var iv = setInterval(function(){
      tries++;
      check();
      if (tries >= 24) clearInterval(iv); // เช็คต่อเนื่องประมาณ 12 วินาทีแรก
    }, 500);
  });

  // 2) เช็คทุกครั้งที่ขนาดจอเปลี่ยน/พลิกแนวจอ (ครอบคลุมพฤติกรรมเดิมบนคอมด้วย)
  window.addEventListener('resize', function(){ setTimeout(check, 150); });
  window.addEventListener('orientationchange', function(){ setTimeout(check, 250); });

  // 3) เช็คทุกครั้งที่ผู้ใช้สลับไปแท็บ "ภาพรวม" บนมือถือ/คอม
  if (typeof window.switchCourseTab === 'function' && !window.switchCourseTab.__schoolhubOverviewWatchdogWrapped) {
    var oldSwitch = window.switchCourseTab;
    var wrappedSwitch = function(tabId){
      var r = oldSwitch.apply(this, arguments);
      if (tabId === 'overview') setTimeout(check, 250);
      return r;
    };
    wrappedSwitch.__schoolhubOverviewWatchdogWrapped = true;
    window.switchCourseTab = wrappedSwitch;
  }

  // 4) จุดสำคัญที่สุด: เฝ้าดูตารางภาพรวมโดยตรงด้วย MutationObserver
  //    ทันทีที่ตารางมีแถวข้อมูลจริง (ข้อมูลโหลดเสร็จ ไม่ว่าจะช้าแค่ไหน) จะเช็ค
  //    และสร้างการ์ดให้ทันที ไม่ต้องพึ่ง setTimeout เดาเวลาอีกต่อไป
  function attachObserver(){
    var table = document.getElementById('course-summary-table');
    if (!table || table.__schoolhubOverviewWatchdogObserved) return;
    if (!window.MutationObserver) return;
    var mo = new MutationObserver(function(){ check(); });
    mo.observe(table, { childList: true, subtree: true });
    table.__schoolhubOverviewWatchdogObserved = true;
  }
  document.addEventListener('DOMContentLoaded', function(){
    attachObserver();
    setTimeout(attachObserver, 800); // เผื่อตารางถูกสร้างช้ากว่า DOMContentLoaded
  });

})();
