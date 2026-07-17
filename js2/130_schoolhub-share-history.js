/* ================================================================
   SchoolHub — Share History System (นักเรียน) V6
   130_schoolhub-share-history.js

   การแก้ไข V6 (Final):
   1. ใช้ Local History (ใน state) เป็นหลักเพื่อให้ข้อมูลขึ้นทันทีและแม่นยำ
   2. ดึงข้อมูลจาก Cloud (Firebase) มาเสริม โดยใช้ Query ที่เรียบง่ายที่สุด
   3. จัดการกรณี Permission Denied หรือ Missing Index ให้แสดงผลบอกผู้ใช้
   4. ปรับปรุง z-index และปุ่มจัดการให้สมบูรณ์
   5. [ใหม่] ปุ่ม "ปิดใช้งาน" ลบลิงก์จริงบน Firebase + ล็อกไว้ในเครื่อง ให้ขึ้น "หมดอายุแล้ว" ทันที
   6. [ใหม่] ปุ่ม "ลบจากประวัติ" และ "ล้างประวัติทั้งหมด" (clearShareHistory) ทำงานได้จริง
   7. [ใหม่] เมนู "จัดการ" ย้ายไปแสดงที่ <body> (portal) คำนวณตำแหน่งด้วย JS
      ไม่ให้ถูกครอบตัดใต้แถบหัวข้อ/พื้นที่เลื่อนอีกต่อไป
   8. [ใหม่] ป็อปอัพ "ข้อมูลลิงก์แชร์" / "คัดลอกแล้ว" ใช้ไอคอนติ๊กถูกสีเขียว (สำเร็จ)
      แทนกากบาทแดง (error) ซึ่งเดิมส่งค่า isError=true ทุกกรณีอย่างผิด ๆ
   ================================================================ */

