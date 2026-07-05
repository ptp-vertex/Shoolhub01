/* =====================================================================
   PATCH: ระบบสอนการใช้งาน (Onboarding Tour)
   -----------------------------------------------------------------------
   หลักการทำงาน:
   - แต่ละ "จุด" ของโปรแกรม (ปุ่ม/เมนู/พื้นที่) จะถูกสอน "ครั้งเดียว" ต่อ
     1 บัญชี (account) แยกกันระหว่างที่ใช้งานบน "คอมพิวเตอร์" กับ "มือถือ"
     (คนละอุปกรณ์ = คนละสถานะการสอน เพราะ UI/ตำแหน่งปุ่มไม่เหมือนกัน)
   - บัญชีที่ใช้งานอยู่แล้ว (เก่า) เมื่อเพิ่มระบบนี้เข้าไป จะยังไม่มีประวัติ
     ว่า "เคยเรียนแล้ว" เลย ระบบจึงจะเริ่มสอนให้ทันทีที่เจอจุดนั้นๆ
     (เหมือนผู้ใช้ใหม่) โดยไม่ต้องตั้งค่าอะไรเพิ่ม
   - ผู้ใช้สามารถ "ขอเรียนซ้ำ" ได้เองที่ ตั้งค่า > ทั่วไป > หัวข้อ
     "วิธีใช้งาน / เรียนรู้เพิ่มเติม" ทั้งแบบเลือกสอนซ้ำเฉพาะจุด หรือสอนซ้ำ
     ทั้งหมดในคลิกเดียว

   วิธีเพิ่มจุดสอนใหม่ในอนาคต: เพิ่ม object ใหม่ลงใน SH_TOUR_STEPS ด้านล่าง
   ระบุ selector / title / text แยก desktop กับ mobile ให้ครบ
   ===================================================================== */
