
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

// ── OVERVIEW: Attendance detail popup (double-click on เช็คชื่อ cell) ─
W.shOvShowAttendanceDetail = function(sid, name, jsonEnc){
  const detail = JSON.parse(decodeURIComponent(jsonEnc));
  const thMonth = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  function fmt(d){
    const parts=String(d).split('-');
    if(parts.length!==3) return d;
    return parseInt(parts[2],10)+' '+thMonth[parseInt(parts[1],10)-1]+' '+(parseInt(parts[0],10)+543);
  }
  eid('sh-detail-title').innerHTML = '<div style="display:flex;flex-direction:column;gap:2px;line-height:1.35"><span><i class="fas fa-calendar-check" style="color:#0891b2;margin-right:6px"></i>การเข้าเรียน</span><span style="font-size:12.5px;font-weight:500;color:#94a3b8">' + name + '</span></div>';
  function section(label, color, list, isLeave){
    if(!list.length) return '<div class="sh-breakdown-row"><span class="sh-breakdown-label" style="color:'+color+';font-weight:800">'+label+' (0)</span></div>';
    const items = list.map(function(item){
      if(isLeave){
        return '<div style="padding:4px 0 4px 12px;font-size:12px;color:#475569">• '+fmt(item.date)+(item.reason?' — เหตุผล: '+item.reason:' — <span style="color:#94a3b8">ไม่ได้ระบุเหตุผล</span>')+'</div>';
      }
      return '<div style="padding:4px 0 4px 12px;font-size:12px;color:#475569">• '+fmt(item)+'</div>';
    }).join('');
    return '<div class="sh-breakdown-row" style="flex-direction:column;align-items:flex-start"><span class="sh-breakdown-label" style="color:'+color+';font-weight:800">'+label+' ('+list.length+')</span>'+items+'</div>';
  }
  eid('sh-detail-body').innerHTML =
    section('มา', '#059669', detail.present||[]) +
    section('สาย', '#d97706', detail.late||[]) +
    section('ขาด', '#e11d48', detail.absent||[]) +
    section('ลา', '#7c3aed', detail.leave||[], true);
  eid('sh-detail-modal').classList.remove('hidden');
};

