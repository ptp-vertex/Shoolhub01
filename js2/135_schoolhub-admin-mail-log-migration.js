/* =========================================================
   SchoolHub Admin Mail Log — Migration Script
   ดึงข้อมูลเก่าจาก:
     1. collection 'subscription_requests' (plan requests)
     2. collection 'admin_contact_messages' (contact messages)
   สร้างเป็นเอกสารใน collection ใหม่ 'admin_mail_log'
   
   คอลเลคชั่นนี้แยกจาก admin_notification_queue โดยสิ้นเชิง
   ทุกการส่งเมล (ทั้ง instant และ daily) จะบันทึกลงที่นี่
   
   วิธีใช้: เปิดไฟล์นี้ครั้งเดียวผ่าน browser แล้ว refresh หน้า
           หรือวางโค้ดใน console ของหน้าเว็บ admin
   ========================================================= */
import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function () {
  if (window.__schoolhubAdminMailLogMigration) return;
  window.__schoolhubAdminMailLogMigration = true;

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

  function norm(v) { return String(v || '').trim(); }
  function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch])); }

  function alertBox(title, message, danger) {
    if (typeof window.showCustomAlert === 'function') return window.showCustomAlert(title, message, !!danger);
    window.alert(`${title}\n${message || ''}`);
  }

  // ─── MAIN MIGRATION ───────────────────────────────────────
  window.runAdminMailLogMigration = async function () {
    let migratedPlan = 0;
    let migratedContact = 0;
    let errors = 0;

    try {
      // 1) ดึง subscription_requests ทั้งหมด
      console.log('[MailLog Migration] ดึง subscription_requests...');
      const planSnap = await getDocs(collection(db, 'subscription_requests'));
      for (const d of planSnap.docs) {
        try {
          const data = d.data();
          const createdAtMs = data.createdAt || data.paidAt || 0;
          const logDoc = {
            logId: `plan_${d.id}`,
            sourceCollection: 'subscription_requests',
            sourceDocId: d.id,
            eventKey: 'planRequest',
            title: `คำขอสมัครแผน: ${data.planName || data.planId || ''}`,
            detail: [
              data.status ? `สถานะ: ${data.status}` : '',
              data.name || data.userKey || data.email || '',
              data.email || '',
              data.planName || '',
              data.planPrice || '',
              data.planBillingCycle || '',
              data.payerName || '',
              data.paymentTime || data.paidAt ? `ชำระเงิน: ${data.paymentTime || data.paidAt}` : '',
              data.autoApproved ? 'อนุมัติอัตโนมัติ' : '',
              data.adminStatusNote || ''
            ].filter(Boolean).join('\n'),
            userEmail: data.email || data.userKey || '',
            userUid: data.uid || '',
            userName: data.name || data.userKey || '',
            mode: 'instant',
            sent: data.status === 'approved',
            sentAt: data.status === 'approved' ? (data.approvedAt || data.updatedAt || createdAtMs) : null,
            createdAt: createdAtMs,
            migratedFrom: 'subscription_requests',
            migratedAt: Date.now()
          };
          await setDoc(doc(db, 'admin_mail_log', `plan_${d.id}`), logDoc, { merge: true });
          migratedPlan++;
        } catch (e) {
          console.warn(`[MailLog Migration] แผน ${d.id} ผิดพลาด`, e);
          errors++;
        }
      }

      // 2) ดึง admin_contact_messages ทั้งหมด (ทั้ง root และ users/admin sub-collection)
      console.log('[MailLog Migration] ดึง admin_contact_messages...');

      // 2a) root collection
      let contactSnap;
      try {
        contactSnap = await getDocs(collection(db, 'admin_contact_messages'));
      } catch (e) {
        console.warn('[MailLog Migration] อ่าน admin_contact_messages root ไม่สำเร็จ', e);
        contactSnap = { docs: [] };
      }
      for (const d of contactSnap.docs) {
        try {
          const data = d.data();
          const createdAtMs = data.createdAtMs || (data.createdAt?.toDate ? data.createdAt.toDate().getTime() : data.createdAt || Date.now());
          const logDoc = {
            logId: `contact_${d.id}`,
            sourceCollection: 'admin_contact_messages',
            sourceDocId: d.id,
            eventKey: 'contactMessage',
            title: `ข้อความถึงผู้ดูแลระบบ: ${data.title || '(ไม่ระบุหัวข้อ)'}`,
            detail: [
              `หัวข้อ: ${data.title || ''}`,
              data.message || '',
              `จาก: ${data.userName || data.userEmail || ''}`,
              data.contactEmail || '',
              data.status || '',
              data.adminStatusNote || ''
            ].filter(Boolean).join('\n'),
            userEmail: data.userEmail || data.contactEmail || '',
            userUid: data.userUid || data.uid || '',
            userName: data.userName || '',
            mode: 'instant',
            sent: data.status === 'ดำเนินการแล้ว' || data.status === 'อนุมัติแล้ว' || false,
            sentAt: null,
            createdAt: createdAtMs,
            migratedFrom: 'admin_contact_messages',
            migratedAt: Date.now()
          };
          await setDoc(doc(db, 'admin_mail_log', `contact_${d.id}`), logDoc, { merge: true });
          migratedContact++;
        } catch (e) {
          console.warn(`[MailLog Migration] ข้อความ ${d.id} ผิดพลาด`, e);
          errors++;
        }
      }

      // 2b) sub-collection: users/admin/admin_contact_messages
      try {
        const adminEmail = norm(localStorage.getItem('schoolhub_admin_email') || 'admin').toLowerCase() || 'admin';
        const subSnap = await getDocs(collection(db, 'users', adminEmail, 'admin_contact_messages'));
        for (const d of subSnap.docs) {
          try {
            const data = d.data();
            const createdAtMs = data.createdAtMs || (data.createdAt?.toDate ? data.createdAt.toDate().getTime() : data.createdAt || Date.now());
            const logDoc = {
              logId: `contact_sub_${d.id}`,
              sourceCollection: 'users/admin/admin_contact_messages',
              sourceDocId: d.id,
              eventKey: 'contactMessage',
              title: `ข้อความถึงผู้ดูแลระบบ: ${data.title || '(ไม่ระบุหัวข้อ)'}`,
              detail: [
                `หัวข้อ: ${data.title || ''}`,
                data.message || '',
                `จาก: ${data.userName || data.userEmail || ''}`,
                data.contactEmail || '',
                data.status || '',
                data.adminStatusNote || ''
              ].filter(Boolean).join('\n'),
              userEmail: data.userEmail || data.contactEmail || '',
              userUid: data.userUid || data.uid || '',
              userName: data.userName || '',
              mode: 'instant',
              sent: data.status === 'ดำเนินการแล้ว' || data.status === 'อนุมัติแล้ว' || false,
              sentAt: null,
              createdAt: createdAtMs,
              migratedFrom: 'users/admin/admin_contact_messages',
              migratedAt: Date.now()
            };
            await setDoc(doc(db, 'admin_mail_log', `contact_sub_${d.id}`), logDoc, { merge: true });
            migratedContact++;
          } catch (e) {
            console.warn(`[MailLog Migration] sub ${d.id} ผิดพลาด`, e);
            errors++;
          }
        }
      } catch (e) {
        console.warn('[MailLog Migration] อ่าน sub-collection users/admin ไม่สำเร็จ', e);
      }

      // 3) ดึง users/admin/admin_contact_messages (path: users/admin/...)
      try {
        const subSnap2 = await getDocs(collection(db, 'users', 'admin', 'admin_contact_messages'));
        for (const d of subSnap2.docs) {
          try {
            const data = d.data();
            // skip duplicates already migrated from users/adminEmail path
            const existingId = `contact_sub_${d.id}`;
            const createdAtMs = data.createdAtMs || (data.createdAt?.toDate ? data.createdAt.toDate().getTime() : data.createdAt || Date.now());
            const logDoc = {
              logId: existingId,
              sourceCollection: 'users/admin/admin_contact_messages',
              sourceDocId: d.id,
              eventKey: 'contactMessage',
              title: `ข้อความถึงผู้ดูแลระบบ: ${data.title || '(ไม่ระบุหัวข้อ)'}`,
              detail: [
                `หัวข้อ: ${data.title || ''}`,
                data.message || '',
                `จาก: ${data.userName || data.userEmail || ''}`,
                data.contactEmail || '',
                data.status || '',
                data.adminStatusNote || ''
              ].filter(Boolean).join('\n'),
              userEmail: data.userEmail || data.contactEmail || '',
              userUid: data.userUid || data.uid || '',
              userName: data.userName || '',
              mode: 'instant',
              sent: data.status === 'ดำเนินการแล้ว' || data.status === 'อนุมัติแล้ว' || false,
              sentAt: null,
              createdAt: createdAtMs,
              migratedFrom: 'users/admin/admin_contact_messages',
              migratedAt: Date.now()
            };
            await setDoc(doc(db, 'admin_mail_log', existingId), logDoc, { merge: true });
          } catch (e) {
            errors++;
          }
        }
      } catch (e) {
        console.warn('[MailLog Migration] อ่าน users/admin sub-collection ไม่สำเร็จ', e);
      }

      // Summary
      const msg = `ดึงข้อมูลเก่าสำเร็จ!\n\n` +
        `คำขอสมัครแผน: ${migratedPlan} รายการ\n` +
        `ข้อความติดต่อ: ${migratedContact} รายการ\n` +
        `ข้อผิดพลาด: ${errors} รายการ\n\n` +
        `คอลเลคชั่น: admin_mail_log`;

      alertBox('Migration สำเร็จ', msg);
      console.log(`[MailLog Migration] สรุป: plan=${migratedPlan}, contact=${migratedContact}, errors=${errors}`);

    } catch (e) {
      console.error('[MailLog Migration] ล้มเหลว', e);
      alertBox('Migration ล้มเหลว', e?.message || String(e), true);
    }
  };

})();