(function () {
    'use strict';

    var STORAGE_PREFIX = 'schoolhub_tour_seen_v1';
    var MOBILE_QUERY = '(max-width: 767px)';

    /* ---------------------------------------------------------------- */
    /* 1) รายการ "จุดสอน" ทั้งหมด — เพิ่ม/แก้ได้ที่นี่ที่เดียว            */
    /* ---------------------------------------------------------------- */
    var SH_TOUR_STEPS = [
        {
            id: 'nav-main',
            group: 'เมนูหลัก',
            selector: { desktop: '#nav-dashboard', mobile: '#mobile-hamburger-btn' },
            title: { desktop: 'เมนูหลัก (แถบด้านซ้าย)', mobile: 'เมนูหลัก (ปุ่มสามขีด)' },
            text: {
                desktop: 'ใช้แถบเมนูด้านซ้ายนี้สลับไปหน้าต่างๆ เช่น หน้าหลัก, ฐานข้อมูลนักเรียน, แผนการใช้งาน และตั้งค่า',
                mobile: 'แตะปุ่มสามขีดนี้เพื่อเปิดเมนู แล้วเลือกหน้าที่ต้องการ เช่น ห้องเรียนของฉัน, ฐานข้อมูลนักเรียน หรือตั้งค่า'
            }
        },
        {
            id: 'nav-settings',
            group: 'เมนูหลัก',
            selector: { desktop: '#nav-settings', mobile: '#mobile-nav-settings' },
            title: { desktop: 'ปุ่มตั้งค่า', mobile: 'ปุ่มตั้งค่า' },
            text: {
                desktop: 'กดที่นี่เพื่อแก้ไขโปรไฟล์ เปลี่ยนภาษา ดูแผนการใช้งาน หรือกู้ข้อมูลจาก Backup',
                mobile: 'แตะปุ่มนี้ในเมนู เพื่อแก้ไขโปรไฟล์ เปลี่ยนภาษา ดูแผนการใช้งาน หรือกู้ข้อมูลจาก Backup'
            }
        },
        {
            id: 'dashboard-add-course',
            group: 'หน้าหลัก',
            selector: { desktop: '[onclick="openCourseModal()"]', mobile: '[onclick="openCourseModal()"]' },
            title: { desktop: 'เพิ่มวิชาเรียนใหม่', mobile: 'เพิ่มวิชาเรียนใหม่' },
            text: {
                desktop: 'คลิกปุ่มนี้เพื่อสร้างวิชาเรียนใหม่ แล้วกรอกชื่อวิชา ระดับชั้น และห้องเรียน',
                mobile: 'แตะปุ่มนี้เพื่อสร้างวิชาเรียนใหม่ แล้วกรอกชื่อวิชา ระดับชั้น และห้องเรียน'
            }
        },
        {
            id: 'dashboard-course-grid',
            group: 'หน้าหลัก',
            selector: { desktop: '#course-grid', mobile: '#course-grid' },
            title: { desktop: 'รายวิชาของคุณ', mobile: 'รายวิชาของคุณ' },
            text: {
                desktop: 'การ์ดแต่ละใบคือ 1 วิชา คลิกที่การ์ดเพื่อเข้าไปเช็คชื่อ บันทึกคะแนน และดูภาพรวมของวิชานั้น',
                mobile: 'การ์ดแต่ละใบคือ 1 วิชา แตะที่การ์ดเพื่อเข้าไปเช็คชื่อ บันทึกคะแนน และดูภาพรวมของวิชานั้น'
            }
        },
        {
            id: 'nav-students',
            group: 'เมนูหลัก',
            selector: { desktop: '#nav-students', mobile: '#mobile-nav-students' },
            title: { desktop: 'ฐานข้อมูลนักเรียน', mobile: 'ฐานข้อมูลนักเรียน' },
            text: {
                desktop: 'หน้านี้ใช้เพิ่ม/แก้ไขนักเรียนทั้งหมดในระบบ แยกตามห้อง/ชั้น ก่อนนำไปเลือกใช้ในแต่ละวิชา',
                mobile: 'หน้านี้ใช้เพิ่ม/แก้ไขนักเรียนทั้งหมดในระบบ แยกตามห้อง/ชั้น ก่อนนำไปเลือกใช้ในแต่ละวิชา'
            }
        },
        {
            id: 'students-add-btn',
            group: 'ฐานข้อมูลนักเรียน',
            selector: { desktop: '[onclick="openMultiStudentModal()"]', mobile: '[onclick="openMultiStudentModal()"]' },
            title: { desktop: 'เพิ่มนักเรียน', mobile: 'เพิ่มนักเรียน' },
            text: {
                desktop: 'คลิกปุ่มนี้เพื่อเพิ่มนักเรียนใหม่ทีละคนหรือหลายคนพร้อมกัน',
                mobile: 'แตะปุ่มนี้เพื่อเพิ่มนักเรียนใหม่ทีละคนหรือหลายคนพร้อมกัน'
            }
        },
        {
            id: 'students-export-btn',
            group: 'ฐานข้อมูลนักเรียน',
            selector: { desktop: '[onclick="exportStudentsToExcel()"]', mobile: '[onclick="exportStudentsToExcel()"]' },
            title: { desktop: 'Export รายชื่อนักเรียน', mobile: 'Export รายชื่อนักเรียน' },
            text: {
                desktop: 'คลิกปุ่มนี้เพื่อดาวน์โหลดรายชื่อนักเรียนทั้งหมดเป็นไฟล์ Excel',
                mobile: 'แตะปุ่มนี้เพื่อดาวน์โหลดรายชื่อนักเรียนทั้งหมดเป็นไฟล์ Excel'
            }
        },
        {
            id: 'course-tab-attendance',
            group: 'ภายในวิชา',
            selector: {
                desktop: '#course-context-menu .course-tab-btn[data-tab="attendance"]',
                mobile: '#mobile-course-submenu .course-tab-btn[data-tab="attendance"]'
            },
            title: { desktop: 'เมนูเช็คชื่อเข้าเรียน', mobile: 'เมนูเช็คชื่อเข้าเรียน' },
            text: {
                desktop: 'คลิกที่นี่เพื่อเปิดหน้าเช็คชื่อของวิชานี้',
                mobile: 'แตะที่นี่เพื่อเปิดหน้าเช็คชื่อของวิชานี้'
            }
        },
        {
            id: 'attendance-open-calendar',
            group: 'ภายในวิชา',
            selector: { desktop: '#attendance-calendar-open-btn', mobile: '#attendance-calendar-open-btn' },
            title: { desktop: 'เลือกวันที่เช็คชื่อ', mobile: 'เลือกวันที่เช็คชื่อ' },
            text: {
                desktop: 'คลิกปุ่มนี้เพื่อเปิดปฏิทิน แล้วเลือกวันที่ต้องการเช็คชื่อเข้าเรียน',
                mobile: 'แตะปุ่มนี้เพื่อเปิดปฏิทิน แล้วเลือกวันที่ต้องการเช็คชื่อเข้าเรียน'
            }
        },
        {
            id: 'course-tab-scores',
            group: 'ภายในวิชา',
            selector: {
                desktop: '#course-context-menu .course-tab-btn[data-tab="scores"]',
                mobile: '#mobile-course-submenu .course-tab-btn[data-tab="scores"]'
            },
            title: { desktop: 'เมนูบันทึกคะแนน', mobile: 'เมนูบันทึกคะแนน' },
            text: {
                desktop: 'คลิกที่นี่เพื่อเปิดหน้าบันทึกคะแนนของวิชานี้',
                mobile: 'แตะที่นี่เพื่อเปิดหน้าบันทึกคะแนนของวิชานี้'
            }
        },
        {
            id: 'course-tab-overview',
            group: 'ภายในวิชา',
            selector: {
                desktop: '#course-context-menu .course-tab-btn[data-tab="overview"]',
                mobile: '#mobile-course-submenu .course-tab-btn[data-tab="overview"]'
            },
            title: { desktop: 'ภาพรวมคะแนน', mobile: 'ภาพรวมคะแนน' },
            text: {
                desktop: 'หน้านี้สรุปคะแนนและสถิติทั้งหมดของนักเรียนในวิชานี้',
                mobile: 'หน้านี้สรุปคะแนนและสถิติทั้งหมดของนักเรียนในวิชานี้'
            }
        },
        {
            id: 'nav-user-plans',
            group: 'เมนูหลัก',
            selector: { desktop: '#nav-user-plans', mobile: '#mobile-nav-user-plans' },
            title: { desktop: 'แผนการใช้งาน', mobile: 'แผนการใช้งาน' },
            text: {
                desktop: 'ดูหรือเปลี่ยนแผนการใช้งาน และตรวจสอบประวัติการชำระเงินได้ที่นี่',
                mobile: 'ดูหรือเปลี่ยนแผนการใช้งาน และตรวจสอบประวัติการชำระเงินได้ที่นี่'
            }
        },
        {
            id: 'settings-tabs',
            group: 'ตั้งค่า',
            selector: { desktop: '#schoolhub-settings-tabs', mobile: '#schoolhub-settings-tabs' },
            title: { desktop: 'แท็บตั้งค่า', mobile: 'แท็บตั้งค่า' },
            text: {
                desktop: 'สลับไปแต่ละหมวดของหน้าตั้งค่าได้ที่นี่ เช่น โปรไฟล์ ภาษา แผนการใช้งาน และการกู้ข้อมูล',
                mobile: 'แตะเพื่อสลับไปแต่ละหมวดของหน้าตั้งค่า เช่น โปรไฟล์ ภาษา แผนการใช้งาน และการกู้ข้อมูล'
            }
        },
        {
            id: 'settings-backup',
            group: 'ตั้งค่า',
            selector: { desktop: '[data-settings-tab="backup-restore"]', mobile: '[data-settings-tab="backup-restore"]' },
            title: { desktop: 'กู้ข้อมูลจาก Backup', mobile: 'กู้ข้อมูลจาก Backup' },
            text: {
                desktop: 'ระบบสำรองข้อมูลอัตโนมัติทุกครั้งก่อนบันทึก คลิกแท็บนี้เพื่อกู้คืนหากข้อมูลหาย',
                mobile: 'ระบบสำรองข้อมูลอัตโนมัติทุกครั้งก่อนบันทึก แตะแท็บนี้เพื่อกู้คืนหากข้อมูลหาย'
            }
        }
    ];

    /* ---------------------------------------------------------------- */
    /* 2) ตัวช่วยเรื่องอุปกรณ์ / บัญชี / การจดจำว่า "เคยสอนแล้ว"          */
    /* ---------------------------------------------------------------- */
    function isMobile() {
        try { return window.matchMedia && window.matchMedia(MOBILE_QUERY).matches; }
        catch (e) { return window.innerWidth <= 767; }
    }
    function deviceKey() { return isMobile() ? 'mobile' : 'desktop'; }

    function accountKey() {
        try {
            var u = (typeof currentUser !== 'undefined' && currentUser) ||
                (window.auth && window.auth.currentUser) ||
                window.currentUser || null;
            var id = (u && (u.email || u.uid)) || window.currentUserEmail || null;
            if (!id) {
                try {
                    var saved = JSON.parse(localStorage.getItem('schoolhub_admin_bypass') || 'null');
                    if (saved && saved.email) id = saved.email;
                } catch (e2) {}
            }
            return id ? String(id).trim().toLowerCase() : 'guest';
        } catch (e) { return 'guest'; }
    }

    function storeKey(devOverride) {
        return STORAGE_PREFIX + ':' + accountKey() + ':' + (devOverride || deviceKey());
    }

    function loadSeen(devOverride) {
        try { return JSON.parse(localStorage.getItem(storeKey(devOverride)) || '{}') || {}; }
        catch (e) { return {}; }
    }
    function saveSeen(map, devOverride) {
        try { localStorage.setItem(storeKey(devOverride), JSON.stringify(map)); } catch (e) {}
    }
    function isSeen(id, devOverride) { return !!loadSeen(devOverride)[id]; }
    function markSeen(id, devOverride) {
        var m = loadSeen(devOverride);
        m[id] = Date.now();
        saveSeen(m, devOverride);
    }
    function unmarkSeen(id, devOverride) {
        var m = loadSeen(devOverride);
        delete m[id];
        saveSeen(m, devOverride);
    }
    function resetAllSeen(devOverride) {
        try { localStorage.removeItem(storeKey(devOverride)); } catch (e) {}
    }

    /* ---------------------------------------------------------------- */
    /* 3) ตรวจว่า element กำลังแสดงผลอยู่จริงบนหน้าจอหรือไม่               */
    /* ---------------------------------------------------------------- */
    function findVisible(selector) {
        if (!selector) return null;
        var el;
        try { el = document.querySelector(selector); } catch (e) { return null; }
        if (!el) return null;
        var rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        if (el.offsetParent === null) {
            var cs = window.getComputedStyle(el);
            if (cs.position !== 'fixed') return null;
        }
        // ต้องไม่ถูกซ่อนอยู่ในโมดัลอื่นที่ปิดอยู่ (เผื่อ parent มี class hidden)
        var p = el;
        for (var i = 0; i < 6 && p; i++) {
            if (p.classList && p.classList.contains('hidden')) return null;
            if (p.getAttribute && p.getAttribute('aria-hidden') === 'true') return null;
            p = p.parentElement;
        }
        return el;
    }

    /* ---------------------------------------------------------------- */
    /* 4) หา step ที่ยังไม่เคยสอน + กำลังแสดงผลอยู่ ณ ขณะนี้                */
    /* ---------------------------------------------------------------- */
    function collectPending() {
        var dev = deviceKey();
        var out = [];
        for (var i = 0; i < SH_TOUR_STEPS.length; i++) {
            var step = SH_TOUR_STEPS[i];
            if (isSeen(step.id)) continue;
            var sel = (step.selector && (step.selector[dev] || step.selector.any)) || null;
            var el = findVisible(sel);
            if (el) out.push({ step: step, el: el });
        }
        return out;
    }

    /* ---------------------------------------------------------------- */
    /* 5) UI: overlay + spotlight + card                                 */
    /* ---------------------------------------------------------------- */
    var overlayEl, spotlightEl, cardEl, resizeHandlerAttached = false;
    var current = null; // { step, el }
    var running = false;

    function ensureUi() {
        if (overlayEl) return;
        overlayEl = document.createElement('div');
        overlayEl.id = 'sh-tour-overlay';
        spotlightEl = document.createElement('div');
        spotlightEl.id = 'sh-tour-spotlight';
        cardEl = document.createElement('div');
        cardEl.id = 'sh-tour-card';
        document.body.appendChild(overlayEl);
        document.body.appendChild(spotlightEl);
        document.body.appendChild(cardEl);
        overlayEl.addEventListener('click', function () { endTour(true); });
    }

    function positionAll() {
        if (!current) return;
        var el = current.el;
        if (!document.body.contains(el)) { advance(); return; }
        var r = el.getBoundingClientRect();
        var pad = 8;
        spotlightEl.style.top = Math.max(0, r.top - pad) + 'px';
        spotlightEl.style.left = Math.max(0, r.left - pad) + 'px';
        spotlightEl.style.width = (r.width + pad * 2) + 'px';
        spotlightEl.style.height = (r.height + pad * 2) + 'px';

        var cardWidth = Math.min(320, window.innerWidth - 32);
        cardEl.style.width = cardWidth + 'px';

        var spaceBelow = window.innerHeight - r.bottom;
        var placeBelow = spaceBelow > 180 || spaceBelow > (window.innerHeight - r.top);
        var top, arrow;
        if (placeBelow) {
            top = r.bottom + pad + 14;
            arrow = 'top';
        } else {
            arrow = 'bottom';
            // วางไว้ก่อนแล้ววัดความสูงจริงอีกครั้ง
            cardEl.style.visibility = 'hidden';
            cardEl.style.top = '0px';
            var h = cardEl.offsetHeight || 140;
            cardEl.style.visibility = '';
            top = r.top - pad - 14 - h;
            if (top < 8) top = 8;
        }
        var left = r.left;
        if (left + cardWidth > window.innerWidth - 12) left = window.innerWidth - cardWidth - 12;
        if (left < 12) left = 12;

        cardEl.style.top = top + 'px';
        cardEl.style.left = left + 'px';
        cardEl.setAttribute('data-arrow', arrow);
        var arrowX = Math.min(Math.max(r.left - left + r.width / 2 - 7, 16), cardWidth - 28);
        cardEl.style.setProperty('--sh-arrow-x', arrowX + 'px');
    }

    function renderCard(pending) {
        var step = current.step;
        var dev = deviceKey();
        var title = (step.title && (step.title[dev] || step.title.any)) || '';
        var text = (step.text && (step.text[dev] || step.text.any)) || '';
        var idx = SH_TOUR_STEPS.length - pending.length + 1;
        cardEl.innerHTML =
            '<span class="sh-tour-badge"><i class="fas fa-graduation-cap"></i>สอนการใช้งาน</span>' +
            '<h4>' + escapeHtml(title) + '</h4>' +
            '<p>' + escapeHtml(text) + '</p>' +
            '<div class="sh-tour-actions">' +
            '<button type="button" class="sh-tour-skip" data-sh-skip>ข้าม / ไม่ต้องสอนอีก</button>' +
            '<button type="button" class="sh-tour-next" data-sh-next>เข้าใจแล้ว <i class="fas fa-arrow-right"></i></button>' +
            '</div>';
        cardEl.querySelector('[data-sh-next]').addEventListener('click', function (ev) {
            ev.stopPropagation();
            markSeen(step.id);
            advance();
        });
        cardEl.querySelector('[data-sh-skip]').addEventListener('click', function (ev) {
            ev.stopPropagation();
            endTour(true);
        });
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    function showCurrent(pending) {
        ensureUi();
        el_scrollIntoView(current.el);
        setTimeout(function () {
            renderCard(pending);
            positionAll();
            overlayEl.classList.add('sh-tour-show');
            spotlightEl.classList.add('sh-tour-show');
            cardEl.classList.add('sh-tour-show');
            attachResizeHandlers();
        }, 220);
    }

    function el_scrollIntoView(el) {
        try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch (e) {}
    }

    function attachResizeHandlers() {
        if (resizeHandlerAttached) return;
        resizeHandlerAttached = true;
        window.addEventListener('scroll', positionAll, true);
        window.addEventListener('resize', positionAll, true);
    }
    function detachResizeHandlers() {
        resizeHandlerAttached = false;
        window.removeEventListener('scroll', positionAll, true);
        window.removeEventListener('resize', positionAll, true);
    }

    function advance() {
        var pending = collectPending();
        if (!pending.length) { endTour(false); return; }
        current = pending[0];
        showCurrent(pending);
    }

    function endTour(hideOverlay) {
        running = false;
        current = null;
        detachResizeHandlers();
        if (overlayEl) {
            overlayEl.classList.remove('sh-tour-show');
            spotlightEl.classList.remove('sh-tour-show');
            cardEl.classList.remove('sh-tour-show');
        }
    }

    function runTourCheck() {
        if (running) return;
        var pending = collectPending();
        if (!pending.length) return;
        running = true;
        current = pending[0];
        showCurrent(pending);
    }

    /* ---------------------------------------------------------------- */
    /* 6) เรียกตรวจสอบซ้ำๆ อย่างประหยัด เมื่อหน้าจอมีการเปลี่ยนแปลง         */
    /* ---------------------------------------------------------------- */
    var checkTimer = null;
    function scheduleCheck(delay) {
        if (checkTimer) clearTimeout(checkTimer);
        checkTimer = setTimeout(function () {
            checkTimer = null;
            if (!running) runTourCheck();
        }, delay || 400);
    }

    function wrapGlobalFn(name, delay) {
        try {
            if (typeof window[name] !== 'function') return;
            var orig = window[name];
            if (orig.__shTourWrapped) return;
            var wrapped = function () {
                var ret = orig.apply(this, arguments);
                scheduleCheck(delay || 450);
                return ret;
            };
            wrapped.__shTourWrapped = true;
            window[name] = wrapped;
        } catch (e) {}
    }

    function hookNavigationFunctions() {
        ['switchView', 'goToHome', 'openStudentsManager', 'openUserPlanSelector',
            'openSchoolHubSettings', 'schoolhubOpenSettingsTab', 'toggleMobileMenu',
            'switchCourseTab', 'openCourseModal', 'openMultiStudentModal',
            'openAttendanceCalendarPopup', 'closeSettingsModal'].forEach(function (fn) {
            wrapGlobalFn(fn, 500);
        });
    }

    var hookRetryCount = 0;
    function tryHookLoop() {
        hookNavigationFunctions();
        hookRetryCount++;
        if (hookRetryCount < 20) setTimeout(tryHookLoop, 1000);
    }

    var mutationObserver = null;
    function startObserving() {
        if (mutationObserver || !document.body) return;
        mutationObserver = new MutationObserver(function () {
            if (!running) scheduleCheck(600);
        });
        mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener('resize', function () { scheduleCheck(500); });

    /* ---------------------------------------------------------------- */
    /* 7) ส่วนตั้งค่า: การ์ด "วิธีใช้งาน / เรียนรู้เพิ่มเติม" + สอนซ้ำรายจุด */
    /* ---------------------------------------------------------------- */
    function groupSteps() {
        var groups = {};
        var order = [];
        SH_TOUR_STEPS.forEach(function (s) {
            if (!groups[s.group]) { groups[s.group] = []; order.push(s.group); }
            groups[s.group].push(s);
        });
        return { groups: groups, order: order };
    }

    function renderSettingsCard() {
        var host = document.getElementById('schoolhub-tour-settings-host');
        if (!host) return;
        var dev = deviceKey();
        var g = groupSteps();
        var listHtml = '';
        g.order.forEach(function (groupName) {
            listHtml += '<div style="margin-top:10px;font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.03em;">' + escapeHtml(groupName) + '</div>';
            g.groups[groupName].forEach(function (s) {
                var title = (s.title && (s.title[dev] || s.title.any)) || s.id;
                var seen = isSeen(s.id);
                listHtml +=
                    '<div class="sh-tour-settings-item">' +
                    '<div><div class="sh-tour-item-title">' + escapeHtml(title) + '</div>' +
                    '<div class="sh-tour-item-sub">' + (seen ? 'เคยสอนแล้ว' : 'ยังไม่เคยสอน') + '</div></div>' +
                    '<button type="button" data-sh-replay-one="' + s.id + '">สอนอีกครั้ง</button>' +
                    '</div>';
            });
        });

        host.innerHTML =
            '<div class="sh-tour-settings-card">' +
            '<h5 class="font-black text-slate-900"><i class="fas fa-graduation-cap text-indigo-500 mr-2"></i>วิธีใช้งาน / เรียนรู้เพิ่มเติม</h5>' +
            '<p class="text-sm text-slate-500 leading-7 mt-2">ระบบจะสอนการใช้งานอัตโนมัติทีละจุดในครั้งแรกที่คุณเจอปุ่มหรือเมนูนั้น (แยกกันระหว่างคอมพิวเตอร์และมือถือ) ถ้าต้องการดูคำแนะนำอีกครั้ง เลือกสอนซ้ำเฉพาะจุด หรือกดสอนซ้ำทั้งหมดด้านล่าง</p>' +
            '<div class="sh-tour-settings-list">' + listHtml + '</div>' +
            '<button type="button" class="sh-tour-replay-all-btn" id="sh-tour-replay-all"><i class="fas fa-rotate-right"></i> เรียนรู้เพิ่มเติม (สอนอีกครั้งทั้งหมด)</button>' +
            '</div>';

        host.querySelectorAll('[data-sh-replay-one]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-sh-replay-one');
                unmarkSeen(id);
                try { if (typeof closeSettingsModal === 'function') closeSettingsModal(); } catch (e) {}
                setTimeout(function () { runTourCheck(); }, 350);
            });
        });
        var replayAllBtn = host.querySelector('#sh-tour-replay-all');
        if (replayAllBtn) {
            replayAllBtn.addEventListener('click', function () {
                resetAllSeen();
                try { if (typeof closeSettingsModal === 'function') closeSettingsModal(); } catch (e) {}
                setTimeout(function () { runTourCheck(); }, 350);
            });
        }
    }

    function observeSettingsPanel() {
        var panel = document.getElementById('schoolhub-settings-panel-general');
        if (!panel) return;
        var obs = new MutationObserver(function () {
            if (!panel.classList.contains('hidden')) renderSettingsCard();
        });
        obs.observe(panel, { attributes: true, attributeFilter: ['class'] });
        // เผื่อเปิดแท็บ general อยู่แล้วตั้งแต่แรก
        if (!panel.classList.contains('hidden')) renderSettingsCard();
    }

    /* ---------------------------------------------------------------- */
    /* 8) API สาธารณะ + เริ่มทำงาน                                        */
    /* ---------------------------------------------------------------- */
    window.schoolhubTour = {
        run: runTourCheck,
        resetAll: function () { resetAllSeen(); },
        resetOne: function (id) { unmarkSeen(id); },
        isSeen: isSeen,
        steps: SH_TOUR_STEPS
    };

    function boot() {
        renderSettingsCard();
        observeSettingsPanel();
        startObserving();
        tryHookLoop();
        scheduleCheck(1200);
        setTimeout(function () { scheduleCheck(300); }, 2500);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(boot, 50);
    } else {
        document.addEventListener('DOMContentLoaded', boot);
    }
})();
