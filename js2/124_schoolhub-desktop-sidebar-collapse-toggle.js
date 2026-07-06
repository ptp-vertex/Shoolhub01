/*
  UNIFIED SIDEBAR CONTROLLER (v16 - รวมระบบย่อแถบข้าง + ระบบพับเมนูหลัก)

  ส่วนที่ 1: ย่อ/กางแถบข้างทั้งแถบ (Sidebar แนวนอน)
  - เมื่อรีเฟรชหน้าจอ: แสดงเมนูเต็ม 10 วินาที แล้วย่ออัตโนมัติ (ยกเว้นผู้ใช้กดเองก่อน)
  - เมื่อขยายจอกลับมาจากโหมดมือถือ: แสดงเมนูทันทีตามสถานะล่าสุด

  ส่วนที่ 2: ระบบเมนูหลัก (Accordion - พับ/กางกลุ่ม "เมนูหลัก" เช่น ห้องเรียนของฉัน/ฐานข้อมูลนักเรียน/ตั้งค่า)
  - คลิกที่หัวข้อ "เมนูหลัก" เพื่อพับ/กางได้เองตลอดเวลา
  - เข้าหน้าวิชา (enterCourse) -> พับเมนูหลักอัตโนมัติ ให้เมนูประจำวิชาเลื่อนขึ้นไปอยู่บนสุด
  - กลับหน้าหลัก (goToHome) -> กางเมนูหลักออกตามปกติ
  - ใช้วิธีไล่ element ทุกตัวที่อยู่ระหว่างหัวข้อ "เมนูหลัก" กับ "เมนูประจำวิชา/เมนูแอดมิน" แล้วซ่อนด้วย CSS rule เดียว
    (ไม่ hardcode รายชื่อ id) จึงพับปุ่มเมนูหลักเพิ่มเติมที่ระบบ/แอดมินฝังเข้ามาทีหลังไปด้วยเสมอ
    รวมถึงปุ่มที่ถูกลบแล้วสร้างใหม่ซ้ำๆด้วยสคริปต์อื่น (เช่นระบบเมนูหลักเพิ่มเติมที่รีเฟรชปุ่มทุก 3 วิ)
*/
(function () {
    if (window.__schoolhubSidebarCollapseInit) return;
    window.__schoolhubSidebarCollapseInit = true;

    /* ========================= ส่วนที่ 1: ย่อ/กางแถบข้าง ========================= */

    var STORAGE_KEY = 'schoolhub_sidebar_collapsed';
    var userInteracted = false;

    function isMobileWidth() {
        return window.innerWidth < 768;
    }

    function getSidebar() { return document.getElementById('sh-sidebar'); }

    function getCollapsedPref() {
        try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return true; }
    }
    function setCollapsedPref(val) {
        try { localStorage.setItem(STORAGE_KEY, val ? '1' : '0'); } catch (e) {}
    }

    function forceShowSidebar() {
        var aside = getSidebar();
        if (!aside) return;

        // ล้างทุกอย่างที่อาจจะซ่อนเมนู
        aside.classList.remove('hidden');
        aside.style.setProperty('display', 'flex', 'important');
        aside.style.setProperty('visibility', 'visible', 'important');
        aside.style.setProperty('opacity', '1', 'important');
        aside.style.setProperty('pointer-events', 'auto', 'important');
        aside.style.setProperty('width', '', ''); // ให้ CSS จัดการความกว้าง
        aside.style.setProperty('min-width', '', '');
        aside.style.setProperty('max-width', '', '');
        aside.style.setProperty('height', '', '');
        aside.style.setProperty('overflow', 'visible', 'important');
    }

    function applyCollapsedState(collapsed) {
        var aside = getSidebar();
        if (!aside) return;

        if (!isMobileWidth()) {
            forceShowSidebar();
            aside.classList.toggle('sh-sidebar-collapsed', !!collapsed);

            var icon = document.getElementById('sh-sidebar-toggle-icon');
            if (icon) icon.classList.toggle('sh-flip', !!collapsed);
            var btn = document.getElementById('sh-sidebar-toggle-btn');
            if (btn) btn.title = collapsed ? 'ขยายเมนู' : 'ย่อเมนู';
            var label = document.getElementById('sh-sidebar-toggle-label');
            if (label) label.textContent = collapsed ? 'ขยายเมนู' : 'ย่อเมนู';
        } else {
            // โหมดมือถือ: ซ่อน Sidebar
            aside.classList.add('hidden');
            aside.style.setProperty('display', 'none', 'important');
        }
    }

    window.toggleSchoolHubSidebar = function () {
        if (isMobileWidth()) return;
        userInteracted = true;
        var aside = getSidebar();
        if (!aside) return;
        var nextCollapsed = !aside.classList.contains('sh-sidebar-collapsed');
        applyCollapsedState(nextCollapsed);
        setCollapsedPref(nextCollapsed);
    };

    var lastMode = isMobileWidth() ? 'mobile' : 'desktop';

    function handleModeTransition() {
        var nowMode = isMobileWidth() ? 'mobile' : 'desktop';
        if (nowMode === lastMode) return;

        if (nowMode === 'desktop') {
            applyCollapsedState(getCollapsedPref());
        } else {
            var aside = getSidebar();
            if (aside) {
                aside.classList.add('hidden');
                aside.style.setProperty('display', 'none', 'important');
            }
        }
        lastMode = nowMode;
    }

    function initSidebarState() {
        if (isMobileWidth()) return;

        // 1. แสดงเมนูเต็มทันทีตอนโหลด (Refresh)
        applyCollapsedState(false);

        // 2. ตั้งเวลา 10 วินาทีเพื่อย่ออัตโนมัติ
        setTimeout(function () {
            if (!userInteracted && !isMobileWidth()) {
                applyCollapsedState(true);
                setCollapsedPref(true);
            }
        }, 10000);
    }

    // ฟังเสียง Resize ตลอดเวลา
    window.addEventListener('resize', handleModeTransition);

    // รันทันทีและรันซ้ำเมื่อ DOM พร้อม
    initSidebarState();
    document.addEventListener('DOMContentLoaded', initSidebarState);

    // ระบบตรวจสอบความปลอดภัย (Guard): บังคับแสดงผลถ้าอยู่ใน Desktop แล้วเมนูหาย
    setInterval(function () {
        if (!isMobileWidth()) {
            var aside = getSidebar();
            if (aside && (aside.classList.contains('hidden') || aside.style.display === 'none')) {
                applyCollapsedState(getCollapsedPref());
            }
        }
    }, 1000);

    window.schoolhubApplySidebarCollapseNow = function () { initSidebarState(); };

    /* ========================= ส่วนที่ 2: ระบบพับเมนูหลัก (Accordion) ========================= */

    var userInteractedWithMainMenu = false;

    // Style element ที่ใช้ฉีดกฎ CSS สำหรับซ่อนกลุ่ม "เมนูหลัก" ตอนพับ
    var accordionStyle = document.createElement('style');
    accordionStyle.id = 'sh-accordion-injected-style';
    document.head.appendChild(accordionStyle);

    function isMainMenuCollapsed() {
        return accordionStyle.innerHTML !== '';
    }

    // ฟังก์ชันย่อ/กาง "เมนูหลัก" (ครอบคลุมทั้งเมนูเดิมและเมนูหลักเพิ่มเติมที่ระบบ/แอดมินฝังเข้ามาทีหลัง)
    window.schoolhubSetMainMenuAccordionState = function (collapsed, fromUserInteraction) {
        if (fromUserInteraction) userInteractedWithMainMenu = true;

        var label = document.getElementById('nav-main-label');
        if (!label) return;

        // ถ้ากำลังอยู่ในโหมดแอดมิน (admin-menu-group แสดงอยู่ และ/หรือ nav-main-label ถูกซ่อนไว้โดย setAdminNavigationMode)
        // ห้ามยุ่งกับเมนูหลักของผู้ใช้ทั่วไปเด็ดขาด เพราะโหมดแอดมินไม่ต้องมีเมนูหลักโชว์อยู่แล้ว
        var adminGroup = document.getElementById('admin-menu-group');
        var inAdminMode = !!(adminGroup && !adminGroup.classList.contains('hidden'));
        if (inAdminMode || label.classList.contains('hidden')) {
            accordionStyle.innerHTML = ''; // เคลียร์กฎเก่าที่อาจค้างไว้ ไม่ให้หลุดไปซ่อนเมนูแอดมินโดยไม่ตั้งใจ
            return;
        }

        if (collapsed) {
            // ไล่ทุก element ที่อยู่ระหว่างหัวข้อ "เมนูหลัก" กับ "เมนูประจำวิชา"/"เมนูแอดมิน"
            // แล้วกำหนด attribute พิเศษให้ทุกตัว เพื่อซ่อนด้วย CSS rule เดียว
            // วิธีนี้ครอบคลุมเมนูที่ถูกเพิ่ม/สร้างใหม่ทีหลังโดยอัตโนมัติ ไม่ต้อง hardcode รายชื่อ id
            var current = label.nextElementSibling;
            while (current && current.id !== 'course-context-menu' && current.id !== 'admin-menu-group') {
                current.setAttribute('data-sh-accordion-item', 'true');
                current = current.nextElementSibling;
            }
            accordionStyle.innerHTML = '[data-sh-accordion-item="true"] { display: none !important; }';
        } else {
            accordionStyle.innerHTML = '';
        }

        label.style.cursor = 'pointer';
        label.style.setProperty('display', 'block', 'important');
        label.innerHTML = '<div class="flex items-center justify-between w-full">' +
            '<span>เมนูหลัก</span>' +
            '<i class="fas ' + (collapsed ? 'fa-chevron-down' : 'fa-chevron-up') + ' text-[10px] opacity-50"></i>' +
            '</div>';
        label.onclick = function (e) {
            e.preventDefault();
            window.schoolhubSetMainMenuAccordionState(!isMainMenuCollapsed(), true);
        };

        // ปรับแต่งเมนูประจำวิชาให้เลื่อนขึ้นสวยงามเมื่อเมนูหลักพับ
        var courseMenu = document.getElementById('course-context-menu');
        if (courseMenu) {
            var cLabel = document.getElementById('sidebar-course-name');
            if (collapsed) {
                courseMenu.style.setProperty('margin-top', '0.5rem', 'important');
                if (cLabel) {
                    cLabel.style.setProperty('margin-top', '0.5rem', 'important');
                    cLabel.style.setProperty('border-top', '1px solid #f1f5f9', 'important');
                    cLabel.style.setProperty('padding-top', '1rem', 'important');
                }
            } else {
                courseMenu.style.removeProperty('margin-top');
                if (cLabel) {
                    cLabel.style.removeProperty('margin-top');
                    cLabel.style.removeProperty('border-top');
                    cLabel.style.removeProperty('padding-top');
                }
            }
        }
    };

    // ดักจับตอนมีปุ่มเมนูใหม่ถูกเพิ่ม/สร้างใหม่ใน sidebar nav
    // (เช่น ระบบเมนูหลักเพิ่มเติมของแอดมินที่สร้างปุ่มใหม่ซ้ำทุก 3 วิ)
    // ถ้าตอนนั้นเมนูหลักพับอยู่ ให้พับปุ่มที่เพิ่งถูกเพิ่มเข้ามาไปด้วยทันที
    var navObserver = new MutationObserver(function () {
        if (isMainMenuCollapsed()) {
            window.schoolhubSetMainMenuAccordionState(true);
        }
    });

    // ดักจับการเข้า/ออกหน้าวิชา จาก class ของ course-context-menu (เผื่อมีที่อื่นเรียก switchCourseTab ตรงๆ)
    var courseObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.attributeName === 'class') {
                var courseMenu = document.getElementById('course-context-menu');
                var collapsedNow = isMainMenuCollapsed();
                if (courseMenu && !courseMenu.classList.contains('hidden')) {
                    if (!collapsedNow && !userInteractedWithMainMenu) {
                        window.schoolhubSetMainMenuAccordionState(true);
                    }
                } else {
                    if (collapsedNow && !userInteractedWithMainMenu) {
                        window.schoolhubSetMainMenuAccordionState(false);
                    }
                }
            }
        });
    });

    function initMainMenuAccordion() {
        if (isMobileWidth()) return;

        var sidebarNav = document.querySelector('#sh-sidebar nav');
        if (sidebarNav) navObserver.observe(sidebarNav, { childList: true });

        var courseMenu = document.getElementById('course-context-menu');
        if (courseMenu) {
            courseObserver.observe(courseMenu, { attributes: true });
            window.schoolhubSetMainMenuAccordionState(!courseMenu.classList.contains('hidden'));
        }
    }

    // ครอบฟังก์ชัน enterCourse/goToHome เดิม (ที่ผ่านการ wrap จากสคริปต์อื่นมาแล้ว) เพื่อสั่งพับ/กางเมนูหลัก
    var _oldEnter = window.enterCourse;
    window.enterCourse = function (id) {
        if (typeof _oldEnter === 'function') _oldEnter(id);
        userInteractedWithMainMenu = false; // เข้าหน้าวิชาใหม่ ให้ auto-fold ทำงานได้เสมอ
        setTimeout(function () { window.schoolhubSetMainMenuAccordionState(true); }, 50);
    };

    var _oldHome = window.goToHome;
    window.goToHome = function () {
        if (typeof _oldHome === 'function') _oldHome();
        userInteractedWithMainMenu = false; // กลับหน้าหลัก ให้ auto-expand ทำงานได้เสมอ
        setTimeout(function () { window.schoolhubSetMainMenuAccordionState(false); }, 50);
    };

    function initAccordionWhenReady() {
        initMainMenuAccordion();
        window.addEventListener('resize', function () { if (!isMobileWidth()) initMainMenuAccordion(); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAccordionWhenReady);
    } else {
        initAccordionWhenReady();
    }
})();
