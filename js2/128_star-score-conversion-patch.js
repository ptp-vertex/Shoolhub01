
/* ================================================================
   SchoolHub Patch — Star → Score Conversion
   ----------------------------------------------------------------
   Replaces the old "แปลงดาวเป็นคะแนนโบนัส" (rank-based r1/r2/r3)
   feature that used to live inside the star-group modal.

   New behaviour:
   - Double-click the ⭐ดาว column header (in the course overview /
     gradebook table) to open settings: choose to convert either the
     TOTAL accumulated stars or a SPECIFIC week's stars, then choose
     where the converted points go:
       • an existing job (งาน) — capped to that job's max score
       • a brand-new item — added as "+โบนัส" into the total score
   - Click (single click) the ⭐ดาว header to see the conversion
     history log, with a delete (×) button per entry that reverses
     the points it added.
   - Score cells in the gradebook that include converted points are
     shown in amber/yellow with a ⭐ marker and a tooltip explaining
     where the extra points came from.
   ================================================================ */
(function(W){
'use strict';

function st(){ return W.state || {}; }
function eid(id){ return document.getElementById(id); }
function getCid(){ return W.currentActiveCourseId || null; }
function getStudents(cid){ return typeof W.getCourseStudents === 'function' ? W.getCourseStudents(cid) : []; }
function dbSave(){ return (typeof W.saveStateToDB === 'function') ? W.saveStateToDB() : Promise.resolve(); }
function shAlert(title, msg){ if(typeof W.showCustomAlert === 'function') W.showCustomAlert(title, msg); else alert(title + ': ' + msg); }
function shConfirm(title, msg, cb){ if(typeof W.showCustomConfirm === 'function') W.showCustomConfirm(title, msg, cb); else { if(confirm(title + '\n' + msg)) cb(); } }
function ensureField(obj, key, def){ if(obj[key] == null) obj[key] = def; }
function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function canEdit(cid, actionName){ return typeof W.schoolhubAssertCanEditCourse !== 'function' || W.schoolhubAssertCanEditCourse(cid, actionName); }

function initFields(){
  var s = st();
  if(!s.starConversions) s.starConversions = {};
  W.state = s;
}
if(document.readyState !== 'loading') setTimeout(initFields, 1500);
else document.addEventListener('DOMContentLoaded', function(){ setTimeout(initFields, 1500); });

// ── Star totals for one student (mirrors the calc used elsewhere) ──
function getStudentStars(cid, sid, scope, week){
  var cd = ((st().starGroups || {})[cid]) || {};
  var groups = (cd.groups || []).filter(function(g){ return (g.members || []).includes(sid); });
  var weekStars = cd.weekStars || {};
  if(scope === 'week'){
    var data = weekStars['w' + week] || {};
    var sum = 0;
    groups.forEach(function(g){ sum += data[g.id] || 0; });
    return sum;
  }
  var total = 0;
  Object.keys(weekStars).forEach(function(wk){
    var data2 = weekStars[wk] || {};
    groups.forEach(function(g){ total += data2[g.id] || 0; });
  });
  return total;
}

function getScope(){
  var r = document.querySelector('input[name="sh-starconv-scope"]:checked');
  return r ? r.value : 'total';
}

function buildTargetOptions(cid){
  var sel = eid('sh-starconv-target');
  var plans = (((st().coursePlans || {})[cid]) || [])
    .filter(function(p){ return Number(p.maxScore) > 0; })
    .slice().sort(function(a,b){ return Number(a.week) - Number(b.week); });
  var html = '<option value="__new__">+ สร้างรายการใหม่ (บวกเป็นโบนัส +คะแนนรวม)</option>';
  html += plans.map(function(p){
    return '<option value="' + esc(p.id) + '">สัปดาห์ ' + esc(p.week) + ' · ' + esc(p.title) + ' (เต็ม ' + esc(p.maxScore) + ')</option>';
  }).join('');
  sel.innerHTML = html;
}

// ── Open / close settings modal ─────────────────────────────────
W.shStarConvertOpen = function(cid){
  cid = cid || getCid();
  if(!cid){ shAlert('กรุณาเลือกรายวิชา', 'กรุณาเปิดรายวิชาก่อนใช้งาน'); return; }
  initFields();
  eid('sh-starconv-cid').value = cid;
  var totalRadio = document.querySelector('input[name="sh-starconv-scope"][value="total"]');
  if(totalRadio) totalRadio.checked = true;
  eid('sh-starconv-week').value = 1;
  buildTargetOptions(cid);
  W.shStarConvertRefresh();
  eid('sh-starconv-modal').classList.remove('hidden');
};
W.shStarConvertClose = function(){ eid('sh-starconv-modal').classList.add('hidden'); };

// ── Refresh the student rows whenever scope / week / target changes ─
W.shStarConvertRefresh = function(){
  var cid = eid('sh-starconv-cid').value; if(!cid) return;
  var scope = getScope();
  var week = parseInt(eid('sh-starconv-week').value) || 1;
  eid('sh-starconv-week').disabled = (scope !== 'week');

  var targetVal = eid('sh-starconv-target').value;
  var plan = null;
  if(targetVal && targetVal !== '__new__'){
    plan = (((st().coursePlans || {})[cid]) || []).find(function(p){ return p.id === targetVal; });
  }

  var maxInfo = eid('sh-starconv-maxinfo');
  var capPerStudent = {};
  if(plan){
    maxInfo.style.display = 'block';
    maxInfo.innerHTML = '<i class="fas fa-circle-info mr-1"></i>งาน "' + esc(plan.title) + '" (สัปดาห์ ' + esc(plan.week) + ') คะแนนเต็ม ' + esc(plan.maxScore) + ' คะแนน — คะแนนที่แปลงจะกรอกได้ไม่เกินคะแนนเต็มของงานนี้ (นับรวมคะแนนเดิมที่มีอยู่แล้ว)';
    var scoreRow = (st().scores || []).find(function(sr){ return String(sr.courseId) === String(cid) && String(sr.week) === String(plan.week) && String(sr.title) === String(plan.title); });
    getStudents(cid).forEach(function(s){
      var existing = scoreRow && scoreRow.records ? scoreRow.records[s.id] : undefined;
      var existingNum = (existing !== undefined && existing !== '' && !isNaN(Number(existing))) ? Number(existing) : 0;
      capPerStudent[s.id] = Math.max(0, Number(plan.maxScore) - existingNum);
    });
  } else {
    maxInfo.style.display = 'none';
    maxInfo.innerHTML = '';
  }

  var students = getStudents(cid);
  var rowsHtml = students.map(function(s){
    var stars = getStudentStars(cid, s.id, scope, week);
    var hasCap = capPerStudent.hasOwnProperty(s.id);
    var cap = hasCap ? capPerStudent[s.id] : null;
    var defaultVal = stars;
    if(cap !== null && defaultVal > cap) defaultVal = cap;
    if(defaultVal < 0) defaultVal = 0;
    var capAttr = cap !== null ? (' max="' + cap + '"') : '';
    var capGuard = cap !== null ? (' oninput="if(parseFloat(this.value)>' + cap + ') this.value=' + cap + ';"') : '';
    return '<tr data-sid="' + esc(s.id) + '">' +
      '<td style="padding:6px 8px;font-weight:600">' + esc(s.name || s.id) + '</td>' +
      '<td style="text-align:center;padding:6px 8px;color:#d97706;font-weight:800">' + stars + ' ⭐</td>' +
      '<td style="text-align:center;padding:6px 8px"><input type="number" min="0" step="0.5"' + capAttr + capGuard +
        ' value="' + (defaultVal > 0 ? defaultVal : '') + '" class="sh-starconv-amt-input" data-sid="' + esc(s.id) + '" style="width:80px;text-align:center;border:1px solid #cbd5e1;border-radius:8px;padding:4px"></td>' +
      '</tr>';
  }).join('');
  eid('sh-starconv-rows').innerHTML = rowsHtml || '<tr><td colspan="3" style="text-align:center;padding:16px;color:#94a3b8">ไม่มีนักเรียนในรายวิชานี้</td></tr>';
};

// ── Confirm conversion ───────────────────────────────────────────
W.shStarConvertConfirm = function(){
  var cid = eid('sh-starconv-cid').value; if(!cid) return;
  if(!canEdit(cid, 'แปลงดาวเป็นคะแนน')) return;

  var scope = getScope();
  var week = parseInt(eid('sh-starconv-week').value) || 1;
  var targetVal = eid('sh-starconv-target').value;
  var isNew = (!targetVal || targetVal === '__new__');
  var plan = null;
  if(!isNew){
    plan = (((st().coursePlans || {})[cid]) || []).find(function(p){ return p.id === targetVal; });
    if(!plan){ shAlert('ไม่พบงานนี้', 'กรุณาเลือกงานปลายทางใหม่'); return; }
  }

  var entries = [];
  var students = getStudents(cid);
  document.querySelectorAll('#sh-starconv-rows .sh-starconv-amt-input').forEach(function(inp){
    var sid = inp.dataset.sid;
    var v = parseFloat(inp.value);
    if(!isNaN(v) && v > 0){
      var s = students.find(function(x){ return x.id === sid; });
      entries.push({ sid: sid, name: s ? (s.name || sid) : sid, amount: v });
    }
  });
  if(!entries.length){ shAlert('ไม่มีคะแนนที่จะแปลง', 'กรุณากรอกคะแนนที่ต้องการแปลงอย่างน้อย 1 คน'); return; }

  var record = {
    id: 'conv' + Date.now() + Math.floor(Math.random() * 1000),
    ts: Date.now(),
    scope: scope,
    sourceWeek: scope === 'week' ? week : null,
    target: isNew
      ? { type: 'new', weekKeyUsed: 'w' + (scope === 'week' ? week : 0) }
      : { type: 'job', planId: plan.id, week: plan.week, title: plan.title, maxScore: plan.maxScore },
    entries: entries,
    totalPoints: entries.reduce(function(a, e){ return a + e.amount; }, 0)
  };

  var s = st();
  if(isNew){
    ensureField(s, 'bonusScores', {}); ensureField(s.bonusScores, cid, {});
    var wk = record.target.weekKeyUsed;
    if(!s.bonusScores[cid][wk]) s.bonusScores[cid][wk] = {};
    entries.forEach(function(e){
      var cur = s.bonusScores[cid][wk][e.sid];
      s.bonusScores[cid][wk][e.sid] = (cur !== undefined && cur !== '' ? Number(cur) : 0) + e.amount;
    });
  } else {
    ensureField(s, 'scores', []);
    var scoreRow = s.scores.find(function(sr){ return String(sr.courseId) === String(cid) && String(sr.week) === String(plan.week) && String(sr.title) === String(plan.title); });
    if(!scoreRow){
      scoreRow = { id: 'auto' + Date.now(), courseId: cid, week: plan.week, title: plan.title, maxScore: plan.maxScore, records: {}, savedAt: new Date().toISOString() };
      s.scores.push(scoreRow);
    }
    entries.forEach(function(e){
      var cur = scoreRow.records[e.sid];
      var curNum = (cur !== undefined && cur !== '' && !isNaN(Number(cur))) ? Number(cur) : 0;
      var next = curNum + e.amount;
      var cap = Number(plan.maxScore);
      if(next > cap) next = cap;
      scoreRow.records[e.sid] = next;
    });
    scoreRow.savedAt = new Date().toISOString();
  }

  ensureField(s, 'starConversions', {}); ensureField(s.starConversions, cid, []);
  s.starConversions[cid].push(record);

  Promise.resolve(dbSave()).then(function(){
    W.shStarConvertClose();
    if(typeof W.renderCourseOverview === 'function') W.renderCourseOverview();
    shAlert('แปลงคะแนนสำเร็จ', 'แปลงดาวเป็นคะแนนให้ ' + entries.length + ' คน รวม ' + record.totalPoints + ' คะแนน' + (isNew ? ' (เพิ่มเป็นโบนัส)' : ' (เพิ่มในงาน "' + plan.title + '")'));
  });
};

// ── Lookup used by renderCourseOverview to color converted cells ──
W.shStarConvGetCellInfo = function(cid, week, title, sid){
  var list = ((st().starConversions || {})[cid]) || [];
  var amount = 0;
  var sources = [];
  list.forEach(function(rec){
    if(rec.target && rec.target.type === 'job' && String(rec.target.week) === String(week) && String(rec.target.title) === String(title)){
      var e = (rec.entries || []).find(function(x){ return x.sid === sid; });
      if(e){
        amount += e.amount;
        var scopeLabel = rec.scope === 'week' ? ('สัปดาห์ที่ ' + rec.sourceWeek) : 'ดาวรวมทั้งหมด';
        sources.push('+' + e.amount + ' คะแนน จากดาว (' + scopeLabel + ')');
      }
    }
  });
  if(!amount) return null;
  return { amount: amount, tooltip: sources.join('\n') };
};

// ── History popup (single click on header) ───────────────────────
W.shStarConvertHistory = function(cid){
  cid = cid || getCid();
  if(!cid) return;
  initFields();
  var list = ((st().starConversions || {})[cid]) || [];
  var sorted = list.slice().sort(function(a,b){ return b.ts - a.ts; });
  var body = eid('sh-starconv-history-body');
  if(!sorted.length){
    body.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px">ยังไม่มีประวัติการแปลงดาวเป็นคะแนน</div>';
  } else {
    body.innerHTML = sorted.map(function(rec){
      var scopeLabel = rec.scope === 'week' ? ('ดาวสัปดาห์ที่ ' + rec.sourceWeek) : 'ดาวรวมทั้งหมด';
      var targetLabel = rec.target.type === 'new' ? 'รายการใหม่ (+โบนัส)' : ('งาน "' + esc(rec.target.title) + '" สัปดาห์ ' + esc(rec.target.week));
      var dateStr = new Date(rec.ts).toLocaleString('th-TH');
      return '<div class="sh-breakdown-row" style="flex-direction:column;align-items:stretch;gap:4px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
        '<span class="sh-breakdown-label" style="font-weight:800">' + scopeLabel + ' → ' + targetLabel + '</span>' +
        '<button type="button" onclick="shStarConvHistoryDelete(\'' + cid + '\',\'' + rec.id + '\')" title="ลบรายการนี้" style="background:#fee2e2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;width:24px;height:24px;cursor:pointer;font-weight:800;line-height:1;flex-shrink:0">×</button>' +
        '</div>' +
        '<div style="font-size:11.5px;color:#94a3b8">' + dateStr + ' · รวม ' + rec.totalPoints + ' คะแนน · ' + rec.entries.length + ' คน</div>' +
        '</div>';
    }).join('');
  }
  eid('sh-starconv-history-modal').classList.remove('hidden');
};

// ── Delete a conversion entry (reverses its effect) ───────────────
W.shStarConvHistoryDelete = function(cid, convId){
  if(!canEdit(cid, 'ลบประวัติแปลงดาวเป็นคะแนน')) return;
  shConfirm('ยืนยันการลบ', 'ต้องการลบรายการแปลงคะแนนนี้และคืนคะแนนที่แปลงไปใช่หรือไม่?', function(){
    var s = st();
    var list = (s.starConversions && s.starConversions[cid]) || [];
    var idx = list.findIndex(function(r){ return r.id === convId; });
    if(idx === -1) return;
    var rec = list[idx];

    if(rec.target.type === 'new'){
      var wk = rec.target.weekKeyUsed;
      if(s.bonusScores && s.bonusScores[cid] && s.bonusScores[cid][wk]){
        rec.entries.forEach(function(e){
          var cur = s.bonusScores[cid][wk][e.sid];
          var curNum = (cur !== undefined && cur !== '' && !isNaN(Number(cur))) ? Number(cur) : 0;
          var next = curNum - e.amount;
          s.bonusScores[cid][wk][e.sid] = next > 0 ? next : '';
        });
      }
    } else {
      var scoreRow = (s.scores || []).find(function(sr){ return String(sr.courseId) === String(cid) && String(sr.week) === String(rec.target.week) && String(sr.title) === String(rec.target.title); });
      if(scoreRow && scoreRow.records){
        rec.entries.forEach(function(e){
          var cur = scoreRow.records[e.sid];
          var curNum = (cur !== undefined && cur !== '' && !isNaN(Number(cur))) ? Number(cur) : 0;
          var next = curNum - e.amount;
          scoreRow.records[e.sid] = next > 0 ? next : 0;
        });
      }
    }

    list.splice(idx, 1);
    Promise.resolve(dbSave()).then(function(){
      if(typeof W.renderCourseOverview === 'function') W.renderCourseOverview();
      W.shStarConvertHistory(cid);
      shAlert('ลบสำเร็จ', 'ลบรายการแปลงคะแนนและคืนคะแนนเรียบร้อยแล้ว');
    });
  });
};

})(window);
