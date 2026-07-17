
/* แก้จริง: ไม่สร้างผู้ใช้ไม่มีอีเมล, รวมผู้ใช้ซ้ำตามอีเมล, และลบ doc ขยะออกจาก Firestore */
import { getApps } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, collection, getDocs, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function(){
  if(window.__schoolhubPublicUserRealCleanupFix) return;
  window.__schoolhubPublicUserRealCleanupFix = true;

  const app = getApps()[0];
  if(!app) return;
  const db = getFirestore(app);
  const PUBLIC = 'public_users_directory';
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const norm = v => String(v || '').trim().toLowerCase();
  const validEmail = v => emailRe.test(norm(v));

  function isAdminSession(){
    try{
      const saved = JSON.parse(localStorage.getItem('schoolhub_web_session_v1') || '{}');
      return localStorage.getItem('schoolhub_admin_bypass') === 'true'
        || saved.role === 'admin'
        || saved.isAdmin === true
        || window.currentUser?.uid === 'admin-bypass';
    }catch(e){ return false; }
  }
  async function safeDelete(ref){
    try{ await deleteDoc(ref); return true; }
    catch(e){ console.warn('SchoolHub cleanup delete failed:', ref?.path || ref, e); return false; }
  }
  function scoreDoc(item){
    const d = item.data || {};
    let s = 0;
    if(item.id === norm(d.email)) s += 1000;
    if(d.role === 'admin') s += 500;
    if(d.planName || d.planId) s += 100;
    if(d.name) s += 20;
    s += Number(d.updatedAt || d.planApprovedAt || d.joinedAt || d.createdAt || 0) / 10000000000000;
    return s;
  }
  function cleanPayload(data, email, preferredUid){
    const out = Object.assign({}, data || {});
    out.email = email;
    out.userKey = email;
    out.uid = preferredUid || out.uid || email;
    out.updatedAt = Date.now();
    if(!out.name) out.name = email;
    if(!out.role) out.role = 'user';
    if(!out.status) out.status = 'active';
    return out;
  }

  window.schoolhubCleanupPublicUsers = async function(options={}){
    if(!isAdminSession() && !options.forceFromLogin) return {deleted:0, merged:0, kept:0};
    const snap = await getDocs(collection(db, PUBLIC));
    const byEmail = new Map();
    const invalid = [];

    snap.forEach(ds => {
      const data = ds.data() || {};
      const docId = norm(ds.id);
      const email = validEmail(data.email) ? norm(data.email) : (validEmail(data.userKey) ? norm(data.userKey) : (validEmail(docId) ? docId : ''));
      const item = {id: ds.id, docId, data, email};
      if(!email) invalid.push(item);
      else {
        if(!byEmail.has(email)) byEmail.set(email, []);
        byEmail.get(email).push(item);
      }
    });

    let deleted = 0, merged = 0, kept = 0;

    // ลบ doc ที่ไม่มีอีเมลจริงออกจาก public directory และคีย์สถานะที่เป็น UID ขยะ
    for(const item of invalid){
      const id = item.id;
      await Promise.allSettled([
        safeDelete(doc(db, PUBLIC, id)),
        safeDelete(doc(db, 'users_status', id)),
        safeDelete(doc(db, 'user_stats', id))
      ]);
      deleted++;
    }

    // รวม doc ซ้ำของอีเมลเดียวกันให้เหลือ doc เดียว คือ public_users_directory/{email}
    for(const [email, items] of byEmail.entries()){
      items.sort((a,b)=>scoreDoc(b)-scoreDoc(a));
      const keeper = items[0];
      const preferredUid = keeper.data.uid || keeper.id;
      const mergedData = cleanPayload(Object.assign({}, ...items.map(x=>x.data || {}), keeper.data || {}), email, preferredUid);
      await setDoc(doc(db, PUBLIC, email), mergedData, {merge:true});
      kept++;
      for(const item of items){
        if(norm(item.id) !== email){
          await Promise.allSettled([
            safeDelete(doc(db, PUBLIC, item.id)),
            (!validEmail(item.id) ? safeDelete(doc(db, 'users_status', item.id)) : Promise.resolve()),
            (!validEmail(item.id) ? safeDelete(doc(db, 'user_stats', item.id)) : Promise.resolve())
          ]);
          deleted++;
          merged++;
        }
      }
    }
    return {deleted, merged, kept};
  };

  // ป้องกันต้นเหตุ: ต่อจากนี้สร้าง/อัปเดต public_users_directory ด้วยอีเมลเท่านั้น ไม่ใช้ UID เป็น doc id
  window.addUserToDirectory = async function(user, name, role='user'){
    const email = norm(user && user.email);
    if(!user || !validEmail(email)){
      console.error('Blocked invalid user creation: email required', user);
      try{ if(window.auth?.signOut) await window.auth.signOut(); }catch(e){}
      throw new Error('ไม่พบอีเมลผู้ใช้ กรุณาเข้าสู่ระบบด้วยอีเมล');
    }
    const now = new Date().toISOString();
    const payload = {
      uid: user.uid || email,
      email,
      userKey: email,
      name: name || user.displayName || email,
      role: role || 'user',
      joinedAt: now,
      createdAt: now,
      updatedAt: Date.now(),
      status: 'active'
    };
    await setDoc(doc(db, PUBLIC, email), payload, {merge:true});
    if(user.uid && norm(user.uid) !== email){
      await Promise.allSettled([
        safeDelete(doc(db, PUBLIC, user.uid)),
        safeDelete(doc(db, 'users_status', user.uid)),
        safeDelete(doc(db, 'user_stats', user.uid))
      ]);
    }
  };

  // ก่อนโหลดหน้า “จัดการสิทธิ์” ให้ล้าง doc ผิดปกติ/ซ้ำจริงใน Firestore ก่อน แล้วค่อย render
  const oldLoadAdminData = window.loadAdminData;
  if(typeof oldLoadAdminData === 'function'){
    window.loadAdminData = async function(){
      try{ await window.schoolhubCleanupPublicUsers(); }
      catch(e){ console.warn('SchoolHub public user cleanup skipped:', e); }
      return oldLoadAdminData.apply(this, arguments);
    };
  }

  // ทำให้ปุ่มลบผู้ใช้ลบ doc อีเมล/UID ได้ครบ แล้วหายหลังรีโหลดทันที
  const oldConfirmDelete = window.confirmDeleteAdminUser;
  window.confirmDeleteAdminUser = async function(uid, key){
    const email = validEmail(key) ? norm(key) : (validEmail(uid) ? norm(uid) : '');
    const label = email || uid || key || 'ผู้ใช้นี้';
    const run = async () => {
      if(typeof window.toggleLoader === 'function') window.toggleLoader(true);
      try{
        const targets = Array.from(new Set([uid, key, email].map(x=>String(x||'').trim()).filter(Boolean)));
        await Promise.allSettled(targets.flatMap(x => [
          safeDelete(doc(db, PUBLIC, x)),
          safeDelete(doc(db, 'users_status', x)),
          safeDelete(doc(db, 'user_stats', x))
        ]));
        try{ await window.schoolhubCleanupPublicUsers(); }catch(e){}
        if(typeof oldLoadAdminData === 'function') await oldLoadAdminData();
        else if(typeof window.loadAdminData === 'function') await window.loadAdminData();
        (window.showCustomAlert || alert)('ลบผู้ใช้สำเร็จ', `ลบ ${label} ออกจากฐานข้อมูลแล้ว`);
      }catch(e){
        (window.showCustomAlert || alert)('ลบผู้ใช้ไม่สำเร็จ', e.message || String(e), true);
      }finally{
        if(typeof window.toggleLoader === 'function') window.toggleLoader(false);
      }
    };
    if(typeof window.showCustomConfirm === 'function'){
      window.showCustomConfirm('ยืนยันลบผู้ใช้', `ต้องการลบ ${label} ออกจากฐานข้อมูลหรือไม่?`, run);
    }else if(confirm(`ต้องการลบ ${label} ออกจากฐานข้อมูลหรือไม่?`)){
      run();
    }
  };
})();
