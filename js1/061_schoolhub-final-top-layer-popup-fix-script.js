
(function(){
  if(window.__schoolhubFinalTopLayerPopupFix) return;
  window.__schoolhubFinalTopLayerPopupFix = true;

  var TOP_Z = 2147483647;
  var CONFIRM_Z = 2147483646;
  var EXPORT_Z = 2147483000;

  function appendToBody(el){
    if(el && el.parentElement !== document.body) document.body.appendChild(el);
    else if(el) document.body.appendChild(el); // ย้ายไปท้าย body เพื่อชนะ stacking order กรณี z-index เท่ากัน
  }
  function setFixedLayer(el,z){
    if(!el) return;
    appendToBody(el);
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.zIndex = String(z);
  }
  window.schoolhubBringPopupToFront = function(id){
    var el = typeof id === 'string' ? document.getElementById(id) : id;
    if(!el) return;
    var z = id === 'custom-alert' || el.id === 'custom-alert' ? TOP_Z : (id === 'custom-confirm' || el.id === 'custom-confirm' ? CONFIRM_Z : EXPORT_Z);
    setFixedLayer(el,z);
  };

  function hardCloseExportPopupsBeforeAlert(){
    // ไม่ปิด popup ดาวน์โหลด แต่ลดชั้นให้แน่นอน เพื่อให้ alert ที่เกิดใหม่อยู่ด้านหน้าเสมอ
    document.querySelectorAll('.schoolhub-export-popup,#schoolhub-overview-export-room-modal,#schoolhub-attendance-export-modal,#student-export-room-modal,#export-date-modal,#download-modal').forEach(function(el){
      if(el){ el.style.zIndex = String(EXPORT_Z); appendToBody(el); }
    });
  }

  var oldAlert = window.showCustomAlert;
  window.showCustomAlert = function(title,message,isError){
    hardCloseExportPopupsBeforeAlert();
    var modal = document.getElementById('custom-alert');
    var box = document.getElementById('custom-alert-box');
    if(!modal || !box){
      if(typeof oldAlert === 'function') return oldAlert.apply(this,arguments);
      return alert((title||'') + (message ? '\n' + message : ''));
    }
    document.getElementById('custom-alert-title').textContent = title || 'แจ้งเตือน';
    document.getElementById('custom-alert-title').className = 'text-2xl font-bold mb-2 ' + (isError ? 'text-rose-600' : 'text-emerald-600');
    document.getElementById('custom-alert-message').textContent = message || '';
    document.getElementById('custom-alert-icon').innerHTML = isError ? '<i class="fas fa-times-circle text-rose-500 drop-shadow-md"></i>' : '<i class="fas fa-check-circle text-emerald-500 drop-shadow-md"></i>';
    setFixedLayer(modal, TOP_Z);
    box.style.zIndex = String(TOP_Z);
    modal.classList.remove('hidden');
    setTimeout(function(){ box.classList.remove('scale-95','opacity-0'); box.classList.add('scale-100','opacity-100'); }, 10);
  };

  var oldConfirm = window.showCustomConfirm;
  // Re-entrancy guard: prevents the "confirm asks to confirm again instead of
  // showing success" symptom that happened when showCustomConfirm was invoked
  // more than once for the same action (e.g. a click handler firing twice),
  // which used to stack a second confirm dialog on top of / after the first.
  window.__shConfirmBusy = false;
  window.showCustomConfirm = function(title,message,confirmCallback,cancelCallback){
    var modal = document.getElementById('custom-confirm');
    var box = document.getElementById('custom-confirm-box');
    if(!modal || !box){
      if(typeof oldConfirm === 'function') return oldConfirm.apply(this,arguments);
      if(confirm(message||title||'')) confirmCallback && confirmCallback(); else cancelCallback && cancelCallback();
      return;
    }
    document.getElementById('custom-confirm-title').textContent = title || 'ยืนยัน';
    document.getElementById('custom-confirm-message').textContent = message || '';
    var confirmBtn = document.getElementById('custom-confirm-btn');
    if(confirmBtn){
      var newConfirmBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
      newConfirmBtn.addEventListener('click', function(){
        // Ignore a second click while the first confirm click is still being
        // processed, and guarantee the callback fires exactly once.
        if(window.__shConfirmBusy) return;
        window.__shConfirmBusy = true;
        window.closeCustomConfirm && window.closeCustomConfirm();
        try{ confirmCallback && confirmCallback(); }
        finally{ setTimeout(function(){ window.__shConfirmBusy = false; }, 300); }
      });
    }
    var cancelBtn = document.getElementById('custom-confirm-cancel-btn');
    if(cancelBtn){
      var newCancelBtn = cancelBtn.cloneNode(true);
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
      newCancelBtn.addEventListener('click', function(){
        if(window.__shConfirmBusy) return;
        window.__shConfirmBusy = true;
        window.closeCustomConfirm && window.closeCustomConfirm();
        try{ cancelCallback && cancelCallback(); }
        finally{ setTimeout(function(){ window.__shConfirmBusy = false; }, 300); }
      });
    }
    setFixedLayer(modal, CONFIRM_Z);
    box.style.zIndex = String(TOP_Z);
    modal.classList.remove('hidden');
    setTimeout(function(){ box.classList.remove('scale-95','opacity-0'); box.classList.add('scale-100','opacity-100'); }, 10);
  };

  var oldOpenModal = window.openModal;
  window.openModal = function(id){
    var m=document.getElementById(id);
    if(!m){ if(typeof oldOpenModal==='function') return oldOpenModal.apply(this,arguments); return; }
    appendToBody(m);
    m.style.zIndex = String(EXPORT_Z - 1000);
    m.classList.remove('hidden');
    var box=m.children && m.children[0];
    if(box){ box.classList.add('scale-95','opacity-0'); setTimeout(function(){ box.classList.remove('scale-95','opacity-0'); box.classList.add('transition-all','duration-300'); },10); }
  };

  // ครอบ native alert ให้ขึ้นผ่าน custom alert และอยู่บนสุดเช่นกัน
  var nativeAlert = window.alert;
  window.alert = function(msg){
    var modal = document.getElementById('custom-alert');
    if(modal && window.showCustomAlert){ return window.showCustomAlert('แจ้งเตือน', String(msg||''), true); }
    return nativeAlert(msg);
  };

  function currentPlanAllowsExport(){
    try{
      if(typeof window.currentPlanAllows === 'function') return !!window.currentPlanAllows('export');
      var p = window.currentUserPlan || window.activePlan || window.userPlan || window.currentPlan || null;
      if(!p && window.state && state.currentPlan) p = state.currentPlan;
      if(!p) return true;
      return p.allowExport !== false;
    }catch(e){ return true; }
  }
  function blockExportIfNeeded(){
    if(currentPlanAllowsExport()) return false;
    window.showCustomAlert('แผนนี้ไม่รองรับ Export','กรุณาอัปเกรดแผนเพื่อส่งออกไฟล์ Excel',true);
    return true;
  }
  window.schoolhubBlockExportIfNeeded = blockExportIfNeeded;


  function forceExportCancelButtons(){
    document.querySelectorAll('#schoolhub-overview-excel-room-close,#schoolhub-overview-excel-room-cancel,#schoolhub-attendance-export-close,#schoolhub-attendance-export-cancel,#student-export-room-close,#student-export-room-cancel,#export-date-modal-close,#export-date-modal-cancel').forEach(function(btn){
      if(btn.__schoolhubCancelFixed) return;
      btn.__schoolhubCancelFixed = true;
      btn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        var modal = btn.closest('.schoolhub-export-popup,#schoolhub-overview-export-room-modal,#schoolhub-attendance-export-modal,#student-export-room-modal,#export-date-modal,#download-modal');
        if(modal) modal.classList.add('hidden');
      }, true);
    });
  }
  document.addEventListener('DOMContentLoaded', forceExportCancelButtons);
  document.addEventListener('click', function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(forceExportCancelButtons,0); }, true);
  // Performance: removed polling; export close buttons are fixed on DOMContentLoaded/click/render wrappers.

  function wrapExportFunction(name){
    var fn = window[name];
    if(typeof fn !== 'function' || fn.__schoolhubStrictExportWrapped) return;
    var wrapped = function(){
      if(blockExportIfNeeded()) return;
      return fn.apply(this, arguments);
    };
    wrapped.__schoolhubStrictExportWrapped = true;
    window[name] = wrapped;
  }
  function wrapAllExportFunctions(){
    ['exportStudentsToExcel','exportScoresToExcel','exportAttendanceToExcel','downloadExcelMultiSheet'].forEach(wrapExportFunction);
  }
  wrapAllExportFunctions();
  document.addEventListener('DOMContentLoaded', wrapAllExportFunctions);
  setTimeout(wrapAllExportFunctions, 500);
  setTimeout(wrapAllExportFunctions, 1500);

  // กันกรณีปุ่ม/โค้ดเรียกเปิด popup ดาวน์โหลดเองโดยยังไม่ผ่านฟังก์ชัน export
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('button,a');
    if(!btn) return;
    var txt = (btn.textContent || '').trim();
    var oc = btn.getAttribute('onclick') || '';
    var idClass = (btn.id || '') + ' ' + (btn.className || '');

    // สำคัญ: ปุ่มปิด/กากบาท/ยกเลิกในกล่องดาวน์โหลด ต้องปิดได้เสมอ
    // เดิมระบบมอง id/class ที่มีคำว่า excel เป็นปุ่ม Export จึงเด้งเตือนสิทธิ์แทนการปิด
    var isDismiss = btn.hasAttribute('data-export-dismiss') ||
                    (window.schoolhubIsExportDismissButton && window.schoolhubIsExportDismissButton(btn)) ||
                    /^(×|x)$/i.test(txt) ||
                    !!btn.querySelector('i.fa-times, i.fa-xmark, i.fa-close, .fa-times, .fa-xmark, .fa-close') ||
                    /close|cancel|dismiss|ยกเลิก|ปิด|fa-times|fa-xmark|modal-close/i.test(txt + ' ' + oc + ' ' + idClass) ||
                    btn.hasAttribute('data-close') ||
                    btn.closest('[data-export-dismiss="true"]');
    if(isDismiss) return;

    var looksExport = /export|Excel|โหลดตาราง|โหลด Excel|file-excel|downloadExcel/i.test(txt + ' ' + oc + ' ' + idClass);
    if(!looksExport) return;
    if(blockExportIfNeeded()){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
  }, true);
})();
