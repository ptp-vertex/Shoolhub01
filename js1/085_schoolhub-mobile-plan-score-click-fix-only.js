
(function(){
  if(window.__schoolhubMobilePlanScoreClickFixOnly) return;
  window.__schoolhubMobilePlanScoreClickFixOnly = true;

  function byId(id){ return document.getElementById(id); }
  var lastPlanScoresBlockedAt = 0;
  function canUsePlanScores(){
    try{ if(typeof window.schoolhubExpandedPlanAllows === 'function') return !!window.schoolhubExpandedPlanAllows('planScores'); }catch(e){}
    try{ if(typeof window.currentPlanAllows === 'function') return !!window.currentPlanAllows('planScores'); }catch(e){}
    try{
      var d = window.__currentUserDir || {};
      if(d.allowPlanScores !== undefined) return d.allowPlanScores !== false;
    }catch(e){}
    return true;
  }
  function showPlanScoresBlocked(){
    var now = Date.now();
    if(now - lastPlanScoresBlockedAt < 650) return false;
    lastPlanScoresBlockedAt = now;
    if(typeof window.showCustomAlert === 'function') window.showCustomAlert('แผนนี้ไม่รองรับการจัดการแผนคะแนน','กรุณาอัปเกรดแผนเพื่อจัดการแผนเก็บคะแนน',true);
    else alert('แผนนี้ไม่รองรับการจัดการแผนคะแนน\nกรุณาอัปเกรดแผนเพื่อจัดการแผนเก็บคะแนน');
    return false;
  }
  function getCourseId(){
    return window.currentActiveCourseId ||
      (byId('plan-course-id') && byId('plan-course-id').value) ||
      (byId('score-course-select') && byId('score-course-select').value) ||
      (byId('att-course-select') && byId('att-course-select').value) || '';
  }
  function openPlanDirect(){
    if(!canUsePlanScores()) return showPlanScoresBlocked();
    var cid = getCourseId();
    if(!cid){
      if(typeof window.showCustomAlert === 'function') window.showCustomAlert('ยังไม่ได้เลือกรายวิชา','กรุณาเปิดรายวิชาก่อนจัดการแผนคะแนน',true);
      else alert('กรุณาเปิดรายวิชาก่อนจัดการแผนคะแนน');
      return false;
    }
    window.currentActiveCourseId = cid;
    var course = null;
    try{ course = (window.state && Array.isArray(window.state.courses) ? window.state.courses : []).find(function(c){ return String(c.id) === String(cid); }); }catch(e){}
    var title = byId('plan-modal-title');
    if(title) title.textContent = course && course.code ? '(' + course.code + ')' : '';
    var hidden = byId('plan-course-id');
    if(hidden) hidden.value = cid;
    try{ if(typeof window.cancelEditPlan === 'function') window.cancelEditPlan(); }catch(e){}
    try{ if(typeof window.renderPlanList === 'function') window.renderPlanList(cid); }catch(e){}
    var modal = byId('plan-modal');
    if(modal){
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      modal.style.pointerEvents = 'auto';
      modal.style.zIndex = '2147483647';
      document.body.style.overflow = 'hidden';
      var box = modal.querySelector('div');
      if(box) box.scrollTop = 0;
    }else if(typeof window.openModal === 'function'){
      window.openModal('plan-modal');
    }
    return false;
  }

  window.schoolhubOpenPlanModalSafe = function(e){
    if(e){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    if(!canUsePlanScores()) return showPlanScoresBlocked();
    return openPlanDirect();
  };

  // Override only this opener because older wrappers/permission stabilizers were swallowing mobile taps.
  window.openPlanModalForCurrentCourse = function(e){
    if(e && typeof e.preventDefault === 'function'){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    if(!canUsePlanScores()) return showPlanScoresBlocked();
    return openPlanDirect();
  };

  ['touchstart','pointerup','click'].forEach(function(ev){
    document.addEventListener(ev, function(e){
      var btn = e.target && e.target.closest ? e.target.closest('[data-schoolhub-plan-open-btn="1"],button[onclick*="schoolhubOpenPlanModalSafe"]') : null;
      if(!btn) return;
      window.schoolhubOpenPlanModalSafe(e);
    }, true);
  });
})();
