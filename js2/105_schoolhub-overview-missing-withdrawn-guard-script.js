
(function(){
  if(window.__schoolhubOverviewMissingWithdrawnGuardFinal) return;
  window.__schoolhubOverviewMissingWithdrawnGuardFinal = true;

  function cls(st){
    if(window.getStudentClassName) return window.getStudentClassName(st);
    return String((st && (st.room || st.classroom || st.grade)) || '-').trim() || '-';
  }
  function isWithdrawn(st){
    return !!(st && (
      (typeof window.isWithdrawnStudent === 'function' && window.isWithdrawnStudent(st)) ||
      st.withdrawn === true || st.isWithdrawn === true || st.status === 'withdrawn' || st.status === 'ลาออก'
    ));
  }
  function courseById(cid){
    return (window.state && Array.isArray(state.courses) ? state.courses : []).find(function(c){ return String(c.id) === String(cid); }) || null;
  }
  function allStudentsForCourse(cid){
    var c = courseById(cid);
    if(!c || !window.state) return [];
    var rooms = Array.isArray(c.studentRooms) ? c.studentRooms : (Array.isArray(c.studentGrades) ? c.studentGrades : []);
    var extraIds = Array.isArray(c.extraStudentIds) ? c.extraStudentIds : [];
    return (state.students || []).filter(function(st){ return rooms.indexOf(cls(st)) >= 0 || extraIds.indexOf(st.id) >= 0; })
      .sort(function(a,b){ return String(cls(a)).localeCompare(String(cls(b)),'th',{numeric:true}) || String(a.code||'').localeCompare(String(b.code||''),'th',{numeric:true}) || String(a.name||'').localeCompare(String(b.name||''),'th'); });
  }
  function visibleStudents(cid){
    var list = allStudentsForCourse(cid);
    var selected = (window.__overviewRoomFilter && window.__overviewRoomFilter[cid]) || 'all';
    var rooms = Array.from(new Set(list.map(cls).filter(Boolean)));
    if(rooms.length > 1 && selected && selected !== 'all') return list.filter(function(st){ return cls(st) === selected; });
    return list;
  }
  function plansForCourse(cid){
    return (((window.state && state.coursePlans && state.coursePlans[cid]) || []).slice()).sort(function(a,b){ return Number(a.week)-Number(b.week); });
  }
  function isMissingX(el){ return !!(el && String(el.textContent || '').trim().toUpperCase() === 'X'); }
  function setWithdrawnCell(td, isGrade){
    if(!td) return;
    td.classList.remove('text-rose-600','text-rose-500','text-primary');
    td.classList.add(isGrade ? 'withdrawn-grade-cell' : 'withdrawn-score-cell');
    td.removeAttribute('data-missing-score');
    td.removeAttribute('data-score-cell');
    td.title = '';
    td.innerHTML = '<span class="'+(isGrade ? 'withdrawn-grade withdrawn-grade-cell' : 'withdrawn-score-cell')+'">ลาออก</span>';
  }
  function markMissing(el, cid, st, seq, p){
    if(!el || !cid || !st || !p || isWithdrawn(st)) return;
    el.classList.add('schoolhub-missing-score-clickable');
    el.dataset.missingScore = '1';
    el.dataset.courseId = String(cid);
    el.dataset.studentId = String(st.id || '');
    el.dataset.studentName = String(st.name || '');
    el.dataset.studentCode = String(st.code || '');
    el.dataset.studentSeq = String(seq || '');
    el.dataset.week = String(p.week || '');
    el.dataset.title = String(p.title || '');
    el.dataset.maxScore = String(p.maxScore || '');
    el.title = 'ดับเบิลคลิกเพื่อกรอกคะแนน';
  }
  function applyOverviewGuard(){
    var cid = window.currentActiveCourseId;
    if(!cid || !window.state) return;
    var students = visibleStudents(cid);
    var plans = plansForCourse(cid);
    var table = document.getElementById('course-summary-table');
    if(table){
      Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function(tr, rowIndex){
        var st = students[rowIndex];
        if(!st) return;
        var scoreCells = Array.prototype.slice.call(tr.querySelectorAll('td.summary-score-col'));
        var attCell = tr.querySelector('td.summary-att-col');
        var totalCell = tr.querySelector('td.summary-total-col');
        var gradeCell = tr.querySelector('td.summary-grade-col');
        if(isWithdrawn(st)){
          tr.classList.add('schoolhub-withdrawn-row');
          setWithdrawnCell(attCell, false);
          scoreCells.forEach(function(td){ setWithdrawnCell(td, false); });
          setWithdrawnCell(totalCell, false);
          setWithdrawnCell(gradeCell, true);
          return;
        }
        scoreCells.forEach(function(td, planIndex){
          var p = plans[planIndex];
          if(!p || Number(p.maxScore) === 0) return;
          var target = td.querySelector('.summary-score-cell-content') || td;
          td.dataset.scoreCell = '1';
          td.dataset.courseId = String(cid);
          td.dataset.studentId = String(st.id || '');
          td.dataset.week = String(p.week || '');
          td.dataset.title = String(p.title || '');
          if(isMissingX(target)) markMissing(target, cid, st, rowIndex + 1, p);
        });
      });
    }

    var mobile = document.getElementById('course-summary-mobile-cards');
    if(mobile){
      Array.prototype.forEach.call(mobile.querySelectorAll('.summary-mobile-card'), function(card, rowIndex){
        var st = students[rowIndex];
        if(!st) return;
        if(isWithdrawn(st)){
          card.classList.add('schoolhub-withdrawn-row');
          Array.prototype.forEach.call(card.querySelectorAll('[data-missing-score="1"], .schoolhub-mobile-missing-score'), function(el){
            el.removeAttribute('data-missing-score');
            el.classList.remove('schoolhub-missing-score-clickable','schoolhub-mobile-missing-score','text-rose-600');
            el.classList.add('withdrawn-score-cell');
            el.textContent = 'ลาออก';
            el.title = '';
          });
          var stats = card.querySelector('.summary-mobile-stats');
          if(stats) stats.innerHTML = '<div class="summary-mobile-stat withdrawn-score-cell"><b>ลาออก</b>เช็คชื่อ</div>';
          return;
        }
        Array.prototype.forEach.call(card.querySelectorAll('.summary-mobile-plan'), function(planCard, planIndex){
          var p = plans[planIndex];
          if(!p || Number(p.maxScore) === 0) return;
          var x = planCard.querySelector('.schoolhub-mobile-missing-score');
          if(x && isMissingX(x)) markMissing(x, cid, st, rowIndex + 1, p);
        });
      });
    }
  }
  window.schoolhubApplyOverviewMissingWithdrawnGuard = applyOverviewGuard;

  function wrapRender(){
    if(typeof window.renderCourseOverview !== 'function' || window.renderCourseOverview.__overviewMissingWithdrawnGuardWrapped) return;
    var old = window.renderCourseOverview;
    var fn = function(){
      var result = old.apply(this, arguments);
      applyOverviewGuard();
      setTimeout(applyOverviewGuard, 0);
      setTimeout(applyOverviewGuard, 120);
      return result;
    };
    fn.__overviewMissingWithdrawnGuardWrapped = true;
    window.renderCourseOverview = fn;
  }

  var oldOpenMissing = window.openMissingScorePopup;
  if(typeof oldOpenMissing === 'function' && !oldOpenMissing.__overviewWithdrawnGuardFinal){
    window.openMissingScorePopup = function(data){
      var sid = data && data.studentId;
      var st = sid && window.state && (state.students || []).find(function(x){ return String(x.id) === String(sid); });
      if(isWithdrawn(st)) return false;
      return oldOpenMissing.apply(this, arguments);
    };
    window.openMissingScorePopup.__overviewWithdrawnGuardFinal = true;
  }

  var lastMissingScoreTap = {t:0, el:null};
  document.addEventListener('dblclick', function(e){
    var el = e.target && e.target.closest ? e.target.closest('[data-missing-score="1"]') : null;
    if(!el) return;
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    window.openMissingScorePopup(Object.assign({}, el.dataset));
  }, true);
  document.addEventListener('click', function(e){
    var el = e.target && e.target.closest ? e.target.closest('[data-missing-score="1"]') : null;
    if(!el) return;
    var now = Date.now();
    if(lastMissingScoreTap.el === el && now - lastMissingScoreTap.t < 420){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      window.openMissingScorePopup(Object.assign({}, el.dataset));
      lastMissingScoreTap = {t:0, el:null};
    }else{
      lastMissingScoreTap = {t:now, el:el};
    }
  }, true);

  wrapRender();
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ wrapRender(); setTimeout(applyOverviewGuard, 300); });
  }else{
    setTimeout(applyOverviewGuard, 0);
  }
})();
