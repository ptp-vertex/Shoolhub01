
(function(){
  if(window.__schoolhubRealGradeRulesSpecialFinal) return;
  window.__schoolhubRealGradeRulesSpecialFinal = true;

  var NUMBER_RULES = [
    {label:'4',minScore:80},{label:'3.5',minScore:75},{label:'3',minScore:70},{label:'2.5',minScore:65},
    {label:'2',minScore:60},{label:'1.5',minScore:55},{label:'1',minScore:50},{label:'0',minScore:0}
  ];
  var LETTER_RULES = [
    {label:'A',minScore:80},{label:'B+',minScore:75},{label:'B',minScore:70},{label:'C+',minScore:65},
    {label:'C',minScore:60},{label:'D+',minScore:55},{label:'D',minScore:50},{label:'F',minScore:0}
  ];
  var CUSTOM_RULES = [{label:'ผ่าน',minScore:50},{label:'ไม่ผ่าน',minScore:0}];
  var tempGradeRules = [];
  var tempGradeSpecialRules = [];
  var editingGradeSpecialRuleIndex = -1;
  var gradeCriteriaModalLoadedForCourseId = null;
  var gradeCriteriaDirty = false;
  function markGradeCriteriaDirty(){ gradeCriteriaDirty = true; }
  window.markGradeCriteriaDirty = markGradeCriteriaDirty;

  function byId(id){ return document.getElementById(id); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];}); }
  function clone(v){ try{return JSON.parse(JSON.stringify(v));}catch(e){return v;} }
  function num(v,fb){ v = Number(v); return Number.isFinite(v) ? v : (fb || 0); }
  function getCurrentCourseId(){
    try{
      var candidates = [
        window.currentActiveCourseId,
        window.currentCourseId,
        window.selectedCourseId,
        window.activeCourseId,
        (typeof currentActiveCourseId !== 'undefined' ? currentActiveCourseId : ''),
        (typeof currentCourseId !== 'undefined' && typeof currentCourseId !== 'function' ? currentCourseId : ''),
        (typeof selectedCourseId !== 'undefined' ? selectedCourseId : ''),
        (typeof activeCourseId !== 'undefined' ? activeCourseId : ''),
        (window.currentCourse && window.currentCourse.id),
        (window.selectedCourse && window.selectedCourse.id),
        (window.activeCourse && window.activeCourse.id)
      ];
      ['att-course-select','score-course-select','course-select','course-filter','course-list-select'].forEach(function(id){
        var el = byId(id);
        if(el && el.value) candidates.push(el.value);
      });
      var courses = (window.state && Array.isArray(state.courses)) ? state.courses : [];
      function clean(v){
        if(typeof v === 'function') { try{ v = v(); }catch(e){ v = ''; } }
        var s = String(v == null ? '' : v).trim();
        return (s && s !== 'undefined' && s !== 'null') ? s : '';
      }
      function exists(id){
        return !courses.length || courses.some(function(c){ return c && String(c.id) === String(id); });
      }
      for(var i=0;i<candidates.length;i++){
        var cid = clean(candidates[i]);
        if(cid && exists(cid)) return String(cid);
      }
      for(var j=0;j<candidates.length;j++){
        var fallback = clean(candidates[j]);
        if(fallback) return String(fallback);
      }
      return '';
    }catch(e){
      console.error('[GRADE SAVE] getCurrentCourseId failed', e);
      return '';
    }
  }
  function ensureState(){ if(!window.state) window.state = {}; if(!state.courseGrades) state.courseGrades = {}; if(!Array.isArray(state.courses)) state.courses = []; return state; }
  function currentCourse(){ var cid = (typeof getGradeCriteriaCourseId === 'function' ? getGradeCriteriaCourseId() : getCurrentCourseId()); ensureState(); return (state.courses || []).find(function(c){return String(c.id) === String(cid);}) || null; }
  function defaultCriteria(format){
    format = format || 'number';
    var rules = format === 'letter' ? LETTER_RULES : (format === 'custom' ? CUSTOM_RULES : NUMBER_RULES);
    return packCriteria(format, clone(rules), [], rules[rules.length - 1] ? rules[rules.length - 1].label : (format === 'letter' ? 'F' : '0'));
  }
  function getLowestGradeLabel(criteria){
    var c = (criteria && criteria.gradeCriteria) ? criteria.gradeCriteria : (criteria || {});
    if(c.defaultGrade !== undefined && c.defaultGrade !== null && String(c.defaultGrade).trim() !== '') return String(c.defaultGrade);
    var rules = Array.isArray(c.gradeRules) ? c.gradeRules : [];
    var valid = rules.map(function(r){
      return {label:String((r && r.label) || '').trim(), minScore:Number(r && r.minScore)};
    }).filter(function(r){ return r.label && Number.isFinite(r.minScore); })
      .sort(function(a,b){ return a.minScore - b.minScore; });
    if(valid.length) return valid[0].label;
    var format = c.gradeFormat || c.gradeType || 'number';
    if(format === 'letter') return 'F';
    return (NUMBER_RULES[NUMBER_RULES.length - 1] && NUMBER_RULES[NUMBER_RULES.length - 1].label) || '0';
  }
  window.getLowestGradeLabel = getLowestGradeLabel;
  function sanitizeSpecialRulesForSave(rules){
    return (Array.isArray(rules) ? rules : []).map(function(r, i){
      return {
        id:String((r && r.id) || ('special_' + Date.now() + '_' + i)),
        label:String((r && r.label) || '').trim(),
        lateCount:Math.max(0, num(r && r.lateCount, 0)),
        absentCount:Math.max(0, num(r && r.absentCount, 0))
      };
    }).filter(function(r){ return r.label && (r.lateCount > 0 || r.absentCount > 0); });
  }
  function lateToAbsentCount(lateCount, ratePerAbsent){
    var nLate = Number(lateCount || 0);
    var nRate = Number(ratePerAbsent || 0);
    if(!Number.isFinite(nLate) || nLate <= 0) return 0;
    if(!Number.isFinite(nRate) || nRate <= 0) return 0;
    return Math.floor(nLate / nRate);
  }
  window.lateToAbsentCount = lateToAbsentCount;
  function oldObjectToRules(raw, format){
    raw = raw || {};
    var base = format === 'letter' ? LETTER_RULES : (format === 'custom' ? CUSTOM_RULES : NUMBER_RULES);
    return base.filter(function(r){ return raw[r.label] !== undefined && raw[r.label] !== null && raw[r.label] !== ''; })
      .map(function(r){ return {label:r.label, minScore:num(raw[r.label], r.minScore)}; });
  }
  function normalizeSpecialRules(raw){
    if(raw && Array.isArray(raw.specialRules)){
      return raw.specialRules.map(function(r,i){
        return {id:String(r.id || ('special_' + Date.now() + '_' + i)), label:String(r.label || '').trim(), lateCount:Math.max(0,num(r.lateCount,0)), absentCount:Math.max(0,num(r.absentCount,0))};
      }).filter(function(r){return r.label;});
    }
    return [];
  }
  function normalizeGradeCriteria(raw){
    if(raw && raw.gradeCriteria) raw = raw.gradeCriteria;
    var src = raw && typeof raw === 'object' ? raw : {};
    var format = src.gradeFormat || src.gradeType || 'number';
    if(format !== 'number' && format !== 'letter' && format !== 'custom') format = 'number';
    var rules = [];
    if(Array.isArray(src.gradeRules)){
      rules = src.gradeRules.map(function(r){ return {label:String((r && (r.label != null ? r.label : r.grade)) || '').trim(), minScore:num(r && (r.minScore != null ? r.minScore : r.min),0)}; }).filter(function(r){return r.label && Number.isFinite(Number(r.minScore));});
    }else if(src && typeof src === 'object'){
      rules = oldObjectToRules(src, format);
    }
    rules.sort(function(a,b){return num(b.minScore,0) - num(a.minScore,0);});
    var defaultGrade = src.defaultGrade !== undefined && src.defaultGrade !== null ? String(src.defaultGrade) : (format === 'letter' ? 'F' : '0');
    var normalized = packCriteria(format, rules, normalizeSpecialRules(src), defaultGrade);
    if(src.updatedAt) normalized.updatedAt = src.updatedAt;
    if(src.updatedBy) normalized.updatedBy = src.updatedBy;
    return normalized;
  }
  function packCriteria(format, rules, specialRules, defaultGrade){
    var obj = {gradeFormat:format || 'number', gradeType:format || 'number', gradeRules:clone(rules || []), specialRules:clone(specialRules || []), defaultGrade:String(defaultGrade || '')};
    obj.gradeRules.forEach(function(r){ if(r && r.label) obj[String(r.label)] = num(r.minScore,0); });
    if(!obj.defaultGrade) obj.defaultGrade = getLowestGradeLabel(obj);
    return obj;
  }
  function hasStoredGradeCriteria(raw){
    if(raw && raw.gradeCriteria) raw = raw.gradeCriteria;
    if(!raw || typeof raw !== 'object') return false;
    if(Array.isArray(raw.gradeRules) || Array.isArray(raw.specialRules)) return true;
    if(raw.gradeFormat || raw.gradeType || raw.defaultGrade !== undefined || raw.updatedAt) return true;
    var legacyKeys = ['4','3.5','3','2.5','2','1.5','1','0','A','B+','B','C+','C','D+','D','F'];
    return legacyKeys.some(function(k){ return raw[k] !== undefined && raw[k] !== null && raw[k] !== ''; });
  }
  function getCriteriaTime(criteria){
    if(!criteria || !criteria.updatedAt) return 0;
    var t = new Date(criteria.updatedAt).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  function isDefaultLikeGradeCriteria(criteria){
    if(!criteria || typeof criteria !== 'object') return false;
    var format = criteria.gradeFormat || criteria.gradeType || '';
    var defaultGrade = String(criteria.defaultGrade == null ? '' : criteria.defaultGrade);
    var rules = Array.isArray(criteria.gradeRules) ? criteria.gradeRules : [];
    var specialRules = Array.isArray(criteria.specialRules) ? criteria.specialRules : [];
    var looksNumberDefault = format === 'number' && defaultGrade === '0' &&
      rules.some(function(r){ return String(r.label == null ? '' : r.label) === '4' && Number(r.minScore || 0) === 80; }) &&
      rules.some(function(r){ return String(r.label == null ? '' : r.label) === '0' && Number(r.minScore || 0) === 0; });
    return looksNumberDefault && !criteria.updatedAt && !specialRules.length;
  }
  function chooseFinalGradeCriteria(courseCriteria, mapCriteria){
    var fromCourse = hasStoredGradeCriteria(courseCriteria) ? normalizeGradeCriteria(courseCriteria) : null;
    var fromMap = hasStoredGradeCriteria(mapCriteria) ? normalizeGradeCriteria(mapCriteria) : null;
    if(fromCourse && fromMap){
      var courseTime = getCriteriaTime(fromCourse);
      var mapTime = getCriteriaTime(fromMap);
      if(courseTime || mapTime) return mapTime >= courseTime ? fromMap : fromCourse;
      if(isDefaultLikeGradeCriteria(fromCourse) && !isDefaultLikeGradeCriteria(fromMap)) return fromMap;
      if(!isDefaultLikeGradeCriteria(fromCourse) && isDefaultLikeGradeCriteria(fromMap)) return fromCourse;
      return fromMap;
    }
    return fromMap || fromCourse || null;
  }
  function findCourseById(cid){
    ensureState();
    return (state.courses || []).find(function(c){ return String(c && c.id) === String(cid); }) || null;
  }
  function getGradeCriteriaCourseId(){
    ensureState();
    var validIds = new Set((state.courses || []).map(function(c){ return String(c && c.id); }));
    var modal = byId('grade-criteria-modal');
    var modalCid = modal && modal.dataset ? String(modal.dataset.courseId || '').trim() : '';
    var candidates = [
      window.currentActiveCourseId,
      (typeof currentActiveCourseId !== 'undefined' ? currentActiveCourseId : ''),
      window.currentCourse && window.currentCourse.id,
      window.activeCourse && window.activeCourse.id,
      window.selectedCourse && window.selectedCourse.id,
      window.currentCourseId,
      (typeof currentCourseId !== 'undefined' && typeof currentCourseId !== 'function' ? currentCourseId : ''),
      window.selectedCourseId,
      (typeof selectedCourseId !== 'undefined' ? selectedCourseId : ''),
      window.activeCourseId,
      (typeof activeCourseId !== 'undefined' ? activeCourseId : ''),
      modalCid
    ];
    for(var i=0;i<candidates.length;i++){
      var cid = String(candidates[i] == null ? '' : candidates[i]).trim();
      if(cid && (!validIds.size || validIds.has(cid))) return cid;
    }
    return '';
  }
  window.getGradeCriteriaCourseId = getGradeCriteriaCourseId;
  function getStoredGradeCriteriaForCourse(courseOrId) {
    ensureState();
    var course = null;
    var cid = '';
    if (courseOrId && typeof courseOrId === 'object') {
      course = courseOrId;
      cid = String(course.id || '');
    } else {
      cid = String(courseOrId || getGradeCriteriaCourseId() || '');
      course = cid ? findCourseById(cid) : null;
    }
    if (!cid && course && course.id) cid = String(course.id);
    if (!cid) return normalizeGradeCriteria(defaultCriteria('number'));
    state.courseGrades = state.courseGrades || {};
    var rawCourseGradeCriteria = course ? course.gradeCriteria : null;
    var rawCourseGradesEntry = state.courseGrades ? state.courseGrades[cid] : null;
    var finalCriteria = chooseFinalGradeCriteria(rawCourseGradeCriteria, rawCourseGradesEntry) || normalizeGradeCriteria(defaultCriteria('number'));
    state.courseGrades[cid] = clone(finalCriteria);
    if(course) course.gradeCriteria = clone(finalCriteria);
    if(window.currentCourse && String(window.currentCourse.id) === cid) window.currentCourse.gradeCriteria = clone(finalCriteria);
    console.log('[GRADE LOAD] resolved duplicated gradeCriteria sources', {
      courseId: cid,
      rawCourseGradeCriteria: rawCourseGradeCriteria,
      rawCourseGradesEntry: rawCourseGradesEntry,
      selectedFinalCriteria: finalCriteria
    });
    return finalCriteria;
  }
  function syncStoredCourseGradeCriteria(cid, course){
    ensureState();
    if(!cid) cid = course && course.id ? String(course.id) : getGradeCriteriaCourseId();
    if(!course && cid) course = findCourseById(cid);
    if(!cid) return null;
    return getStoredGradeCriteriaForCourse(course || cid);
  }
  function getCourseGradeCriteria(courseOrId) {
    return getStoredGradeCriteriaForCourse(courseOrId);
  }
  window.chooseFinalGradeCriteria = chooseFinalGradeCriteria;
  window.getStoredGradeCriteriaForCourse = getStoredGradeCriteriaForCourse;
  window.getCourseGradeCriteria = getCourseGradeCriteria;

  window.defaultGradeCriteria = normalizeGradeCriteria(window.defaultGradeCriteria || defaultCriteria('number'));

  function isWithdrawn(student){
    if(typeof window.isWithdrawnStudent === 'function') return window.isWithdrawnStudent(student);
    if(typeof window.isStudentWithdrawn === 'function') return window.isStudentWithdrawn(student);
    return !!(student && (student.withdrawn === true || student.isWithdrawn === true || student.status === 'withdrawn' || student.status === 'ลาออก'));
  }
  function readAttendanceValue(entry, studentId){
    if(!entry) return '';
    if(entry.records && Object.prototype.hasOwnProperty.call(entry.records, studentId)) return entry.records[studentId];
    if(Object.prototype.hasOwnProperty.call(entry, studentId)) return entry[studentId];
    return '';
  }
  function normalizeAttendanceStatus(v){
    v = String(v == null ? '' : v).trim().toLowerCase();
    if(v === 'present' || v === 'มา') return 'present';
    if(v === 'late' || v === 'สาย') return 'late';
    if(v === 'absent' || v === 'ขาด') return 'absent';
    return v;
  }
  function getStudentAttendanceCounts(course, studentId){
    var cid = typeof course === 'string' ? course : (course && course.id) || getCurrentCourseId();
    var hist = (window.state && state.attendance && state.attendance[cid]) || {};
    var late = 0, absent = 0, present = 0;
    Object.keys(hist).forEach(function(date){
      var status = normalizeAttendanceStatus(readAttendanceValue(hist[date], studentId));
      if(status === 'late') late++;
      else if(status === 'absent') absent++;
      else if(status === 'present') present++;
    });
    return {late:late, absent:absent, present:present};
  }
  window.getStudentAttendanceCounts = getStudentAttendanceCounts;

  function calculateGradeFromRules(score, criteria) {
    var n = Number(score);
    if (!Number.isFinite(n)) return '';

    var c = normalizeGradeCriteria(criteria);
    var rules = Array.isArray(c.gradeRules) ? c.gradeRules : [];

    var sorted = rules
      .filter(function(r){ return String((r && r.label) || '').trim() && Number.isFinite(Number(r && r.minScore)); })
      .map(function(r){ return { label:String(r.label).trim(), minScore:Number(r.minScore) }; })
      .sort(function(a, b){ return b.minScore - a.minScore; });

    for (var i = 0; i < sorted.length; i++) {
      if (n >= sorted[i].minScore) return sorted[i].label;
    }

    return getLowestGradeLabel(c);
  }
  window.calculateGradeFromRules = calculateGradeFromRules;

  function calculateSpecialGradeByAttendance(course, student){
    if(!course || !student) return '';
    var criteria = getCourseGradeCriteria(course);
    var rules = Array.isArray(criteria.specialRules) ? criteria.specialRules : [];
    if(!rules.length) return '';
    var counts = getStudentAttendanceCounts(course, student.id);
    var rawLate = counts.late || 0;
    var rawAbsent = counts.absent || 0;
    var hits = [];
    for(var i=0;i<rules.length;i++){
      var rule = rules[i] || {};
      var label = String(rule.label || '').trim();
      var lateRate = Math.max(0, num(rule.lateCount,0));
      var absentLimit = Math.max(0, num(rule.absentCount,0));
      if(!label) continue;
      var convertedAbsentFromLate = lateToAbsentCount(rawLate, lateRate);
      var totalAbsent = rawAbsent + convertedAbsentFromLate;
      var absentHit = absentLimit > 0 && totalAbsent >= absentLimit;
      if(absentHit){
        hits.push({label:label, order:i, hitScore:totalAbsent});
      }
    }
    if(!hits.length) return '';
    hits.sort(function(a,b){ return b.hitScore - a.hitScore || a.order - b.order; });
    return hits[0].label;
  }
  window.calculateSpecialGradeByAttendance = calculateSpecialGradeByAttendance;

  function computeTotalScoreForStudent(courseId, studentId){
    var plans = ((state.coursePlans && state.coursePlans[courseId]) || []).sort(function(a,b){return num(a.week,0)-num(b.week,0);});
    var courseScores = (state.scores || []).filter(function(s){return String(s.courseId) === String(courseId);});
    var total = 0, totalMax = 0;
    plans.forEach(function(p){
      if(Number(p.maxScore) === 0) return;
      totalMax = window.addScoreToTotal ? window.addScoreToTotal(totalMax, p.maxScore, 2) : (totalMax + num(p.maxScore,0));
      var task = courseScores.find(function(ts){return ts.week == p.week && ts.title === p.title;});
      var raw = task && task.records ? task.records[studentId] : null;
      total = window.addScoreToTotal ? window.addScoreToTotal(total, raw, 2) : (total + num(raw,0));
    });
    total = window.normalizeScoreNumber ? window.normalizeScoreNumber(total,2) : Number(total.toFixed(2));
    return {total:total,totalMax:totalMax};
  }
  function getFinalGradeForStudent(course, student, totalScore) {
    if (isWithdrawn(student)) return 'ลาออก';

    if (!course) course = { id:getCurrentCourseId() };
    var criteria = getCourseGradeCriteria(course);

    var special = calculateSpecialGradeByAttendance(course, student);
    if (special) return special;

    var score = totalScore;

    if (!Number.isFinite(Number(score))) {
      var cid = (course && course.id) || getCurrentCourseId();
      score = computeTotalScoreForStudent(cid, student && student.id).total;
    }

    return calculateGradeFromRules(score, criteria) || getLowestGradeLabel(criteria) || '';
  }
  window.getFinalGradeForStudent = getFinalGradeForStudent;

  window.calculateGrade = function(score, criteria) {
    return calculateGradeFromRules(score, normalizeGradeCriteria(criteria));
  };

  function gradeColor(g, criteria){
    g = String(g == null ? '' : g);
    if(g === 'ลาออก') return 'withdrawn-grade-cell';
    var special = (normalizeGradeCriteria(criteria || window.defaultGradeCriteria).specialRules || []).some(function(r){return String(r.label || '') === g;});
    if(special || g === 'มส.' || g === 'ขร.' || /ไม่มีสิทธิ์|มส|ขร/.test(g) || g === 'F' || g === '0') return 'text-rose-600 schoolhub-grade-ms';
    if(['4','3.5','A','B+'].indexOf(g) >= 0) return 'text-emerald-500';
    if(['3','2.5','B','C+','C'].indexOf(g) >= 0) return 'text-blue-500';
    if(['2','1.5','D+','D'].indexOf(g) >= 0) return 'text-amber-500';
    if(['1'].indexOf(g) >= 0) return 'text-rose-500';
    return 'text-slate-600';
  }
  window.schoolhubGradeColor = gradeColor;

  window.schoolhubCalculateFinalGrade = function(score, criteria, courseId, studentId, student){
    var st = student || (studentId && window.state && (state.students || []).find(function(x){return String(x.id) === String(studentId);}));
    var course = (state.courses || []).find(function(c){return String(c.id) === String(courseId);}) || {id:courseId, gradeCriteria:criteria};
    return getFinalGradeForStudent(course, st, score);
  };

  window.schoolhubRenderGrade = function(student, total, criteria, courseId, totalMax){
    if(isWithdrawn(student)){
      var withdrawnHtml = window.renderWithdrawnGradeCell ? window.renderWithdrawnGradeCell() : '<span class="withdrawn-grade withdrawn-grade-cell">ลาออก</span>';
      return {grade:'ลาออก', value:'ลาออก', html:withdrawnHtml, color:'withdrawn-grade-cell', isWithdrawn:true, signature:'withdrawn'};
    }
    if(!(Number(totalMax) > 0)) return {grade:'-', value:'-', html:'-', color:'text-slate-300', isWithdrawn:false, signature:'-'};
    var course = (state.courses || []).find(function(c){return String(c.id) === String(courseId);}) || {id:courseId, gradeCriteria:criteria};
    var grade = getFinalGradeForStudent(course, student, total);
    if(grade === null || grade === undefined || grade === '') grade = '-';
    grade = String(grade);
    return {grade:grade, value:grade, html:esc(grade), color:gradeColor(grade, getCourseGradeCriteria(course)), isWithdrawn:false, signature:'grade:'+grade};
  };

  function canOpenGradeCriteria(){
    try{ if(window.isAdmin || (window.currentUser && currentUser.uid === 'admin-bypass')) return true; }catch(e){}
    var course = currentCourse();
    try{ if(typeof window.schoolhubIsReadonlySharedCourse === 'function' && window.schoolhubIsReadonlySharedCourse(course)){
      if(window.showCustomAlert) window.showCustomAlert('ดูได้อย่างเดียว','คุณมีสิทธิ์ดูรายวิชานี้เท่านั้น ไม่สามารถตั้งค่าเกณฑ์เกรดได้',true); else alert('ดูได้อย่างเดียว\nคุณมีสิทธิ์ดูรายวิชานี้เท่านั้น');
      return false;
    }}catch(e){}
    var ok = true;
    try{ if(typeof window.schoolhubExpandedPlanAllows === 'function') ok = !!window.schoolhubExpandedPlanAllows('gradeCriteria'); }catch(e){}
    try{ if(ok && typeof window.currentPlanAllows === 'function') ok = !!window.currentPlanAllows('gradeCriteria'); }catch(e){}
    if(!ok){
      if(window.showCustomAlert) window.showCustomAlert('แผนนี้ไม่รองรับการตั้งค่าเกณฑ์เกรด','กรุณาอัปเกรดแผนเพื่อตั้งค่าเกณฑ์เกรด',true); else alert('แผนนี้ไม่รองรับการตั้งค่าเกณฑ์เกรด');
      return false;
    }
    return true;
  }

  function ensureSpecialModal(){
    if(!byId('grade-special-rule-modal')){
      document.body.insertAdjacentHTML('beforeend', '<div id="grade-special-rule-modal-backdrop" class="hidden fixed inset-0 bg-black/40"></div><div id="grade-special-rule-modal" class="hidden fixed inset-0 flex items-center justify-center p-4"><div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-5"><div class="flex items-center justify-between mb-4"><h3 id="grade-special-rule-modal-title" class="font-bold text-lg text-slate-800">เพิ่มเกณฑ์พิเศษ</h3><button type="button" onclick="closeGradeSpecialRuleModal()" aria-label="ปิด" class="grade-special-rule-close modal-close w-10 h-10 rounded-full bg-slate-100 text-slate-500 font-black hover:bg-slate-200 flex items-center justify-center">×</button></div><div class="space-y-3"><div><label class="block text-sm font-black text-slate-600 mb-1">ผลลัพธ์ที่จะแสดง</label><input id="grade-special-label" type="text" placeholder="เช่น มส., ขร., ไม่มีสิทธิ์สอบ"></div><div><label class="block text-sm font-black text-slate-600 mb-1">สายตั้งแต่กี่ครั้ง</label><input id="grade-special-late-count" type="number" min="0" inputmode="numeric" placeholder="0"><p class="schoolhub-special-late-help">สายกี่ครั้ง = ขาด 1 ครั้ง และจะนำไปคำนวณเป็นขาดด้วย</p></div><div><label class="block text-sm font-black text-slate-600 mb-1">ขาดตั้งแต่กี่ครั้ง</label><input id="grade-special-absent-count" type="number" min="0" inputmode="numeric" placeholder="0"></div><div class="flex gap-3 pt-2"><button type="button" onclick="closeGradeSpecialRuleModal()" class="w-1/2 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">ยกเลิก</button><button type="button" onclick="saveGradeSpecialRule()" class="w-1/2 py-3 bg-primary text-white rounded-xl font-bold">บันทึก</button></div></div></div></div>');
    }
    var bd = byId('grade-special-rule-modal-backdrop');
    if(bd && !bd.__schoolhubSpecialBackdropBound){
      bd.__schoolhubSpecialBackdropBound = true;
      bd.addEventListener('click', function(e){ e.preventDefault(); closeGradeSpecialRuleModal(); });
    }
  }

  function bindGradeCriteriaForm(form){
    if(!form) return;
    form.removeAttribute('onsubmit');
    var submitBtn = form.querySelector('button[type="submit"]');
    if(submitBtn) submitBtn.setAttribute('type','submit');
    form.onsubmit = function(e) {
      e.preventDefault();
      e.stopPropagation();
      return window.handleGradeCriteriaSubmit(e);
    };
    if(!form.__schoolhubGradeCriteriaDirtyBound){
      form.__schoolhubGradeCriteriaDirtyBound = true;
      form.addEventListener('input', function(e){
        if(e && e.target && e.target.closest && e.target.closest('#schoolhub-grade-extra-rules, #schoolhub-special-rules-list')) markGradeCriteriaDirty();
      }, true);
      form.addEventListener('change', function(e){
        if(e && e.target && e.target.closest && e.target.closest('#schoolhub-grade-extra-rules, #schoolhub-special-rules-list')) markGradeCriteriaDirty();
      }, true);
    }
  }

  function bindGradeTypeSelect(){
    var sel = byId('grade-type-select');
    if(sel && !sel.__schoolhubGradePresetBound){
      sel.__schoolhubGradePresetBound = true;
      sel.addEventListener('change', function(){ applyGradePresetFromButton(); });
    }
  }

  function removeUnusedGradeCriteriaBlocks(){
    var oldSummary = byId('current-' + 'grade-criteria-summary');
    if(oldSummary) oldSummary.remove();
    var oldHistory = byId('grade-criteria-' + 'history-list');
    var historyWrap = oldHistory && oldHistory.closest ? oldHistory.closest('.schoolhub-grade-main-box') : null;
    if(historyWrap) historyWrap.remove();
    else if(oldHistory) oldHistory.remove();
    var modal = byId('grade-criteria-modal');
    if(modal){
      Array.prototype.slice.call(modal.querySelectorAll('*')).forEach(function(el){
        var text = String(el.textContent || '').trim();
        if(text === 'การตั้งค่าที่ใช้อยู่' + 'ปัจจุบัน' || text === 'ประวัติการตั้งค่า' + 'เกณฑ์เกรด') el.remove();
      });
    }
  }

  function ensureMainGradeModalUI(){
    ensureSpecialModal();
    var modal = byId('grade-criteria-modal');
    var form = modal && modal.querySelector('form');
    var title = modal && modal.querySelector('h3');
    if(title) title.innerHTML = '<i class="fas fa-medal text-amber-500 mr-2"></i> ตั้งค่าเกณฑ์เกรด';
    if(!form) return;
    if(form.dataset.schoolhubRealGradeRulesUi === '1'){
      removeUnusedGradeCriteriaBlocks();
      bindGradeCriteriaForm(form);
      bindGradeTypeSelect();
      return;
    }
    form.dataset.schoolhubRealGradeRulesUi = '1';
    form.innerHTML = '<div id="schoolhub-grade-extra-rules" class="schoolhub-grade-main-box"><div class="schoolhub-grade-main-title"><i class="fas fa-sliders text-primary"></i> เกณฑ์แปลงคะแนนเป็นเกรด</div><div class="schoolhub-grade-format-row"><div><label class="block mb-1">รูปแบบเกรด</label><select id="grade-type-select"><option value="number">รูปแบบตัวเลข (4, 3.5)</option><option value="letter">รูปแบบตัวอักษร (A, B+)</option><option value="custom">รูปแบบกำหนดเอง</option></select></div><button type="button" class="schoolhub-grade-mini-btn" onclick="applyGradePresetFromButton()"><i class="fas fa-wand-magic-sparkles mr-1"></i> ใช้รูปแบบนี้</button><button type="button" class="schoolhub-grade-mini-btn" onclick="addGradeRuleRow()"><i class="fas fa-plus mr-1"></i> เพิ่มเกรด</button></div><div class="schoolhub-grade-rule-head"><div>ชื่อเกรด / ผลลัพธ์</div><div>คะแนนขั้นต่ำ</div><div></div></div><div id="schoolhub-grade-rules-list"></div><div class="mt-3"><label class="block text-xs font-black text-slate-500 mb-1">ค่าเริ่มต้นถ้าคะแนนต่ำกว่าเกณฑ์ทั้งหมด</label><input id="schoolhub-default-grade" type="text" placeholder="เช่น 0 หรือ F"></div><div id="schoolhub-grade-legacy-inputs" class="hidden"><input id="grade-crit-4"><input id="grade-crit-35"><input id="grade-crit-3"><input id="grade-crit-25"><input id="grade-crit-2"><input id="grade-crit-15"><input id="grade-crit-1"><input id="grade-crit-0"></div></div><div class="schoolhub-grade-main-box mt-4"><div class="flex items-center justify-between gap-3 mb-3"><div class="schoolhub-grade-main-title mb-0"><i class="fas fa-user-clock text-rose-500"></i> เกณฑ์พิเศษจากการเข้าเรียน</div><button type="button" onclick="startAddGradeSpecialRule()" class="schoolhub-grade-mini-btn"><i class="fas fa-plus mr-1"></i> เพิ่มเกณฑ์พิเศษ</button></div><div id="schoolhub-special-rules-list"></div><p class="text-xs text-slate-400 font-semibold mt-2">ถ้าจำนวนสายหรือขาดถึงเกณฑ์อย่างใดอย่างหนึ่ง ระบบจะแสดงผลลัพธ์พิเศษก่อนคำนวณเกรดจากคะแนน</p></div><div class="pt-4 flex gap-3"><button type="button" onclick="closeModal(\'grade-criteria-modal\')" class="w-1/2 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">ยกเลิก</button><button type="submit" class="w-1/2 py-3 text-white bg-primary rounded-xl font-bold shadow-lg shadow-indigo-200">บันทึก</button></div>';
    removeUnusedGradeCriteriaBlocks();
    bindGradeCriteriaForm(form);
    bindGradeTypeSelect();
  }

  function syncLegacyInputs(){
    var map = {'4':'grade-crit-4','3.5':'grade-crit-35','3':'grade-crit-3','2.5':'grade-crit-25','2':'grade-crit-2','1.5':'grade-crit-15','1':'grade-crit-1','0':'grade-crit-0','A':'grade-crit-4','B+':'grade-crit-35','B':'grade-crit-3','C+':'grade-crit-25','C':'grade-crit-2','D+':'grade-crit-15','D':'grade-crit-1','F':'grade-crit-0'};
    Object.keys(map).forEach(function(label){
      var r = tempGradeRules.find(function(x){return String(x.label) === label;});
      var el = byId(map[label]);
      if(el && r) el.value = r.minScore;
    });
  }
  function renderGradeRulesList(){
    var box = byId('schoolhub-grade-rules-list'); if(!box) return;
    if(!tempGradeRules.length){ box.innerHTML = '<div class="schoolhub-grade-empty">ยังไม่มีเกณฑ์เกรด</div>'; return; }
    box.innerHTML = tempGradeRules.map(function(r,i){ return '<div class="schoolhub-grade-rule-row" data-grade-rule-row="'+i+'"><input class="grade-rule-label" type="text" value="'+esc(r.label)+'" placeholder="เช่น 4, A, ผ่าน"><input class="grade-rule-min" type="number" inputmode="decimal" value="'+esc(r.minScore)+'" placeholder="คะแนนขั้นต่ำ"><button type="button" class="schoolhub-grade-danger-btn" onclick="deleteGradeRuleRow('+i+')"><i class="fas fa-trash"></i></button></div>'; }).join('');
    syncLegacyInputs();
  }
  window.renderGradeRulesList = renderGradeRulesList;
  window.addGradeRuleRow = function(){ tempGradeRules.push({label:'',minScore:0}); markGradeCriteriaDirty(); renderGradeRulesList(); };
  window.deleteGradeRuleRow = function(index){ tempGradeRules.splice(index,1); markGradeCriteriaDirty(); renderGradeRulesList(); };
  window.applyGradePresetFromButton = function(){
    var format = (byId('grade-type-select') || {}).value || 'number';
    if(format === 'number') tempGradeRules = clone(NUMBER_RULES);
    else if(format === 'letter') tempGradeRules = clone(LETTER_RULES);
    else if(!tempGradeRules.length) tempGradeRules = clone(CUSTOM_RULES);
    var def = byId('schoolhub-default-grade'); if(def) def.value = tempGradeRules[tempGradeRules.length - 1] ? tempGradeRules[tempGradeRules.length - 1].label : '';
    markGradeCriteriaDirty();
    renderGradeRulesList();
  };
  function renderGradeSpecialRulesList(){
    var box = byId('schoolhub-special-rules-list'); if(!box) return;
    if(!tempGradeSpecialRules.length){ box.innerHTML = '<div class="schoolhub-grade-empty">ยังไม่มีเกณฑ์พิเศษ</div>'; return; }
    box.innerHTML = tempGradeSpecialRules.map(function(r,i){
      return '<div class="schoolhub-special-rule-card"><div><b>'+esc(r.label)+'</b><div><span>สายตั้งแต่ '+esc(r.lateCount || 0)+' ครั้ง</span> <span>• ขาดตั้งแต่ '+esc(r.absentCount || 0)+' ครั้ง</span></div></div><div class="flex gap-2 justify-end"><button type="button" class="schoolhub-grade-edit-btn" onclick="editGradeSpecialRule('+i+')"><i class="fas fa-pen mr-1"></i>แก้ไข</button><button type="button" class="schoolhub-grade-danger-btn" onclick="deleteGradeSpecialRule('+i+')"><i class="fas fa-trash mr-1"></i>ลบ</button></div></div>';
    }).join('');
  }
  window.renderGradeSpecialRulesList = renderGradeSpecialRulesList;
  window.startAddGradeSpecialRule = function(){
    editingGradeSpecialRuleIndex = -1;
    window.openGradeSpecialRuleModal();
    return false;
  };
  window.openGradeSpecialRuleModal = function(rule){
    ensureSpecialModal();
    var isEdit = editingGradeSpecialRuleIndex >= 0 && tempGradeSpecialRules[editingGradeSpecialRuleIndex];
    if(rule && typeof rule === 'object') isEdit = true;
    if(!rule && editingGradeSpecialRuleIndex < 0) isEdit = false;
    var data = rule || (isEdit ? tempGradeSpecialRules[editingGradeSpecialRuleIndex] : null) || {};
    var title = byId('grade-special-rule-modal-title'); if(title) title.textContent = isEdit ? 'แก้ไขเกณฑ์พิเศษ' : 'เพิ่มเกณฑ์พิเศษ';
    var label = byId('grade-special-label'); if(label) label.value = data.label || '';
    var late = byId('grade-special-late-count'); if(late) late.value = data.lateCount || 0;
    var absent = byId('grade-special-absent-count'); if(absent) absent.value = data.absentCount || 0;
    byId('grade-special-rule-modal-backdrop').classList.remove('hidden');
    byId('grade-special-rule-modal').classList.remove('hidden');
    setTimeout(function(){ if(label) label.focus(); },30);
  };
  window.closeGradeSpecialRuleModal = function(){
    if(byId('grade-special-rule-modal-backdrop')) byId('grade-special-rule-modal-backdrop').classList.add('hidden');
    if(byId('grade-special-rule-modal')) byId('grade-special-rule-modal').classList.add('hidden');
    editingGradeSpecialRuleIndex = -1;
  };
  window.editGradeSpecialRule = function(index){ editingGradeSpecialRuleIndex = index; window.openGradeSpecialRuleModal(tempGradeSpecialRules[index]); };
  window.deleteGradeSpecialRule = function(index){ tempGradeSpecialRules.splice(index,1); markGradeCriteriaDirty(); renderGradeSpecialRulesList(); };
  window.saveGradeSpecialRule = function(){
    var label = String((byId('grade-special-label') || {}).value || '').trim();
    var lateCount = Math.max(0, num((byId('grade-special-late-count') || {}).value,0));
    var absentCount = Math.max(0, num((byId('grade-special-absent-count') || {}).value,0));
    if(!label){ if(window.showCustomAlert) window.showCustomAlert('กรอกผลลัพธ์ก่อน','เช่น มส., ขร., ไม่มีสิทธิ์สอบ',true); else alert('กรอกผลลัพธ์ก่อน'); return; }
    if(!(lateCount > 0 || absentCount > 0)){ if(window.showCustomAlert) window.showCustomAlert('กรอกจำนวนสายหรือขาด','ต้องมีอย่างน้อย 1 เงื่อนไขที่มากกว่า 0',true); else alert('กรอกจำนวนสายหรือขาด'); return; }
    var old = editingGradeSpecialRuleIndex >= 0 ? tempGradeSpecialRules[editingGradeSpecialRuleIndex] : null;
    var rule = {id:(old && old.id) || ('special_' + Date.now()), label:label, lateCount:lateCount, absentCount:absentCount};
    if(editingGradeSpecialRuleIndex >= 0) tempGradeSpecialRules[editingGradeSpecialRuleIndex] = rule;
    else tempGradeSpecialRules.push(rule);
    markGradeCriteriaDirty();
    renderGradeSpecialRulesList();
    window.closeGradeSpecialRuleModal();
  };

  async function ensureLatestCourseGradeCriteriaLoaded(cid){
    ensureState();
    cid = String(cid || getGradeCriteriaCourseId() || '');
    var course = cid ? findCourseById(cid) : null;
    var hasStored = !!(cid && syncStoredCourseGradeCriteria(cid, course));

    if(!gradeCriteriaDirty){
      var loader = null;
      try{ loader = (typeof window.loadStateFromDB === 'function') ? window.loadStateFromDB : (typeof loadStateFromDB === 'function' ? loadStateFromDB : null); }catch(e){ loader = null; }
      if(typeof loader === 'function'){
        console.log('[GRADE MODAL] await loadStateFromDB before render', {courseId: cid, hadStoredBeforeLoad: hasStored});
        try{ await loader(); }catch(loadErr){ console.warn('[GRADE CRITERIA] load latest state failed', loadErr); }
        ensureState();
        cid = String(cid || getGradeCriteriaCourseId() || '');
        course = cid ? findCourseById(cid) : null;
        hasStored = !!(cid && syncStoredCourseGradeCriteria(cid, course));
        console.log('[GRADE MODAL] loadStateFromDB finished before render', {
          courseId: cid,
          hasStoredAfterLoad: hasStored,
          courseGradeCriteria: course && course.gradeCriteria,
          courseGradesEntry: state.courseGrades && state.courseGrades[cid]
        });
      }
    }

    course = cid ? findCourseById(cid) : null;
    if(course) syncStoredCourseGradeCriteria(cid, course);
    return course || null;
  }
  window.ensureLatestCourseGradeCriteriaLoaded = ensureLatestCourseGradeCriteriaLoaded;

  function loadCriteriaToModal(courseId){
    ensureMainGradeModalUI();
    removeUnusedGradeCriteriaBlocks();
    var modal = byId('grade-criteria-modal');
    var cid = String(courseId || (modal && modal.dataset ? modal.dataset.courseId : '') || getGradeCriteriaCourseId() || '');
    if(modal) modal.dataset.courseId = cid;
    var course = cid ? findCourseById(cid) : null;
    if(course) syncStoredCourseGradeCriteria(cid, course);
    var criteria = getStoredGradeCriteriaForCourse(course || cid);
    tempGradeRules = clone(criteria.gradeRules || []);
    tempGradeSpecialRules = sanitizeSpecialRulesForSave(criteria.specialRules || []);
    window.tempGradeRules = clone(tempGradeRules || []);
    window.tempGradeSpecialRules = clone(tempGradeSpecialRules || []);
    var sel = byId('grade-type-select'); if(sel && !window.__schoolhubGradeTypeDirty) sel.value = criteria.gradeFormat || criteria.gradeType || 'number';
    var def = byId('schoolhub-default-grade'); if(def) def.value = criteria.defaultGrade || (tempGradeRules[tempGradeRules.length - 1] ? tempGradeRules[tempGradeRules.length - 1].label : '');
    renderGradeRulesList();
    renderGradeSpecialRulesList();
    var gradeRulesBox = byId('schoolhub-grade-rules-list');
    var specialRulesBox = byId('schoolhub-special-rules-list');
    if(gradeRulesBox && /กำลังโหลดเกณฑ์เกรด/.test(gradeRulesBox.innerHTML || '')) renderGradeRulesList();
    console.log('[GRADE MODAL] rendered criteria into modal', {
      courseId: cid,
      criteria: criteria,
      gradeRulesCount: tempGradeRules.length,
      specialRulesCount: tempGradeSpecialRules.length,
      gradeRulesStillLoading: !!(gradeRulesBox && /กำลังโหลดเกณฑ์เกรด/.test(gradeRulesBox.innerHTML || '')),
      gradeRulesHTML: gradeRulesBox ? gradeRulesBox.innerHTML : null,
      specialRulesHTML: specialRulesBox ? specialRulesBox.innerHTML : null
    });
    if(gradeRulesBox && /กำลังโหลดเกณฑ์เกรด/.test(gradeRulesBox.innerHTML || '')){
      console.error('[GRADE MODAL] renderGradeRulesList did not replace loading text', {courseId: cid, tempGradeRules: tempGradeRules});
      gradeRulesBox.innerHTML = '<div class="schoolhub-grade-empty">ยังไม่มีเกณฑ์เกรด</div>';
    }
    gradeCriteriaModalLoadedForCourseId = cid;
    gradeCriteriaDirty = false;
  }
  window.loadCriteriaToModal = loadCriteriaToModal;

  async function loadCriteriaToModalOnce(){
    var cid = getGradeCriteriaCourseId();
    var modal = byId('grade-criteria-modal');
    var modalIsOpen = !!(modal && !modal.classList.contains('hidden'));
    if(modalIsOpen && gradeCriteriaModalLoadedForCourseId === cid && gradeCriteriaDirty) return;
    await ensureLatestCourseGradeCriteriaLoaded(cid);
    loadCriteriaToModal(cid);
  }
  window.loadCriteriaToModalOnce = loadCriteriaToModalOnce;

  window.openGradeCriteriaModalForCurrentCourse = async function(){
    ensureState();
    var cid = getGradeCriteriaCourseId();
    console.log('[GRADE MODAL] open requested before load', {
      courseId: cid,
      courseGradesKeys: Object.keys(state.courseGrades || {}),
      beforeLoadCourseGradesEntry: cid && state.courseGrades ? state.courseGrades[cid] : null
    });
    if(!cid){
      if(window.showCustomAlert) window.showCustomAlert('เปิดไม่ได้','ไม่พบรายวิชาปัจจุบัน กรุณาเลือกรายวิชาก่อนตั้งค่าเกณฑ์เกรด',true); else alert('ไม่พบรายวิชาปัจจุบัน');
      console.error('[GRADE MODAL] missing course id before load');
      return false;
    }
    if(!canOpenGradeCriteria()) return false;
    var modal = byId('grade-criteria-modal');
    if(modal) modal.dataset.courseId = cid;
    if(typeof window.loadStateFromDB === 'function'){
      try{ await window.loadStateFromDB(); }catch(loadErr){ console.warn('[GRADE MODAL] loadStateFromDB failed before open', loadErr); }
    }
    ensureState();
    cid = cid || getGradeCriteriaCourseId();
    if(modal) modal.dataset.courseId = cid;
    var course = cid ? findCourseById(cid) : null;
    if(!course){
      if(window.showCustomAlert) window.showCustomAlert('ไม่พบรายวิชา','ไม่พบรายวิชานี้ในข้อมูลที่โหลดจาก Firebase',true); else alert('ไม่พบรายวิชา');
      console.error('[GRADE MODAL] course not found after load', {courseId: cid, courses: state.courses});
      return false;
    }
    var criteria = getStoredGradeCriteriaForCourse(course);
    console.log('[GRADE MODAL] criteria before render', {
      courseId: cid,
      courseGradeCriteria: course.gradeCriteria,
      courseGradesEntry: state.courseGrades && state.courseGrades[cid],
      criteria: criteria
    });
    loadCriteriaToModal(cid);
    var gradeBox = byId('schoolhub-grade-rules-list');
    var specialBox = byId('schoolhub-special-rules-list');
    console.log('[GRADE MODAL] after render', {
      courseId: cid,
      gradeRulesHTML: gradeBox ? gradeBox.innerHTML : null,
      specialRulesHTML: specialBox ? specialBox.innerHTML : null
    });
    if(typeof window.openModal === 'function') window.openModal('grade-criteria-modal');
    else if(modal) modal.classList.remove('hidden');
    return false;
  };
  window.openGradeCriteriaModalForCurrentCourse.__schoolhubCanonicalGradeCriteriaOpen = true;
  window.openGradeCriteria = window.openGradeCriteriaModalForCurrentCourse;

  function readGradeRulesFromDom(){
    var rows = Array.prototype.slice.call(document.querySelectorAll('#schoolhub-grade-rules-list [data-grade-rule-row]'));
    return rows.map(function(row){
      return {label:String((row.querySelector('.grade-rule-label') || {}).value || '').trim(), minScore:num((row.querySelector('.grade-rule-min') || {}).value,NaN)};
    }).filter(function(r){return r.label && Number.isFinite(Number(r.minScore));});
  }

  window.handleGradeCriteriaSubmit = async function(e){
    console.log('[GRADE SAVE] clicked');
    if(e){ e.preventDefault(); e.stopPropagation(); }

    var modal = byId('grade-criteria-modal');
    var cid = getGradeCriteriaCourseId();
    if(modal && modal.dataset && modal.dataset.courseId) cid = String(modal.dataset.courseId || cid || '');
    console.log('[GRADE SAVE] cid', cid);
    if(!cid){
      if(window.showCustomAlert) window.showCustomAlert('บันทึกไม่ได้','ไม่พบรายวิชาปัจจุบัน กรุณาเลือกวิชาก่อนบันทึก',true); else alert('บันทึกไม่ได้\nไม่พบรายวิชาปัจจุบัน กรุณาเลือกวิชาก่อนบันทึก');
      console.error('[GRADE SAVE] missing current course id');
      return false;
    }

    ensureState();
    var course = (state.courses || []).find(function(c){return String(c.id) === String(cid);}) || null;
    if(!course){
      if(window.showCustomAlert) window.showCustomAlert('บันทึกไม่ได้','ไม่พบข้อมูลรายวิชาปัจจุบัน กรุณาเลือกวิชาก่อนบันทึก',true); else alert('บันทึกไม่ได้\nไม่พบข้อมูลรายวิชาปัจจุบัน กรุณาเลือกวิชาก่อนบันทึก');
      console.error('[GRADE SAVE] missing course', cid);
      return false;
    }

    var rules = readGradeRulesFromDom();
    if(!rules.length){
      if(window.showCustomAlert) window.showCustomAlert('ยังไม่มีเกณฑ์เกรด','กรุณาเพิ่มเกณฑ์แปลงคะแนนเป็นเกรดอย่างน้อย 1 รายการ',true); else alert('ยังไม่มีเกณฑ์เกรด');
      console.error('[GRADE SAVE] no grade rules');
      return false;
    }

    var format = (byId('grade-type-select') || {}).value || 'custom';
    rules.sort(function(a,b){return num(b.minScore,0)-num(a.minScore,0);});
    var specialRulesToSave = sanitizeSpecialRulesForSave(tempGradeSpecialRules);
    var defaultInput = String((byId('schoolhub-default-grade') || {}).value || '').trim();
    var defaultGrade = defaultInput || getLowestGradeLabel({gradeRules:rules, gradeFormat:format, gradeType:format});
    var criteria = {
      gradeFormat: format,
      gradeRules: clone(rules || []),
      specialRules: clone(specialRulesToSave || []),
      defaultGrade: String(defaultGrade || ''),
      updatedAt: new Date().toISOString(),
      updatedBy: (window.currentUser && window.currentUser.email) || (typeof currentUser !== 'undefined' && currentUser && currentUser.email) || ''
    };

    console.log('[GRADE SAVE] course.id', course.id);
    console.log('[GRADE SAVE] criteria before save', criteria);
    console.log('[GRADE SAVE] course before save', course);

    state.courseGrades = state.courseGrades || {};
    var courseIdForSave = String(course.id || cid);
    course.gradeCriteria = (typeof structuredClone === 'function') ? structuredClone(criteria) : clone(criteria);
    state.courseGrades[courseIdForSave] = (typeof structuredClone === 'function') ? structuredClone(course.gradeCriteria) : clone(course.gradeCriteria);
    if(window.currentCourse && String(window.currentCourse.id) === String(courseIdForSave)) {
      window.currentCourse.gradeCriteria = (typeof structuredClone === 'function') ? structuredClone(course.gradeCriteria) : clone(course.gradeCriteria);
    }

    console.log('[GRADE SAVE] gradeCriteria', course.gradeCriteria);
    console.log('[GRADE SAVE] state.courseGrades', state.courseGrades);

    tempGradeSpecialRules = clone(criteria.specialRules || []);
    tempGradeRules = clone(criteria.gradeRules || []);
    renderGradeRulesList();
    renderGradeSpecialRulesList();

    try{
      var saved = true;
      console.log('[GRADE SAVE] saving to firebase...');
      window.__schoolhubLastSaveStateError = null;
      window.__schoolhubSuppressSaveStateAlert = true;
      window.__schoolhubGradeCriteriaSaveInProgress = true;
      window.__schoolhubGradeCriteriaSaveInProgressCourseId = courseIdForSave;
      if(typeof window.saveStateToDB === 'function') saved = await window.saveStateToDB();
      else if(typeof saveStateToDB === 'function') saved = await saveStateToDB();
      else throw new Error('saveStateToDB is not available');
      window.__schoolhubSuppressSaveStateAlert = false;
      if(saved === false) throw (window.__schoolhubLastSaveStateError || new Error('saveStateToDB returned false'));
      console.log('[GRADE SAVE] saveStateToDB returned', saved);
      console.log('[GRADE SAVE] firebase success');

      window.__gradeCache = {};
      window.__finalGradeCache = {};
      gradeCriteriaDirty = false;
      gradeCriteriaModalLoadedForCourseId = cid;
      if(typeof window.closeModal === 'function') window.closeModal('grade-criteria-modal');
      else if(byId('grade-criteria-modal')) byId('grade-criteria-modal').classList.add('hidden');

      ['renderCourseOverview','renderScoreTable','renderMobileScoreCards','renderStudentCards','renderScoreList','renderStudentsMaster','updateGlobalViews'].forEach(function(name){
        try{ if(typeof window[name] === 'function') window[name](); }catch(renderErr){ console.warn('[GRADE SAVE] render failed', name, renderErr); }
      });
      try{ refreshFinalGradeCellsInCurrentCourse(); }catch(refreshErr){ console.warn('[GRADE SAVE] refresh final grade cells failed', refreshErr); }

      if(window.showCustomAlert) window.showCustomAlert('สำเร็จ','บันทึกเกณฑ์เกรดเรียบร้อยแล้ว');
    }catch(err){
      window.__schoolhubSuppressSaveStateAlert = false;
      console.error('[GRADE CRITERIA SAVE FAILED]', err);
      var saveMessage = String((err && err.message) || err || 'ไม่สามารถบันทึกลง Firebase ได้');
      if(window.showCustomAlert) window.showCustomAlert('บันทึกไม่สำเร็จ', saveMessage, true); else alert('บันทึกไม่สำเร็จ\n' + saveMessage);
    }
    window.__schoolhubGradeCriteriaSaveInProgress = false;
    window.__schoolhubGradeCriteriaSaveInProgressCourseId = '';
    return false;
  };
  window.handleGradeCriteriaSubmit.__schoolhubCanonicalGradeCriteriaSubmit = true;
  window.saveGradeCriteria = window.handleGradeCriteriaSubmit;
  window.savePlusCriteria = window.handleGradeCriteriaSubmit;
  window.saveEnhancedCriteria = window.handleGradeCriteriaSubmit;

  function refreshFinalGradeCellsInCurrentCourse(){
    var cid = getCurrentCourseId();
    if(!cid || !window.state) return;
    var course = currentCourse() || {id:cid};
    var students = [];
    try{ students = (typeof window.getCourseStudents === 'function') ? window.getCourseStudents(cid) : []; }catch(e){ students = []; }
    var table = byId('course-summary-table');
    if(!table || !students.length) return;
    var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
    rows.forEach(function(row, index){
      var student = students[index];
      if(!student) return;
      var gradeCell = row.querySelector('td.summary-grade-col');
      if(!gradeCell) return;
      var scoreInfo = computeTotalScoreForStudent(cid, student.id);
      var totalMax = Number(scoreInfo.totalMax || 0);
      var grade = totalMax > 0 ? getFinalGradeForStudent(course, student, scoreInfo.total) : '-';
      if(!grade) grade = '-';
      gradeCell.className = 'text-center font-bold '+gradeColor(grade, getCourseGradeCriteria(course))+' bg-amber-50/30 summary-grade-col';
      gradeCell.textContent = String(grade);
    });
    var mobileCards = Array.prototype.slice.call(document.querySelectorAll('#course-summary-mobile-cards .summary-mobile-card'));
    mobileCards.forEach(function(card, index){
      var student = students[index];
      if(!student) return;
      var scoreInfo = computeTotalScoreForStudent(cid, student.id);
      var totalMax = Number(scoreInfo.totalMax || 0);
      var grade = totalMax > 0 ? getFinalGradeForStudent(course, student, scoreInfo.total) : '-';
      var totalLine = card.querySelector('.summary-mobile-total');
      if(!totalLine) return;
      var spans = totalLine.querySelectorAll('span');
      if(spans && spans[1]){
        spans[1].className = gradeColor(grade, getCourseGradeCriteria(course));
        spans[1].textContent = 'เกรด ' + String(grade || '-');
      }
    });
  }
  window.refreshFinalGradeCellsInCurrentCourse = refreshFinalGradeCellsInCurrentCourse;

  function wrapRenderForFinalGrades(name){
    var fn = window[name];
    if(typeof fn !== 'function' || fn.__schoolhubFinalGradeRulesVisibleUiWrapped) return;
    var wrapped = function(){
      var result = fn.apply(this, arguments);
      try{ refreshFinalGradeCellsInCurrentCourse(); }catch(e){}
      return result;
    };
    wrapped.__schoolhubFinalGradeRulesVisibleUiWrapped = true;
    window[name] = wrapped;
  }
  wrapRenderForFinalGrades('renderCourseOverview');
  wrapRenderForFinalGrades('renderScoreList');
  wrapRenderForFinalGrades('renderScoreTable');
  wrapRenderForFinalGrades('renderMobileScoreCards');
  wrapRenderForFinalGrades('renderStudentCards');

  function bindGradeCriteriaModalObserver(){
    /* ปิด observer ตัวนี้เพื่อไม่ให้ loadCriteriaToModal() โหลดค่าเก่าทับค่าที่ผู้ใช้กำลังแก้
       การโหลดค่าเข้า modal จะทำผ่าน openGradeCriteriaModalForCurrentCourse() / loadCriteriaToModalOnce() เท่านั้น */
  }

  function findStudentByExportRow(row, header){
    var codeIndex = header.findIndex(function(h){return /รหัส/.test(String(h || ''));});
    var nameIndex = header.findIndex(function(h){return /ชื่อ/.test(String(h || ''));});
    var code = codeIndex >= 0 ? String(row[codeIndex] || '').trim() : '';
    var name = nameIndex >= 0 ? String(row[nameIndex] || '').trim() : '';
    return (state.students || []).find(function(st){return code && String(st.code || '').trim() === code;}) || (state.students || []).find(function(st){return name && String(st.name || '').trim() === name;}) || null;
  }
  function sanitizeExportAoaWithFinalGrades(aoa){
    if(!Array.isArray(aoa) || !window.state) return;
    var cid = getCurrentCourseId();
    var course = (state.courses || []).find(function(c){return String(c.id) === String(cid);}) || {id:cid};
    for(var h=0; h<aoa.length; h++){
      var header = aoa[h];
      if(!Array.isArray(header)) continue;
      var gradeIndex = header.findIndex(function(v){return /เกรด/.test(String(v || ''));});
      var totalIndex = header.findIndex(function(v){return /^รวม|รวมคะแนน/.test(String(v || ''));});
      if(gradeIndex < 0 || totalIndex < 0) continue;
      for(var r=h+1; r<aoa.length; r++){
        var row = aoa[r];
        if(!Array.isArray(row) || row.length < 2) break;
        var st = findStudentByExportRow(row, header);
        if(!st) continue;
        var total = Number(row[totalIndex]);
        if(!Number.isFinite(total)) total = computeTotalScoreForStudent(cid, st.id).total;
        row[gradeIndex] = getFinalGradeForStudent(course, st, total) || row[gradeIndex] || '';
      }
    }
  }
  function patchXlsxExport(){
    if(!window.XLSX || !XLSX.utils || !XLSX.utils.aoa_to_sheet || XLSX.utils.aoa_to_sheet.__schoolhubRealGradeRulesSpecialFinal) return;
    var old = XLSX.utils.aoa_to_sheet;
    XLSX.utils.aoa_to_sheet = function(aoa){
      try{ sanitizeExportAoaWithFinalGrades(aoa); }catch(e){ console.warn('sanitize final grades export failed', e); }
      return old.apply(this, arguments);
    };
    XLSX.utils.aoa_to_sheet.__schoolhubRealGradeRulesSpecialFinal = true;
  }

  document.addEventListener('DOMContentLoaded', function(){ ensureSpecialModal(); bindGradeCriteriaModalObserver(); try{ ensureMainGradeModalUI(); renderGradeSpecialRulesList(); }catch(e){} patchXlsxExport(); });
  setTimeout(patchXlsxExport, 500);
  document.addEventListener('click', function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(patchXlsxExport, 50); }, true);
})();
