
(function(){
  if (window.__schoolhubRealPlanEnforcementFinal) return;
  window.__schoolhubRealPlanEnforcementFinal = true;

  function esc(v){
    try { return window.escapeHTML ? window.escapeHTML(v) : String(v == null ? '' : v).replace(/[&<>"']/g, function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];}); }
    catch(e){ return String(v == null ? '' : v); }
  }
  function n(v, fallback){
    if (v === undefined || v === null || v === '') return fallback || 0;
    var x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }
  function isAdminUser(){
    try { return !!window.isAdmin || (window.currentUser && window.currentUser.uid === 'admin-bypass'); }
    catch(e){ return false; }
  }
  function allPlans(){
    try { return (Array.isArray(window.subscriptionPlans) && window.subscriptionPlans.length) ? window.subscriptionPlans : (typeof window.getDefaultPlans === 'function' ? window.getDefaultPlans() : []); }
    catch(e){ return []; }
  }
  function getDir(){ return window.__currentUserDir || {}; }
  function getPlan(){
    var dir = getDir();
    var pid = String(dir.planId || '').trim();
    var plans = allPlans();
    var found = plans.find(function(p){ return String(p.id || '').trim() === pid; });
    if (found) return Object.assign({}, found, dir.__planOverride || {});
    if (pid) return Object.assign({ id: pid, name: dir.planName || pid }, dir);
    return null;
  }
  function limitFrom(plan, dir, keys, fallback){
    plan = plan || {}; dir = dir || {};
    for (var i=0;i<keys.length;i++){
      var k = keys[i];
      if (plan[k] !== undefined && plan[k] !== null && plan[k] !== '') return n(plan[k], fallback || 0);
      if (dir[k] !== undefined && dir[k] !== null && dir[k] !== '') return n(dir[k], fallback || 0);
    }
    return fallback || 0;
  }
  function rights(){
    var dir = getDir();
    var plan = getPlan();
    if (isAdminUser()) return {admin:true, active:true, plan:plan || {}, locked:false, reason:'', courseLimit:0, studentLimit:0, weekLimit:0, teamLimit:0, allowAttendance:true, allowExport:true, allowTeam:true};
    var now = Date.now();
    var locked = false, reason = '';
    if (!dir.planId && !(dir.teamStatus === 'accepted' || dir.teamOwnerUid)) { locked = true; reason = 'ยังไม่ได้เลือกแผน กรุณาเลือกแผนก่อนใช้งาน'; }
    else if ((dir.status === 'pending_plan' || dir.requestedPlanId) && !dir.planId) { locked = true; reason = 'คำขอแผนอยู่ระหว่างรออนุมัติ'; }
    else if (dir.status === 'blocked' || dir.status === 'deleted') { locked = true; reason = 'บัญชีนี้ถูกระงับสิทธิ์'; }
    else if ((dir.planExpiresAt && n(dir.planExpiresAt) <= now) || (dir.planNextBillingAt && n(dir.planNextBillingAt) <= now && !(plan && (plan.freeForever || plan.billingCycle === 'forever')))) { locked = true; reason = 'แผนหมดอายุหรือถึงรอบชำระเงินแล้ว'; }
    if (!plan && dir.planId) plan = dir;
    return {
      admin:false,
      active: !locked,
      locked: locked,
      reason: reason,
      plan: plan || {},
      courseLimit: limitFrom(plan, dir, ['courseLimit'], 0),
      studentLimit: limitFrom(plan, dir, ['studentLimit'], 0),
      weekLimit: limitFrom(plan, dir, ['weekLimit','maxWeeks'], 20),
      teamLimit: Math.max(1, limitFrom(plan, dir, ['teamMemberLimit','maxTeamMembers'], 1)),
      allowAttendance: !plan || plan.allowAttendance !== false,
      allowExport: !plan || plan.allowExport !== false,
      allowTeam: !!(plan && plan.allowTeam === true)
    };
  }
  function alertBlock(title, msg){
    if (typeof window.showCustomAlert === 'function') window.showCustomAlert(title || 'ไม่มีสิทธิ์ใช้งาน', msg || 'แผนปัจจุบันไม่รองรับการใช้งานนี้', true);
    else alert((title || 'ไม่มีสิทธิ์ใช้งาน') + '\n' + (msg || 'แผนปัจจุบันไม่รองรับการใช้งานนี้'));
    return false;
  }
  function assertActive(action){
    var r = rights();
    if (r.admin) return true;
    if (r.locked) return alertBlock('บัญชีถูกจำกัดสิทธิ์', (r.reason || 'กรุณาเลือก/ต่ออายุแผนก่อนใช้งาน') + (action ? '\n\nการทำงาน: ' + action : ''));
    return true;
  }
  function assertFeature(feature, action){
    var r = rights();
    if (!assertActive(action)) return false;
    if (feature === 'attendance' && !r.allowAttendance) return alertBlock('แผนนี้ไม่รองรับเช็คชื่อ', 'กรุณาอัปเกรดแผนเพื่อใช้เมนูเช็คชื่อ');
    if (feature === 'export' && !r.allowExport) return alertBlock('แผนนี้ไม่รองรับ Export', 'กรุณาอัปเกรดแผนเพื่อส่งออกไฟล์ Excel');
    if (feature === 'team' && !r.allowTeam) return alertBlock('แผนนี้ไม่รองรับทีมครู', 'แผนปัจจุบันเป็นแบบใช้คนเดียว ไม่สามารถจัดการครูผู้สอนร่วมได้');
    return true;
  }
  function courseCount(){ try { return (window.state && Array.isArray(state.courses)) ? state.courses.length : 0; } catch(e){ return 0; } }
  function studentCount(){ try { return (window.state && Array.isArray(state.students)) ? state.students.length : 0; } catch(e){ return 0; } }
  function countStudentRowsInModal(){
    var rows = document.querySelectorAll('#multi-student-tbody tr');
    var add = 0;
    rows.forEach(function(tr){
      var c = (tr.querySelector('.student-code-input') || {}).value || '';
      var name = (tr.querySelector('.student-name-input') || {}).value || '';
      if (String(c).trim() && String(name).trim()) add++;
    });
    return add;
  }
  function assertCourseLimit(isNew){
    var r = rights();
    if (!assertActive('เพิ่ม/แก้ไขรายวิชา')) return false;
    if (!isNew) return true;
    if (r.courseLimit === 0) return true;
    if (courseCount() >= r.courseLimit) return alertBlock('เกินจำนวนรายวิชาของแผน', 'แผนปัจจุบันเพิ่มรายวิชาได้สูงสุด ' + r.courseLimit + ' วิชา');
    return true;
  }
  function assertStudentLimit(addCount){
    var r = rights();
    if (!assertActive('เพิ่มนักเรียน')) return false;
    if (r.studentLimit === 0) return true;
    var total = studentCount() + n(addCount, 0);
    if (total > r.studentLimit) return alertBlock('เกินจำนวนนักเรียนของแผน', 'แผนปัจจุบันเพิ่มนักเรียนได้สูงสุด ' + r.studentLimit + ' คน\nตอนนี้มี ' + studentCount() + ' คน และกำลังเพิ่ม ' + addCount + ' คน');
    return true;
  }
  function assertWeekLimit(week){
    var r = rights();
    if (!assertActive('บันทึกสัปดาห์/คะแนน')) return false;
    var w = n(week, 0);
    if (r.weekLimit === 0) return true;
    if (w > r.weekLimit) return alertBlock('เกินจำนวนสัปดาห์ของแผน', 'แผนปัจจุบันตั้งค่าได้สูงสุด ' + r.weekLimit + ' สัปดาห์');
    return true;
  }

  window.schoolhubGetRealPlanRights = rights;
  window.schoolhubAssertActivePlan = assertActive;
  window.schoolhubAssertPlanFeature = assertFeature;
  window.currentPlanAllows = function(key){
    if (key === 'attendance') return rights().allowAttendance && !rights().locked;
    if (key === 'export') return rights().allowExport && !rights().locked;
    if (key === 'team') return rights().allowTeam && !rights().locked;
    return !rights().locked;
  };
  window.getCurrentCourseLimit = function(){ return rights().courseLimit; };
  window.getCurrentCourseLimitText = function(){ var l = rights().courseLimit; return l === 0 ? 'ไม่จำกัด' : (l + ' วิชา'); };
  window.canCreateMoreCourses = function(){ var l = rights().courseLimit; return l === 0 || courseCount() < l; };
  window.getCurrentPlanWeekLimit = function(){ return rights().weekLimit || 20; };
  window.getCurrentPlanStudentLimit = function(){ return rights().studentLimit || 0; };
  window.getCurrentPlanObject = function(){ return rights().plan || {}; };
  window.describePlanLimits = function(p){
    p = p || {};
    var course = n(p.courseLimit,0) === 0 ? 'รายวิชาไม่จำกัด' : 'รายวิชา ' + n(p.courseLimit,0) + ' วิชา';
    var weeks = n(p.weekLimit || p.maxWeeks,20) === 0 ? 'สัปดาห์ไม่จำกัด' : 'สัปดาห์ ' + n(p.weekLimit || p.maxWeeks,20) + ' สัปดาห์';
    var students = n(p.studentLimit,0) === 0 ? 'นักเรียนไม่จำกัด' : 'นักเรียน ' + n(p.studentLimit,0) + ' คน';
    var att = p.allowAttendance === false ? 'ปิดเช็คชื่อ' : 'เช็คชื่อได้';
    var exp = p.allowExport === false ? 'ปิด Export' : 'Export ได้';
    var team = p.allowTeam ? 'ทีมครู ' + Math.max(1, n(p.teamMemberLimit || p.maxTeamMembers,1)) + ' คน' : 'ใช้คนเดียว';
    return [course,weeks,students,att,exp,team].join(' • ');
  };

  function wrap(name, checker){
    var old = window[name];
    if (typeof old !== 'function' || old.__realPlanWrapped) return;
    var fn = function(){
      if (!checker.apply(this, arguments)) return;
      return old.apply(this, arguments);
    };
    fn.__realPlanWrapped = true;
    window[name] = fn;
  }

  wrap('handleCourseSubmit', function(){ return assertCourseLimit(!window.editingCourseId); });
  wrap('openMultiStudentModal', function(){ return assertStudentLimit(0); });
  wrap('handleMultiStudentSubmit', function(){ return assertStudentLimit(countStudentRowsInModal()); });
  wrap('saveAttendance', function(){ return assertFeature('attendance','บันทึกเช็คชื่อ'); });
  wrap('saveScores', function(){
    var week = (document.getElementById('score-week') || {}).value;
    return assertWeekLimit(week);
  });
  wrap('deleteScores', function(){ return assertActive('ลบคะแนน'); });
  wrap('openGradeCriteriaModalForCurrentCourse', function(){ return assertActive('ตั้งค่าเกณฑ์เกรด'); });
  wrap('saveGradeCriteria', function(){ return assertActive('บันทึกเกณฑ์เกรด'); });
  wrap('exportStudentsToExcel', function(){ return assertFeature('export','Export รายชื่อนักเรียน'); });
  wrap('exportScoresToExcel', function(){ return assertFeature('export','Export คะแนน'); });
  wrap('exportAttendanceToExcel', function(){ return assertFeature('export','Export เช็คชื่อ'); });
  wrap('downloadExcelMultiSheet', function(){ return assertFeature('export','Export Excel'); });
  wrap('addCourseTeacher', function(){ return assertFeature('team','เพิ่มครูผู้สอน'); });
  wrap('openCourseTeachersModal', function(){ return assertFeature('team','จัดการครูผู้สอน'); });
  wrap('openCourseTeachers', function(){ return assertFeature('team','จัดการครูผู้สอน'); });
  wrap('saveCourseTeachers', function(){ return assertFeature('team','บันทึกครูผู้สอน'); });

  var oldSwitch = window.switchCourseTab;
  if (typeof oldSwitch === 'function' && !oldSwitch.__realPlanWrapped) {
    var sw = function(tabId){
      if (tabId === 'attendance' && !assertFeature('attendance','เปิดหน้าเช็คชื่อ')) return;
      if (tabId === 'scores' && !assertActive('เปิดหน้าบันทึกคะแนน')) return;
      return oldSwitch.apply(this, arguments);
    };
    sw.__realPlanWrapped = true;
    window.switchCourseTab = sw;
  }

  var oldInit = window.initStaticDropdowns;
  window.initStaticDropdowns = function(){
    if (typeof oldInit === 'function') oldInit.apply(this, arguments);
    var maxWeeks = rights().weekLimit || 20;
    ['plan-week','score-week'].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      var oldVal = el.value;
      var first = id === 'score-week' ? '<option value="">-- เลือกสัปดาห์ --</option>' : '';
      el.innerHTML = first;
      for (var i=1;i<=maxWeeks;i++) el.insertAdjacentHTML('beforeend','<option value="'+i+'">สัปดาห์ที่ '+i+'</option>');
      if (oldVal && n(oldVal) <= maxWeeks) el.value = oldVal;
    });
  };

  var oldApplyPayload = window.applyPlanToUserPayload;
  window.applyPlanToUserPayload = function(plan, startAt, cycle, extra){
    var payload = typeof oldApplyPayload === 'function' ? oldApplyPayload(plan, startAt, cycle, extra) : Object.assign({status:'active', planId:plan.id, planName:plan.name||'', requestedPlanId:null, requestedPlanName:null}, extra||{});
    plan = plan || {};
    return Object.assign(payload, {
      courseLimit: n(plan.courseLimit,0),
      studentLimit: n(plan.studentLimit,0),
      weekLimit: n(plan.weekLimit || plan.maxWeeks,20),
      allowAttendance: plan.allowAttendance !== false,
      allowExport: plan.allowExport !== false,
      allowTeam: plan.allowTeam === true,
      teamMemberLimit: Math.max(1, n(plan.teamMemberLimit || plan.maxTeamMembers,1))
    });
  };

  function updatePlanBadges(){
    try {
      var r = rights();
      document.querySelectorAll('[data-plan-rights-badge]').forEach(function(el){ el.remove(); });
      if (isAdminUser()) return;
      var subtitle = document.getElementById('page-subtitle');
      if (!subtitle) return;
      var badge = document.createElement('div');
      badge.setAttribute('data-plan-rights-badge','1');
      badge.className = 'mt-2 text-[11px] font-bold rounded-xl px-3 py-2 inline-flex items-center gap-2 ' + (r.locked ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100');
      badge.innerHTML = '<i class="fas fa-shield-halved"></i><span>' + (r.locked ? esc(r.reason) : esc(window.describePlanLimits(r.plan || {}))) + '</span>';
      subtitle.insertAdjacentElement('afterend', badge);
    } catch(e) {}
  }
  ['renderUserPlans','renderCourseGrid','renderCourseOverview','renderStudentsMaster','updateGlobalViews'].forEach(function(name){
    var old = window[name];
    if (typeof old === 'function' && !old.__planBadgeWrapped) {
      var fn = function(){ var out = old.apply(this, arguments); setTimeout(updatePlanBadges, 0); return out; };
      fn.__planBadgeWrapped = true;
      window[name] = fn;
    }
  });
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ try{ window.initStaticDropdowns(); updatePlanBadges(); }catch(e){} }, 400); });
  setInterval(function(){ try{ updatePlanBadges(); }catch(e){} }, 2500);
})();
