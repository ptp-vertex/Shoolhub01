(function(W){
'use strict';

// ── helpers ──────────────────────────────────────────────────────
function getState(){ return W.state || {}; }
function ensureField(obj, key, def){ if(!obj[key]) obj[key] = def; }
function getCid(){ return W.currentActiveCourseId || null; }
function getStudents(cid){ return typeof W.getCourseStudents==='function' ? W.getCourseStudents(cid) : []; }
function dbSave(){ if(typeof W.saveStateToDB==='function') return W.saveStateToDB(); return Promise.resolve(); }
function alert2(title, msg){ if(typeof W.showCustomAlert==='function') W.showCustomAlert(title, msg); else alert(title+': '+msg); }
function confirm2(title, msg, cb){ if(typeof W.showCustomConfirm==='function') W.showCustomConfirm(title, msg, cb); else { if(confirm(title+'\n'+msg)) cb(); } }
function esc(v){ return String(v||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ── Star Groups Logic (Rewritten for Multi-Set) ──────────────────
function starCourseData(cid){
  const st=getState();
  ensureField(st,'starGroups',{});
  if(!st.starGroups[cid]) st.starGroups[cid]={ sets:[], currentSetId: null };
  
  const cd = st.starGroups[cid];
  
  // Migration from old single-set structure
  if (cd.groups && (!cd.sets || cd.sets.length === 0)) {
    const oldSet = {
      id: 'set_' + Date.now(),
      name: 'เซตที่ 1',
      groups: cd.groups || [],
      weekStars: cd.weekStars || {}
    };
    cd.sets = [oldSet];
    cd.currentSetId = oldSet.id;
    delete cd.groups;
    delete cd.weekStars;
    delete cd.rankScores;
  }
  
  // Only auto-select if there's exactly 1 set (multi-set requires manual selection)
  if (cd.sets.length === 1 && !cd.currentSetId) {
    cd.currentSetId = cd.sets[0].id;
  }
  
  return cd;
}

// ── Init fields on load ──────────────────────────────────────────
function initStarFields(){
  const st=getState();
  ensureField(st,'starGroups',{});
  const cid=getCid();
  if(cid && !st.starGroups[cid]) st.starGroups[cid]={ sets:[], currentSetId: null };
}
if(document.readyState!=='loading') setTimeout(initStarFields,1500);
else document.addEventListener('DOMContentLoaded',()=>setTimeout(initStarFields,1500));

W.openStarGroupModal = function(){
  const cid=getCid();
  if(!cid){ alert2('กรุณาเลือกรายวิชา','กรุณาเปิดรายวิชาก่อนใช้งาน'); return; }
  if(typeof window.schoolhubPlanAllows === 'function' && !window.schoolhubPlanAllows('allowStars')) {
      if(typeof window.showCustomAlert === 'function') window.showCustomAlert('ไม่มีสิทธิ์ใช้งาน','แผนปัจจุบันไม่รองรับระบบดาว กรุณาอัปเกรดแผน', true);
      return;
  }
  const cd = starCourseData(cid);
  // ทุกครั้งที่ "เข้ามา" ใหม่ (เปิด modal) และมีเซทตั้งแต่ 2 ขึ้นไป ให้เริ่มที่ "-- เลือกเซต --"
  // เสมอ ไม่ยึดค่าที่เคยเลือกไว้ในรอบก่อน — ตรงตามที่ต้องการ: 1 เซท = auto-select,
  // 2+ เซท = ต้องเลือกเองทุกครั้งที่เข้ามา
  if ((cd.sets || []).length > 1) cd.currentSetId = null;
  renderStarSetSelector();
  shStarRender();
  document.getElementById('sh-star-modal').classList.remove('hidden');
};

W.shStarClose=function(){ document.getElementById('sh-star-modal').classList.add('hidden'); };

// สร้าง/รีเฟรช dropdown "เลือกเซต" เท่านั้น — เรียกเฉพาะตอนที่รายการเซทเปลี่ยนจริงๆ
// (เปิด modal ใหม่ / เพิ่ม / ลบ / เปลี่ยนชื่อเซท) ห้ามเรียกจาก shStarRender ทุกครั้งที่
// กดดาวหรือสลับสัปดาห์ เพราะการเขียน innerHTML ทับ <select> ขณะที่มันกำลังยิง
// event "change" ของตัวเอง (เช่นตอนผู้ใช้เพิ่งเลือกเซทอื่น) ทำให้ค่าที่เพิ่งเลือกเด้ง
// กลับไปที่ placeholder ได้ในบางเบราว์เซอร์ — นี่คือสาเหตุของปัญหา "เลือกเซทอื่นไม่ติด"
function renderStarSetSelector(){
  const cid=getCid(); if(!cid) return;
  const cd=starCourseData(cid);
  const sets = cd.sets || [];
  const setSel = document.getElementById('sh-star-set-select');
  if (!setSel) return;

  let opts = '';
  if (sets.length === 1) {
    if (!cd.currentSetId) cd.currentSetId = sets[0].id;
    opts = `<option value="${sets[0].id}" selected>${esc(sets[0].name)}</option>`;
  } else if (sets.length > 1) {
    if (cd.currentSetId && !sets.some(s => s.id === cd.currentSetId)) cd.currentSetId = null;
    opts = '<option value="">-- เลือกเซต --</option>';
    sets.forEach(s => {
      opts += `<option value="${s.id}" ${s.id===cd.currentSetId?'selected':''}>${esc(s.name)}</option>`;
    });
  } else {
    opts = '<option value="">ยังไม่มีเซต</option>';
  }
  setSel.innerHTML = opts;
  setSel.value = cd.currentSetId || '';
}

W.shStarRender=function(){
  const cid=getCid(); if(!cid) return;
  const cd=starCourseData(cid);
  const sets = cd.sets || [];

  // หมายเหตุ: ตัว dropdown "เลือกเซต" ไม่ถูกแตะจากฟังก์ชันนี้แล้ว — ดู renderStarSetSelector()
  // ด้านบน เพื่อไม่ให้ไปรบกวนค่าที่ผู้ใช้เพิ่งเลือกขณะ event "change" ของ select ยังทำงานอยู่

  // Render Week Selector (Always force manual selection — placeholder as default)
  const weekSel = document.getElementById('sh-star-week');
  if (weekSel) {
    // Always ensure placeholder exists
    const hasPlaceholder = weekSel.options.length > 0 && weekSel.options[0].value === '';
    if (weekSel.options.length === 0 || !hasPlaceholder) {
      let opts = '<option value="">-- เลือกสัปดาห์ --</option>';
      const maxW = (typeof window.getCurrentPlanWeekLimit === 'function') ? window.getCurrentPlanWeekLimit() : 20;
      for(let i=1; i<=maxW; i++) opts += `<option value="${i}">สัปดาห์ที่ ${i}</option>`;
      weekSel.innerHTML = opts;
    }
    // NOTE: previously there was a line here that force-reset weekSel.value
    // back to '' whenever it equalled '1'. The intent was "don't auto-select
    // week 1 when the modal first opens", but shStarRender() also runs every
    // time the week <select> fires its own onchange — so the moment a user
    // picked "สัปดาห์ที่ 1" from the dropdown, this render immediately reset
    // it back to the placeholder, making week 1 look unselectable. It's been
    // removed: when the options are freshly rebuilt above, no <option> has
    // the "selected" attribute, so the browser already defaults to the first
    // option (the placeholder) on its own — no manual reset needed.
  }

  const week = parseInt(weekSel.value);
  const container=document.getElementById('sh-star-list');
  if(!container) return;

  // Check conditions for showing groups
  if (!cd.currentSetId) {
    if (sets.length === 0) {
      container.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:40px 20px;background:#f8fafc;border-radius:20px;border:2px dashed #e2e8f0">
        <i class="fas fa-layer-group" style="font-size:32px;margin-bottom:12px;display:block"></i>
        ยังไม่มีเซตกลุ่ม — กรุณาไปที่ <b>ตั้งค่า</b> เพื่อสร้างเซตใหม่
      </div>`;
    } else {
      container.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:40px 20px;background:#f8fafc;border-radius:20px;border:2px dashed #e2e8f0">
        <i class="fas fa-hand-pointer" style="font-size:32px;margin-bottom:12px;display:block"></i>
        กรุณาเลือก <b>เซต</b> จากด้านบน
      </div>`;
    }
    return;
  }
  
  if (isNaN(week)) {
    container.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:40px 20px;background:#f8fafc;border-radius:20px;border:2px dashed #e2e8f0">
      <i class="fas fa-calendar-week" style="font-size:32px;margin-bottom:12px;display:block"></i>
      กรุณาเลือก <b>สัปดาห์</b> จากด้านบน
    </div>`;
    return;
  }

  const currentSet = sets.find(s => s.id === cd.currentSetId);
  if (!currentSet) return;

  const groups = currentSet.groups || [];
  const weekKey = 'w' + week;
  const weekStars = (currentSet.weekStars && currentSet.weekStars[weekKey]) || {};

  if(!groups.length){
    container.innerHTML='<div style="text-align:center;color:#94a3b8;padding:30px 20px;background:#f8fafc;border-radius:20px"><i class="fas fa-users-slash" style="font-size:28px;display:block;margin-bottom:8px"></i>ยังไม่มีกลุ่ม — เพิ่มกลุ่มที่ <span style="color:#ea580c;font-weight:800">ตั้งค่า</span> ด้านบน</div>';
    return;
  }

  const MAX=10;
  const ranked=[...groups].map(g=>({...g,stars:weekStars[g.id]||0})).sort((a,b)=>b.stars-a.stars);
  
  container.innerHTML=ranked.map((g,idx)=>{
    const rankEmoji=idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':('#'+(idx+1));
    const starsHtml=Array.from({length:MAX},(_,i)=>{
      return `<button type="button" class="sh-star-btn ${i<g.stars?'filled':''}"
        onclick="shStarSet('${g.id}',${i+1})" title="${i+1} ดาว">⭐</button>`;
    }).join('');
    
    // Get member names
    const students = getStudents(cid);
    const memberNames = (g.members || []).map(mid => {
      const s = students.find(x => x.id === mid);
      return s ? (s.name || mid) : mid;
    });

    return `<div class="sh-group-card">
      <div class="sh-group-top">
        <div style="display:flex;flex-direction:column;gap:2px">
          <span class="sh-group-name">${rankEmoji} ${esc(g.name)}</span>
          <span style="font-size:11px;color:#92400e;opacity:0.8;font-weight:600">${memberNames.length > 0 ? memberNames.join(', ') : 'ไม่มีสมาชิก'}</span>
        </div>
        <span class="sh-group-star-count">⭐ ${g.stars}</span>
      </div>
      <div class="sh-stars-row">${starsHtml}</div>
    </div>`;
  }).join('');
};

W.shStarSelectSet = function(id){
  const cid=getCid(); if(!cid) return;
  const cd=starCourseData(cid);
  cd.currentSetId = id || null;
  // Reset week selection when changing set
  const weekSel = document.getElementById('sh-star-week');
  if(weekSel) weekSel.value = '';
  shStarRender();
};

W.shStarSet=function(gid, count){
  const cid=getCid(); if(!cid) return;
  const week=parseInt(document.getElementById('sh-star-week').value);
  if(isNaN(week)) return;
  
  const cd=starCourseData(cid);
  const currentSet = cd.sets.find(s => s.id === cd.currentSetId);
  if (!currentSet) return;

  const weekKey='w'+week;
  ensureField(currentSet,'weekStars',{}); ensureField(currentSet.weekStars,weekKey,{});
  const cur=currentSet.weekStars[weekKey][gid]||0;
  currentSet.weekStars[weekKey][gid]=(cur===count)?0:count;
  shStarRender();
};

// ── Settings & Management ────────────────────────────────────────
W.shStarOpenSettings = function(){
  const cid=getCid(); if(!cid) return;
  shStarSetRender();
  document.getElementById('sh-starset-modal').classList.remove('hidden');
};

function shStarSetRender(){
  const cid=getCid(); if(!cid) return;
  const cd=starCourseData(cid);
  const sets = cd.sets || [];
  const container = document.getElementById('sh-starset-list');
  if(!container) return;

  if(!sets.length){
    container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px">ยังไม่มีเซตกลุ่ม</div>';
    return;
  }

  container.innerHTML = sets.map(s => `
    <div class="sh-starset-card">
      <div class="sh-starset-info">
        <span class="sh-starset-name">${esc(s.name)}</span>
        <span class="sh-starset-meta">${(s.groups||[]).length} กลุ่ม</span>
      </div>
      <div class="sh-starset-actions">
        <button class="sh-btn-blue-sm" onclick="shStarRenameSet('${s.id}')" title="แก้ไขชื่อเซต"><i class="fas fa-pen mr-1"></i>แก้ไขชื่อ</button>
        <button class="sh-btn-purple-sm" onclick="shStarOpenGroupModal('${s.id}', '${esc(s.name)}')"><i class="fas fa-users mr-1"></i>ดู/เพิ่ม กลุ่ม</button>
        <button class="sh-btn-red-sm" onclick="shStarDelSet('${s.id}')">ลบ</button>
      </div>
    </div>
  `).join('');
}

W.shStarRenameSet = async function(id){
  const cid=getCid(); if(!cid) return;
  const cd=starCourseData(cid);
  const set = (cd.sets||[]).find(s => s.id === id);
  if(!set) return;
  const newName = prompt('แก้ไขชื่อเซต', set.name || '');
  if(newName === null) return;
  const trimmed = newName.trim();
  if(!trimmed){ alert2('ชื่อไม่ถูกต้อง','กรุณากรอกชื่อเซต'); return; }
  set.name = trimmed;
  shStarSetRender();
  renderStarSetSelector();
  shStarRender();
  await dbSave();
};

W.shStarAddSet = function(){
  const inp = document.getElementById('sh-new-set-name');
  const name = inp.value.trim();
  if(!name) return;
  const cid=getCid(); if(!cid) return;
  const cd=starCourseData(cid);
  const newSet = { id: 'set_'+Date.now(), name: name, groups: [], weekStars: {} };
  cd.sets.push(newSet);
  // Auto-select only when this is the one and only set. Once there are 2+
  // sets, selection must always be made manually — even if one was already
  // auto-selected earlier while it was the sole set.
  cd.currentSetId = (cd.sets.length === 1) ? newSet.id : null;
  inp.value = '';
  shStarSetRender();
  renderStarSetSelector();
  shStarRender();
};

W.shStarDelSet = function(id){
  confirm2('ยืนยันการลบเซต','ข้อมูลกลุ่มและดาวทั้งหมดในเซตนี้จะหายไป ต้องการลบใช่หรือไม่?', async ()=>{
    const cid=getCid(); if(!cid) return;
    const cd=starCourseData(cid);
    cd.sets = cd.sets.filter(s => s.id !== id);
    if(cd.currentSetId === id){
      // เหลือเซทเดียว = auto-select ให้; เหลือ 0 หรือ 2+ = ต้องเลือกเอง
      cd.currentSetId = (cd.sets.length === 1) ? cd.sets[0].id : null;
    }
    shStarSetRender();
    renderStarSetSelector();
    shStarRender();
    await dbSave();
  });
};

// ── Group Management inside Set ──
W.__currentEditSetId = null;
W.shStarOpenGroupModal = function(setId, setName){
  W.__currentEditSetId = setId;
  document.getElementById('sh-stargroup-set-name').textContent = setName;
  shStarRenderGroupList();
  document.getElementById('sh-stargroup-modal').classList.remove('hidden');
};

W.shStarGroupClose = function(){
  document.getElementById('sh-stargroup-modal').classList.add('hidden');
  W.__currentEditSetId = null;
  shStarSetRender();
  shStarRender();
};

function shStarRenderGroupList(){
  const cid=getCid(); if(!cid || !W.__currentEditSetId) return;
  const cd=starCourseData(cid);
  const currentSet = cd.sets.find(s => s.id === W.__currentEditSetId);
  if(!currentSet) return;

  const groups = currentSet.groups || [];
  const students = getStudents(cid);
  const container = document.getElementById('sh-stargroup-list');
  
  if(!groups.length){
    container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px">ยังไม่มีกลุ่มในเซตนี้</div>';
    return;
  }

  // Find students already in ANY group in THIS set (cross-group exclusion)
  const usedSids = new Set();
  groups.forEach(g => (g.members||[]).forEach(mid => usedSids.add(mid)));

  container.innerHTML = groups.map(g => {
    const membersHtml = (g.members||[]).map(mid => {
      const s = students.find(x => x.id === mid);
      const name = s ? (s.name || mid) : mid;
      return `<span class="sh-member-chip" onclick="shStarRemoveMember('${g.id}','${mid}')">${esc(name)} <i class="fas fa-times rm"></i></span>`;
    }).join('');

    // Exclude students already assigned to ANY group in this set
    const availableStudents = students.filter(s => !usedSids.has(s.id));
    const addMemberOpts = availableStudents.map(s => `<option value="${s.id}">${esc(s.name||s.id)}</option>`).join('');

    return `
      <div class="sh-group-manage-card">
        <div class="sh-group-manage-header">
          <span class="sh-group-manage-name">${esc(g.name)}</span>
          <div class="sh-group-manage-header-actions">
            <button class="sh-btn-blue-sm" onclick="shStarRenameGroup('${g.id}')" title="แก้ไขชื่อกลุ่ม"><i class="fas fa-pen mr-1"></i>แก้ไขชื่อ</button>
            <button class="sh-del-group" onclick="shStarDelGroup('${g.id}')">ลบกลุ่ม</button>
          </div>
        </div>
        <div class="sh-member-chips">${membersHtml || '<span style="font-size:11px;color:#94a3b8">ยังไม่มีสมาชิก</span>'}</div>
        <div class="sh-add-member-row">
          <select onchange="if(this.value) shStarAddMember('${g.id}', this.value)">
            <option value="">-- เพิ่มนักเรียนเข้ากลุ่ม --</option>
            ${addMemberOpts}
          </select>
        </div>
      </div>
    `;
  }).join('');
}

W.shStarAddGroup = function(){
  const inp = document.getElementById('sh-new-grp-name');
  const name = inp.value.trim();
  if(!name || !W.__currentEditSetId) return;
  const cid=getCid(); if(!cid) return;
  const cd=starCourseData(cid);
  const currentSet = cd.sets.find(s => s.id === W.__currentEditSetId);
  if(!currentSet) return;

  currentSet.groups.push({ id: 'sg_'+Date.now(), name: name, members: [] });
  inp.value = '';
  shStarRenderGroupList();
};

W.shStarDelGroup = function(gid){
  confirm2('ยืนยันการลบกลุ่ม','ต้องการลบกลุ่มนี้ใช่หรือไม่?', ()=>{
    const cid=getCid(); if(!cid || !W.__currentEditSetId) return;
    const cd=starCourseData(cid);
    const currentSet = cd.sets.find(s => s.id === W.__currentEditSetId);
    if(!currentSet) return;
    currentSet.groups = currentSet.groups.filter(g => g.id !== gid);
    shStarRenderGroupList();
  });
};

W.shStarRenameGroup = function(gid){
  const cid=getCid(); if(!cid || !W.__currentEditSetId) return;
  const cd=starCourseData(cid);
  const currentSet = cd.sets.find(s => s.id === W.__currentEditSetId);
  if(!currentSet) return;
  const grp = currentSet.groups.find(g => g.id === gid);
  if(!grp) return;
  const newName = prompt('แก้ไขชื่อกลุ่ม', grp.name || '');
  if(newName === null) return;
  const trimmed = newName.trim();
  if(!trimmed){ alert2('ชื่อไม่ถูกต้อง','กรุณากรอกชื่อกลุ่ม'); return; }
  grp.name = trimmed;
  shStarRenderGroupList();
};

W.shStarAddMember = function(gid, mid){
  const cid=getCid(); if(!cid || !W.__currentEditSetId) return;
  const cd=starCourseData(cid);
  const currentSet = cd.sets.find(s => s.id === W.__currentEditSetId);
  if(!currentSet) return;
  const grp = currentSet.groups.find(g => g.id === gid);
  if(!grp) return;
  if(!grp.members) grp.members = [];
  // Double-check: ensure student is not in another group in this set
  const alreadyUsed = currentSet.groups.some(g => g.id !== gid && (g.members||[]).includes(mid));
  if(alreadyUsed){
    alert2('ไม่สามารถเพิ่มได้','นักเรียนคนนี้ถูกเพิ่มในกลุ่มอื่นของเซตนี้แล้ว');
    return;
  }
  if(!grp.members.includes(mid)) grp.members.push(mid);
  shStarRenderGroupList();
};

W.shStarRemoveMember = function(gid, mid){
  const cid=getCid(); if(!cid || !W.__currentEditSetId) return;
  const cd=starCourseData(cid);
  const currentSet = cd.sets.find(s => s.id === W.__currentEditSetId);
  if(!currentSet) return;
  const grp = currentSet.groups.find(g => g.id === gid);
  if(!grp) return;
  grp.members = (grp.members || []).filter(x => x !== mid);
  shStarRenderGroupList();
};

W.shStarSave=async function(){
  const ok=await dbSave();
  if(ok!==false){
    W.shStarClose();
    if(typeof W.renderCourseOverview==='function') W.renderCourseOverview();
    alert2('บันทึกสำเร็จ','บันทึกข้อมูลดาวกลุ่มเรียบร้อย');
  }
};

// ── Leave Reason ─────────────────────────────────────────────────
W.openLeaveReasonView = function(cid, date, sid){
  const st = getState();
  const s = (st.students||[]).find(x=>x.id===sid);
  document.getElementById('sh-lv-cid').value = cid;
  document.getElementById('sh-lv-date').value = date;
  document.getElementById('sh-lv-sid').value = sid;
  document.getElementById('sh-lv-name').textContent = s ? (s.name||sid) : sid;
  document.getElementById('sh-lv-dateshow').textContent = 'วันที่: '+date;
  const existing = (st.attendance&&st.attendance[cid]&&st.attendance[cid][date]
    &&st.attendance[cid][date].leaveReasons&&st.attendance[cid][date].leaveReasons[sid])||'';
  document.getElementById('sh-lv-text').value = existing;
  const exBox = document.getElementById('sh-lv-existing');
  if(existing){ exBox.style.display='block'; document.getElementById('sh-lv-existing-text').textContent=existing; }
  else exBox.style.display='none';
  document.getElementById('sh-leave-modal').classList.remove('hidden');
};
W.shLeaveClose = function(){ document.getElementById('sh-leave-modal').classList.add('hidden'); };
W.shLeaveSave = async function(){
  const cid=document.getElementById('sh-lv-cid').value;
  const date=document.getElementById('sh-lv-date').value;
  const sid=document.getElementById('sh-lv-sid').value;
  const reason=document.getElementById('sh-lv-text').value.trim();
  if(!cid||!date||!sid) return;
  const st=getState();
  ensureField(st,'attendance',{});
  ensureField(st.attendance,cid,{});
  ensureField(st.attendance[cid],date,{records:{},leaveReasons:{},updatedAt:Date.now()});
  ensureField(st.attendance[cid][date],'leaveReasons',{});
  st.attendance[cid][date].leaveReasons[sid]=reason;
  await dbSave();
  W.shLeaveClose();
  alert2('บันทึกสำเร็จ','บันทึกเหตุผลการลาเรียบร้อย');
};

// ── Bonus Scores ─────────────────────────────────────────────────
W.openBonusScoreModal = function(){
  const cid=getCid();
  if(!cid){ alert2('กรุณาเลือกรายวิชา','กรุณาเปิดรายวิชาก่อนใช้งาน'); return; }
  ensureField(getState(),'bonusScores',{});
  ensureField(getState().bonusScores,cid,{});
  shBonusRender();
  document.getElementById('sh-bonus-modal').classList.remove('hidden');
};
W.shBonusClose = function(){ document.getElementById('sh-bonus-modal').classList.add('hidden'); };
W.shBonusRender = function(){
  const cid=getCid(); if(!cid) return;
  const weekSel = document.getElementById('sh-bonus-week');
  if (weekSel && weekSel.options.length === 0) {
    let opts = '<option value="">-- เลือกสัปดาห์ --</option>';
    for(let i=1; i<=20; i++) opts += `<option value="${i}">สัปดาห์ที่ ${i}</option>`;
    weekSel.innerHTML = opts;
  }
  const week=parseInt(weekSel.value)||1;
  const weekKey='w'+week;
  const st=getState();
  ensureField(st,'bonusScores',{}); ensureField(st.bonusScores,cid,{});
  const weekData=st.bonusScores[cid][weekKey]||{};
  const students=getStudents(cid);
  const tbody=document.getElementById('sh-bonus-tbody');
  if(!tbody) return;
  if(!students.length){ tbody.innerHTML='<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:20px">ไม่มีนักเรียนในรายวิชานี้</td></tr>'; return; }
  tbody.innerHTML=students.map((s,i)=>{
    const v=weekData[s.id]!==undefined?weekData[s.id]:'';
    return `<tr><td style="text-align:center;color:#64748b;font-weight:700">${i+1}</td>
      <td style="font-weight:600;color:#1e293b">${esc(s.name||s.id)}</td>
      <td style="text-align:center"><input type="number" min="0" max="999" step="0.5" class="sh-bonus-input" data-sid="${s.id}" value="${v}" placeholder="0"></td></tr>`;
  }).join('');
};
W.shBonusSave = async function(){
  const cid=getCid(); if(!cid) return;
  const week=parseInt(document.getElementById('sh-bonus-week').value)||1;
  const weekKey='w'+week;
  const st=getState();
  ensureField(st,'bonusScores',{}); ensureField(st.bonusScores,cid,{});
  const data={};
  document.querySelectorAll('#sh-bonus-tbody .sh-bonus-input').forEach(inp=>{
    const sid=inp.dataset.sid, v=inp.value.trim();
    data[sid]=(v!==''&&!isNaN(Number(v)))?Number(v):'';
  });
  st.bonusScores[cid][weekKey]=data;
  await dbSave();
  W.shBonusClose();
  if(typeof W.renderCourseOverview==='function') W.renderCourseOverview();
  alert2('บันทึกสำเร็จ','บันทึกคะแนนโบนัสสัปดาห์ที่ '+week+' เรียบร้อย');
};

})(window);
