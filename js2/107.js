
/* ================================================================
   SchoolHub Patch — Leave / Bonus / Star logic
   ================================================================ */
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
  const week=parseInt(document.getElementById('sh-bonus-week').value)||1;
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
      <td style="font-weight:600;color:#1e293b">${s.name||s.id}</td>
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

// ── Star Groups ──────────────────────────────────────────────────
function starCourseData(cid){
  const st=getState();
  ensureField(st,'starGroups',{});
  if(!st.starGroups[cid]) st.starGroups[cid]={sets:[],weekStars:{},rankScores:{}};
  
  const cd = st.starGroups[cid];
  // Migration: ถ้ายังมีข้อมูลแบบเก่า (groups) ให้ย้ายไปอยู่ใน set แรก
  if(cd.groups && cd.groups.length > 0 && (!cd.sets || cd.sets.length === 0)){
    cd.sets = [{
      id: 'set_' + Date.now(),
      name: 'เซ็ทที่ 1',
      groups: cd.groups,
      weekStars: cd.weekStars || {}
    }];
    delete cd.groups;
    delete cd.weekStars;
  }
  
  // ตรวจสอบว่ามี currentSetId หรือไม่
  if(!cd.currentSetId && cd.sets && cd.sets.length > 0){
    cd.currentSetId = cd.sets[0].id;
  }
  
  return cd;
}
W.openStarGroupModal = function(){
  const cid=getCid();
  if(!cid){ alert2('กรุณาเลือกรายวิชา','กรุณาเปิดรายวิชาก่อนใช้งาน'); return; }
  const cd = starCourseData(cid);
  
  // รีเซ็ตสัปดาห์ให้เป็นว่าง (บังคับเลือก) ตามความต้องการผู้ใช้
  const weekSel = document.getElementById('sh-star-week');
  if(weekSel) {
    weekSel.innerHTML = '<option value="">-- เลือกสัปดาห์ --</option>';
    for(let i=1; i<=52; i++){
      const opt = document.createElement('option');
      opt.value = i; opt.textContent = 'สัปดาห์ที่ ' + i;
      weekSel.appendChild(opt);
    }
    weekSel.value = "";
  }

  shStarRender();
  document.getElementById('sh-star-modal').classList.remove('hidden');
};
W.shStarClose=function(){ document.getElementById('sh-star-modal').classList.add('hidden'); };
W.shStarRender=function(){
  const cid=getCid(); if(!cid) return;
  const cd=starCourseData(cid);
  const sets = cd.sets || [];
  
  // จัดการการแสดงผลตัวเลือกเซ็ท
  const setRow = document.getElementById('sh-star-set-selector-row');
  const setSel = document.getElementById('sh-star-set-id');
  if(sets.length >= 2){
    setRow.classList.remove('hidden');
    let html = !cd.currentSetId ? '<option value="">-- กรุณาเลือกเซ็ท --</option>' : '';
    html += sets.map(s => `<option value="${s.id}" ${s.id===cd.currentSetId?'selected':''}>${s.name}</option>`).join('');
    setSel.innerHTML = html;
    setSel.onchange = function(){ shStarSelectSet(this.value); };
    
    // ถ้ายังไม่เลือกเซ็ท และมีมากกว่า 1 เซ็ท ให้บังคับเลือกก่อน
    if(!cd.currentSetId){
      document.getElementById('sh-star-list').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px;font-size:14px"><i class="fas fa-mouse-pointer" style="font-size:28px;display:block;margin-bottom:8px"></i>กรุณาเลือกเซ็ทกลุ่มก่อน</div>';
      return;
    }
  } else {
    setRow.classList.add('hidden');
    if(sets.length === 1) cd.currentSetId = sets[0].id;
  }

  const weekVal = document.getElementById('sh-star-week').value;
  if(!weekVal){
    document.getElementById('sh-star-list').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px;font-size:14px"><i class="fas fa-calendar-alt" style="font-size:28px;display:block;margin-bottom:8px"></i>กรุณาเลือกสัปดาห์ก่อน</div>';
    return;
  }
  
  const week=parseInt(weekVal);
  const weekKey='w'+week;
  const currentSet = sets.find(s => s.id === cd.currentSetId);
  if(!currentSet) return;

  const groups=currentSet.groups||[];
  const weekStars=(currentSet.weekStars&&currentSet.weekStars[weekKey])||{};
  const container=document.getElementById('sh-star-list');
  if(!container) return;
  
  if(!groups.length){
    container.innerHTML='<div style="text-align:center;color:#94a3b8;padding:20px;font-size:14px"><i class="fas fa-users" style="font-size:28px;display:block;margin-bottom:8px"></i>ยังไม่มีกลุ่มในเซ็ทนี้ — เพิ่มกลุ่มด้านล่าง</div>';
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
    return `<div class="sh-group-card" id="sg-${g.id}">
      <div class="sh-group-top">
        <span class="sh-group-name">${rankEmoji} ${g.name}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="sh-group-star-count">⭐ ${g.stars} ดาว</span>
          <button class="sh-del-group" onclick="shStarDelGroup('${g.id}')">ลบ</button>
        </div>
      </div>
      <div class="sh-stars-row">${starsHtml}</div>
    </div>`;
  }).join('');
};
W.shStarSet=function(gid, count){
  const cid=getCid(); if(!cid) return;
  const weekVal = document.getElementById('sh-star-week').value;
  if(!weekVal) return;
  const week=parseInt(weekVal);
  const weekKey='w'+week;
  const cd=starCourseData(cid);
  const currentSet = (cd.sets||[]).find(s => s.id === cd.currentSetId);
  if(!currentSet) return;
  
  ensureField(currentSet,'weekStars',{}); ensureField(currentSet.weekStars,weekKey,{});
  const cur=currentSet.weekStars[weekKey][gid]||0;
  currentSet.weekStars[weekKey][gid]=(cur===count)?0:count;
  shStarRender();
};
W.shStarAddGroup=function(){
  const inp=document.getElementById('sh-new-grp');
  const name=(inp?inp.value.trim():'');
  if(!name) return;
  const cid=getCid(); if(!cid) return;
  const cd=starCourseData(cid);
  const currentSet = (cd.sets||[]).find(s => s.id === cd.currentSetId);
  if(!currentSet) { alert2('ผิดพลาด','กรุณาเลือกเซ็ทก่อนเพิ่มกลุ่ม'); return; }
  
  currentSet.groups.push({id:'sg'+Date.now(),name,members:[]});
  if(inp) inp.value='';
  dbSave();
  shStarRender();
};
W.shStarDelGroup=function(gid){
  const cid=getCid(); if(!cid) return;
  confirm2('ยืนยันการลบ','ต้องการลบกลุ่มนี้ใช่หรือไม่?',()=>{
    const cd=starCourseData(cid);
    const currentSet = (cd.sets||[]).find(s => s.id === cd.currentSetId);
    if(!currentSet) return;
    currentSet.groups=currentSet.groups.filter(g=>g.id!==gid);
    dbSave();
    shStarRender();
  });
};
W.shStarApplyBonus=function(){
  const cid=getCid(); if(!cid) return;
  const week=parseInt(document.getElementById('sh-star-week').value)||1;
  const weekKey='w'+week;
  const r1=Number(document.getElementById('sh-r1').value)||0;
  const r2=Number(document.getElementById('sh-r2').value)||0;
  const r3=Number(document.getElementById('sh-r3').value)||0;
  const cd=starCourseData(cid);
  const groups=cd.groups||[];
  if(!groups.length){ alert2('ไม่มีกลุ่ม','กรุณาเพิ่มกลุ่มก่อน'); return; }
  const weekStars=(cd.weekStars&&cd.weekStars[weekKey])||{};
  const ranked=[...groups].map(g=>({...g,stars:weekStars[g.id]||0})).sort((a,b)=>b.stars-a.stars);
  const st=getState();
  ensureField(st,'bonusScores',{}); ensureField(st.bonusScores,cid,{});
  if(!st.bonusScores[cid][weekKey]) st.bonusScores[cid][weekKey]={};
  ensureField(cd,'rankScores',{});
  cd.rankScores[weekKey]={r1,r2,r3};
  const courseStudents=getStudents(cid);
  const sidSet=new Set(courseStudents.map(s=>s.id));
  let applied=0;
  ranked.forEach((g,idx)=>{
    const pts=idx===0?r1:idx===1?r2:idx===2?r3:0;
    if(!pts) return;
    (g.members||[]).forEach(mid=>{
      if(!sidSet.has(mid)) return;
      const cur=st.bonusScores[cid][weekKey][mid];
      st.bonusScores[cid][weekKey][mid]=(cur!==undefined&&cur!==''?Number(cur):0)+pts;
      applied++;
    });
  });
  dbSave();
  alert2('แปลงดาวเป็นโบนัสสำเร็จ',
    'สัปดาห์ที่ '+week+'\n🥇 อันดับ 1: +'+r1+' คะแนน\n🥈 อันดับ 2: +'+r2+' คะแนน\n🥉 อันดับ 3: +'+r3+' คะแนน'
    +(applied===0?'\n\n⚠️ หมายเหตุ: ยังไม่มีสมาชิกในกลุ่ม — ไปที่หน้ากลุ่มเพื่อเพิ่มสมาชิก':'\n\n✅ อัปเดตคะแนนให้ '+applied+' คน'));
};
W.shStarSave=async function(){
  const ok=await dbSave();
  if(ok!==false){
    W.shStarClose();
    if(typeof W.renderCourseOverview==='function') W.renderCourseOverview();
    alert2('บันทึกสำเร็จ','บันทึกข้อมูลดาวกลุ่มเรียบร้อย');
  }
};

