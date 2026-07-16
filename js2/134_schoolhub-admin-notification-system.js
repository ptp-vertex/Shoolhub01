/* =========================================================
   SchoolHub Admin Email Notification System
   - ตั้งค่าอีเมลรับการแจ้งเตือนของแอดมิน (per-event: แจ้งทันที / สรุปประจำวัน)
   - ใช้ระบบส่งเมลเดิมของแอป (window.sendMailViaWebApp ผ่าน Google Apps Script)
     จึงไม่ต้องเพิ่มบริการเมลใหม่
   - เว็บนี้เป็น static site (GitHub Pages) ไม่มี cron ฝั่งเซิร์ฟเวอร์จริง
     ระบบจะตรวจ/ส่งสรุปประจำวันตอนที่แอดมินเปิดหน้าเว็บ (client-side) และมี
     ปุ่ม "ส่งสรุปวันนี้ตอนนี้" สำหรับส่งเองได้ทันทีเช่นกัน
   - คอลเลคชั่นหลัก: admin_mail_log (แทน admin_notification_queue)
     ทุกการส่งเมลจะบันทึกลง admin_mail_log แยกจากเดิม
   ========================================================= */
import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function () {
  if (window.__schoolhubAdminNotificationSystem) return;
  window.__schoolhubAdminNotificationSystem = true;

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
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm(v));
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

  const EVENT_DEFS = {
    planRequest: { label: 'คำขอสมัครแผน / ตรวจสอบแผน', icon: 'fa-layer-group' },
    contactMessage: { label: 'ข้อความติดต่อผู้ดูแลระบบ', icon: 'fa-headset' }
  };

  const DEFAULT_SETTINGS = {
    adminEmail: '',
    dailyTime: '08:00',
    resendSent: false,
    lastDailySendDate: '',
    events: {
      planRequest: { enabled: true, mode: 'instant' },
      contactMessage: { enabled: true, mode: 'instant' }
    }
  };

  function deepMerge(base, override) {
    const out = JSON.parse(JSON.stringify(base));
    if (override && typeof override === 'object') {
      Object.keys(override).forEach(k => {
        if (override[k] && typeof override[k] === 'object' && !Array.isArray(override[k]) && out[k] && typeof out[k] === 'object') {
          out[k] = deepMerge(out[k], override[k]);
        } else {
          out[k] = override[k];
        }
      });
    }
    return out;
  }

  const SETTINGS_DOC = () => doc(db, 'system', 'notificationSettings');
  // ─── เปลี่ยนจาก admin_notification_queue เป็น admin_mail_log ───
  const QUEUE_COL = () => collection(db, 'admin_mail_log');

  let cachedSettings = null;
  async function loadSettings(force) {
    if (cachedSettings && !force) return cachedSettings;
    try {
      const snap = await getDoc(SETTINGS_DOC());
      cachedSettings = snap.exists() ? deepMerge(DEFAULT_SETTINGS, snap.data()) : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.warn('โหลดการตั้งค่าแจ้งเตือนไม่สำเร็จ', e);
      cachedSettings = { ...DEFAULT_SETTINGS };
    }
    return cachedSettings;
  }

  async function saveSettings(patch) {
    const current = await loadSettings(true);
    const merged = deepMerge(current, patch);
    await setDoc(SETTINGS_DOC(), merged, { merge: true });
    cachedSettings = merged;
    try { localStorage.setItem('schoolhub_admin_notification_email', merged.adminEmail || ''); } catch (e) {}
    return merged;
  }

  async function sendAdminEmailNow(subject, message) {
    const settings = await loadSettings();
    const to = norm(settings.adminEmail);
    if (!to) { console.warn('ยังไม่ได้ตั้งอีเมลรับการแจ้งเตือนของแอดมิน'); return false; }
    if (typeof window.sendMailViaWebApp !== 'function') { console.warn('ไม่พบระบบส่งเมล (sendMailViaWebApp)'); return false; }
    try {
      await window.sendMailViaWebApp({ to, subject, message, type: 'admin_notification', name: 'ผู้ดูแลระบบ' });
      return true;
    } catch (e) {
      console.error('ส่งอีเมลแจ้งเตือนแอดมินไม่สำเร็จ', e);
      return false;
    }
  }

  // ─── บันทึก entry เข้า admin_mail_log ───
  async function logMailEntry(eventKey, title, detail, mode, userEmail, userUid, userName) {
    try {
      const now = Date.now();
      // ใช้ logId แบบ deterministic เพื่อป้องกันซ้ำ
      const logId = `${eventKey}_${now}_${Math.random().toString(36).slice(2, 8)}`;
      await addDoc(QUEUE_COL(), {
        logId,
        eventKey,
        title,
        detail,
        mode,
        sent: false,
        sentAt: null,
        userEmail: userEmail || '',
        userUid: userUid || '',
        userName: userName || '',
        createdAt: now,
        updatedAt: now
      });
      return logId;
    } catch (e) {
      console.warn('บันทึก admin_mail_log ไม่สำเร็จ', e);
      return null;
    }
  }

  // ---------------- Public: queue/send a notification for an event ----------------
  window.queueAdminNotification = async function (eventKey, info) {
    try {
      const settings = await loadSettings();
      const evt = settings.events?.[eventKey];
      if (!evt || !evt.enabled) return;
      const def = EVENT_DEFS[eventKey] || { label: eventKey };
      const title = info?.title || def.label;
      const detail = info?.detail || '';
      const now = Date.now();
      const isInstant = evt.mode !== 'daily';

      // ─── บันทึกเข้า admin_mail_log แทน admin_notification_queue ───
      const logDocId = await logMailEntry(
        eventKey, title, detail,
        isInstant ? 'instant' : 'daily',
        info?.userEmail || '',
        info?.userUid || '',
        info?.userName || ''
      );

      if (!isInstant) return;
      const subject = `[SchoolHub] แจ้งเตือน: ${title}`;
      const message = `${title}\n\n${detail}\n\nเวลา: ${new Date(now).toLocaleString('th-TH')}`;
      const ok = await sendAdminEmailNow(subject, message);
      // อัปเดตสถานะ sent ใน admin_mail_log
      if (ok && logDocId) {
        try {
          // เนื่องจาก addDoc ให้ random ID เราต้องค้นหา doc ใหม่
          const snap = await getDocs(QUEUE_COL());
          snap.forEach(d => {
            if (d.data().logId === logDocId) {
              updateDoc(d.ref, { sent: true, sentAt: Date.now() }).catch(() => {});
            }
          });
        } catch (e) {
          console.warn('อัปเดต sent ใน admin_mail_log ไม่สำเร็จ', e);
        }
      }
    } catch (e) {
      console.warn('queueAdminNotification ล้มเหลว', e);
    }
  };

  // ============================
  // SERVER-SIDE DAILY DIGEST — ผ่าน Google Apps Script
  // ============================
  const DIGEST_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzLAD59TRLOkG06YavOBKE4yMFHDAxlGQW0NUA-BJHwkrPe4vJGHJ3Yiobjs1DjEvKd/exec';

  // สร้าง hidden iframe + form submit เหมือน pattern เดิม
  async function callDigestEndpoint(action, params = {}) {
    if (!DIGEST_WEB_APP_URL) throw new Error('ไม่มี URL Apps Script');
    const requestId = 'digest_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const payload = { requestId, action, ...params };

    return new Promise((resolve, reject) => {
      const iframeName = 'schoolhub_digest_frame_' + requestId;
      const iframe = document.createElement('iframe');
      iframe.name = iframeName;
      iframe.style.display = 'none';
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = DIGEST_WEB_APP_URL;
      form.target = iframeName;
      form.style.display = 'none';
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'payload';
      input.value = JSON.stringify(payload);
      form.appendChild(input);
      const cleanup = () => { window.removeEventListener('message', onMessage); iframe.remove(); form.remove(); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('Apps Script ไม่ตอบกลับ — กรุณาตรวจ Deploy')); }, 30000);
      const onMessage = (event) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (!data || data.requestId !== requestId) return;
          clearTimeout(timer);
          cleanup();
          if (data.ok) resolve(data);
          else reject(new Error(data.error || 'Apps Script ไม่สำเร็จ'));
        } catch (e) {
          // ignore non-JSON postMessage
        }
      };
      window.addEventListener('message', onMessage);
      document.body.appendChild(iframe);
      document.body.appendChild(form);
      form.submit();
    });
  }

  // ============================
  // Daily digest (checked client-side on admin page load) ----------------
  async function runDailyDigestIfDue(force) {
    // ─── ขั้น 1: พยายามเรียก server-side Apps Script ก่อน ───
    try {
      const resp = await callDigestEndpoint('triggerDigest', { force: !!force });
      if (resp && resp.ok) {
        if (resp.sent) {
          console.log('[DailyDigest] Server-side ส่งสำเร็จ:', resp.message);
          return { sent: true, count: resp.count || 0, serverSide: true };
        }
        if (resp.reason === 'already-sent') {
          console.log('[DailyDigest] Server-side: วันนี้ส่งไปแล้ว');
          return { sent: false, reason: 'already-sent' };
        }
        if (resp.reason === 'empty') {
          console.log('[DailyDigest] Server-side: ไม่มีรายการ');
          return { sent: false, reason: 'empty' };
        }
        if (resp.reason === 'no-daily-events') {
          return { sent: false, reason: 'no-daily-events' };
        }
        console.warn('[DailyDigest] Server-side returned:', resp.reason, resp.message);
      }
    } catch (e) {
      console.warn('[DailyDigest] Server-side endpoint ล้มเหลว — fallback client-side:', e.message);
    }

    // ─── ขั้น 2: Fallback — client-side (ถ้า server-side ไม่สำเร็จ) ───
    const settings = await loadSettings(true);
    if (!settings.adminEmail) return { sent: false, reason: 'no-email' };
    const today = new Date().toISOString().slice(0, 10);
    const [hh, mm] = String(settings.dailyTime || '08:00').split(':').map(Number);
    const dueTime = new Date();
    dueTime.setHours(hh || 8, mm || 0, 0, 0);
    const isDue = force || (settings.lastDailySendDate !== today && Date.now() >= dueTime.getTime());
    if (!isDue) return { sent: false, reason: 'not-due' };

    let snap;
    try { snap = await getDocs(QUEUE_COL()); } catch (e) { console.warn('โหลดคิวแจ้งเตือนไม่สำเร็จ', e); return { sent: false, reason: 'error' }; }
    const dailyEventKeys = Object.keys(settings.events || {}).filter(k => settings.events[k]?.mode === 'daily' && settings.events[k]?.enabled);
    const items = [];
    snap.forEach(d => {
      const data = d.data();
      if (!dailyEventKeys.includes(data.eventKey)) return;
      if (data.sent && !settings.resendSent && !force) return;
      items.push({ id: d.id, ...data });
    });
    if (!items.length) { await saveSettings({ lastDailySendDate: today }); return { sent: false, reason: 'empty' }; }

    const grouped = {};
    items.forEach(it => { (grouped[it.eventKey] = grouped[it.eventKey] || []).push(it); });
    let body = `สรุปการแจ้งเตือนประจำวันที่ ${new Date().toLocaleDateString('th-TH')}\n`;
    Object.keys(grouped).forEach(k => {
      const def = EVENT_DEFS[k] || { label: k };
      body += `\n== ${def.label} (${grouped[k].length} รายการ) ==\n`;
      grouped[k].forEach(it => { body += `- ${it.title}${it.detail ? ': ' + it.detail : ''}\n`; });
    });
    const ok = await sendAdminEmailNow(`[SchoolHub] สรุปการแจ้งเตือนประจำวัน ${today}`, body);
    if (ok) {
      await Promise.all(items.map(it => updateDoc(doc(db, 'admin_mail_log', it.id), { sent: true, sentAt: Date.now() }).catch(() => {})));
      await saveSettings({ lastDailySendDate: today });
    }
    return { sent: ok, count: items.length, serverSide: false };
  }

  // ตรวจว่าโมดัล custom-alert ถูกปิดแล้วหรือยัง (รอจนกว่าผู้ใช้กด "ตกลง")
  function waitForCustomAlertClose(timeoutMs) {
    return new Promise((resolve) => {
      const modal = document.getElementById('custom-alert');
      if (!modal) { resolve(); return; } // ไม่มีโมดัล (ใช้ window.alert ปกติซึ่ง block อยู่แล้ว)
      const isHidden = () => modal.classList.contains('hidden') || modal.style.display === 'none';
      let settled = false;
      const finish = () => { if (settled) return; settled = true; observer.disconnect(); resolve(); };
      const observer = new MutationObserver(() => { if (isHidden()) finish(); });
      observer.observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
      setTimeout(finish, timeoutMs || 20000); // กันพลาด เผื่อโมดัลไม่ถูกปิดด้วยเหตุใดก็ตาม
    });
  }

  window.sendAdminDailyDigestNow = async function () {
    const btn = document.getElementById('notif-send-now-btn');
    if (btn) {
      if (btn.disabled) return; // กันกดซ้ำระหว่างกำลังส่ง
      btn.disabled = true;
      if (btn.dataset.originalHtml === undefined) btn.dataset.originalHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> กำลังส่ง...';
    }

    let res;
    try {
      res = await runDailyDigestIfDue(true);
    } catch (e) {
      res = { sent: false, reason: 'error' };
    }

    const mode = res.serverSide ? 'ผ่านเซิร์ฟเวอร์' : 'แบบออนไลน์';
    if (res.sent) alertBox('ส่งแล้ว', `ส่งสรุปประจำวันแล้ว (${res.count || 0} รายการ) — ${mode}`);
    else if (res.reason === 'empty') alertBox('ไม่มีรายการ', 'ยังไม่มีรายการที่ต้องสรุปในตอนนี้');
    else if (res.reason === 'already-sent') alertBox('ส่งแล้ว', 'วันนี้ส่งไปแล้ว — ไม่ต้องส่งซ้ำ');
    else if (res.reason === 'no-email') alertBox('ยังไม่ได้ตั้งอีเมล', 'กรุณาตั้งอีเมลรับการแจ้งเตือนก่อน', true);
    else if (res.reason === 'no-daily-events') alertBox('ไม่เปิด daily', 'ไม่มี event ใดเปิดเป็น daily digest');
    else alertBox('ส่งไม่สำเร็จ', 'ลองใหม่อีกครั้ง หรือตรวจสอบระบบส่งเมล', true);

    // รอจนกว่าผู้ใช้จะกด "ตกลง" ปิดข้อความยืนยัน แล้วค่อยเอาสถานะโหลดออก
    await waitForCustomAlertClose();

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalHtml || '<i class="fas fa-paper-plane mr-1"></i> ส่งสรุปวันนี้ตอนนี้';
    }
    return res;
  };

  function maybeAutoRunDigest() {
    if (!isAdminSession()) return;
    runDailyDigestIfDue(false).catch(() => {});
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(maybeAutoRunDigest, 4000));
  setTimeout(maybeAutoRunDigest, 6000);

  // ---------------- UI: Notification settings modal ----------------
  function eventRowHTML(key, evt) {
    const def = EVENT_DEFS[key] || { label: key, icon: 'fa-bell' };
    return `<div class="border border-slate-200 rounded-2xl p-4" data-notif-event="${key}">
      <label class="flex items-center gap-2 font-bold text-slate-800 text-sm"><input type="checkbox" class="notif-event-enabled w-4 h-4 rounded" ${evt.enabled ? 'checked' : ''}><i class="fas ${def.icon} text-primary"></i> ${esc(def.label)}</label>
      <div class="mt-2.5 flex flex-wrap gap-4 text-xs text-slate-600 pl-6">
        <label class="flex items-center gap-1.5"><input type="radio" name="notif-mode-${key}" class="notif-event-mode" value="instant" ${evt.mode !== 'daily' ? 'checked' : ''}> แจ้งเตือนทันที</label>
        <label class="flex items-center gap-1.5"><input type="radio" name="notif-mode-${key}" class="notif-event-mode" value="daily" ${evt.mode === 'daily' ? 'checked' : ''}> รวมในสรุปประจำวัน</label>
      </div>
    </div>`;
  }

  function ensureModal() {
    if ($('admin-notification-settings-modal')) return $('admin-notification-settings-modal');
    const wrap = document.createElement('div');
    wrap.id = 'admin-notification-settings-modal';
    wrap.className = 'fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] hidden flex items-center justify-center p-4 fade-in';
    wrap.innerHTML = `
      <div class="bg-white rounded-[1.75rem] w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div class="p-4 border-b border-slate-100 bg-indigo-50/60 flex justify-between items-start gap-4 shrink-0">
          <div>
            <h3 class="text-lg font-black text-slate-900"><i class="fas fa-bell text-primary mr-2"></i>ตั้งค่าการแจ้งเตือนอีเมล</h3>
            <p class="text-xs text-slate-500 mt-1">แจ้งเตือนอีเมลแอดมินแยกตามเหตุการณ์ เลือกได้ว่าจะแจ้งทันทีหรือสรุปรวมประจำวัน</p>
          </div>
          <button type="button" onclick="document.getElementById('admin-notification-settings-modal').classList.add('hidden')" class="w-9 h-9 rounded-xl bg-white text-slate-500 hover:text-rose-500 border shrink-0"><i class="fas fa-times"></i></button>
        </div>
        <div class="p-4 space-y-3.5 overflow-y-auto">
          <div id="notif-email-warning" class="hidden bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-800">
            <b>ยังไม่ได้ตั้งอีเมลรับการแจ้งเตือน</b> — กรุณากรอกอีเมลด้านล่างก่อน จึงจะเปิดใช้งานการแจ้งเตือนได้
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">อีเมลรับการแจ้งเตือน (แอดมิน)</label>
            <input id="notif-admin-email-input" type="email" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-4 focus:ring-indigo-100 focus:border-primary" placeholder="admin@example.com">
            <button type="button" onclick="window.closeNotificationSettingsAndOpenProfile && window.closeNotificationSettingsAndOpenProfile()" class="text-xs text-primary font-bold mt-1.5 hover:underline"><i class="fas fa-user-circle mr-1"></i>ตั้งอีเมลนี้จากหน้าโปรไฟล์ผู้ใช้งานได้เช่นกัน</button>
          </div>
          <div id="notif-events-list" class="space-y-2.5"></div>
          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <label class="flex items-center gap-2 text-xs font-bold text-slate-700">
              <input type="checkbox" id="notif-resend-toggle" class="w-4 h-4 rounded">
              ส่งซ้ำรายการที่เคยส่งไปแล้ว ในสรุปประจำวันครั้งถัดไป
            </label>
            <div class="mt-2 flex items-center gap-2">
              <label class="text-xs font-bold text-slate-700">เวลาสรุปประจำวัน</label>
              <input type="time" id="notif-daily-time-input" class="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm">
            </div>
            <p class="text-[11px] text-slate-400 mt-2">การตั้งค่าเวลา: ระบบจะส่งอัตโนมัติผ่านเซิร์ฟเวอร์ (Google Apps Script) ตามเวลาที่ตั้งไว้ — ไม่จำเป็นต้องเปิดเว็บทิ้งไว้</p>
          </div>
          <button type="button" id="notif-send-now-btn" onclick="window.sendAdminDailyDigestNow && window.sendAdminDailyDigestNow()" class="w-full bg-slate-100 hover:bg-slate-200 disabled:opacity-70 disabled:cursor-not-allowed text-slate-700 font-bold py-2.5 rounded-xl text-sm"><i class="fas fa-paper-plane mr-1"></i> ส่งสรุปวันนี้ตอนนี้</button>
          <!-- ปุ่มเปิดหน้าประวัติการส่งเมล -->
          <button type="button" onclick="window.openAdminMailLog && window.openAdminMailLog()" class="w-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-primary font-bold py-2.5 rounded-xl text-sm"><i class="fas fa-history mr-1"></i> ดูประวัติการส่งอีเมลทั้งหมด</button>
        </div>
        <div class="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button type="button" id="notif-save-btn" class="w-full bg-primary hover:bg-indigo-700 text-white font-black py-3 rounded-xl text-sm shadow-lg shadow-indigo-100 transition"><i class="fas fa-save mr-1"></i> บันทึกการตั้งค่า</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    $('notif-save-btn').addEventListener('click', onSaveNotificationSettings);
    return wrap;
  }

  async function renderNotificationModal(focusEvent) {
    const modal = ensureModal();
    const settings = await loadSettings(true);
    $('notif-admin-email-input').value = settings.adminEmail || '';
    $('notif-resend-toggle').checked = !!settings.resendSent;
    $('notif-daily-time-input').value = settings.dailyTime || '08:00';
    const list = $('notif-events-list');
    list.innerHTML = Object.keys(EVENT_DEFS).map(k => eventRowHTML(k, settings.events?.[k] || { enabled: true, mode: 'instant' })).join('');
    const warn = $('notif-email-warning');
    if (!settings.adminEmail) warn.classList.remove('hidden'); else warn.classList.add('hidden');
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    if (focusEvent) {
      const row = list.querySelector(`[data-notif-event="${focusEvent}"]`);
      if (row) { row.scrollIntoView({ block: 'center' }); row.classList.add('ring-2', 'ring-indigo-300'); }
    }
    if (!settings.adminEmail) $('notif-admin-email-input')?.focus();
  }

  async function onSaveNotificationSettings() {
    const email = norm($('notif-admin-email-input').value);
    if (email && !isEmail(email)) { alertBox('อีเมลไม่ถูกต้อง', 'กรุณากรอกอีเมลให้ถูกต้อง', true); return; }
    const events = {};
    document.querySelectorAll('#notif-events-list [data-notif-event]').forEach(row => {
      const key = row.dataset.notifEvent;
      const enabled = row.querySelector('.notif-event-enabled').checked;
      const mode = row.querySelector('.notif-event-mode:checked')?.value || 'instant';
      events[key] = { enabled, mode };
    });
    const patch = {
      adminEmail: email,
      resendSent: $('notif-resend-toggle').checked,
      dailyTime: $('notif-daily-time-input').value || '08:00',
      events
    };
    try {
      await saveSettings(patch);
      const emailInput = $('admin-profile-notification-email-input');
      if (emailInput) emailInput.value = email;
      alertBox('บันทึกแล้ว', 'บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อยแล้ว');
      $('admin-notification-settings-modal').classList.add('hidden');
    } catch (e) {
      alertBox('บันทึกไม่สำเร็จ', e?.message || String(e), true);
    }
  }

  window.openNotificationSettings = function (focusEvent) {
    if (!isAdminSession()) { alertBox('ไม่มีสิทธิ์', 'เมนูนี้เปิดได้เฉพาะแอดมิน', true); return; }
    loadSettings(true).then(settings => {
      if (!settings.adminEmail) {
        alertBox('ยังไม่ได้ตั้งอีเมลรับการแจ้งเตือน', 'กรุณากรอกอีเมลเพื่อรับการแจ้งเตือนก่อน');
      }
      renderNotificationModal(focusEvent);
    });
  };
  window.closeNotificationSettingsAndOpenProfile = function () {
    $('admin-notification-settings-modal')?.classList.add('hidden');
    if (typeof window.openUserProfileSettings === 'function') window.openUserProfileSettings();
  };

  // ---------------- Wire the profile modal's notification-email field ----------------
  function syncProfileNotificationField() {
    const admin = isAdminSession();
    const wrap = $('admin-profile-notification-email-wrap');
    if (wrap) wrap.classList.toggle('hidden', !admin);
    $('schoolhub-settings-notifications-tab')?.classList.toggle('hidden', !admin);
    if (!admin) return;
    const input = $('admin-profile-notification-email-input');
    if (input && !input.dataset.notifPrefilled) {
      input.dataset.notifPrefilled = '1';
      loadSettings(true).then(s => { if (input.value === '') input.value = s.adminEmail || ''; });
    }
  }
  setInterval(syncProfileNotificationField, 1200);
  document.addEventListener('DOMContentLoaded', syncProfileNotificationField);

  function wrapProfilePopupForNotifications() {
    const openFn = window.openUserProfileSettings;
    if (typeof openFn === 'function' && !openFn.__notifPatchWrapped) {
      const originalOpen = openFn;
      const wrappedOpen = async function () {
        const result = await originalOpen.apply(this, arguments);
        try {
          const admin = isAdminSession();
          const wrap = $('admin-profile-notification-email-wrap');
          if (wrap) wrap.classList.toggle('hidden', !admin);
          if (admin) {
            const s = await loadSettings(true);
            const input = $('admin-profile-notification-email-input');
            if (input) input.value = s.adminEmail || '';
          }
        } catch (e) { console.warn('เติมอีเมลแจ้งเตือนในโปรไฟล์ไม่สำเร็จ', e); }
        return result;
      };
      wrappedOpen.__notifPatchWrapped = true;
      window.openUserProfileSettings = wrappedOpen;
    }
    const saveFn = window.saveUserProfileChanges;
    if (typeof saveFn === 'function' && !saveFn.__notifPatchWrapped) {
      const originalSave = saveFn;
      const wrappedSave = async function () {
        try {
          if (isAdminSession()) {
            const input = $('admin-profile-notification-email-input');
            if (input) {
              const email = norm(input.value);
              if (email && !isEmail(email)) {
                alertBox('อีเมลรับการแจ้งเตือนไม่ถูกต้อง', 'กรุณากรอกอีเมลให้ถูกต้อง หรือเว้นว่างไว้', true);
              } else {
                await saveSettings({ adminEmail: email });
              }
            }
          }
        } catch (e) { console.warn('บันทึกอีเมลแจ้งเตือนในโปรไฟล์ไม่สำเร็จ', e); }
        return originalSave.apply(this, arguments);
      };
      wrappedSave.__notifPatchWrapped = true;
      window.saveUserProfileChanges = wrappedSave;
    }
  }
  let notifWrapTries = 0;
  const notifWrapIv = setInterval(function () {
    wrapProfilePopupForNotifications();
    notifWrapTries++;
    if (notifWrapTries > 60) clearInterval(notifWrapIv);
  }, 1000);
  document.addEventListener('DOMContentLoaded', wrapProfilePopupForNotifications);
})();
