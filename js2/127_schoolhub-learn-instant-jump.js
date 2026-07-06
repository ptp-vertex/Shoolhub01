/* =====================================================================
   PATCH: ระบบ "วิธีใช้งาน" แบบ Instant Jump (v3)
   -----------------------------------------------------------------------
   พฤติกรรมที่ต้องการ:
   - กดรายการใดในแท็บ "วิธีใช้งาน" → ปิด settings ทันที → นำทางไปหน้าที่
     มี element นั้น → scroll ไปหา element → แสดง tour bubble ทันที ไม่มีดีเลย์
   - ถ้า element ยังไม่อยู่บนหน้าจอ (เช่น ต้องเข้าวิชาก่อน) → แสดง toast
     แนะนำให้ผู้ใช้เข้าวิชาก่อน แล้วระบบจะสอนอัตโนมัติ
   - รองรับทั้งคอมพิวเตอร์ (desktop) และมือถือ (mobile)
   ===================================================================== */
(function () {
    'use strict';

    /* ---------------------------------------------------------------- */
    /* 1) ตาราง "วิธีนำทาง" ของแต่ละ step                                */
    /*    navigate: ฟังก์ชันที่เรียกเพื่อไปหน้าที่มี element นั้น        */
    /*    requiresCourse: true = ต้องเข้าวิชาก่อน                        */
    /* ---------------------------------------------------------------- */
    var STEP_NAV = {
        'nav-main': {
            navigate: function () {
                /* เมนูหลักอยู่บน sidebar ทุกหน้า ไม่ต้อง navigate */
                if (isMobile()) {
                    var btn = document.getElementById('mobile-hamburger-btn');
                    if (btn) btn.click();
                }
            }
        },
        'nav-settings': {
            navigate: function () {
                if (isMobile()) {
                    var btn = document.getElementById('mobile-hamburger-btn');
                    if (btn) btn.click();
                }
            }
        },
        'nav-user-plans': {
            navigate: function () {
                if (isMobile()) {
                    var btn = document.getElementById('mobile-hamburger-btn');
                    if (btn) btn.click();
                }
            }
        },
        'nav-students': {
            navigate: function () {
                if (isMobile()) {
                    var btn = document.getElementById('mobile-hamburger-btn');
                    if (btn) btn.click();
                }
            }
        },
        'dashboard-add-course': {
            navigate: function () {
                if (typeof window.goToHome === 'function') window.goToHome();
            }
        },
        'dashboard-course-grid': {
            navigate: function () {
                if (typeof window.goToHome === 'function') window.goToHome();
            }
        },
        'students-add-btn': {
            navigate: function () {
                if (typeof window.openStudentsManager === 'function') window.openStudentsManager();
            }
        },
        'students-export-btn': {
            navigate: function () {
                if (typeof window.openStudentsManager === 'function') window.openStudentsManager();
            }
        },
        'course-tab-attendance': {
            requiresCourse: true,
            navigate: function () { }
        },
        'attendance-open-calendar': {
            requiresCourse: true,
            navigate: function () {
                if (typeof window.switchCourseTab === 'function') window.switchCourseTab('attendance');
            }
        },
        'course-tab-scores': {
            requiresCourse: true,
            navigate: function () { }
        },
        'course-tab-overview': {
            requiresCourse: true,
            navigate: function () { }
        },
        'settings-tabs': {
            navigate: function () {
                if (typeof window.openSettingsModal === 'function') window.openSettingsModal('general');
            }
        },
        'settings-backup': {
            navigate: function () {
                if (typeof window.openSettingsModal === 'function') window.openSettingsModal('backup-restore');
            }
        }
    };

    /* ---------------------------------------------------------------- */
    /* 2) ตัวช่วย                                                         */
    /* ---------------------------------------------------------------- */
    function isMobile() {
        try { return window.matchMedia && window.matchMedia('(max-width: 767px)').matches; }
        catch (e) { return window.innerWidth <= 767; }
    }

    function deviceKey() { return isMobile() ? 'mobile' : 'desktop'; }

    function findVisible(selector) {
        if (!selector) return null;
        var el;
        try { el = document.querySelector(selector); } catch (e) { return null; }
        if (!el) return null;
        var rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        /* ตรวจสอบด้วย computedStyle แทน class 'hidden' เพราะ Tailwind ใช้ hidden md:flex */
        var p = el;
        for (var i = 0; i < 8 && p && p !== document.body; i++) {
            var cs = window.getComputedStyle(p);
            if (cs.display === 'none' || cs.visibility === 'hidden') return null;
            if (p.getAttribute && p.getAttribute('aria-hidden') === 'true') return null;
            p = p.parentElement;
        }
        return el;
    }

    /* ---------------------------------------------------------------- */
    /* 3) Toast แจ้งเตือนเมื่อต้องเข้าวิชาก่อน                           */
    /* ---------------------------------------------------------------- */
    function showToast(msg) {
        var old = document.getElementById('sh-instant-toast');
        if (old) old.remove();

        var toast = document.createElement('div');
        toast.id = 'sh-instant-toast';
        toast.innerHTML = '<i class="fas fa-circle-info" style="color:#6366f1;margin-right:8px;"></i>' + msg;
        toast.style.cssText = [
            'position:fixed',
            'bottom:24px',
            'left:50%',
            'transform:translateX(-50%)',
            'background:#1e293b',
            'color:#f8fafc',
            'font-size:13.5px',
            'font-weight:700',
            'padding:12px 20px',
            'border-radius:16px',
            'box-shadow:0 8px 24px rgba(15,23,42,.35)',
            'z-index:9999999',
            'white-space:nowrap',
            'max-width:calc(100vw - 32px)',
            'text-align:center',
            'opacity:0',
            'transition:opacity .18s ease'
        ].join(';');
        document.body.appendChild(toast);
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { toast.style.opacity = '1'; });
        });
        setTimeout(function () {
            toast.style.opacity = '0';
            setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
        }, 3500);
    }

    /* ---------------------------------------------------------------- */
    /* 4) ปิด settings modal                                              */
    /* ---------------------------------------------------------------- */
    function closeSettingsAndRun(cb) {
        var closed = false;

        /* ลอง closeSettingsModal ก่อน */
        try {
            if (typeof window.closeSettingsModal === 'function') {
                window.closeSettingsModal();
                closed = true;
            }
        } catch (e) { }

        if (!closed) {
            /* fallback: ซ่อน modal โดยตรง */
            try {
                var modal = document.getElementById('settings-modal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.hidden = true;
                    document.body.classList.remove(
                        'schoolhub-settings-modal-open',
                        'overflow-hidden',
                        'sh-modal-open'
                    );
                }
            } catch (e) { }
        }

        /* ให้ modal ปิดก่อน (2 frames) แล้วค่อย callback */
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (cb) cb();
            });
        });
    }

    /* ---------------------------------------------------------------- */
    /* 5) ฟังก์ชันหลัก: กด step → ปิด settings → navigate → แสดง tour   */
    /* ---------------------------------------------------------------- */
    function jumpToStep(stepId) {
        var tour = window.schoolhubTour;
        if (!tour) return;

        var steps = tour.steps || [];
        var step = null;
        for (var i = 0; i < steps.length; i++) {
            if (steps[i].id === stepId) { step = steps[i]; break; }
        }
        if (!step) return;

        var navInfo = STEP_NAV[stepId] || {};
        var dev = deviceKey();
        var selector = (step.selector && (step.selector[dev] || step.selector.any)) || null;

        /* ปิด overlay/card ที่ค้างอยู่ก่อนทุกครั้ง */
        try {
            if (typeof tour.endCurrent === 'function') tour.endCurrent();
        } catch (e) {}
        /* force ปิด overlay โดยตรงเผื่อ endCurrent ไม่ทำงาน */
        var overlay = document.getElementById('sh-tour-overlay');
        if (overlay) { overlay.style.display = 'none'; overlay.style.opacity = '0'; }
        var card = document.querySelector('.sh-tour-card');
        if (card) { card.style.display = 'none'; }

        /* ถ้าต้องเข้าวิชาก่อน และยังไม่ได้อยู่ในวิชา */
        if (navInfo.requiresCourse) {
            var el = findVisible(selector);
            if (!el) {
                var hasCourse = window.currentActiveCourseId ||
                    (window.state && window.state.courses && window.state.courses.length > 0);
                if (!hasCourse) {
                    showToast('กรุณาสร้างวิชาและเข้าวิชาก่อน แล้วระบบจะสอนอัตโนมัติ');
                } else {
                    showToast('กรุณาเข้าวิชาก่อน แล้วระบบจะสอนส่วนนี้ทันที');
                }
                closeSettingsAndRun(function () {
                    if (typeof window.goToHome === 'function') window.goToHome();
                });
                return;
            }
        }

        /* lock runTourCheck ไว้ก่อนปิด modal เพื่อป้องกัน scheduleCheck จาก closeSettingsModal */
        if (tour && typeof tour.lockJump === 'function') tour.lockJump();

        /* ปิด settings modal ก่อน แล้วค่อย navigate + แสดง tour */
        closeSettingsAndRun(function () {
            /* navigate ไปหน้าที่มี element */
            if (typeof navInfo.navigate === 'function') {
                try { navInfo.navigate(); } catch (e) { }
            }

            /* รอให้ DOM อัปเดตแล้วแสดง tour ทันที */
            waitAndShowTour(stepId, selector, 0);
        });
    }

    /* รอให้ element ปรากฏ แล้วใช้ showStepDirect */
    function waitAndShowTour(stepId, selector, attempt) {
        var el = findVisible(selector);

        if (!el) {
            /* element ยังไม่ปรากฏ — รอ DOM แล้ว retry (สูงสุด 30 ครั้ง = ~3 วินาที) */
            if (attempt < 30) {
                setTimeout(function () { waitAndShowTour(stepId, selector, attempt + 1); }, 100);
            } else {
                /* ไม่เจอ element หลัง 3 วินาที — fallback forceRunStep */
                var tour = window.schoolhubTour;
                if (tour && typeof tour.forceRunStep === 'function') {
                    tour.forceRunStep(stepId);
                }
            }
            return;
        }

        var tour = window.schoolhubTour;
        if (!tour) return;

        /* scroll element ให้อยู่กลางจอก่อน */
        var r = el.getBoundingClientRect();
        var margin = 40;
        var inView = r.top >= margin && r.bottom <= (window.innerHeight - margin);
        if (!inView) {
            try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch (e) { }
        }

        /* ใช้ showStepDirect ซึ่งแสดง step โดยตรงโดยไม่ผ่าน collectPending() */
        var waitMs = inView ? 0 : 280;
        setTimeout(function () {
            /* unlock ก่อน showStepDirect เพื่อให้ advance() ทำงานได้ปกติ */
            if (tour && typeof tour.unlockJump === 'function') tour.unlockJump();
            /* re-query element เผื่อ DOM เปลี่ยน */
            var freshEl = findVisible(selector) || el;
            if (tour && typeof tour.showStepDirect === 'function') {
                tour.showStepDirect(stepId, freshEl);
            } else if (tour && typeof tour.forceRunStep === 'function') {
                tour.forceRunStep(stepId);
            }
        }, waitMs);
    }

    /* ---------------------------------------------------------------- */
    /* 6) Patch ปุ่ม "สอนอีกครั้ง" ใน settings card ให้ใช้ jumpToStep    */
    /*    ใช้ event delegation บน document เพื่อ intercept ทุกปุ่ม        */
    /*    ที่มี data-sh-replay-one ไม่ว่าจะ render เมื่อไหร่               */
    /* ---------------------------------------------------------------- */
    function attachGlobalDelegation() {
        if (window._shJumpGlobalDelegated) return;
        window._shJumpGlobalDelegated = true;

        document.addEventListener('click', function (e) {
            /* ปุ่ม "สอนอีกครั้ง" รายการเดียว */
            var replayBtn = e.target.closest('[data-sh-replay-one]');
            if (replayBtn) {
                /* ตรวจว่าอยู่ใน settings host หรือไม่ */
                var host = document.getElementById('schoolhub-tour-settings-host');
                if (host && host.contains(replayBtn)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    var id = replayBtn.getAttribute('data-sh-replay-one');
                    jumpToStep(id);
                    return;
                }
            }

            /* ปุ่ม "เรียนรู้เพิ่มเติม (สอนอีกครั้งทั้งหมด)" */
            var replayAllBtn = e.target.closest('#sh-tour-replay-all');
            if (replayAllBtn) {
                var host2 = document.getElementById('schoolhub-tour-settings-host');
                if (host2 && host2.contains(replayAllBtn)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    var tour = window.schoolhubTour;
                    if (tour) {
                        if (typeof tour.endCurrent === 'function') tour.endCurrent();
                        if (typeof tour.resetAll === 'function') tour.resetAll();
                    }
                    closeSettingsAndRun(function () {
                        if (typeof window.goToHome === 'function') window.goToHome();
                        setTimeout(function () {
                            if (window.schoolhubTour && typeof window.schoolhubTour.run === 'function') {
                                window.schoolhubTour.run();
                            }
                        }, 200);
                    });
                    return;
                }
            }
        }, true); /* capture = true เพื่อได้ก่อน listener เดิมทุกตัว */
    }

    /* ---------------------------------------------------------------- */
    /* 7) Observe host เพื่อ re-patch เมื่อ content เปลี่ยน              */
    /* ---------------------------------------------------------------- */
    function observeHost() {
        var host = document.getElementById('schoolhub-tour-settings-host');
        if (!host) return;
        if (host._shJumpObserver) return;
        host._shJumpObserver = true;

        /* ไม่ต้อง patchSettingsCardButtons แล้ว เพราะใช้ global delegation แทน */
        var obs = new MutationObserver(function () {
            /* host content เปลี่ยน — ไม่ต้องทำอะไรเพราะ global delegation ทำงานอยู่แล้ว */
        });
        obs.observe(host, { childList: true, subtree: false });
    }

    /* ---------------------------------------------------------------- */
    /* 8) Observe settings panel "learn" เพื่อ patch เมื่อเปิด           */
    /* ---------------------------------------------------------------- */
    function observeLearnPanel() {
        var panel = document.getElementById('schoolhub-settings-panel-learn');
        if (!panel) return;
        if (panel._shJumpPanelObserver) return;
        panel._shJumpPanelObserver = true;

        var obs = new MutationObserver(function () {
            if (!panel.classList.contains('hidden') && panel.style.display !== 'none') {
                setTimeout(observeHost, 30);
                setTimeout(observeHost, 150);
            }
        });
        obs.observe(panel, { attributes: true, attributeFilter: ['class', 'style'] });

        if (!panel.classList.contains('hidden')) {
            setTimeout(observeHost, 30);
        }
    }

    /* ---------------------------------------------------------------- */
    /* 9) Observe settings modal เพื่อ patch เมื่อเปิด                   */
    /* ---------------------------------------------------------------- */
    function observeSettingsModal() {
        var modal = document.getElementById('settings-modal');
        if (!modal) return;
        if (modal._shJumpModalObserver) return;
        modal._shJumpModalObserver = true;

        var obs = new MutationObserver(function () {
            if (!modal.classList.contains('hidden')) {
                setTimeout(function () {
                    observeLearnPanel();
                    observeHost();
                }, 60);
            }
        });
        obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    /* ---------------------------------------------------------------- */
    /* 10) Boot                                                           */
    /* ---------------------------------------------------------------- */
    function boot() {
        /* attach global delegation ทันที — ก่อนทุกอย่าง */
        attachGlobalDelegation();

        /* reset lastContent cache ใน 126 เพื่อให้ re-render ได้ */
        if (typeof window._shTourCardResetCache === 'function') {
            window._shTourCardResetCache();
        }

        observeSettingsModal();
        observeLearnPanel();
        observeHost();

        /* retry เผื่อ modal ยังไม่ถูกสร้าง */
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            observeSettingsModal();
            observeLearnPanel();
            observeHost();
            /* reset cache ทุกครั้งที่ retry เผื่อ 126 patch ช้า */
            if (typeof window._shTourCardResetCache === 'function') {
                window._shTourCardResetCache();
            }
            if (tries > 40) clearInterval(iv);
        }, 500);
    }

    /* expose สำหรับ debug และให้ 125/126 เรียกได้ */
    window._shInstantJump = { jumpToStep: jumpToStep };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(boot, 200);
    } else {
        document.addEventListener('DOMContentLoaded', boot);
    }

})();
