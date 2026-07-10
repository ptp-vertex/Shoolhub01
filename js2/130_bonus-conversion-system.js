
(function(W){
  'use strict';
  
  if (W.__schoolhubBonusConversionSystem) return;
  W.__schoolhubBonusConversionSystem = true;

  function esc(v){ try { return W.escapeHTML ? W.escapeHTML(v) : String(v||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); } catch(e){ return String(v||''); } }
  function byId(id){ return document.getElementById(id); }
  function getState(){ return W.state || {}; }
  function getCid(){ return W.currentActiveCourseId || null; }
  async function dbSave(){ if(typeof W.saveStateToDB==='function') return W.saveStateToDB(); return Promise.resolve(); }

  // ── 1. Data Structure for Bonus Conversion ──────────────────────────
  // state.bonusConversions[cid] = [ { id, timestamp, type: 'total'|'week', weekNum, percent, history: { sid: val } } ]

  W.openBonusConversionPopup = function(){
    const cid = getCid();
    if (!cid) {
      if (W.showCustomAlert) W.showCustomAlert('ไม่พบวิชาที่เลือก','กรุณาเปิดวิชาก่อนใช้งานฟีเจอร์นี้', true);
      return;
    }

    let pop = byId('sh-bonus-conv-popup');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'sh-bonus-conv-popup';
      pop.className = 'fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4';
      document.body.appendChild(pop);
    }

    const plans = (getState().coursePlans && getState().coursePlans[cid]) || [];
    const weekOptions = plans.map(p => `<option value="${p.week}">สัปดาห์ที่ ${p.week} (${p.title})</option>`).join('');

    pop.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white">
          <div>
            <div class="font-black text-xl">จัดการการแปลงคะแนนโบนัส</div>
            <div class="text-xs opacity-80 text-emerald-100">แปลงคะแนนโบนัสสะสมเข้าสู่คะแนนเก็บหรือคะแนนรวม</div>
          </div>
          <button onclick="document.getElementById('sh-bonus-conv-popup').classList.add('hidden')" class="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-full transition"><i class="fas fa-times"></i></button>
        </div>
        
        <div class="p-6 overflow-y-auto flex-1 space-y-6">
          <!-- Settings -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label class="block text-xs font-black text-slate-500 mb-2 uppercase tracking-wider">เป้าหมายการแปลง</label>
              <select id="sh-bc-target" class="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" onchange="W.updateBonusConvUI()">
                <option value="total">แปลงเข้าคะแนนรวมโดยตรง (Total)</option>
                <option value="week">แปลงเข้าสัปดาห์คะแนน (Week)</option>
              </select>
            </div>
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label class="block text-xs font-black text-slate-500 mb-2 uppercase tracking-wider">สัดส่วนการแปลง (%)</label>
              <input type="number" id="sh-bc-percent" class="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 font-bold text-center focus:ring-2 focus:ring-emerald-500 outline-none" value="100" min="1" max="100">
            </div>
          </div>

          <div id="sh-bc-week-select-box" class="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 hidden">
            <label class="block text-xs font-black text-indigo-600 mb-2 uppercase tracking-wider">เลือกสัปดาห์ที่ต้องการแปลงเข้า</label>
            <select id="sh-bc-week-num" class="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
              ${weekOptions || '<option value="">-- ยังไม่มีแผนการสอน --</option>'}
            </select>
          </div>

          <!-- History -->
          <div>
            <label class="block text-xs font-black text-slate-400 mb-3 uppercase tracking-wider">ประวัติการแปลงคะแนน</label>
            <div id="sh-bc-history" class="space-y-2">
              <!-- History items here -->
            </div>
          </div>
        </div>

        <div class="p-6 border-t border-slate-100 flex gap-3">
          <button onclick="document.getElementById('sh-bonus-conv-popup').classList.add('hidden')" class="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition">ปิดหน้าต่าง</button>
          <button onclick="W.applyBonusConversion()" class="flex-[2] py-3 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition">ดำเนินการแปลงคะแนน</button>
        </div>
      </div>
    `;

    pop.classList.remove('hidden');
    W.updateBonusConvUI();
  };

  W.updateBonusConvUI = function(){
    const target = byId('sh-bc-target').value;
    const weekBox = byId('sh-bc-week-select-box');
    if (target === 'week') weekBox.classList.remove('hidden');
    else weekBox.classList.add('hidden');
    W.renderBonusConvHistory();
  };

  W.renderBonusConvHistory = function(){
    const cid = getCid();
    const st = getState();
    if (!st.bonusConversions) st.bonusConversions = {};
    const convs = st.bonusConversions[cid] || [];
    const container = byId('sh-bc-history');
    if (!container) return;

    if (convs.length === 0) {
      container.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-2xl">ยังไม่มีประวัติการแปลงคะแนน</div>';
      return;
    }

    container.innerHTML = convs.map((c, idx) => {
      const date = new Date(c.timestamp).toLocaleString('th-TH', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
      const typeText = c.target === 'total' ? '<span class="text-emerald-600">คะแนนรวม (Total)</span>' : `<span class="text-indigo-600">สัปดาห์ที่ ${c.weekNum}</span>`;
      return `
        <div class="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-emerald-200 transition group">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-500 rounded-xl group-hover:bg-emerald-50 group-hover:text-emerald-600 transition">
              <i class="fas ${c.target === 'total' ? 'fa-chart-pie' : 'fa-calendar-check'}"></i>
            </div>
            <div>
              <div class="text-sm font-black text-slate-700">แปลงเข้า ${typeText}</div>
              <div class="text-[10px] text-slate-400 font-bold uppercase">${date} • สัดส่วน ${c.percent}%</div>
            </div>
          </div>
          <button onclick="W.deleteBonusConversion('${c.id}')" class="w-8 h-8 flex items-center justify-center text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition" title="ลบรายการนี้">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
    }).join('');
  };

  W.applyBonusConversion = async function(){
    const cid = getCid();
    if (!cid) return;
    const target = byId('sh-bc-target').value;
    const percent = parseFloat(byId('sh-bc-percent').value) || 0;
    const weekNum = target === 'week' ? byId('sh-bc-week-num').value : null;

    if (percent <= 0 || percent > 100) {
      if (W.showCustomAlert) W.showCustomAlert('ค่าไม่ถูกต้อง','กรุณาระบุสัดส่วนการแปลงระหว่าง 1-100%', true);
      return;
    }
    if (target === 'week' && !weekNum) {
      if (W.showCustomAlert) W.showCustomAlert('ไม่ได้เลือกสัปดาห์','กรุณาเลือกสัปดาห์ที่ต้องการแปลงเข้า', true);
      return;
    }

    const st = getState();
    const students = (typeof W.getCourseStudents === 'function') ? W.getCourseStudents(cid) : [];
    const bonusByCid = (st.bonusScores && st.bonusScores[cid]) || {};
    
    const conversionResult = {};
    students.forEach(s => {
      let totalBonus = 0;
      Object.keys(bonusByCid).forEach(wk => {
        // กรองเอาเฉพาะโบนัสปกติ (w1, w2, ...) ไม่เอาโบนัสที่เกิดจากการแปลงอื่นๆ (ถ้ามี)
        if (wk.startsWith('w')) {
          const val = bonusByCid[wk] && bonusByCid[wk][s.id];
          if (val !== undefined && val !== '' && !isNaN(Number(val))) totalBonus += Number(val);
        }
      });
      if (totalBonus > 0) {
        conversionResult[s.id] = totalBonus * (percent / 100);
      }
    });

    if (Object.keys(conversionResult).length === 0) {
      if (W.showCustomAlert) W.showCustomAlert('ไม่มีคะแนน','ยังไม่มีคะแนนโบนัสให้นักเรียนคนใดเลย จึงไม่สามารถแปลงได้', true);
      return;
    }

    if (!st.bonusConversions) st.bonusConversions = {};
    if (!st.bonusConversions[cid]) st.bonusConversions[cid] = [];

    const newConv = {
      id: 'bc-' + Date.now(),
      timestamp: Date.now(),
      target: target,
      weekNum: weekNum,
      percent: percent,
      data: conversionResult
    };

    st.bonusConversions[cid].push(newConv);
    await dbSave();

    if (W.showCustomAlert) W.showCustomAlert('สำเร็จ','แปลงคะแนนโบนัสเรียบร้อยแล้ว');
    W.renderBonusConvHistory();
    if (typeof W.renderCourseOverview === 'function') W.renderCourseOverview();
  };

  W.deleteBonusConversion = async function(convId){
    const cid = getCid();
    if (!cid || !convId) return;
    
    if (typeof W.showCustomConfirm === 'function') {
      W.showCustomConfirm('ยืนยันการลบ','ต้องการยกเลิกการแปลงคะแนนรายการนี้ใช่หรือไม่? คะแนนที่ถูกบวกไปจะถูกนำออก', async function(){
        const st = getState();
        if (st.bonusConversions && st.bonusConversions[cid]) {
          st.bonusConversions[cid] = st.bonusConversions[cid].filter(c => c.id !== convId);
          await dbSave();
          W.renderBonusConvHistory();
          if (typeof W.renderCourseOverview === 'function') W.renderCourseOverview();
        }
      });
    }
  };

  // ── 2. Overview Patch for Rendering ──────────────────────────────────
  // เราจะไปแก้ที่ 007.js หรือไฟล์ที่เกี่ยวข้องเพื่อดึงข้อมูลจาก state.bonusConversions มาแสดงผล

})(window);