// ── Bonus merge-into-total settings (double-click on +โบนัส header) ─
W.shOvOpenBonusMergeSettings = function(cid){
  cid = cid || getCid();
  if(!cid) return;
  if(typeof window.schoolhubAssertCanEditCourse === 'function' && !window.schoolhubAssertCanEditCourse(cid, 'ตั้งค่าการรวมคะแนนโบนัส')) return;
  initFields();
  const s = st();
  ensureField(s, 'bonusMergeSettings', {});
  const cur = s.bonusMergeSettings[cid] || { enabled:false, percent:100, mode:'all', selected:[] };
  const students = getStudents(cid).filter(function(x){ return !window.isStudentWithdrawn(x); });
  let modal = document.getElementById('sh-bonus-merge-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sh-bonus-merge-modal';
    modal.className = 'sh-overlay hidden';
    document.body.appendChild(modal);
  }
  const studentRows = students.map(function(st2){
    const checked = (cur.mode==='selected' && (cur.selected||[]).includes(st2.id)) ? 'checked' : '';
    return '<label style="display:flex;align-items:center;gap:8px;padding:5px 4px;border-bottom:1px solid #f1f5f9;font-size:13px"><input type="checkbox" class="sh-bm-student" value="'+st2.id+'" '+checked+'> '+ (st2.name||st2.id) + '</label>';
  }).join('') || '<div style="color:#94a3b8;font-size:13px;padding:8px">ไม่มีนักเรียนในรายวิชานี้</div>';
  modal.innerHTML =
    '<div style="background:#fff;border-radius:20px;max-width:440px;width:100%;max-height:86vh;overflow:auto;padding:22px">' +
      '<h3 style="font-weight:900;font-size:18px;margin-bottom:4px"><i class="fas fa-plus-circle" style="color:#059669;margin-right:6px"></i>ตั้งค่าการรวมคะแนนโบนัส</h3>' +
      '<p style="color:#64748b;font-size:12px;margin-bottom:14px">เลือกว่าจะนำคะแนนโบนัสไปรวมกับคะแนนรวมทั้งหมดหรือไม่ กี่เปอร์เซ็นต์ และรวมให้เฉพาะใคร</p>' +
      '<label style="display:flex;align-items:center;gap:8px;font-weight:700;margin-bottom:10px"><input type="checkbox" id="sh-bm-enabled" '+(cur.enabled?'checked':'')+'> รวมคะแนนโบนัสในคะแนนรวม</label>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><label style="font-size:13px;font-weight:700;color:#475569">รวมกี่เปอร์เซ็นต์:</label><input type="number" id="sh-bm-percent" min="0" max="100" value="'+(cur.percent!=null?cur.percent:100)+'" style="width:80px;border:1px solid #cbd5e1;border-radius:8px;padding:4px 8px"> <span>%</span></div>' +
      '<div style="margin-bottom:8px"><label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700"><input type="radio" name="sh-bm-mode" value="all" '+(cur.mode!=='selected'?'checked':'')+'> รวมให้นักเรียนทุกคน</label>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;margin-top:4px"><input type="radio" name="sh-bm-mode" value="selected" '+(cur.mode==='selected'?'checked':'')+'> เลือกเฉพาะบางคน</label></div>' +
      '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:6px 10px;max-height:220px;overflow:auto;margin-bottom:16px">'+studentRows+'</div>' +
      '<div style="display:flex;gap:10px"><button type="button" onclick="document.getElementById(\'sh-bonus-merge-modal\').classList.add(\'hidden\')" style="flex:1;background:#f1f5f9;color:#334155;border:none;border-radius:12px;padding:10px;font-weight:800;cursor:pointer">ยกเลิก</button>' +
      '<button type="button" onclick="shOvSaveBonusMergeSettings(\''+cid+'\')" style="flex:1;background:#059669;color:#fff;border:none;border-radius:12px;padding:10px;font-weight:800;cursor:pointer">บันทึก</button></div>' +
    '</div>';
  modal.classList.remove('hidden');
};
W.shOvSaveBonusMergeSettings = async function(cid){
  if(typeof window.schoolhubAssertCanEditCourse === 'function' && !window.schoolhubAssertCanEditCourse(cid, 'ตั้งค่าการรวมคะแนนโบนัส')) return;
  const s = st();
  ensureField(s, 'bonusMergeSettings', {});
  const enabled = !!(document.getElementById('sh-bm-enabled') && document.getElementById('sh-bm-enabled').checked);
  const percent = Number(document.getElementById('sh-bm-percent') && document.getElementById('sh-bm-percent').value) || 0;
  const modeEl = document.querySelector('input[name="sh-bm-mode"]:checked');
  const mode = modeEl ? modeEl.value : 'all';
  const selected = Array.prototype.map.call(document.querySelectorAll('.sh-bm-student:checked'), function(el){ return el.value; });
  s.bonusMergeSettings[cid] = { enabled: enabled, percent: percent, mode: mode, selected: selected };
  await dbSave();
  const modal = document.getElementById('sh-bonus-merge-modal');
  if(modal) modal.classList.add('hidden');
  if(typeof W.renderCourseOverview==='function') W.renderCourseOverview();
  shAlert('บันทึกสำเร็จ','บันทึกการตั้งค่าคะแนนโบนัสเรียบร้อยแล้ว');
};

