
(function(){
  const firebaseConfig = {
    apiKey: "AIzaSyADAbTJEWivV1Nn-au7tXofStx4ADYTCM8",
    authDomain: "shoolhub-5677e.firebaseapp.com",
    projectId: "shoolhub-5677e",
    storageBucket: "shoolhub-5677e.firebasestorage.app",
    messagingSenderId: "630487358153",
    appId: "1:630487358153:web:1866add5d4a29b74abcb18",
    measurementId: "G-2Q6R46DC38"
  };
  import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js").then(appMod=>{
    return Promise.all([
      Promise.resolve(appMod),
      import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js")
    ]);
  }).then(([appMod, fs, authMod])=>{
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
    const db = fs.getFirestore(app);
    const auth = authMod.getAuth(app);
    const menuDoc = fs.doc(db, 'system_settings', 'custom_main_menus');
    const plansDoc = fs.doc(db, 'system_settings', 'subscription_plans');
    let customMenus = [];
    let customPlans = [];
    let editingMenuId = null;

    const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
    const normalize = s => String(s||'').trim().toLowerCase();
    const alertBox = (t,m,err=false) => (window.showCustomAlert ? window.showCustomAlert(t,m,err) : alert(t+'\n'+(m||'')));

    function ensureViews(){
      const mainContent = document.querySelector('main > div.flex-1.overflow-y-auto') || document.querySelector('main');
      if(mainContent && !document.getElementById('schoolhub-custom-menu-admin-view')){
        mainContent.insertAdjacentHTML('beforeend', `
          <div id="schoolhub-custom-menu-admin-view" class="view-section hidden fade-in space-y-6">
            <div class="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div class="p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 class="text-lg font-black text-slate-800"><i class="fas fa-puzzle-piece text-fuchsia-600 mr-2"></i>จัดการเมนูหลักเพิ่มเติม</h3>
                  <p class="text-sm text-slate-500 mt-1">เพิ่มเมนูให้ผู้ใช้งาน โดยเลือกฝังเป็นเว็บไซต์หรือโค้ด HTML และกำหนดสิทธิ์ตามแผนได้</p>
                </div>
                <button id="shcm-add-btn" class="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-xl text-sm font-bold"><i class="fas fa-plus mr-1"></i> เพิ่มเมนูใหม่</button>
              </div>
              <div class="p-5 grid grid-cols-1 xl:grid-cols-5 gap-5 shcm-admin-grid">
                <div class="xl:col-span-2 bg-slate-50 rounded-3xl border border-slate-100 p-4">
                  <h4 id="shcm-form-title" class="font-black text-slate-800 mb-3">เพิ่มเมนูใหม่</h4>
                  <div class="space-y-3">
                    <div><label class="text-xs font-bold text-slate-500">ชื่อเมนู</label><input id="shcm-title" class="shcm-field" placeholder="เช่น ระบบทะเบียน / คู่มือ / แบบฟอร์ม"></div>
                    <div><label class="text-xs font-bold text-slate-500">ไอคอน Font Awesome</label><input id="shcm-icon" class="shcm-field" placeholder="เช่น fas fa-globe" value="fas fa-link"></div>
                    <div class="grid grid-cols-2 gap-3">
                      <div><label class="text-xs font-bold text-slate-500">ประเภทการฝัง</label><select id="shcm-type" class="shcm-field"><option value="url">ฝังเป็นเว็บ URL</option><option value="html">ฝังเป็นโค้ด HTML</option></select></div>
                      <div><label class="text-xs font-bold text-slate-500">ลำดับ</label><input id="shcm-order" type="number" class="shcm-field" value="99"></div>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500">URL เว็บไซต์</label><input id="shcm-url" class="shcm-field" placeholder="https://..."></div>
                    <div><label class="text-xs font-bold text-slate-500">โค้ด HTML</label><textarea id="shcm-html" class="shcm-field min-h-[130px] font-mono text-xs" placeholder="วางโค้ด HTML ที่ต้องการฝัง"></textarea></div>
                    <div class="grid grid-cols-2 gap-3">
                      <label class="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-3 font-bold text-sm"><input id="shcm-active" type="checkbox" checked> เปิดใช้งาน</label>
                      <label class="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-3 font-bold text-sm"><input id="shcm-show-users" type="checkbox" checked> แสดงที่ผู้ใช้งาน</label>
                    </div>
                    <div>
                      <label class="text-xs font-bold text-slate-500">แผนที่มีสิทธิ์เห็นเมนูนี้</label>
                      <div class="text-xs text-slate-400 mb-2">ไม่เลือกเลย = ทุกแผนเห็นได้</div>
                      <div id="shcm-plan-checks" class="grid grid-cols-1 sm:grid-cols-2 gap-2"></div>
                    </div>
                    <div class="flex gap-2 pt-2">
                      <button id="shcm-save-btn" class="flex-1 bg-primary hover:bg-indigo-700 text-white py-3 rounded-xl font-black"><i class="fas fa-save mr-1"></i> บันทึกเมนู</button>
                      <button id="shcm-reset-btn" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold">ล้าง</button>
                    </div>
                  </div>
                </div>
                <div class="xl:col-span-3">
                  <div id="shcm-admin-list" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
                </div>
              </div>
            </div>
          </div>
          <div id="schoolhub-custom-menu-user-view" class="view-section hidden fade-in space-y-4 shcm-popup-mode">
            <div class="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
              <div class="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 id="shcm-user-title" class="text-lg font-black text-slate-800">เมนูเพิ่มเติม</h3>
                  <p id="shcm-user-subtitle" class="text-sm text-slate-500">แสดงเนื้อหาที่ผู้ดูแลระบบกำหนด</p>
                </div>
                <button onclick="goToHome && goToHome()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold"><i class="fas fa-arrow-left mr-1"></i> กลับ</button>
              </div>
              <div id="shcm-user-content"></div>
            </div>
          </div>
        `);
        document.getElementById('shcm-add-btn')?.addEventListener('click', resetForm);
        document.getElementById('shcm-reset-btn')?.addEventListener('click', resetForm);
        document.getElementById('shcm-save-btn')?.addEventListener('click', saveMenu);
        document.getElementById('shcm-type')?.addEventListener('change', syncFormType);
      }
      if(!document.getElementById('nav-admin-custom-menus')){
        const adminPlans = document.getElementById('nav-admin-plans');
        adminPlans?.insertAdjacentHTML('afterend', `<button id="nav-admin-custom-menus" onclick="openCustomMenuAdmin()" class="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all text-fuchsia-600 hover:bg-fuchsia-50 mt-2" data-target="custom-menus"><i class="fas fa-puzzle-piece w-5 text-center"></i> เมนูหลักเพิ่มเติม</button>`);
      }
      const mobileAdmin = document.querySelector('#mobile-menu .text-rose-600')?.parentElement;
      if(mobileAdmin && !document.getElementById('mobile-nav-admin-custom-menus')){
        mobileAdmin.insertAdjacentHTML('beforeend', `<button id="mobile-nav-admin-custom-menus" onclick="openCustomMenuAdmin(); toggleMobileMenu && toggleMobileMenu()" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-fuchsia-600 bg-fuchsia-50 font-medium"><i class="fas fa-puzzle-piece"></i> เมนูหลักเพิ่มเติม</button>`);
      }
    }

    function getCurrentPlanId(){
      return normalize(window.__currentUserDir?.planId || window.currentUserPlan?.id || window.activePlan?.id || '');
    }
    function canSeeMenu(m){
      if(!m || m.active === false || m.showToUsers === false) return false;
      const ids = Array.isArray(m.allowedPlanIds) ? m.allowedPlanIds.map(normalize).filter(Boolean) : [];
      if(!ids.length) return true;
      return ids.includes(getCurrentPlanId());
    }
    function renderUserMenuButtons(){
      const desktopAnchor = document.getElementById('nav-user-plans') || document.getElementById('nav-students');
      const mobileAnchor = document.getElementById('mobile-nav-user-plans') || document.getElementById('mobile-nav-students');
      document.querySelectorAll('.shcm-user-nav-btn').forEach(x=>x.remove());
      customMenus.filter(canSeeMenu).sort((a,b)=>Number(a.order||99)-Number(b.order||99)).forEach(m=>{
        const id = esc(m.id);
        const icon = esc(m.icon || 'fas fa-link');
        const title = esc(m.title || 'เมนูเพิ่มเติม');
        desktopAnchor?.insertAdjacentHTML('afterend', `<button class="shcm-user-nav-btn nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all" onclick="openCustomMenuUser('${id}')" data-target="custom-menu-${id}"><i class="${icon} w-5 text-center"></i> ${title}</button>`);
        mobileAnchor?.insertAdjacentHTML('afterend', `<button class="shcm-user-nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-slate-700 hover:bg-slate-50 font-medium" onclick="openCustomMenuUser('${id}'); toggleMobileMenu && toggleMobileMenu()"><i class="${icon}"></i> ${title}</button>`);
      });
    }

    function renderAdmin(){
      ensureViews();
      renderPlanChecks();
      const box = document.getElementById('shcm-admin-list');
      if(!box) return;
      if(!customMenus.length){ box.innerHTML = `<div class="col-span-full text-center p-10 text-slate-400 bg-slate-50 rounded-3xl border border-dashed border-slate-200">ยังไม่มีเมนูเพิ่มเติม</div>`; return; }
      const planMap = Object.fromEntries((customPlans||[]).map(p=>[normalize(p.id), p.name || p.id]));
      box.innerHTML = customMenus.slice().sort((a,b)=>Number(a.order||99)-Number(b.order||99)).map(m=>{
        const ids = (m.allowedPlanIds||[]).map(normalize).filter(Boolean);
        const planText = ids.length ? ids.map(id=>planMap[id]||id).join(', ') : 'ทุกแผน';
        return `<div class="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
          <div class="flex items-start gap-3"><div class="w-11 h-11 rounded-2xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center"><i class="${esc(m.icon||'fas fa-link')}"></i></div><div class="min-w-0 flex-1"><h4 class="font-black text-slate-800 truncate">${esc(m.title||'เมนูเพิ่มเติม')}</h4><p class="text-xs text-slate-400 mt-1">${m.type==='html'?'ฝัง HTML':'ฝังเว็บ URL'} • ลำดับ ${esc(m.order||99)}</p></div></div>
          <div class="mt-4 text-sm text-slate-600 space-y-1"><div><b>สถานะ:</b> ${m.active!==false?'เปิดใช้งาน':'ปิดใช้งาน'} / ${m.showToUsers!==false?'แสดงผู้ใช้':'ซ่อนจากผู้ใช้'}</div><div><b>แผนที่เห็น:</b> ${esc(planText)}</div></div>
          <div class="mt-4 flex gap-2"><button onclick="editCustomMenu('${esc(m.id)}')" class="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-2 rounded-xl font-bold text-sm"><i class="fas fa-pen mr-1"></i> แก้ไข</button><button onclick="deleteCustomMenu('${esc(m.id)}')" class="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-2 rounded-xl font-bold text-sm"><i class="fas fa-trash"></i></button></div>
        </div>`;
      }).join('');
    }
    function renderPlanChecks(selected=[]){
      const box = document.getElementById('shcm-plan-checks');
      if(!box) return;
      const sel = new Set((selected||[]).map(normalize));
      const plans = (customPlans||[]).filter(p=>p && p.id);
      box.innerHTML = plans.length ? plans.map(p=>`<label class="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-2 text-sm font-bold"><input type="checkbox" class="shcm-plan" value="${esc(p.id)}" ${sel.has(normalize(p.id))?'checked':''}> ${esc(p.name||p.id)}</label>`).join('') : `<div class="text-sm text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 p-3">ยังไม่พบข้อมูลแผน ถ้าไม่เลือก ระบบจะถือว่าเห็นได้ทุกแผน</div>`;
    }
    function syncFormType(){
      const type = document.getElementById('shcm-type')?.value || 'url';
      document.getElementById('shcm-url')?.closest('div')?.classList.toggle('hidden', type !== 'url');
      document.getElementById('shcm-html')?.closest('div')?.classList.toggle('hidden', type !== 'html');
    }
    function resetForm(){
      editingMenuId=null;
      const set=(id,v)=>{const el=document.getElementById(id); if(el) el.value=v;};
      set('shcm-title',''); set('shcm-icon','fas fa-link'); set('shcm-type','url'); set('shcm-url',''); set('shcm-html',''); set('shcm-order','99');
      const active=document.getElementById('shcm-active'); if(active) active.checked=true;
      const show=document.getElementById('shcm-show-users'); if(show) show.checked=true;
      const t=document.getElementById('shcm-form-title'); if(t) t.textContent='เพิ่มเมนูใหม่';
      renderPlanChecks([]); syncFormType();
    }
    async function saveAll(){ await fs.setDoc(menuDoc, {items:customMenus, updatedAt:Date.now()}, {merge:true}); }
    async function saveMenu(){
      const title = document.getElementById('shcm-title')?.value.trim();
      if(!title) return alertBox('กรอกชื่อเมนู','กรุณากรอกชื่อเมนูก่อน',true);
      const type = document.getElementById('shcm-type')?.value || 'url';
      const url = document.getElementById('shcm-url')?.value.trim() || '';
      const html = document.getElementById('shcm-html')?.value || '';
      if(type==='url' && !url) return alertBox('กรอก URL','กรุณากรอก URL เว็บไซต์',true);
      if(type==='html' && !html.trim()) return alertBox('กรอก HTML','กรุณาวางโค้ด HTML',true);
      const allowedPlanIds = Array.from(document.querySelectorAll('.shcm-plan:checked')).map(x=>x.value);
      const item = { id: editingMenuId || ('menu_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)), title, icon:document.getElementById('shcm-icon')?.value.trim()||'fas fa-link', type, url, html, order:Number(document.getElementById('shcm-order')?.value||99), active:!!document.getElementById('shcm-active')?.checked, showToUsers:!!document.getElementById('shcm-show-users')?.checked, allowedPlanIds, updatedAt:Date.now() };
      const i = customMenus.findIndex(x=>x.id===item.id);
      if(i>=0) customMenus[i]=item; else customMenus.push(item);
      try{ await saveAll(); alertBox('บันทึกแล้ว','อัปเดตเมนูหลักเพิ่มเติมเรียบร้อย'); resetForm(); renderAdmin(); renderUserMenuButtons(); }catch(e){ alertBox('บันทึกไม่ได้', e.message || String(e), true); }
    }

    window.openCustomMenuAdmin = function(){
      ensureViews();
      document.querySelectorAll('.view-section').forEach(v=>v.classList.add('hidden'));
      document.getElementById('schoolhub-custom-menu-admin-view')?.classList.remove('hidden');
      const pt=document.getElementById('page-title'); if(pt) pt.textContent='เมนูหลักเพิ่มเติม';
      const ps=document.getElementById('page-subtitle'); if(ps) ps.textContent='เพิ่มเมนูแบบฝังเว็บหรือ HTML และกำหนดสิทธิ์ตามแผน';
      renderAdmin();
    };
    window.editCustomMenu = function(id){
      const m=customMenus.find(x=>x.id===id); if(!m) return;
      editingMenuId=id;
      const set=(k,v)=>{const el=document.getElementById(k); if(el) el.value=v??'';};
      set('shcm-title',m.title); set('shcm-icon',m.icon||'fas fa-link'); set('shcm-type',m.type||'url'); set('shcm-url',m.url||''); set('shcm-html',m.html||''); set('shcm-order',m.order||99);
      const active=document.getElementById('shcm-active'); if(active) active.checked=m.active!==false;
      const show=document.getElementById('shcm-show-users'); if(show) show.checked=m.showToUsers!==false;
      const t=document.getElementById('shcm-form-title'); if(t) t.textContent='แก้ไขเมนู';
      renderPlanChecks(m.allowedPlanIds||[]); syncFormType(); document.getElementById('shcm-title')?.focus();
    };
    window.deleteCustomMenu = function(id){
      const run=async()=>{ customMenus=customMenus.filter(x=>x.id!==id); try{ await saveAll(); renderAdmin(); renderUserMenuButtons(); alertBox('ลบแล้ว','ลบเมนูเรียบร้อย'); }catch(e){ alertBox('ลบไม่ได้', e.message || String(e), true); } };
      if(window.showCustomConfirm) window.showCustomConfirm('ลบเมนู','ยืนยันลบเมนูนี้หรือไม่?',run); else if(confirm('ยืนยันลบเมนูนี้หรือไม่?')) run();
    };
    window.openCustomMenuUser = function(id){
      const m=customMenus.find(x=>x.id===id);
      if(!m || !canSeeMenu(m)) return alertBox('ไม่มีสิทธิ์เข้าเมนูนี้','แผนปัจจุบันของคุณไม่รองรับเมนูนี้',true);
      ensureViews();
      document.querySelectorAll('.view-section').forEach(v=>v.classList.add('hidden'));
      document.getElementById('schoolhub-custom-menu-user-view')?.classList.remove('hidden');
      const pt=document.getElementById('page-title'); if(pt) pt.textContent=m.title||'เมนูเพิ่มเติม';
      const ps=document.getElementById('page-subtitle'); if(ps) ps.textContent='เมนูที่ผู้ดูแลระบบเพิ่มให้';
      const title=document.getElementById('shcm-user-title'); if(title) title.textContent=m.title||'เมนูเพิ่มเติม';
      const box=document.getElementById('shcm-user-content'); if(!box) return;
      if(m.type==='html') box.innerHTML = `<iframe sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts" srcdoc="${esc(m.html||'')}"></iframe>`;
      else box.innerHTML = `<iframe sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts" src="${esc(m.url||'about:blank')}"></iframe>`;
    };

    async function loadPlansOnce(){
      try{ const s=await fs.getDoc(plansDoc); if(s.exists()) customPlans = Array.isArray(s.data().items) ? s.data().items : []; }catch(e){ console.warn('custom menu load plans failed',e); }
    }
    function start(){
      ensureViews(); resetForm();
      fs.onSnapshot(menuDoc, snap=>{ customMenus = snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : []; ensureViews(); renderUserMenuButtons(); renderAdmin(); }, err=>console.warn('custom menu snapshot failed',err));
      fs.onSnapshot(plansDoc, snap=>{ customPlans = snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : []; renderPlanChecks(editingMenuId ? (customMenus.find(x=>x.id===editingMenuId)?.allowedPlanIds||[]) : []); renderAdmin(); renderUserMenuButtons(); }, err=>console.warn('custom menu plans snapshot failed',err));
      setInterval(renderUserMenuButtons, 3000);
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();
  }).catch(e=>console.error('SchoolHub custom menu system failed', e));
})();
