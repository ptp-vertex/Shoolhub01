
(function(){
  if (window.__schoolhubViewonlyGuardV2) return;
  window.__schoolhubViewonlyGuardV2 = true;

  /* ── helpers ─────────────────────────────────────────────── */
  function showAlert(title, msg) {
    if (typeof window.showCustomAlert === 'function') {
      window.showCustomAlert(title, msg, true);
    } else {
      alert(title + '\n' + msg);
    }
  }

  function getCourseById(id) {
    try {
      var cid = String(id || '');
      if (!cid) return null;
      var courses = window.state && Array.isArray(window.state.courses) ? window.state.courses : [];
      return courses.find(function(c){ return c && String(c.id) === cid; }) || null;
    } catch(e) { return null; }
  }

  /**
   * ตรวจสอบว่าเป็น shared course แบบ view-only จริง ๆ
   * ต้องมี __sharedOwnerKey ก่อน (แสดงว่าเป็นรายวิชาที่คนอื่น share ให้)
   * ถ้าไม่มี → เป็นรายวิชาของเจ้าของ → ไม่ใช่ view-only
   */
  function isViewOnlyCourse(course) {
    if (!course) return false;
    // เงื่อนไขหลัก: ต้องเป็น shared course ก่อน
    if (!course.__sharedOwnerKey) return false;
    // แล้วค่อยตรวจสิทธิ์
    var perm = String(course.__sharedPermission || '').toLowerCase();
    return perm === 'view' || perm === 'viewer' || perm === 'readonly';
  }

  function getCurrentCourse() {
    return getCourseById(window.currentActiveCourseId);
  }

  /* ── 1. popup เมื่อเข้ารายวิชา view-only ─────────────────── */
  var lastNotifiedCourseId = null;

  function notifyIfViewOnly(courseId) {
    var course = getCourseById(courseId);
    if (!isViewOnlyCourse(course)) { lastNotifiedCourseId = null; return; }
    if (lastNotifiedCourseId === String(courseId)) return;
    lastNotifiedCourseId = String(courseId);

    var ownerName = course.__sharedOwnerName || course.__sharedOwnerKey || 'ครูเจ้าของรายวิชา';
    var courseName = [course.code, course.name].filter(Boolean).join(' ');
    var msg = 'รายวิชา ' + courseName + ' ถูกแชร์โดย ' + ownerName
            + ' แบบ "ดูอย่างเดียว"\n\nคุณสามารถดูข้อมูลได้ แต่ไม่สามารถแก้ไข บันทึก หรือตั้งค่าใดๆ ได้';

    setTimeout(function(){
      showAlert('🔒 ดูได้อย่างเดียว', msg);
    }, 350);
  }

  function wrapEnterCourse() {
    if (typeof window.enterCourse !== 'function') return false;
    if (window.enterCourse.__viewonlyNotifyWrapped) return true;
    var original = window.enterCourse;
    var guardian = function(id) {
      var result = original.apply(this, arguments);
      notifyIfViewOnly(id);
      return result;
    };
    // คัดลอก property flags เดิมทั้งหมด แล้วเพิ่ม flag ใหม่
    try { Object.keys(original).forEach(function(k){ guardian[k] = original[k]; }); } catch(e){}
    guardian.__viewonlyNotifyWrapped = true;
    window.enterCourse = guardian;
    return true;
  }

  /* ── 2. block ปุ่มเมื่ออยู่ใน view-only ─────────────────── */
  var BUTTON_TARGETS = [
    { name: 'openStarGroupModal',  label: 'ใช้งานระบบดาวกลุ่ม' },
    { name: 'openBonusScoreModal', label: 'บันทึกคะแนนโบนัสรายสัปดาห์' }
  ];

  function wrapButtonGuard(name, featureName) {
    if (typeof window[name] !== 'function') return false;
    if (window[name].__viewonlyGuarded) return true;
    var original = window[name];
    window[name] = function() {
      if (isViewOnlyCourse(getCurrentCourse())) {
        showAlert('ดูได้อย่างเดียว',
          'คุณมีสิทธิ์ดูรายวิชานี้เท่านั้น ไม่สามารถ' + featureName + 'ได้');
        return;
      }
      return original.apply(this, arguments);
    };
    window[name].__viewonlyGuarded = true;
    return true;
  }

  /* ── bootstrap & retry (bounded) ────────────────────────── */
  var wrappedEnter = false;
  var wrappedButtons = {};

  function applyAll() {
    if (!wrappedEnter) wrappedEnter = wrapEnterCourse();
    BUTTON_TARGETS.forEach(function(t){
      if (!wrappedButtons[t.name]) wrappedButtons[t.name] = wrapButtonGuard(t.name, t.label);
    });
    return wrappedEnter && BUTTON_TARGETS.every(function(t){ return !!wrappedButtons[t.name]; });
  }

  if (!applyAll()) {
    var attempts = 0;
    var retryInterval = setInterval(function(){
      attempts++;
      if (applyAll() || attempts >= 50) clearInterval(retryInterval);
    }, 200);
  }

  // re-wrap หลัง DOMContentLoaded (หยุดหลัง 5 วินาที)
  var domPasses = 0;
  function domPass() {
    // ถ้า script block อื่น override ฟังก์ชัน ให้ wrap ใหม่
    BUTTON_TARGETS.forEach(function(t){
      if (typeof window[t.name] === 'function' && !window[t.name].__viewonlyGuarded) {
        wrappedButtons[t.name] = false;
        wrapButtonGuard(t.name, t.label);
      }
    });
    if (typeof window.enterCourse === 'function' && !window.enterCourse.__viewonlyNotifyWrapped) {
      wrappedEnter = false;
      wrapEnterCourse();
    }
    domPasses++;
    if (domPasses < 20) setTimeout(domPass, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', domPass);
  } else {
    domPass();
  }
})();