// ── Bonus Score Modal ────────────────────────────────────────────
W.openBonusScoreModal = function(){
  const cid=getCid();
  if(!cid){ shAlert('กรุณาเลือกรายวิชา','กรุณาเปิดรายวิชาก่อนใช้งาน'); return; }
  initFields();
  ensureField(st().bonusScores,cid,{});
  eid('sh-bonus-week').value=1;
  shBonusRender();
  eid('sh-bonus-modal').classList.remove('hidden');
};
W.shBonusClose = function(){ eid('sh-bonus-modal').classList.add('hidden'); };
W.shBonusRender = function(){
  const cid=getCid(); if(!cid) return;
  const week=parseInt(eid('sh-bonus-week').value)||1;
  const weekKey='w'+week;
  initFields();
  ensureField(st().bonusScores,cid,{});
  const weekData=(st().bonusScores[cid][weekKey])||{};
  const students=getStudents(cid);
  const tbody=eid('sh-bonus-tbody'); if(!tbody) return;
  if(!students.length){ tbody.innerHTML='<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:20px">ไม่มีนักเรียนในรายวิชานี้</td></tr>'; return; }
  tbody.innerHTML=students.map(function(s,i){
    const v=weekData[s.id]!==undefined?weekData[s.id]:'';
    return '<tr><td style="text-align:center;color:#64748b;font-weight:700">'+(i+1)+'</td>'
      +'<td style="font-weight:600;color:#1e293b">'+(s.name||s.id)+'</td>'
      +'<td style="text-align:center"><input type="number" min="0" max="999" step="0.5" class="sh-bonus-input" data-sid="'+s.id+'" value="'+v+'" placeholder="0"></td></tr>';
  }).join('');
};
W.shBonusSave = async function(){
  const cid=getCid(); if(!cid) return;
  const week=parseInt(eid('sh-bonus-week').value)||1;
  const weekKey='w'+week;
  initFields();
  ensureField(st().bonusScores,cid,{});
  const data={};
  document.querySelectorAll('#sh-bonus-tbody .sh-bonus-input').forEach(function(inp){
    const sid=inp.dataset.sid; const v=inp.value.trim();
    data[sid]=(v!==''&&!isNaN(Number(v)))?Number(v):'';
  });
  st().bonusScores[cid][weekKey]=data;
  const ok=await dbSave();
  if(ok!==false){
    W.shBonusClose();
    if(typeof W.renderCourseOverview==='function') W.renderCourseOverview();
    shAlert('บันทึกสำเร็จ','บันทึกคะแนนโบนัสสัปดาห์ที่ '+week+' เรียบร้อย');
  }
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
  // auto-scroll to the new group so teacher can immediately add members
  setTimeout(function(){
    var el=eid('sg-'+newGid);
    if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
  },60);
};
W.shStarDelGroup=function(gid){
  const cid=getCid(); if(!cid) return;
  shConfirm('ยืนยันการลบ','ต้องการลบกลุ่มนี้ใช่หรือไม่?',function(){
    const cd=starCD(cid);
    cd.groups=cd.groups.filter(function(g){ return g.id!==gid; });
    shStarRender();
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
};
W.shStarRemoveMember=function(gid,mid){
  const cid=getCid(); if(!cid) return;
  const cd=starCD(cid);
  const grp=cd.groups.find(function(g){ return g.id===gid; }); if(!grp) return;
  grp.members=(grp.members||[]).filter(function(x){ return x!==mid; });
  shStarRender();
};
W.shStarApplyBonus=function(){
  const cid=getCid(); if(!cid) return;
  const week=parseInt(eid('sh-star-week').value)||1;
  const weekKey='w'+week;
  const r1=Number(eid('sh-r1').value)||0;
  const r2=Number(eid('sh-r2').value)||0;
  const r3=Number(eid('sh-r3').value)||0;
  const cd=starCD(cid);
  const groups=cd.groups||[];
  if(!groups.length){ shAlert('ไม่มีกลุ่ม','กรุณาเพิ่มกลุ่มก่อน'); return; }
  const weekStars=(cd.weekStars&&cd.weekStars[weekKey])||{};
  const ranked=[...groups].map(function(g){ return Object.assign({},g,{stars:weekStars[g.id]||0}); }).sort(function(a,b){ return b.stars-a.stars; });
  initFields();
  ensureField(st().bonusScores,cid,{});
  if(!st().bonusScores[cid][weekKey]) st().bonusScores[cid][weekKey]={};
  ensureField(cd,'rankScores',{});
  cd.rankScores[weekKey]={r1,r2,r3};
  const courseStudents=getStudents(cid);
  const sidSet=new Set(courseStudents.map(function(s){ return s.id; }));
  let applied=0;
  ranked.forEach(function(g,idx){
    const pts=idx===0?r1:idx===1?r2:idx===2?r3:0;
    if(!pts) return;
    (g.members||[]).forEach(function(mid){
      if(!sidSet.has(mid)) return;
      const cur=st().bonusScores[cid][weekKey][mid];
      st().bonusScores[cid][weekKey][mid]=(cur!==undefined&&cur!==''?Number(cur):0)+pts;
      applied++;
    });
  });
  dbSave();
  shAlert('แปลงดาวเป็นโบนัสสำเร็จ',
    'สัปดาห์ที่ '+week+'\n🥇 อันดับ 1: +'+r1+' คะแนน\n🥈 อันดับ 2: +'+r2+' คะแนน\n🥉 อันดับ 3: +'+r3+' คะแนน'
    +(applied>0?'\n\n✅ อัปเดตคะแนนโบนัสให้ '+applied+' คน':'\n\n⚠️ ยังไม่มีสมาชิกในกลุ่ม — เพิ่มสมาชิกในกลุ่มก่อน'));
};
W.shStarSave=async function(){
  const ok=await dbSave();
  if(ok!==false){
    W.shStarClose();
    if(typeof W.renderCourseOverview==='function') W.renderCourseOverview();
    shAlert('บันทึกสำเร็จ','บันทึกข้อมูลดาวกลุ่มเรียบร้อย');
  }
};

// ── Attendance radio change: show/hide "เหตุผลการลา" button immediately ─
// (previously the button only appeared after saving attendance and
// re-selecting the date; now it appears the instant "ลา" is picked)
W.schoolhubOnAttRadioChange = function(sid, cid, date, val){
  const wrap = document.getElementById('leave-btn-wrap-' + sid);
  if(!wrap) return;
  if(val === 'leave'){
    const safeCid = String(cid).replace(/'/g,"\\'");
    const safeDate = String(date).replace(/'/g,"\\'");
    const safeSid = String(sid).replace(/'/g,"\\'");
    const isMobileCardView = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
    wrap.innerHTML = isMobileCardView
      ? '<button type="button" onclick="openLeaveReasonView(\''+safeCid+'\',\''+safeDate+'\',\''+safeSid+'\')" style="font-size:11px;background:#ede9fe;color:#7c3aed;border:1px solid #c4b5fd;border-radius:8px;padding:4px 10px;font-weight:700;width:100%;text-align:center;cursor:pointer;margin-top:4px"><i class="fas fa-align-left mr-1"></i>เหตุผลการลา</button>'
      : '<button type="button" onclick="openLeaveReasonView(\''+safeCid+'\',\''+safeDate+'\',\''+safeSid+'\')" class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-lg font-bold border border-purple-200 hover:bg-purple-200"><i class="fas fa-align-left mr-1"></i>เหตุผล</button>';
  } else {
    wrap.innerHTML = '';
  }
};

// ── Leave Reason ─────────────────────────────────────────────────
W.openLeaveReasonView = function(cid,date,sid){
  const s=(st().students||[]).find(function(x){ return x.id===sid; });
  eid('sh-lv-cid').value=cid; eid('sh-lv-date').value=date; eid('sh-lv-sid').value=sid;
  eid('sh-lv-name').textContent=s?(s.name||sid):sid;
  eid('sh-lv-dateshow').textContent='วันที่: '+date;
  const existing=(st().attendance&&st().attendance[cid]&&st().attendance[cid][date]
    &&st().attendance[cid][date].leaveReasons&&st().attendance[cid][date].leaveReasons[sid])||'';
  eid('sh-lv-text').value=existing;
  const exBox=eid('sh-lv-existing');
  if(existing){ exBox.style.display='block'; eid('sh-lv-existing-text').textContent=existing; }
  else exBox.style.display='none';
  eid('sh-leave-modal').classList.remove('hidden');
};
W.shLeaveClose=function(){ eid('sh-leave-modal').classList.add('hidden'); };
W.shLeaveSave=async function(){
  const cid=eid('sh-lv-cid').value, date=eid('sh-lv-date').value, sid=eid('sh-lv-sid').value;
  const reason=eid('sh-lv-text').value.trim();
  if(!cid||!date||!sid) return;
  const s=st();
  ensureField(s,'attendance',{});
  ensureField(s.attendance,cid,{});
  ensureField(s.attendance[cid],date,{records:{},leaveReasons:{},updatedAt:Date.now()});
  ensureField(s.attendance[cid][date],'leaveReasons',{});
  s.attendance[cid][date].leaveReasons[sid]=reason;
  const ok=await dbSave();
  if(ok!==false){ W.shLeaveClose(); shAlert('บันทึกสำเร็จ','บันทึกเหตุผลการลาเรียบร้อย'); }
};

// ── Sidebar nav buttons (add to course context menu) ─────────────
// Inject bonus/star buttons after grade criteria button using MutationObserver
// (the menu might render dynamically)
function injectSidebarButtons(){
  // DISABLED: the static sidebar HTML already contains the "คะแนนโบนัสรายสัปดาห์"
  // and "ระบบดาวกลุ่ม" buttons (see #course-context-menu markup). This injector
  // used to add a second copy of those buttons, which caused the duplicated
  // menu items reported by users. Kept as a no-op instead of being removed
  // entirely so any other code that still calls injectSidebarButtons() does
  // not break.
  const menu=document.getElementById('course-context-menu');
  if(menu) menu.dataset.shBtnsInjected='1';
  // Clean up any previously-injected duplicate buttons from earlier sessions
  // (defensive: in case this ran before on the same page load).
  if(menu){
    const dups=menu.querySelectorAll('button');
    const seen={};
    dups.forEach(function(btn){
      const label=(btn.textContent||'').trim();
      if(label==='คะแนนโบนัสรายสัปดาห์' || label==='ระบบดาวกลุ่ม'){
        if(seen[label]){ btn.remove(); } else { seen[label]=true; }
      }
    });
  }
  return;
}
// Try immediately and after DOMContentLoaded, also on switchCourseTab
setTimeout(injectSidebarButtons,500);
setTimeout(injectSidebarButtons,1500);
document.addEventListener('DOMContentLoaded',function(){ setTimeout(injectSidebarButtons,500); });

// Patch switchCourseTab to inject buttons when course context menu appears
const _origSwitchCourse=W.switchCourseTab;
W.switchCourseTab=function(tabId){
  if(typeof _origSwitchCourse==='function') _origSwitchCourse.apply(W,arguments);
  setTimeout(injectSidebarButtons,100);
};
const _origSwitchView=W.switchView;
W.switchView=function(){
  if(typeof _origSwitchView==='function') _origSwitchView.apply(W,arguments);
  setTimeout(injectSidebarButtons,100);
};

})(window);
