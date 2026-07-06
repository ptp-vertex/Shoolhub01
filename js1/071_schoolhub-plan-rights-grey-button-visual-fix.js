
(function(){
  if(window.__schoolhubPlanRightsGreyButtonVisualFix) return;
  window.__schoolhubPlanRightsGreyButtonVisualFix = true;

  function allow(key){
    try{
      if(typeof window.schoolhubExpandedPlanAllows === 'function') return !!window.schoolhubExpandedPlanAllows(key);
      if(typeof window.currentPlanAllows === 'function') return !!window.currentPlanAllows(key);
    }catch(e){}
    return true;
  }

  function isModalCloseButton(el){
    if(!el || !el.matches) return false;
    var txt = String((el.textContent || '').trim());
    var inExportModal = !!(el.closest && el.closest('.schoolhub-export-popup,#schoolhub-overview-export-room-modal,#schoolhub-attendance-export-modal,#student-export-room-modal,#export-date-modal,#download-modal,#attendance-export-modal,#export-room-modal,#schoolhub-overview-excel-room-modal,#schoolhub-overview-excel-room-modal-force'));
    var hasExportDismiss = inExportModal && (el.hasAttribute('data-export-dismiss') ||
      (window.schoolhubIsExportDismissButton && window.schoolhubIsExportDismissButton(el)));
    var hasCloseIcon = inExportModal && !!(el.querySelector && el.querySelector('i.fa-times, i.fa-xmark, i.fa-close, .fa-times, .fa-xmark, .fa-close'));
    return hasExportDismiss || hasCloseIcon ||
      el.matches('.modal-close, .close-modal, [data-close-modal], .btn-close, [aria-label*="ปิด"], [aria-label*="close" i]') ||
      /^(×|x|X|ปิด|ยกเลิก)$/.test(txt) ||
      /closeModal\(|closeCustomAlert\(|closePlanModal\(|schoolhubCloseExportModal\(/.test(String(el.getAttribute('onclick') || ''));
  }
  function classify(el){
    if(isModalCloseButton(el)) return '';
    var s = [
      el.getAttribute('onclick') || '',
      el.getAttribute('data-tab') || '',
      el.getAttribute('data-right') || '',
      el.id || '',
      el.className || '',
      el.textContent || '',
      el.dataset ? JSON.stringify(el.dataset) : ''
    ].join(' ');
    if(/overview|ภาพรวม|ภาพรวมคะแนน|รายงาน/i.test(s)) return 'reports';
    if(/attendance|เช็คชื่อ/i.test(s)) return 'attendance';
    if(/openShareStudentModal|studentShare|shareStudent|แชร์ให้นักเรียน|share-student/i.test(s)) return 'studentShare';
    if(/openPlanModalForCurrentCourse|schoolhubOpenPlanModalSafe|planScores|planScore|แผนคะแนน|จัดการแผนเก็บคะแนน/i.test(s)) return 'planScores';
    if(/openGradeCriteria|gradeCriteria|เกณฑ์เกรด/i.test(s)) return 'gradeCriteria';
    if(/switchCourseTab\(['"]?scores['"]?\)|data-tab["': ]+scores|\bscores\b|\bscore\b|บันทึกคะแนน|^\s*คะแนน\s*$/i.test(s)) return 'scores';
    if(/export|Export|Excel|เอ็ก|ส่งออก|โหลดตาราง/i.test(s)) return 'export';
    if(/CourseTeachers|จัดการครูในรายวิชา|เพิ่มครู|ครูผู้สอนร่วม/i.test(s) || el.id==='course-teachers-manage-btn' || el.id==='course-teachers-btn') return 'team';
    return '';
  }

  function cleanOne(el){
    if(isModalCloseButton(el)){
      el.classList.remove('sh-permission-disabled','schoolhub-locked-action-stable','schoolhub-plan-right-locked','schoolhub-permission-disabled-soft','opacity-60','opacity-50','opacity-40','cursor-not-allowed','pointer-events-none','grayscale','disabled');
      el.removeAttribute('aria-disabled');
      el.removeAttribute('disabled');
      el.disabled = false;
      el.style.pointerEvents = '';
      el.style.filter = '';
      el.style.opacity = '';
      el.style.cursor = '';
      return;
    }
    var key = classify(el);
    if(!key) return;

    var ok = allow(key);
    if(ok){
      el.classList.remove('sh-permission-disabled','schoolhub-locked-action-stable','schoolhub-plan-right-locked','schoolhub-permission-disabled-soft','opacity-60','opacity-50','opacity-40','cursor-not-allowed','pointer-events-none','grayscale','disabled');
      el.classList.add('schoolhub-unlocked-action-stable');
      if(/แผนนี้ไม่รองรับ|ไม่มีสิทธิ์|ไม่รองรับ|อัปเกรด|ดูได้อย่างเดียว/.test(el.getAttribute('title')||'')) el.removeAttribute('title');
      el.removeAttribute('aria-disabled');
      el.removeAttribute('disabled');
      if(el.dataset) el.dataset.permissionAllowed = '1';
      el.disabled = false;
      el.style.pointerEvents = '';
      el.style.filter = '';
      el.style.opacity = '';
      el.style.cursor = '';
    }else{
      el.classList.add('schoolhub-plan-right-locked','sh-permission-disabled');
      el.classList.remove('schoolhub-unlocked-action-stable','pointer-events-none');
      el.setAttribute('aria-disabled','true');
      if(el.dataset) el.dataset.permissionAllowed = '0';
      el.disabled = false;
      el.style.pointerEvents = 'auto';
    }
  }

  function fixAll(){
    document.querySelectorAll('button,a,[role="button"]').forEach(cleanOne);
  }

  // ทำหลัง patch เก่า ๆ ที่อาจเติม class เทา
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(fixAll, 300);
    setTimeout(fixAll, 1000);
    setTimeout(fixAll, 2000);
  });
  document.addEventListener('click', function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(fixAll, 180); }, true);
  document.addEventListener('change', function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(fixAll, 180); }, true);

  window.schoolhubFixGreyPlanButtons = fixAll;
})();
