
/* Patch เฉพาะหน้า “จัดการสิทธิ์”: เพิ่มปุ่มลบผู้ใช้ + ลบข้อมูลที่ระบบใช้อยู่จริงเท่านั้น */
import { getApps } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function(){
  const app = getApps()[0];
  if(!app) return;
  const db = getFirestore(app);
  const esc = (v) => {
    try { return window.escapeHTML ? window.escapeHTML(v || '') : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
    catch(e){ return String(v ?? ''); }
  };
  const norm = (v) => String(v || '').trim();
  const low = (v) => norm(v).toLowerCase();
  const alertBox = (title, msg, err=false) => {
    if(typeof window.showCustomAlert === 'function') window.showCustomAlert(title, msg, err);
    else alert(`${title}\n${msg}`);
  };
  const confirmBox = (title, msg, cb) => {
    if(typeof window.showCustomConfirm === 'function') window.showCustomConfirm(title, msg, cb);
    else if(confirm(`${title}\n\n${msg}`)) cb();
  };
  const showLoading = (on) => { try { if(typeof window.toggleLoader === 'function') window.toggleLoader(!!on); } catch(e){} };
  const isAdminSession = () => {
    try {
      const raw = localStorage.getItem('schoolhub_web_session_v1');
      const saved = raw ? JSON.parse(raw) : null;
      return localStorage.getItem('schoolhub_admin_bypass') === 'true'
        || saved?.role === 'admin'
        || saved?.isAdmin === true
        || window.currentUser?.uid === 'admin-bypass';
    } catch(e){ return false; }
  };
  const currentAdminKeys = () => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('schoolhub_web_session_v1') || '{}'); } catch(e){}
    return [
      window.currentUser?.uid,
      window.currentUser?.email,
      window.currentUser?.userKey,
      saved.uid,
      saved.email,
      saved.username,
      'admin-bypass'
    ].map(low).filter(Boolean);
  };
  const pickTarget = async (uid, key) => {
    const cleanUid = norm(uid);
    const cleanKey = norm(key);
    let data = (window.__adminUsersByUid && cleanUid && window.__adminUsersByUid[cleanUid]) ? {...window.__adminUsersByUid[cleanUid]} : {};
    if(cleanUid){
      try {
        const s = await getDoc(doc(db, 'public_users_directory', cleanUid));
        if(s.exists()) data = {...data, ...(s.data() || {}), uid: cleanUid, docId: cleanUid};
      } catch(e){}
    }
    const userKey = norm(data.userKey || data.email || cleanKey || data.uid || cleanUid);
    const email = norm(data.email || (/@/.test(userKey) ? userKey : ''));
    return {...data, uid: norm(data.uid || cleanUid), docId: norm(data.docId || cleanUid), userKey, email};
  };
  const isProtectedUser = (u) => {
    const roleText = low(`${u.role || ''} ${u.statusRole || ''} ${u.type || ''}`);
    const keys = [u.uid, u.docId, u.userKey, u.email, u.name].map(low).filter(Boolean);
    if(!keys.length) return true;
    if(keys.some(k => currentAdminKeys().includes(k))) return true;
    if(keys.includes('admin-bypass')) return true;
    if(roleText.includes('admin') || roleText.includes('owner') || roleText.includes('ผู้ดูแล') || roleText.includes('เจ้าของ')) return true;
    return false;
  };
  const matchTarget = (obj, ids) => {
    const d = obj || {};
    const vals = [d.uid, d.userKey, d.email, d.ownerUid, d.ownerEmail, d.ownerKey, d.createdBy, d.requestedBy, d.memberEmail, d.inviteEmail, d.docId]
      .map(low).filter(Boolean);
    return vals.some(v => ids.has(v));
  };
  async function safeDeleteDoc(ref){
    try { await deleteDoc(ref); return true; }
    catch(e){ console.warn('delete failed:', ref?.path || ref, e); return false; }
  }
  async function deleteUserPrivateRoot(key){
    if(!key) return;
    try {
      const schoolSnap = await getDocs(collection(db, 'users', key, 'school_data'));
      const tasks = [];
      schoolSnap.forEach(d => tasks.push(safeDeleteDoc(doc(db, 'users', key, 'school_data', d.id))));
      await Promise.allSettled(tasks);
    } catch(e){ console.warn('delete school_data failed:', key, e); }
    await safeDeleteDoc(doc(db, 'users', key));
  }
  async function deletePlanRequests(ids){
    try {
      const qs = await getDocs(collection(db, 'subscription_requests'));
      const tasks = [];
      qs.forEach(d => {
        const data = d.data() || {};
        const vals = [d.id, data.uid, data.userKey, data.email, data.name].map(low).filter(Boolean);
        if(vals.some(v => ids.has(v))) tasks.push(safeDeleteDoc(doc(db, 'subscription_requests', d.id)));
      });
      await Promise.allSettled(tasks);
    } catch(e){ console.warn('delete subscription_requests failed:', e); }
  }
  async function cleanupTeams(ids){
    try {
      const qs = await getDocs(collection(db, 'teams'));
      const tasks = [];
      qs.forEach(d => {
        const t = d.data() || {};
        if(matchTarget({...t, docId:d.id}, ids)){
          tasks.push(safeDeleteDoc(doc(db, 'teams', d.id)));
          return;
        }
        let changed = false;
        const next = {...t};
        ['members','invites','inviteQueue','pendingInvites'].forEach(field => {
          if(Array.isArray(next[field])){
            const arr = next[field].filter(x => !matchTarget(x, ids));
            if(arr.length !== next[field].length){ next[field] = arr; changed = true; }
          }
        });
        if(changed) tasks.push(setDoc(doc(db, 'teams', d.id), next, { merge:true }).catch(e => console.warn('cleanup team failed:', d.id, e)));
      });
      await Promise.allSettled(tasks);
    } catch(e){ console.warn('cleanup teams failed:', e); }
  }
  async function cleanupSharedTeachers(ids){
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const tasks = [];
      usersSnap.forEach(userDoc => {
        tasks.push((async () => {
          try {
            const stateRef = doc(db, 'users', userDoc.id, 'school_data', 'state');
            const stateSnap = await getDoc(stateRef);
            if(!stateSnap.exists()) return;
            const state = stateSnap.data() || {};
            if(!Array.isArray(state.courses)) return;
            let changed = false;
            const courses = state.courses.map(c => {
              if(!c || !c.sharedTeachers) return c;
              if(Array.isArray(c.sharedTeachers)){
                const arr = c.sharedTeachers.filter(x => !matchTarget(x, ids));
                if(arr.length !== c.sharedTeachers.length){ changed = true; return {...c, sharedTeachers: arr}; }
              } else if(typeof c.sharedTeachers === 'object'){
                const obj = {...c.sharedTeachers};
                Object.keys(obj).forEach(k => { if(ids.has(low(k)) || matchTarget(obj[k], ids)){ delete obj[k]; changed = true; } });
                if(changed) return {...c, sharedTeachers: obj};
              }
              return c;
            });
            if(changed) await setDoc(stateRef, { courses, updatedAt: Date.now() }, { merge:true });
          } catch(e){ console.warn('cleanup sharedTeachers failed:', userDoc.id, e); }
        })());
      });
      await Promise.allSettled(tasks);
    } catch(e){ console.warn('read users for sharedTeachers failed:', e); }
  }
  async function executeDeleteUser(uid, key){
    if(!isAdminSession()) return alertBox('ไม่มีสิทธิ์', 'เฉพาะ Admin เท่านั้นที่ลบผู้ใช้ได้', true);
    showLoading(true);
    try {
      const u = await pickTarget(uid, key);
      if(isProtectedUser(u)) return alertBox('ไม่อนุญาตให้ลบ', 'ผู้ใช้นี้เป็น Admin / Owner / ผู้ดูแลระบบหลัก / บัญชีที่กำลังใช้งาน หรือไม่สามารถยืนยันได้ว่าปลอดภัยต่อการลบ', true);
      const ids = new Set([u.uid, u.docId, u.userKey, u.email, key, uid].map(low).filter(Boolean));
      if(!ids.size) return alertBox('ไม่อนุญาตให้ลบ', 'ไม่พบ UID / docId / userKey ที่ใช้ยืนยันเป้าหมายการลบ', true);

      await Promise.allSettled([
        ...[u.uid, u.docId].filter(Boolean).map(x => safeDeleteDoc(doc(db, 'public_users_directory', x))),
        ...[u.userKey, u.email, u.uid, u.docId].filter(Boolean).map(x => safeDeleteDoc(doc(db, 'users_status', x))),
        ...[u.userKey, u.email, u.uid, u.docId].filter(Boolean).map(x => safeDeleteDoc(doc(db, 'user_stats', x))),
        ...[u.userKey, u.email, u.uid, u.docId].filter(Boolean).map(deleteUserPrivateRoot),
        deletePlanRequests(ids),
        cleanupTeams(ids),
        cleanupSharedTeachers(ids)
      ]);

      try {
        document.querySelectorAll('#admin-user-list tr').forEach(tr => {
          const b = tr.querySelector(`button[data-delete-user-uid="${CSS.escape(norm(uid))}"]`);
          if(b) tr.remove();
        });
      } catch(e){}
      if(typeof window.loadPlanRequests === 'function') await window.loadPlanRequests().catch(()=>{});
      if(typeof window.loadAdminData === 'function') await window.loadAdminData().catch(()=>{});
      alertBox('ลบผู้ใช้สำเร็จ', 'ลบผู้ใช้สำเร็จ');
    } catch(e){
      alertBox('ลบผู้ใช้ไม่สำเร็จ', (typeof window.getFirebaseErrorText === 'function' ? window.getFirebaseErrorText(e) : (e.message || String(e))), true);
    } finally { showLoading(false); }
  }
  window.confirmDeleteAdminUser = async function(uid, key){
    const u = await pickTarget(uid, key);
    if(isProtectedUser(u)) return alertBox('ไม่อนุญาตให้ลบ', 'ผู้ใช้นี้เป็น Admin / Owner / ผู้ดูแลระบบหลัก / บัญชีที่กำลังใช้งาน หรือไม่สามารถยืนยันได้ว่าปลอดภัยต่อการลบ', true);
    const label = esc(u.name || u.email || u.userKey || u.uid || 'ผู้ใช้นี้');
    confirmBox(
      'ยืนยันลบผู้ใช้',
      `ต้องการลบ ${label} หรือไม่?\n\nการลบนี้จะลบข้อมูลผู้ใช้ทั้งหมด รวมถึงข้อมูลรายวิชา ห้องเรียน นักเรียน คะแนน เช็คชื่อ แผนคะแนน และข้อมูลที่เกี่ยวข้องทั้งหมด\n\nผู้ใช้นี้จะใช้งานระบบไม่ได้\n\nไม่สามารถย้อนกลับได้`,
      () => executeDeleteUser(uid, key)
    );
  };
  function addDeleteButtonsToAdminTable(){
    const tbody = document.getElementById('admin-user-list');
    if(!tbody) return;
    tbody.querySelectorAll('button[onclick^="updateUserStatus"]').forEach(btn => {
      const onclick = btn.getAttribute('onclick') || '';
      const m = onclick.match(/updateUserStatus\('([^']*)'\s*,\s*'([^']*)'/);
      if(!m || btn.parentElement?.querySelector('.schoolhub-delete-user-btn')) return;
      const uid = m[1];
      const key = m[2].replace(/\\'/g, "'");
      const user = (window.__adminUsersByUid && window.__adminUsersByUid[uid]) || {};
      if(isProtectedUser({...user, uid, userKey: user.userKey || user.email || key})) return;
      btn.insertAdjacentHTML('afterend', ` <button type="button" data-delete-user-uid="${esc(uid)}" onclick="confirmDeleteAdminUser('${String(uid).replace(/'/g,"\\'")}', '${String(key).replace(/'/g,"\\'")}')" class="schoolhub-delete-user-btn text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg text-sm font-bold border border-red-600 ml-2"><i class="fas fa-trash-alt"></i> ลบผู้ใช้</button>`);
    });
  }
  const oldLoadAdminData = window.loadAdminData;
  if(typeof oldLoadAdminData === 'function' && !oldLoadAdminData.__deleteUserPatch){
    const wrapped = async function(){
      const result = await oldLoadAdminData.apply(this, arguments);
      setTimeout(addDeleteButtonsToAdminTable, 80);
      return result;
    };
    wrapped.__deleteUserPatch = true;
    window.loadAdminData = wrapped;
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(addDeleteButtonsToAdminTable, 500));
})();
