/*
  PATCH: กันหน้าเว็บค้างที่หน้าโหลด (#global-loader) ไม่ว่าจะค้างตรงขั้นตอนไหนก็ตาม
  เช่น "กำลังตรวจสอบแผนการใช้งาน..." ค้างไม่ไปต่อ

  สาเหตุที่เป็นไปได้: ขั้นตอนเช็คแผนผู้ใช้ (refreshCurrentUserPlanLock) และขั้นตอนอื่น ๆ
  ระหว่างล็อกอิน มีการตั้ง timeout ของแต่ละคำขอ Firebase ไว้ที่ 6-8 วินาทีอยู่แล้วก็จริง
  แต่ถ้าเบราว์เซอร์/เครือข่ายมีปัญหาเฉพาะจุด (เช่น IndexedDB ของ Firestore ค้างล็อก,
  หลายแท็บชนกัน, บั๊กของ SDK บางกรณี) promise ที่ await อยู่จะไม่ resolve และไม่ reject
  เลยแม้แต่ครั้งเดียว ทำให้โค้ดทั้งฟังก์ชันค้างเงียบ ๆ โดยไม่มี error ให้เห็น และ
  ตัว safety fallback เดิมในหน้าเว็บ (js1/007.js) เช็คแค่ครั้งเดียวตอนโหลดหน้าเสร็จใหม่ ๆ
  (9 วินาทีหลัง window 'load') เท่านั้น ไม่ครอบคลุมช่วงหลังจากนั้น เช่นตอนล็อกอิน

  วิธีแก้: เฝ้าดู #global-loader ตลอดเวลาที่หน้าเว็บเปิดอยู่ (ไม่ใช่แค่ตอนโหลดหน้าครั้งแรก)
  ถ้าเห็นว่ากล่องนี้ถูกแสดงค้างต่อเนื่องเกิน 15 วินาที จะบังคับปิดหน้าโหลดออกเอง แล้วเปิด
  หน้าที่เหมาะสมให้ผู้ใช้ใช้งานต่อได้ (หน้าแอปหลักถ้ามีผู้ใช้ล็อกอินอยู่แล้ว ไม่งั้นกลับไป
  หน้า landing) พร้อมแจ้งเตือนเบา ๆ ว่าโหลดช้ากว่าปกติ ให้ลองรีเฟรชถ้าข้อมูลไม่ครบ
*/
(function () {
  if (window.__schoolhubLoaderWatchdogPatch) return;
  window.__schoolhubLoaderWatchdogPatch = true;

  var WATCHDOG_TIMEOUT_MS = 15000;
  var visibleSince = null;
  var recovered = false;

  function isLoaderVisible(loader) {
    if (!loader) return false;
    if (loader.style.display === 'none') return false;
    var cs = window.getComputedStyle(loader);
    return cs.display !== 'none';
  }

  function forceRecover(loader) {
    if (recovered) return;
    recovered = true;
    console.warn('SchoolHub: loader watchdog activated (หน้าโหลดค้างเกิน ' + (WATCHDOG_TIMEOUT_MS / 1000) + ' วินาที บังคับปิดหน้าโหลด)');

    try { loader.style.display = 'none'; } catch (e) {}

    try {
      var landing = document.getElementById('landing-view');
      var authView = document.getElementById('auth-view');
      var appView = document.getElementById('main-app');
      var hasUser = !!(window.currentUser || (window.auth && window.auth.currentUser));

      if (hasUser && appView) {
        landing && landing.classList.add('hidden');
        authView && authView.classList.add('hidden');
        appView.classList.remove('hidden');
      } else if (appView && !appView.classList.contains('hidden')) {
        // ถ้าแอปหลักเปิดอยู่แล้ว (แค่ตัวโหลดค้างทับอยู่ข้างบน) ปล่อยหน้าที่เปิดอยู่ไว้ตามเดิม
      } else if (landing) {
        appView && appView.classList.add('hidden');
        authView && authView.classList.add('hidden');
        landing.classList.remove('hidden');
      }
    } catch (e) { console.warn('loader watchdog recover view failed', e); }

    try {
      if (typeof window.showCustomAlert === 'function') {
        window.showCustomAlert('โหลดช้ากว่าปกติ', 'การเชื่อมต่อข้อมูลใช้เวลานานผิดปกติ ระบบเปิดหน้าให้ใช้งานต่อแล้ว หากข้อมูลไม่ครบ ลองกดรีเฟรชหน้าอีกครั้ง', true);
      }
    } catch (e) {}
  }

  function tick() {
    var loader = document.getElementById('global-loader');
    var visible = isLoaderVisible(loader);
    if (visible) {
      if (visibleSince === null) { visibleSince = Date.now(); recovered = false; }
      else if (Date.now() - visibleSince >= WATCHDOG_TIMEOUT_MS) {
        forceRecover(loader);
      }
    } else {
      visibleSince = null;
    }
  }

  setInterval(tick, 1000);
  document.addEventListener('DOMContentLoaded', tick);
  tick();
})();
