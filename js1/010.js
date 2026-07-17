
/* Patch: เมนูผู้ใช้ที่ถูกบล็อก + ไม่ลบข้อมูล + team limit + รองรับ status=deleted เดิม */
(function(){
  function esc(v){ try{return escapeHTML(v||'');}catch(e){return String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));} }
  function isBlockedUser(u){
    const st = String((u && u.status) || '').toLowerCase();
    return st === 'blocked' || st === 'deleted' || (u && u.blocked === true);
  }
  function userKeyOf(u, fallback){ return String((u && (u.userKey || u.email || u.uid)) || fallback || '').trim(); }

  // แก้คำสั่งบล็อก: ห้ามลบเอกสารผู้ใช้เด็ดขาด ให้เปลี่ยนสถานะอย่างเดียว
  window.executeUserStatusUpdate = async function(uid, userKey, status){
    try{
      if(typeof toggleLoader === 'function') toggleLoader(true);
      const makeBlocked = status === 'blocked' || status === 'deleted';
      const now = Date.now();
      const payload = makeBlocked
        ? { status:'blocked', blocked:true, blockedAt:now, deletedAt:null, updatedAt:now }
        : { status:'active', blocked:false, blockedAt:null, deletedAt:null, unblockedAt:now, updatedAt:now };

      // สำคัญ: ไม่ใช้ deleteDoc ในการบล็อกอีกต่อไป ข้อมูลรายวิชา/นักเรียน/คะแนนไม่หาย
      const emailKey = isSchoolHubValidEmail(userKey) ? normalizeSchoolHubEmail(userKey) : (isSchoolHubValidEmail(uid) ? normalizeSchoolHubEmail(uid) : '');
      if(emailKey) {
        await setDoc(doc(db, getPublicPath(), emailKey), payload, { merge:true });
        await setDoc(doc(db, 'users_status', emailKey), payload, { merge:true });
      }

      await Promise.allSettled([
        typeof loadAdminData === 'function' ? loadAdminData() : Promise.resolve(),
        typeof renderBlockedUsersList === 'function' ? renderBlockedUsersList() : Promise.resolve()
      ]);
      showCustomAlert(
        makeBlocked ? 'บล็อกแล้ว' : 'ปลดบล็อกแล้ว',
        makeBlocked ? 'ผู้ใช้นี้ยังอยู่ในระบบ ข้อมูลไม่ถูกลบ และถ้ากำลังใช้งานจะถูกเด้งออก' : 'ผู้ใช้นี้กลับมาใช้งานได้แล้ว'
      );
    }catch(e){
      showCustomAlert('เปลี่ยนสถานะไม่ได้', (typeof getFirebaseErrorText==='function'?getFirebaseErrorText(e):(e.message||String(e))), true);
    }finally{
      if(typeof toggleLoader === 'function') toggleLoader(false);
    }
  };

  window.updateUserStatus = function(uid,userKey,status){
    const target = (status === 'blocked' || status === 'deleted') ? 'blocked' : 'active';
    if(target === 'blocked') {
      showCustomConfirm('บล็อกผู้ใช้','บล็อกเฉพาะการใช้งาน ไม่ลบข้อมูลใด ๆ และผู้ใช้ที่ออนไลน์อยู่จะถูกเด้งออกทันทีเมื่อตรวจพบ ต้องการทำต่อหรือไม่?',()=>executeUserStatusUpdate(uid,userKey,target));
    } else {
      executeUserStatusUpdate(uid,userKey,target);
    }
  };

  // โหลดรายชื่อผู้ใช้ถูกบล็อก: รองรับทั้ง status=blocked และ status=deleted เดิม
  window.renderBlockedUsersList = async function(){
    const box=document.getElementById('blocked-users-card-list');
    if(!box) return;
    box.innerHTML='<div class="col-span-full text-center p-10 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลดรายชื่อผู้ใช้ที่ถูกบล็อก...</div>';

    const map=new Map();
    const errors=[];
    try{
      const pub=await getDocs(collection(db,getPublicPath()));
      pub.forEach(d=>{
        const u=d.data()||{};
        const uid=u.uid||d.id;
        const key=userKeyOf(u, uid);
        if(isBlockedUser(u)) map.set(key || uid,{...u,uid,key,source:'public'});
      });
    }catch(e){ errors.push('public_users_directory: '+(e.message||String(e))); }

    // อ่าน users_status ด้วย เพื่อดึงคนที่เคยถูกบล็อกแบบเก่า status="deleted" แม้ข้อมูล public ถูกลบไปแล้ว
    try{
      const st=await getDocs(collection(db,'users_status'));
      st.forEach(d=>{
        const sd=d.data()||{};
        if(!isBlockedUser(sd)) return;
        const key=d.id;
        if(!map.has(key)) {
          map.set(key,{uid:'status_'+key,userKey:key,email:key,name:sd.name||key,status:sd.status||'blocked',blocked:sd.blocked!==false,blockedAt:sd.blockedAt||sd.deletedAt||null,key,source:'status_only'});
        } else {
          map.set(key,{...map.get(key),...sd,status:sd.status||map.get(key).status,blocked:true});
        }
      });
    }catch(e){ errors.push('users_status: '+(e.message||String(e))); }

    const items=[...map.values()].filter(u=>u.role!=='admin' && isBlockedUser(u));
    const badge=document.getElementById('blocked-users-badge');
    if(badge){ badge.textContent=items.length; badge.classList.toggle('hidden',items.length===0); }

    if(!items.length){
      box.innerHTML='<div class="col-span-full text-center p-12 text-slate-400"><i class="fas fa-user-check text-4xl mb-3 block"></i>ยังไม่มีผู้ใช้ที่ถูกบล็อก</div>' + (errors.length?`<div class="col-span-full text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-2xl p-3">หมายเหตุ: อ่านบางแหล่งข้อมูลไม่ได้ ${esc(errors.join(' | '))}</div>`:'');
      return;
    }

    box.innerHTML=items.map(u=>{
      const key=userKeyOf(u,u.key);
      const uid=u.uid||'';
      const plan=u.planName||u.requestedPlanName||'ยังไม่กำหนดแผน';
      const when=(u.blockedAt||u.deletedAt)?new Date(u.blockedAt||u.deletedAt).toLocaleString('th-TH'):'';
      const wasDeleted=String(u.status||'')==='deleted';
      return `<div class="rounded-3xl border border-rose-100 bg-rose-50/40 p-5 shadow-sm">
        <div class="flex items-start gap-3">
          <div class="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0"><i class="fas fa-user-lock"></i></div>
          <div class="min-w-0 flex-1">
            <div class="font-black text-slate-800 truncate">${esc(u.name||'ไม่มีชื่อ')}</div>
            <div class="text-xs text-slate-500 font-mono break-all">${esc(key)}</div>
            <div class="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
              <span class="px-2 py-1 rounded-full bg-rose-100 text-rose-700">ถูกบล็อก</span>
              ${wasDeleted?'<span class="px-2 py-1 rounded-full bg-amber-100 text-amber-700">สถานะเก่า: deleted</span>':''}
              <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-600">${esc(plan)}</span>
            </div>
            ${when?`<div class="text-[11px] text-slate-400 mt-2">บล็อกเมื่อ ${esc(when)}</div>`:''}
            ${u.source==='status_only'?'<div class="text-[11px] text-amber-600 mt-2">พบจาก users_status: ข้อมูลหลักอาจเคยถูกลบก่อนหน้า แต่สถานะยังปลดบล็อกได้</div>':'<div class="text-[11px] text-emerald-600 mt-2">ข้อมูลผู้ใช้ยังคงอยู่ ไม่ได้ลบ</div>'}
          </div>
        </div>
        <button onclick="updateUserStatus('${esc(uid).replace(/'/g,'\&#39;')}', '${esc(key).replace(/'/g,'\&#39;')}', 'active')" class="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3 font-black"><i class="fas fa-unlock mr-1"></i> ปลดบล็อก</button>
      </div>`;
    }).join('') + (errors.length?`<div class="col-span-full text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-2xl p-3">หมายเหตุ: อ่านบางแหล่งข้อมูลไม่ได้ ${esc(errors.join(' | '))}</div>`:'');
  };

  // ให้ตารางผู้ใช้หลักแสดง deleted เป็นบล็อก ไม่ซ่อน และปุ่มเป็นปลดบล็อก
  const oldLoad=window.loadAdminData;
  if(typeof oldLoad==='function'){
    window.loadAdminData=async function(){
      await oldLoad.apply(this,arguments);
      setTimeout(()=>{
        try{
          // ถ้าฟังก์ชันเดิมแสดง deleted หาย ให้โหลดเมนูบล็อกซ้ำให้เห็นแน่นอน
          if(typeof renderBlockedUsersList==='function') renderBlockedUsersList();
        }catch(e){}
      },80);
    };
  }

  // เด้งผู้ใช้ที่ถูกบล็อกออกทันที โดยไม่ลบข้อมูล
  async function forceLogoutIfBlocked(){
    try{
      if(!auth?.currentUser || currentUser?.uid==='admin-bypass') return;
      const key=auth.currentUser.email || (typeof getUserKey==='function'?getUserKey(auth.currentUser):auth.currentUser.uid);
      const uid=auth.currentUser.uid;
      const checks=[];
      if(key) checks.push(getDoc(doc(db,'users_status',key)));
      if(uid) checks.push(getDoc(doc(db,getPublicPath(),uid)));
      const rs=await Promise.allSettled(checks);
      const blocked=rs.some(r=>r.status==='fulfilled' && r.value.exists && r.value.exists() && isBlockedUser(r.value.data()));
      if(blocked){
        await signOut(auth);
        currentUser=null; isAdmin=false; localStorage.removeItem('schoolhub_admin_bypass');
        document.getElementById('main-app')?.classList.add('hidden'); document.getElementById('auth-view')?.classList.remove('hidden');
        showCustomAlert('บัญชีถูกบล็อก','บัญชีนี้ถูกบล็อกโดยผู้ดูแลระบบ จึงถูกออกจากระบบทันที',true);
      }
    }catch(e){}
  }
  setInterval(forceLogoutIfBlocked,5000);

  // แสดงจำนวนสมาชิกทีมในแผน
  const oldSumm=window.planFeatureSummary;
  window.planFeatureSummary=function(p){
    const base=typeof oldSumm==='function'?oldSumm(p):'';
    const limit=Math.max(1,Number(p?.teamMemberLimit||p?.maxTeamMembers||1));
    const team=p?.allowTeam?`ใช้แบบทีมได้ ${limit} คน`:'ใช้คนเดียว';
    return base && base.includes('ทีม') ? base : [base,team].filter(Boolean).join(' • ');
  };
})();
