/* =========================================================
   SchoolHub Admin Mail Log UI
   หน้าตารางประวัติการส่งอีเมลแอดมินทั้งหมด
   ดึงข้อมูลจาก collection 'admin_mail_log'
   ========================================================= */
import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, limit, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function () {
  if (window.__schoolhubAdminMailLogUI) return;
  window.__schoolhubAdminMailLogUI = true;

  const firebaseConfig = {
    apiKey: "AIzaSyADAbTJEWivV1Nn-au7tXofStx4ADYTCM8",
    authDomain: "shoolhub-5677e.firebaseapp.com",
    projectId: "shoolhub-5677e",
    storageBucket: "shoolhub-5677e.firebasestorage.app",
    messagingSenderId: "630487358153",
    appId: "1:630487358153:web:1866add5d4a29b74abcb18",
    measurementId: "G-2Q6R46DC38"
  };
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const $ = (id) => document.getElementById(id);
  const norm = (v) => String(v || '').trim();
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));

  function isAdminSession() {
    const nameText = norm($('user-display-name')?.textContent).toLowerCase();
    const emailText = norm($('user-display-email')?.textContent).toLowerCase();
    return window.isAdmin === true
      || window.isAdminUser === true
      || localStorage.getItem('schoolhub_admin_active') === 'true'
      || localStorage.getItem('schoolhub_admin_logged_in') === 'true'
      || localStorage.getItem('schoolhub_admin_bypass') === 'true'
      || nameText.includes('admin')
      || emailText === 'admin';
  }

  function alertBox(title, message, danger) {
    if (typeof window.showCustomAlert === 'function') return window.showCustomAlert(title, message, !!danger);
    window.alert(`${title}\n${message || ''}`);
  }

  // ─── FORMAT HELPERS ───
  function fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(typeof ts === 'number' ? ts : ts);
    return d.toLocaleString('th-TH', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function fmtEventLabel(eventKey) {
    const labels = {
      planRequest: 'สมัครแผน',
      contactMessage: 'ข้อความติดต่อ',
      teamInvite: 'เชิญทีม',
      planApproved: 'อนุมัติแผน',
      planRejected: 'ปฏิเสธแผน',
      admin_notification: 'แจ้งเตือนระบบ'
    };
    return labels[eventKey] || eventKey;
  }

  function fmtStatus(item) {
    if (item.sent) return { text: 'ส่งแล้ว', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (item.migratedFrom) return { text: 'ย้ายจากข้อมูลเก่า', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { text: 'ยังไม่ส่ง', cls: 'bg-rose-100 text-rose-700 border-rose-200' };
  }

  function fmtMode(mode) {
    const labels = { instant: 'ทันที', daily: 'สรุปประจำวัน' };
    return labels[mode] || mode;
  }

  // ─── OPEN ADMIN MAIL LOG MODAL ───
  window.openAdminMailLog = async function () {
    if (!isAdminSession()) {
      alertBox('ไม่มีสิทธิ์', 'เมนูนี้เปิดได้เฉพาะแอดมิน', true);
      return;
    }
    const modal = ensureMailLogModal();
    modal.classList.remove('hidden');
    await loadMailLogData();
  };

  function ensureMailLogModal() {
    if ($('admin-mail-log-modal')) return $('admin-mail-log-modal');

    const wrap = document.createElement('div');
    wrap.id = 'admin-mail-log-modal';
    wrap.className = 'fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[2147483647] hidden flex items-center justify-center p-4 fade-in';
    wrap.innerHTML = `
      <div class="bg-white rounded-[1.75rem] w-full max-w-5xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        <!-- Header -->
        <div class="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center shrink-0">
          <div>
            <h3 class="text-xl font-black text-slate-900"><i class="fas fa-envelope-open-text text-primary mr-2"></i>ประวัติการส่งอีเมลแอดมิน</h3>
            <p class="text-xs text-slate-500 mt-1">แสดงรายการส่งเมลทั้งหมด (แผน / ข้อความติดต่อ) จากคอลเลคชั่น admin_mail_log</p>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" id="mail-log-run-migration-btn" class="bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200 font-black px-4 py-2.5 rounded-xl text-sm"><i class="fas fa-database mr-1"></i> ดึงข้อมูลเก่า</button>
            <button type="button" id="mail-log-close-btn" class="w-10 h-10 rounded-xl bg-white text-slate-500 hover:text-rose-500 border shrink-0"><i class="fas fa-times"></i></button>
          </div>
        </div>

        <!-- Stats Bar -->
        <div class="px-5 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
          <div class="flex flex-wrap items-center gap-4 text-sm">
            <div class="flex items-center gap-1.5"><i class="fas fa-layer-group text-sky-500"></i><span class="font-bold text-slate-700">สมัครแผน:</span><span id="mail-log-count-plan" class="font-black text-primary">—</span></div>
            <div class="flex items-center gap-1.5"><i class="fas fa-headset text-emerald-500"></i><span class="font-bold text-slate-700">ข้อความติดต่อ:</span><span id="mail-log-count-contact" class="font-black text-primary">—</span></div>
            <div class="flex items-center gap-1.5"><i class="fas fa-check-circle text-emerald-500"></i><span class="font-bold text-slate-700">ส่งแล้ว:</span><span id="mail-log-count-sent" class="font-black text-emerald-600">—</span></div>
            <div class="flex items-center gap-1.5"><i class="fas fa-clock text-amber-500"></i><span class="font-bold text-slate-700">ยังไม่ส่ง:</span><span id="mail-log-count-pending" class="font-black text-amber-600">—</span></div>
            <div class="flex items-center gap-1.5"><i class="fas fa-history text-purple-500"></i><span class="font-bold text-slate-700">จากข้อมูลเก่า:</span><span id="mail-log-count-migrated" class="font-black text-purple-600">—</span></div>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="px-5 py-3 bg-white border-b border-slate-100 shrink-0 flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2 flex-1 min-w-[200px]">
            <i class="fas fa-search text-slate-400"></i>
            <input id="mail-log-search-input" type="text" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-indigo-100 focus:border-primary" placeholder="ค้นหาชื่อ อีเมล หัวข้อ...">
          </div>
          <select id="mail-log-filter-event" class="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-indigo-100 focus:border-primary">
            <option value="">ทุกประเภท</option>
            <option value="planRequest">สมัครแผน</option>
            <option value="contactMessage">ข้อความติดต่อ</option>
          </select>
          <select id="mail-log-filter-status" class="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-indigo-100 focus:border-primary">
            <option value="">ทุกสถานะ</option>
            <option value="sent">ส่งแล้ว</option>
            <option value="pending">ยังไม่ส่ง</option>
            <option value="migrated">ย้ายจากข้อมูลเก่า</option>
          </select>
          <select id="mail-log-filter-mode" class="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-indigo-100 focus:border-primary">
            <option value="">ทุกโหมด</option>
            <option value="instant">ส่งทันที</option>
            <option value="daily">สรุปประจำวัน</option>
          </select>
          <button type="button" id="mail-log-refresh-btn" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black px-4 py-2 rounded-xl text-sm"><i class="fas fa-sync-alt"></i></button>
        </div>

        <!-- Table Container -->
        <div class="overflow-x-auto overflow-y-auto flex-1 min-h-0">
          <table class="w-full text-sm" id="mail-log-table">
            <thead class="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th class="text-left px-4 py-3 font-black text-slate-700 text-xs uppercase tracking-wider">#</th>
                <th class="text-left px-4 py-3 font-black text-slate-700 text-xs uppercase tracking-wider">ประเภท</th>
                <th class="text-left px-4 py-3 font-black text-slate-700 text-xs uppercase tracking-wider">หัวข้อ / รายละเอียด</th>
                <th class="text-left px-4 py-3 font-black text-slate-700 text-xs uppercase tracking-wider">ผู้ส่ง</th>
                <th class="text-left px-4 py-3 font-black text-slate-700 text-xs uppercase tracking-wider">อีเมล</th>
                <th class="text-left px-4 py-3 font-black text-slate-700 text-xs uppercase tracking-wider">โหมด</th>
                <th class="text-left px-4 py-3 font-black text-slate-700 text-xs uppercase tracking-wider">สถานะ</th>
                <th class="text-left px-4 py-3 font-black text-slate-700 text-xs uppercase tracking-wider">เวลาสร้าง</th>
                <th class="text-left px-4 py-3 font-black text-slate-700 text-xs uppercase tracking-wider">เวลาส่ง</th>
              </tr>
            </thead>
            <tbody id="mail-log-table-body">
              <tr><td colspan="9" class="text-center text-slate-400 py-10"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลดข้อมูล...</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 shrink-0 flex justify-between items-center">
          <div class="text-xs text-slate-500" id="mail-log-footer-info">—</div>
          <div class="flex gap-2">
            <button type="button" id="mail-log-export-btn" class="bg-indigo-50 hover:bg-indigo-100 text-primary font-black px-4 py-2 rounded-xl text-xs"><i class="fas fa-download mr-1"></i> ส่งออก CSV</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    // Bind events
    $('mail-log-close-btn').addEventListener('click', () => wrap.classList.add('hidden'));
    wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.classList.add('hidden'); });
    $('mail-log-search-input').addEventListener('input', debounceFilter);
    $('mail-log-filter-event').addEventListener('change', debounceFilter);
    $('mail-log-filter-status').addEventListener('change', debounceFilter);
    $('mail-log-filter-mode').addEventListener('change', debounceFilter);
    $('mail-log-refresh-btn').addEventListener('click', () => loadMailLogData());
    $('mail-log-export-btn').addEventListener('click', exportCSV);
    $('mail-log-run-migration-btn').addEventListener('click', () => {
      wrap.classList.add('hidden');
      if (typeof window.runAdminMailLogMigration === 'function') {
        window.runAdminMailLogMigration();
      } else {
        alertBox('ยังไม่พร้อม', 'กรุณารอ migration script โหลดก่อน แล้วลองใหม่อีกครั้ง', true);
      }
    });

    return wrap;
  }

  // ─── DATA LOADING ───
  let allMailLogItems = [];

  async function loadMailLogData() {
    const body = $('mail-log-table-body');
    if (!body) return;
    body.innerHTML = `<tr><td colspan="9" class="text-center text-slate-400 py-10"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลดข้อมูล...</td></tr>`;

    try {
      const snap = await getDocs(collection(db, 'admin_mail_log'));
      const items = [];
      snap.forEach(d => {
        items.push({ id: d.id, ...d.data() });
      });
      // Sort by createdAt descending
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      allMailLogItems = items;
      renderTable();
    } catch (e) {
      console.error('โหลด admin_mail_log ไม่สำเร็จ', e);
      body.innerHTML = `<tr><td colspan="9" class="text-center text-rose-500 py-10 font-bold"><i class="fas fa-exclamation-triangle mr-2"></i>โหลดข้อมูลไม่สำเร็จ: ${esc(e?.message || String(e))}</td></tr>`;
    }
  }

  // ─── RENDER TABLE ───
  let filterTimer = null;
  function debounceFilter() {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => renderTable(), 200);
  }

  function getFilters() {
    return {
      search: norm($('mail-log-search-input')?.value || '').toLowerCase(),
      event: $('mail-log-filter-event')?.value || '',
      status: $('mail-log-filter-status')?.value || '',
      mode: $('mail-log-filter-mode')?.value || ''
    };
  }

  function renderTable() {
    const body = $('mail-log-table-body');
    if (!body) return;

    const f = getFilters();
    let filtered = allMailLogItems;

    // Filter by search
    if (f.search) {
      filtered = filtered.filter(it =>
        (it.title || '').toLowerCase().includes(f.search) ||
        (it.detail || '').toLowerCase().includes(f.search) ||
        (it.userEmail || '').toLowerCase().includes(f.search) ||
        (it.userName || '').toLowerCase().includes(f.search) ||
        (it.logId || '').toLowerCase().includes(f.search)
      );
    }

    // Filter by event type
    if (f.event) {
      filtered = filtered.filter(it => it.eventKey === f.event);
    }

    // Filter by status
    if (f.status === 'sent') {
      filtered = filtered.filter(it => it.sent);
    } else if (f.status === 'pending') {
      filtered = filtered.filter(it => !it.sent);
    } else if (f.status === 'migrated') {
      filtered = filtered.filter(it => it.migratedFrom);
    }

    // Filter by mode
    if (f.mode) {
      filtered = filtered.filter(it => it.mode === f.mode);
    }

    // Stats
    const total = allMailLogItems.length;
    const planCount = allMailLogItems.filter(it => it.eventKey === 'planRequest').length;
    const contactCount = allMailLogItems.filter(it => it.eventKey === 'contactMessage').length;
    const sentCount = allMailLogItems.filter(it => it.sent).length;
    const pendingCount = allMailLogItems.filter(it => !it.sent).length;
    const migratedCount = allMailLogItems.filter(it => it.migratedFrom).length;

    $('mail-log-count-plan').textContent = planCount;
    $('mail-log-count-contact').textContent = contactCount;
    $('mail-log-count-sent').textContent = sentCount;
    $('mail-log-count-pending').textContent = pendingCount;
    $('mail-log-count-migrated').textContent = migratedCount;
    $('mail-log-footer-info').textContent = `แสดง ${filtered.length} จากทั้งหมด ${total} รายการ`;

    // Render rows
    if (!filtered.length) {
      body.innerHTML = `<tr><td colspan="9" class="text-center text-slate-400 py-10"><i class="fas fa-inbox mr-2"></i>ไม่มีรายการ</td></tr>`;
      return;
    }

    body.innerHTML = filtered.map((it, idx) => {
      const status = fmtStatus(it);
      return `<tr class="border-b border-slate-100 hover:bg-slate-50 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}">
        <td class="px-4 py-3 text-slate-400 text-xs font-mono">${idx + 1}</td>
        <td class="px-4 py-3"><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${it.eventKey === 'planRequest' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}"><i class="fas ${it.eventKey === 'planRequest' ? 'fa-layer-group' : 'fa-headset'}"></i> ${esc(fmtEventLabel(it.eventKey))}</span></td>
        <td class="px-4 py-3 max-w-[250px]"><div class="text-xs font-bold text-slate-800 truncate" title="${esc(it.title || '')}">${esc(it.title || '—')}</div>${it.detail ? `<div class="text-[11px] text-slate-400 mt-0.5 line-clamp-2" title="${esc(it.detail)}">${esc(it.detail).slice(0, 100)}</div>` : ''}</td>
        <td class="px-4 py-3 text-xs text-slate-600">${esc(it.userName || it.userEmail || '—')}</td>
        <td class="px-4 py-3 text-xs text-slate-500 font-mono">${esc(it.userEmail || '—')}</td>
        <td class="px-4 py-3"><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${it.mode === 'instant' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}">${esc(fmtMode(it.mode))}</span></td>
        <td class="px-4 py-3"><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${status.cls}">${status.text}</span></td>
        <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${fmtDate(it.createdAt)}</td>
        <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${it.sent ? fmtDate(it.sentAt) : '—'}</td>
      </tr>`;
    }).join('');
  }

  // ─── EXPORT CSV ───
  function exportCSV() {
    const f = getFilters();
    let data = allMailLogItems;
    if (f.search) data = data.filter(it => (it.title || '').toLowerCase().includes(f.search) || (it.userEmail || '').toLowerCase().includes(f.search) || (it.userName || '').toLowerCase().includes(f.search));
    if (f.event) data = data.filter(it => it.eventKey === f.event);
    if (f.status === 'sent') data = data.filter(it => it.sent);
    else if (f.status === 'pending') data = data.filter(it => !it.sent);
    else if (f.status === 'migrated') data = data.filter(it => it.migratedFrom);
    if (f.mode) data = data.filter(it => it.mode === f.mode);

    const headers = ['#', 'ประเภท', 'หัวข้อ', 'รายละเอียด', 'ชื่อผู้ส่ง', 'อีเมลผู้ส่ง', 'โหมด', 'สถานะ', 'เวลาสร้าง', 'เวลาส่ง'];
    const rows = data.map((it, idx) => [
      idx + 1,
      fmtEventLabel(it.eventKey),
      it.title || '',
      (it.detail || '').replace(/\n/g, ' '),
      it.userName || '',
      it.userEmail || '',
      fmtMode(it.mode),
      it.sent ? 'ส่งแล้ว' : (it.migratedFrom ? 'ย้ายจากข้อมูลเก่า' : 'ยังไม่ส่ง'),
      it.createdAt ? fmtDate(it.createdAt) : '',
      it.sentAt ? fmtDate(it.sentAt) : ''
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin_mail_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    alertBox('ส่งออกแล้ว', `ส่งออก CSV เรียบร้อย (${data.length} รายการ)`);
  }

})();
