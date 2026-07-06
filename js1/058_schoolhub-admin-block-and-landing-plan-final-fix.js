
/* Final fix:
   1) บล็อก/ปลดบล็อกต้องอัปเดต doc ที่แสดงจริง (ตอนนี้ public_users_directory ใช้อีเมลเป็น doc id)
   2) กล่องแผนหน้าแรกก่อนล็อกอินใช้ข้อมูล/รูปแบบเดียวกับหน้าเลือกแผน
*/
import { getApps } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function(){
  if(window.__schoolhubAdminBlockLandingPlanFinalFix) return;
  window.__schoolhubAdminBlockLandingPlanFinalFix = true;

  const app = getApps()[0];
  if(!app) return;
  const db = getFirestore(app);
  const PUBLIC = 'public_users_directory';
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const norm = v => String(v || '').trim().toLowerCase();
  const isEmail = v => emailRe.test(norm(v));
  const esc = v => {
    try { return window.escapeHTML ? window.escapeHTML(v || '') : String(v || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
    catch(e){ return String(v || ''); }
  };

  function publicPath(){
    try { return typeof window.getPublicPath === 'function' ? window.getPublicPath() : PUBLIC; }
    catch(e){ return PUBLIC; }
  }
  function showLoading(v){ try{ if(typeof window.toggleLoader === 'function') window.toggleLoader(!!v); }catch(e){} }
  function alertBox(t,m,err){ try{ (window.showCustomAlert || alert)(t,m,err); }catch(e){ alert(String(t||'')+'\n'+String(m||'')); } }

  function buildStatusPayload(status){
    const blocked = status === 'blocked' || status === 'deleted';
    const now = Date.now();
    return blocked
      ? { status:'blocked', blocked:true, blockedAt:now, deletedAt:null, updatedAt:now }
      : { status:'active', blocked:false, blockedAt:null, deletedAt:null, unblockedAt:now, updatedAt:now };
  }

  function getUserFromRenderedMap(uid, userKey){
    const map = window.__adminUsersByUid || {};
    return map[uid] || map[userKey] || {};
  }

  async function refreshAdminTables(){
    await Promise.allSettled([
      typeof window.loadAdminData === 'function' ? window.loadAdminData() : Promise.resolve(),
      typeof window.renderBlockedUsersList === 'function' ? window.renderBlockedUsersList() : Promise.resolve()
    ]);
  }

  window.executeUserStatusUpdate = async function(uid, userKey, status){
    showLoading(true);
    try{
      const payload = buildStatusPayload(status);
      const blocked = payload.blocked === true;
      const u = getUserFromRenderedMap(uid, userKey);
      const email = isEmail(userKey) ? norm(userKey) : (isEmail(u.email) ? norm(u.email) : (isEmail(uid) ? norm(uid) : ''));

      /* สำคัญ: หลังระบบรวมผู้ใช้ซ้ำแล้ว doc ที่แสดงจริงมักเป็น public_users_directory/{email}
         ดังนั้นต้องอัปเดตทั้ง uid เดิม และ email doc ไม่อย่างนั้นกดแล้วขึ้นสำเร็จแต่ตารางยังเหมือนเดิม */
      const publicTargets = Array.from(new Set([email, u.userKey, u.email, userKey, uid]
        .map(x => norm(x))
        .filter(x => isEmail(x))));
      const statusTargets = Array.from(new Set([email, userKey, uid]
        .map(x => norm(x))
        .filter(x => isEmail(x))));

      await Promise.allSettled(publicTargets.map(id => setDoc(doc(db, publicPath(), id), payload, {merge:true})));
      await Promise.allSettled(statusTargets.map(id => setDoc(doc(db, 'users_status', id), payload, {merge:true})));

      // อัปเดต cache หน้าเดิมทันที ลดอาการเหมือนสถานะไม่เปลี่ยนระหว่างรอ render
      publicTargets.forEach(id => {
        if(window.__adminUsersByUid && window.__adminUsersByUid[id]) Object.assign(window.__adminUsersByUid[id], payload);
      });

      await refreshAdminTables();
      alertBox(blocked ? 'บล็อกแล้ว' : 'ปลดบล็อกแล้ว', blocked ? 'บล็อกผู้ใช้แล้ว ข้อมูลยังอยู่ครบ' : 'ปลดบล็อกแล้ว ผู้ใช้กลับมาใช้งานได้');
    }catch(e){
      alertBox('เปลี่ยนสถานะไม่ได้', typeof window.getFirebaseErrorText === 'function' ? window.getFirebaseErrorText(e) : (e.message || String(e)), true);
    }finally{ showLoading(false); }
  };

  window.updateUserStatus = function(uid, userKey, status){
    const target = (status === 'blocked' || status === 'deleted') ? 'blocked' : 'active';
    if(target === 'blocked' && typeof window.showCustomConfirm === 'function'){
      window.showCustomConfirm('บล็อกผู้ใช้','บล็อกเฉพาะการใช้งาน ไม่ลบข้อมูล และผู้ใช้ที่ออนไลน์อยู่จะถูกเด้งออก ต้องการทำต่อหรือไม่?',()=>window.executeUserStatusUpdate(uid,userKey,target));
    }else{
      window.executeUserStatusUpdate(uid,userKey,target);
    }
  };

  function planPrice(p){
    try { return typeof window.planDisplayPrice === 'function' ? window.planDisplayPrice(p) : (p.price || (Number(p.monthlyPrice||0) ? Number(p.monthlyPrice||0)+' บาท/เดือน' : 'ฟรี')); }
    catch(e){ return p.price || 'ฟรี'; }
  }
  function planLimits(p){
    try { return typeof window.describePlanLimits === 'function' ? window.describePlanLimits(p) : `เพิ่มรายวิชาได้ ${Number(p.courseLimit||0)===0?'ไม่จำกัด':Number(p.courseLimit||0)+' วิชา'}`; }
    catch(e){ return `เพิ่มรายวิชาได้ ${Number(p.courseLimit||0)===0?'ไม่จำกัด':Number(p.courseLimit||0)+' วิชา'}`; }
  }
  function getPlans(){
    try { return (window.subscriptionPlans || []).length ? window.subscriptionPlans : (typeof window.getDefaultPlans === 'function' ? window.getDefaultPlans() : []); }
    catch(e){ return []; }
  }
  function renderPlanCard(p, opts={}){
    const active = !!opts.active;
    const pending = !!opts.pending;
    let btn;
    if(pending && !active){
      btn = `<button type="button" onclick="showCustomAlert('มีคำขออยู่แล้ว','คุณมีคำขอสมัครแผนที่รอตรวจสอบอยู่ ไม่สามารถส่งซ้ำได้',true)" class="w-full bg-amber-100 text-amber-700 rounded-2xl py-3 font-bold cursor-not-allowed"><i class="fas fa-hourglass-half mr-1"></i> มีคำขอรออนุมัติอยู่แล้ว</button>`;
    }else{
      const label = opts.landing ? 'สมัครแผนนี้' : (active ? 'ต่ออายุ/เปลี่ยนรอบ' : 'เลือกแผนนี้');
      const icon = active ? 'fa-rotate' : 'fa-paper-plane';
      btn = `<button type="button" onclick="requestSubscriptionPlan('${esc(p.id)}')" class="w-full ${active?'bg-emerald-100 text-emerald-700':'bg-primary text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'} rounded-2xl py-3 font-bold transition"><i class="fas ${icon} mr-1"></i> ${label}</button>`;
    }
    return `<div class="pricing-card ${p.featured?'featured':''} ${active?'ring-2 ring-emerald-400':''} rounded-[2rem] p-6 relative overflow-hidden bg-white">
      ${p.featured?'<div class="absolute top-4 right-4 bg-primary text-white text-xs font-black px-3 py-1 rounded-full">แนะนำ</div>':''}
      ${active?'<div class="absolute top-4 left-4 bg-emerald-500 text-white text-xs font-black px-3 py-1 rounded-full">ใช้อยู่</div>':''}
      <h3 class="text-2xl font-black text-slate-900 mb-1 mt-6">${esc(p.name||'')}</h3>
      <p class="text-sm text-slate-500 min-h-[42px]">${esc(p.desc||'')}</p>
      <div class="my-5"><span class="text-3xl font-black text-primary">${esc(planPrice(p))}</span></div>
      <div class="mb-4 text-xs font-bold text-slate-500 bg-slate-50 rounded-2xl p-3 leading-6"><i class="fas fa-sliders text-primary mr-1"></i>${esc(planLimits(p))}</div>
      <ul class="space-y-3 mb-6">${(p.features||[]).map(f=>`<li class="flex gap-2 text-sm text-slate-600"><i class="fas fa-check text-emerald-500 mt-1"></i><span>${esc(f)}</span></li>`).join('')}</ul>
      ${btn}
    </div>`;
  }

  window.renderLandingPlans = function(){
    const box = document.getElementById('landing-plan-list');
    if(!box) return;
    const items = getPlans().filter(p => p.active !== false).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
    box.innerHTML = items.map(p => renderPlanCard(p, {landing:true})).join('') || '<div class="col-span-full text-center text-slate-400 p-10">ยังไม่มีแผนให้แสดง</div>';
  };

  const oldUserPlans = window.renderUserPlans;
  window.renderUserPlans = function(){
    const box = document.getElementById('user-plan-list');
    if(!box) return oldUserPlans ? oldUserPlans.apply(this, arguments) : undefined;
    try{
      const dir = window.__currentUserDir || {};
      const currentPlanId = dir.planId || '';
      const hasPending = !!(window.__currentPendingPlanRequest || (Array.isArray(window.adminPlanRequests) && window.adminPlanRequests.some(r => r.status === 'pending')));
      const items = getPlans().filter(p => p.active !== false).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
      box.innerHTML = items.map(p => renderPlanCard(p, {active:p.id===currentPlanId && !!currentPlanId, pending:hasPending})).join('') || '<div class="col-span-full text-center text-slate-400 p-10">ยังไม่มีแผนให้เลือก</div>';
    }catch(e){
      if(oldUserPlans) return oldUserPlans.apply(this, arguments);
      console.warn('renderUserPlans final fallback failed:', e);
    }
  };

  setTimeout(()=>{ try{ window.renderLandingPlans(); }catch(e){} }, 200);
})();
