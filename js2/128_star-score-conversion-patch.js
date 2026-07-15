
(function(){
  if (window.__schoolhubStarConversionRankingPatch) return;
  window.__schoolhubStarConversionRankingPatch = true;

  function esc(v){ try { return window.escapeHTML ? window.escapeHTML(v) : String(v||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); } catch(e){ return String(v||''); } }

  // 0. ตัวจับดับเบิลคลิกแบบ delegation ที่ document (ยิงก่อนใครทั้งหมดในเฟส capture
  //    และไม่สนใจว่า <th> ตัวเดิมจะถูกสร้างใหม่ระหว่างคลิกที่ 1 กับ 2 หรือไม่)
  var STAR_HEADER_SELECTOR = '[data-sh-stargroup-header="1"]';
  if (!window.__schoolhubStarHeaderDblClickInstalled) {
    window.__schoolhubStarHeaderDblClickInstalled = true;
    var lastStarHeaderTapAt = 0;
    function tryOpenStarConversion(e){
      var el = e.target && e.target.closest ? e.target.closest(STAR_HEADER_SELECTOR) : null;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (typeof window.openStarConversionPopup === 'function') window.openStarConversionPopup();
    }
    // ทางหลัก: dblclick ของเบราว์เซอร์เอง (เร็วและตรงไปตรงมาที่สุดเมื่อทำงานได้)
    document.addEventListener('dblclick', tryOpenStarConversion, true);
    // ทางสำรอง: จับจังหวะคลิกสองครั้งด้วยเวลาเอง เผื่อกรณี dblclick ของเบราว์เซอร์ไม่ยิง
    // (เช่น องค์ประกอบถูกสร้างใหม่ระหว่างคลิกที่ 1 กับ 2 ทำให้เบราว์เซอร์ไม่นับเป็นดับเบิลคลิก)
    document.addEventListener('click', function(e){
      var el = e.target && e.target.closest ? e.target.closest(STAR_HEADER_SELECTOR) : null;
      if (!el) return;
      var now = Date.now();
      if (now - lastStarHeaderTapAt < 420) {
        lastStarHeaderTapAt = 0;
        tryOpenStarConversion(e);
      } else {
        lastStarHeaderTapAt = now;
      }
    }, true);
  }

  // 1. ซ่อมดาวและโบนัสในหน้า Overview
  var oldRender = window.renderCourseOverview;
  window.renderCourseOverview = function(){
    if (typeof oldRender !== 'function') return;
    var cid = window.currentActiveCourseId;
    var res = oldRender.apply(this, arguments);
    var table = document.getElementById('course-summary-table');
    if (!table || !cid || !window.state) return res;

    var thead = table.querySelector('thead tr');
    if (thead && !thead.querySelector('.sh-stargroup-col')) {
      var target = thead.querySelector('.summary-grade-col') || thead.querySelector('.summary-total-col');
      if (target) {
        var bonusTh = document.createElement('th');
        bonusTh.className = 'text-center bg-rose-50 text-rose-700 font-bold sh-bonusgroup-col border-r';
        bonusTh.innerHTML = 'โบนัส';
        thead.insertBefore(bonusTh, target);

        var starTh = document.createElement('th');
        starTh.className = 'text-center bg-amber-50 text-amber-700 font-bold sh-stargroup-col border-r cursor-pointer hover:bg-amber-100 transition select-none';
        starTh.title = 'ดับเบิลคลิกเพื่อแปลงคะแนนดาวกลุ่ม';
        starTh.setAttribute('data-sh-stargroup-header', '1');

        // เก็บ addEventListener ตรงตัว th ไว้ด้วยเป็นชั้นป้องกันซ้อน (เผื่อ delegation ถูกบล็อกในบางเคส)
        starTh.addEventListener('dblclick', function(e){
          e.preventDefault();
          e.stopPropagation();
          window.openStarConversionPopup();
        }, true);

        // เพิ่มคำอธิบาย "Double Click" ให้ชัดเจน
        starTh.innerHTML = '<div class="flex flex-col items-center gap-1"><span>ดาวกลุ่ม</span><div class="text-[9px] bg-amber-600 text-white px-1.5 py-0.5 rounded shadow-sm font-black uppercase tracking-tighter animate-pulse">Double Click</div></div>';
        thead.insertBefore(starTh, target);
      }
    }


    var overview = window.getOverviewStudents ? window.getOverviewStudents(cid) : {students:[]};
    var courseStudents = overview.students;
    var rows = table.querySelectorAll('tbody tr');
    var starCourseData = (state.starGroups && state.starGroups[cid]) || {};
    var starSets = starCourseData.sets || [];
    var bonusByCid = (state.bonusScores && state.bonusScores[cid]) || {};

    rows.forEach(function(row, idx){
      var st = courseStudents[idx];
      if (!st || row.querySelector('.sh-stargroup-col')) return;
      var target = row.querySelector('.summary-grade-col') || row.querySelector('.summary-total-col');
      if (target) {
        var totalBonus = 0;
        Object.keys(bonusByCid).forEach(function(wk){
          var val = bonusByCid[wk] && bonusByCid[wk][st.id];
          if (val !== undefined && val !== '' && !isNaN(Number(val))) totalBonus += Number(val);
        });

        var totalStars = 0;
        starSets.forEach(function(s){
          var groups = s.groups || [];
          var weekStars = s.weekStars || {};
          var studentGroups = groups.filter(function(g){ return (g.members||[]).indexOf(st.id) !== -1; });
          Object.keys(weekStars).forEach(function(wk){
            var weekData = weekStars[wk] || {};
            studentGroups.forEach(function(g){ totalStars += (weekData[g.id] || 0); });
          });
        });

        var bonusTd = document.createElement('td');
        bonusTd.className = 'text-center font-bold text-rose-600 bg-rose-50/30 sh-bonusgroup-col border-r';
        bonusTd.innerHTML = totalBonus > 0 ? '+' + window.formatScoreDisplay(totalBonus, 2) : '-';
        row.insertBefore(bonusTd, target);

        var starTd = document.createElement('td');
        starTd.className = 'text-center font-bold text-amber-600 bg-amber-50/30 sh-stargroup-col border-r';
        starTd.innerHTML = totalStars > 0 ? totalStars + ' ⭐' : '-';
        row.insertBefore(starTd, target);
      }
    });
    return res;
  };

  // 2. ป็อปอัพแปลงคะแนนดาวกลุ่ม
  window.openStarConversionPopup = function(){
   try {
    var cid = window.currentActiveCourseId;
    if (!cid) {
      if (window.showCustomAlert) window.showCustomAlert('ไม่พบวิชาที่เลือก','กรุณาเปิดวิชาก่อนใช้งานฟีเจอร์นี้', true);
      return;
    }
    if(typeof window.schoolhubPlanAllows === 'function' && !window.schoolhubPlanAllows('allowStars')) {
      if(typeof window.showCustomAlert === 'function') window.showCustomAlert('ไม่มีสิทธิ์ใช้งาน','แผนปัจจุบันไม่รองรับระบบดาว กรุณาอัปเกรดแผน', true);
      return;
    }

    var starCourseData = (state.starGroups && state.starGroups[cid]) || {};
    var starSets = starCourseData.sets || [];

    if (starSets.length === 0) {
      if (window.showCustomAlert) window.showCustomAlert('ไม่พบเซ็ทกลุ่ม','กรุณาสร้างเซ็ทกลุ่มนักเรียนก่อนแปลงคะแนน', true);
      return;
    }

    var pop = document.getElementById('star-conversion-popup');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'star-conversion-popup';
      document.body.appendChild(pop);
    }
    // ใช้สไตล์ป็อปอัพมาตรฐานเดียวกับระบบโบนัส (sh-overlay/sh-modal-box) แต่ธีมสีเป็นของระบบดาว (ส้มอำพัน)
    pop.className = 'sh-overlay';
    window.__editingConversionHistoryId = null;

    var setOptions = starSets.map((s, i) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');

    var plans = ((state.coursePlans && state.coursePlans[cid]) || []).slice().sort((a,b) => a.week - b.week);
    var planOptions = plans.length
      ? plans.map(p => `<option value="${p.id}">สัปดาห์ ${esc(p.week)} — ${esc(p.title)} (เต็ม ${esc(p.maxScore)})</option>`).join('')
      : '<option value="">-- ยังไม่มีแผนคะแนนในวิชานี้ --</option>';

    pop.innerHTML = `
      <div class="sh-modal-box" style="max-width:560px">
        <div class="sh-modal-header" style="background:#d97706;border-bottom:none">
          <h3 style="color:#fff"><i class="fas fa-star" style="margin-right:8px"></i>แปลงคะแนนดาวกลุ่ม</h3>
          <button class="sh-modal-close" onclick="window.closeStarConversionPopup()" style="background:rgba(255,255,255,.2);border-color:transparent;color:#fff"><i class="fas fa-times"></i></button>
        </div>
        <div class="sh-modal-body">
          <div id="conversion-edit-banner" class="sh-conv-edit-banner" style="display:none">
            <span><i class="fas fa-pen mr-1"></i><span id="conversion-edit-banner-label"></span></span>
            <button type="button" class="sh-btn-cancel-sm" onclick="window.cancelEditStarConversion()">ยกเลิกการแก้ไข</button>
          </div>

          <div class="sh-week-row">
            <label><i class="fas fa-layer-group" style="color:#d97706;margin-right:4px"></i>เลือกเซตกลุ่ม</label>
            <select id="conversion-set-id" style="flex:1;min-width:160px" onchange="window.updateConversionPreview()">${setOptions}</select>
          </div>

          <div class="sh-week-row">
            <label><i class="fas fa-route" style="color:#d97706;margin-right:4px"></i>แปลงเข้า</label>
            <select id="conversion-dest" style="flex:1;min-width:160px" onchange="window.onConversionDestChange()">
              <option value="bonus">คะแนนโบนัส</option>
              <option value="week">คะแนนในสัปดาห์ (แผนคะแนนที่มีอยู่)</option>
            </select>
          </div>

          <div class="sh-week-row" id="conversion-plan-row" style="display:none">
            <label><i class="fas fa-calendar-week" style="color:#d97706;margin-right:4px"></i>เลือกงาน</label>
            <select id="conversion-plan-id" style="flex:1;min-width:160px" onchange="window.updateConversionPreview()">${planOptions}</select>
          </div>

          <div class="sh-week-row">
            <label style="color:#059669">คะแนนสูงสุด (ที่ 1)</label>
            <input type="number" id="conv-max-score" style="width:90px" value="20" oninput="window.updateConversionPreview()">
            <label style="color:#e11d48">คะแนนต่ำสุด (โหล)</label>
            <input type="number" id="conv-min-score" style="width:90px" value="10" oninput="window.updateConversionPreview()">
          </div>

          <table class="sh-bonus-table">
            <thead><tr><th width="40" style="text-align:center">ลำดับ</th><th>กลุ่ม</th><th style="text-align:center">ดาวรวม</th><th style="text-align:center">คะแนนที่แปลง</th></tr></thead>
            <tbody id="conversion-preview-list"></tbody>
          </table>

          <div class="sh-conv-history-section">
            <div class="sh-conv-history-title-row"><i class="fas fa-clock-rotate-left" style="color:#d97706;margin-right:6px"></i>ประวัติการแปลงคะแนน</div>
            <div id="conversion-history-list"></div>
          </div>
        </div>
        <div class="sh-modal-footer">
          <button class="sh-btn-cancel" onclick="window.closeStarConversionPopup()">ยกเลิก</button>
          <button class="sh-btn-save-amber" onclick="window.applyStarConversion()"><i class="fas fa-save mr-1"></i>บันทึกคะแนน</button>
        </div>
      </div>
    `;

    pop.classList.remove('hidden');
    window.updateConversionPreview();
    window.renderConversionHistoryList();
   } catch(err) {
    console.error('[schoolhub-star-conversion] openStarConversionPopup error:', err);
    if (window.showCustomAlert) window.showCustomAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเปิดหน้าต่างแปลงคะแนนได้ กรุณาลองใหม่หรือรีเฟรชหน้า', true);
   }
  };

  window.closeStarConversionPopup = function(){
    var pop = document.getElementById('star-conversion-popup');
    if (pop) pop.classList.add('hidden');
    window.__editingConversionHistoryId = null;
  };

  // สลับการแสดง "เลือกงาน" ตามปลายทางที่เลือก — เลือก "แปลงเข้าโบนัส" ไม่ต้องเลือกสัปดาห์/งาน
  window.onConversionDestChange = function(){
    var dest = document.getElementById('conversion-dest').value;
    var row = document.getElementById('conversion-plan-row');
    if (row) row.style.display = (dest === 'week') ? '' : 'none';
    window.updateConversionPreview();
  };


  window.updateConversionPreview = function(){
    var cid = window.currentActiveCourseId;
    var setId = document.getElementById('conversion-set-id').value;
    var dest = document.getElementById('conversion-dest') ? document.getElementById('conversion-dest').value : 'bonus';
    var maxInput = document.getElementById('conv-max-score');

    // แปลงเข้าสัปดาห์: ล็อกคะแนนสูงสุดให้เท่ากับคะแนนเต็มของงานที่เลือกเสมอ (กันแปลงคะแนนเกินคะแนนเต็มของงานนั้น)
    if (dest === 'week') {
      var planId = document.getElementById('conversion-plan-id') ? document.getElementById('conversion-plan-id').value : '';
      var plan = ((state.coursePlans && state.coursePlans[cid]) || []).find(p => p.id === planId);
      if (plan) { maxInput.value = plan.maxScore; maxInput.setAttribute('readonly', 'readonly'); }
    } else {
      maxInput.removeAttribute('readonly');
    }

    var maxS = parseFloat(maxInput.value) || 0;
    var minInput = document.getElementById('conv-min-score');
    var minS = parseFloat(minInput.value) || 0;

    // ห้ามกรอกคะแนนต่ำสุดมากกว่าคะแนนสูงสุด: ถ้าเกิน ให้ดึงกลับมาเท่ากับคะแนนสูงสุดทันที
    if (minS > maxS) {
      minS = maxS;
      minInput.value = minS;
    }
    minInput.setAttribute('max', maxS);

    var starCourseData = (state.starGroups && state.starGroups[cid]) || {};
    var starSets = starCourseData.sets || [];
    var currentSet = starSets.find(s => s.id === setId);
    if (!currentSet) return;

    var groups = currentSet.groups || [];
    var weekStars = currentSet.weekStars || {};

    var groupData = groups.map(g => {
      var stars = 0;
      Object.keys(weekStars).forEach(wk => { stars += (weekStars[wk][g.id] || 0); });
      return { id: g.id, name: g.name, stars: stars };
    });

    groupData.sort((a, b) => b.stars - a.stars);

    var currentRank = 0;
    var lastStars = -1;
    groupData.forEach((g, i) => {
      if (g.stars !== lastStars) {
        currentRank = i + 1;
        lastStars = g.stars;
      }
      g.rank = currentRank;
    });

    var uniqueRanks = Array.from(new Set(groupData.map(g => g.rank))).sort((a,b) => a-b);
    var totalUnique = uniqueRanks.length;

    groupData.forEach(g => {
      if (totalUnique <= 1) {
        g.scaledScore = maxS;
      } else {
        var rankIdx = uniqueRanks.indexOf(g.rank);
        g.scaledScore = maxS - (rankIdx * (maxS - minS) / (totalUnique - 1));
      }
      g.scaledScore = Math.round(g.scaledScore * 100) / 100;
    });

    var previewHtml = groupData.map(g => `
      <tr>
        <td style="text-align:center;font-weight:800;color:#92400e">#${g.rank}</td>
        <td style="font-weight:700;color:#1e293b">${esc(g.name)}</td>
        <td style="text-align:center">${g.stars} ⭐</td>
        <td style="text-align:center;font-weight:800;color:#d97706">${window.formatScoreDisplay(g.scaledScore, 2)}</td>
      </tr>
    `).join('');

    var listEl = document.getElementById('conversion-preview-list');
    if (listEl) listEl.innerHTML = previewHtml;
    window.__currentGroupData = groupData;
  };

  // 3. ประวัติการแปลงคะแนน (เก็บแยกเป็นรายการต่อครั้ง แก้ไข/ลบทีหลังได้)
  function getConversionHistory(cid){
    if (!state.starConversionHistory) state.starConversionHistory = {};
    if (!state.starConversionHistory[cid]) state.starConversionHistory[cid] = [];
    return state.starConversionHistory[cid];
  }

  // ย้อนผลของการแปลงคะแนนครั้งหนึ่ง ๆ ออกจากคะแนนจริง (ใช้ตอนแก้ไข/ลบประวัติ)
  function revertConversionEffect(cid, rec){
    if (!rec) return;
    if (rec.dest === 'week') {
      var plan = (state.scores || []).find(s => s.courseId === cid && String(s.week) === String(rec.planWeek) && s.title === rec.planTitle);
      if (plan && plan.records) {
        (rec.groupData || []).forEach(function(g){
          (g.members || []).forEach(function(stId){ delete plan.records[stId]; });
        });
      }
    } else {
      if (state.bonusScores && state.bonusScores[cid]) {
        delete state.bonusScores[cid]['Bonus-Stars-' + rec.id];
      }
    }
  }

  window.renderConversionHistoryList = function(){
    var cid = window.currentActiveCourseId;
    var listEl = document.getElementById('conversion-history-list');
    if (!listEl || !cid) return;
    var history = getConversionHistory(cid);

    if (!history.length) {
      listEl.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:14px;font-size:12px">ยังไม่มีประวัติการแปลงคะแนน</div>';
      return;
    }

    var sorted = history.slice().sort(function(a, b){ return (b.appliedAt || 0) - (a.appliedAt || 0); });
    listEl.innerHTML = sorted.map(function(rec){
      var destLabel = rec.dest === 'week'
        ? ('สัปดาห์ ' + esc(rec.planWeek) + ' — ' + esc(rec.planTitle))
        : 'คะแนนโบนัส';
      var dateStr = '';
      try { dateStr = new Date(rec.appliedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }); } catch(e) { dateStr = ''; }
      return `
        <div class="sh-conv-history-item">
          <div class="sh-conv-history-info">
            <span class="sh-conv-history-title">${esc(rec.setName)} <i class="fas fa-arrow-right" style="font-size:10px;color:#cbd5e1;margin:0 4px"></i> ${destLabel}</span>
            <span class="sh-conv-history-meta">คะแนน ${esc(rec.minScore)}-${esc(rec.maxScore)} · ${(rec.groupData || []).length} กลุ่ม · ${dateStr}</span>
          </div>
          <div class="sh-conv-history-actions">
            <button class="sh-btn-blue-sm" onclick="window.editStarConversionHistory('${rec.id}')" title="แก้ไขการแปลงนี้"><i class="fas fa-pen mr-1"></i>แก้ไข</button>
            <button class="sh-btn-red-sm" onclick="window.deleteStarConversionHistory('${rec.id}')"><i class="fas fa-trash mr-1"></i>ลบ</button>
          </div>
        </div>
      `;
    }).join('');
  };

  window.editStarConversionHistory = function(id){
    var cid = window.currentActiveCourseId;
    if (!cid) return;
    var rec = getConversionHistory(cid).find(function(h){ return h.id === id; });
    if (!rec) return;

    var setSel = document.getElementById('conversion-set-id');
    if (setSel) setSel.value = rec.setId;

    var destSel = document.getElementById('conversion-dest');
    if (destSel) destSel.value = rec.dest;
    window.onConversionDestChange();

    if (rec.dest === 'week') {
      var planSel = document.getElementById('conversion-plan-id');
      if (planSel) planSel.value = rec.planId || '';
    }

    var maxInput = document.getElementById('conv-max-score');
    var minInput = document.getElementById('conv-min-score');
    if (maxInput) maxInput.value = rec.maxScore;
    if (minInput) minInput.value = rec.minScore;

    window.__editingConversionHistoryId = id;
    window.updateConversionPreview();

    var banner = document.getElementById('conversion-edit-banner');
    var label = document.getElementById('conversion-edit-banner-label');
    if (banner) banner.style.display = 'flex';
    if (label) label.textContent = 'กำลังแก้ไขการแปลง: ' + rec.setName;

    var body = document.querySelector('#star-conversion-popup .sh-modal-body');
    if (body) body.scrollTop = 0;
  };

  window.cancelEditStarConversion = function(){
    window.__editingConversionHistoryId = null;
    var banner = document.getElementById('conversion-edit-banner');
    if (banner) banner.style.display = 'none';
  };

  window.deleteStarConversionHistory = function(id){
    confirm2('ยืนยันการลบ', 'ต้องการลบประวัติการแปลงคะแนนนี้ใช่หรือไม่? คะแนนที่เคยแปลงไว้จากรายการนี้จะถูกลบออกด้วย', async function(){
      var cid = window.currentActiveCourseId;
      if (!cid) return;
      var history = getConversionHistory(cid);
      var rec = history.find(function(h){ return h.id === id; });
      if (!rec) return;

      revertConversionEffect(cid, rec);
      var idx = history.indexOf(rec);
      if (idx !== -1) history.splice(idx, 1);

      if (window.__editingConversionHistoryId === id) window.cancelEditStarConversion();

      if (typeof window.saveStateToDB === 'function') await window.saveStateToDB();

      // ป็อปอัพยืนยันลบจะถูกปิดไปแล้วโดย showCustomConfirm เอง — ตรงนี้แค่รีเฟรชลิสต์ประวัติ
      // ในป็อปอัพ "แปลงดาวกลุ่ม" ที่ยังเปิดอยู่ ไม่ต้องปิดป็อปอัพนี้
      window.renderConversionHistoryList();
      if (typeof window.renderCourseOverview === 'function') window.renderCourseOverview();
      if (window.showCustomAlert) window.showCustomAlert('ลบสำเร็จ', 'ลบประวัติการแปลงคะแนนและคะแนนที่เกี่ยวข้องเรียบร้อยแล้ว');
    });
  };

  function confirm2(title, msg, cb){
    if (window.showCustomConfirm) window.showCustomConfirm(title, msg, cb);
    else if (confirm(title + '\n' + msg)) cb();
  }

  window.applyStarConversion = async function(){
    var cid = window.currentActiveCourseId;
    if (!cid || !window.__currentGroupData) return;

    var groupData = window.__currentGroupData;
    var setId = document.getElementById('conversion-set-id').value;
    var dest = document.getElementById('conversion-dest') ? document.getElementById('conversion-dest').value : 'bonus';
    var maxS = parseFloat(document.getElementById('conv-max-score').value) || 0;
    var minS = parseFloat(document.getElementById('conv-min-score').value) || 0;
    var starCourseData = (state.starGroups && state.starGroups[cid]) || {};
    var currentSet = (starCourseData.sets || []).find(s => s.id === setId);
    if (!currentSet) return;

    var history = getConversionHistory(cid);
    var editingId = window.__editingConversionHistoryId;
    var existingRec = editingId ? history.find(h => h.id === editingId) : null;

    // ถ้ากำลังแก้ไขของเดิม ให้ย้อนผลเดิมออกก่อน แล้วค่อยใส่ผลใหม่ทับด้วย id เดียวกัน
    if (existingRec) revertConversionEffect(cid, existingRec);

    var recId = existingRec ? existingRec.id : ('conv_' + Date.now());
    var planInfo = null;

    if (dest === 'week') {
      // แปลงเข้าคะแนนของสัปดาห์/งานที่มีอยู่จริง (state.scores ผูกกับ courseId + week + title ของแผนคะแนน)
      var planId = document.getElementById('conversion-plan-id') ? document.getElementById('conversion-plan-id').value : '';
      var plan = ((state.coursePlans && state.coursePlans[cid]) || []).find(p => p.id === planId);
      if (!plan) {
        if (window.showCustomAlert) window.showCustomAlert('กรุณาเลือกงาน', 'กรุณาเลือกสัปดาห์ / งานที่จะนำคะแนนไปใส่ก่อนบันทึก', true);
        return;
      }
      if (!state.scores) state.scores = [];
      var idx = state.scores.findIndex(s => s.courseId === cid && String(s.week) === String(plan.week) && s.title === plan.title);
      var recordsObj = idx !== -1 ? Object.assign({}, state.scores[idx].records) : {};

      groupData.forEach(g => {
        var groupObj = currentSet.groups.find(x => x.id === g.id);
        if (groupObj && groupObj.members) {
          groupObj.members.forEach(stId => {
            recordsObj[stId] = Math.max(0, Math.min(g.scaledScore, plan.maxScore));
          });
        }
      });

      if (idx !== -1) {
        state.scores[idx].records = recordsObj;
        state.scores[idx].maxScore = plan.maxScore;
        state.scores[idx].savedAt = Date.now();
      } else {
        state.scores.push({ id: Date.now().toString(), courseId: cid, week: plan.week, title: plan.title, maxScore: plan.maxScore, records: recordsObj, savedAt: Date.now() });
      }
      planInfo = { planId: plan.id, planWeek: plan.week, planTitle: plan.title };
    } else {
      // แปลงเข้าคะแนนโบนัส — ใช้ key เฉพาะของประวัติแต่ละรายการ เพื่อให้แก้ไข/ลบแยกรายการได้อิสระ
      var week = 'Bonus-Stars-' + recId;
      if (!state.bonusScores) state.bonusScores = {};
      if (!state.bonusScores[cid]) state.bonusScores[cid] = {};
      state.bonusScores[cid][week] = {};

      groupData.forEach(g => {
        var groupObj = currentSet.groups.find(x => x.id === g.id);
        if (groupObj && groupObj.members) {
          groupObj.members.forEach(stId => {
            state.bonusScores[cid][week][stId] = g.scaledScore;
          });
        }
      });
    }

    // เก็บสมาชิกของแต่ละกลุ่ม ณ ตอนแปลง ไว้ในประวัติ เพื่อให้ย้อนกลับ/แก้ไขภายหลังได้ถูกต้อง
    var groupDataSnapshot = groupData.map(function(g){
      var groupObj = currentSet.groups.find(x => x.id === g.id);
      return { id: g.id, name: g.name, stars: g.stars, rank: g.rank, scaledScore: g.scaledScore, members: (groupObj && groupObj.members) ? groupObj.members.slice() : [] };
    });

    var record = Object.assign({
      id: recId,
      setId: setId,
      setName: currentSet.name,
      dest: dest,
      maxScore: maxS,
      minScore: minS,
      groupData: groupDataSnapshot,
      appliedAt: Date.now()
    }, planInfo || {});

    if (existingRec) {
      Object.assign(existingRec, record);
    } else {
      history.unshift(record);
    }
    window.__editingConversionHistoryId = null;

    if (typeof window.saveStateToDB === 'function') await window.saveStateToDB();

    window.cancelEditStarConversion();
    window.renderConversionHistoryList();
    if (window.showCustomAlert) window.showCustomAlert('สำเร็จ', dest === 'week' ? 'แปลงคะแนนและบันทึกลงในงานที่เลือกเรียบร้อยแล้ว' : 'แปลงคะแนนและบันทึกโบนัสเรียบร้อยแล้ว');
    if (typeof window.renderCourseOverview === 'function') window.renderCourseOverview();
  };

  setTimeout(function(){ if (typeof window.renderCourseOverview === 'function') window.renderCourseOverview(); }, 1500);
})();
