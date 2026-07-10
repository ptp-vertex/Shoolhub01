
/* ================================================================
   SchoolHub v2 patch — all new feature logic
   ================================================================ */
(function(W){
'use strict';

// ── helpers ──────────────────────────────────────────────────────
function st(){ return W.state || {}; }
function eid(id){ return document.getElementById(id); }
function getCid(){ return W.currentActiveCourseId || null; }
function getStudents(cid){ return typeof W.getCourseStudents==='function' ? W.getCourseStudents(cid) : []; }
async function dbSave(){ if(typeof W.saveStateToDB==='function') return W.saveStateToDB(); return Promise.resolve(); }
function shAlert(title, msg){ if(typeof W.showCustomAlert==='function') W.showCustomAlert(title,msg); else alert(title+': '+msg); }
function shConfirm(title, msg, cb){ if(typeof W.showCustomConfirm==='function') W.showCustomConfirm(title,msg,cb); else { if(confirm(title+'\n'+msg)) cb(); } }
function ensureField(obj,key,def){ if(obj[key]==null) obj[key]=def; }

// Init state fields
function initFields(){
  var s=st();
  if(!s.bonusScores) s.bonusScores={};
  if(!s.starGroups) s.starGroups={};
  W.state=s;
}
if(document.readyState!=='loading') setTimeout(initFields,1500);
else document.addEventListener('DOMContentLoaded',()=>setTimeout(initFields,1500));

// ── OVERVIEW: Bonus detail popup (click) — supports per-row delete ─
W.shOvShowBonusDetail = function(sid, name, jsonEnc, cid){
  cid = cid || getCid();
  const detail = JSON.parse(decodeURIComponent(jsonEnc));
  eid('sh-detail-title').innerHTML = '<div style="display:flex;flex-direction:column;gap:2px;line-height:1.35"><span><i class="fas fa-plus-circle" style="color:#059669;margin-right:6px"></i>โบนัส</span><span style="font-size:12.5px;font-weight:500;color:#94a3b8">' + name + '</span></div>';
  if(!detail.length){
    eid('sh-detail-body').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px">ยังไม่มีคะแนนโบนัส</div>';
  } else {
    let total=0;
    const rows = detail.map(function(d){
      total+=d.val;
      return '<div class="sh-breakdown-row"><span class="sh-breakdown-label">สัปดาห์ที่ '+d.week+'</span><span style="display:flex;align-items:center;gap:8px"><span class="sh-breakdown-val" style="color:#059669">+'+d.val+' คะแนน</span><button type="button" onclick="shOvDeleteBonusEntry(\''+cid+'\',\''+sid+'\','+d.week+')" title="ลบรายการนี้" style="background:#fee2e2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;width:24px;height:24px;cursor:pointer;font-weight:800;line-height:1">×</button></span></div>';
    }).join('');
    eid('sh-detail-body').innerHTML = rows +
      '<div class="sh-breakdown-row" style="margin-top:8px;border-top:2px solid #d1fae5"><span class="sh-breakdown-label" style="font-weight:800">รวมโบนัสทั้งหมด</span><span class="sh-breakdown-val" style="color:#059669;font-size:16px">+'+total+' คะแนน</span></div>' +
      '<button type="button" onclick="shOvDeleteAllBonusEntries(\''+cid+'\',\''+sid+'\')" style="width:100%;margin-top:10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:10px;padding:8px;font-weight:800;cursor:pointer"><i class="fas fa-trash mr-1"></i>ลบประวัติโบนัสทั้งหมดของนักเรียนคนนี้</button>';
  }
  eid('sh-detail-modal').classList.remove('hidden');
};

W.shOvShowStarDetail = function(sid, name, jsonEnc, cid){
  cid = cid || getCid();
  const detail = JSON.parse(decodeURIComponent(jsonEnc));
  eid('sh-detail-title').innerHTML = '<div style="display:flex;flex-direction:column;gap:2px;line-height:1.35"><span>⭐ ดาว</span><span style="font-size:12.5px;font-weight:500;color:#94a3b8">' + name + '</span></div>';
  if(!detail.length){
    eid('sh-detail-body').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px">ยังไม่มีดาวสะสม</div>';
  } else {
    let total=0;
    const rows = detail.map(function(d){
      total+=d.stars;
      return '<div class="sh-breakdown-row"><span class="sh-breakdown-label">สัปดาห์ที่ '+d.week+'</span><span style="display:flex;align-items:center;gap:8px"><span class="sh-breakdown-val" style="color:#d97706">'+d.stars+' ⭐</span><button type="button" onclick="shOvDeleteStarEntry(\''+cid+'\',\''+sid+'\','+d.week+')" title="ลบรายการนี้" style="background:#fee2e2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;width:24px;height:24px;cursor:pointer;font-weight:800;line-height:1">×</button></span></div>';
    }).join('');
    eid('sh-detail-body').innerHTML = rows +
      '<div class="sh-breakdown-row" style="margin-top:8px;border-top:2px solid #fef3c7"><span class="sh-breakdown-label" style="font-weight:800">รวมดาวทั้งหมด</span><span class="sh-breakdown-val" style="color:#d97706;font-size:16px">'+total+' ⭐</span></div>' +
      '<button type="button" onclick="shOvDeleteAllStarEntries(\''+cid+'\',\''+sid+'\')" style="width:100%;margin-top:10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:10px;padding:8px;font-weight:800;cursor:pointer"><i class="fas fa-trash mr-1"></i>ลบประวัติดาวทั้งหมดของนักเรียนคนนี้</button>';
  }
  eid('sh-detail-modal').classList.remove('hidden');
};

// ── Delete individual / all bonus entries for a student ────────────
W.shOvDeleteBonusEntry = function(cid, sid, week){
  if(typeof window.schoolhubAssertCanEditCourse === 'function' && !window.schoolhubAssertCanEditCourse(cid, 'ลบคะแนนโบนัส')) return;
  shConfirm('ยืนยันการลบ', 'ต้องการลบคะแนนโบนัสสัปดาห์ที่ '+week+' ของนักเรียนคนนี้ใช่หรือไม่?', async function(){
    const s = st();
    const wk = 'w'+week;
    if(s.bonusScores && s.bonusScores[cid] && s.bonusScores[cid][wk]){
      delete s.bonusScores[cid][wk][sid];
    }
    await dbSave();
    eid('sh-detail-modal').classList.add('hidden');
    if(typeof W.renderCourseOverview==='function') W.renderCourseOverview();
    shAlert('ลบสำเร็จ','ลบคะแนนโบนัสรายการนี้เรียบร้อยแล้ว');
  });
};
W.shOvDeleteAllBonusEntries = function(cid, sid){
  if(typeof window.schoolhubAssertCanEditCourse === 'function' && !window.schoolhubAssertCanEditCourse(cid, 'ลบคะแนนโบนัส')) return;
  shConfirm('ยืนยันการลบ', 'ต้องการลบประวัติคะแนนโบนัสทั้งหมดของนักเรียนคนนี้ใช่หรือไม่?', async function(){
    const s = st();
    const byCid = (s.bonusScores && s.bonusScores[cid]) || {};
    Object.keys(byCid).forEach(function(wk){ if(byCid[wk]) delete byCid[wk][sid]; });
    await dbSave();
    eid('sh-detail-modal').classList.add('hidden');
    if(typeof W.renderCourseOverview==='function') W.renderCourseOverview();
    shAlert('ลบสำเร็จ','ลบประวัติคะแนนโบนัสทั้งหมดเรียบร้อยแล้ว');
  });
};
W.shOvDeleteStarEntry = function(cid, sid, week){
  if(typeof window.schoolhubAssertCanEditCourse === 'function' && !window.schoolhubAssertCanEditCourse(cid, 'ลบดาว')) return;
  shConfirm('ยืนยันการลบ', 'ต้องการลบดาวสัปดาห์ที่ '+week+' ของนักเรียนคนนี้ใช่หรือไม่?', async function(){
    const s = st();
    const wk = 'w'+week;
    const cd = (s.starGroups && s.starGroups[cid]) || {};
    const groups = (cd.groups||[]).filter(function(g){ return (g.members||[]).includes(sid); });
    if(cd.weekStars && cd.weekStars[wk]){
      groups.forEach(function(g){ cd.weekStars[wk][g.id] = 0; });
    }
    await dbSave();
    eid('sh-detail-modal').classList.add('hidden');
    if(typeof W.renderCourseOverview==='function') W.renderCourseOverview();
    shAlert('ลบสำเร็จ','ลบดาวรายการนี้เรียบร้อยแล้ว');
  });
};
W.shOvDeleteAllStarEntries = function(cid, sid){
  if(typeof window.schoolhubAssertCanEditCourse === 'function' && !window.schoolhubAssertCanEditCourse(cid, 'ลบดาว')) return;
  shConfirm('ยืนยันการลบ', 'ต้องการลบประวัติดาวทั้งหมดของนักเรียนคนนี้ใช่หรือไม่?', async function(){
    const s = st();
    const cd = (s.starGroups && s.starGroups[cid]) || {};
    const groups = (cd.groups||[]).filter(function(g){ return (g.members||[]).includes(sid); });
    if(cd.weekStars){
      Object.keys(cd.weekStars).forEach(function(wk){
        groups.forEach(function(g){ if(cd.weekStars[wk]) cd.weekStars[wk][g.id] = 0; });
      });
    }
    await dbSave();
    eid('sh-detail-modal').classList.add('hidden');
    if(typeof W.renderCourseOverview==='function') W.renderCourseOverview();
    shAlert('ลบสำเร็จ','ลบประวัติดาวทั้งหมดเรียบร้อยแล้ว');
  });
};

// ── Star Groups ──────────────────────────────────────────────────
function starCD(cid){
  initFields();
  if(!st().starGroups[cid]) st().starGroups[cid]={groups:[],weekStars:{},rankScores:{}};
  return st().starGroups[cid];
}
W.openStarGroupModal = function(){
  const cid=getCid();
  if(!cid){ shAlert('กรุณาเลือกรายวิชา','กรุณาเปิดรายวิชาก่อนใช้งาน'); return; }
  if(typeof window.schoolhubPlanAllows === 'function' && !window.schoolhubPlanAllows('allowStars')) {
      if(typeof window.showCustomAlert === 'function') window.showCustomAlert('ไม่มีสิทธิ์ใช้งาน','แผนปัจจุบันไม่รองรับระบบดาว กรุณาอัปเกรดแผน', true);
      return;
  }
  starCD(cid);
  eid('sh-star-week').value=1;
  shStarRender();
  eid('sh-star-modal').classList.remove('hidden');
};
W.shStarClose=function(){ eid('sh-star-modal').classList.add('hidden'); };
W.shStarRender=function(){
  const cid=getCid(); if(!cid) return;
  const week=parseInt(eid('sh-star-week').value)||1;
  const weekKey='w'+week;
  const cd=starCD(cid);
  const groups=cd.groups||[];
  const weekStars=(cd.weekStars&&cd.weekStars[weekKey])||{};
  const container=eid('sh-star-list'); if(!container) return;
  if(!groups.length){
    container.innerHTML='<div style="text-align:center;color:#94a3b8;padding:20px;font-size:14px"><i class="fas fa-users" style="font-size:28px;display:block;margin-bottom:8px"></i>ยังไม่มีกลุ่ม — เพิ่มกลุ่มด้านล่าง</div>';
    return;
  }
  const MAX=10;
  const allStudents=getStudents(cid);
  const ranked=[...groups].map(function(g){ return Object.assign({},g,{stars:weekStars[g.id]||0}); }).sort(function(a,b){ return b.stars-a.stars; });
  container.innerHTML=ranked.map(function(g,idx){
    const rankEmoji=idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':('#'+(idx+1));
    const starsHtml=Array.from({length:MAX},function(_,i){
      return `<button type="button" class="sh-star-btn ${i<g.stars?'filled':''}" onmousedown="shStarSet('${g.id}',${i+1})" title="${i+1} ดาว">⭐</button>`;
    }).join('');
    // Members
    const memberNames=(g.members||[]).map(function(mid){
      const s=allStudents.find(function(x){ return x.id===mid; });
      return s ? `<span class="sh-member-chip">${escSafe(s.name||s.id)}<span class="rm" onmousedown="shStarRemoveMember('${g.id}','${mid}')">✕</span></span>` : '';
    }).join('');
    const addMemberOpts=allStudents.filter(function(s){ return !(g.members||[]).includes(s.id); }).map(function(s){
      return `<option value="${s.id}">${escSafe(s.name||s.id)}</option>`;
    }).join('');
    return `<div class="sh-group-card" id="sg-${g.id}">
      <div class="sh-group-top"><span class="sh-group-name">${rankEmoji} ${g.name}</span>
      <div style="display:flex;gap:6px;align-items:center">
      <span class="sh-group-star-count">⭐ ${g.stars} ดาว</span>
      <button class="sh-del-group" onmousedown="shStarDelGroup('${g.id}')">ลบ</button></div></div>
      <div class="sh-stars-row">${starsHtml}</div>
      <div class="sh-member-chips" style="margin-top:8px">${memberNames}</div>
      <div class="sh-add-member-row"><select id="sh-mem-sel-${g.id}"><option value="">-- เพิ่มสมาชิก --</option>${addMemberOpts}</select>
      <button onmousedown="shStarAddMember('${g.id}')">เพิ่ม</button></div>
      </div>`;
  }).join('');
};
function escSafe(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
W.shStarSet=function(gid,count){
  const cid=getCid(); if(!cid) return;
  const week=parseInt(eid('sh-star-week').value)||1;
  const weekKey='w'+week;
  const cd=starCD(cid);
  ensureField(cd,'weekStars',{}); ensureField(cd.weekStars,weekKey,{});
  const cur=cd.weekStars[weekKey][gid]||0;
  cd.weekStars[weekKey][gid]=(cur===count)?0:count;
  shStarRender();
  // Auto-save ทันที
  dbSave().catch(e => console.error('Auto-save star set failed:', e));
};
W.shStarAddGroup=function(){
  const inp=eid('sh-new-grp'); const name=(inp?inp.value.trim():'');
  if(!name){ shAlert('กรุณากรอกชื่อกลุ่ม','กรุณากรอกชื่อกลุ่มก่อนเพิ่ม'); return; }
  const cid=getCid(); if(!cid) return;
  const cd=starCD(cid);
  const newGid='sg'+Date.now();
  cd.groups.push({id:newGid,name,members:[]});
  if(inp) inp.value='';
  shStarRender();
  // Auto-save ทันที
  dbSave().catch(e => console.error('Auto-save add group failed:', e));
  // auto-scroll to the new group so teacher can immediately add members
  setTimeout(function(){
    var el=eid('sg-'+newGid);
    if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
  },60);
};
W.shStarDelGroup=function(gid){
  const cid=getCid(); if(!cid) return;
  shConfirm('ยืนยันการลบ','ต้องการลบกลุ่มนี้ใช่หรือไม่?',async function(){
    const cd=starCD(cid);
    cd.groups=cd.groups.filter(function(g){ return g.id!==gid; });
    shStarRender();
    // Auto-save ทันที
    await dbSave();
    shAlert('ลบสำเร็จ','ลบกลุ่มเรียบร้อยแล้ว');
  });
};
W.shStarAddMember=function(gid){
  const cid=getCid(); if(!cid) return;
  const sel=eid('sh-mem-sel-'+gid); if(!sel||!sel.value) return;
  const mid=sel.value;
  const cd=starCD(cid);
  const grp=cd.groups.find(function(g){ return g.id===gid; }); if(!grp) return;
  if(!grp.members) grp.members=[];
  if(!grp.members.includes(mid)) grp.members.push(mid);
  shStarRender();
  // Auto-save ทันที
  dbSave().catch(e => console.error('Auto-save add member failed:', e));
};
W.shStarRemoveMember=function(gid,mid){
  const cid=getCid(); if(!cid) return;
  const cd=starCD(cid);
  const grp=cd.groups.find(function(g){ return g.id===gid; }); if(!grp) return;
  grp.members=(grp.members||[]).filter(function(x){ return x!==mid; });
  shStarRender();
  // Auto-save ทันที
  dbSave().catch(e => console.error('Auto-save remove member failed:', e));
};
// NOTE: the old rank-based "แปลงดาวเป็นโบนัส" feature (r1/r2/r3 inputs inside
// the star-group modal) has been retired and replaced by the new
// "แปลงดาวเป็นคะแนน" feature accessible via double-click on the ⭐ดาว column
// header in the course overview table (see shStarConvertOpen). Kept as a
// harmless redirect in case any old markup still calls it.
W.shStarApplyBonus=function(){
  const cid=getCid(); if(!cid) return;
  if(typeof W.shStarConvertOpen==='function'){ W.shStarClose(); W.shStarConvertOpen(cid); }
};
W.shStarSave=async function(){
  const ok=await dbSave();
  if(ok!==false){
    W.shStarClose();
    if(typeof W.renderCourseOverview==='function') W.renderCourseOverview();
    shAlert('บันทึกสำเร็จ','บันทึกข้อมูลดาวกลุ่มเรียบร้อย');
  }
};

})(window);
