
(function(){
  if(window.__schoolhubFinalGradePlusMsFix) return;
  window.__schoolhubFinalGradePlusMsFix = true;

  var NUM_DEFAULT = {'4':80,'3.5':75,'3':70,'2.5':65,'2':60,'1.5':55,'1':50,'0':0,gradeType:'number',lateToAbsent:3,msAbsentLimit:5,msAbsentPercent:20,msEnabled:true};
  var LETTER_PLUS_DEFAULT = {A:80,'B+':75,B:70,'C+':65,C:60,'D+':55,D:50,F:0,gradeType:'letter',lateToAbsent:3,msAbsentLimit:5,msAbsentPercent:20,msEnabled:true};

  function byId(id){ return document.getElementById(id); }
  function num(v,fb){ v=Number(v); return Number.isFinite(v)?v:(fb||0); }
  function cid(){ try{return window.currentActiveCourseId || (typeof currentActiveCourseId!=='undefined'?currentActiveCourseId:'') || '';}catch(e){return '';} }
  function ensureState(){ if(!window.state) window.state={}; if(!state.courseGrades) state.courseGrades={}; return state; }
  function criteria(courseId){ ensureState(); return (typeof window.getCourseGradeCriteria === 'function') ? window.getCourseGradeCriteria(courseId) : ((state.courseGrades && state.courseGrades[courseId]) || window.defaultGradeCriteria || NUM_DEFAULT); }
  function val(c,k,fb){ return (c && c[k]!==undefined && c[k]!==null && c[k]!=='' ) ? num(c[k],fb) : fb; }

  // ใช้เป็น default ใหม่ โดยไม่ทำลายข้อมูลรายวิชาที่บันทึกไว้แล้ว
  window.defaultGradeCriteria = window.defaultGradeCriteria || NUM_DEFAULT;
  if(window.defaultGradeCriteria && !('B+' in window.defaultGradeCriteria)){
    window.defaultGradeCriteria['B+'] = 75;
    window.defaultGradeCriteria['C+'] = 65;
    window.defaultGradeCriteria['D+'] = 55;
    window.defaultGradeCriteria.lateToAbsent = window.defaultGradeCriteria.lateToAbsent ?? 3;
    window.defaultGradeCriteria.msAbsentLimit = window.defaultGradeCriteria.msAbsentLimit ?? 5;
    window.defaultGradeCriteria.msAbsentPercent = window.defaultGradeCriteria.msAbsentPercent ?? 20;
    window.defaultGradeCriteria.msEnabled = window.defaultGradeCriteria.msEnabled !== false;
  }

  function enhanceGradeModalUI(){
    var form = byId('grade-criteria-modal') && byId('grade-criteria-modal').querySelector('form');
    if(!form) return;
    var typeSel = byId('grade-type-select');
    if(typeSel){
      var opt = typeSel.querySelector('option[value="letter"]');
      if(opt) opt.textContent = 'รูปแบบตัวอักษร (A, B+)';
    }
    var oldHint = form.querySelector('#schoolhub-grade-plus-hint');
    if(!oldHint){
      var box = byId('schoolhub-grade-extra-rules');
      if(box) box.insertAdjacentHTML('beforeend','<div id="schoolhub-grade-plus-hint" class="schoolhub-grade-plus-note">โหมดตัวอักษรจะใช้ช่องเกรดเดิมเป็น A, B+, B, C+, C, D+, D, F ตามลำดับ</div>');
    }
  }

  function syncGradeTypeUIPlus(){
    enhanceGradeModalUI();
    var type = (byId('grade-type-select')||{}).value || 'number';
    var pairs = [
      ['grade-crit-4','เกรด 4','A'],
      ['grade-crit-35','เกรด 3.5','B+'],
      ['grade-crit-3','เกรด 3','B'],
      ['grade-crit-25','เกรด 2.5','C+'],
      ['grade-crit-2','เกรด 2','C'],
      ['grade-crit-15','เกรด 1.5','D+'],
      ['grade-crit-1','เกรด 1','D'],
      ['grade-crit-0','เกรด 0','F']
    ];
    pairs.forEach(function(p){
      var input=byId(p[0]); if(!input) return;
      var wrap=input.closest('.flex');
      var lab=wrap && wrap.querySelector('label');
      if(wrap) wrap.style.display='';
      if(lab) lab.textContent = (type==='letter'?p[2]:p[1]);
      input.disabled = p[0]==='grade-crit-0';
      input.required = p[0]!=='grade-crit-0';
    });
  }

  function fillPlusValues(){
    var courseId = cid();
    var c = criteria(courseId);
    var type = c.gradeType || 'number';
    var set=function(id,v){ var el=byId(id); if(el) el.value=v; };
    var chk=function(id,v){ var el=byId(id); if(el) el.checked=!!v; };
    if(byId('grade-type-select') && !window.__schoolhubGradeTypeDirty) byId('grade-type-select').value = type;
    set('grade-late-to-absent', c.lateToAbsent ?? 3);
    set('grade-ms-absent-limit', c.msAbsentLimit ?? 5);
    set('grade-ms-absent-percent', c.msAbsentPercent ?? 20);
    chk('grade-ms-enabled', c.msEnabled !== false);
    if(type==='letter'){
      set('grade-crit-4',  c.A ?? c['4'] ?? 80);
      set('grade-crit-35', c['B+'] ?? c['3.5'] ?? 75);
      set('grade-crit-3',  c.B ?? c['3'] ?? 70);
      set('grade-crit-25', c['C+'] ?? c['2.5'] ?? 65);
      set('grade-crit-2',  c.C ?? c['2'] ?? 60);
      set('grade-crit-15', c['D+'] ?? c['1.5'] ?? 55);
      set('grade-crit-1',  c.D ?? c['1'] ?? 50);
      set('grade-crit-0', 0);
    }
    syncGradeTypeUIPlus();
  }

  var oldOpen = window.openGradeCriteriaModalForCurrentCourse;
  window.openGradeCriteriaModalForCurrentCourse = function(){
    var r = typeof oldOpen==='function' ? oldOpen.apply(this,arguments) : undefined;
    setTimeout(function(){enhanceGradeModalUI(); fillPlusValues();},50);
    setTimeout(function(){enhanceGradeModalUI(); fillPlusValues();},250);
    return r;
  };

  document.addEventListener('change',function(e){
    if(e.target && e.target.id==='grade-type-select') setTimeout(syncGradeTypeUIPlus,0);
  },true);

  // เกรดตัวอักษรแบบมี +
  // Disabled legacy calculateGrade override. Final source of truth is defined in schoolhub-real-grade-rules-special-script.

  function readAttendanceValue(entry, studentId){
    if(!entry) return '';
    if(entry.records && Object.prototype.hasOwnProperty.call(entry.records, studentId)) return entry.records[studentId];
    if(Object.prototype.hasOwnProperty.call(entry, studentId)) return entry[studentId];
    return '';
  }

  function attendanceStats(courseId, studentId){
    var hist=(window.state && state.attendance && state.attendance[courseId]) || {};
    var present=0, late=0, absent=0, total=0;
    Object.keys(hist).forEach(function(date){
      var v = readAttendanceValue(hist[date], studentId);
      if(!v) return;
      total++;
      if(v==='present') present++;
      else if(v==='late') late++;
      else if(v==='absent') absent++;
    });
    return {present:present,late:late,absent:absent,total:total};
  }

  function msInfo(courseId, studentId, c){
    var courseObj = (window.state && state.courses || []).find(function(c0){ return String(c0.id) === String(courseId); }) || {id:courseId, gradeCriteria:c};
    var st = studentId && window.state && (state.students || []).find(function(x){ return String(x.id) === String(studentId); });
    var special = (typeof window.calculateSpecialGradeByAttendance === 'function') ? window.calculateSpecialGradeByAttendance(courseObj, st) : '';
    return {isMS:!!special, specialLabel:special || '', present:0, late:0, absent:0, total:0, converted:0, effective:0, percent:0};
  }
  window.schoolhubGradeMsInfo = msInfo;
  window.schoolhubCalculateFinalGrade = function(score,c,courseId,studentId,student){
    var st = student || (studentId && window.state && (state.students || []).find(function(x){ return String(x.id) === String(studentId); }));
    if((window.isWithdrawnStudent || window.isStudentWithdrawn || function(){return false;})(st)) return 'ลาออก';
    var info = (courseId && studentId) ? msInfo(courseId, studentId, c) : {isMS:false};
    if(typeof window.getFinalGradeForStudent === 'function' && courseId && st) {
      var courseObj = (state.courses || []).find(function(c0){ return String(c0.id) === String(courseId); }) || {id:courseId, gradeCriteria:c};
      return window.getFinalGradeForStudent(courseObj, st, score);
    }
    if(info.isMS){
      return (info && info.specialLabel) || '';
    }
    return window.calculateGrade(score,c,st);
  };

  function savePlusCriteria(e){
    // Redirect legacy save name to the canonical gradeRules/specialRules submit handler only.
    if (typeof window.handleGradeCriteriaSubmit === 'function') return window.handleGradeCriteriaSubmit(e);
    return false;
  }
  window.savePlusCriteria = savePlusCriteria;
  // Disabled legacy submit override that used state.courseGrades[courseId] = base.


  function gradeColor(g){
    g=String(g);
    if(g==='มส.' || g==='F' || g==='0') return 'text-rose-600 schoolhub-grade-ms';
    if(['4','3.5','A','B+'].includes(g)) return 'text-emerald-500';
    if(['3','2.5','B','C+','C'].includes(g)) return 'text-blue-500';
    if(['2','1.5','D+','D'].includes(g)) return 'text-amber-500';
    if(['1'].includes(g)) return 'text-rose-500';
    return 'text-slate-400';
  }

  function getVisibleStudents(courseId){
    var list=[];
    try{ list = (typeof window.getCourseStudents==='function') ? window.getCourseStudents(courseId) : []; }catch(e){ list=[]; }
    return Array.isArray(list)?list:[];
  }

  function patchOverviewGrades(){
    // Disabled: grade cells are rendered only by renderCourseOverview -> schoolhubRenderGrade.
    return;
  }

  function wrapRender(){
    // Disabled: do not patch or rewrite grade cells after render.
    return;
  }

  document.addEventListener('DOMContentLoaded',function(){
    enhanceGradeModalUI(); syncGradeTypeUIPlus(); wrapRender();
  });
  document.addEventListener('click',function(e){
    if(e.target && e.target.closest && e.target.closest('select')) return;
    enhanceGradeModalUI(); syncGradeTypeUIPlus(); wrapRender();
  },true);
  // ปิด polling เกรดซ้ำทุก 1 วิ เพื่อลดอาการ dropdown ค้าง/หน่วงบนมือถือ
})();
