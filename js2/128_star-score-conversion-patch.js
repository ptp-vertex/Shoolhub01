
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

    var starCourseData = (state.starGroups && state.starGroups[cid]) || {};
    var starSets = starCourseData.sets || [];
    
    if (starSets.length === 0 && starCourseData.groups) {
      starSets = [{ id: 'set_1', name: 'เซตที่ 1', groups: starCourseData.groups, weekStars: starCourseData.weekStars || {} }];
      state.starGroups[cid].sets = starSets;
    }

    if (starSets.length === 0) {
      if (window.showCustomAlert) window.showCustomAlert('ไม่พบกลุ่ม','กรุณาสร้างกลุ่มนักเรียนก่อนแปลงคะแนน', true);
      return;
    }

    var pop = document.getElementById('star-conversion-popup');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'star-conversion-popup';
      pop.className = 'fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4';
      document.body.appendChild(pop);
    }

    var setOptions = starSets.map((s, i) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');

    pop.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-500 text-white">
          <div><div class="font-black text-xl">แปลงคะแนนดาวกลุ่ม</div><div class="text-xs opacity-80">เฉลี่ยคะแนนตามลำดับดาวของกลุ่ม</div></div>
          <button onclick="document.getElementById('star-conversion-popup').classList.add('hidden')" class="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-full transition"><i class="fas fa-times"></i></button>
        </div>
        <div class="p-6 overflow-y-auto flex-1 space-y-6">
          <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <label class="block text-xs font-black text-slate-500 mb-2 uppercase tracking-wider">เลือกเซตกลุ่ม</label>
            <select id="conversion-set-id" class="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-amber-500 outline-none" onchange="window.updateConversionPreview()">
              ${setOptions}
            </select>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
              <label class="block text-xs font-black text-emerald-600 mb-2 uppercase tracking-wider">คะแนนสูงสุด (ที่ 1)</label>
              <input type="number" id="conv-max-score" class="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2 font-bold text-center" value="20" oninput="window.updateConversionPreview()">
            </div>
            <div class="bg-rose-50 p-4 rounded-2xl border border-rose-100">
              <label class="block text-xs font-black text-rose-600 mb-2 uppercase tracking-wider">คะแนนต่ำสุด (โหล)</label>
              <input type="number" id="conv-min-score" class="w-full bg-white border border-rose-200 rounded-xl px-4 py-2 font-bold text-center" value="10" oninput="window.updateConversionPreview()">
            </div>
          </div>

          <div id="conversion-preview-list" class="space-y-2"></div>
        </div>
        <div class="p-6 border-t border-slate-100 flex gap-3">
          <button onclick="document.getElementById('star-conversion-popup').classList.add('hidden')" class="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition">ยกเลิก</button>
          <button onclick="window.applyStarConversion()" class="flex-[2] py-3 bg-amber-500 text-white font-black rounded-2xl hover:bg-amber-600 shadow-lg shadow-amber-200 transition">บันทึกคะแนนลงช่องโบนัส</button>
        </div>
      </div>
    `;
    
    pop.classList.remove('hidden');
    window.updateConversionPreview();
   } catch(err) {
    console.error('[schoolhub-star-conversion] openStarConversionPopup error:', err);
    if (window.showCustomAlert) window.showCustomAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเปิดหน้าต่างแปลงคะแนนได้ กรุณาลองใหม่หรือรีเฟรชหน้า', true);
   }
  };

  window.updateConversionPreview = function(){
    var cid = window.currentActiveCourseId;
    var setId = document.getElementById('conversion-set-id').value;
    var maxS = parseFloat(document.getElementById('conv-max-score').value) || 0;
    var minS = parseFloat(document.getElementById('conv-min-score').value) || 0;
    
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

    var previewHtml = `<div class="text-[10px] font-black text-slate-400 mb-2 uppercase">พรีวิวการแปลงคะแนน (เฉลี่ยตามลำดับกลุ่ม)</div>`;
    previewHtml += groupData.map(g => `
      <div class="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-6 h-6 flex items-center justify-center bg-amber-100 text-amber-700 rounded-full text-[10px] font-black">${g.rank}</div>
          <div class="min-w-0">
            <div class="text-sm font-bold text-slate-700 truncate">${esc(g.name)}</div>
            <div class="text-[10px] text-slate-400">${g.stars} ⭐</div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-sm font-black text-emerald-600">${window.formatScoreDisplay(g.scaledScore, 2)}</div>
          <div class="text-[9px] text-slate-400 uppercase font-bold">คะแนนโบนัส</div>
        </div>
      </div>
    `).join('');

    document.getElementById('conversion-preview-list').innerHTML = previewHtml;
    window.__currentGroupData = groupData;
  };

  window.applyStarConversion = async function(){
    var cid = window.currentActiveCourseId;
    if (!cid || !window.__currentGroupData) return;

    var groupData = window.__currentGroupData;
    var setId = document.getElementById('conversion-set-id').value;
    var starCourseData = (state.starGroups && state.starGroups[cid]) || {};
    var currentSet = (starCourseData.sets || []).find(s => s.id === setId);
    if (!currentSet) return;

    var week = 'Bonus-Stars-' + setId;
    if (!state.bonusScores) state.bonusScores = {};
    if (!state.bonusScores[cid]) state.bonusScores[cid] = {};
    if (!state.bonusScores[cid][week]) state.bonusScores[cid][week] = {};

    groupData.forEach(g => {
      var groupObj = currentSet.groups.find(x => x.id === g.id);
      if (groupObj && groupObj.members) {
        groupObj.members.forEach(stId => {
          state.bonusScores[cid][week][stId] = g.scaledScore;
        });
      }
    });

    if (typeof window.saveStateToDB === 'function') await window.saveStateToDB();
    
    document.getElementById('star-conversion-popup').classList.add('hidden');
    if (window.showCustomAlert) window.showCustomAlert('สำเร็จ','แปลงคะแนนและบันทึกโบนัสเรียบร้อยแล้ว');
    if (typeof window.renderCourseOverview === 'function') window.renderCourseOverview();
  };

  setTimeout(function(){ if (typeof window.renderCourseOverview === 'function') window.renderCourseOverview(); }, 1500);
})();
