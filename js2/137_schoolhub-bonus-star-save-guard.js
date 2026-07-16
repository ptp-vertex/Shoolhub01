/* SchoolHub - Final guard: บันทึกสิทธิ์ "คะแนนโบนัส" และ "ระบบดาว" ให้ตรงกับที่แอดมินติ๊กไว้จริง
   ปัญหาเดิม: มีสคริปต์ปะหลายชั้นมาจัดการฟอร์มบันทึกแผน ทำให้ allowBonus/allowStars
   หลุด/รีเซ็ตกลับเป็นเปิดใช้งานเสมอหลังกด "บันทึกแผน"
   ไฟล์นี้ทำงานเป็นลำดับสุดท้าย (โหลดหลังสุดในหน้า) จะอ่านค่า checkbox ที่แอดมินติ๊กไว้จริง ๆ
   ก่อนที่ฟังก์ชันอื่นจะรัน แล้วบังคับเขียนค่านั้นทับอีกครั้งหลังบันทึกเสร็จ ทั้งใน
   localStorage และ Firestore เพื่อการันตีว่าไม่มีสคริปต์อื่นทำค่าหาย/รีเซ็ตทีหลัง */
(function () {
  if (window.__schoolhubBonusStarSaveGuard) return;
  window.__schoolhubBonusStarSaveGuard = true;

  function $(id) { return document.getElementById(id); }

  const firebaseConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
  };

  async function forceSaveToFirestore(items) {
    try {
      const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
      const { getFirestore, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      const db = getFirestore(app);
      await setDoc(doc(db, 'system_settings', 'subscription_plans'), { items, updatedAt: Date.now() }, { merge: true });
    } catch (e) {
      console.warn('[bonus/star save guard] Firestore save skipped:', e);
    }
  }

  function getPlansFromCache() {
    if (Array.isArray(window.subscriptionPlans) && window.subscriptionPlans.length) return window.subscriptionPlans.slice();
    const keys = ['schoolhub_subscription_plans_cache', 'schoolhub_subscription_plans', 'schoolhub_public_plans'];
    for (const key of keys) {
      try {
        const items = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(items) && items.length) return items;
      } catch (e) { /* ignore */ }
    }
    return [];
  }

  const prevSave = window.saveAdminPlanForm;
  window.saveAdminPlanForm = async function () {
    // อ่านค่า checkbox ที่แอดมินติ๊กไว้จริง ๆ ก่อนที่ฟังก์ชันอื่นจะเริ่มทำงาน/รีเซ็ตฟอร์ม
    const bonusEl = $('plan-sub-allowBonus');
    const starEl = $('plan-sub-allowStars');
    const bonusVal = bonusEl ? bonusEl.checked === true : null;
    const starVal = starEl ? starEl.checked === true : null;
    const editId = $('plan-sub-edit-id')?.value || '';

    const result = typeof prevSave === 'function' ? await prevSave.apply(this, arguments) : undefined;

    try {
      if (bonusVal !== null || starVal !== null) {
        let items = getPlansFromCache();
        const targetId = editId || (items.slice().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] || {}).id || '';
        const idx = items.findIndex(p => String(p && p.id || '') === String(targetId));
        if (idx >= 0) {
          if (bonusVal !== null) items[idx].allowBonus = bonusVal;
          if (starVal !== null) items[idx].allowStars = starVal;
          items[idx].updatedAt = Date.now();

          window.subscriptionPlans = items;
          ['schoolhub_subscription_plans_cache', 'schoolhub_subscription_plans', 'schoolhub_public_plans'].forEach(k => {
            try { localStorage.setItem(k, JSON.stringify(items)); } catch (e) { /* ignore */ }
          });

          if (typeof window.renderAdminPlans === 'function') window.renderAdminPlans();
          if (typeof window.renderLandingPlans === 'function') window.renderLandingPlans();
          if (typeof window.renderUserPlans === 'function') window.renderUserPlans();

          await forceSaveToFirestore(items);
        }
      }
    } catch (e) {
      console.warn('[bonus/star save guard] error:', e);
    }

    return result;
  };
})();
