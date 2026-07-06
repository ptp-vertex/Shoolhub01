
/*
  ULTIMATE SIDEBAR & MENU CONTROLLER (v14 - CSS Injection Method)
  - จัดการ Sidebar แนวนอน (10 วิย่ออัตโนมัติ)
  - จัดการเมนูหลัก (Accordion): ใช้ CSS Injection เพื่อพับทุกเมนูที่อยู่ระหว่างหัวข้อ "เมนูหลัก" และ "เมนูประจำวิชา"
*/
(function () {
    if (window.__schoolhubSidebarUnifiedInitV14Enhanced) return;
    window.__schoolhubSidebarUnifiedInitV14Enhanced = true;

    var STORAGE_KEY = 'schoolhub_sidebar_collapsed';
    var userInteractedWithSidebar = false; 
    var userInteractedWithMainMenu = false;
    var AUTO_COLLAPSE_MS = 10000;

    function isMobile() { return window.innerWidth < 768; }
    function getSidebar() { return document.getElementById('sh-sidebar'); }

    // สร้าง Style Element สำหรับฉีด CSS
    var accordionStyle = document.createElement('style');
    accordionStyle.id = 'sh-accordion-injected-style';
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

    // ฟังก์ชันย่อ/กาง เมนูหลักโดยใช้ CSS Injection
    window.schoolhubSetMainMenuAccordionState = function(collapsed, fromUserInteraction = false) {
        if (fromUserInteraction) {
            userInteractedWithMainMenu = true;
        }

        var label = document.getElementById('nav-main-label');
        if (!label) return;

        // 1. ใช้ CSS Injection เพื่อพับทุกอย่างที่อยู่ระหว่างหัวข้อเมนูหลักและเมนูประจำวิชา
        if (collapsed) {
            // ซ่อนทุกอย่างที่อยู่หลัง nav-main-label จนถึงตัวที่เจอ course-context-menu
            // เราใช้ CSS Selector :has() หรือวิธีไล่ Element เพื่อสร้างกฎ CSS
            var selectors = [];
            var current = label.nextElementSibling;
            while (current && current.id !== 'course-context-menu' && current.id !== 'admin-menu-group') {
                if (current.id) {
                    selectors.push('#' + current.id);
                } else if (current.classList.length > 0) {
                    // ถ้าไม่มี ID ให้ใช้ Class หรือลำดับ (nth-child)
                    // แต่เพื่อความชัวร์ เราจะใส่ attribute พิเศษให้มัน
                    current.setAttribute('data-sh-accordion-item', 'true');
                    selectors.push('[data-sh-accordion-item="true"]');
                }
                current = current.nextElementSibling;
            }
            
            if (selectors.length > 0) {
                accordionStyle.innerHTML = selectors.join(', ') + ' { display: none !important; }';
            }
        } else {
            accordionStyle.innerHTML = '';
        }
        
        // 2. อัปเดตหัวข้อเมนูหลัก
        label.style.cursor = 'pointer';
        label.style.setProperty('display', 'block', 'important');
        label.innerHTML = `<div class="flex items-center justify-between w-full">
            <span>เมนูหลัก</span>
            <i class="fas ${collapsed ? 'fa-chevron-down' : 'fa-chevron-up'} text-[10px] opacity-50"></i>
        </div>`;
        label.onclick = function(e) {
            e.preventDefault();
            var isCurrentlyCollapsed = accordionStyle.innerHTML !== '';
            window.schoolhubSetMainMenuAccordionState(!isCurrentlyCollapsed, true);
        };

        // 3. ปรับแต่งเมนูประจำวิชา
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

    // ใช้ MutationObserver ดักจับการเปลี่ยนแปลงของ Sidebar Nav เพื่ออัปเดตกฎ CSS เมื่อมีเมนูใหม่เพิ่มเข้ามา
    var navObserver = new MutationObserver(function() {
        var isCurrentlyCollapsed = accordionStyle.innerHTML !== '';
        if (isCurrentlyCollapsed) {
            window.schoolhubSetMainMenuAccordionState(true);
        }
    });

    var courseObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'class') {
                var courseMenu = document.getElementById('course-context-menu');
                if (courseMenu && !courseMenu.classList.contains('hidden')) {
                    var isCurrentlyCollapsed = accordionStyle.innerHTML !== '';
                    if (!isCurrentlyCollapsed && !userInteractedWithMainMenu) {
                        window.schoolhubSetMainMenuAccordionState(true);
                    }
                } else {
                    var isCurrentlyCollapsed = accordionStyle.innerHTML !== '';
                    if (isCurrentlyCollapsed && !userInteractedWithMainMenu) {
                        window.schoolhubSetMainMenuAccordionState(false);
                    }
                }
            }
        });
    });

    function init() {
        if (isMobile()) return;
        
        var sidebarNav = document.querySelector('#sh-sidebar nav');
        if (sidebarNav) {
            navObserver.observe(sidebarNav, { childList: true });
        }

        var courseMenu = document.getElementById('course-context-menu');
        if (courseMenu) {
            courseObserver.observe(courseMenu, { attributes: true });
            if (!courseMenu.classList.contains('hidden')) {
                window.schoolhubSetMainMenuAccordionState(true);
            } else {
                window.schoolhubSetMainMenuAccordionState(false);
            }
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

    var _oldEnter = window.enterCourse;
    window.enterCourse = function(id) {
        if (typeof _oldEnter === 'function') _oldEnter(id);
        userInteractedWithMainMenu = false;
        setTimeout(function() { window.schoolhubSetMainMenuAccordionState(true); }, 50);
    };

    var _oldHome = window.goToHome;
    window.goToHome = function() {
        if (typeof _oldHome === 'function') _oldHome();
        userInteractedWithMainMenu = false;
        setTimeout(function() { window.schoolhubSetMainMenuAccordionState(false); }, 50);
    };

    init();

    window.addEventListener('resize', function() {
        if (!isMobile()) {
            applySidebarWidth(false);
            localStorage.setItem(STORAGE_KEY, '0');
            userInteractedWithSidebar = false;
        } else {
            var aside = getSidebar();
            if (aside) aside.classList.add('hidden');
        }
    });

    setInterval(function() {
        var aside = getSidebar();
        if (aside && !isMobile()) {
            aside.classList.remove('hidden');
            aside.style.setProperty('display', 'flex', 'important');
        }
    }, 1000);
})();
