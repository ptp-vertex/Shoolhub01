/* =====================================================================
   PATCH v3: SchoolHub Tour Fixes
   แก้ไข:
   1) แท็บ "วิธีใช้งาน" แยกออกมาจาก "ทั่วไป" — render tour card ในแท็บใหม่
   2) Intercept renderSettingsPanel สำหรับ tab = "learn"
   3) แก้ desktop ไม่เริ่ม tour ทันที (retry แบบยกเลิกได้)
   4) แก้ event listener ซ้อนซ้ำใน renderSettingsCard
   (ไม่มี FAB ปุ่มลอยแล้ว)
   ===================================================================== */
(function () {
    'use strict';

    /* ---------------------------------------------------------------- */
    /* Render tour card เข้าแท็บ "วิธีใช้งาน"                           */
    /* ---------------------------------------------------------------- */
    function renderLearnPanel() {
        if (!window.schoolhubTour) return;

        var panel = document.getElementById('schoolhub-settings-panel-learn');
        if (!panel) return;

        /* สร้าง host ถ้าหาย */
        var host = panel.querySelector('#schoolhub-tour-settings-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'schoolhub-tour-settings-host';
            host.setAttribute('data-schoolhub-always-allowed', '1');
            panel.appendChild(host);
        }

        window.schoolhubTour.renderSettingsCard();
    }

    /* ---------------------------------------------------------------- */
    /* Intercept renderSettingsPanel เพื่อรองรับ tab "learn"             */
    /* ---------------------------------------------------------------- */
    function interceptRenderSettingsPanel() {
        if (window._shRenderPanelPatched) return;
        var origFn = window.renderSettingsPanel;
        if (typeof origFn !== 'function') return;

        window._shRenderPanelPatched = true;
        window.renderSettingsPanel = function (tab) {
            if ((tab || '') === 'learn') {
                /* ให้ script 102 จัดการแสดง/ซ่อน panel ก่อน แล้วค่อย render card */
                setTimeout(renderLearnPanel, 80);
                return;
            }
            return origFn.apply(this, arguments);
        };
    }

    /* ---------------------------------------------------------------- */
    /* แก้ renderSettingsCard ซ้ำ (event listener ซ้อน)                  */
    /* ---------------------------------------------------------------- */
    function patchRenderSettingsCard() {
        if (!window.schoolhubTour || window._shTourCardPatched) return;
        window._shTourCardPatched = true;

        var orig = window.schoolhubTour.renderSettingsCard;
        var busy = false;
        var lastContent = '';

        /* expose ฟังก์ชัน reset cache เพื่อให้ 127 เรียกได้ */
        window._shTourCardResetCache = function () { lastContent = ''; };

        window.schoolhubTour.renderSettingsCard = function () {
            if (busy) return;
            var host = document.getElementById('schoolhub-tour-settings-host');

            /* ถ้า _shInstantJump พร้อมแล้ว ให้ force re-render เสมอ (ไม่ cache)
               เพราะ event delegation ใน 127 ต้องการ host ที่ถูก re-attach ทุกครั้ง
               ที่ settings เปิด เพื่อให้ jumpToStep ทำงานได้แทน listener เดิม */
            var skipCache = !!(window._shInstantJump && typeof window._shInstantJump.jumpToStep === 'function');
            if (!skipCache && host && host.innerHTML && host.innerHTML === lastContent) return;

            busy = true;
            try {
                orig();
                host = document.getElementById('schoolhub-tour-settings-host');
                if (host) lastContent = host.innerHTML;
            } catch (e) {
                console.warn('SchoolHub tour: renderSettingsCard error', e);
            }
            busy = false;
        };
    }

    /* ---------------------------------------------------------------- */
    /* ฟัง tab click "วิธีใช้งาน" เพื่อ render tour card                 */
    /* ---------------------------------------------------------------- */
    function attachLearnTabListener() {
        var tabs = document.getElementById('schoolhub-settings-tabs');
        if (!tabs || tabs._shLearnTabBound) return;
        tabs._shLearnTabBound = true;

        tabs.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-settings-tab]');
            if (btn && btn.getAttribute('data-settings-tab') === 'learn') {
                /* renderSettingsPanel จะถูกเรียกโดย switchSettingsTab;
                   เราแค่ retry สำรองอีกรอบ */
                setTimeout(renderLearnPanel, 300);
            }
        }, true);
    }

    /* ฟัง settings modal เปิด — ถ้า active tab เป็น learn ให้ render */
    function attachSettingsModalListener() {
        var modal = document.getElementById('settings-modal');
        if (!modal || modal._shLearnObserver) return;
        modal._shLearnObserver = true;

        var wasOpen = !modal.classList.contains('hidden');
        var obs = new MutationObserver(function () {
            /* ถ้า modal ถูกลบออกจาก DOM ให้ disconnect */
            if (!document.body.contains(modal)) {
                obs.disconnect();
                modal._shLearnObserver = false;
                return;
            }
            var nowOpen = !modal.classList.contains('hidden');
            if (nowOpen && !wasOpen) {
                setTimeout(function () {
                    var activeBtn = document.querySelector('#schoolhub-settings-tabs .settings-tab.active');
                    if (activeBtn && activeBtn.getAttribute('data-settings-tab') === 'learn') {
                        renderLearnPanel();
                    }
                }, 300);
            }
            wasOpen = nowOpen;
        });
        obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    /* ถ้า modal ยังไม่มีใน DOM รอ body observer */
    function watchForModal() {
        if (document.getElementById('settings-modal')) {
            attachSettingsModalListener();
            attachLearnTabListener();
            return;
        }
        var obs = new MutationObserver(function () {
            if (document.getElementById('settings-modal')) {
                obs.disconnect();
                attachSettingsModalListener();
                attachLearnTabListener();
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(function () { obs.disconnect(); }, 30000);
    }

    /* ---------------------------------------------------------------- */
    /* Desktop tour retry แบบยกเลิกได้                                   */
    /* ---------------------------------------------------------------- */
    function startDesktopRetry() {
        var done = false;

        /* หยุดเมื่อ tour เริ่มแล้ว */
        var iv = setInterval(function () {
            var overlay = document.getElementById('sh-tour-overlay');
            if (overlay && overlay.classList.contains('sh-tour-show')) {
                done = true;
                clearInterval(iv);
            }
        }, 400);
        setTimeout(function () { clearInterval(iv); }, 30000);

        /* หยุดเมื่อผู้ใช้กด "ข้าม" */
        document.addEventListener('click', function onSkip(e) {
            if (e.target && e.target.getAttribute && e.target.getAttribute('data-sh-skip') !== null) {
                done = true;
                document.removeEventListener('click', onSkip, true);
            }
        }, true);

        var delays = [600, 1400, 2800, 5000, 9000, 15000];
        delays.forEach(function (d) {
            setTimeout(function () {
                if (done) return;
                if (window.schoolhubTour && typeof window.schoolhubTour.run === 'function') {
                    window.schoolhubTour.run();
                }
            }, d);
        });
    }

    /* ---------------------------------------------------------------- */
    /* Boot                                                              */
    /* ---------------------------------------------------------------- */
    function boot() {
        startDesktopRetry();
        watchForModal();

        /* รอ schoolhubTour + renderSettingsPanel พร้อม แล้ว patch */
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            var tourReady = !!window.schoolhubTour;
            var fnReady   = typeof window.renderSettingsPanel === 'function';

            if (tourReady) {
                patchRenderSettingsCard();
                attachLearnTabListener();
                attachSettingsModalListener();
            }
            if (tourReady && fnReady) {
                clearInterval(iv);
                interceptRenderSettingsPanel();
            }
            if (tries > 80) clearInterval(iv);
        }, 250);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(boot, 150);
    } else {
        document.addEventListener('DOMContentLoaded', boot);
    }
})();
