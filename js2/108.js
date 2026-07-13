
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
    // Multi-Set aware: loop through all sets
    const sets = cd.sets || [];
    sets.forEach(function(set){
      var groups = (set.groups||[]).filter(function(g){ return (g.members||[]).includes(sid); });
      if(set.weekStars && set.weekStars[wk]){
        groups.forEach(function(g){ set.weekStars[wk][g.id] = 0; });
      }
    });
    // Also handle old structure if exists
    if(cd.groups && cd.weekStars){
      var oldGroups = (cd.groups||[]).filter(function(g){ return (g.members||[]).includes(sid); });
      oldGroups.forEach(function(g){ if(cd.weekStars[wk]) cd.weekStars[wk][g.id] = 0; });
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
    // Multi-Set aware: loop through all sets
    const sets = cd.sets || [];
    sets.forEach(function(set){
      var groups = (set.groups||[]).filter(function(g){ return (g.members||[]).includes(sid); });
      if(set.weekStars){
        Object.keys(set.weekStars).forEach(function(wk){
          groups.forEach(function(g){ if(set.weekStars[wk]) set.weekStars[wk][g.id] = 0; });
        });
      }
    });
    // Also handle old structure if exists
    if(cd.groups && cd.weekStars){
      var oldGroups = (cd.groups||[]).filter(function(g){ return (g.members||[]).includes(sid); });
      Object.keys(cd.weekStars).forEach(function(wk){
        oldGroups.forEach(function(g){ if(cd.weekStars[wk]) cd.weekStars[wk][g.id] = 0; });
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
  const weekSel=eid('sh-bonus-week');
  if(weekSel){
    // ลบค่า HTML ที่เก็บไว้ใน dataset เพื่อบังคับให้ initStaticDropdowns ทำงานใหม่
    weekSel.dataset.schoolhubFinalOptionsHtml='';
    if(typeof window.initStaticDropdowns === 'function') window.initStaticDropdowns();

    // Fallback: ถ้ายังไม่มี options ให้สร้างเอง
    if(weekSel.options.length === 0){
      let html='';
      const maxW = (typeof window.getCurrentPlanWeekLimit === 'function') ? window.getCurrentPlanWeekLimit() : 20;
      for(let i=1;i<=maxW;i++) html+='<option value="'+i+'">สัปดาห์ที่ '+i+'</option>';
      weekSel.innerHTML=html;
    }

    weekSel.value=1;
    // สั่ง Rebuild UI ให้ Enhancer วาดตัวเลือกใหม่
    setTimeout(function(){
      if(typeof window.schoolhubDDEnhancer === 'object' && typeof window.schoolhubDDEnhancer.rebuild === 'function'){
        window.schoolhubDDEnhancer.rebuild('sh-bonus-week');
      }
    }, 10);
  }
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
// NOTE: starCD is DISABLED — 107.js handles all star group logic with Multi-Set.
// This stub exists only for compatibility and will NOT overwrite 107.js data.
function starCD(cid){
  initFields();
  var existing = st().starGroups[cid];
  if (!existing) {
    st().starGroups[cid] = { sets:[], currentSetId: null };
  }
  // If old single-set structure exists, migrate it (same as 107.js)
  if (existing && existing.groups && (!existing.sets || existing.sets.length === 0)) {
    existing.sets = [{
      id: 'set_' + Date.now(),
      name: 'เซตที่ 1',
      groups: existing.groups || [],
      weekStars: existing.weekStars || {}
    }];
    existing.currentSetId = existing.sets[0].id;
    delete existing.groups;
    delete existing.weekStars;
    delete existing.rankScores;
  }
  return st().starGroups[cid];
}
// NOTE: openStarGroupModal is handled by 107.js (Multi-Set version).
// This stub ensures plan check still works but defers rendering to 107.js.
W.openStarGroupModal = function(){
  const cid=getCid();
  if(!cid){ shAlert('กรุณาเลือกรายวิชา','กรุณาเปิดรายวิชาก่อนใช้งาน'); return; }
  if(typeof window.schoolhubPlanAllows === 'function' && !window.schoolhubPlanAllows('allowStars')) {
      if(typeof window.showCustomAlert === 'function') window.showCustomAlert('ไม่มีสิทธิ์ใช้งาน','แผนปัจจุบันไม่รองรับระบบดาว กรุณาอัปเกรดแผน', true);
      return;
  }
  // Use 107.js multi-set version if available
  if(typeof window.starCourseData === 'function'){
    // Migrate if needed (call starCD for backward compat, but 107.js handles it)
    if(!st().starGroups[cid] || (!st().starGroups[cid].sets && !st().starGroups[cid].groups)) {
      starCD(cid);
    }
  } else {
    starCD(cid);
  }
  // If 107.js version exists, use it directly
  if(typeof window._shStarOpenStarGroupModal107 === 'function'){
    window._shStarOpenStarGroupModal107();
    return;
  }
  // Otherwise use the 107.js openStarGroupModal directly
  if(typeof window.openStarGroupModal === 'function' && window.openStarGroupModal !== W.openStarGroupModal){
    // 107.js already defined it, just call it
    return;
  }
  // Fallback: use initStaticDropdowns for week selector (like bonus modal)
  const weekSel=eid('sh-star-week');
  if(weekSel && weekSel.options.length === 0){
    // Rebuild options without auto-selecting week 1
    weekSel.dataset.schoolhubFinalOptionsHtml='';
    if(typeof window.initStaticDropdowns === 'function') window.initStaticDropdowns();
    if(weekSel.options.length === 0){
      let html='<option value="">-- เลือกสัปดาห์ --</option>';
      const maxW = (typeof window.getCurrentPlanWeekLimit === 'function') ? window.getCurrentPlanWeekLimit() : 20;
      for(let i=1;i<=maxW;i++) html+='<option value="'+i+'">สัปดาห์ที่ '+i+'</option>';
      weekSel.innerHTML=html;
    }
    // DO NOT auto-select week 1 — let user choose manually
  }
  // Delegate to 107.js shStarRender if available
  if(typeof window.shStarRender === 'function'){
    window.shStarRender();
  } else {
    shStarRender();
  }
  eid('sh-star-modal').classList.remove('hidden');
};
W.shStarClose=function(){ eid('sh-star-modal').classList.add('hidden'); };
// NOTE: shStarRender, shStarSet, shStarAddGroup, shStarDelGroup, shStarAddMember, shStarRemoveMember
// are all handled by 107.js (Multi-Set version). These stubs prevent errors but
// delegate to 107.js implementations when available.
W.shStarRender=function(){
  if(typeof window.shStarRender === 'function' && window.shStarRender !== W.shStarRender) return;
  // Fallback for when 107.js isn't loaded yet
  const cid=getCid(); if(!cid) return;
  const weekSel=eid('sh-star-week');
  const week=weekSel && weekSel.value ? parseInt(weekSel.value) : NaN;
  const cd=starCD(cid);
  const groups=cd.groups||[];
  const weekKey=isNaN(week) ? null : 'w'+week;
  const weekStars=weekKey ? ((cd.weekStars&&cd.weekStars[weekKey])||{}) : {};
  const container=eid('sh-star-list'); if(!container) return;
  if(!groups.length){
    container.innerHTML='<div style="text-align:center;color:#94a3b8;padding:20px;font-size:14px"><i class="fas fa-users" style="font-size:28px;display:block;margin-bottom:8px"></i>ยังไม่มีกลุ่ม — เพิ่มกลุ่มที่ <span style="color:#ea580c;font-weight:800">ตั้งค่า</span> ด้านบน</div>';
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
    const memberNames=(g.members||[]).map(function(mid){
      const s=allStudents.find(function(x){ return x.id===mid; });
      return s ? `<span class="sh-member-chip">${escSafe(s.name||s.id)}<span class="rm" onmousedown="shStarRemoveMember('${g.id}','${mid}')">✕</span></span>` : '';
    }).join('');
    return `<div class="sh-group-card" id="sg-${g.id}">
      <div class="sh-group-top"><span class="sh-group-name">${rankEmoji} ${g.name}</span>
      <div style="display:flex;gap:6px;align-items:center">
      <span class="sh-group-star-count">⭐ ${g.stars} ดาว</span></div></div>
      <div class="sh-stars-row">${starsHtml}</div>
      <div class="sh-member-chips" style="margin-top:8px">${memberNames}</div>
      </div>`;
  }).join('');
};
function escSafe(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// NOTE: The following star group functions are stubs that delegate to 107.js.
// 107.js defines the real Multi-Set implementations.
W.shStarSet=function(gid,count){
  if(typeof window.shStarSet === 'function' && window.shStarSet !== W.shStarSet) return;
  const cid=getCid(); if(!cid) return;
  const weekSel=eid('sh-star-week');
  const week=weekSel ? parseInt(weekSel.value) : NaN;
  if(isNaN(week)) return;
  const cd=starCD(cid);
  const currentSet = (cd.sets||[]).find(function(s){ return s.id===cd.currentSetId; }) || cd;
  const weekKey='w'+week;
  ensureField(currentSet,'weekStars',{}); ensureField(currentSet.weekStars,weekKey,{});
  const cur=currentSet.weekStars[weekKey][gid]||0;
  currentSet.weekStars[weekKey][gid]=(cur===count)?0:count;
  shStarRender();
  dbSave().catch(e => console.error('Auto-save star set failed:', e));
};
W.shStarAddGroup=function(){
  if(typeof window.shStarAddGroup === 'function' && window.shStarAddGroup !== W.shStarAddGroup) return;
  const inp=eid('sh-new-grp-name'); const name=(inp?inp.value.trim():'');
  if(!name){ shAlert('กรุณากรอกชื่อกลุ่ม','กรุณากรอกชื่อกลุ่มก่อนเพิ่ม'); return; }
  const cid=getCid(); if(!cid) return;
  const cd=starCD(cid);
  const currentSet = (cd.sets||[]).find(function(s){ return s.id===cd.currentSetId; });
  if(!currentSet) return;
  const newGid='sg'+Date.now();
  currentSet.groups.push({id:newGid,name:name,members:[]});
  if(inp) inp.value='';
  shStarRender();
  dbSave().catch(e => console.error('Auto-save add group failed:', e));
  setTimeout(function(){
    var el=eid('sg-'+newGid);
    if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
  },60);
};
W.shStarDelGroup=function(gid){
  if(typeof window.shStarDelGroup === 'function' && window.shStarDelGroup !== W.shStarDelGroup) return;
  const cid=getCid(); if(!cid) return;
  shConfirm('ยืนยันการลบ','ต้องการลบกลุ่มนี้ใช่หรือไม่?',async function(){
    const cd=starCD(cid);
    const currentSet = (cd.sets||[]).find(function(s){ return s.id===cd.currentSetId; });
    if(!currentSet) return;
    currentSet.groups=currentSet.groups.filter(function(g){ return g.id!==gid; });
    shStarRender();
    await dbSave();
    shAlert('ลบสำเร็จ','ลบกลุ่มเรียบร้อยแล้ว');
  });
};
W.shStarAddMember=function(gid, mid){
  if(typeof window.shStarAddMember === 'function' && window.shStarAddMember !== W.shStarAddMember) return;
  const cid=getCid(); if(!cid) return;
  mid = mid || (function(){ var sel=eid('sh-mem-sel-'+gid); return sel?sel.value:''; })();
  if(!mid) return;
  const cd=starCD(cid);
  const currentSet = (cd.sets||[]).find(function(s){ return s.id===cd.currentSetId; });
  if(!currentSet) return;
  const grp=currentSet.groups.find(function(g){ return g.id===gid; }); if(!grp) return;
  if(!grp.members) grp.members=[];
  if(!grp.members.includes(mid)) grp.members.push(mid);
  shStarRender();
  dbSave().catch(e => console.error('Auto-save add member failed:', e));
};
W.shStarRemoveMember=function(gid,mid){
  if(typeof window.shStarRemoveMember === 'function' && window.shStarRemoveMember !== W.shStarRemoveMember) return;
  const cid=getCid(); if(!cid) return;
  const cd=starCD(cid);
  const currentSet = (cd.sets||[]).find(function(s){ return s.id===cd.currentSetId; });
  if(!currentSet) return;
  const grp=currentSet.groups.find(function(g){ return g.id===gid; }); if(!grp) return;
  grp.members=(grp.members||[]).filter(function(x){ return x!==mid; });
  shStarRender();
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

// ── Attendance radio change: show/hide "เหตุผลการลา" button immediately ─
// (previously the button only appeared after saving attendance and
// re-selecting the date; now it appears the instant "ลา" is picked)
W.schoolhubOnAttRadioChange = function(sid, cid, date, val){
  // 1. จัดการ UI ให้เปลี่ยนสถานะทันที (Instant UI Feedback)
  const parentActions = document.querySelector(`input[name="att_${sid}"]`)?.closest('.schoolhub-mobile-att-actions');
  if(parentActions){
    parentActions.querySelectorAll('.schoolhub-mobile-att-btn').forEach(btn => {
      btn.classList.remove('is-active');
      const input = btn.querySelector('input');
      if(input && input.value === val) {
        btn.classList.add('is-active');
        input.checked = true;
      }
    });
  }

  // 2. จัดการปุ่มเหตุผลการลา
  const wrap = document.getElementById('leave-btn-wrap-' + sid);
  if(wrap){
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
