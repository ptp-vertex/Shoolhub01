
(function(){
  if (window.__schoolhubCurrentPlanCardUnifiedHelper) return;
  window.__schoolhubCurrentPlanCardUnifiedHelper = true;

  function esc(v){
    try {
      if (typeof window.escapeHTML === 'function') return window.escapeHTML(v == null ? '' : String(v));
      return String(v == null ? '' : v).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
    } catch(e) { return String(v == null ? '' : v); }
  }

  function toMillis(value){
    if (!value) return 0;
    try {
      if (typeof value.toMillis === 'function') return value.toMillis();
      if (typeof value.toDate === 'function') return value.toDate().getTime();
      if (typeof value === 'object' && value.seconds) return Number(value.seconds) * 1000;
      if (typeof value === 'string') {
        var parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      var n = Number(value);
      if (!Number.isFinite(n) || !n) return 0;
      return n < 10000000000 ? n * 1000 : n;
    } catch(e) { return 0; }
  }

  function formatThaiDateTime(value){
    var ms = toMillis(value);
    if (!ms) return '-';
    try {
      return new Date(ms).toLocaleString('th-TH', {
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch(e) { return '-'; }
  }
  window.formatThaiDateTime = window.formatThaiDateTime || formatThaiDateTime;

  function normalizePriceText(text){
    return String(text == null ? '' : text)
      .replace(/บาท\s*ต่อเดือน/g, 'บาท ต่อเดือน')
      .replace(/บาท\s*\/\s*เดือน/g, 'บาท ต่อเดือน')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function amountText(value){
    if (value == null || value === '') return '0';
    if (typeof value === 'number') return Number(value || 0).toLocaleString('th-TH');
    var s = normalizePriceText(value);
    s = s.replace(/บาท\s*ต่อเดือน/g, '').replace(/บาท/g, '').trim();
    return s || '0';
  }

  function getPriceText(plan, userDir){
    plan = plan || {};
    userDir = userDir || {};
    var raw = plan.price || userDir.planPrice || userDir.price || '';
    if (raw && /ฟรีเดือนแรก/.test(String(raw))) return normalizePriceText(raw);
    if (plan.freeFirstMonth || userDir.freeFirstMonth) {
      var monthly = plan.monthlyPrice ?? userDir.monthlyPrice ?? userDir.planAmount ?? raw ?? 0;
      return 'ฟรีเดือนแรก / ต่อไป ' + amountText(monthly) + ' บาท ต่อเดือน';
    }
    if (raw) return normalizePriceText(raw);
    var amount = plan.monthlyPrice ?? userDir.monthlyPrice ?? userDir.planAmount ?? 0;
    return amountText(amount) + ' บาท ต่อเดือน';
  }

  function getPlanName(plan, userDir){
    plan = plan || {};
    userDir = userDir || {};
    return plan.name || userDir.teamPlanName || userDir.planName || userDir.requestedPlanName || userDir.planId || 'ไม่มีแผน';
  }

  function getNextDate(userDir){
    userDir = userDir || {};
    return userDir.nextBillingAt || userDir.planNextBillingAt || userDir.planNextBillingDate || userDir.planExpiresAt || userDir.planStartAt || userDir.planStartedAt || userDir.startedAt || userDir.approvedAt || userDir.createdAt || '';
  }

  function getCourseLimit(plan, userDir){
    plan = plan || {};
    userDir = userDir || {};
    var raw = plan.courseLimit ?? userDir.courseLimit ?? userDir.maxCourses ?? '-';
    var n = Number(raw);
    if (raw === '-' || raw == null || raw === '') return '-';
    if (Number.isFinite(n) && n === 0) return 'ไม่จำกัด';
    return raw;
  }

  // เช็คว่าแผนปัจจุบัน "หมดอายุ/ถึงรอบชำระเงินแล้ว" หรือไม่ โดยดูเฉพาะฟิลด์วันหมดอายุ/รอบบิลจริงๆ
  // (ไม่ใช้ fallback วันที่เริ่มแผน/วันที่สร้างบัญชี เพราะวันนั้นเป็นอดีตอยู่แล้วเสมอ จะเข้าใจผิดว่าหมดอายุตลอด)
  function isPlanExpired(plan, userDir){
    plan = plan || {};
    userDir = userDir || {};
    if (plan.freeForever || plan.billingCycle === 'forever') return false;
    if (!plan.id || plan.id === 'none' || plan.id === 'pending') return false;
    var now = Date.now();
    var expiresMs = toMillis(userDir.planExpiresAt);
    if (expiresMs && expiresMs <= now) return true;
    var nextBillingMs = toMillis(userDir.planNextBillingAt || userDir.planNextBillingDate);
    if (nextBillingMs && nextBillingMs <= now) return true;
    return false;
  }

  window.renderCurrentPlanCardHTML = function(plan, userDir){
    plan = plan || {};
    userDir = userDir || {};
    var planName = getPlanName(plan, userDir);
    var priceText = getPriceText(plan, userDir);
    var nextDate = getNextDate(userDir);
    var courseLimit = getCourseLimit(plan, userDir);
    var expired = isPlanExpired(plan, userDir);
    var planId = plan.id || userDir.planId || '';

    var expiredBadge = expired
      ? '<div class="schoolhub-current-plan-expired-badge"><i class="fas fa-triangle-exclamation"></i> หมดอายุแล้ว</div>'
      : '';

    // ปุ่มต่ออายุแบบง่ายๆ ตรงกล่องแผนปัจจุบันด้านบนเลย ไม่ต้องเลื่อนลงไปเลือกด้านล่าง
    // ใช้ data-attribute + ฟังก์ชันกลาง แทนการฝัง planId ลงใน onclick ตรงๆ
    // (เดิมฝัง JSON.stringify ที่มีเครื่องหมาย " ซ้อนกับ onclick="..." ที่เป็น " เหมือนกัน ทำให้ attribute ขาดตอนกลางคัน ปุ่มเลยกดไม่ติด)
    var renewBtn = expired
      ? '<button type="button" class="schoolhub-current-plan-renew-btn" data-schoolhub-renew-plan-id="' + esc(String(planId)) + '" onclick="window.schoolhubRenewCurrentPlan &amp;&amp; window.schoolhubRenewCurrentPlan(this)"><i class="fas fa-rotate mr-1"></i> ต่ออายุเลย</button>'
      : '';

    return '' +
      '<div class="schoolhub-current-plan-card' + (expired ? ' schoolhub-current-plan-card--expired' : '') + '" data-schoolhub-current-plan-unified="1">' +
        '<div class="schoolhub-current-plan-info">' +
          '<div class="schoolhub-current-plan-label" data-i18n="currentPlan">' + esc(window.t ? window.t('currentPlan') : 'แผนปัจจุบัน') + '</div>' +
          '<div class="schoolhub-current-plan-name">' + esc(planName) + expiredBadge + '</div>' +
          '<div class="schoolhub-current-plan-price">' + esc(priceText) + '</div>' +
          '<div class="schoolhub-current-plan-meta"><span data-i18n="nextBillingStart">' + esc(window.t ? window.t('nextBillingStart') : 'เรียกเก็บครั้งถัดไป') + '</span>: ' + esc(formatThaiDateTime(nextDate)) + '</div>' +
          '<div class="schoolhub-current-plan-meta"><span data-i18n="courseLimit">' + esc(window.t ? window.t('courseLimit') : 'เพิ่มรายวิชาได้') + '</span>: ' + esc(courseLimit) + ' <span data-i18n="courseUnit">' + esc(window.t ? window.t('courseUnit') : 'วิชา') + '</span></div>' +
          renewBtn +
        '</div>' +
        '<div class="schoolhub-current-plan-icon"><i class="fa-solid fa-id-card fas fa-id-card"></i></div>' +
      '</div>';
  };

  // ฟังก์ชันกลางที่ปุ่ม "ต่ออายุเลย" เรียกใช้: ตรวจสอบแผนเดิมที่เพิ่งหมดอายุไป
  // แล้วเรียกป็อปอัพชำระเงิน/สมัครของแผนนั้นโดยตรง (แผนเดียวกับที่ใช้อยู่ก่อนหมดอายุ)
  window.schoolhubRenewCurrentPlan = function(btn){
    try{
      var planId = btn && btn.getAttribute ? btn.getAttribute('data-schoolhub-renew-plan-id') : '';
      if (!planId) return;
      if (typeof window.requestSubscriptionPlan === 'function') {
        window.requestSubscriptionPlan(planId);
      } else if (typeof window.openPlanPaymentModal === 'function') {
        window.openPlanPaymentModal(planId);
      } else if (typeof window.openModal === 'function') {
        window.openModal('plan-modal');
      }
    }catch(e){}
  };

  window.schoolhubRenderCurrentPlanCardInto = function(target, plan, userDir){
    var el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el || typeof window.renderCurrentPlanCardHTML !== 'function') return;
    el.innerHTML = window.renderCurrentPlanCardHTML(plan, userDir || {});
    el.classList.remove('schoolhub-no-plan-state', 'schoolhub-ultimate-no-plan');
  };
})();
