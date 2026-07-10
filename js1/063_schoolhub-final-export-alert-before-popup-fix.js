
(function(){
  function isFalse(v){ return v === false || v === 0 || v === '0' || String(v).toLowerCase() === 'false' || String(v).trim() === 'ปิด'; }
  function getPlanObj(){
    var dir = window.__currentUserDir || {};
    var p = {};
    try { if (typeof window.getCurrentPlanObject === 'function') p = window.getCurrentPlanObject() || {}; } catch(e) {}
    try {
      var pid = String((dir && dir.planId) || (p && p.id) || '').trim();
      var plans = window.subscriptionPlans || window.publicPlans || [];
      if (pid && Array.isArray(plans)) {
        var found = plans.find(function(x){ return String((x && x.id) || '').trim() === pid; });
        if (found) p = Object.assign({}, found, p);
      }
    } catch(e) {}
    try { p = Object.assign({}, p || {}, dir || {}); } catch(e) {}
    return p || {};
  }
  function canExport(){
    try { if (window.isAdmin === true || window.currentUserRole === 'admin') return true; } catch(e) {}
    try { if (typeof window.currentPlanAllows === 'function' && window.currentPlanAllows('export') === false) return false; } catch(e) {}
    var p = getPlanObj();
    if (isFalse(p.allowExport)) return false;
    if (isFalse(p.export) || isFalse(p.canExport) || isFalse(p.enableExport)) return false;
    return true;
  }
  function showNoExport(){
    if (typeof window.showCustomAlert === 'function') {
      window.showCustomAlert('แผนนี้ไม่รองรับ Export', 'กรุณาอัปเกรดแผนเพื่อส่งออกไฟล์ Excel', true);
    } else {
      alert('แผนนี้ไม่รองรับ Export\nกรุณาอัปเกรดแผนเพื่อส่งออกไฟล์ Excel');
    }
  }
  window.__schoolhubDenyExportNow = function(){
    if (canExport()) return false;
    showNoExport();
    return true;
  };

  // ปิด popup ดาวน์โหลดที่อาจถูกเปิดค้างจากโค้ดชุดเก่า
  function closeExportPopups(){
    ['schoolhub-overview-export-room-modal','schoolhub-attendance-export-modal','student-export-room-modal','export-date-modal','download-modal','schoolhub-overview-excel-room-modal-force','schoolhub-overview-excel-room-modal','export-room-modal','attendance-export-modal'].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      if (window.schoolhubCloseExportModal) window.schoolhubCloseExportModal(el);
      else { el.classList.add('hidden'); el.style.display = 'none'; el.style.pointerEvents = 'none'; el.style.visibility = 'hidden'; }
    });
  }

  // ครอบฟังก์ชัน Export ทุกชื่อที่ใช้ในไฟล์ ให้แจ้งเตือนก่อนเสมอ
  ['exportScoresToExcel','exportAttendanceToExcel','exportStudentsToExcel','downloadExcelMultiSheet'].forEach(function(name){
    var old = window[name];
    if (typeof old === 'function' && !old.__exportAlertFirstFinal){
      var fn = function(){
        if (window.__schoolhubDenyExportNow()) { closeExportPopups(); return; }
        return old.apply(this, arguments);
      };
      fn.__exportAlertFirstFinal = true;
      window[name] = fn;
    }
  });

  // ดักปุ่มโหลด Excel หน้า “ภาพรวม” ก่อน listener เก่าจะเปิด popup
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('button, a');
    if(!btn) return;
    if(btn.hasAttribute('data-export-dismiss') || (window.schoolhubIsExportDismissButton && window.schoolhubIsExportDismissButton(btn))) return;
    var text = (btn.textContent || '').replace(/\s+/g,' ').trim();
    var on = btn.getAttribute('onclick') || '';
    var inOverview = !!(btn.closest && btn.closest('#course-tab-overview'));
    var isOverviewExcel = inOverview && (on.indexOf('exportScoresToExcel') !== -1 || (text.indexOf('โหลด') !== -1 && text.indexOf('Excel') !== -1));
    if(isOverviewExcel && window.__schoolhubDenyExportNow()){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      closeExportPopups();
      return false;
    }
  }, true);
})();
