
(function(){
  if(window.__schoolhubScoreScaleRulesPatched) return;
  window.__schoolhubScoreScaleRulesPatched = true;

  function byId(id){ return document.getElementById(id); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];}); }
  function clone(v){ try{ return JSON.parse(JSON.stringify(v)); }catch(e){ return v; } }
  function fmt(v){ return window.formatScoreDisplay ? window.formatScoreDisplay(v,2) : String(v); }
  function ensureState(){ if(!window.state) window.state = {}; if(!Array.isArray(state.courses)) state.courses = []; return state; }
  function findCourseById(cid){ ensureState(); return (state.courses || []).find(function(c){ return String(c && c.id) === String(cid); }) || null; }

  var tempScoreScaleRules = [];        // กฎที่กำลังแก้ไขอยู่ในหน้าต่างตั้งค่าเกรด (ยังไม่ได้บันทึกจนกว่าจะกด "บันทึก")
  var editingScoreScaleRuleId = null;  // id ของกฎที่กำลังแก้ไขอยู่ในหน้าต่างย่อย (null = กำลังเพิ่มใหม่)
  var scoreScaleModalCourseId = '';    // courseId ของหน้าต่างตั้งค่าเกรดที่เปิดอยู่ตอนนี้

  /* ========================= ส่วนคำนวณ (engine) ========================= */

  function planIsChecklist(p){ return Number(p && p.maxScore) === 0; }

  // เช็คว่าแผนคะแนน (สัปดาห์+ชื่องาน) ตัวนี้ ถูกเลือกไว้ในกฎหรือไม่
  // sel.all=true หมายถึง "ทุกงานในสัปดาห์นั้น" (รวมงานที่เพิ่มเข้ามาใหม่ทีหลังด้วย)
  function planMatchesSelections(plan, selections){
    return (selections || []).some(function(sel){
      if(Number(sel.week) !== Number(plan.week)) return false;
      if(sel.all) return true;
      return (sel.titles || []).indexOf(String(plan.title)) !== -1;
    });
  }

  // หาแผนคะแนนที่ตรงกับกฎ ณ ปัจจุบัน (คำนวณสดเสมอ ไม่ใช้ค่าที่บันทึกไว้ตอนสร้างกฎ)
  function computeRuleLiveMatch(courseId, rule){
    ensureState();
    var plans = ((state.coursePlans && state.coursePlans[courseId]) || []).filter(function(p){ return !planIsChecklist(p); });
    var matched = plans.filter(function(p){ return planMatchesSelections(p, rule.selections); });
    var rawMax = 0;
    matched.forEach(function(p){ rawMax = window.addScoreToTotal ? window.addScoreToTotal(rawMax, p.maxScore, 2) : (rawMax + (Number(p.maxScore) || 0)); });
    return { matched: matched, rawMax: rawMax };
  }

  function computeRuleRawScoreForStudent(courseId, studentId, matched){
    ensureState();
    var courseScores = (state.scores || []).filter(function(s){ return String(s.courseId) === String(courseId); });
    var raw = 0;
    matched.forEach(function(p){
      var task = courseScores.find(function(ts){ return Number(ts.week) === Number(p.week) && String(ts.title) === String(p.title); });
      var val = task && task.records ? task.records[studentId] : null;
      raw = window.addScoreToTotal ? window.addScoreToTotal(raw, val, 2) : (raw + (Number(val) || 0));
    });
    return raw;
  }

  // ฟังก์ชันหลัก: คำนวณคะแนนรวม/คะแนนเต็มของนักเรียนคนหนึ่ง โดยนำกฎหารคะแนนของวิชานี้มาใช้แทนที่
  // งาน/สัปดาห์ที่ถูกเลือกไว้ ส่วนงานอื่นที่ไม่ถูกเลือกยังคงรวมแบบปกติ
  // คืนค่า null ถ้าวิชานี้ไม่มีกฎหารคะแนนเลย (ให้ผู้เรียกใช้ค่าที่คำนวณเองต่อไปตามปกติ)
  function shComputeScaledCourseTotal(courseId, studentId){
    try{
      ensureState();
      var course = findCourseById(courseId);
      var rules = (course && Array.isArray(course.scoreScaleRules)) ? course.scoreScaleRules : [];
      if(!rules.length) return null;

      var plans = (state.coursePlans && state.coursePlans[courseId]) || [];
      var courseScores = (state.scores || []).filter(function(s){ return String(s.courseId) === String(courseId); });
      var matchedKeys = {};
      var totalMax = 0, totalScore = 0;

      rules.forEach(function(rule){
        var info = computeRuleLiveMatch(courseId, rule);
        info.matched.forEach(function(p){ matchedKeys[p.week + '|' + p.title] = true; });
        if(info.rawMax > 0){
          var target = Number(rule.targetScore) || 0;
          totalMax = window.addScoreToTotal ? window.addScoreToTotal(totalMax, target, 2) : (totalMax + target);
          var rawScore = studentId ? computeRuleRawScoreForStudent(courseId, studentId, info.matched) : 0;
          var scaled = (rawScore / info.rawMax) * target;
          totalScore = window.addScoreToTotal ? window.addScoreToTotal(totalScore, scaled, 2) : (totalScore + scaled);
        }
      });

      plans.forEach(function(p){
        if(planIsChecklist(p)) return;
        var key = p.week + '|' + p.title;
        if(matchedKeys[key]) return; // นับผ่านกฎไปแล้ว ไม่นับซ้ำแบบปกติอีก
        totalMax = window.addScoreToTotal ? window.addScoreToTotal(totalMax, p.maxScore, 2) : (totalMax + (Number(p.maxScore) || 0));
        if(studentId){
          var task = courseScores.find(function(ts){ return Number(ts.week) === Number(p.week) && String(ts.title) === String(p.title); });
          var val = task && task.records ? task.records[studentId] : null;
          totalScore = window.addScoreToTotal ? window.addScoreToTotal(totalScore, val, 2) : (totalScore + (Number(val) || 0));
        }
      });

      totalScore = window.normalizeScoreNumber ? window.normalizeScoreNumber(totalScore, 2) : Number(totalScore.toFixed(2));
      return { total: totalScore, totalMax: totalMax };
    }catch(e){
      console.error('[SCORE SCALE] compute failed', e);
      return null;
    }
  }
  window.shComputeScaledCourseTotal = shComputeScaledCourseTotal;

  // เรียกใช้จาก 098.js ตอนกด "บันทึก" ในหน้าตั้งค่าเกรด เพื่อนำกฎที่แก้ไขอยู่ในหน้าต่างนี้ไปเก็บลง course จริง
  window.shGetPendingScoreScaleRulesForSave = function(){ return clone(tempScoreScaleRules || []); };

  /* ========================= ส่วนแสดงผล/UI ========================= */

  function weekLabel(sel){
    if(sel.all) return 'สัปดาห์ที่ ' + sel.week + ' (ทุกงาน)';
    return 'สัปดาห์ที่ ' + sel.week + ': ' + (sel.titles || []).join(', ');
  }

  function renderScoreScaleRulesList(){
    var box = byId('schoolhub-score-scale-rules-list');
    if(!box) return;
    if(!tempScoreScaleRules.length){
      box.innerHTML = '<div class="schoolhub-grade-empty">ยังไม่มีกฎหารคะแนน</div>';
      return;
    }
    box.innerHTML = tempScoreScaleRules.map(function(r){
      var live = null;
      try{ live = computeRuleLiveMatch(scoreScaleModalCourseId, r); }catch(e){}
      var rawMax = live ? live.rawMax : (r.rawMaxSnapshot || 0);
      var selHtml = (r.selections || []).map(weekLabel).map(esc).join(' • ');
      return '<div class="schoolhub-special-rule-card">' +
        '<div>' +
          '<b>เฉลี่ยเหลือ ' + esc(fmt(r.targetScore)) + ' คะแนน</b>' +
          '<div style="font-size:12px;color:#64748b">จากคะแนนเต็มเดิม ' + esc(fmt(rawMax)) + ' คะแนน</div>' +
          '<div style="font-size:11px;color:#94a3b8;margin-top:2px">' + selHtml + '</div>' +
        '</div>' +
        '<div class="flex gap-2 justify-end">' +
          '<button type="button" class="schoolhub-grade-edit-btn" onclick="shOpenScoreScaleRuleModal(\'' + r.id + '\')"><i class="fas fa-pen mr-1"></i>แก้ไข</button>' +
          '<button type="button" class="schoolhub-grade-danger-btn" onclick="shDeleteScoreScaleRule(\'' + r.id + '\')"><i class="fas fa-trash mr-1"></i>ลบ</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  window.shRenderScoreScaleRulesList = renderScoreScaleRulesList;

  window.shDeleteScoreScaleRule = function(id){
    var doDelete = function(){
      tempScoreScaleRules = tempScoreScaleRules.filter(function(r){ return String(r.id) !== String(id); });
      if(typeof window.markGradeCriteriaDirty === 'function') window.markGradeCriteriaDirty();
      renderScoreScaleRulesList();
    };
    if(typeof window.showCustomConfirm === 'function'){
      window.showCustomConfirm('ลบกฎหารคะแนน', 'ต้องการลบกฎนี้หรือไม่? กด "บันทึก" ในหน้าตั้งค่าเกรดอีกครั้งเพื่อยืนยันการลบ', doDelete);
    } else if(confirm('ต้องการลบกฎนี้หรือไม่?')){
      doDelete();
    }
  };

  // โหลดกฎของวิชานี้มาไว้ในตัวแปรชั่วคราว ทุกครั้งที่เปิดหน้าต่างตั้งค่าเกรด
  window.shLoadTempScoreScaleRules = function(courseId){
    scoreScaleModalCourseId = String(courseId || '');
    var course = findCourseById(scoreScaleModalCourseId);
    tempScoreScaleRules = clone((course && course.scoreScaleRules) || []);
    renderScoreScaleRulesList();
  };

  /* ---------------- หน้าต่างย่อย: เพิ่ม/แก้ไขกฎ ---------------- */

  function ensureScoreScaleModal(){
    if(byId('schoolhub-score-scale-rule-modal')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div id="schoolhub-score-scale-rule-modal-backdrop" class="hidden fixed inset-0 bg-black/40" style="z-index:900001"></div>' +
      '<div id="schoolhub-score-scale-rule-modal" class="hidden fixed inset-0 flex items-center justify-center p-4" style="z-index:900002">' +
        '<div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5" style="max-height:90vh;overflow-y:auto">' +
          '<div class="flex items-center justify-between mb-4">' +
            '<h3 id="schoolhub-score-scale-rule-modal-title" class="font-bold text-lg text-slate-800">เพิ่มกฎหารคะแนน</h3>' +
            '<button type="button" onclick="shCloseScoreScaleRuleModal()" aria-label="ปิด" class="modal-close w-10 h-10 rounded-full bg-slate-100 text-slate-500 font-black hover:bg-slate-200 flex items-center justify-center">×</button>' +
          '</div>' +
          '<div class="space-y-3">' +
            '<div>' +
              '<label class="block text-sm font-black text-slate-600 mb-1">เลือกสัปดาห์ / งานที่จะนำมาหารคะแนน</label>' +
              '<div id="schoolhub-score-scale-week-picker" style="max-height:260px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:12px;padding:10px"></div>' +
            '</div>' +
            '<div class="rounded-xl bg-slate-50 p-3 text-sm flex justify-between items-center">' +
              '<span class="text-slate-500">คะแนนเต็มที่เลือกไว้ (ก่อนหารเฉลี่ย)</span>' +
              '<span id="schoolhub-score-scale-raw-max" class="font-bold text-primary">0</span>' +
            '</div>' +
            '<div>' +
              '<label class="block text-sm font-black text-slate-600 mb-1">ต้องการเฉลี่ยให้เหลือกี่คะแนน</label>' +
              '<input id="schoolhub-score-scale-target" type="number" min="0" step="any" inputmode="decimal" placeholder="เช่น 80">' +
            '</div>' +
            '<div class="flex gap-3 pt-2">' +
              '<button type="button" onclick="shCloseScoreScaleRuleModal()" class="w-1/2 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">ยกเลิก</button>' +
              '<button type="button" onclick="shSaveScoreScaleRuleFromModal()" class="w-1/2 py-3 bg-primary text-white rounded-xl font-bold">บันทึก</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>');
    var bd = byId('schoolhub-score-scale-rule-modal-backdrop');
    if(bd) bd.addEventListener('click', function(e){ e.preventDefault(); window.shCloseScoreScaleRuleModal(); });
  }

  function buildWeekPicker(preselectRule){
    var picker = byId('schoolhub-score-scale-week-picker');
    if(!picker) return;
    ensureState();
    var plans = ((state.coursePlans && state.coursePlans[scoreScaleModalCourseId]) || [])
      .filter(function(p){ return !planIsChecklist(p); })
      .slice()
      .sort(function(a,b){ return Number(a.week) - Number(b.week); });

    if(!plans.length){
      picker.innerHTML = '<div class="schoolhub-grade-empty">ยังไม่มีงาน/แผนคะแนนที่มีคะแนนเต็มในวิชานี้</div>';
      return;
    }

    var byWeek = {};
    plans.forEach(function(p){ var w = String(p.week); (byWeek[w] = byWeek[w] || []).push(p); });
    var weeks = Object.keys(byWeek).sort(function(a,b){ return Number(a) - Number(b); });

    var preselectMap = {};
    (preselectRule && preselectRule.selections || []).forEach(function(sel){ preselectMap[String(sel.week)] = sel; });

    picker.innerHTML = weeks.map(function(w){
      var sel = preselectMap[w];
      var isAll = !!(sel && sel.all);
      var titlesChecked = (sel && sel.titles) || [];
      var itemsHtml = byWeek[w].map(function(p){
        var checked = isAll || titlesChecked.indexOf(p.title) !== -1;
        return '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#475569;padding:2px 0">' +
          '<input type="checkbox" class="ssr-item" data-week="' + esc(w) + '" data-title="' + esc(p.title) + '" ' +
            (checked ? 'checked' : '') + (isAll ? ' disabled' : '') + ' onchange="shScoreScaleRecomputePreview()"> ' +
          esc(p.title) + ' (เต็ม ' + esc(fmt(p.maxScore)) + ')' +
        '</label>';
      }).join('');
      return '<div class="schoolhub-ssr-week-group" data-week="' + esc(w) + '" style="border-bottom:1px solid #f1f5f9;padding-bottom:8px;margin-bottom:8px">' +
        '<label style="display:flex;align-items:center;gap:8px;font-weight:800;color:#334155">' +
          '<input type="checkbox" class="ssr-week-all" data-week="' + esc(w) + '" ' + (isAll ? 'checked' : '') + ' onchange="shScoreScaleWeekAllToggled(this)"> สัปดาห์ที่ ' + esc(w) + ' (เลือกทั้งหมด)' +
        '</label>' +
        '<div style="padding-left:26px;margin-top:4px" class="ssr-week-items">' + itemsHtml + '</div>' +
      '</div>';
    }).join('');

    shScoreScaleRecomputePreview();
  }

  window.shScoreScaleWeekAllToggled = function(cb){
    var group = cb.closest('.schoolhub-ssr-week-group');
    if(!group) return;
    var items = group.querySelectorAll('.ssr-item');
    items.forEach(function(it){
      if(cb.checked){ it.checked = true; it.disabled = true; }
      else { it.disabled = false; }
    });
    shScoreScaleRecomputePreview();
  };

  function readSelectionsFromPicker(){
    var picker = byId('schoolhub-score-scale-week-picker');
    if(!picker) return [];
    var selections = [];
    Array.prototype.slice.call(picker.querySelectorAll('.schoolhub-ssr-week-group')).forEach(function(group){
      var week = Number(group.getAttribute('data-week'));
      var allCb = group.querySelector('.ssr-week-all');
      if(allCb && allCb.checked){ selections.push({ week: week, all: true, titles: [] }); return; }
      var titles = [];
      Array.prototype.slice.call(group.querySelectorAll('.ssr-item')).forEach(function(it){
        if(it.checked) titles.push(it.getAttribute('data-title'));
      });
      if(titles.length) selections.push({ week: week, all: false, titles: titles });
    });
    return selections;
  }

  window.shScoreScaleRecomputePreview = function(){
    var selections = readSelectionsFromPicker();
    var info = computeRuleLiveMatch(scoreScaleModalCourseId, { selections: selections });
    var out = byId('schoolhub-score-scale-raw-max');
    if(out) out.textContent = fmt(info.rawMax);
  };

  window.shOpenScoreScaleRuleModal = function(ruleId){
    ensureScoreScaleModal();
    var modal = byId('grade-criteria-modal');
    scoreScaleModalCourseId = String((modal && modal.dataset && modal.dataset.courseId) || scoreScaleModalCourseId || '');
    editingScoreScaleRuleId = ruleId || null;
    var rule = ruleId ? tempScoreScaleRules.find(function(r){ return String(r.id) === String(ruleId); }) : null;

    var titleEl = byId('schoolhub-score-scale-rule-modal-title');
    if(titleEl) titleEl.textContent = rule ? 'แก้ไขกฎหารคะแนน' : 'เพิ่มกฎหารคะแนน';

    buildWeekPicker(rule);

    var targetInput = byId('schoolhub-score-scale-target');
    if(targetInput) targetInput.value = rule ? rule.targetScore : '';

    var m = byId('schoolhub-score-scale-rule-modal');
    var bd = byId('schoolhub-score-scale-rule-modal-backdrop');
    if(m) m.classList.remove('hidden');
    if(bd) bd.classList.remove('hidden');
  };

  window.shCloseScoreScaleRuleModal = function(){
    var m = byId('schoolhub-score-scale-rule-modal');
    var bd = byId('schoolhub-score-scale-rule-modal-backdrop');
    if(m) m.classList.add('hidden');
    if(bd) bd.classList.add('hidden');
    editingScoreScaleRuleId = null;
  };

  window.shSaveScoreScaleRuleFromModal = function(){
    var selections = readSelectionsFromPicker();
    if(!selections.length){
      if(window.showCustomAlert) window.showCustomAlert('ยังไม่ได้เลือกงาน', 'กรุณาเลือกอย่างน้อย 1 สัปดาห์หรืองาน', true);
      else alert('กรุณาเลือกอย่างน้อย 1 สัปดาห์หรืองาน');
      return;
    }
    var targetInput = byId('schoolhub-score-scale-target');
    var target = Number(targetInput && targetInput.value);
    if(!targetInput || String(targetInput.value).trim() === '' || !Number.isFinite(target) || target <= 0){
      if(window.showCustomAlert) window.showCustomAlert('กรอกคะแนนที่ต้องการ', 'กรุณากรอกคะแนนที่ต้องการเฉลี่ยให้เหลือ (มากกว่า 0)', true);
      else alert('กรุณากรอกคะแนนที่ต้องการ');
      return;
    }

    var info = computeRuleLiveMatch(scoreScaleModalCourseId, { selections: selections });
    var nowIso = new Date().toISOString();

    if(editingScoreScaleRuleId){
      var idx = tempScoreScaleRules.findIndex(function(r){ return String(r.id) === String(editingScoreScaleRuleId); });
      if(idx >= 0){
        tempScoreScaleRules[idx].selections = selections;
        tempScoreScaleRules[idx].targetScore = target;
        tempScoreScaleRules[idx].rawMaxSnapshot = info.rawMax;
        tempScoreScaleRules[idx].updatedAt = nowIso;
      }
    } else {
      tempScoreScaleRules.push({
        id: 'ssr_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        selections: selections,
        targetScore: target,
        rawMaxSnapshot: info.rawMax,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    if(typeof window.markGradeCriteriaDirty === 'function') window.markGradeCriteriaDirty();
    renderScoreScaleRulesList();
    window.shCloseScoreScaleRuleModal();
  };

  /* ---------------- ผูกกับการเปิดหน้าต่างตั้งค่าเกรด ----------------
     ใช้ MutationObserver จับตอน #grade-criteria-modal ถูกลบ class "hidden" ออก (คือถูกเปิดขึ้นมา)
     แทนที่จะไปครอบฟังก์ชัน openGradeCriteriaModalForCurrentCourse ตรงๆ เพราะไฟล์อื่นในระบบ (103/104)
     ครอบฟังก์ชันนี้ซ้อนกันหลายชั้นอยู่แล้ว การจับที่ class ของ modal จึงเชื่อถือได้กว่าและไม่ชนกับของเดิม */
  function watchGradeCriteriaModalOpen(){
    var modal = byId('grade-criteria-modal');
    if(!modal || modal.__schoolhubScoreScaleWatched) return;
    modal.__schoolhubScoreScaleWatched = true;
    var mo = new MutationObserver(function(){
      if(!modal.classList.contains('hidden')){
        var cid = String(modal.dataset.courseId || '');
        if(cid) window.shLoadTempScoreScaleRules(cid);
      }
    });
    try{ mo.observe(modal, { attributes: true, attributeFilter: ['class'] }); }catch(e){}
  }
  watchGradeCriteriaModalOpen();
  document.addEventListener('DOMContentLoaded', watchGradeCriteriaModalOpen);
  setTimeout(watchGradeCriteriaModalOpen, 0);
  setTimeout(watchGradeCriteriaModalOpen, 500);
  setTimeout(watchGradeCriteriaModalOpen, 1500);
})();
