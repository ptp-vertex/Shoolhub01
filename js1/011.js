
/* Final patch: blocked status must never be saved as deleted + global Admin config + slip continue UX */
(function(){
  function shEsc(v){ try{return escapeHTML(v||'');}catch(e){return String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));} }

  // ป้องกันทุกจุดที่เรียกบล็อกด้วย deleted: บังคับให้เป็น blocked เท่านั้น และไม่ deleteDoc
  window.executeUserStatusUpdate = async function(uid, userKey, status){
    try{
      if(typeof toggleLoader==='function') toggleLoader(true);
      const makeBlocked = status === 'blocked' || status === 'deleted';
      const now = Date.now();
      const payload = makeBlocked
        ? { status:'blocked', blocked:true, blockedAt:now, deletedAt:null, updatedAt:now }
        : { status:'active', blocked:false, blockedAt:null, deletedAt:null, unblockedAt:now, updatedAt:now };
      const emailKey = isSchoolHubValidEmail(userKey) ? normalizeSchoolHubEmail(userKey) : (isSchoolHubValidEmail(uid) ? normalizeSchoolHubEmail(uid) : '');
      if(emailKey){
        await setDoc(doc(db, getPublicPath(), emailKey), payload, {merge:true});
        await setDoc(doc(db, 'users_status', emailKey), payload, {merge:true});
      }
      await Promise.allSettled([
        typeof loadAdminData==='function' ? loadAdminData() : Promise.resolve(),
        typeof renderBlockedUsersList==='function' ? renderBlockedUsersList() : Promise.resolve()
      ]);
      showCustomAlert(makeBlocked?'บล็อกแล้ว':'ปลดบล็อกแล้ว', makeBlocked?'บล็อกเฉพาะการใช้งานแล้ว ข้อมูลไม่ถูกลบ และผู้ใช้ที่กำลังใช้งานจะถูกเด้งออก':'ปลดบล็อกแล้ว ผู้ใช้กลับมาใช้งานได้');
    }catch(e){ showCustomAlert('เปลี่ยนสถานะไม่ได้', typeof getFirebaseErrorText==='function'?getFirebaseErrorText(e):(e.message||String(e)), true); }
    finally{ if(typeof toggleLoader==='function') toggleLoader(false); }
  };
  window.updateUserStatus = function(uid,userKey,status){
    const target = (status === 'blocked' || status === 'deleted') ? 'blocked' : 'active';
    if(target === 'blocked') showCustomConfirm('บล็อกผู้ใช้','บล็อกเฉพาะการใช้งาน ไม่ลบข้อมูล และผู้ใช้ที่ออนไลน์อยู่จะถูกเด้งออก ต้องการทำต่อหรือไม่?',()=>executeUserStatusUpdate(uid,userKey,'blocked'));
    else executeUserStatusUpdate(uid,userKey,'active');
  };

  // ถ้าโหลดรายชื่อแล้วพบ deleted ให้แสดงเป็นบล็อก และไม่ปล่อยให้ปุ่มสร้าง deleted ใหม่
  const oldLoadAdminDataFinal = window.loadAdminData;
  if(typeof oldLoadAdminDataFinal === 'function'){
    window.loadAdminData = async function(){
      await oldLoadAdminDataFinal.apply(this, arguments);
      try{
        document.querySelectorAll("button[onclick*=\"'deleted'\"]").forEach(btn=>{
          btn.setAttribute('onclick', btn.getAttribute('onclick').replace("'deleted'","'blocked'"));
          btn.innerHTML = btn.innerHTML.replace('บล็อก','บล็อก');
        });
      }catch(e){}
    };
  }

  // Admin ใช้ค่ากลางจาก Firebase ทุกเครื่อง ไม่ใช้ localStorage เป็นแหล่งจริง
  window.SCHOOLHUB_ADMIN_CONFIG_PATH = window.SCHOOLHUB_ADMIN_CONFIG_PATH || ['schoolhub_system','admin_config'];
  window.getSystemAdminConfigFinal_ = async function(){
    const snap = await getDoc(doc(db, SCHOOLHUB_ADMIN_CONFIG_PATH[0], SCHOOLHUB_ADMIN_CONFIG_PATH[1]));
    return snap.exists() ? (snap.data()||{}) : {};
  };
  window.setSystemAdminConfigFinal_ = async function(payload){
    await setDoc(doc(db, SCHOOLHUB_ADMIN_CONFIG_PATH[0], SCHOOLHUB_ADMIN_CONFIG_PATH[1]), Object.assign({}, payload, {updatedAt:Date.now()}), {merge:true});
  };

  const oldHandleLoginFinal = window.handleLogin;
  window.handleLogin = async function(e){
    if(e) e.preventDefault();
    const email=(document.getElementById('login-email')?.value||'').trim();
    const pass=document.getElementById('login-pass')?.value||'';
    if(email.toLowerCase()==='admin'){
      toggleLoader(true);
      try{
        const cfg = await getSystemAdminConfigFinal_();
        if(cfg && cfg.defaultDisabled && cfg.password){
          if(pass !== cfg.password){ toggleLoader(false); return showCustomAlert('รหัสผ่าน Admin ไม่ถูกต้อง','ต้องใช้รหัสผ่าน Admin ล่าสุดที่บันทึกไว้ในระบบกลางเท่านั้น',true); }
          localStorage.setItem('schoolhub_admin_bypass','true');
          localStorage.setItem('schoolhub_admin_name', cfg.name || 'Administrator');
          currentUser = {uid:'admin-bypass', email:'Admin', displayName:cfg.name || 'Administrator'};
          await window.enterAdminMode();
          toggleLoader(false);
          return;
        }
        if(pass !== 'Admin123'){ toggleLoader(false); return showCustomAlert('รหัสผ่าน Admin ไม่ถูกต้อง','ครั้งแรกเท่านั้นใช้ Admin / Admin123 หลังตั้งค่าแล้วใช้รหัสกลางจากระบบ',true); }
        localStorage.setItem('schoolhub_admin_bypass','true');
        currentUser = {uid:'admin-bypass', email:'Admin', displayName:'Administrator'};
        await window.enterAdminMode();
        toggleLoader(false);
        setTimeout(()=>openAdminFirstSetupModal(),250);
        return;
      }catch(err){ toggleLoader(false); return showCustomAlert('เข้าสู่ระบบ Admin ไม่สำเร็จ', typeof getFirebaseErrorText==='function'?getFirebaseErrorText(err):(err.message||String(err)), true); }
    }
    return oldHandleLoginFinal ? oldHandleLoginFinal(e||{preventDefault(){}}) : undefined;
  };

  window.saveAdminFirstSetup = async function(){
    const name=(document.getElementById('admin-setup-name')?.value||'').trim();
    const pass=document.getElementById('admin-setup-password')?.value||'';
    if(!name) return showCustomAlert('กรุณากรอกชื่อแอดมิน','ชื่อแอดมินห้ามว่าง',true);
    if(!pass || pass.length<6) return showCustomAlert('รหัสผ่านสั้นเกินไป','รหัสผ่าน Admin ต้องมีอย่างน้อย 6 ตัวอักษร',true);
    if(pass==='Admin123') return showCustomAlert('ห้ามใช้รหัสเริ่มต้น','เพื่อความปลอดภัย กรุณาตั้งรหัสใหม่ที่ไม่ใช่ Admin123',true);
    toggleLoader(true);
    try{
      await setSystemAdminConfigFinal_({name, password:pass, defaultDisabled:true});
      localStorage.setItem('schoolhub_admin_bypass','true');
      localStorage.setItem('schoolhub_admin_name', name);
      currentUser = {uid:'admin-bypass', email:'Admin', displayName:name};
      document.getElementById('user-display-name').textContent=name;
      document.getElementById('user-display-email').textContent='Admin';
      document.getElementById('user-avatar-initial').textContent=name.charAt(0).toUpperCase();
      closeModal('admin-first-setup-modal');
      showCustomAlert('ตั้งค่า Admin สำเร็จ','บันทึกชื่อและรหัสผ่าน Admin ไว้ในระบบกลางแล้ว ทุกเครื่องต้องใช้รหัสนี้');
    }catch(err){ showCustomAlert('บันทึก Admin ไม่สำเร็จ', typeof getFirebaseErrorText==='function'?getFirebaseErrorText(err):(err.message||String(err)), true); }
    finally{ toggleLoader(false); }
  };

  const oldSaveProfileFinal = window.saveUserProfileChanges;
  window.saveUserProfileChanges = async function(){
    if(currentUser?.uid !== 'admin-bypass') return oldSaveProfileFinal ? oldSaveProfileFinal() : undefined;
    const newName=(document.getElementById('profile-display-name-input')?.value||'').trim();
    const newPass=(document.getElementById('admin-profile-password-input')?.value||'').trim();
    if(!newName) return showCustomAlert('กรุณากรอกชื่อ','ชื่อ Admin ห้ามว่าง',true);
    if(newPass && newPass.length<6) return showCustomAlert('รหัสผ่านสั้นเกินไป','รหัสผ่าน Admin ต้องมีอย่างน้อย 6 ตัวอักษร',true);
    if(newPass==='Admin123') return showCustomAlert('ห้ามใช้รหัสเริ่มต้น','Admin123 ใช้ได้เฉพาะก่อนตั้งค่าครั้งแรกเท่านั้น',true);
    toggleLoader(true);
    try{
      const payload={name:newName, defaultDisabled:true};
      if(newPass) payload.password=newPass;
      await setSystemAdminConfigFinal_(payload);
      localStorage.setItem('schoolhub_admin_name',newName);
      currentUser.displayName=newName;
      document.getElementById('user-display-name').textContent=newName;
      document.getElementById('user-avatar-initial').textContent=newName.charAt(0).toUpperCase();
      closeModal('user-profile-modal');
      showCustomAlert('บันทึกสำเร็จ','แก้ไขชื่อ/รหัสผ่าน Admin ในระบบกลางแล้ว ทุกเครื่องใช้ค่าเดียวกัน');
    }catch(err){ showCustomAlert('บันทึก Admin ไม่สำเร็จ', typeof getFirebaseErrorText==='function'?getFirebaseErrorText(err):(err.message||String(err)), true); }
    finally{ toggleLoader(false); }
  };

  // ป็อปอัพผลตรวจสลิป: ไม่ปิด/ไม่เปลี่ยนหน้าต่างจนกว่าจะกดดำเนินการต่อ
  window.showSlipContinuePopup_ = function(verification, onContinue){
    const popup=document.getElementById('slip-result-popup');
    const body=document.getElementById('slip-result-popup-body');
    const btn=document.getElementById('slip-result-confirm-btn');
    if(!popup || !body || !btn){ if(typeof onContinue==='function') onContinue(); return; }
    const ok=!!(verification && verification.autoApproved);
    const title=ok?'ตรวจสลิปผ่านครบเงื่อนไข':'บันทึกสลิปแล้ว รอตรวจสอบ';
    const detail=ok?'ระบบตรวจพบว่าสลิปถูกต้องครบเงื่อนไข สามารถอนุมัติอัตโนมัติได้':'ระบบบันทึกข้อมูลแล้ว แต่ยังไม่ผ่านเงื่อนไขอนุมัติอัตโนมัติครบถ้วน จึงรอแอดมินตรวจสอบ';
    body.innerHTML=`<div class="rounded-3xl ${ok?'bg-emerald-50 border-emerald-100':'bg-amber-50 border-amber-100'} border p-5">
      <div class="text-lg font-black ${ok?'text-emerald-700':'text-amber-700'}">${shEsc(title)}</div>
      <p class="text-sm text-slate-600 mt-2 whitespace-pre-line">${shEsc(detail)}</p>
      ${verification?.reference?`<div class="mt-3 text-xs font-mono bg-white/70 rounded-xl p-3 break-all">เลขอ้างอิง: ${shEsc(verification.reference)}</div>`:''}
      ${verification?.verificationError?`<div class="mt-3 text-xs text-rose-600 bg-white rounded-xl p-3 whitespace-pre-line">${shEsc(verification.verificationError)}</div>`:''}
      <p class="text-xs text-slate-500 mt-4">หน้าต่างชำระเงินจะยังไม่เปลี่ยนจนกว่าจะกด “ดำเนินการต่อ”</p>
    </div>`;
    btn.textContent='ดำเนินการต่อ';
    window._slipResultConfirmCallback=function(){
      popup.classList.add('hidden');
      if(typeof onContinue==='function') onContinue();
    };
    popup.classList.remove('hidden');
  };
})();
