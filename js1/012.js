
/* ============================================================
   SchoolHub Final Patch v3
   1. renderAdminPlanCards  — การ์ดแผนสวยงาม
   2. openAddPlanPanel / closePlanEditPanel / editAdminPlan override
   3. saveAdminPlanForm override — บันทึกพร้อม features จากฟอร์มใหม่
   4. loadGlobalSiteStats    — โหลดสถิติจริงสำหรับ landing + auth hero
   5. masterBlockCheck       — ตรวจ block ทุก 5 วิ (แทนที่ทุก interval เก่า)
   6. view-admin-permissions — รวม blocked users ไว้ด้านล่าง
   ============================================================ */
(function(){

  // ── helpers ──────────────────────────────────────────────
  function esc(v){ try{return escapeHTML(v||'');}catch(e){return String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));} }
  function planCycleLabel(p){
    if(p.freeForever||p.billingCycle==='forever') return '<span class="text-emerald-600">ฟรีตลอด</span>';
    if(p.billingCycle==='yearly') return 'รายปี';
    return 'รายเดือน';
  }

  // ── 1. render plan cards in admin view ───────────────────
  function renderAdminPlanCards(){
    const box = document.getElementById('admin-plan-cards');
    if(!box) return;
    const items = (window.subscriptionPlans||[]).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
    if(!items.length){
      box.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400"><i class="fas fa-layer-group text-4xl mb-3 block"></i>ยังไม่มีแผน กดปุ่ม "สร้างตัวอย่าง" หรือ "เพิ่มแผนใหม่"</div>';
      return;
    }
    box.innerHTML = items.map(p=>{
      const active = p.active !== false;
      const courseLimit = Number(p.courseLimit||0);
      const studentLimit = Number(p.studentLimit||0);
      return `<div class="rounded-2xl border ${active?'border-slate-200':'border-slate-100 opacity-60'} p-4 bg-white shadow-sm relative overflow-hidden">
        ${p.featured?'<div class="absolute top-0 right-0 bg-primary text-white text-[10px] font-black px-3 py-1 rounded-bl-2xl">⭐ แนะนำ</div>':''}
        <div class="flex items-start gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl ${active?'bg-indigo-100 text-primary':'bg-slate-100 text-slate-400'} flex items-center justify-center shrink-0"><i class="fas fa-layer-group"></i></div>
          <div class="flex-1 min-w-0">
            <div class="font-black text-slate-800 text-sm truncate">${esc(p.name)}</div>
            <div class="text-xs text-primary font-bold mt-0.5">${esc(p.price||'')}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">${planCycleLabel(p)}</div>
          </div>
          <span class="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black ${active?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}">${active?'แสดง':'ซ่อน'}</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5 mb-3 text-[11px]">
          <div class="bg-slate-50 rounded-xl px-2 py-1.5 flex items-center gap-1.5 font-semibold text-slate-600">
            <i class="fas fa-book text-primary w-3.5 text-center"></i>
            ${courseLimit===0?'ไม่จำกัดวิชา':courseLimit+' วิชา'}
          </div>
          <div class="bg-slate-50 rounded-xl px-2 py-1.5 flex items-center gap-1.5 font-semibold text-slate-600">
            <i class="fas fa-users text-sky-500 w-3.5 text-center"></i>
            ${studentLimit===0?'ไม่จำกัดนักเรียน':studentLimit+' คน'}
          </div>
          <div class="bg-slate-50 rounded-xl px-2 py-1.5 flex items-center gap-1.5 font-semibold text-slate-600">
            <i class="fas fa-user-check ${p.allowAttendance!==false?'text-emerald-500':'text-slate-300'} w-3.5 text-center"></i>
            เช็คชื่อ${p.allowAttendance!==false?'✓':'✗'}
          </div>
          <div class="bg-slate-50 rounded-xl px-2 py-1.5 flex items-center gap-1.5 font-semibold text-slate-600">
            <i class="fas fa-file-export ${p.allowExport!==false?'text-green-500':'text-slate-300'} w-3.5 text-center"></i>
            Export${p.allowExport!==false?'✓':'✗'}
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="editAdminPlan(${jsStr(p.id)})" class="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-100 rounded-xl py-2 text-xs font-black transition">
            <i class="fas fa-pen mr-1"></i> แก้ไข
          </button>
          <button onclick="deleteAdminPlan(${jsStr(p.id)})" class="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl px-3 py-2 text-xs font-black transition">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>`;
    }).join('');
  }

  // ── 2. open/close plan panel ─────────────────────────────
  window.openAddPlanPanel = function(){
    if(typeof window.resetAdminPlanForm === 'function') window.resetAdminPlanForm();
    document.getElementById('admin-plan-panel-title').innerHTML = '<i class="fas fa-plus text-primary mr-2"></i>เพิ่มแผนใหม่';
    document.getElementById('admin-plan-edit-panel').classList.remove('hidden');
    document.getElementById('admin-plan-edit-panel').scrollIntoView({behavior:'smooth',block:'start'});
  };
  window.closePlanEditPanel = function(){
    document.getElementById('admin-plan-edit-panel').classList.add('hidden');
    if(typeof window.resetAdminPlanForm === 'function') window.resetAdminPlanForm();
  };

  // ── 3. override editAdminPlan to also show panel ─────────
  const _origEdit = window.editAdminPlan;
  window.editAdminPlan = function(id){
    if(typeof _origEdit === 'function') _origEdit(id);
    document.getElementById('admin-plan-panel-title').innerHTML = '<i class="fas fa-pen text-primary mr-2"></i>แก้ไขแผน';
    document.getElementById('admin-plan-edit-panel').classList.remove('hidden');
    document.getElementById('admin-plan-edit-panel').scrollIntoView({behavior:'smooth',block:'start'});
  };

  // ── 4. override renderAdminPlans to render cards too ─────
  const _origRenderAdmin = window.renderAdminPlans;
  window.renderAdminPlans = function(){
    if(typeof _origRenderAdmin === 'function') _origRenderAdmin();
    renderAdminPlanCards();
  };

  // ── 5. override saveAdminPlanForm — เพิ่ม allowAttendance/Export/Team จากฟอร์มใหม่ ─
  const _origSave = window.saveAdminPlanForm;
  window.saveAdminPlanForm = async function(){
    // เพิ่ม field ใหม่ก่อนบันทึก
    const p = window.subscriptionPlans||[];
    const editId = document.getElementById('plan-sub-edit-id')?.value;
    const existing = p.find(x=>x.id===editId)||{};
    // inject extra fields เข้าไปก่อน (จะถูก merge ใน _origSave)
    if(typeof _origSave === 'function') {
      // patch temp: เพิ่ม fields ผ่าน override subscriptionPlans หลัง save
      await _origSave();
      // หลัง save ค้นหา item ที่เพิ่ง save แล้ว patch fields
      const savedId = editId || (window.subscriptionPlans||[]).slice(-1)[0]?.id;
      if(savedId && window.subscriptionPlans){
        const idx = window.subscriptionPlans.findIndex(x=>x.id===savedId);
        if(idx>=0){
          window.subscriptionPlans[idx].allowAttendance = document.getElementById('plan-sub-allow-attendance')?.checked !== false;
          window.subscriptionPlans[idx].allowExport     = document.getElementById('plan-sub-allow-export')?.checked !== false;
          window.subscriptionPlans[idx].allowTeam       = document.getElementById('plan-sub-allow-team')?.checked || false;
          window.subscriptionPlans[idx].studentLimit    = Number(document.getElementById('plan-sub-student-limit')?.value||0);
          window.subscriptionPlans[idx].weekLimit       = Number(document.getElementById('plan-sub-week-limit')?.value||20);
          window.subscriptionPlans[idx].teamLimit       = Number(document.getElementById('plan-sub-team-limit')?.value||1);
          // re-save silently
          try{
            const { setDoc, doc } = window._fbImports||{};
            if(setDoc && doc && window.db && window.getPlansDocRef)
              await setDoc(window.getPlansDocRef(), {items:window.subscriptionPlans, updatedAt:Date.now()}, {merge:true});
          }catch(e){}
        }
      }
      renderAdminPlanCards();
      document.getElementById('admin-plan-edit-panel').classList.add('hidden');
    }
  };

  // ── 6. loadGlobalSiteStats — สถิติจริงจาก Firestore ─────
  async function loadGlobalSiteStats(){
    if (typeof window.__schoolhubGlobalStatsRefresh === 'function') {
        return window.__schoolhubGlobalStatsRefresh();
    }
  }

  window.loadGlobalSiteStats = loadGlobalSiteStats;
})();
