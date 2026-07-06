/*
  PATCH: เมนูด้านซ้าย (เดสก์ท็อป) แบบย่อ/ขยายได้ + แก้ปัญหาเมนูหายตอนย่อจอเป็นแนวตั้งแล้วขยายกลับมาเต็มจอ
  
  พฤติกรรมใหม่:
  1. เมื่อรีเฟรชหน้าจอ: แสดงเมนูเต็ม 5 วินาที แล้วย่ออัตโนมัติ (ยกเว้นผู้ใช้กดเองก่อน)
  2. เมื่อขยายจอกลับมาจากโหมดมือถือ: แสดงเมนูทันทีโดยไม่ต้องรีเฟรช
*/
(function () {
    if (window.__schoolhubSidebarCollapseInit) return;
    window.__schoolhubSidebarCollapseInit = true;

    var STORAGE_KEY = 'schoolhub_sidebar_collapsed';
    var userInteracted = false; 

    function isMobileWidth() {
        return window.matchMedia && window.matchMedia('(max-width:767px)').matches;
    }

    function getSidebar() { return document.getElementById('sh-sidebar'); }

    function getCollapsedPref() {
        try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
    }
    function setCollapsedPref(val) {
        try { localStorage.setItem(STORAGE_KEY, val ? '1' : '0'); } catch (e) {}
    }

    function applyCollapsedState(collapsed) {
        var aside = getSidebar();
        if (!aside) return;
        aside.classList.toggle('sh-sidebar-collapsed', !!collapsed);
        var icon = document.getElementById('sh-sidebar-toggle-icon');
        if (icon) icon.classList.toggle('sh-flip', !!collapsed);
        var btn = document.getElementById('sh-sidebar-toggle-btn');
        if (btn) btn.title = collapsed ? 'ขยายเมนู' : 'ย่อเมนู';
        var label = document.getElementById('sh-sidebar-toggle-label');
        if (label) label.textContent = collapsed ? 'ขยายเมนู' : 'ย่อเมนู';
    }

    window.toggleSchoolHubSidebar = function () {
        if (isMobileWidth()) return;
        userInteracted = true; // ผู้ใช้กดเองแล้ว ยกเลิก Auto-collapse
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
        
        var aside = getSidebar();
        if (nowMode === 'desktop') {
            if (aside) {
                aside.classList.remove('hidden');
                aside.classList.add('md:flex');
                aside.style.setProperty('display', 'flex', 'important');
            }
            applyCollapsedState(getCollapsedPref());
        } else {
            if (aside) {
                aside.classList.add('hidden');
                aside.style.removeProperty('display');
            }
        }
        lastMode = nowMode;
    }

    function initSidebarState() {
        if (isMobileWidth()) return;
        var aside = getSidebar();
        if (aside) {
            aside.classList.remove('hidden');
            aside.classList.add('md:flex');
            aside.style.setProperty('display', 'flex', 'important');
        }
        
        // ตอนโหลดหน้าจอใหม่ (Refresh): แสดงเมนูเต็มก่อน
        applyCollapsedState(false);
        
        // ตั้งเวลา 5 วินาทีเพื่อย่ออัตโนมัติ (เฉพาะตอนโหลดครั้งแรก)
        setTimeout(function() {
            if (!userInteracted && !isMobileWidth()) {
                applyCollapsedState(true);
                setCollapsedPref(true);
            }
        }, 5000);
    }

    document.addEventListener('DOMContentLoaded', function () {
        initSidebarState();
        setTimeout(function(){ if(!userInteracted) initSidebarState(); }, 300);
    });
    window.addEventListener('resize', function () { setTimeout(handleModeTransition, 60); });
    window.addEventListener('orientationchange', function () { setTimeout(handleModeTransition, 150); });

    window.schoolhubApplySidebarCollapseNow = function () { initSidebarState(); };
})();
