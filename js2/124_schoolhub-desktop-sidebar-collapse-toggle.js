/*
  PATCH: เมนูด้านซ้าย (เดสก์ท็อป) แบบย่อ/ขยายได้ + แก้ปัญหาเมนูหายตอนย่อจอเป็นแนวตั้งแล้วขยายกลับมาเต็มจอ

  ปัญหาเดิม: ถ้าย่อหน้าต่างเบราว์เซอร์บนคอมให้แคบลง (เข้าสู่โหมดมือถือ) แล้วขยายกลับมาเต็มจอ
  เมนูด้านซ้าย (aside) บางครั้งไม่กลับมาแสดงผล

  พฤติกรรมใหม่ที่ต้องการ:
  - โหมดปกติบนคอม: เมนูเต็มแบบเดิม มีปุ่ม "ย่อเมนู" ให้กดย่อเป็นไอคอนอย่างเดียว (โปรไฟล์เหลือแค่รูป)
  - กดปุ่มเดิมซ้ำ (ตอนนี้จะเป็น "ขยายเมนู") กลับมาเป็นเมนูเต็มแบบปกติได้
  - ถ้าย่อจอลงจนเป็นโหมดมือถือ (แสดงปุ่มแฮมเบอร์เกอร์แบบเดิม) แล้วขยายจอกลับมาเป็นเดสก์ท็อปอีกครั้ง
    ระบบจะเปิดเมนูมาเป็น "แบบย่อ (ไอคอน)" ให้เองก่อนเสมอ กันปัญหาเมนูเต็มโผล่มาผิดจังหวะ/หายไป
    ผู้ใช้กดปุ่มขยายเพื่อดูเมนูแบบเต็มได้ตามต้องการ
*/
(function () {
    if (window.__schoolhubSidebarCollapseInit) return;
    window.__schoolhubSidebarCollapseInit = true;

    var STORAGE_KEY = 'schoolhub_sidebar_collapsed';

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
        if (isMobileWidth()) return; // บนมือถือใช้เมนูแบบ hamburger เดิม ไม่เกี่ยวกับปุ่มนี้
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
            // เพิ่งขยายจอกลับมาจากโหมดมือถือ: เปิดเป็นเมนูย่อ (ไอคอน) ก่อนเสมอ
            applyCollapsedState(true);
            setCollapsedPref(true);
        }
        lastMode = nowMode;
    }

    function initSidebarState() {
        if (isMobileWidth()) return;
        applyCollapsedState(getCollapsedPref());
    }

    document.addEventListener('DOMContentLoaded', function () {
        initSidebarState();
        setTimeout(initSidebarState, 300);
    });
    window.addEventListener('resize', function () { setTimeout(handleModeTransition, 60); });
    window.addEventListener('orientationchange', function () { setTimeout(handleModeTransition, 150); });

    window.schoolhubApplySidebarCollapseNow = function () { initSidebarState(); };
})();
