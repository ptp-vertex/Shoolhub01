
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function(){
  if(window.__schoolhubPlanSelectorStableCanonical) return;
  window.__schoolhubPlanSelectorStableCanonical = true;

  const firebaseConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
  };
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const PLANS_KEYS = ['schoolhub_subscription_plans_cache','schoolhub_subscription_plans','schoolhub_public_plans'];
  const USER_DIR_PREFIX = 'schoolhub_current_user_dir_cache_';
  let lastCurrentPlanBoxSignature = '';
  let lastCurrentPlanBoxHtml = '';
  let lastPlanListSignature = '';
  let lastPlanListHtml = '';

  function esc(v){
    try{ return (window.escapeHTML ? window.escapeHTML(v) : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))); }
    catch(e){ return String(v ?? ''); }
  }
  function user(){
    try{
      const saved = JSON.parse(localStorage.getItem('schoolhub_web_session_v1') || '{}');
      return auth.currentUser || window.currentUser || (saved.email ? saved : null) || null;
    }catch(e){ return auth.currentUser || window.currentUser || null; }
  }
  function userEmail(){ return String((user() && user().email) || window.currentUserEmail || '').trim().toLowerCase(); }
  function cacheUserDir(d){
    const email = userEmail();
    if(!email || !d) return;
    try{ localStorage.setItem(USER_DIR_PREFIX + email, JSON.stringify(Object.assign({}, d, {__cachedAt: Date.now()}))); }catch(e){}
  }
  function getDir(){
    if(window.__currentUserDir && Object.keys(window.__currentUserDir).length) return window.__currentUserDir;
    const email = userEmail();
    if(email){
      try{
        const d = JSON.parse(localStorage.getItem(USER_DIR_PREFIX + email) || '{}');
        if(d && Object.keys(d).length){ window.__currentUserDir = d; return d; }
      }catch(e){}
    }
    return window.__currentUserDir || {};
  }
  function setDir(d){ window.__currentUserDir = d || {}; cacheUserDir(window.__currentUserDir); }
  function getPlans(){
    if(Array.isArray(window.subscriptionPlans) && window.subscriptionPlans.length) return window.subscriptionPlans;
    for(const key of PLANS_KEYS){
      try{
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if(Array.isArray(arr) && arr.length){ window.subscriptionPlans = arr; return arr; }
      }catch(e){}
    }
    if(typeof window.getDefaultPlans === 'function'){
      try{ const arr = window.getDefaultPlans(); if(Array.isArray(arr)){ window.subscriptionPlans = arr; return arr; } }catch(e){}
    }
    return [];
  }
  function savePlans(plans){
    if(!Array.isArray(plans)) return;
    window.subscriptionPlans = plans;
    PLANS_KEYS.forEach(key => { try{ localStorage.setItem(key, JSON.stringify(plans)); }catch(e){} });
  }
  function findPlan(id){ return getPlans().find(p => String(p && p.id || '') === String(id || '')) || null; }
  function planPrice(p, d){
    if(d && d.planPrice) return d.planPrice;
    if(!p) return '';
    if(typeof window.planDisplayPrice === 'function') return window.planDisplayPrice(p);
    return p.price || (p.monthlyPrice ? Number(p.monthlyPrice).toLocaleString('th-TH') + ' บาท/เดือน' : '');
  }
  function fmtDate(v){
    if(!v) return 'ไม่มี';
    try{
      const n = typeof v.toMillis === 'function' ? v.toMillis() : Number(v);
      if(!n) return 'ไม่มี';
      return new Date(n).toLocaleString('th-TH');
    }catch(e){ return 'ไม่มี'; }
  }
  function stableSig(parts){ return parts.map(v => String(v ?? '')).join('|'); }
  function setCurrentPlanBoxStable(html, signature){
    const box = document.getElementById('user-current-plan-box');
    if(!box) return;
    if(lastCurrentPlanBoxSignature === signature && lastCurrentPlanBoxHtml === html) return;
    box.innerHTML = html;
    lastCurrentPlanBoxSignature = signature;
    lastCurrentPlanBoxHtml = html;
  }
  function renderNoPlanBox(){
    return window.renderCurrentPlanCardHTML
      ? window.renderCurrentPlanCardHTML({ id:'none', name:'ไม่มีแผน', price:0, monthlyPrice:0, courseLimit:'-' }, {})
      : '<div>แผนปัจจุบัน</div>';
  }
  function renderPendingBox(d){
    d = d || {};
    return window.renderCurrentPlanCardHTML
      ? window.renderCurrentPlanCardHTML({ id:d.requestedPlanId || d.planId || 'pending', name:d.requestedPlanName || d.planName || 'รออนุมัติแผน', price:'คำขออยู่ระหว่างรอตรวจสอบ', courseLimit:d.courseLimit }, d)
      : '<div>แผนปัจจุบัน</div>';
  }
  function isTeam(d){ return !!(d && (d.effectivePlanSource === 'team' || d.teamStatus === 'accepted' || d.teamOwnerUid || d.teamPlanId)); }
  function teamLimit(d, p){
    const raw = d.teamLimit || d.teamMemberLimit || d.maxTeamMembers || (p && (p.teamLimit || p.teamMemberLimit || p.maxTeamMembers));
    const n = Number(raw || 1);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  function currentPlanHtml(d, p){
    d = d || {};
    let planForCard = p || null;
    if(!planForCard){
      if(d.requestedPlanName || d.requestedPlanId || d.status === 'pending_plan'){
        planForCard = { id: d.requestedPlanId || d.planId || 'pending', name: d.requestedPlanName || d.planName || 'รออนุมัติแผน', price: 'คำขออยู่ระหว่างรอตรวจสอบ', courseLimit: d.courseLimit };
      }else if(d.teamPlanName || d.planName || d.planId || d.teamPlanId){
        planForCard = { id: d.teamPlanId || d.planId || '', name: d.teamPlanName || d.planName || d.planId || 'แผนปัจจุบัน', price: d.planPrice || '', monthlyPrice: d.monthlyPrice || 0, freeFirstMonth: d.freeFirstMonth, courseLimit: d.courseLimit };
      }else{
        planForCard = { id: 'none', name: 'ไม่มีแผน', price: 0, monthlyPrice: 0, courseLimit: d.courseLimit || '-' };
      }
    }
    return window.renderCurrentPlanCardHTML
      ? window.renderCurrentPlanCardHTML(planForCard, d)
      : '<div class="schoolhub-current-plan-card"><div><div class="schoolhub-current-plan-label">แผนปัจจุบัน</div><div class="schoolhub-current-plan-name">'+esc(planForCard.name || 'ไม่มีแผน')+'</div></div></div>';
  }
  function renderCurrentPlanFromCacheOrFallback(){
    const d = getDir();
    const pid = isTeam(d) ? (d.teamPlanId || d.planId) : d.planId;
    const p = findPlan(pid);
    const html = currentPlanHtml(d, p);
    const sig = stableSig([pid, d.planName, d.teamPlanName, d.status, d.requestedPlanId, d.requestedPlanName, d.planNextBillingAt, d.planExpiresAt, p && p.updatedAt, teamLimit(d, p), isTeam(d)]);
    setCurrentPlanBoxStable(html, sig);
    cleanupTeamBoxAfterCurrentRender(d, p);
  }
  function cleanupTeamBoxAfterCurrentRender(d, p){
    const allowTeam = isTeam(d) || (p && p.allowTeam === true && teamLimit(d, p) > 1);
    const box = document.getElementById('schoolhub-team-plan-box');
    if(box && !allowTeam){ box.remove(); }
    const line = document.getElementById('schoolhub-current-plan-team-limit-text');
    if(line && (!d.planId || teamLimit(d, p) <= 1)) line.remove();
    if(allowTeam && typeof window.schoolhubEnsureTeamBox === 'function'){
      setTimeout(() => { try{ window.schoolhubEnsureTeamBox(); }catch(e){} }, 80);
    }
  }
  function renderPlansFromCacheOrFallback(){
    const box = document.getElementById('user-plan-list');
    if(!box) return;
    const items = getPlans().filter(p => p && p.active !== false).sort((a,b) => Number(a.order || 0) - Number(b.order || 0));
    const d = getDir();
    const currentPlanId = d.planId || '';
    const pendingPlanName = d.requestedPlanName || '';
    let html = '';
    if(!items.length){
      html = '<div class="col-span-full bg-white border border-slate-100 rounded-3xl p-6 text-center text-slate-500"><i class="fas fa-layer-group text-primary mr-2"></i>ยังไม่มีรายการแผนในเครื่อง</div>';
    }else{
      html = items.map(p => {
        const active = p.id === currentPlanId && !!currentPlanId;
        let btn = '';
        if(pendingPlanName && !active){
          btn = `<button type="button" onclick="showCustomAlert('มีคำขออยู่แล้ว','คุณมีคำขอสมัครแผน &quot;${esc(pendingPlanName)}&quot; ที่รอตรวจสอบอยู่ กรุณารอให้แอดมินดำเนินการก่อน',true)" class="w-full bg-amber-100 text-amber-700 rounded-2xl py-3 font-bold cursor-not-allowed"><i class="fas fa-hourglass-half mr-1"></i> มีคำขอรออนุมัติอยู่แล้ว</button>`;
        }else if(active){
          btn = `<button type="button" onclick="requestSubscriptionPlan('${esc(p.id)}')" class="w-full bg-emerald-100 text-emerald-700 rounded-2xl py-3 font-bold transition"><i class="fas fa-paper-plane mr-1"></i> ขอต่ออายุ</button>`;
        }else{
          btn = `<button type="button" onclick="requestSubscriptionPlan('${esc(p.id)}')" class="w-full bg-primary text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 rounded-2xl py-3 font-bold transition"><i class="fas fa-paper-plane mr-1"></i> เลือกแผนนี้</button>`;
        }
        const features = Array.isArray(p.features) ? p.features : [];
        return `<div class="pricing-card ${p.featured ? 'featured' : ''} ${active ? 'ring-2 ring-emerald-400' : ''} rounded-[2rem] p-6 relative overflow-hidden bg-white">
          ${p.featured ? '<div class="absolute top-4 right-4 bg-primary text-white text-xs font-black px-3 py-1 rounded-full">แนะนำ</div>' : ''}
          ${active ? '<div class="absolute top-4 left-4 bg-emerald-500 text-white text-xs font-black px-3 py-1 rounded-full">ใช้อยู่</div>' : ''}
          <h3 class="text-2xl font-black text-slate-900 mb-1 mt-2">${esc(p.name || '')}</h3>
          <p class="text-sm text-slate-500 min-h-[42px]">${esc(p.desc || '')}</p>
          <div class="my-5"><span class="text-3xl font-black text-primary">${esc(planPrice(p, {}))}</span></div>
          <div class="mb-4 text-xs font-bold text-slate-500 bg-slate-50 rounded-2xl p-3"><i class="fas fa-book mr-1 text-primary"></i> เพิ่มรายวิชาได้ ${Number(p.courseLimit || 0) === 0 ? 'ไม่จำกัด' : Number(p.courseLimit || 0) + ' วิชา'}<br><i class="fas fa-calendar-check mr-1 text-primary"></i> ${p.freeForever || p.billingCycle === 'forever' ? 'ไม่มีวันหมดอายุ' : 'มีรอบเรียกเก็บ/ต่ออายุ'}</div>
          <ul class="space-y-3 mb-6">${features.map(f => `<li class="flex gap-2 text-sm text-slate-600"><i class="fas fa-check text-emerald-500 mt-1"></i><span>${esc(f)}</span></li>`).join('')}</ul>
          ${btn}
        </div>`;
      }).join('');
    }
    const sig = stableSig([items.length, items.map(p => [p.id,p.updatedAt,p.active,p.featured,p.price,p.monthlyPrice,p.yearlyPrice].join(':')).join(','), currentPlanId, pendingPlanName]);
    if(sig === lastPlanListSignature && html === lastPlanListHtml) return;
    box.innerHTML = html;
    lastPlanListSignature = sig;
    lastPlanListHtml = html;
  }
  function runMax(promise, ms){
    return Promise.race([Promise.resolve(promise), new Promise((resolve) => setTimeout(() => resolve('__timeout__'), ms || 5000))]);
  }
  async function loadLatestPlanDataInBackground(){
    const tasks = [];
    tasks.push((async() => {
      try{
        const snap = await runMax(getDoc(doc(db, 'system_settings', 'subscription_plans')), 6000);
        if(snap && snap !== '__timeout__' && snap.exists && snap.exists()){
          const data = snap.data() || {};
          if(Array.isArray(data.items) && data.items.length) savePlans(data.items);
        }
      }catch(e){ console.warn('load latest plans skipped:', e); }
    })());
    tasks.push((async() => {
      const email = userEmail();
      if(!email) return;
      try{
        const snap = await runMax(getDoc(doc(db, 'public_users_directory', email)), 6000);
        if(snap && snap !== '__timeout__' && snap.exists && snap.exists()) setDir(snap.data() || {});
      }catch(e){ console.warn('load latest current plan skipped:', e); }
    })());
    await Promise.allSettled(tasks);
  }
  function setPlanPageShell(){
    try{ if(window.isAdmin) { if(typeof window.switchView === 'function') window.switchView('admin-plans'); return false; } }catch(e){}
    try{ window.currentActiveCourseId = null; }catch(e){}
    try{ document.getElementById('course-context-menu')?.classList.add('hidden'); }catch(e){}
    const title = document.getElementById('page-title'); if(title) title.textContent = 'เลือก / เปลี่ยนแผน';
    const sub = document.getElementById('page-subtitle'); if(sub) sub.textContent = 'เลือกแผนที่ต้องการ แล้วกรอกข้อมูลการชำระเงิน';
    const acts = document.getElementById('header-actions'); if(acts) acts.innerHTML = '';
    try{ if(typeof window.switchView === 'function') window.switchView('user-plans'); }catch(e){}
    return true;
  }
  window.renderCurrentPlanFromCacheOrFallback = renderCurrentPlanFromCacheOrFallback;
  window.renderPlansFromCacheOrFallback = renderPlansFromCacheOrFallback;
  window.loadLatestPlanDataInBackground = loadLatestPlanDataInBackground;
  window.renderUserPlans = function(){
    renderCurrentPlanFromCacheOrFallback();
    renderPlansFromCacheOrFallback();
  };
  window.openUserPlanSelector = function(){
    if(!setPlanPageShell()) return false;
    renderCurrentPlanFromCacheOrFallback();
    renderPlansFromCacheOrFallback();
    loadLatestPlanDataInBackground()
      .then(() => { renderCurrentPlanFromCacheOrFallback(); renderPlansFromCacheOrFallback(); })
      .catch(() => { renderCurrentPlanFromCacheOrFallback(); renderPlansFromCacheOrFallback(); });
    setTimeout(() => {
      const box = document.getElementById('user-current-plan-box');
      if(box && /กำลังตรวจสอบสถานะแผนปัจจุบัน/.test(box.textContent || '')) renderCurrentPlanFromCacheOrFallback();
      if(box && !(box.textContent || '').trim()) renderCurrentPlanFromCacheOrFallback();
    }, 1000);
    try{ if(typeof window.loadUserPaymentHistory === 'function') setTimeout(() => window.loadUserPaymentHistory(false), 150); }catch(e){}
    return false;
  };
  document.addEventListener('DOMContentLoaded', function(){
    renderCurrentPlanFromCacheOrFallback();
    renderPlansFromCacheOrFallback();
  });
})();
