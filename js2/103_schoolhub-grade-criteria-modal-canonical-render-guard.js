
(function(){
  if (window.__schoolhubGradeCriteriaModalCanonicalRenderGuard) return;
  window.__schoolhubGradeCriteriaModalCanonicalRenderGuard = true;

  var oldLoadCriteriaToModal = typeof window.loadCriteriaToModal === 'function' ? window.loadCriteriaToModal : null;
  var oldOpenGradeCriteria = typeof window.openGradeCriteriaModalForCurrentCourse === 'function' ? window.openGradeCriteriaModalForCurrentCourse : null;

  function byId(id){ return document.getElementById(id); }

  function ensureState(){
    if (!window.state || typeof window.state !== 'object') window.state = {};
    if (!Array.isArray(window.state.courses)) window.state.courses = [];
    if (!window.state.courseGrades || typeof window.state.courseGrades !== 'object') window.state.courseGrades = {};
    return window.state;
  }

  function clone(obj){
    try {
      if (typeof structuredClone === 'function') return structuredClone(obj);
    } catch (e) {}
    try { return JSON.parse(JSON.stringify(obj == null ? null : obj)); } catch (e) { return obj; }
  }

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  function hasStoredGradeCriteria(criteria){
    return !!(
      criteria &&
      typeof criteria === 'object' &&
      (
        Array.isArray(criteria.gradeRules) ||
        Array.isArray(criteria.specialRules) ||
        criteria.gradeFormat ||
        criteria.gradeType ||
        criteria.defaultGrade !== undefined
      )
    );
  }

  function defaultCriteria(format){
    if (format === 'letter') {
      return {
        gradeFormat: 'letter',
        gradeRules: [
          { label: 'A', minScore: 80 },
          { label: 'B+', minScore: 75 },
          { label: 'B', minScore: 70 },
          { label: 'C+', minScore: 65 },
          { label: 'C', minScore: 60 },
          { label: 'D+', minScore: 55 },
          { label: 'D', minScore: 50 },
          { label: 'F', minScore: 0 }
        ],
        specialRules: [],
        defaultGrade: 'F'
      };
    }

    return {
      gradeFormat: 'number',
      gradeRules: [
        { label: '4', minScore: 80 },
        { label: '3.5', minScore: 75 },
        { label: '3', minScore: 70 },
        { label: '2.5', minScore: 65 },
        { label: '2', minScore: 60 },
        { label: '1.5', minScore: 55 },
        { label: '1', minScore: 50 },
        { label: '0', minScore: 0 }
      ],
      specialRules: [],
      defaultGrade: '0'
    };
  }

  function normalizeGradeCriteria(criteria){
    var src = criteria && typeof criteria === 'object' ? criteria : {};
    var gradeFormat = src.gradeFormat || src.gradeType || 'number';

    var gradeRules = Array.isArray(src.gradeRules)
      ? src.gradeRules.map(function(r){
          return {
            label: String((r && (r.label ?? r.grade)) ?? '').trim(),
            minScore: Number((r && (r.minScore ?? r.min)) ?? 0)
          };
        }).filter(function(r){
          return r.label !== '' && Number.isFinite(r.minScore);
        })
      : [];

    var specialRules = Array.isArray(src.specialRules) ? clone(src.specialRules) : [];

    var defaultGrade =
      src.defaultGrade !== undefined && src.defaultGrade !== null
        ? String(src.defaultGrade)
        : (gradeFormat === 'letter' ? 'F' : '0');

    return Object.assign({}, src, {
      gradeFormat: gradeFormat,
      gradeRules: gradeRules,
      specialRules: specialRules,
      defaultGrade: defaultGrade
    });
  }

  function getCriteriaTime(criteria){
    if (!criteria || !criteria.updatedAt) return 0;
    var t = new Date(criteria.updatedAt).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function isDefaultLikeGradeCriteria(criteria){
    if (!criteria || typeof criteria !== 'object') return false;

    var format = criteria.gradeFormat || criteria.gradeType || '';
    var defaultGrade = String(criteria.defaultGrade ?? '');
    var rules = Array.isArray(criteria.gradeRules) ? criteria.gradeRules : [];

    var looksNumberDefault =
      format === 'number' &&
      defaultGrade === '0' &&
      rules.some(function(r){ return String((r && r.label) ?? '') === '4' && Number((r && r.minScore) ?? 0) === 80; }) &&
      rules.some(function(r){ return String((r && r.label) ?? '') === '0' && Number((r && r.minScore) ?? 0) === 0; });

    return looksNumberDefault && !criteria.updatedAt;
  }

  function chooseFinalGradeCriteria(courseCriteria, mapCriteria){
    var fromCourse = hasStoredGradeCriteria(courseCriteria) ? normalizeGradeCriteria(courseCriteria) : null;
    var fromMap = hasStoredGradeCriteria(mapCriteria) ? normalizeGradeCriteria(mapCriteria) : null;

    if (fromCourse && fromMap) {
      var courseTime = getCriteriaTime(fromCourse);
      var mapTime = getCriteriaTime(fromMap);

      if (courseTime || mapTime) return mapTime >= courseTime ? fromMap : fromCourse;

      if (isDefaultLikeGradeCriteria(fromCourse) && !isDefaultLikeGradeCriteria(fromMap)) return fromMap;
      if (!isDefaultLikeGradeCriteria(fromCourse) && isDefaultLikeGradeCriteria(fromMap)) return fromCourse;

      return fromMap;
    }

    return fromMap || fromCourse || normalizeGradeCriteria(defaultCriteria('number'));
  }

  function findCourseById(courseId){
    ensureState();
    return (window.state.courses || []).find(function(c){
      return c && String(c.id) === String(courseId);
    }) || null;
  }

  function findActiveCourseIdFallbackForGradeCriteria(){
    ensureState();

    var courses = Array.isArray(window.state.courses) ? window.state.courses : [];
    var validIds = new Set(courses.map(function(c){ return String(c && c.id); }));

    var modal = byId('grade-criteria-modal');
    var modalCid = modal && modal.dataset && modal.dataset.courseId
      ? String(modal.dataset.courseId).trim()
      : '';

    var candidates = [
      modalCid,
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
      (typeof activeCourseId !== 'undefined' ? activeCourseId : '')
    ];

    for (var i = 0; i < candidates.length; i++) {
      var cid = String(candidates[i] == null ? '' : candidates[i]).trim();
      if (cid && validIds.has(cid)) return cid;
    }

    var visibleCourseDetail = document.querySelector('#view-course-detail:not(.hidden)');
    if (visibleCourseDetail) {
      var dataCid =
        (visibleCourseDetail.dataset && visibleCourseDetail.dataset.courseId) ||
        visibleCourseDetail.getAttribute('data-course-id') ||
        '';
      if (dataCid && validIds.has(String(dataCid))) return String(dataCid);
    }

    return '';
  }

  function getGradeCriteriaCourseId(){
    ensureState();

    var courses = Array.isArray(window.state.courses) ? window.state.courses : [];
    var validIds = new Set(courses.map(function(c){ return String(c && c.id); }));

    var modal = byId('grade-criteria-modal');
    var modalCid = modal && modal.dataset ? String(modal.dataset.courseId || '').trim() : '';

    var candidates = [
      modalCid,
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
      (typeof activeCourseId !== 'undefined' ? activeCourseId : '')
    ];

    for (var i = 0; i < candidates.length; i++) {
      var cid = String(candidates[i] == null ? '' : candidates[i]).trim();
      if (cid && validIds.has(cid)) return cid;
    }

    return findActiveCourseIdFallbackForGradeCriteria();
  }

  function getStoredGradeCriteriaForCourse(courseOrId){
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

    window.state.courseGrades = window.state.courseGrades || {};

    var rawCourseGradeCriteria = course ? course.gradeCriteria : null;
    var rawCourseGradesEntry = window.state.courseGrades ? window.state.courseGrades[cid] : null;

    var finalCriteria = chooseFinalGradeCriteria(rawCourseGradeCriteria, rawCourseGradesEntry);

    window.state.courseGrades[cid] = clone(finalCriteria);

    if (course) course.gradeCriteria = clone(finalCriteria);

    if (window.currentCourse && String(window.currentCourse.id) === cid) {
      window.currentCourse.gradeCriteria = clone(finalCriteria);
    }

    console.log('[GRADE LOAD] resolved duplicated gradeCriteria sources', {
      courseId: cid,
      rawCourseGradeCriteria: rawCourseGradeCriteria,
      rawCourseGradesEntry: rawCourseGradesEntry,
      selectedFinalCriteria: finalCriteria
    });

    return finalCriteria;
  }

  function ensureGradeCriteriaModalSkeleton(){
    var modal = byId('grade-criteria-modal');
    var form = modal && modal.querySelector('form');
    if (!form) return;

    if (!byId('schoolhub-grade-rules-list')) {
      form.innerHTML =
        '<div id="schoolhub-grade-extra-rules" class="schoolhub-grade-main-box">' +
          '<div class="schoolhub-grade-main-title"><i class="fas fa-sliders text-primary"></i> เกณฑ์แปลงคะแนนเป็นเกรด</div>' +
          '<div class="schoolhub-grade-format-row">' +
            '<div><label class="block mb-1">รูปแบบเกรด</label>' +
              '<select id="grade-type-select" onchange="applyGradePresetFromButton && applyGradePresetFromButton()">' +
                '<option value="number">รูปแบบตัวเลข (4, 3.5)</option>' +
                '<option value="letter">รูปแบบตัวอักษร (A, B+)</option>' +
                '<option value="custom">รูปแบบกำหนดเอง</option>' +
              '</select>' +
            '</div>' +
            '<button type="button" class="schoolhub-grade-mini-btn" onclick="applyGradePresetFromButton && applyGradePresetFromButton()"><i class="fas fa-wand-magic-sparkles mr-1"></i> ใช้รูปแบบนี้</button>' +
            '<button type="button" class="schoolhub-grade-mini-btn" onclick="addGradeRuleRow && addGradeRuleRow()"><i class="fas fa-plus mr-1"></i> เพิ่มเกรด</button>' +
          '</div>' +
          '<div class="schoolhub-grade-rule-head"><div>ชื่อเกรด / ผลลัพธ์</div><div>คะแนนขั้นต่ำ</div><div></div></div>' +
          '<div id="schoolhub-grade-rules-list"></div>' +
          '<div class="mt-3"><label class="block text-xs font-black text-slate-500 mb-1">ค่าเริ่มต้นถ้าคะแนนต่ำกว่าเกณฑ์ทั้งหมด</label><input id="schoolhub-default-grade" type="text" placeholder="เช่น 0 หรือ F"></div>' +
          '<div id="schoolhub-grade-legacy-inputs" class="hidden"><input id="grade-crit-4"><input id="grade-crit-35"><input id="grade-crit-3"><input id="grade-crit-25"><input id="grade-crit-2"><input id="grade-crit-15"><input id="grade-crit-1"><input id="grade-crit-0"></div>' +
        '</div>' +
        '<div class="schoolhub-grade-main-box mt-4">' +
          '<div class="flex items-center justify-between gap-3 mb-3"><div class="schoolhub-grade-main-title mb-0"><i class="fas fa-user-clock text-rose-500"></i> เกณฑ์พิเศษจากการเข้าเรียน</div><button type="button" onclick="startAddGradeSpecialRule && startAddGradeSpecialRule()" class="schoolhub-grade-mini-btn"><i class="fas fa-plus mr-1"></i> เพิ่มเกณฑ์พิเศษ</button></div>' +
          '<div id="schoolhub-special-rules-list"></div>' +
          '<p class="text-xs text-slate-400 font-semibold mt-2">ถ้าจำนวนสายหรือขาดถึงเกณฑ์อย่างใดอย่างหนึ่ง ระบบจะแสดงผลลัพธ์พิเศษก่อนคำนวณเกรดจากคะแนน</p>' +
        '</div>' +
        '<div class="pt-4 flex gap-3"><button type="button" onclick="closeModal && closeModal(\'grade-criteria-modal\')" class="w-1/2 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">ยกเลิก</button><button type="submit" class="w-1/2 py-3 text-white bg-primary rounded-xl font-bold shadow-lg shadow-indigo-200">บันทึก</button></div>';
    }

    if (!form.__schoolhubCanonicalSubmitRebound) {
      form.__schoolhubCanonicalSubmitRebound = true;
      form.onsubmit = function(e){
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (typeof window.handleGradeCriteriaSubmit === 'function') {
          return window.handleGradeCriteriaSubmit(e);
        }
        return false;
      };
    }
  }

  function forceRenderGradeCriteriaModal(courseId){
    ensureState();

    var modal = byId('grade-criteria-modal');
    var cid = String(
      courseId ||
      (modal && modal.dataset && modal.dataset.courseId) ||
      getGradeCriteriaCourseId() ||
      findActiveCourseIdFallbackForGradeCriteria() ||
      ''
    );

    if (!cid) {
      console.error('[GRADE MODAL] force render failed: missing courseId');
      return false;
    }

    if (modal) modal.dataset.courseId = cid;

    ensureGradeCriteriaModalSkeleton();

    var course = findCourseById(cid);
    var criteria = getStoredGradeCriteriaForCourse(course || cid);

    if (oldLoadCriteriaToModal && oldLoadCriteriaToModal !== window.loadCriteriaToModal && !forceRenderGradeCriteriaModal.__callingOldLoad) {
      forceRenderGradeCriteriaModal.__callingOldLoad = true;
      try {
        oldLoadCriteriaToModal(cid);
      } catch (oldLoadErr) {
        console.warn('[GRADE MODAL] old loadCriteriaToModal failed before force render', oldLoadErr);
      }
      forceRenderGradeCriteriaModal.__callingOldLoad = false;

      course = findCourseById(cid);
      criteria = getStoredGradeCriteriaForCourse(course || cid);
    }

    var gradeBox = byId('schoolhub-grade-rules-list');
    var specialBox = byId('schoolhub-special-rules-list');
    var sel = byId('grade-type-select');
    var def = byId('schoolhub-default-grade');

    var rules = Array.isArray(criteria.gradeRules) ? criteria.gradeRules : [];
    var specialRules = Array.isArray(criteria.specialRules) ? criteria.specialRules : [];

    window.tempGradeRules = clone(rules);
    window.tempGradeSpecialRules = clone(specialRules);

    if (sel && !window.__schoolhubGradeTypeDirty) sel.value = criteria.gradeFormat || criteria.gradeType || 'number';
    if (def) def.value = criteria.defaultGrade || '';

    if (gradeBox) {
      if (rules.length) {
        gradeBox.innerHTML = rules.map(function(r, i){
          return '' +
            '<div class="schoolhub-grade-rule-row" data-grade-rule-row="' + i + '">' +
              '<input class="grade-rule-label" type="text" value="' + esc(r && r.label) + '" placeholder="เช่น 4, A, ผ่าน">' +
              '<input class="grade-rule-min" type="number" inputmode="decimal" value="' + esc(r && r.minScore) + '" placeholder="คะแนนขั้นต่ำ">' +
              '<button type="button" class="schoolhub-grade-danger-btn" onclick="deleteGradeRuleRow(' + i + ')"><i class="fas fa-trash"></i></button>' +
            '</div>';
        }).join('');
      } else {
        gradeBox.innerHTML = '<div class="schoolhub-grade-empty">ยังไม่มีเกณฑ์เกรด</div>';
      }
    }

    if (specialBox) {
      if (specialRules.length) {
        specialBox.innerHTML = specialRules.map(function(r, i){
          return '' +
            '<div class="schoolhub-special-rule-card">' +
              '<div>' +
                '<b>' + esc(r && r.label) + '</b>' +
                '<div>' +
                  '<span>สายตั้งแต่ ' + esc(Number((r && r.lateCount) || 0)) + ' ครั้ง</span> ' +
                  '<span>• ขาดตั้งแต่ ' + esc(Number((r && r.absentCount) || 0)) + ' ครั้ง</span>' +
                '</div>' +
              '</div>' +
              '<div class="flex gap-2 justify-end">' +
                '<button type="button" class="schoolhub-grade-edit-btn" onclick="editGradeSpecialRule(' + i + ')"><i class="fas fa-pen mr-1"></i>แก้ไข</button>' +
                '<button type="button" class="schoolhub-grade-danger-btn" onclick="deleteGradeSpecialRule(' + i + ')"><i class="fas fa-trash mr-1"></i>ลบ</button>' +
              '</div>' +
            '</div>';
        }).join('');
      } else {
        specialBox.innerHTML = '<div class="schoolhub-grade-empty">ยังไม่มีเกณฑ์พิเศษ</div>';
      }
    }

    var stillLoading = !!(gradeBox && /กำลังโหลดเกณฑ์เกรด/.test(gradeBox.innerHTML || ''));

    console.log('[GRADE MODAL] forceRenderGradeCriteriaModal result', {
      courseId: cid,
      criteria: criteria,
      gradeRulesCount: rules.length,
      specialRulesCount: specialRules.length,
      stillLoading: stillLoading,
      gradeRulesHTML: gradeBox ? gradeBox.innerHTML : null,
      specialRulesHTML: specialBox ? specialBox.innerHTML : null
    });

    if (stillLoading && gradeBox) {
      console.error('[GRADE MODAL] ERROR: loading placeholder still visible after force render');
      gradeBox.innerHTML = rules.length
        ? gradeBox.innerHTML.replace(/กำลังโหลดเกณฑ์เกรด\.\.\./g, '')
        : '<div class="schoolhub-grade-empty">ยังไม่มีเกณฑ์เกรด</div>';
    }

    return true;
  }

  window.findActiveCourseIdFallbackForGradeCriteria = findActiveCourseIdFallbackForGradeCriteria;
  window.getGradeCriteriaCourseId = getGradeCriteriaCourseId;
  window.getStoredGradeCriteriaForCourse = getStoredGradeCriteriaForCourse;
  window.getCourseGradeCriteria = getStoredGradeCriteriaForCourse;
  window.chooseFinalGradeCriteria = chooseFinalGradeCriteria;
  window.forceRenderGradeCriteriaModal = forceRenderGradeCriteriaModal;

  window.loadCriteriaToModal = function(courseId){
    return forceRenderGradeCriteriaModal(courseId);
  };

  window.loadCriteriaToModalOnce = async function(){
    var cid = getGradeCriteriaCourseId() || findActiveCourseIdFallbackForGradeCriteria();
    if (typeof window.loadStateFromDB === 'function') {
      try { await window.loadStateFromDB(); } catch (err) { console.warn('[GRADE MODAL] loadStateFromDB failed in loadCriteriaToModalOnce', err); }
    }
    cid = cid || getGradeCriteriaCourseId() || findActiveCourseIdFallbackForGradeCriteria();
    return forceRenderGradeCriteriaModal(cid);
  };

  window.openGradeCriteriaModalForCurrentCourse = async function(e){
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }

    ensureState();

    var modal = byId('grade-criteria-modal');

    console.log('[GRADE MODAL] open start before load', {
      currentActiveCourseId: window.currentActiveCourseId,
      currentCourseId: window.currentCourseId,
      selectedCourseId: window.selectedCourseId,
      stateCoursesBeforeLoad: (window.state.courses || []).map(function(c){ return { id: c && c.id, code: c && c.code, name: c && c.name }; }),
      courseGradesKeysBeforeLoad: Object.keys(window.state.courseGrades || {})
    });

    if (typeof window.loadStateFromDB === 'function') {
      try {
        await window.loadStateFromDB();
      } catch (err) {
        console.warn('[GRADE MODAL] loadStateFromDB failed before open', err);
      }
    }

    ensureState();

    var cid = getGradeCriteriaCourseId() || findActiveCourseIdFallbackForGradeCriteria();

    if (!cid) {
      console.error('[GRADE MODAL] missing courseId after load', {
        stateCoursesAfterLoad: window.state.courses,
        courseGradesKeysAfterLoad: Object.keys(window.state.courseGrades || {})
      });
      if (window.showCustomAlert) window.showCustomAlert('เปิดไม่ได้', 'ไม่พบรายวิชาปัจจุบัน กรุณาเข้าหน้ารายวิชาก่อนตั้งค่าเกณฑ์เกรด', true);
      else alert('เปิดไม่ได้\nไม่พบรายวิชาปัจจุบัน กรุณาเข้าหน้ารายวิชาก่อนตั้งค่าเกณฑ์เกรด');
      return false;
    }

    if (modal) modal.dataset.courseId = String(cid);

    var course = findCourseById(cid);

    if (!course) {
      console.error('[GRADE MODAL] course not found after load', {
        courseId: cid,
        stateCoursesAfterLoad: window.state.courses
      });
      if (window.showCustomAlert) window.showCustomAlert('ไม่พบรายวิชา', 'ไม่พบรายวิชานี้ในข้อมูลที่โหลดจาก Firebase', true);
      else alert('ไม่พบรายวิชา\nไม่พบรายวิชานี้ในข้อมูลที่โหลดจาก Firebase');
      return false;
    }

    var criteria = getStoredGradeCriteriaForCourse(course);

    console.log('[GRADE MODAL] criteria resolved before render', {
      courseId: cid,
      courseGradeCriteria: course.gradeCriteria,
      courseGradesEntry: window.state.courseGrades && window.state.courseGrades[cid],
      criteria: criteria
    });

    forceRenderGradeCriteriaModal(cid);

    if (typeof window.openModal === 'function') {
      window.openModal('grade-criteria-modal');
    } else if (modal) {
      modal.classList.remove('hidden');
    }

    forceRenderGradeCriteriaModal(cid);

    return false;
  };

  window.openGradeCriteriaModalForCurrentCourse.__schoolhubCanonicalGradeCriteriaOpen = true;
  window.openGradeCriteria = window.openGradeCriteriaModalForCurrentCourse;

  function wrapOpenModalForGradeCriteria(){
    if (typeof window.openModal !== 'function' || window.openModal.__schoolhubGradeCriteriaRenderWrappedFinal) return;

    var oldOpenModal = window.openModal;

    window.openModal = function(id){
      if (id === 'grade-criteria-modal') {
        var cid = getGradeCriteriaCourseId() || findActiveCourseIdFallbackForGradeCriteria();

        if (cid) {
          var modal = byId('grade-criteria-modal');
          if (modal) modal.dataset.courseId = String(cid);

          forceRenderGradeCriteriaModal(cid);
        }
      }

      return oldOpenModal.apply(this, arguments);
    };

    window.openModal.__schoolhubGradeCriteriaRenderWrappedFinal = true;
  }

  wrapOpenModalForGradeCriteria();

  function bindGradeCriteriaVisibleObserver(){
    var modal = byId('grade-criteria-modal');
    if (!modal || modal.__schoolhubGradeCriteriaVisibleObserverFinal) return;

    modal.__schoolhubGradeCriteriaVisibleObserverFinal = true;

    var observer = new MutationObserver(function(){
      if (!modal.classList.contains('hidden')) {
        var cid =
          (modal.dataset && modal.dataset.courseId) ||
          getGradeCriteriaCourseId() ||
          findActiveCourseIdFallbackForGradeCriteria();

        if (cid) {
          forceRenderGradeCriteriaModal(cid);
        }
      }
    });

    observer.observe(modal, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  function bindGradeCriteriaClickCapture(){
    if (document.__schoolhubGradeCriteriaClickCaptureFinal) return;
    document.__schoolhubGradeCriteriaClickCaptureFinal = true;

    document.addEventListener('click', function(e){
      var btn = e.target && e.target.closest
        ? e.target.closest('button, a, [role="button"]')
        : null;

      if (!btn) return;

      var text = String(btn.textContent || '');
      var onclick = String(btn.getAttribute('onclick') || '');

      var isGradeCriteriaButton =
        onclick.indexOf('openGradeCriteriaModalForCurrentCourse') >= 0 ||
        onclick.indexOf('openGradeCriteria') >= 0 ||
        onclick.indexOf("openModal('grade-criteria-modal')") >= 0 ||
        onclick.indexOf('openModal("grade-criteria-modal")') >= 0 ||
        text.indexOf('ตั้งค่าเกณฑ์เกรด') >= 0;

      if (!isGradeCriteriaButton) return;

      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();

      window.openGradeCriteriaModalForCurrentCourse(e);
    }, true);
  }

  bindGradeCriteriaClickCapture();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){
      bindGradeCriteriaVisibleObserver();
      wrapOpenModalForGradeCriteria();
    });
  } else {
    bindGradeCriteriaVisibleObserver();
  }

  setTimeout(function(){
    bindGradeCriteriaVisibleObserver();
    wrapOpenModalForGradeCriteria();
  }, 500);
})();
