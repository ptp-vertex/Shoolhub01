
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function(){
  if(window.__schoolhubTeamPlanPatch) return;
  window.__schoolhubTeamPlanPatch = true;
  const firebaseConfig = {
  apiKey: "AIzaSyADAbTJEWivV1Nn-au7tXofStx4ADYTCM8",
  authDomain: "shoolhub-5677e.firebaseapp.com",
  projectId: "shoolhub-5677e",
  storageBucket: "shoolhub-5677e.firebasestorage.app",
  messagingSenderId: "630487358153",
  appId: "1:630487358153:web:1866add5d4a29b74abcb18",
  measurementId: "G-2Q6R46DC38"
};
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const COL = 'teams';
  const PUBLIC = 'public_users_directory';
  const TEAM_INVITE_KEEP_MS = 24 * 60 * 60 * 1000;

  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function cleanForFirestore(value){
    if(value === undefined) return undefined;
    if(value === null) return null;
    if(Array.isArray(value)) return value.map(v=>{
      const x=cleanForFirestore(v);
      return x === undefined ? null : x;
    });
    if(typeof value === 'object'){
      if(value && typeof value.toDate === 'function') return value;
      const out={};
      Object.keys(value||{}).forEach(k=>{
        const v=cleanForFirestore(value[k]);
        if(v !== undefined) out[k]=v;
      });
      return out;
    }
    return value;
  }
  function hasRealPlan(){
    const d=getDir();
    return !!(d.planId || d.teamStatus==='accepted' || d.teamOwnerUid || d.status==='active');
  }
  function show(title,msg,bad){(window.showCustomAlert||alert)(title,msg,bad);}
  function getUser(){return auth.currentUser || window.currentUser || null;}
  function getDir(){return window.__currentUserDir || {};}
  function getPlans(){return Array.isArray(window.subscriptionPlans)?window.subscriptionPlans:JSON.parse(localStorage.getItem('schoolhub_subscription_plans')||'[]');}
  function getPlan(){const d=getDir(); return getPlans().find(p=>p.id===d.planId)||{};}
  function teamLimit(){const d=getDir(),p=getPlan(); return Math.max(1,Number(d.teamLimit||d.teamMemberLimit||d.maxTeamMembers||p.teamLimit||p.teamMemberLimit||p.maxTeamMembers||1));}
  function allowTeam(){const d=getDir(),p=getPlan(),limit=teamLimit(); return !!(limit>1 && (d.teamStatus==='accepted' || d.teamOwnerUid || d.allowTeam === true || p.allowTeam === true));}
  function ownerUid(){const u=getUser(); const d=getDir(); return d.teamOwnerUid || d.ownerUid || u?.uid || d.uid || '';}
  function ownerDocRef(){const id=ownerUid(); return id?doc(db,COL,id):null;}
  function fmt(ts){try{const n=Number(ts?.toMillis?ts.toMillis():ts); if(!n) return '-'; return new Date(n).toLocaleString('th-TH');}catch(e){return '-';}}
  function teamLoadingText(text){return `<span class="schoolhub-team-spinner"></span><span>${esc(text||'กำลังโหลด...')}</span>`;}
  function setTeamActionLoading(id, text){
    const el=document.getElementById(id); if(!el) return function(){};
    const oldHtml=el.innerHTML, oldDisabled=el.disabled;
    el.disabled=true;
    el.innerHTML=teamLoadingText(text||'กำลังทำงาน...');
    return function(){ const btn=document.getElementById(id); if(btn){btn.disabled=oldDisabled; btn.innerHTML=oldHtml;} };
  }
  async function getTeamDoc(){const ref=ownerDocRef(); if(!ref) return {members:[]}; const snap=await getDoc(ref); return snap.exists()?snap.data():{members:[]};}
  async function saveTeamDoc(data){const ref=ownerDocRef(); if(!ref) throw new Error('ไม่พบผู้ใช้'); await setDoc(ref,cleanForFirestore(Object.assign({ownerUid:ownerUid(),ownerEmail:getUser()?.email||getDir().email||'',planId:getDir().planId||'',planName:getDir().planName||'',teamLimit:teamLimit(),updatedAt:Date.now()},data)),{merge:true});}
  function getInviteClosedAt(m){return Number(m?.cancelledAt||m?.deletedAt||m?.removedAt||m?.declinedAt||m?.updatedAt||0);}
  function isClosedInvite(m){return ['cancelled','declined','deleted','removed'].includes(String(m?.status||''));}
  function shouldHideClosedInvite(m){const at=getInviteClosedAt(m); return isClosedInvite(m) && at && (Date.now()-at>=TEAM_INVITE_KEEP_MS);}
  function visibleMembers(members){return (members||[]).filter(m=>!shouldHideClosedInvite(m));}
  function activeMembers(members){return (members||[]).filter(m=>!isClosedInvite(m));}
  async function cleanupExpiredClosedInvites(team){
    const members=Array.isArray(team?.members)?team.members:[];
    const kept=visibleMembers(members);
    if(kept.length!==members.length){
      try{await saveTeamDoc({members:kept}); team.members=kept;}catch(e){console.warn('ลบคำเชิญที่ครบ 24 ชม. ไม่สำเร็จ:',e);}
    }
    return team;
  }
  function statusText(s){return s==='accepted'?'ตอบรับแล้ว':(s==='declined'?'ปฏิเสธแล้ว':(['cancelled','deleted','removed'].includes(s)?'ยกเลิกแล้ว':'รอตอบรับ'));}
  function inviteStatusText(s){return s==='accepted'?'ตอบรับแล้ว':(s==='declined'?'ปฏิเสธแล้ว':(['cancelled','deleted','removed'].includes(s)?'ยกเลิกแล้ว':'รอตอบรับ'));}
  async function findMyPendingTeamInvites(){
    const u=getUser(); const myEmail=String(u?.email||getDir().email||'').trim().toLowerCase();
    if(!myEmail) return [];
    try{
      const snap=await getDocs(collection(db,COL));
      const found=[];
      snap.forEach(ds=>{
        const team=ds.data()||{};
        const members=Array.isArray(team.members)?team.members:[];
        members.forEach(m=>{
          if(String(m.email||'').trim().toLowerCase()===myEmail && (m.status||'pending')==='pending'){
            found.push({teamId:ds.id,team,member:m});
          }
        });
      });
      return found;
    }catch(e){console.warn('โหลดคำเชิญทีมไม่ได้:',e); return [];}
  }
  function ensureTeamInviteAlert(invites){
    const old=document.getElementById('schoolhub-team-invite-alert');
    if(!invites || !invites.length){ old?.remove(); return; }
    let host=document.getElementById('main-content') || document.querySelector('main') || document.body;
    let el=old;
    if(!el){ el=document.createElement('div'); el.id='schoolhub-team-invite-alert'; host.prepend(el); }
    el.innerHTML=`<div><i class="fas fa-envelope-open-text mr-2"></i>คุณมีคำเชิญเข้าร่วมแผนทีม ${invites.length} รายการ</div><button type="button" onclick="schoolhubOpenPlanInvites()">ดูคำเชิญ</button>`;
  }
  function renderIncomingInvites(invites){
    let box=document.getElementById('schoolhub-team-incoming-invites-box');
    if(!box){
      const currentBox=document.getElementById('user-current-plan-box');
      const host=currentBox || document.getElementById('user-plans') || document.getElementById('main-content');
      if(host){ box=document.createElement('div'); box.id='schoolhub-team-incoming-invites-box'; if(currentBox) currentBox.appendChild(box); else host.prepend(box); }
    }
    if(!box) return;
    if(!invites || !invites.length){ box.innerHTML=''; return; }
    box.innerHTML=`<div class="schoolhub-team-invites-panel">
      <div class="text-lg font-black text-orange-700 mb-1"><i class="fas fa-envelope-open-text mr-2"></i>คำเชิญเข้าร่วมแผนทีม</div>
      <div class="text-xs font-bold text-orange-600 mb-4">ตอบรับหรือปฏิเสธคำเชิญได้จากหน้านี้</div>
      <div class="space-y-2">${invites.map(x=>renderIncomingInviteCard(x)).join('')}</div>
    </div>`;
  }
  function renderIncomingInviteCard(x){
    const m=x.member||{}, team=x.team||{};
    const owner=team.ownerEmail||team.ownerUid||x.teamId||'-';
    return `<div class="schoolhub-team-invite-card">
      <div>
        <div class="font-black text-slate-900">${esc(team.planName||'แผนทีม SchoolHub')}</div>
        <div class="text-xs font-bold text-slate-500 mt-1">ผู้เชิญ: ${esc(owner)} • สิทธิ์: ${roleText(m.role)} • สถานะ: ${inviteStatusText(m.status)}</div>
      </div>
      <div class="team-actions flex flex-wrap gap-2 justify-end">
        <button type="button" id="team-accept-${esc(m.id)}" onclick="schoolhubAcceptIncomingTeamInvite('${esc(x.teamId)}','${esc(m.id)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 text-xs font-black">ตอบรับ</button>
        <button type="button" id="team-decline-${esc(m.id)}" onclick="schoolhubDeclineIncomingTeamInvite('${esc(x.teamId)}','${esc(m.id)}')" class="bg-rose-50 text-rose-600 border border-rose-100 rounded-xl px-4 py-2 text-xs font-black">ปฏิเสธ</button>
      </div>
    </div>`;
  }
  async function refreshIncomingInvites(){
    const invites=await findMyPendingTeamInvites();
    window.__schoolhubIncomingTeamInvites=invites;
    ensureTeamInviteAlert(invites);
    renderIncomingInvites(invites);
    return invites;
  }
  function roleText(r){return r==='co_owner'?'เจ้าของร่วม':'ผู้ใช้ร่วม';}
  function getMyTeamRole(team){
    const u=getUser();
    const d=getDir();
    if(!u) return 'member';
    if(ownerUid() && ownerUid()===u.uid) return 'owner';
    if(d.teamRole) return d.teamRole;
    const email=String(u.email||d.email||'').trim().toLowerCase();
    const members=Array.isArray(team?.members)?team.members:[];
    const me=members.find(m=>String(m.email||'').trim().toLowerCase()===email && (m.status||'pending')==='accepted');
    return me?.role || 'member';
  }
  function canManageTeam(team){
    const role=getMyTeamRole(team);
    return role==='owner' || role==='co_owner';
  }
  function makeInviteLink(inviteId, email){const url=new URL(location.href); url.searchParams.set('teamInvite',inviteId); url.searchParams.set('teamOwner',ownerUid()); url.searchParams.set('teamEmail',email); return url.toString();}
  function ensureTeamLimitText(){
    const line=document.getElementById('schoolhub-current-plan-team-limit-text');
    if(line) line.remove();
    return;
  }

  function closeTeamInvitePopup(){ document.getElementById('schoolhub-team-invite-popup')?.remove(); }
  window.schoolhubCloseTeamInvitePopup=closeTeamInvitePopup;
  window.schoolhubSubmitTeamInvitePopup=async function(){
    const email=document.getElementById('team-popup-email')?.value||'';
    const role=document.getElementById('team-popup-role')?.value||'member';
    const send=document.getElementById('team-popup-sendmail')?.checked;
    const mainEmail=document.getElementById('team-invite-email');
    const mainRole=document.getElementById('team-invite-role');
    const mainSend=document.getElementById('team-invite-sendmail');
    if(mainEmail) mainEmail.value=email;
    if(mainRole) mainRole.value=role;
    if(mainSend) mainSend.checked=!!send;
    await window.schoolhubInviteTeamMember?.();
  };
  function maybeOpenTeamInvitePopup(team, members, limit, canManage){
    // ไม่เปิดป็อปอัพเชิญเพื่อนอัตโนมัติแล้ว
    // ให้ใช้กล่องเชิญเพื่อนด้านล่างสถานะแผนอย่างเดียว
    closeTeamInvitePopup();
    return;
  }

  async function loadAndRenderTeamPanel(){
    const box=document.getElementById('schoolhub-team-plan-box');
    if(!box) return;
    if(!allowTeam()){box.innerHTML=''; return;}
    box.innerHTML=`<div class="schoolhub-team-panel"><div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4"><div><div class="text-lg font-black text-slate-900"><i class="fas fa-user-plus text-primary mr-2"></i>เชิญเพื่อนในแผนทีม</div><div class="text-xs font-bold text-slate-500 mt-1">กำลังตรวจสอบสมาชิกและคำเชิญ</div></div></div><div class="schoolhub-team-loading-line">${teamLoadingText('กำลังโหลดข้อมูลทีม...')}</div></div>`;
    try{
      let team=await getTeamDoc();
      team=await cleanupExpiredClosedInvites(team);
      const members=visibleMembers(Array.isArray(team.members)?team.members:[]);
      const limit=Math.max(2, Number(teamLimit()||team.teamLimit||2));
      const acceptedCount=1+members.filter(m=>String(m.status||'pending')==='accepted').length;
      const reservedCount=1+activeMembers(members).length;
      const used=acceptedCount;
      const pendingCount=Math.max(0, reservedCount-acceptedCount);
      const canManage=canManageTeam(team);
      const canInvite=canManage && reservedCount<limit;
      const myRole=getMyTeamRole(team);
      const payer=team.lastPayment||{};
      box.innerHTML=`<div class="schoolhub-team-panel">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
          <div><div class="text-lg font-black text-slate-900"><i class="fas fa-user-plus text-primary mr-2"></i>เชิญเพื่อนในแผนทีม</div>
          <div class="text-xs font-bold text-slate-500 mt-1">ใช้แล้ว ${used}/${limit} คน${pendingCount?' • รอตอบรับ '+pendingCount+' คน':''} • สิทธิ์ของคุณ: ${myRole==='owner'?'เจ้าของหลัก':roleText(myRole)} • เจ้าของ 1 คน + สมาชิกที่ตอบรับจะใช้แผนนี้ร่วมกัน</div></div>
          <div class="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-2">${esc(getDir().planName||getPlan().name||'แผนปัจจุบัน')}</div>
        </div>
        <div class="bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-4 text-xs font-bold text-slate-600">
          <i class="fas fa-receipt text-emerald-500 mr-1"></i> การชำระล่าสุด: ${payer.email?`${esc(payer.name||payer.email)} • ${fmt(payer.paidAt)}`:'ยังไม่มีข้อมูลการชำระล่าสุด'}
        </div>
        ${canManage?'':'<div class="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-4"><i class="fas fa-lock mr-1"></i> ผู้ใช้ร่วมสามารถดูสมาชิกทีมและใช้งานแผนได้เท่านั้น ไม่สามารถเชิญสมาชิกหรือเปลี่ยนสิทธิ์ได้</div>'}
        ${canManage?`<div class="team-form grid grid-cols-[1fr_160px_140px_auto] gap-2 mb-4">
          <input id="team-invite-email" type="email" placeholder="อีเมลเพื่อน" ${canInvite?'':'disabled'}>
          <select id="team-invite-role" ${canInvite?'':'disabled'}><option value="member">ผู้ใช้ร่วม</option><option value="co_owner">เจ้าของร่วม</option></select>
          <label class="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-2xl px-3"><input id="team-invite-sendmail" type="checkbox" checked> ส่งเมลเชิญ</label>
          <button type="button" id="team-invite-submit-btn" onclick="schoolhubInviteTeamMember()" ${canInvite?'':'disabled'} class="bg-primary hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black rounded-2xl px-4 py-3"><i class="fas fa-paper-plane mr-1"></i> เชิญ</button>
        </div>`:''}
        ${canManage && !canInvite?'<div class="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl p-3 mb-4">สมาชิกครบตามจำนวนแผนแล้ว หากต้องการเชิญเพิ่มให้ยกเลิกคำเชิญเดิมหรือเปลี่ยนแผน</div>':''}
        <div class="space-y-2" id="team-member-list">${members.length?members.map(m=>renderMemberRow(m,canManage)).join(''):'<div class="text-sm font-bold text-slate-400 text-center py-4">ยังไม่มีคำเชิญ</div>'}</div>
        <div class="text-[11px] text-slate-400 mt-3 leading-relaxed">หมายเหตุ: เจ้าของร่วมจะเห็นการแจ้งเตือนชำระเงินร่วมกับเจ้าของ ส่วนผู้ใช้ร่วมจะไม่เห็นการแจ้งเตือนชำระเงิน เมื่อมีการบันทึกว่าคนใดคนหนึ่งชำระแล้ว ระบบจะใช้ข้อมูลการชำระล่าสุดร่วมกันในกล่องนี้</div>
      </div>`;
      setTimeout(()=>maybeOpenTeamInvitePopup(team,members,limit,canManage),120);
    }catch(e){
      console.warn('โหลดข้อมูลทีมจาก Firestore ไม่สำเร็จ:', e);
      const limit=teamLimit();
      box.innerHTML=`<div class="schoolhub-team-panel">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
          <div><div class="text-lg font-black text-slate-900"><i class="fas fa-user-plus text-primary mr-2"></i>เชิญเพื่อนในแผนทีม</div>
          <div class="text-xs font-bold text-slate-500 mt-1">ใช้ร่วมกันได้สูงสุด ${limit} คน • ยังไม่มีสมาชิกที่เชิญ</div></div>
          <div class="text-xs font-black text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-2">รอสิทธิ์ Firestore</div>
        </div>
        <div class="text-sm font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl p-3">ยังโหลดข้อมูลทีมจาก Firebase ไม่ได้ แต่จะไม่กระทบส่วนอื่นของระบบ<br><span class="text-xs text-amber-600">ตรวจ Rules ให้มี match /teams/{teamId} แล้วกด Publish</span></div>
      </div>`;
    }
  }
  function renderMemberRow(m,canManage){
    const cancelled=isClosedInvite(m);
    return `<div class="schoolhub-team-member-row ${cancelled?'opacity-60':''}">
      <div><div class="font-black text-slate-800">${esc(m.email)}</div><div class="flex flex-wrap items-center gap-2 mt-1"><span class="schoolhub-team-status ${esc(m.status||'pending')}">${statusText(m.status)}</span><span class="text-xs font-bold text-slate-500">${roleText(m.role)}</span><span class="text-xs text-slate-400">เชิญเมื่อ ${fmt(m.invitedAt)}</span>${cancelled?`<span class="text-xs text-rose-400">จะซ่อนอัตโนมัติหลัง 24 ชม. (${fmt(getInviteClosedAt(m))})</span>`:''}</div></div>
      <div class="team-actions flex flex-wrap gap-2 justify-end">
        ${canManage && !isClosedInvite(m)?`<select id="team-role-${esc(m.id)}" onchange="schoolhubChangeTeamRole('${esc(m.id)}',this.value)" class="!py-2 !text-xs"><option value="member" ${m.role==='member'?'selected':''}>ผู้ใช้ร่วม</option><option value="co_owner" ${m.role==='co_owner'?'selected':''}>เจ้าของร่วม</option></select><button type="button" id="team-cancel-${esc(m.id)}" onclick="schoolhubCancelTeamInvite('${esc(m.id)}')" class="bg-rose-50 text-rose-600 border border-rose-100 rounded-xl px-3 py-2 text-xs font-black">ยกเลิก</button>`:''}
      </div>
    </div>`;
  }
  window.schoolhubOpenPlanInvites=async function(){
    // เปิดหน้าแผนโดยไม่สั่ง scroll/focus เพื่อไม่ให้หน้ากระโดดและไม่ให้ส่วนล่างซ้อนขึ้นมา
    const keepX = window.scrollX || 0;
    const keepY = window.scrollY || 0;
    if(window.openUserPlanSelector) await window.openUserPlanSelector();
    else if(window.switchView) window.switchView('user-plans');
    setTimeout(async ()=>{
      await refreshIncomingInvites();
      try{ window.scrollTo(keepX, keepY); }catch(e){}
    },250);
  };
  async function updateInviteStatus(teamId, inviteId, status){
    const u=getUser();
    const ref=doc(db,COL,teamId);
    const snap=await getDoc(ref);
    if(!snap.exists()) throw new Error('ไม่พบทีม');
    const team=snap.data()||{};
    const now=Date.now();
    const nextStatus = status === 'declined' ? 'cancelled' : status;
    const members=(Array.isArray(team.members)?team.members:[]).map(raw=>{
      const m=raw||{};
      if(String(m.id||'')!==String(inviteId||'')) return cleanForFirestore(m);
      const updated=Object.assign({},m,{
        status:nextStatus,
        updatedAt:now,
        uid:u?.uid||m.uid||'',
        displayName:u?.displayName||m.displayName||u?.email||'',
        email:String(u?.email||m.email||'').trim().toLowerCase()
      });
      if(nextStatus==='accepted'){ updated.acceptedAt=now; try{ const cd=getDir()||{}; updated.previousPlanSnapshot=cd.previousPlanSnapshot || {planId:cd.planId||null,planName:cd.planName||'',planPrice:cd.planPrice||'',courseLimit:cd.courseLimit??null,allowTeam:cd.allowTeam??false,teamMemberLimit:cd.teamMemberLimit??1,status:cd.status||null}; }catch(e){} }
      if(nextStatus==='cancelled') updated.cancelledAt=now;
      return cleanForFirestore(updated);
    });
    const me=members.find(m=>String(m?.id||'')===String(inviteId||'')) || {};
    await setDoc(ref,cleanForFirestore({members,updatedAt:now}),{merge:true});
    if(nextStatus==='accepted' && u?.uid){
      const currentDir=getDir()||{};
      const previousPlanSnapshot=currentDir.previousPlanSnapshot || {
        planId: currentDir.teamStatus==='accepted' ? null : (currentDir.planId||null),
        planName: currentDir.teamStatus==='accepted' ? '' : (currentDir.planName||''),
        planPrice: currentDir.teamStatus==='accepted' ? '' : (currentDir.planPrice||''),
        courseLimit: currentDir.teamStatus==='accepted' ? null : (currentDir.courseLimit ?? null),
        allowTeam: currentDir.teamStatus==='accepted' ? false : (currentDir.allowTeam ?? false),
        teamMemberLimit: currentDir.teamStatus==='accepted' ? 1 : (currentDir.teamMemberLimit ?? 1),
        status: currentDir.teamStatus==='accepted' ? null : (currentDir.status||null)
      };
      const payload=cleanForFirestore({
        email:String(u.email||me.email||'').trim().toLowerCase(),
        uid:u.uid,
        displayName:u.displayName||me.displayName||u.email||'',
        previousPlanSnapshot,
        teamOwnerUid:teamId,
        teamRole:me.role||'member',
        teamStatus:'accepted',
        planId:team.planId||null,
        planName:team.planName||'ทีม',
        teamMemberLimit: Math.max(2, Number(team.teamLimit||team.teamMemberLimit||2)),
        allowTeam:true,
        teamJoinedAt:now,
        updatedAt:now,
        status:'active',
        planLockedAt:null,
        planLockReason:null
      });
      await setDoc(doc(db,PUBLIC,u.uid),payload,{merge:true});
      try{
        window.__currentUserDir=Object.assign(window.__currentUserDir||{},payload);
        window.__schoolhubPlanLocked=false;
        window.__schoolhubPlanLockReason='';
      }catch(e){}
    } else if(nextStatus==='cancelled' && u?.uid){
      const current=getDir()||{};
      const payload={
        email:String(u.email||me.email||'').trim().toLowerCase(),
        uid:u.uid,
        displayName:u.displayName||current.displayName||u.email||'',
        declinedTeamInviteAt:now,
        declinedTeamInviteId:inviteId||'',
        updatedAt:now
      };
      if(current.teamOwnerUid===teamId || current.teamStatus==='pending'){
        Object.assign(payload,{teamOwnerUid:null,teamRole:null,teamStatus:null});
      }
      if(!current.planId){
        Object.assign(payload,{status:'plan_locked',planLockedAt:now,planLockReason:'ยังไม่ได้เลือกแผน'});
      }
      await setDoc(doc(db,PUBLIC,u.uid),cleanForFirestore(payload),{merge:true});
      try{ window.__currentUserDir=Object.assign(window.__currentUserDir||{},cleanForFirestore(payload)); }catch(e){}
    }
  }
  window.schoolhubAcceptIncomingTeamInvite=async function(teamId,inviteId){
    const restore=setTeamActionLoading('team-accept-'+inviteId,'กำลังตอบรับ...');
    try{await updateInviteStatus(teamId,inviteId,'accepted'); await refreshIncomingInvites(); show('ตอบรับแล้ว','เข้าร่วมแผนทีมเรียบร้อย'); if(window.openUserPlanSelector) await window.openUserPlanSelector();}
    catch(e){show('ตอบรับไม่ได้',e.message||String(e),true);}finally{restore();}
  };
  window.schoolhubDeclineIncomingTeamInvite=async function(teamId,inviteId){
    const restore=setTeamActionLoading('team-decline-'+inviteId,'กำลังปฏิเสธ...');
    try{await updateInviteStatus(teamId,inviteId,'declined'); await refreshIncomingInvites(); show('ยกเลิกคำเชิญแล้ว','ปฏิเสธคำเชิญเรียบร้อย ระบบจะให้ใช้แผนเดิมหรือเลือกแผนใหม่เมื่อเริ่มใช้งาน');}
    catch(e){show('ปฏิเสธไม่ได้',e.message||String(e),true);}finally{restore();}
  };
  window.schoolhubInviteTeamMember=async function(){
    const email=document.getElementById('team-invite-email')?.value.trim().toLowerCase();
    const role=document.getElementById('team-invite-role')?.value||'member';
    const sendMail=document.getElementById('team-invite-sendmail')?.checked;
    if(!email || !email.includes('@')) return show('อีเมลไม่ถูกต้อง','กรุณากรอกอีเมลเพื่อน',true);
    const restore=setTeamActionLoading('team-invite-submit-btn','กำลังส่ง...');
    try{
      let team=await getTeamDoc();
      team=await cleanupExpiredClosedInvites(team);
      if(!canManageTeam(team)) return show('ไม่มีสิทธิ์','ผู้ใช้ร่วมไม่สามารถเชิญสมาชิกหรือเปลี่ยนสิทธิ์ทีมได้',true);
      const members=Array.isArray(team.members)?team.members:[]; const limit=team.teamLimit||teamLimit();
      if(1+activeMembers(members).length>=limit) return show('สมาชิกเต็มแล้ว',`แผนนี้ใช้ได้สูงสุด ${limit} คน`,true);
      const exists=members.find(m=>m.email===email && !isClosedInvite(m)); if(exists) return show('เชิญซ้ำไม่ได้','อีเมลนี้มีอยู่ในรายการแล้ว',true);
      const id='inv_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
      const item={id,email,role,status:'pending',invitedAt:Date.now(),invitedBy:getUser()?.email||getDir().email||''};
      members.push(item); await saveTeamDoc({members});
      if(sendMail && window.sendMailViaWebApp){try{await window.sendMailViaWebApp({to:email,type:'team_invite',subject:`คำเชิญเข้าร่วมแผนทีม SchoolHub`,message:`คุณได้รับคำเชิญให้เข้าร่วมแผนทีม SchoolHub จาก ${getUser()?.email||getDir().email||''}\n\nสิทธิ์: ${roleText(role)}\nลิงก์ตอบรับ: ${makeInviteLink(id,email)}`,extra:{inviteId:id,ownerUid:ownerUid(),role}});}catch(e){console.warn(e); show('เชิญแล้ว แต่ส่งเมลไม่ได้','บันทึกคำเชิญแล้ว แต่ระบบส่งอีเมลไม่สำเร็จ',true);}}
      await loadAndRenderTeamPanel(); setTimeout(()=>show('เชิญแล้ว','บันทึกคำเชิญเรียบร้อย'),80);
    }catch(e){show('เชิญไม่ได้',e.message||String(e),true);}finally{restore();}
  };
  async function restoreMemberPreviousPlan(member){
    const now=Date.now();
    const uid=member?.uid||'';
    if(!uid) return;
    const snap=member.previousPlanSnapshot||{};
    const restorePayload={
      teamOwnerUid:null, teamRole:null, teamStatus:null, allowTeam:!!snap.allowTeam, teamMemberLimit:snap.teamMemberLimit||1,
      planId:snap.planId||null, planName:snap.planName||'', planPrice:snap.planPrice||'', courseLimit:snap.courseLimit??null,
      previousPlanSnapshot:null, updatedAt:now
    };
    if(snap.planId){ restorePayload.status=snap.status||'active'; restorePayload.planLockedAt=null; restorePayload.planLockReason=null; }
    else { restorePayload.status='plan_locked'; restorePayload.planLockedAt=now; restorePayload.planLockReason='ยังไม่ได้เลือกแผน'; }
    await setDoc(doc(db,PUBLIC,uid),cleanForFirestore(restorePayload),{merge:true});
  }
  window.schoolhubCancelTeamInvite=async function(id){
    const restore=setTeamActionLoading('team-cancel-'+id,'กำลังยกเลิก...');
    try{
      const team=await getTeamDoc();
      if(!canManageTeam(team)) return show('ไม่มีสิทธิ์','ผู้ใช้ร่วมไม่สามารถยกเลิกคำเชิญได้',true);
      const oldMember=(team.members||[]).find(m=>m.id===id)||{};
      const members=(team.members||[]).map(m=>m.id===id?Object.assign({},m,{status:'cancelled',cancelledAt:Date.now(),updatedAt:Date.now()}):m);
      await saveTeamDoc({members});
      if(String(oldMember.status||'pending')==='accepted') await restoreMemberPreviousPlan(oldMember);
      await loadAndRenderTeamPanel();
    }catch(e){show('ยกเลิกไม่ได้',e.message||String(e),true);}finally{restore();}
  };
  window.schoolhubChangeTeamRole=async function(id,role){
    const sel=document.getElementById('team-role-'+id); const oldDisabled=sel?.disabled; if(sel) sel.disabled=true;
    try{const team=await getTeamDoc(); if(!canManageTeam(team)) return show('ไม่มีสิทธิ์','ผู้ใช้ร่วมไม่สามารถเปลี่ยนสิทธิ์สมาชิกได้',true); const members=(team.members||[]).map(m=>m.id===id?Object.assign({},m,{role,updatedAt:Date.now()}):m); await saveTeamDoc({members}); await loadAndRenderTeamPanel();}catch(e){show('เปลี่ยนสิทธิ์ไม่ได้',e.message||String(e),true);}finally{if(sel) sel.disabled=oldDisabled;}
  };
  async function ensureTeamBox(){
    const currentBox=document.getElementById('user-current-plan-box');
    if(!currentBox) return;
    // แสดงคำเชิญได้ แต่ไม่แสดงข้อความจำกัดทีมเมื่อยังไม่มีแผน/แผนใช้คนเดียว
    ensureTeamLimitText();
    let inviteHolder=document.getElementById('schoolhub-team-incoming-invites-box');
    if(!inviteHolder){ inviteHolder=document.createElement('div'); inviteHolder.id='schoolhub-team-incoming-invites-box'; inviteHolder.style.marginTop='16px'; currentBox.appendChild(inviteHolder); }
    await refreshIncomingInvites();
    if(!allowTeam()){
      const oldTeamBox=document.getElementById('schoolhub-team-plan-box');
      if(oldTeamBox) oldTeamBox.remove();
      return;
    }
    if(document.getElementById('schoolhub-team-plan-box')) return;
    const holder=document.createElement('div'); holder.id='schoolhub-team-plan-box'; currentBox.appendChild(holder); await loadAndRenderTeamPanel();
  }
  window.schoolhubEnsureTeamBox = ensureTeamBox;
  window.loadAndRenderTeamPanel = loadAndRenderTeamPanel;

  function patchRender(){
    if(!window.renderUserPlans || window.__schoolhubTeamRenderWrapped) return;
    const old=window.renderUserPlans;
    window.renderUserPlans=function(){ const r=old.apply(this,arguments); setTimeout(ensureTeamBox,80); return r; };
    window.__schoolhubTeamRenderWrapped=true;
  }
  window.schoolhubMarkTeamPayment=async function(payer){
    try{const p=payer||{}; await saveTeamDoc({lastPayment:{email:p.email||getUser()?.email||'',name:p.name||getUser()?.displayName||'',paidAt:Date.now()}}); await loadAndRenderTeamPanel();}catch(e){console.warn(e);}
  };
  async function acceptInviteFromUrl(user){
    const url=new URL(location.href); const inviteId=url.searchParams.get('teamInvite'); const own=url.searchParams.get('teamOwner'); const email=(url.searchParams.get('teamEmail')||'').toLowerCase();
    if(!inviteId||!own||!user) return;
    if(email && user.email && email!==user.email.toLowerCase()) return show('อีเมลไม่ตรงคำเชิญ',`คำเชิญนี้ส่งถึง ${email} กรุณาเข้าสู่ระบบด้วยอีเมลนั้น`,true);
    try{
      const ref=doc(db,COL,own); const snap=await getDoc(ref); if(!snap.exists()) return;
      const team=snap.data(); const members=(team.members||[]).map(m=>m.id===inviteId?Object.assign({},m,{status:'accepted',acceptedAt:Date.now(),uid:user.uid,displayName:user.displayName||'',email:user.email||m.email}):m);
      const me=members.find(m=>m.id===inviteId);
      await setDoc(ref,cleanForFirestore({members,updatedAt:Date.now()}),{merge:true});
      const cd=getDir()||{};
      const previousPlanSnapshot=cd.previousPlanSnapshot || {planId:cd.planId||null,planName:cd.planName||'',planPrice:cd.planPrice||'',courseLimit:cd.courseLimit??null,allowTeam:cd.allowTeam??false,teamMemberLimit:cd.teamMemberLimit??1,status:cd.status||null};
      await setDoc(doc(db,PUBLIC,user.uid),cleanForFirestore({previousPlanSnapshot,teamOwnerUid:own,teamRole:me?.role||'member',teamStatus:'accepted',planId:team.planId ?? null,planName:team.planName || 'ทีม',teamMemberLimit:Math.max(2,Number(team.teamLimit||team.teamMemberLimit||2)),allowTeam:true,teamJoinedAt:Date.now(),updatedAt:Date.now(),status:'active'}),{merge:true});
      try{ window.__currentUserDir=Object.assign(window.__currentUserDir||{},{previousPlanSnapshot,teamOwnerUid:own,teamRole:me?.role||'member',teamStatus:'accepted',planId:team.planId ?? null,planName:team.planName || 'ทีม',teamMemberLimit:Math.max(2,Number(team.teamLimit||team.teamMemberLimit||2)),allowTeam:true,status:'active'}); window.__schoolhubPlanLocked=false; }catch(e){}
      show('ตอบรับแล้ว','เข้าร่วมแผนทีมเรียบร้อย');
      url.searchParams.delete('teamInvite'); url.searchParams.delete('teamOwner'); url.searchParams.delete('teamEmail'); history.replaceState({},'',url.toString());
    }catch(e){show('ตอบรับไม่ได้',e.message||String(e),true);}
  }
  onAuthStateChanged(auth,(u)=>{ if(u){ setTimeout(()=>{patchRender(); refreshIncomingInvites(); ensureTeamBox(); const p=new URLSearchParams(location.search); if(p.get('teamInvite')||p.get('teamOwner')||p.get('teamEmail')){ if(window.openUserPlanSelector) window.openUserPlanSelector(); else if(window.switchView) window.switchView('user-plans'); }},600); } });
  const timer=setInterval(()=>{patchRender(); if(document.getElementById('user-current-plan-box')) ensureTeamBox();},800);
  setTimeout(()=>clearInterval(timer),12000);
  setInterval(()=>{ if(getUser()) refreshIncomingInvites(); },30000);
})();
