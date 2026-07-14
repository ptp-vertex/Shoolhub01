
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function(){
  if(window.__schoolhubCanonical12RightsStableRoot) return;
  window.__schoolhubCanonical12RightsStableRoot = true;

  const firebaseConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
  };

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const plansRef = doc(db, 'system_settings', 'subscription_plans');

  const RIGHTS = [
    ['allowAttendance','attendance','เช็คชื่อ','แผนนี้ไม่รองรับเช็คชื่อ','กรุณาอัปเกรดแผนเพื่อใช้เมนูเช็คชื่อ','fa-calendar-check'],
    ['allowExport','export','Export','แผนนี้ไม่รองรับ Export','กรุณาอัปเกรดแผนเพื่อส่งออกไฟล์ Excel','fa-file-excel'],
    ['allowTeam','team','จัดการครูในรายวิชา / ทีมครู','แผนนี้ไม่รองรับจัดการครูในรายวิชา','แผนปัจจุบันเป็นแบบใช้คนเดียว ไม่สามารถจัดการครูผู้สอนร่วมได้','fa-users'],
    ['allowScores','scores','บันทึกคะแนน','แผนนี้ไม่รองรับบันทึกคะแนน','กรุณาอัปเกรดแผนเพื่อบันทึกคะแนน','fa-star'],
    ['allowPlanScores','planScores','จัดการแผนคะแนน / แผนเก็บคะแนน','แผนนี้ไม่รองรับการจัดการแผนคะแนน','กรุณาอัปเกรดแผนเพื่อจัดการแผนคะแนน','fa-list-ul'],
    ['allowGradeCriteria','gradeCriteria','ตั้งค่าเกณฑ์เกรด','แผนนี้ไม่รองรับการตั้งค่าเกณฑ์เกรด','กรุณาอัปเกรดแผนเพื่อตั้งค่าเกณฑ์เกรด','fa-medal'],
    ['allowStudentShare','studentShare','แชร์ให้นักเรียน','แผนนี้ไม่รองรับแชร์ให้นักเรียน','กรุณาอัปเกรดแผนเพื่อแชร์ผลคะแนนให้นักเรียน','fa-share-nodes'],
    ['allowCourses','courses','เพิ่ม/แก้ไขรายวิชา','แผนนี้ไม่รองรับการจัดการรายวิชา','กรุณาอัปเกรดแผนเพื่อเพิ่มหรือแก้ไขรายวิชา','fa-book-open'],
    ['allowStudents','students','เพิ่ม/แก้ไขนักเรียน','แผนนี้ไม่รองรับการจัดการนักเรียน','กรุณาอัปเกรดแผนเพื่อเพิ่มหรือแก้ไขนักเรียน','fa-user-graduate'],
    ['allowEdit','edit','แก้ไขข้อมูล','แผนนี้ไม่รองรับการแก้ไขข้อมูล','กรุณาอัปเกรดแผนเพื่อแก้ไขข้อมูล','fa-pen-to-square'],
    ['allowDelete','delete','ลบข้อมูล','แผนนี้ไม่รองรับการลบข้อมูล','กรุณาอัปเกรดแผนเพื่อปลดล็อกการลบข้อมูล','fa-trash'],
    ['allowReports','reports','รายงาน/ภาพรวม','แผนนี้ไม่รองรับรายงาน/ภาพรวม','กรุณาอัปเกรดแผนเพื่อดูรายงาน/ภาพรวม','fa-chart-pie'],
    ['allowBonus','bonus','คะแนนโบนัส','แผนนี้ไม่รองรับคะแนนโบนัส','กรุณาอัปเกรดแผนเพื่อใช้ฟีเจอร์คะแนนโบนัส','fa-plus-circle'],
    ['allowStars','stars','ระบบดาว','แผนนี้ไม่รองรับระบบดาว','กรุณาอัปเกรดแผนเพื่อใช้ฟีเจอร์ระบบดาว','fa-star']
  ];
  const DEFAULT_TRUE_FIELDS = new Set(RIGHTS.map(r => r[0]).filter(f => f !== 'allowTeam'));
  const FIELD_TO_KEY = Object.fromEntries(RIGHTS.map(r => [r[0], r[1]]));
  const KEY_TO_FIELD = Object.fromEntries(RIGHTS.flatMap(r => [[r[1], r[0]], [r[0], r[0]] ]));
  Object.assign(KEY_TO_FIELD, {
    overview:'allowReports', reports:'allowReports', report:'allowReports', dashboard:'allowReports',
    scores:'allowScores', score:'allowScores',
    attendance:'allowAttendance', attend:'allowAttendance', checkAttendance:'allowAttendance',
    studentShare:'allowStudentShare', shareStudent:'allowStudentShare', share:'allowStudentShare', student_share:'allowStudentShare', 'share-student':'allowStudentShare',
    planScores:'allowPlanScores', planScore:'allowPlanScores', scorePlan:'allowPlanScores',
    gradeCriteria:'allowGradeCriteria', grade:'allowGradeCriteria', grades:'allowGradeCriteria',
    export:'allowExport', excel:'allowExport', xlsx:'allowExport',
    team:'allowTeam', teacher:'allowTeam', teachers:'allowTeam', courseTeachers:'allowTeam',
    courses:'allowCourses', course:'allowCourses', addCourse:'allowCourses', editCourse:'allowCourses',
    students:'allowStudents', student:'allowStudents', addStudent:'allowStudents', editStudent:'allowStudents',
    edit:'allowEdit', update:'allowEdit', modify:'allowEdit', editData:'allowEdit',
    delete:'allowDelete', remove:'allowDelete', del:'allowDelete', deleteData:'allowDelete',
    bonus:'allowBonus', bonusScore:'allowBonus', bonusScores:'allowBonus',
    stars:'allowStars', star:'allowStars', starGroup:'allowStars', starGroups:'allowStars'
  });
  const OLD_THREE_INPUTS = {
    allowAttendance:'plan-sub-allow-attendance',
    allowExport:'plan-sub-allow-export',
    allowTeam:'plan-sub-allow-team'
  };

  let lastRightsPreviewSignature = '';
  let lastRightsPreviewHtml = '';
  let rightsFrameQueued = false;
  let popupSyncedForOpen = false;

  function $(id){ return document.getElementById(id); }
  function esc(v){
    try{ return (window.escapeHTML ? window.escapeHTML(v) : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))); }
    catch(e){ return String(v ?? ''); }
  }
  function isAdmin(){
    try{
      const saved = JSON.parse(localStorage.getItem('schoolhub_web_session_v1') || '{}');
      return window.isAdmin === true || window.isAdminUser === true || saved.role === 'admin' || saved.isAdmin === true || (window.currentUser && window.currentUser.uid === 'admin-bypass');
    }catch(e){ return window.isAdmin === true; }
  }
  function rightEnabled(plan, field, defaultValue){
    const def = defaultValue !== undefined ? defaultValue : DEFAULT_TRUE_FIELDS.has(field);
    if(!plan || typeof plan !== 'object') return def;
    if(field === 'allowTeam') return plan[field] === true;
    if(Object.prototype.hasOwnProperty.call(plan, field)) return plan[field] !== false;
    return def;
  }
  function normalizePlanRights(plan){
    const out = Object.assign({}, plan || {});
    RIGHTS.forEach(([field]) => { out[field] = rightEnabled(plan, field, field !== 'allowTeam'); });
    out.allowTeam = rightEnabled(plan, 'allowTeam', false);
    return out;
  }
  function getPlansFromCache(){
    if(Array.isArray(window.subscriptionPlans) && window.subscriptionPlans.length) return window.subscriptionPlans;
    const keys = ['schoolhub_subscription_plans_cache','schoolhub_subscription_plans','schoolhub_public_plans'];
    for(const key of keys){
      try{
        const items = JSON.parse(localStorage.getItem(key) || '[]');
        if(Array.isArray(items) && items.length){ window.subscriptionPlans = items; return items; }
      }catch(e){}
    }
    return [];
  }
  function findPlanById(id){
    if(!id) return null;
    return getPlansFromCache().find(p => String(p && p.id || '') === String(id)) || null;
  }
  function currentPlanObject(){
    const d = window.__currentUserDir || {};
    const id = d.effectivePlanSource === 'team' ? (d.teamPlanId || d.planId) : d.planId;
    return findPlanById(id) || (d.planId ? d : null) || window.currentUserPlan || window.activePlan || null;
  }
  function currentRights(){
    if(isAdmin()) return Object.fromEntries(RIGHTS.map(([field]) => [field, true]));
    const p = normalizePlanRights(currentPlanObject() || {});
    return Object.fromEntries(RIGHTS.map(([field]) => [field, p[field] === true]));
  }
  function planAllows(key){
    if(isAdmin()) return true;
    const map = {
      overview: 'allowReports',
      reports: 'allowReports',
      scores: 'allowScores',
      attendance: 'allowAttendance',
      studentShare: 'allowStudentShare',
      planScores: 'allowPlanScores'
    };
    const rawKey = String(key || '').trim();
    const field = map[rawKey] || KEY_TO_FIELD[rawKey] || KEY_TO_FIELD[key] || rawKey;
    if(!field) return true;
    const d = window.__currentUserDir || {};
    if(!d.planId && !window.currentUserPlan && !window.activePlan && !(d.teamStatus === 'accepted' || d.teamOwnerUid)) return false;
    if(((d.status === 'pending_plan' || d.requestedPlanId) && !d.planId) || d.status === 'blocked' || d.status === 'deleted') return false;
    const now = Date.now();
    if(d.planExpiresAt && Number(d.planExpiresAt) <= now){
      const p = currentPlanObject() || {};
      if(!(p.freeForever || p.billingCycle === 'forever')) return false;
    }
    if(rawKey === 'studentShare' || field === 'allowStudentShare'){
      const p = currentPlanObject?.() || {};
      if(p.allowStudentShare === false || d.allowStudentShare === false) return false;
      // แผนเก่าที่ไม่มี field allowStudentShare ให้ถือว่าใช้งานได้
      return true;
    }
    return currentRights()[field] !== false;
  }
  function rightMessage(key, action){
    const field = KEY_TO_FIELD[key] || key;
    const def = RIGHTS.find(r => r[0] === field || r[1] === key) || RIGHTS[0];
    const title = def[3] || 'ไม่มีสิทธิ์ใช้งาน';
    let msg = def[4] || 'แผนปัจจุบันไม่รองรับฟีเจอร์นี้';
    if(action) msg += '\n\nการทำงาน: ' + action;
    return {title, msg};
  }
  function showBlocked(key, action){
    const m = rightMessage(key, action);
    if(typeof window.showCustomAlert === 'function') window.showCustomAlert(m.title, m.msg, true);
    else alert(m.title + '\n' + m.msg);
    return false;
  }
  function requireRight(key, action){ return planAllows(key) ? true : showBlocked(key, action); }

  window.schoolhubGetRealPlanRights = function(plan){ return normalizePlanRights(plan || currentPlanObject() || {}); };
  window.schoolhubExpandedPlanAllows = planAllows;
  window.schoolhubPlanAllows = planAllows;
  window.schoolhubAssertPlanFeature = requireRight;
  window.schoolhubExpandedRequirePlanRight = requireRight;
  const oldCurrentPlanAllows = window.currentPlanAllows;
  window.currentPlanAllows = function(key){
    if(KEY_TO_FIELD[key] || ['attendance','export','team','scores','planScores','gradeCriteria','studentShare','courses','students','edit','delete','reports','overview'].includes(key)) return planAllows(key);
    return typeof oldCurrentPlanAllows === 'function' ? oldCurrentPlanAllows.apply(this, arguments) : planAllows(key);
  };

  function ensureRightsInputs(){
    let box = $('schoolhub-expanded-rights-box');
    if(!box){
      box = document.createElement('div');
      box.id = 'schoolhub-expanded-rights-box';
      box.style.display = 'none';
      const anchor = $('plan-sub-features')?.closest('div')?.parentElement || $('admin-plan-popup') || document.body;
      anchor.appendChild(box);
    }
    RIGHTS.forEach(([field]) => {
      const id = 'plan-sub-' + field;
      if(!$(id)){
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.setAttribute('data-schoolhub-canonical-right', field);
        box.appendChild(input);
      }
    });
  }
  function setCheckboxSilent(id, value){
    const el = $(id);
    if(!el) return;
    el.checked = value === true;
  }
  function collectRightsFromHiddenInputs(){
    ensureRightsInputs();
    const out = {};
    RIGHTS.forEach(([field]) => {
      const el = $('plan-sub-' + field);
      out[field] = el ? el.checked === true : DEFAULT_TRUE_FIELDS.has(field);
    });
    return out;
  }
  function writeRightsToForm(plan, options = {}){
    ensureRightsInputs();
    const data = normalizePlanRights(plan || {});
    RIGHTS.forEach(([field]) => setCheckboxSilent('plan-sub-' + field, data[field]));
    Object.entries(OLD_THREE_INPUTS).forEach(([field, id]) => setCheckboxSilent(id, data[field]));
    if(options.syncPopup === true) syncPopupFromHiddenOnce();
    if(options.render !== false) renderRightsPreviewStable();
    return data;
  }
  function formRightsSignature(){ return JSON.stringify(collectRightsFromHiddenInputs()); }

  function ensureSummaryBox(){
    ensureRightsInputs();
    if($('schoolhub-plan-rights-summary-box')) return;
    const oldBox = $('schoolhub-expanded-rights-box');
    const oldTeam = $('plan-sub-allow-team');
    let anchor = oldTeam ? oldTeam.closest('.grid, .space-y-2, .space-y-3, div') : null;
    if(!anchor) anchor = $('plan-sub-features')?.closest('div') || oldBox;
    const div = document.createElement('div');
    div.id = 'schoolhub-plan-rights-summary-box';
    div.innerHTML = '<div class="spr-head"><div class="spr-title"><i class="fas fa-shield-halved text-primary"></i> สิทธิ์การใช้งาน</div><button type="button" class="spr-btn" id="schoolhub-open-plan-rights-btn"><i class="fas fa-sliders mr-1"></i> ตั้งค่าสิทธิ์แบบละเอียด</button></div><div id="schoolhub-plan-rights-preview" class="spr-preview"></div>';
    anchor.insertAdjacentElement('afterend', div);
    const btn = $('schoolhub-open-plan-rights-btn');
    if(btn && !btn.__schoolhubRightsOpenBound){
      btn.__schoolhubRightsOpenBound = true;
      btn.addEventListener('click', function(e){ e.preventDefault(); window.openSchoolHubPlanRightsPopup(); });
    }
  }
  function ensurePopup(){
    if($('schoolhub-plan-rights-popup-backdrop')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="schoolhub-plan-rights-popup-backdrop" class="hidden">
        <div id="schoolhub-plan-rights-popup">
          <div class="spr-popup-header">
            <div>
              <div class="spr-popup-title"><i class="fas fa-shield-halved text-primary mr-2"></i>ตั้งค่าสิทธิ์การใช้งานของแผน</div>
              <div class="text-sm text-slate-500 mt-1">ติ๊ก = ใช้งานได้, ไม่ติ๊ก = ผู้ใช้แผนนั้นกดไม่ได้และขึ้นแจ้งเตือน</div>
            </div>
            <button type="button" id="schoolhub-close-plan-rights-x" class="w-10 h-10 rounded-full border bg-white hover:bg-slate-50 text-slate-500"><i class="fas fa-times"></i></button>
          </div>
          <div class="spr-popup-body"><div class="spr-popup-grid">
            ${RIGHTS.map(([field,,label,,,icon]) => `<label><input type="checkbox" class="spr-popup-check" data-right="${esc(field)}"><i class="fas ${esc(icon)} text-primary w-5 text-center"></i><span>${esc(label)}</span></label>`).join('')}
          </div></div>
          <div class="spr-popup-footer">
            <button type="button" id="schoolhub-cancel-plan-rights-btn" class="bg-slate-100 text-slate-700 hover:bg-slate-200">ยกเลิก</button>
            <button type="button" id="schoolhub-save-plan-rights-btn" class="bg-primary text-white hover:bg-indigo-700">บันทึกสิทธิ์</button>
          </div>
        </div>
      </div>`);
    const backdrop = $('schoolhub-plan-rights-popup-backdrop');
    backdrop.addEventListener('click', function(e){ if(e.target === backdrop) window.closeSchoolHubPlanRightsPopup(); });
    $('schoolhub-close-plan-rights-x')?.addEventListener('click', window.closeSchoolHubPlanRightsPopup);
    $('schoolhub-cancel-plan-rights-btn')?.addEventListener('click', window.closeSchoolHubPlanRightsPopup);
    $('schoolhub-save-plan-rights-btn')?.addEventListener('click', window.saveSchoolHubPlanRightsPopup);
    backdrop.addEventListener('change', function(e){
      const chk = e.target && e.target.closest ? e.target.closest('.spr-popup-check') : null;
      if(!chk) return;
      const hidden = $('plan-sub-' + chk.dataset.right);
      if(hidden) hidden.checked = chk.checked === true;
      const oldId = OLD_THREE_INPUTS[chk.dataset.right];
      if(oldId && $(oldId)) $(oldId).checked = chk.checked === true;
      scheduleRightsPreview();
    }, true);
  }
  function buildPreviewHtml(rights){
    const on = RIGHTS.filter(([field]) => rights[field]);
    const off = RIGHTS.filter(([field]) => !rights[field]);
    let html = on.slice(0, 8).map(([field,,label,,,icon]) => `<span class="spr-chip"><i class="fas ${esc(icon)}"></i>${esc(label)}</span>`).join('');
    if(on.length > 8) html += `<span class="spr-chip">+${on.length - 8} สิทธิ์</span>`;
    if(off.length) html += `<span class="spr-chip off"><i class="fas fa-lock"></i>ปิด ${off.length} สิทธิ์</span>`;
    return html || '<span class="spr-chip off"><i class="fas fa-lock"></i>ปิดทั้งหมด</span>';
  }
  function renderRightsPreviewStable(){
    ensureSummaryBox();
    const preview = $('schoolhub-plan-rights-preview');
    if(!preview) return;
    const rights = collectRightsFromHiddenInputs();
    const sig = JSON.stringify(rights);
    if(sig === lastRightsPreviewSignature) return;
    const html = buildPreviewHtml(rights);
    lastRightsPreviewSignature = sig;
    if(html !== lastRightsPreviewHtml){
      preview.innerHTML = html;
      lastRightsPreviewHtml = html;
    }
  }
  function scheduleRightsPreview(){
    if(rightsFrameQueued) return;
    rightsFrameQueued = true;
    (window.requestAnimationFrame || function(fn){ return setTimeout(fn, 16); })(function(){
      rightsFrameQueued = false;
      lastRightsPreviewSignature = '';
      renderRightsPreviewStable();
    });
  }
  function syncPopupFromHiddenOnce(){
    ensurePopup();
    const data = collectRightsFromHiddenInputs();
    document.querySelectorAll('.spr-popup-check').forEach(chk => { chk.checked = data[chk.dataset.right] === true; });
  }
  window.openSchoolHubPlanRightsPopup = function(){
    ensureSummaryBox();
    ensurePopup();
    popupSyncedForOpen = false;
    if(!popupSyncedForOpen){ syncPopupFromHiddenOnce(); popupSyncedForOpen = true; }
    $('schoolhub-plan-rights-popup-backdrop')?.classList.remove('hidden');
    renderRightsPreviewStable();
  };
  window.closeSchoolHubPlanRightsPopup = function(){ $('schoolhub-plan-rights-popup-backdrop')?.classList.add('hidden'); };
  window.saveSchoolHubPlanRightsPopup = function(){
    ensurePopup();
    const data = {};
    document.querySelectorAll('.spr-popup-check').forEach(chk => { data[chk.dataset.right] = chk.checked === true; });
    writeRightsToForm(data, {render:true});
    window.closeSchoolHubPlanRightsPopup();
  };

  function setVal(id, v){ const el = $(id); if(el) el.value = v ?? ''; }
  function fillGeneralPlanForm(p){
    const display = typeof window.planDisplayPrice === 'function' ? window.planDisplayPrice(p) : (p.price || '');
    setVal('plan-sub-edit-id', p.id || '');
    setVal('plan-sub-name', p.name || '');
    setVal('plan-sub-price', p.price || display || '');
    setVal('plan-sub-promptpay', p.promptpay || '');
    setVal('plan-sub-desc', p.desc || '');
    setVal('plan-sub-features', Array.isArray(p.features) ? p.features.join('\n') : (p.features || ''));
    setVal('plan-sub-order', Number(p.order || 1));
    setVal('plan-sub-course-limit', Number(p.courseLimit || 0));
    setVal('plan-sub-week-limit', Number(p.weekLimit || p.maxWeeks || 20));
    setVal('plan-sub-student-limit', Number(p.studentLimit || 0));
    setVal('plan-sub-team-limit', Math.max(1, Number(p.teamMemberLimit || p.teamLimit || p.maxTeamMembers || 1)));
    setVal('plan-sub-monthly-price', Number(p.monthlyPrice || 0));
    setVal('plan-sub-yearly-price', Number(p.yearlyPrice || 0));
    setVal('plan-sub-billing-cycle', p.freeForever ? 'forever' : (p.billingCycle || 'monthly'));
    setCheckboxSilent('plan-sub-featured', p.featured === true);
    setCheckboxSilent('plan-sub-active', p.active !== false);
    setCheckboxSilent('plan-sub-free-first-month', p.freeFirstMonth === true);
  }
  function defaultRightsPlan(){
    const out = {};
    RIGHTS.forEach(([field]) => { out[field] = field !== 'allowTeam'; });
    return out;
  }
  const oldResetAdminPlanForm = window.resetAdminPlanForm;
  window.resetAdminPlanForm = function(){
    const r = typeof oldResetAdminPlanForm === 'function' ? oldResetAdminPlanForm.apply(this, arguments) : undefined;
    ensureSummaryBox();
    writeRightsToForm(defaultRightsPlan(), {render:true});
    return r;
  };
  window.editAdminPlan = function(id){
    const p = normalizePlanRights(findPlanById(id) || (getPlansFromCache().find(x => String(x.id || '') === String(id)) || {}));
    if(!p || !p.id){
      if(typeof window.showCustomAlert === 'function') window.showCustomAlert('ไม่พบแผน', 'ไม่พบแผนที่ต้องการแก้ไข', true);
      else alert('ไม่พบแผนที่ต้องการแก้ไข');
      return;
    }
    ensureSummaryBox();
    fillGeneralPlanForm(p);
    writeRightsToForm(p, {render:true});
    if(typeof window.openAdminPlanPopup === 'function') window.openAdminPlanPopup('edit');
    else $('admin-plan-popup-backdrop')?.classList.remove('hidden');
  };
  const oldSaveAdminPlanForm = window.saveAdminPlanForm;
  window.saveAdminPlanForm = async function(){
    ensureRightsInputs();
    const rights = collectRightsFromHiddenInputs();
    Object.entries(OLD_THREE_INPUTS).forEach(([field, id]) => setCheckboxSilent(id, rights[field]));
    const editId = $('plan-sub-edit-id')?.value || '';
    const result = typeof oldSaveAdminPlanForm === 'function' ? await oldSaveAdminPlanForm.apply(this, arguments) : undefined;
    try{
      let items = getPlansFromCache().map(p => normalizePlanRights(p));
      const targetId = editId || (items.slice().sort((a,b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] || {}).id || '';
      if(targetId && items.length){
        const idx = items.findIndex(p => String(p.id || '') === String(targetId));
        if(idx >= 0){ items[idx] = normalizePlanRights(Object.assign({}, items[idx], rights, {updatedAt: Date.now()})); }
        window.subscriptionPlans = items;
        ['schoolhub_subscription_plans_cache','schoolhub_subscription_plans','schoolhub_public_plans'].forEach(k => { try{ localStorage.setItem(k, JSON.stringify(items)); }catch(e){} });
        try{ await setDoc(plansRef, {items, updatedAt: Date.now()}, {merge:true}); }catch(e){ console.warn('canonical rights save merge skipped:', e); }
      }
    }catch(e){ console.warn('canonical rights post-save skipped:', e); }
    return result;
  };

  const oldApplyPayload = window.applyPlanToUserPayload;
  if(typeof oldApplyPayload === 'function' && !oldApplyPayload.__schoolhubRightsStableWrapped){
    window.applyPlanToUserPayload = function(plan, startAt, cycle, extra){
      const payload = oldApplyPayload.apply(this, arguments) || {};
      const rights = normalizePlanRights(plan || {});
      RIGHTS.forEach(([field]) => { payload[field] = rights[field]; });
      return payload;
    };
    window.applyPlanToUserPayload.__schoolhubRightsStableWrapped = true;
  }

  function isModalCloseButton(el){
    if(!el || !el.matches) return false;
    // Plan "cancel edit" button is internal UX, not a permission action
    if(el.id === 'plan-cancel-edit-btn') return true;
    const txt = String((el.textContent || '').trim());
    const inExportModal = !!(el.closest && el.closest('.schoolhub-export-popup,#schoolhub-overview-export-room-modal,#schoolhub-attendance-export-modal,#student-export-room-modal,#export-date-modal,#download-modal,#attendance-export-modal,#export-room-modal,#schoolhub-overview-excel-room-modal,#schoolhub-overview-excel-room-modal-force'));
    const hasExportDismiss = inExportModal && (el.hasAttribute('data-export-dismiss') ||
      (window.schoolhubIsExportDismissButton && window.schoolhubIsExportDismissButton(el)));
    const hasCloseIcon = inExportModal && !!(el.querySelector && el.querySelector('i.fa-times, i.fa-xmark, i.fa-close, .fa-times, .fa-xmark, .fa-close'));
    return hasExportDismiss || hasCloseIcon ||
      el.matches('.modal-close, .close-modal, [data-close-modal], .btn-close, [aria-label*="ปิด"], [aria-label*="close" i]') ||
      /^(×|x|X|ปิด|ยกเลิก)$/.test(txt) ||
      /closeModal\(|closeCustomAlert\(|closePlanModal\(|schoolhubCloseExportModal\(/.test(String(el.getAttribute('onclick') || ''));
  }
  function restoreCourseTabVisual(el){
    if(!el || !el.classList || !el.classList.contains('course-tab-btn')) return;
    el.classList.remove('text-slate-400','text-gray-400','text-zinc-400','bg-gray-50','bg-gray-100');
    if(!el.classList.contains('text-primary')){
      if(el.classList.contains('mobile-course-tab-btn')){
        el.classList.add('bg-slate-50','text-slate-700');
      }else{
        el.classList.add('text-slate-600','hover:bg-slate-50');
      }
    }
  }

  function unlockPermissionElement(el){
    if(!el) return;
    el.classList.remove(
      'sh-permission-disabled',
      'schoolhub-locked-action-stable',
      'schoolhub-plan-right-locked',
      'schoolhub-permission-disabled-soft',
      'schoolhub-plan-right-disabled',
      'opacity-60',
      'opacity-50',
      'opacity-40',
      'cursor-not-allowed',
      'grayscale',
      'pointer-events-none',
      'disabled'
    );
    if(el.matches && el.matches('button,a,[role="button"]')) el.classList.add('schoolhub-unlocked-action-stable');
    restoreCourseTabVisual(el);
    el.removeAttribute('aria-disabled');
    el.removeAttribute('disabled');
    if(/ไม่รองรับ|ไม่มีสิทธิ์|อัปเกรด|ดูได้อย่างเดียว/.test(el.getAttribute('title') || '')) el.removeAttribute('title');
    if(el.dataset) el.dataset.permissionAllowed = '1';
    try{ el.disabled = false; }catch(e){}
    el.style.pointerEvents = '';
    el.style.opacity = '';
    el.style.filter = '';
    el.style.cursor = '';
  }
  function unlockShareStudentControls(){
    if(!planAllows('studentShare')) return;
    document.querySelectorAll('button[onclick*="openShareStudentModal"], #share-student-modal button, #share-student-modal a').forEach(unlockPermissionElement);
  }
  function classifyAction(el){
    if(!el || isModalCloseButton(el)) return '';
    // ปุ่ม/ช่องที่ถูกทำเครื่องหมายไว้แล้วว่าให้ใช้งานได้เสมอ (เช่น ปุ่มลบ/เปลี่ยนรูปโปรไฟล์ในหน้าตั้งค่า)
    // ไม่ควรถูกจัดประเภทเป็นสิทธิ์ของแผนเลย เพื่อไม่ให้ไปโดน keyword ทั่วไปอย่าง "ลบ"/"แก้ไข" เข้าใจผิด
    // ว่าเป็นฟีเจอร์ที่ต้องเช็คแผน (เช่น "ลบรูปโปรไฟล์" ไม่ใช่ "ลบข้อมูล" นักเรียน/คะแนน)
    if(el.hasAttribute && el.hasAttribute('data-schoolhub-always-allowed')) return '';
    if(el.closest && el.closest('[data-schoolhub-always-allowed]')) return '';
    const s = [
      el.getAttribute('onclick') || '',
      el.getAttribute('data-tab') || '',
      el.getAttribute('data-right') || '',
      el.id || '',
      el.dataset && JSON.stringify(el.dataset) || '',
      el.textContent || '',
      el.className || ''
    ].join(' ').replace(/\s+/g, ' ');
    if(/overview|ภาพรวม|ภาพรวมคะแนน|รายงาน/i.test(s)) return 'reports';
    if(/attendance|เช็คชื่อ/i.test(s)) return 'attendance';
    if(/openShareStudentModal|studentShare|shareStudent|แชร์ให้นักเรียน|share-student/i.test(s)) return 'studentShare';
    if(/openPlanModalForCurrentCourse|schoolhubOpenPlanModalSafe|planScores|planScore|แผนคะแนน|แผนเก็บคะแนน|plan-score/i.test(s)) return 'planScores';
    if(/openGradeCriteria|gradeCriteria|เกณฑ์เกรด|grade/i.test(s)) return 'gradeCriteria';
    if(/openStarGroupModal|openStarConversionPopup|starGroup|StarConversion|ระบบดาว|แปลงดาวเป็นคะแนน/i.test(s)) return 'stars';
    if(/openBonusScoreModal|BonusScore|คะแนนโบนัส|บันทึกคะแนนโบนัส/i.test(s)) return 'bonus';
    if(/switchCourseTab\(['"]?scores['"]?\)|data-tab["': ]+scores|\bscores\b|\bscore\b|บันทึกคะแนน|^\s*คะแนน\s*$/i.test(s)) return 'scores';
    if(/export|Export|Excel|เอ็ก|ส่งออก|โหลดตาราง/i.test(s)) return 'export';
    if(/CourseTeachers|จัดการครูในรายวิชา|เพิ่มครู|ครูผู้สอนร่วม|team/i.test(s) || el.id === 'course-teachers-manage-btn') return 'team';
    if(/delete|ลบ/i.test(s)) return 'delete';
    if(/edit|แก้ไข/i.test(s)) return 'edit';
    return '';
  }
  function applyPermissionVisual(el){
    if(isModalCloseButton(el)){ unlockPermissionElement(el); return; }
    const key = classifyAction(el);
    if(!key) return;
    const ok = planAllows(key);
    if(ok){ unlockPermissionElement(el); return; }
    el.classList.add('schoolhub-plan-right-locked','sh-permission-disabled');
    el.classList.remove('schoolhub-unlocked-action-stable','pointer-events-none');
    el.setAttribute('aria-disabled','true');
    el.setAttribute('title', rightMessage(key).title);
    if(el.dataset) el.dataset.permissionAllowed = '0';
    try{ el.disabled = false; }catch(e){}
    el.style.pointerEvents = 'auto';
  }
  function refreshRightsUI(root){
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('button,a,[role="button"],.course-tab-btn').forEach(applyPermissionVisual);
    unlockShareStudentControls();
  }
  let rightsUIRefreshQueued = false;
  function scheduleRightsUIRefresh(root){
    if(root && root.nodeType === 1 && window.isDropdownRelatedElement && window.isDropdownRelatedElement(root)) return;
    if(rightsUIRefreshQueued) return;
    rightsUIRefreshQueued = true;
    const run = function(){
      rightsUIRefreshQueued = false;
      refreshRightsUI(root || document);
    };
    if(window.requestAnimationFrame) requestAnimationFrame(run);
    else setTimeout(run, 30);
  }
  window.applyPermissionUI = refreshRightsUI;
  window.schoolhubApplyPermissionUI = refreshRightsUI;
  window.schoolhubSchedulePermissionUIRefresh = scheduleRightsUIRefresh;
  function wrapGuard(name, key, action){
    const old = window[name];
    if(typeof old !== 'function' || old.__schoolhubStableRightsGuard) return;
    window[name] = function(){
      const ev = arguments && arguments[0];
      if(!planAllows(key)){
        if(ev && typeof ev.preventDefault === 'function'){
          ev.preventDefault();
          ev.stopPropagation();
          if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        }
        return showBlocked(key, action);
      }
      const result = old.apply(this, arguments);
      if(key === 'studentShare') setTimeout(unlockShareStudentControls, 0);
      return result === undefined ? false : result;
    };
    window[name].__schoolhubStableRightsGuard = true;
  }
  wrapGuard('exportStudentsToExcel','export','Export รายชื่อนักเรียน');
  wrapGuard('exportScoresToExcel','export','Export คะแนน');
  wrapGuard('openPlanModalForCurrentCourse','planScores','เปิดแผนคะแนน');
  wrapGuard('openGradeCriteriaModalForCurrentCourse','gradeCriteria','ตั้งค่าเกณฑ์เกรด');
  wrapGuard('openGradeCriteria','gradeCriteria','ตั้งค่าเกณฑ์เกรด');
  wrapGuard('openShareStudentModal','studentShare','แชร์ให้นักเรียน');
  wrapGuard('openBonusScoreModal','allowBonus','บันทึกคะแนนโบนัส');
  wrapGuard('openStarGroupModal','allowStars','จัดการระบบดาว');
  wrapGuard('openStarConversionPopup','allowStars','แปลงดาวเป็นคะแนน');
  wrapGuard('openCourseTeachersModal','team','จัดการครูในรายวิชา');
  const oldSwitchCourseTab = window.switchCourseTab;
  if(typeof oldSwitchCourseTab === 'function' && !oldSwitchCourseTab.__schoolhubStableRightsGuard){
    window.switchCourseTab = function(tabId){
      const map = {overview:'reports', reports:'reports', scores:'scores', score:'scores', attendance:'attendance'};
      if(map[tabId] && !requireRight(map[tabId], 'เปิดเมนู ' + tabId)) return false;
      const result = oldSwitchCourseTab.apply(this, arguments);
      scheduleRightsUIRefresh(document);
      return result;
    };
    window.switchCourseTab.__schoolhubStableRightsGuard = true;
  }
  document.addEventListener('click', function(e){
    if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return;
    const el = e.target && e.target.closest ? e.target.closest('button,a,[role="button"]') : null;
    if(!el) return;
    const inExportModal = !!(el.closest && el.closest('.schoolhub-export-popup,#schoolhub-overview-export-room-modal,#schoolhub-attendance-export-modal,#student-export-room-modal,#export-date-modal,#download-modal,#attendance-export-modal,#export-room-modal,#schoolhub-overview-excel-room-modal,#schoolhub-overview-excel-room-modal-force'));
    if(inExportModal && (el.hasAttribute('data-export-dismiss') || (window.schoolhubIsExportDismissButton && window.schoolhubIsExportDismissButton(el)))) return;
    if(el.closest && el.closest('#admin-plan-popup,#schoolhub-plan-rights-popup,#schoolhub-plan-rights-summary-box')) return;
    if(isModalCloseButton(el)) return;
    const key = classifyAction(el);
    if(key && !planAllows(key)){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      showBlocked(key);
      return false;
    }
  }, true);

  function wrapRefreshAfter(name){
    const old = window[name];
    if(typeof old !== 'function' || old.__schoolhubRightsUIRefreshWrapped) return;
    window[name] = function(){
      const result = old.apply(this, arguments);
      if(result && typeof result.then === 'function'){
        result.finally(function(){ scheduleRightsUIRefresh(document); });
      }else{
        scheduleRightsUIRefresh(document);
      }
      return result;
    };
    window[name].__schoolhubRightsUIRefreshWrapped = true;
  }
  ['loadPublicPlans','loadSchoolHubDataAfterAuth','renderUserPlans','renderLandingPlans','renderCourseGrid','updateGlobalViews','enterCourse','switchView','schoolhubApplyReadonlyUI','schoolhubEnsureCourseTeacherButton'].forEach(wrapRefreshAfter);

  function observeCourseMenus(){
    if(!window.MutationObserver) return;
    ['course-context-menu','view-course-detail','header-actions'].forEach(function(id){
      const el = document.getElementById(id);
      if(!el || el.__schoolhubRightsUIObserver) return;
      el.__schoolhubRightsUIObserver = true;
      new MutationObserver(function(){ scheduleRightsUIRefresh(el); }).observe(el, {childList:true, subtree:true, attributes:true, attributeFilter:['class','style','disabled','aria-disabled','data-permission-allowed','data-tab']});
    });
  }

  function initOnce(){
    ensureSummaryBox();
    renderRightsPreviewStable();
    observeCourseMenus();
    refreshRightsUI(document);
    setTimeout(function(){ observeCourseMenus(); scheduleRightsUIRefresh(document); }, 120);
  }
  document.addEventListener('DOMContentLoaded', initOnce);
  initOnce();
})();
