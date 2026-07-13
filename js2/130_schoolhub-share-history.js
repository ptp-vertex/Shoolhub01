/* ================================================================
   SchoolHub — Share History System (นักเรียน) V2
   130_schoolhub-share-history.js

   การแก้ไข V2:
   1. ดึงข้อมูลจาก Firebase shared_student_views โดยตรง
   2. z-index สูงสุด (2147483500) อยู่หน้าสุดเสมอ
   3. ปุ่ม "จัดการ" แทนปุ่มปิด/คัดลอกแยก → submenu
   ================================================================ */

(function(){
'use strict';

// ── Constants ────────────────────────────────────────────────────
var SHARE_HISTORY_Z = 2147483500;
var SHARE_HISTORY_BACKDROP_Z = 2147483501;

// ── Helpers ──────────────────────────────────────────────────────
function eid(id){ return document.getElementById(id); }

function getCid(){
  if(typeof window.currentActiveCourseId !== 'undefined') return window.currentActiveCourseId;
  var modal = document.getElementById('share-student-modal');
  return String(modal?.dataset?.courseId || '').trim() || null;
}

function getState(){ return window.state || {}; }

function esc(v){
  return String(v||'').replace(/[&<>"']/g,function(m){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}

function alert2(title,msg){
  if(typeof window.showCustomAlert === 'function') window.showCustomAlert(title,msg,true);
  else alert(title + ': ' + msg);
}

function confirm2(title,msg,cb){
  if(typeof window.showCustomConfirm === 'function') window.showCustomConfirm(title,msg,cb);
  else { if(confirm(title + '\n' + msg)) cb(); }
}

// Firebase helpers (exposed by 007.js)
function getFirebaseHelpers(){
  return {
    db: window.__shDB || null,
    doc: window.__shDoc || null,
    getDoc: window.__shGetDoc || null,
    getDocs: window.__shGetDocs || null,
    collection: window.__shCollection || null,
    deleteDoc: typeof window.deleteDoc === 'function' ? window.deleteDoc : null,
    setDoc: typeof window.setDoc === 'function' ? window.setDoc : null
  };
}

// ── Fetch share links from Firebase ──────────────────────────────
var _allShareTokens = null;
var _shareFetchPromise = null;

function getShareDocRef(token){
  if(typeof window.getShareDocRef === 'function') return window.getShareDocRef(token);
  var fh = getFirebaseHelpers();
  if(fh.db && fh.doc){
    try { return fh.doc(fh.db, 'shared_student_views', token); } catch(e){}
  }
  return null;
}

async function fetchAllShareTokensFromFirebase(){
  var fh = getFirebaseHelpers();
  if(!fh.db || !fh.collection || !fh.getDocs){
    console.warn('130.js: Firebase helpers not ready, falling back to local state');
    return [];
  }
  try {
    var col = fh.collection(fh.db, 'shared_student_views');
    var snap = await fh.getDocs(col);
    var docs = [];
    snap.forEach(function(d){
      var data = d.data();
      docs.push({
        token: d.id,
        data: data,
        createdAt: data.createdAt || null,
        studentName: data.student?.name || data.student?.fullName || '-',
        studentCode: data.student?.code || data.student?.studentCode || '',
        courseCode: data.course?.code || '',
        courseName: data.course?.name || '',
        expireMinutes: data.expireMinutes || 1,
        note: data.note || '',
        firstViewedAt: data.firstViewedAt || null,
        expiresAt: data.expiresAt || null,
        teacherName: data.teacherName || 'ครูผู้สอน',
        isActive: true
      });
    });
    return docs;
  } catch(e){
    console.warn('130.js: Failed to fetch share tokens:', e);
    return [];
  }
}

async function fetchShareTokensWithFallback(cid){
  // Try Firebase first
  var fromFirebase = await fetchAllShareTokensFromFirebase();
  if(fromFirebase.length > 0){
    _allShareTokens = fromFirebase;
    return fromFirebase;
  }

  // Fallback: merge local state + Firebase known tokens
  var st = getState();
  var local = (st.shareHistory && st.shareHistory[cid]) || [];
  if(local.length > 0){
    _allShareTokens = local;
    return local;
  }

  // Last resort: try getDoc on known tokens from local
  return [];
}

// ── Init: create shareHistory structure on load ──────────────────
function initShareHistory(){
  var st = getState();
  if(!st.shareHistory) st.shareHistory = {};
  var courses = st.courses || [];
  courses.forEach(function(c){
    if(!st.shareHistory[c.id]) st.shareHistory[c.id] = [];
  });
}
if(document.readyState !== 'loading') setTimeout(initShareHistory, 1500);
else document.addEventListener('DOMContentLoaded', function(){ setTimeout(initShareHistory, 1500); });

// ── Hook: save share record when link is created ─────────────────
var _origConfirm = window.confirmCreateStudentShareLink;
window.confirmCreateStudentShareLink = async function(){
  var studentId = window.__schoolhubShareStudentId;
  var expireMinutes = Math.max(1, Number(eid('student-share-expire-minutes')?.value || 1));
  var note = String(eid('student-share-note')?.value || '').trim();

  var payload = typeof window.buildStudentSharePayload === 'function'
    ? window.buildStudentSharePayload(studentId, expireMinutes, note)
    : null;

  if(!payload){
    alert2('สร้างลิงก์ไม่ได้','ไม่พบข้อมูลนักเรียน หรือเป็นนักเรียนที่ลาออกแล้ว');
    return false;
  }

  var token = 'sh_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  var now = Date.now();
  var expiresAt = now + expireMinutes * 60 * 1000;

  // Save to Firebase (original behavior)
  var toggleLoader = typeof window.toggleLoader === 'function' ? window.toggleLoader : function(){};
  toggleLoader(true);
  try{
    var ref = typeof window.getShareDocRef === 'function' ? window.getShareDocRef(token) : null;
    if(ref && typeof window.setDoc === 'function'){
      await window.setDoc(ref, payload);
    }
    var url = location.origin + location.pathname + '?share=' + encodeURIComponent(token);
    window.__schoolhubShareStudentUrl = url;
    var urlInput = eid('student-share-created-url');
    if(urlInput) urlInput.value = url;
    var detail = eid('student-share-created-detail');
    if(detail) detail.textContent = 'ลิงก์ของ ' + payload.student.name + ' หมดอายุหลังเปิดดูครั้งแรก ' + expireMinutes + ' นาที';
    eid('student-share-create-form')?.classList.add('hidden');
    eid('student-share-created-panel')?.classList.remove('hidden');
    var copyBtn = eid('student-share-copy-btn');
    if(copyBtn){ copyBtn.disabled=false; copyBtn.classList.remove('opacity-80','cursor-not-allowed'); copyBtn.innerHTML='<i class="fas fa-copy mr-1"></i> คัดลอกลิงก์'; }
  }catch(e){
    alert2('สร้างลิงก์แชร์ไม่ได้','ต้องแก้ Firestore Rules ของ shared_student_views ก่อน');
    toggleLoader(false);
    return false;
  }

  // ★ SAVE TO LOCAL HISTORY (for fallback) ★
  var cid = getCid();
  if(cid){
    var st = getState();
    if(!st.shareHistory) st.shareHistory = {};
    if(!st.shareHistory[cid]) st.shareHistory[cid] = [];

    var record = {
      id: token,
      token: token,
      studentName: payload.student.name || studentId,
      studentCode: payload.student.code || payload.student.studentCode || '',
      courseCode: payload.course.code || '',
      courseName: payload.course.name || '',
      expireMinutes: expireMinutes,
      note: note,
      createdAt: now,
      expiresAt: expiresAt,
      firstViewedAt: null,
      isActive: true,
      teacherName: payload.teacherName || (window.currentUser ? (window.currentUser.displayName || window.currentUser.email || 'ครูผู้สอน') : 'ครูผู้สอน')
    };
    st.shareHistory[cid].unshift(record);

    try {
      if(typeof window.dbSave === 'function') await window.dbSave();
    } catch(e) {
      console.warn('Share history local save failed:', e);
    }
  }

  // Invalidate cache so next open fetches fresh data
  _allShareTokens = null;

  toggleLoader(false);
  return false;
};

// ── Open Share History Popup ─────────────────────────────────────
window.openShareHistory = async function(){
  var cid = getCid();
  if(!cid){ alert2('กรุณาเลือกรายวิชา','กรุณาเปิดรายวิชาก่อนใช้งาน'); return; }

  var popup = eid('share-history-popup');
  if(!popup) { alert2('ไม่พบ popup','ระบบยังไม่โหลดสมบูรณ์ กรุณารีเฟรชหน้า'); return; }

  // ★ BRING TO FRONT (appendToBody + setFixedLayer) ★
  document.body.appendChild(popup);
  popup.style.position = 'fixed';
  popup.style.inset = '0';
  popup.style.zIndex = String(SHARE_HISTORY_Z);

  // Render with Firebase data
  await renderShareHistoryWithFirebase(cid);

  popup.classList.remove('hidden');
  popup.classList.remove('share-history-popup-closing');
};

window.closeShareHistory = function(){
  var popup = eid('share-history-popup');
  if(popup) popup.classList.add('hidden');
};

// ── Render Share History from Firebase ───────────────────────────
async function renderShareHistoryWithFirebase(cid){
  var container = eid('share-history-list');
  if(!container) return;

  // Show loading state
  container.innerHTML = '<div style="text-align:center;padding:40px 20px">'
    + '<i class="fas fa-circle-notch fa-spin" style="font-size:24px;color:#a5b4fc"></i>'
    + '<div style="font-size:13px;color:#94a3b8;margin-top:8px">กำลังโหลดข้อมูล...</div>'
    + '</div>';

  var records = await fetchShareTokensWithFallback(cid);

  var now = Date.now();

  // Filter by course if we have courseId in data
  // Since shared_student_views doesn't store courseId, we show ALL shares
  // but we can mark them by teacher/teacherName matching
  // For now, show all records sorted newest first

  var sorted = [...records].sort(function(a,b){
    var aDate = a.createdAt || a.data?.createdAt || 0;
    var bDate = b.createdAt || b.data?.createdAt || 0;
    return bDate - aDate;
  });

  if(sorted.length === 0){
    container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 20px;background:#f8fafc;border-radius:20px;border:2px dashed #e2e8f0">'
      + '<i class="fas fa-link" style="font-size:32px;display:block;margin-bottom:12px;color:#cbd5e1"></i>'
      + '<div style="font-size:14px">ยังไม่มีประวัติการแชร์</div>'
      + '</div>';
    eid('share-history-summary').textContent = '';
    return;
  }

  var activeCount = 0;
  var expiredCount = 0;
  sorted.forEach(function(r){
    var isActive = r.isActive && ((r.expiresAt || r.data?.expiresAt || 0) > now);
    if(isActive) activeCount++; else expiredCount++;
  });

  eid('share-history-summary').innerHTML =
    '<span style="color:#059669;font-weight:700">' + activeCount + ' รายการใช้งานได้</span> | '
    + '<span style="color:#ef4444;font-weight:700">' + expiredCount + ' รายการหมดอายุ</span> | '
    + 'รวม ' + sorted.length + ' รายการ';

  container.innerHTML = sorted.map(function(r){
    var createdAt = r.createdAt || (r.data && r.data.createdAt) || 0;
    var expiresAt = r.expiresAt || (r.data && r.data.expiresAt) || null;
    var firstViewedAt = r.firstViewedAt || (r.data && r.data.firstViewedAt) || null;
    var expireMinutes = r.expireMinutes || (r.data && r.data.expireMinutes) || 1;
    var isActive = r.isActive && (expiresAt ? expiresAt > now : false);
    var remaining = isActive ? Math.max(0, expiresAt - now) : 0;
    var totalSec = Math.ceil(remaining / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;

    var statusClass = isActive ? 'sh-hist-active' : 'sh-hist-expired';
    var statusText = isActive ? 'ใช้งานได้' : 'หมดอายุแล้ว';
    var statusIcon = isActive ? 'fa-circle-check' : 'fa-circle-xmark';
    var statusColor = isActive ? '#059669' : '#ef4444';

    var countdownDisplay = isActive
      ? '<span class="sh-hist-countdown" data-expires="' + expiresAt + '" data-token="' + (r.id || r.token || '') + '"><i class="fas fa-clock mr-1"></i>' + min + ' นาที ' + sec + ' วินาที</span>'
      : '<span style="color:#94a3b8;font-size:11px"><i class="fas fa-hourglass-end mr-1"></i>หมดอายุ</span>';

    var createdDate = new Date(createdAt);
    var dateStr = createdDate.toLocaleDateString('th-TH',{ day:'numeric', month:'short', year:'2-digit' })
      + ' ' + createdDate.toLocaleTimeString('th-TH',{ hour:'2-digit', minute:'2-digit' });

    var noteHtml = r.note || (r.data && r.data.note)
      ? '<div class="sh-hist-note"><i class="fas fa-comment text-slate-400 mr-1.5"></i>' + esc(r.note || r.data?.note || '') + '</div>'
      : '';

    var viewedHtml = firstViewedAt
      ? '<div style="font-size:10px;color:#94a3b8;margin-top:4px"><i class="fas fa-eye mr-1"></i>เปิดดูเมื่อ ' + new Date(firstViewedAt).toLocaleTimeString('th-TH',{ hour:'2-digit', minute:'2-digit' }) + '</div>'
      : '';

    var token = r.id || r.token || '';

    return '<div class="sh-hist-card ' + statusClass + '" data-token="' + token + '">'
      + '<div class="sh-hist-card-top">'
        + '<div class="sh-hist-info">'
          + '<div class="sh-hist-student"><i class="fas fa-user text-indigo-400 mr-1.5"></i><b>' + esc(r.studentName || r.data?.student?.name || '-') + '</b>' + (r.studentCode || r.data?.student?.code ? ' <span style="color:#94a3b8;font-size:11px">(' + esc(r.studentCode || r.data?.student?.code || '') + ')</span>' : '') + '</div>'
          + '<div class="sh-hist-course"><i class="fas fa-book text-slate-400 mr-1.5"></i>' + esc(r.courseCode || r.data?.course?.code || '') + ' ' + esc(r.courseName || r.data?.course?.name || '') + '</div>'
          + '<div class="sh-hist-time"><i class="fas fa-calendar text-slate-400 mr-1.5"></i>สร้างเมื่อ ' + dateStr + ' | หมดอายุใน ' + expireMinutes + ' นาที</div>'
          + noteHtml
        + '</div>'
        + '<div class="sh-hist-status">'
          + '<div class="sh-hist-status-badge" style="background:' + statusColor + '1a;color:' + statusColor + ';border:1.5px solid ' + statusColor + '33"><i class="fas ' + statusIcon + ' mr-1"></i>' + statusText + '</div>'
          + countdownDisplay
          + viewedHtml
        + '</div>'
      + '</div>'
      + '<div class="sh-hist-card-bottom">'
        + '<div class="sh-hist-url">'
          + '<code style="font-size:10px;color:#64748b;word-break:break-all">' + esc('https://' + location.host + location.pathname + '?share=' + token) + '</code>'
        + '</div>'
        + '<div class="sh-hist-actions">'
          + '<button type="button" onclick="toggleManageMenu(this,\'' + token + '\')" class="sh-hist-btn sh-hist-btn-manage" title="จัดการ"><i class="fas fa-ellipsis-vertical mr-1"></i>จัดการ</button>'
          + '<div class="sh-hist-manage-menu" id="manage-menu-' + token + '">'
            + '<button type="button" onclick="copyShareHistoryLink(\'' + token + '\');closeManageMenu(\'' + token + '\')" class="sh-hist-menu-item"><i class="fas fa-copy text-indigo-500 mr-2"></i>คัดลอกลิงก์</button>'
            + (isActive ? '<button type="button" onclick="disableShareRecord(\'' + token + '\');closeManageMenu(\'' + token + '\')" class="sh-hist-menu-item sh-hist-menu-danger"><i class="fas fa-ban text-red-500 mr-2"></i>ปิดใช้งาน</button>' : '')
            + '<button type="button" onclick="viewShareRecord(\'' + token + '\');closeManageMenu(\'' + token + '\')" class="sh-hist-menu-item"><i class="fas fa-eye text-emerald-500 mr-2"></i>ดูข้อมูล</button>'
            + '<button type="button" onclick="deleteShareRecord(\'' + token + '\');closeManageMenu(\'' + token + '\')" class="sh-hist-menu-item sh-hist-menu-danger"><i class="fas fa-trash-can text-red-500 mr-2"></i>ลบประวัติ</button>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '</div>';
  }).join('');

  startShareHistoryCountdown();
}

// ── Manage Menu (Submenu) ────────────────────────────────────────
window.toggleManageMenu = function(btn, token){
  var menu = document.getElementById('manage-menu-' + token);
  if(!menu) return;

  // Close all other menus first
  document.querySelectorAll('.sh-hist-manage-menu.open').forEach(function(m){
    if(m.id !== 'manage-menu-' + token){
      m.classList.remove('open');
    }
  });

  menu.classList.toggle('open');
  btn.classList.toggle('active');
};

window.closeManageMenu = function(token){
  var menu = document.getElementById('manage-menu-' + token);
  if(menu) menu.classList.remove('open');
};

// Close menus when clicking outside
document.addEventListener('click', function(e){
  if(!e.target.closest('.sh-hist-manage-menu') && !e.target.closest('.sh-hist-btn-manage')){
    document.querySelectorAll('.sh-hist-manage-menu.open').forEach(function(m){
      m.classList.remove('open');
    });
  }
});

// ── Countdown Timer ──────────────────────────────────────────────
var _shareHistoryCountdownInterval = null;

function startShareHistoryCountdown(){
  if(_shareHistoryCountdownInterval){
    clearInterval(_shareHistoryCountdownInterval);
    _shareHistoryCountdownInterval = null;
  }

  _shareHistoryCountdownInterval = setInterval(function(){
    var now = Date.now();
    var countdowns = document.querySelectorAll('.sh-hist-countdown');
    var needRefresh = false;

    countdowns.forEach(function(el){
      var expiresAt = parseInt(el.getAttribute('data-expires'), 10);
      var remaining = Math.max(0, expiresAt - now);
      var totalSec = Math.ceil(remaining / 1000);
      var min = Math.floor(totalSec / 60);
      var sec = totalSec % 60;

      if(remaining <= 0){
        needRefresh = true;
        el.innerHTML = '<i class="fas fa-hourglass-end mr-1"></i>หมดอายุ';
        el.style.color = '#94a3b8';
        var card = el.closest('.sh-hist-card');
        if(card){
          card.classList.remove('sh-hist-active');
          card.classList.add('sh-hist-expired');
        }
      } else {
        el.innerHTML = '<i class="fas fa-clock mr-1"></i>' + min + ' นาที ' + sec + ' วินาที';
      }
    });

    if(needRefresh){
      renderShareHistoryWithFirebase(getCid());
    }
  }, 1000);

  setTimeout(function(){
    if(_shareHistoryCountdownInterval){
      clearInterval(_shareHistoryCountdownInterval);
      _shareHistoryCountdownInterval = null;
    }
  }, 7200000);
}

// ── View share record ────────────────────────────────────────────
window.viewShareRecord = async function(token){
  var fh = getFirebaseHelpers();
  if(!fh.db || !fh.doc || !fh.getDoc){
    alert2('เปิดดูไม่ได้','ระบบ Firebase ยังไม่พร้อมใช้งาน');
    return;
  }

  try {
    var ref = fh.doc(fh.db, 'shared_student_views', token);
    var snap = await fh.getDoc(ref);
    if(!snap.exists()){
      alert2('ไม่พบข้อมูล','ลิงก์นี้ถูกปิดหรือถูกลบไปแล้ว');
      return;
    }
    var data = snap.data();
    var studentName = data.student?.name || data.student?.fullName || '-';
    var studentCode = data.student?.code || data.student?.studentCode || '';
    var courseName = data.course?.name || '';
    var courseCode = data.course?.code || '';
    var totalScore = data.summary?.totalScore || 0;
    var totalMax = data.summary?.totalMax || 0;
    var present = data.summary?.present || 0;
    var late = data.summary?.late || 0;
    var absent = data.summary?.absent || 0;
    var leave = data.summary?.leave || 0;

    var now = Date.now();
    var expiresAt = data.expiresAt;
    var isActive = !expiresAt || expiresAt > now;
    var statusText = isActive ? 'ใช้งานได้' : 'หมดอายุแล้ว';
    var statusColor = isActive ? '#059669' : '#ef4444';

    var msg = '📌 ข้อมูลลิงก์แชร์\n\n';
    msg += 'นักเรียน: ' + studentName + (studentCode ? ' (' + studentCode + ')' : '') + '\n';
    msg += 'รายวิชา: ' + courseCode + ' ' + courseName + '\n';
    msg += 'สถานะ: ' + statusText + '\n';
    msg += 'สร้างเมื่อ: ' + new Date(data.createdAt).toLocaleString('th-TH') + '\n';
    msg += 'หมายเหตุ: ' + (data.note || '-') + '\n';
    msg += '\n📊 สรุปคะแนน: ' + totalScore + '/' + totalMax + '\n';
    msg += 'มา: ' + present + ' | สาย: ' + late + ' | ขาด: ' + absent + ' | ลา: ' + leave + '\n';

    alert2('ข้อมูลลิงก์แชร์', msg);
  } catch(e){
    alert2('เปิดดูไม่ได้', 'เกิดข้อผิดพลาด: ' + e.message);
  }
};

// ── Disable (close) a single share record ────────────────────────
window.disableShareRecord = async function(token){
  confirm2('ยืนยันปิดลิงก์','ต้องการปิดลิงก์แชร์นี้ใช่หรือไม่? ลิงก์จะใช้งานไม่ได้อีกต่อไป', async function(){
    var fh = getFirebaseHelpers();
    // Delete from Firestore
    if(fh.db && fh.doc && fh.deleteDoc){
      try {
        var ref = fh.doc(fh.db, 'shared_student_views', token);
        if(ref) await fh.deleteDoc(ref);
      } catch(e) {
        console.warn('Failed to delete share doc from Firestore:', e);
      }
    }

    // Invalidate cache
    _allShareTokens = null;

    renderShareHistoryWithFirebase(getCid());
    alert2('ปิดลิงก์แล้ว','ลิงก์แชร์นี้ถูกปิดเรียบร้อยแล้ว');
  });
};

// ── Delete share record (remove from history only) ───────────────
window.deleteShareRecord = async function(token){
  confirm2('ยืนยันลบประวัติ','ต้องการลบรายการนี้จากประวัติการแชร์ใช่หรือไม่? (ไม่กระทบลิงก์ใน Firebase)', async function(){
    // Remove from local state
    var cid = getCid();
    if(cid){
      var st = getState();
      if(st.shareHistory && st.shareHistory[cid]){
        st.shareHistory[cid] = st.shareHistory[cid].filter(function(r){
          return (r.id || r.token) !== token;
        });
      }
      try {
        if(typeof window.dbSave === 'function') await window.dbSave();
      } catch(e) {
        console.warn('Local history update failed:', e);
      }
    }

    // Invalidate cache
    _allShareTokens = null;

    renderShareHistoryWithFirebase(cid);
    alert2('ลบแล้ว','ลบรายการจากประวัติเรียบร้อยแล้ว');
  });
};

// ── Copy link from history ───────────────────────────────────────
window.copyShareHistoryLink = function(token){
  var url = location.origin + location.pathname + '?share=' + token;
  try {
    navigator.clipboard.writeText(url).then(function(){
      alert2('คัดลอกแล้ว','คัดลอกลิงก์เรียบร้อยแล้ว');
    }).catch(function(){
      var tmp = document.createElement('textarea');
      tmp.value = url;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
      alert2('คัดลอกแล้ว','คัดลอกลิงก์เรียบร้อยแล้ว');
    });
  } catch(e) {
    alert2('คัดลอกไม่ได้','กรุณาคัดลอกลิงก์ด้วยตนเอง');
  }
};

// ── Clear all history ────────────────────────────────────────────
window.clearShareHistory = function(){
  var cid = getCid();
  if(!cid) return;
  confirm2('ยืนยันล้างประวัติ','ต้องการล้างประวัติการแชร์ทั้งหมดของรายวิชานี้ใช่หรือไม่? (เฉพาะประวัติในเครื่อง ไม่กระทบ Firebase)', async function(){
    var st = getState();
    if(st.shareHistory && st.shareHistory[cid]){
      st.shareHistory[cid] = [];
    }
    try {
      if(typeof window.dbSave === 'function') await window.dbSave();
    } catch(e) {
      console.warn('Clear history save failed:', e);
    }
    _allShareTokens = null;
    renderShareHistoryWithFirebase(cid);
    alert2('ล้างประวัติแล้ว','ล้างประวัติการแชร์ทั้งหมดเรียบร้อยแล้ว');
  });
};

})();
