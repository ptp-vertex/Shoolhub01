
(function(){
  if(window.__schoolhubReadonlyNoPermissionStableButtonFix) return;
  window.__schoolhubReadonlyNoPermissionStableButtonFix = true;

  var lastButtonState = new WeakMap();
  var scheduled = false;

  function currentEmail(){
    try{
      return String((window.currentUser && window.currentUser.email) || (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.email) || '').trim().toLowerCase();
    }catch(e){ return ''; }
  }

  function currentUid(){
    try{
      return String((window.currentUser && window.currentUser.uid) || (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.uid) || '').trim();
    }catch(e){ return ''; }
  }

  function getCourseId(){
    return window.currentActiveCourseId || window.selectedCourseId || '';
  }

  function getCourseById(id){
    try{
      return (window.state && Array.isArray(state.courses) ? state.courses : []).find(function(c){
        return String(c.id) === String(id);
      }) || null;
    }catch(e){ return null; }
  }

  function isReadonlyCourse(course){
    if(!course) return false;

    // ถ้ามีฟังก์ชันเดิมอยู่ ให้เชื่อก่อน
    try{
      if(typeof window.schoolhubIsReadonlySharedCourse === 'function'){
        return !!window.schoolhubIsReadonlySharedCourse(course);
      }
    }catch(e){}

    var email = currentEmail();
    var uid = currentUid();

    var ownerEmail = String(course.ownerEmail || course.teacherEmail || course.createdByEmail || course.userEmail || '').trim().toLowerCase();
    var ownerUid = String(course.ownerUid || course.createdByUid || course.userId || '').trim();

    if((email && ownerEmail && email === ownerEmail) || (uid && ownerUid && uid === ownerUid)) return false;

    var list = []
      .concat(Array.isArray(course.sharedTeachers) ? course.sharedTeachers : [])
      .concat(Array.isArray(course.teachers) ? course.teachers : [])
      .concat(Array.isArray(course.courseTeachers) ? course.courseTeachers : [])
      .concat(Array.isArray(course.sharedWith) ? course.sharedWith : []);

    var me = list.find(function(x){
      x = x || {};
      var em = String(x.email || x.userEmail || x.teacherEmail || '').trim().toLowerCase();
      var id = String(x.uid || x.userId || '').trim();
      return (email && em === email) || (uid && id === uid);
    });

    if(!me){
      return course.shareMode === 'readonly' || course.permission === 'readonly' || course.role === 'viewer';
    }

    var role = String(me.role || me.permission || me.access || me.mode || '').toLowerCase();
    var canEdit = me.canEdit === true || me.edit === true || me.allowEdit === true || role === 'editor' || role === 'co_teacher' || role === 'teacher';
    var readonly = me.readOnly === true || me.readonly === true || me.canEdit === false || role === 'viewer' || role === 'view' || role === 'readonly' || role === 'read_only' || role === 'ดูอย่างเดียว';

    return readonly && !canEdit;
  }

  function isCurrentReadonly(){
    return isReadonlyCourse(getCourseById(getCourseId()));
  }

  function allowPlanRight(type){
    // readonly share ล็อกก่อนเสมอ กันปุ่มสลับระหว่างสิทธิ์แผนกับสิทธิ์แชร์
    if(isCurrentReadonly()) return false;

    try{
      if(typeof window.schoolhubExpandedPlanAllows === 'function') return !!window.schoolhubExpandedPlanAllows(type);
    }catch(e){}
    try{
      if(typeof window.currentPlanAllows === 'function') return !!window.currentPlanAllows(type);
    }catch(e){}

    var d = window.__currentUserDir || {};
    if(type === 'planScores'){
      if(d.allowPlanScores !== undefined) return d.allowPlanScores !== false;
      return true;
    }
    if(type === 'gradeCriteria'){
      if(d.allowGradeCriteria !== undefined) return d.allowGradeCriteria !== false;
      return true;
    }
    return true;
  }

  function buttonType(btn){
    if(!btn) return '';
    var s = String(
      (btn.id||'') + ' ' +
      (btn.className||'') + ' ' +
      (btn.textContent||'') + ' ' +
      ((btn.getAttribute && btn.getAttribute('onclick'))||'') + ' ' +
      ((btn.getAttribute && btn.getAttribute('title'))||'')
    );

    if(/จัดการแผนเก็บคะแนน|จัดการแผนคะแนน|แผนเก็บคะแนน|แผนคะแนน|openPlanModalForCurrentCourse|openPlanModal/i.test(s)){
      return 'planScores';
    }
    if(/ตั้งค่าเกณฑ์เกรด|เกณฑ์เกรด|openGradeCriteria|GradeCriteria/i.test(s)){
      return 'gradeCriteria';
    }
    return '';
  }

  function lockReason(type){
    if(isCurrentReadonly()){
      return {
        title: 'ดูได้อย่างเดียว',
        msg: 'คุณมีสิทธิ์ดูรายวิชานี้เท่านั้น ไม่สามารถแก้ไขหรือจัดการข้อมูลได้'
      };
    }
    if(type === 'planScores'){
      return {
        title: 'แผนนี้ไม่รองรับการจัดการแผนคะแนน',
        msg: 'กรุณาอัปเกรดแผนเพื่อจัดการแผนเก็บคะแนน'
      };
    }
    return {
      title: 'แผนนี้ไม่รองรับการตั้งค่าเกณฑ์เกรด',
      msg: 'กรุณาอัปเกรดแผนเพื่อตั้งค่าเกณฑ์เกรด'
    };
  }

  function showLock(type){
    var r = lockReason(type);
    if(typeof window.showCustomAlert === 'function') window.showCustomAlert(r.title, r.msg, true);
    else alert(r.title + '\n' + r.msg);
  }

  function applyButton(btn){
    var type = buttonType(btn);
    if(!type) return;

    var ok = allowPlanRight(type);
    var readonly = isCurrentReadonly();
    var key = type + ':' + (ok ? '1' : '0') + ':' + (readonly ? 'ro' : 'plan');

    // ไม่เขียน class ซ้ำถ้าสถานะไม่เปลี่ยน ลดกระพริบ
    if(lastButtonState.get(btn) === key) return;
    lastButtonState.set(btn, key);

    btn.dataset.schoolhubLockedActionType = type;
    btn.dataset.schoolhubLockedReadonly = readonly ? '1' : '0';

    if(ok){
      btn.classList.add('schoolhub-unlocked-action-stable');
      btn.classList.remove('schoolhub-locked-action-stable','opacity-50','opacity-40','cursor-not-allowed','pointer-events-none','grayscale','schoolhub-permission-disabled-soft');
      btn.removeAttribute('aria-disabled');
      if(/ไม่รองรับ|ไม่มีสิทธิ์|ดูได้อย่างเดียว|อัปเกรด/.test(btn.getAttribute('title')||'')) btn.removeAttribute('title');
      btn.disabled = false;
      btn.style.pointerEvents = 'auto';
      btn.style.opacity = '1';
      btn.style.filter = '';
      btn.style.cursor = 'pointer';
    }else{
      btn.classList.add('schoolhub-locked-action-stable');
      btn.classList.remove('schoolhub-unlocked-action-stable','pointer-events-none','schoolhub-permission-enabled-soft');
      btn.setAttribute('aria-disabled','true');
      btn.setAttribute('title', readonly ? 'ดูได้อย่างเดียว' : 'แผนนี้ไม่รองรับฟังก์ชันนี้');
      btn.disabled = false;
      btn.style.pointerEvents = 'auto';
    }
  }

  function applyAll(){
    scheduled = false;
    document.querySelectorAll('button,a,[role="button"]').forEach(applyButton);
  }

  function schedule(){
    if(scheduled) return;
    scheduled = true;
    if(window.requestAnimationFrame) requestAnimationFrame(applyAll);
    else setTimeout(applyAll, 30);
  }

  function guardFunction(name, type){
    var old = window[name];
    if(typeof old !== 'function' || old.__readonlyNoPermissionStableGuard) return;
    window[name] = function(){
      if(!allowPlanRight(type)){
        showLock(type);
        schedule();
        return false;
      }
      return old.apply(this, arguments);
    };
    window[name].__readonlyNoPermissionStableGuard = true;
  }

  function install(){
    guardFunction('openGradeCriteriaModalForCurrentCourse','gradeCriteria');
    guardFunction('openGradeCriteria','gradeCriteria');
    schedule();
  }

  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest ? e.target.closest('button,a,[role="button"]') : null;
    if(!btn) return;
    var type = buttonType(btn);
    if(!type) return;

    if(!allowPlanRight(type)){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      showLock(type);
      schedule();
      return false;
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){
    install();
    setTimeout(install, 300);
    setTimeout(install, 1000);
  });
  document.addEventListener('click', function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(schedule, 80); }, true);
  document.addEventListener('change', function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(schedule, 80); }, true);

  window.schoolhubFixReadonlyNoPermissionButtonsNow = install;
})();
