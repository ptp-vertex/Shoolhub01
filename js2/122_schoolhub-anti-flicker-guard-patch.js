
(function () {
  if (window.__shAntiFlickerGuardLoaded) return;
  window.__shAntiFlickerGuardLoaded = true;

  var SETTLE_MS = 650; /* นานกว่าดีเลย์ของโค้ดวาดการ์ดทุกเวอร์ชันที่มีอยู่ (สูงสุด ~450-500ms) */
  var revealTimer = null;

  function mobileCardsBox() {
    return document.getElementById('course-summary-mobile-cards');
  }

  function hideBoxNow() {
    var box = mobileCardsBox();
    if (box && !box.__shGuardStyled) {
      box.__shGuardStyled = true;
      box.style.transition = 'opacity .18s ease';
    }
    if (box) box.style.opacity = '0';
  }

  function armReveal() {
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = setTimeout(function () {
      var box = mobileCardsBox();
      if (box) box.style.opacity = '1';
    }, SETTLE_MS);
  }

  function guardedCycle() {
    hideBoxNow();
    armReveal();
  }

  function hookFinal(name) {
    var fn = window[name];
    if (typeof fn !== 'function' || fn.__shAntiFlickerHooked) return;
    var wrapped = function () {
      hideBoxNow();
      var r = fn.apply(this, arguments);
      armReveal();
      return r;
    };
    wrapped.__shAntiFlickerHooked = true;
    window[name] = wrapped;
  }

  function installHooks() {
    hookFinal('renderCourseOverview');
    if (typeof window.switchCourseTab === 'function' && !window.switchCourseTab.__shAntiFlickerTabHooked) {
      var oldSwitch = window.switchCourseTab;
      var wrappedSwitch = function (tabId) {
        if (tabId === 'overview') hideBoxNow();
        var r = oldSwitch.apply(this, arguments);
        if (tabId === 'overview') armReveal();
        return r;
      };
      wrappedSwitch.__shAntiFlickerTabHooked = true;
      window.switchCourseTab = wrappedSwitch;
    }
  }

  installHooks();
  document.addEventListener('DOMContentLoaded', installHooks);
  /* บางส่วนของแอปโหลด/ประกาศฟังก์ชันช้ากว่า DOMContentLoaded เล็กน้อย ตรวจซ้ำอีกครั้งให้ชัวร์ */
  setTimeout(installHooks, 800);
  setTimeout(installHooks, 2000);
})();
