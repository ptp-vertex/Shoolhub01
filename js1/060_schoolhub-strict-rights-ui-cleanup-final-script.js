
(function(){
  if(window.__schoolhubStrictRightsUiCleanupFinal) return;
  window.__schoolhubStrictRightsUiCleanupFinal = true;

  function toNum(v, fb){ var x=Number(v); return Number.isFinite(x)?x:(fb||0); }
  function isAdmin(){ try{return !!window.isAdmin || (window.currentUser && window.currentUser.uid==='admin-bypass');}catch(e){return false;} }
  function plans(){ try{return Array.isArray(window.subscriptionPlans)?window.subscriptionPlans:[];}catch(e){return [];} }
  function dir(){ return window.__currentUserDir || {}; }
  function plan(){
    var d=dir(); var pid=String(d.planId||'').trim();
    var p=plans().find(function(x){return String(x.id||'').trim()===pid;});
    return p || (pid ? d : null);
  }
  function lockedReason(){
    var d=dir(), p=plan(), now=Date.now();
    if(isAdmin()) return '';
    if(!d.planId && !(d.teamStatus==='accepted' || d.teamOwnerUid)) return 'ยังไม่ได้เลือกแผน กรุณาเลือกแผนก่อนใช้งาน';
    if((d.status==='pending_plan' || d.requestedPlanId) && !d.planId) return 'คำขอแผนอยู่ระหว่างรออนุมัติ';
    if(d.status==='blocked' || d.status==='deleted' || d.blocked===true) return 'บัญชีนี้ถูกระงับสิทธิ์';
    if((d.planExpiresAt && toNum(d.planExpiresAt)<=now) || (d.planNextBillingAt && toNum(d.planNextBillingAt)<=now && !(p && (p.freeForever || p.billingCycle==='forever')))) return 'แผนหมดอายุหรือถึงรอบชำระเงินแล้ว';
    return '';
  }
  function allow(feature){
    if(isAdmin()) return true;
    if(lockedReason()) return false;
    var p=plan()||{};
    if(feature==='export') return p.allowExport !== false && dir().allowExport !== false;
    if(feature==='attendance') return p.allowAttendance !== false && dir().allowAttendance !== false;
    if(feature==='team') return p.allowTeam === true || dir().allowTeam === true;
    return true;
  }
  function block(title,msg){
    if(typeof window.showCustomAlert==='function') window.showCustomAlert(title,msg,true);
    else alert(title+'\n'+msg);
    return false;
  }
  function requireFeature(feature, action){
    var reason=lockedReason();
    if(reason) return block('บัญชีถูกจำกัดสิทธิ์', reason + (action?'\n\nการทำงาน: '+action:''));
    if(feature==='export' && !allow('export')) return block('แผนนี้ไม่รองรับ Export','กรุณาอัปเกรดแผนเพื่อส่งออกไฟล์ Excel');
    if(feature==='attendance' && !allow('attendance')) return block('แผนนี้ไม่รองรับเช็คชื่อ','กรุณาอัปเกรดแผนเพื่อใช้เมนูเช็คชื่อ');
    if(feature==='team' && !allow('team')) return block('แผนนี้ไม่รองรับทีมครู','แผนปัจจุบันเป็นแบบใช้คนเดียว ไม่สามารถจัดการครูผู้สอนร่วมได้');
    return true;
  }

  window.schoolhubStrictPlanAllow = allow;
  window.schoolhubStrictRequireFeature = requireFeature;
  window.currentPlanAllows = function(key){ return allow(key); };

  function wrap(name, feature, action){
    var old=window[name];
    if(typeof old!=='function' || old.__schoolhubStrictFinalWrapped) return;
    var fn=function(){ if(!requireFeature(feature, action)) return false; return old.apply(this, arguments); };
    fn.__schoolhubStrictFinalWrapped=true;
    window[name]=fn;
  }
  function applyWraps(){
    wrap('exportStudentsToExcel','export','Export รายชื่อนักเรียน');
    wrap('exportScoresToExcel','export','Export คะแนน');
    wrap('exportAttendanceToExcel','export','Export เช็คชื่อ');
    wrap('downloadExcelMultiSheet','export','Export Excel');
    wrap('openCourseTeachers','team','จัดการครูผู้สอน');
    wrap('openCourseTeachersModal','team','จัดการครูผู้สอน');
    wrap('addCourseTeacher','team','เพิ่มครูผู้สอน');
  }

  function removeBluePlanBar(){
    document.querySelectorAll('[data-plan-rights-badge], .schoolhub-plan-rights-badge').forEach(function(el){ el.remove(); });
  }
  window.updatePlanBadges = function(){ removeBluePlanBar(); };

  function refreshButtonStates(){
    removeBluePlanBar();
    document.querySelectorAll('button,a').forEach(function(el){
      var onclick=String(el.getAttribute('onclick')||'');
      var text=(el.textContent||'').trim();
      var isExport=/export|Export|Excel|เอ็ก|ส่งออก/i.test(onclick+' '+text);
      var isTeam=/CourseTeachers|จัดการครูในรายวิชา|เพิ่มครู/i.test(onclick+' '+text) || el.id==='course-teachers-manage-btn' || el.id==='course-teachers-btn';
      if(isExport && !allow('export')){
        el.classList.add('opacity-50','cursor-not-allowed');
        el.setAttribute('title','แผนนี้ไม่รองรับ Export');
      }
      if(isTeam && !allow('team')){
        el.classList.add('opacity-50','cursor-not-allowed');
        el.setAttribute('title','แผนนี้ไม่รองรับทีมครู');
      }
    });
  }

  document.addEventListener('click', function(e){
    if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return;
    var el=e.target && e.target.closest ? e.target.closest('button,a') : null;
    if(!el) return;
    var onclick=String(el.getAttribute('onclick')||'');
    var text=(el.textContent||'').trim();
    var isExport=/export|Export|Excel|เอ็ก|ส่งออก/i.test(onclick+' '+text);
    var isTeam=/CourseTeachers|จัดการครูในรายวิชา|เพิ่มครู/i.test(onclick+' '+text) || el.id==='course-teachers-manage-btn' || el.id==='course-teachers-btn';
    if(isExport && !requireFeature('export','Export Excel')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return false; }
    if(isTeam && !requireFeature('team','จัดการครูผู้สอน')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return false; }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ applyWraps(); refreshButtonStates(); setTimeout(refreshButtonStates,500); });
  // สำคัญ: refreshButtonStates() ไล่สแกนปุ่ม/ลิงก์ "ทุกตัวในทั้งหน้า" (document.querySelectorAll('button,a'))
  // ทุก 1 วินาทีตลอดเวลาไม่มีหยุด ถ้าไปทำงานตอนกำลังสโครลพอดี (โดยเฉพาะหน้าต่างที่มีปุ่ม/checkbox เยอะ
  // เช่น หน้าต่างแก้ไขข้อมูลรายวิชา) จะไปแย่ง main thread กับการ render ตอนสโครล ทำให้จอกระตุก
  // จึงข้ามการสแกนรอบนั้นไปก่อนถ้ากำลังสโครลอยู่ (เช็คจาก class 'scrolling' ที่ js2/129 ติดไว้ที่ body)
  // แล้วรอบถัดไป (1 วิให้หลัง) จะสแกนตามปกติทันทีที่หยุดสโครล ไม่กระทบผลลัพธ์สุดท้ายเลย แค่เลื่อนเวลาออกไปนิดเดียว
  setInterval(function(){
    if(document.body.classList.contains('scrolling')) return;
    applyWraps(); refreshButtonStates();
  }, 1000);
})();