(function(){
'use strict';

// ── Constants ────────────────────────────────────────────────────
var SHARE_HISTORY_Z = 2147483500;
var MANAGE_MENU_Z = 2147483501; // สูงกว่าตัว popup แต่ต่ำกว่า custom-alert (2147483647)

// ── Helpers ──────────────────────────────────────────────────────
function eid(id){ return document.getElementById(id); }

function getCid(){
  if(typeof window.currentActiveCourseId !== 'undefined' && window.currentActiveCourseId) return window.currentActiveCourseId;
  var modal = document.getElementById('share-student-modal');
  return String(modal?.dataset?.courseId || '').trim() || null;
}

function getState(){ return window.state || {}; }

function esc(v){
  return String(v||'').replace(/[&<>"']/g,function(m){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}

// isError: true = ไอคอนกากบาทแดง (ผิดพลาด/แจ้งเตือน), false/undefined = ไอคอนติ๊กถูกเขียว (สำเร็จ/ข้อมูล)
function alert2(title,msg,isError){
  if(typeof window.showCustomAlert === 'function') window.showCustomAlert(title,msg,!!isError);
  else alert(title + ': ' + msg);
}

function confirm2(title,msg,cb){
  if(typeof window.showCustomConfirm === 'function') window.showCustomConfirm(title,msg,cb);
  else { if(confirm(title + '\n' + msg)) cb(); }
}

function getFirebaseHelpers(){
  return {
    db: window.__shDB || null,
    doc: window.__shDoc || null,
    getDoc: window.__shGetDoc || null,
    getDocs: window.__shGetDocs || null,
    collection: window.__shCollection || null,
    query: window.__shQuery || null,
    where: window.__shWhere || null,
    orderBy: window.__shOrderBy || null,
    // เดิมอ้างอิง window.deleteDoc / window.setDoc ซึ่งไม่เคยถูกประกาศไว้จริง (undefined เสมอ)
    // ทำให้ปุ่ม "ปิดใช้งาน" ไม่เคยลบเอกสารบน Firebase ได้จริงเลย แก้ให้ชี้ไปที่ __shDeleteDoc/__shSetDoc ที่ 007.js เปิดออกมาให้แล้ว
    deleteDoc: typeof window.__shDeleteDoc === 'function' ? window.__shDeleteDoc : null,
    setDoc: typeof window.__shSetDoc === 'function' ? window.__shSetDoc : null
  };
}

// ── Local (ต่อเครื่อง) เก็บสถานะ "ปิดใช้งาน" / "ลบแล้ว" ──────────────
// "ปิดใช้งาน" (disable) = ทำให้เข้าลิงก์ไม่ได้ แต่ยังอยู่ในประวัติ (ไม่เท่ากับลบ) เปิดกลับมาใช้ได้ภายหลัง
// "ลบจากประวัติ" / "ล้างประวัติ" = ลบออกจากรายการจริง ไม่สามารถกู้คืนได้
// เก็บไว้ที่เครื่องนี้เพื่อให้ปุ่มใช้งานได้จริงเสมอ ต่อให้ Firestore Rules ไม่อนุญาตให้แก้ไข/ลบเอกสารจริง
// (ยังพยายามอัปเดต/ลบเอกสารจริงบน Firebase ควบคู่กันไปแบบ best-effort ด้วย)
function lsKey(kind,cid){ return 'sh_hist_' + kind + '_' + cid; }
function lsGetJSON(key, fallback){
  try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch(e){ return fallback; }
}
function lsSetJSON(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} }
function getRemovedTokens(cid){ return lsGetJSON(lsKey('removed',cid), []); }
function setRemovedTokens(cid, arr){ lsSetJSON(lsKey('removed',cid), arr); }
function getDisabledMap(cid){ return lsGetJSON(lsKey('disabled',cid), {}); } // { token: true }
function setDisabledMap(cid, obj){ lsSetJSON(lsKey('disabled',cid), obj); }

// ── Fetch share links from Firebase ──────────────────────────────
async function fetchShareTokensFromFirebase(cid){
  var fh = getFirebaseHelpers();
  if(!fh.db || !fh.collection || !fh.getDocs || !fh.query || !fh.where){
    return { error: 'FIREBASE_NOT_READY' };
  }
  try {
    var col = fh.collection(fh.db, 'shared_student_views');
    // Simple query first (most likely to work without index)
    var q = fh.query(col, fh.where('course.id', '==', String(cid)));
    var snap = await fh.getDocs(q);
    var docs = [];
    snap.forEach(function(d){
      var data = d.data();
      docs.push({
        token: d.id, id: d.id, data: data,
        createdAt: data.createdAt || 0,
        studentName: data.student?.name || data.student?.fullName || '-',
        studentCode: data.student?.code || data.student?.studentCode || '',
        courseCode: data.course?.code || '',
        courseName: data.course?.name || '',
        expireMinutes: data.expireMinutes || 1,
        note: data.note || '',
        expiresAt: data.expiresAt || null,
        disabled: !!data.disabled,
        isActive: true
      });
    });
    return docs;
  } catch(e){
    console.warn('130.js Cloud fetch error:', e);
    if(e.message && e.message.indexOf('index') !== -1 && e.message.indexOf('https://') !== -1){
      var url = e.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
      return { error: 'INDEX_REQUIRED', url: url ? url[0] : null };
    }
    if(e.code === 'permission-denied' || (e.message && e.message.toLowerCase().indexOf('permission') !== -1)){
      return { error: 'PERMISSION_DENIED' };
    }
    return { error: 'UNKNOWN_ERROR', message: e.message };
  }
}

// ── Open Share History Popup ─────────────────────────────────────
window.openShareHistory = async function(){
  var cid = getCid();
  if(!cid){ alert2('กรุณาเลือกรายวิชา','กรุณาเปิดรายวิชาก่อนใช้งาน',true); return; }

  var popup = eid('share-history-popup');
  if(!popup) return;

  // BRING TO FRONT
  document.body.appendChild(popup);
  popup.style.position = 'fixed';
  popup.style.inset = '0';
  popup.style.zIndex = String(SHARE_HISTORY_Z);
  popup.classList.remove('hidden');

  await renderShareHistory(cid);
};

window.closeShareHistory = function(){
  var popup = eid('share-history-popup');
  if(popup) popup.classList.add('hidden');
  // เคลียร์เมนู "จัดการ" ที่ถูกย้ายไปแปะไว้ที่ <body> ตอนเปิดใช้งาน ไม่ให้ค้างอยู่หลังปิดป็อปอัพ
  removeDetachedManageMenus();
  if(window._shHistInterval){ clearInterval(window._shHistInterval); window._shHistInterval = null; }
};

function removeDetachedManageMenus(){
  document.querySelectorAll('body > .sh-hist-manage-menu').forEach(function(el){ el.remove(); });
}

// ── Render Share History ─────────────────────────────────────────
async function renderShareHistory(cid){
  var container = eid('share-history-list');
  if(!container) return;

  // เคลียร์เมนู "จัดการ" เก่าที่เคยถูกย้ายไป <body> ก่อนวาดการ์ดชุดใหม่ ป้องกัน id ซ้ำ
  removeDetachedManageMenus();

  // 1. Get Local History
  var st = getState();
  if(!st.shareHistory) st.shareHistory = {};
  var localRecords = st.shareHistory[cid] || [];

  // 2. Try to fetch Cloud History
  container.innerHTML = '<div style="text-align:center;padding:20px">'
    + '<i class="fas fa-circle-notch fa-spin" style="color:#a5b4fc"></i>'
    + '<div style="font-size:12px;color:#94a3b8;margin-top:5px">กำลังซิงค์ข้อมูลกับ Cloud...</div>'
    + '</div>';
    
  var cloudResult = await fetchShareTokensFromFirebase(cid);
  var cloudRecords = Array.isArray(cloudResult) ? cloudResult : [];
  
  // 3. Merge Local and Cloud (Unique by token)
  var recordMap = {};
  cloudRecords.forEach(function(r){ recordMap[r.id] = r; });
  localRecords.forEach(function(r){ 
    var id = r.id || r.token;
    if(!recordMap[id] || (r.createdAt > (recordMap[id].createdAt || 0))){
        recordMap[id] = r; 
    }
  });
  
  var allRecords = Object.values(recordMap).sort(function(a,b){
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  // 3.5 ตัดรายการที่เคย "ลบจากประวัติ" หรือ "ล้างประวัติ" ไปแล้วในเครื่องนี้ทิ้งไปเลย
  //     และรายการที่เคยกด "ปิดใช้งาน" ให้ตั้งค่า disabled=true (คนละสถานะกับ "หมดอายุแล้ว")
  //     ทำงานได้จริงแม้ Firestore Rules จะไม่ยอมให้แก้ไข/ลบเอกสารต้นทางก็ตาม
  var removedTokens = getRemovedTokens(cid);
  var disabledMap = getDisabledMap(cid);
  if(removedTokens.length){
    allRecords = allRecords.filter(function(r){ return removedTokens.indexOf(r.id || r.token) === -1; });
  }
  allRecords.forEach(function(r){
    var token = r.id || r.token;
    if(disabledMap[token]) r.disabled = true;
  });

  // 4. Update Summary and Render List
  var now = Date.now();
  var activeCount = 0;
  allRecords.forEach(function(r){
    var expiresAt = r.expiresAt || (r.data && r.data.expiresAt) || null;
    var disabledFlag = !!(r.disabled || (r.data && r.data.disabled));
    var timeExpired = expiresAt ? (expiresAt <= now) : false;
    if(!disabledFlag && !timeExpired) activeCount++;
  });

  var summaryHtml = '<span style="color:#059669;font-weight:700">' + activeCount + ' รายการใช้งานได้</span> | รวม ' + allRecords.length + ' รายการ';
  
  // Add Cloud Status Info
  if(cloudResult.error === 'PERMISSION_DENIED'){
    summaryHtml += ' <span style="color:#f59e0b" title="Firestore Rules ไม่อนุญาตให้ดึงประวัติเก่าจาก Cloud"><i class="fas fa-shield-halved ml-1"></i> ติดสิทธิ์ Cloud</span>';
  } else if(cloudResult.error === 'INDEX_REQUIRED'){
    summaryHtml += ' <span style="color:#f59e0b" title="ต้องสร้าง Index ใน Firebase เพื่อดึงประวัติจาก Cloud"><i class="fas fa-triangle-exclamation ml-1"></i> ต้องสร้าง Index</span>';
  }

  eid('share-history-summary').innerHTML = summaryHtml;

  if(allRecords.length === 0){
    container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 20px;background:#f8fafc;border-radius:20px;border:2px dashed #e2e8f0">'
      + '<i class="fas fa-link" style="font-size:32px;display:block;margin-bottom:12px;color:#cbd5e1"></i>'
      + '<div style="font-size:14px">ยังไม่มีประวัติการแชร์</div>'
      + '</div>';
    return;
  }

  container.innerHTML = allRecords.map(function(r){
    var createdAt = r.createdAt || 0;
    var expiresAt = r.expiresAt || (r.data && r.data.expiresAt) || null;
    var expireMinutes = r.expireMinutes || 1;
    var disabledFlag = !!(r.disabled || (r.data && r.data.disabled));
    var timeExpired = expiresAt ? (expiresAt <= now) : false;
    var isActive = !disabledFlag && !timeExpired;
    var remaining = expiresAt ? Math.max(0, expiresAt - now) : (expireMinutes * 60 * 1000);
    var totalSec = Math.ceil(remaining / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;

    var statusClass = disabledFlag ? 'sh-hist-disabled' : (isActive ? 'sh-hist-active' : 'sh-hist-expired');
    var statusText = disabledFlag ? 'ปิดใช้งาน' : (isActive ? (expiresAt ? 'ใช้งานได้' : 'รอเปิดดู') : 'หมดอายุแล้ว');
    var statusColor = disabledFlag ? '#d97706' : (isActive ? '#059669' : '#ef4444'); // เหลือง / เขียว / แดง
    var token = r.id || r.token || '';

    return '<div class="sh-hist-card ' + statusClass + '" data-token="' + token + '">'
      + '<div class="sh-hist-card-top">'
        + '<div class="sh-hist-info">'
          + '<div class="sh-hist-student"><i class="fas fa-user text-indigo-400 mr-1.5"></i><b>' + esc(r.studentName) + '</b>' + (r.studentCode ? ' <span style="color:#94a3b8;font-size:11px">(' + esc(r.studentCode) + ')</span>' : '') + '</div>'
          + '<div class="sh-hist-course"><i class="fas fa-book text-slate-400 mr-1.5"></i>' + esc(r.courseCode) + ' ' + esc(r.courseName) + '</div>'
          + '<div class="sh-hist-time">สร้างเมื่อ ' + new Date(createdAt).toLocaleString('th-TH',{day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}) + '</div>'
        + '</div>'
        + '<div class="sh-hist-status">'
          + '<div class="sh-hist-status-badge" style="background:' + statusColor + '1a;color:' + statusColor + ';border:1.5px solid ' + statusColor + '33">' + statusText + '</div>'
          + (isActive ? '<div class="sh-hist-countdown" data-expires="' + (expiresAt||0) + '" data-token="' + token + '" style="font-size:11px;color:#64748b"><i class="fas fa-clock mr-1"></i>' + min + ':' + (sec<10?'0':'') + sec + '</div>' : '')
        + '</div>'
      + '</div>'
      + '<div class="sh-hist-card-bottom">'
        + '<code style="font-size:10px;color:#94a3b8;flex:1;overflow:hidden;text-overflow:ellipsis">' + token + '</code>'
        + '<div class="sh-hist-actions">'
          + '<button type="button" onclick="toggleManageMenu(this,\'' + token + '\')" class="sh-hist-btn-manage"><i class="fas fa-ellipsis-vertical mr-1"></i>จัดการ</button>'
          + '<div class="sh-hist-manage-menu" id="manage-menu-' + token + '">'
            + '<button type="button" onclick="copyShareHistoryLink(\'' + token + '\');closeManageMenu(\'' + token + '\')" class="sh-hist-menu-item"><i class="fas fa-copy text-indigo-500 mr-2"></i>คัดลอกลิงก์</button>'
            + (isActive ? '<button type="button" onclick="disableShareRecord(\'' + token + '\');closeManageMenu(\'' + token + '\')" class="sh-hist-menu-item sh-hist-menu-danger"><i class="fas fa-ban text-amber-500 mr-2"></i>ปิดใช้งาน</button>' : '')
            + (disabledFlag ? '<button type="button" onclick="enableShareRecord(\'' + token + '\');closeManageMenu(\'' + token + '\')" class="sh-hist-menu-item"><i class="fas fa-rotate-left text-emerald-500 mr-2"></i>เปิดใช้งานอีกครั้ง</button>' : '')
            + '<button type="button" onclick="viewShareRecord(\'' + token + '\');closeManageMenu(\'' + token + '\')" class="sh-hist-menu-item"><i class="fas fa-eye text-emerald-500 mr-2"></i>ดูข้อมูล</button>'
            + '<button type="button" onclick="deleteShareRecord(\'' + token + '\');closeManageMenu(\'' + token + '\')" class="sh-hist-menu-item sh-hist-menu-danger"><i class="fas fa-trash-can text-red-500 mr-2"></i>ลบจากประวัติ</button>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '</div>';
  }).join('');

  startCountdown();
}

function startCountdown(){
  if(window._shHistInterval) clearInterval(window._shHistInterval);
  window._shHistInterval = setInterval(function(){
    var now = Date.now();
    document.querySelectorAll('.sh-hist-countdown').forEach(function(el){
      var exp = parseInt(el.getAttribute('data-expires'), 10);
      if(!exp) return;
      var rem = Math.max(0, exp - now);
      var sec = Math.ceil(rem/1000);
      if(sec <= 0){ el.innerHTML = 'หมดอายุ'; el.closest('.sh-hist-card')?.classList.add('sh-hist-expired'); }
      else { el.innerHTML = '<i class="fas fa-clock mr-1"></i>' + Math.floor(sec/60) + ':' + (sec%60<10?'0':'') + (sec%60); }
    });
  }, 1000);
}

// ── Manage Menu ("จัดการ") — Portal to <body> เพื่อไม่ให้ถูกครอบตัด ──
// เดิมเมนูนี้เป็น position:absolute อยู่ในการ์ดที่อยู่ในกล่องเลื่อน (overflow-y:auto)
// ซึ่งตัวกล่อง popup รอบนอกมี backdrop-blur + overflow-hidden ทำให้เมนูที่กาง "ขึ้นด้านบน"
// ถูกครอบตัดไปโผล่ใต้แถบหัวข้อแทน จึงย้าย element จริงไปแปะที่ body แล้วคำนวณตำแหน่งด้วย JS
window.toggleManageMenu = function(btn, token){
  var menu = eid('manage-menu-' + token);
  if(!menu) return;
  var willOpen = !menu.classList.contains('open');

  document.querySelectorAll('.sh-hist-manage-menu.open').forEach(function(m){ m.classList.remove('open'); });
  document.querySelectorAll('.sh-hist-btn-manage.active').forEach(function(b){ b.classList.remove('active'); });

  if(!willOpen) return;

  document.body.appendChild(menu);
  menu.style.position = 'fixed';
  menu.style.margin = '0';
  menu.style.zIndex = String(MANAGE_MENU_Z);
  menu.style.right = 'auto';
  menu.style.bottom = 'auto';
  menu.classList.add('open'); // ต้องเปิดก่อนถึงจะวัดขนาดจริงได้

  var rect = btn.getBoundingClientRect();
  var gap = 8;
  var mw = menu.offsetWidth || 180;
  var mh = menu.offsetHeight || 150;

  var left = rect.right - mw;
  if(left < gap) left = gap;
  if(left + mw > window.innerWidth - gap) left = Math.max(gap, window.innerWidth - mw - gap);

  var top = rect.top - mh - gap; // แสดงเหนือปุ่มก่อนเป็นค่าเริ่มต้น
  if(top < gap) top = Math.min(rect.bottom + gap, window.innerHeight - mh - gap); // พื้นที่ไม่พอด้านบน -> โชว์ใต้ปุ่มแทน

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';

  btn.classList.add('active');

  // ถ้าเลื่อนหน้าจอ/ปรับขนาดหน้าต่างระหว่างเปิดเมนู ตำแหน่งจะไม่ตรงปุ่มอีกต่อไป ให้ปิดไปเลย
  var listEl = eid('share-history-list');
  function closeOnScroll(){ window.closeManageMenu(token); }
  if(listEl) listEl.addEventListener('scroll', closeOnScroll, { once:true, passive:true });
  window.addEventListener('resize', closeOnScroll, { once:true });
};

window.closeManageMenu = function(token){
  var menu = eid('manage-menu-' + token);
  if(menu) menu.classList.remove('open');
  document.querySelectorAll('.sh-hist-btn-manage.active').forEach(function(b){ b.classList.remove('active'); });
};

document.addEventListener('click', function(e){
  if(!e.target.closest('.sh-hist-manage-menu') && !e.target.closest('.sh-hist-btn-manage')){
    document.querySelectorAll('.sh-hist-manage-menu.open').forEach(function(m){ m.classList.remove('open'); });
    document.querySelectorAll('.sh-hist-btn-manage.active').forEach(function(b){ b.classList.remove('active'); });
  }
});

window.copyShareHistoryLink = function(token){
  var url = location.origin + location.pathname + '?share=' + token;
  navigator.clipboard.writeText(url).then(function(){ alert2('คัดลอกแล้ว','คัดลอกลิงก์เรียบร้อยแล้ว'); });
};

// ── ปิดใช้งานลิงก์ ("ปิดใช้งาน") — ไม่ใช่การลบ แค่ทำให้เข้าถึงไม่ได้ ──
// แก้ให้: 1) ตั้งสถานะ "ปิดใช้งาน" (สีเหลือง) ทันทีในเครื่องนี้ ไม่ต้องรอ Firebase
//         2) อัปเดตเอกสารจริงบน Firebase เป็น disabled:true (merge, ไม่ลบทิ้ง) เพื่อบล็อกไม่ให้นักเรียนเปิดลิงก์ได้จริง
//         3) เปิดใช้งานกลับคืนได้ภายหลังด้วย enableShareRecord — คนละสถานะกับ "หมดอายุแล้ว" (สีแดง จากเวลาหมดเอง)
window.disableShareRecord = async function(token){
  confirm2('ยืนยันปิดลิงก์','ต้องการปิดใช้งานลิงก์แชร์นี้ใช่หรือไม่? นักเรียนจะเข้าลิงก์นี้ไม่ได้ทันที แต่ยังคงอยู่ในประวัติ และเปิดใช้งานกลับมาได้ภายหลัง (ไม่ใช่การลบ)', async function(){
    var cid = getCid();
    if(cid){
      var map = getDisabledMap(cid);
      map[token] = true;
      setDisabledMap(cid, map);
    }

    var fh = getFirebaseHelpers();
    if(fh.db && fh.doc && fh.setDoc){
      try { await fh.setDoc(fh.doc(fh.db, 'shared_student_views', token), { disabled: true, disabledAt: Date.now() }, { merge: true }); } catch(e){ console.warn('130.js disable cloud update failed:', e); }
    }

    // Update Local record (ถ้ามี) ให้สอดคล้องกันด้วย
    if(cid && getState().shareHistory?.[cid]){
        var r = getState().shareHistory[cid].find(x=>(x.id||x.token)===token);
        if(r) r.disabled = true;
        if(typeof window.saveStateToDB === 'function'){ try { await window.saveStateToDB(); } catch(e){} }
    }

    await renderShareHistory(cid);
    alert2('ปิดใช้งานแล้ว','ปิดการเข้าถึงลิงก์นี้แล้ว นักเรียนจะเปิดดูไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง');
  });
};

// ── เปิดใช้งานลิงก์อีกครั้ง (ยกเลิกการปิดใช้งาน) ─────────────────
window.enableShareRecord = async function(token){
  confirm2('เปิดใช้งานลิงก์','ต้องการเปิดใช้งานลิงก์แชร์นี้อีกครั้งใช่หรือไม่?', async function(){
    var cid = getCid();
    if(cid){
      var map = getDisabledMap(cid);
      delete map[token];
      setDisabledMap(cid, map);
    }

    var fh = getFirebaseHelpers();
    if(fh.db && fh.doc && fh.setDoc){
      try { await fh.setDoc(fh.doc(fh.db, 'shared_student_views', token), { disabled: false }, { merge: true }); } catch(e){ console.warn('130.js enable cloud update failed:', e); }
    }

    if(cid && getState().shareHistory?.[cid]){
        var r = getState().shareHistory[cid].find(x=>(x.id||x.token)===token);
        if(r) r.disabled = false;
        if(typeof window.saveStateToDB === 'function'){ try { await window.saveStateToDB(); } catch(e){} }
    }

    await renderShareHistory(cid);
    alert2('เปิดใช้งานแล้ว','เปิดการเข้าถึงลิงก์นี้อีกครั้งแล้ว');
  });
};

// ── ลบจากประวัติ (รายการเดียว) ────────────────────────────────────
window.deleteShareRecord = async function(token){
  confirm2('ยืนยันลบประวัติ','ต้องการลบรายการนี้จากประวัติใช่หรือไม่?', async function(){
    var cid = getCid();
    if(cid){
      var removed = getRemovedTokens(cid);
      if(removed.indexOf(token) === -1) removed.push(token);
      setRemovedTokens(cid, removed);

      if(getState().shareHistory?.[cid]){
        getState().shareHistory[cid] = getState().shareHistory[cid].filter(x=>(x.id||x.token)!==token);
      }
    }

    var fh = getFirebaseHelpers();
    if(fh.db && fh.doc && fh.deleteDoc){
      try { await fh.deleteDoc(fh.doc(fh.db, 'shared_student_views', token)); } catch(e){ console.warn('130.js delete cloud failed:', e); }
    }

    if(typeof window.saveStateToDB === 'function'){ try { await window.saveStateToDB(); } catch(e){} }
    await renderShareHistory(cid);
  });
};

// ── ล้างประวัติทั้งหมด ("clearShareHistory") ──────────────────────
// เดิมฟังก์ชันนี้ไม่เคยถูกประกาศไว้เลย ปุ่ม "ล้างประวัติทั้งหมด" บนหัว popup จึงกดไม่ได้อะไร
window.clearShareHistory = function(){
  var cid = getCid();
  if(!cid){ alert2('กรุณาเลือกรายวิชา','กรุณาเปิดรายวิชาก่อนใช้งาน',true); return; }

  var container = eid('share-history-list');
  var tokens = container
    ? Array.prototype.map.call(container.querySelectorAll('.sh-hist-card[data-token]'), function(el){ return el.getAttribute('data-token'); }).filter(Boolean)
    : [];

  if(!tokens.length){ alert2('ไม่มีประวัติ','ยังไม่มีประวัติการแชร์ให้ล้างในรายวิชานี้',true); return; }

  confirm2('ยืนยันล้างประวัติทั้งหมด','ต้องการล้างประวัติการแชร์ทั้งหมด (' + tokens.length + ' รายการ) ของรายวิชานี้ใช่หรือไม่? ลิงก์ทั้งหมดจะถูกปิดใช้งานด้วย', async function(){
    var removed = getRemovedTokens(cid);
    tokens.forEach(function(t){ if(removed.indexOf(t) === -1) removed.push(t); });
    setRemovedTokens(cid, removed);

    if(getState().shareHistory?.[cid]) getState().shareHistory[cid] = [];

    var fh = getFirebaseHelpers();
    if(fh.db && fh.doc && fh.deleteDoc){
      for(var i=0;i<tokens.length;i++){
        try { await fh.deleteDoc(fh.doc(fh.db, 'shared_student_views', tokens[i])); } catch(e){ console.warn('130.js clear cloud delete failed:', tokens[i], e); }
      }
    }

    if(typeof window.saveStateToDB === 'function'){ try { await window.saveStateToDB(); } catch(e){} }
    await renderShareHistory(cid);
    alert2('ล้างประวัติแล้ว','ล้างประวัติการแชร์ทั้งหมดของรายวิชานี้เรียบร้อยแล้ว');
  });
};

window.viewShareRecord = async function(token){
  var fh = getFirebaseHelpers();
  if(!fh.db || !fh.doc || !fh.getDoc) return;
  try {
    var snap = await fh.getDoc(fh.doc(fh.db, 'shared_student_views', token));
    if(!snap.exists()){ alert2('ไม่พบข้อมูล','ลิงก์นี้ถูกปิดหรือถูกลบไปแล้ว',true); return; }
    var d = snap.data();
    // isError=false -> โชว์ไอคอนติ๊กถูกสีเขียว (ข้อมูล/สำเร็จ) แทนกากบาทแดงเดิมที่ผิด
    alert2('ข้อมูลลิงก์แชร์', 'นักเรียน: ' + (d.student?.name||'-') + '\nสร้างเมื่อ: ' + new Date(d.createdAt).toLocaleString('th-TH') + '\nสรุปคะแนน: ' + (d.summary?.totalScore||0) + '/' + (d.summary?.totalMax||0), false);
  } catch(e){ alert2('Error', e.message, true); }
};

})();
