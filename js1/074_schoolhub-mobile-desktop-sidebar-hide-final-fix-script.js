/* 
  DEPRECATED: โค้ดส่วนนี้ถูกย้ายไปรวมศูนย์ไว้ที่ js2/124_schoolhub-desktop-sidebar-collapse-toggle.js 
  เพื่อป้องกันการขัดแย้งของ CSS และการแสดงผล Sidebar เมื่อมีการ Resize หน้าจอ
*/
(function(){
    window.__schoolhubMobileDesktopSidebarHideFinalFix = true;
    window.schoolhubFixMobileSidebarNow = function() {
        if(window.schoolhubApplySidebarCollapseNow) window.schoolhubApplySidebarCollapseNow();
    };
})();