// ── Star Sets Management ──────────────────────────────────────────
W.shStarOpenSettings = function(){
  const cid=getCid(); if(!cid) return;
  shStarSetRender();
  document.getElementById('sh-starset-modal').classList.remove('hidden');
};
W.shStarSetClose = function(){ document.getElementById('sh-starset-modal').classList.add('hidden'); };
W.shStarSetRender = function(){
  const cid=getCid(); if(!cid) return;
  const cd=starCourseData(cid);
  const sets = cd.sets || [];
  const container = document.getElementById('sh-starset-list');
  if(!container) return;
  
  if(!sets.length){
    container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px">ยังไม่มีเซ็ทกลุ่ม</div>';
    return;
  }
  
  container.innerHTML = sets.map(s => {
    const isActive = s.id === cd.currentSetId;
    return `<div class="sh-starset-card ${isActive?'sh-starset-active':''}">
      <div style="cursor:pointer;flex:1" onclick="shStarSelectSet('${s.id}')">
        <div class="sh-starset-name">${s.name} ${isActive?'<span style="font-size:10px;background:#f59e0b;color:#fff;padding:2px 6px;border-radius:10px;margin-left:4px">ใช้งานอยู่</span>':''}</div>
        <div style="font-size:11px;color:#64748b">${s.groups.length} กลุ่ม</div>
      </div>
      <button class="sh-del-group" onclick="shStarDelSet('${s.id}')">ลบ</button>
    </div>`;
  }).join('');
};
W.shStarSelectSet = function(sid){
  if(!sid) return;
  const cid=getCid(); if(!cid) return;
  const cd=starCourseData(cid);
  cd.currentSetId = sid;
  dbSave();
  shStarRender();
};
W.shStarAddSet = function(){
  const inp = document.getElementById('sh-new-set-name');
  const name = inp ? inp.value.trim() : '';
  if(!name) return;
  const cid=getCid(); if(!cid) return;
  const cd=starCourseData(cid);
  const newId = 'set_' + Date.now();
  cd.sets.push({ id: newId, name: name, groups: [], weekStars: {} });
  if(!cd.currentSetId) cd.currentSetId = newId;
  if(inp) inp.value = '';
  dbSave();
  shStarSetRender();
  shStarRender();
};
W.shStarDelSet = function(sid){
  const cid=getCid(); if(!cid) return;
  confirm2('ยืนยันการลบ','ต้องการลบเซ็ทกลุ่มนี้และข้อมูลดาวทั้งหมดในเซ็ทนี้ใช่หรือไม่?',()=>{
    const cd=starCourseData(cid);
    cd.sets = cd.sets.filter(s => s.id !== sid);
    if(cd.currentSetId === sid) cd.currentSetId = cd.sets.length > 0 ? cd.sets[0].id : null;
    dbSave();
    shStarSetRender();
    shStarRender();
  });
};

// ── Grade preset patch (safety wrapper) ─────────────────────────
setTimeout(function(){
  const _orig=W.applyGradePresetFromButton;
  W.applyGradePresetFromButton=function(){
    try{ if(typeof _orig==='function') _orig.apply(W,arguments); }
    catch(e){ console.warn('[SchoolHub patch] applyGradePresetFromButton:',e); }
  };
},200);

// ── Init new state fields on load ───────────────────────────────
function initNewFields(){
  if(!W.state) return;
  if(!W.state.bonusScores) W.state.bonusScores={};
  if(!W.state.starGroups) W.state.starGroups={};
}
if(document.readyState!=='loading') setTimeout(initNewFields,1500);
else document.addEventListener('DOMContentLoaded',()=>setTimeout(initNewFields,1500));

})(window);
