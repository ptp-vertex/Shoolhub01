
/*
  ULTIMATE SIDEBAR & MENU CONTROLLER (v15 - Sibling Selector Method)
  - จัดการ Sidebar แนวนอน (10 วิย่ออัตโนมัติ)
  - จัดการเมนูหลัก (Accordion): ใช้ CSS Sibling Selector ซ่อนทุกอย่างที่อยู่ระหว่าง "เมนูหลัก" และ "เมนูวิชา"
  - นี่คือวิธีที่เสถียรที่สุด เพราะครอบคลุมเมนูที่ฝังมาทุกรูปแบบ 100%
*/
(function () {
    if (window.__schoolhubSidebarUnifiedInitV15) return;
    window.__schoolhubSidebarUnifiedInitV15 = true;

    var STORAGE_KEY = 'schoolhub_sidebar_collapsed';
    var userInteractedWithSidebar = false; 
    var userInteractedWithMainMenu = false;
    var AUTO_COLLAPSE_MS = 10000;

    function isMobile() { return window.innerWidth < 768; }
    function getSidebar() { return document.getElementById('sh-sidebar'); }

    // ฉีด CSS กฎเหล็ก: เมื่อสั่งพับเมนูหลัก ให้ซ่อนทุกอย่างที่เป็น sibling ต่อจาก #nav-main-label 
    // ยกเว้น #course-context-menu และ #admin-menu-group
    var accordionStyle = document.createElement('style');
    accordionStyle.id = 'sh-accordion-v15-style';
    document.head.appendChild(accordionStyle);

    function applySidebarWidth(collapsed) {
        var aside = getSidebar();
        if (!aside) return;
        if (!isMobile()) {
            aside.classList.remove('hidden');
            aside.style.setProperty('display', 'flex', 'important');
        }
        aside.classList.toggle('sh-sidebar-collapsed', !!collapsed);
        var icon = document.getElementById('sh-sidebar-toggle-icon');
        if (icon) icon.classList.toggle('sh-flip', !!collapsed);
    }

    window.schoolhubSetMainMenuAccordionState = function(collapsed, fromUserInteraction = false) {
        if (fromUserInteraction) {
            userInteractedWithMainMenu = true;
        }

        var label = document.getElementById('nav-main-label');
        if (!label) return;

        if (collapsed) {
            // ใช้ Sibling Selector (~) เพื่อกวาดทุกอย่างที่ตามหลัง label มา
            // แต่ยกเว้นตัวที่เราต้องการให้แสดงเสมอ
            accordionStyle.innerHTML = `
                #nav-main-label ~ *:not(#course-context-menu):not(#admin-menu-group) { 
                    display: none !important; 
                }
            `;
        } else {
            accordionStyle.innerHTML = '';
        }
        
        // อัปเดต UI หัวข้อ
        label.style.cursor = 'pointer';
        label.style.setProperty('display', 'block', 'important');
        label.innerHTML = `<div class="flex items-center justify-between w-full pointer-events-none">
            <span>เมนูหลัก</span>
            <i class="fas ${collapsed ? 'fa-chevron-down' : 'fa-chevron-up'} text-[10px] opacity-50"></i>
        </div>`;
        
        label.onclick = function(e) {
            var isCurrentlyCollapsed = accordionStyle.innerHTML !== '';
            window.schoolhubSetMainMenuAccordionState(!isCurrentlyCollapsed, true);
        };

        // ปรับ UI เมนูวิชาให้ชิดขอบบนเมื่อพับเมนูหลัก
        var courseMenu = document.getElementById('course-context-menu');
        if (courseMenu) {
            if (collapsed) {
                courseMenu.style.setProperty('margin-top', '0.5rem', 'important');
                var cLabel = document.getElementById('sidebar-course-name');
                if (cLabel) {
                    cLabel.style.setProperty('margin-top', '0.5rem', 'important');
                    cLabel.style.setProperty('border-top', '1px solid #f1f5f9', 'important');
                    cLabel.style.setProperty('padding-top', '1rem', 'important');
                }
            } else {
                courseMenu.style.removeProperty('margin-top');
                var cLabel = document.getElementById('sidebar-course-name');
                if (cLabel) {
                    cLabel.style.removeProperty('margin-top');
                    cLabel.style.removeProperty('border-top');
                    cLabel.style.removeProperty('padding-top');
                }
            }
        }
    };

    // ตรวจสอบสถานะเมนูวิชาตลอดเวลา
    function checkCourseMenuState() {
        var courseMenu = document.getElementById('course-context-menu');
        if (!courseMenu || userInteractedWithMainMenu) return;
        
        var isCourseVisible = !courseMenu.classList.contains('hidden');
        var isCurrentlyCollapsed = accordionStyle.innerHTML !== '';
        
        if (isCourseVisible && !isCurrentlyCollapsed) {
            window.schoolhubSetMainMenuAccordionState(true);
        } else if (!isCourseVisible && isCurrentlyCollapsed) {
            window.schoolhubSetMainMenuAccordionState(false);
        }
    }

    function init() {
        if (isMobile()) return;
        
        // เริ่มต้นตรวจสอบสถานะ
        checkCourseMenuState();

        // ดักจับการเปลี่ยนแปลงของ Sidebar Nav เพื่อรองรับเมนูที่โหลดช้า
        var sidebarNav = document.querySelector('#sh-sidebar nav');
        if (sidebarNav) {
            var observer = new MutationObserver(checkCourseMenuState);
            observer.observe(sidebarNav, { attributes: true, childList: true, subtree: true });
        }

        applySidebarWidth(false);
        localStorage.setItem(STORAGE_KEY, '0');

        setTimeout(function() {
            if (!userInteractedWithSidebar && !isMobile()) {
                applySidebarWidth(true);
                localStorage.setItem(STORAGE_KEY, '1');
            }
        }, AUTO_COLLAPSE_MS);
    }

    window.toggleSchoolHubSidebar = function () {
        userInteractedWithSidebar = true;
        var aside = getSidebar();
        if (!aside) return;
        var next = !aside.classList.contains('sh-sidebar-collapsed');
        applySidebarWidth(next);
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    };

    // Hook เข้ากับฟังก์ชันเปลี่ยนหน้าของระบบ
    var _oldEnter = window.enterCourse;
    window.enterCourse = function(id) {
        if (typeof _oldEnter === 'function') _oldEnter(id);
        userInteractedWithMainMenu = false;
        setTimeout(checkCourseMenuState, 100);
    };

    var _oldHome = window.goToHome;
    window.goToHome = function() {
        if (typeof _oldHome === 'function') _oldHome();
        userInteractedWithMainMenu = false;
        setTimeout(checkCourseMenuState, 100);
    };

    init();

    window.addEventListener('resize', function() {
        if (!isMobile()) {
            applySidebarWidth(false);
            localStorage.setItem(STORAGE_KEY, '0');
            userInteractedWithSidebar = false;
        }
    });

    // ตรวจสอบความถูกต้องทุก 1 วินาที (กันเหนียว)
    setInterval(checkCourseMenuState, 1000);
})();
