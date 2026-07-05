
(function(){
  if (window.__schoolhubGradeCriteriaStrictPerCourseGuard) return;
  window.__schoolhubGradeCriteriaStrictPerCourseGuard = true;

  var previousForceRenderGradeCriteriaModal =
    typeof window.forceRenderGradeCriteriaModal === 'function'
      ? window.forceRenderGradeCriteriaModal
      : null;

  var previousHandleGradeCriteriaSubmit =
    typeof window.handleGradeCriteriaSubmit === 'function'
      ? window.handleGradeCriteriaSubmit
      : null;

  function byId(id){ return document.getElementById(id); }

  function ensureState(){
    if (!window.state || typeof window.state !== 'object') window.state = {};
    if (!Array.isArray(window.state.courses)) window.state.courses = [];
    if (!window.state.courseGrades || typeof window.state.courseGrades !== 'object') window.state.courseGrades = {};
  }

  function clone(obj){
    try {
      if (typeof structuredClone === 'function') return structuredClone(obj);
    } catch(e) {}
    try {
      return JSON.parse(JSON.stringify(obj == null ? null : obj));
    } catch(e) {
      return obj;
    }
  }

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  function validCourseIds(){
    ensureState();
    return new Set((window.state.courses || []).map(function(c){
      return String(c && c.id);
    }).filter(Boolean));
  }

  function findCourseById(courseId){
    ensureState();
    var cid = String(courseId == null ? '' : courseId).trim();
    if (!cid) return null;
    return (window.state.courses || []).find(function(c){
      return c && String(c.id) === cid;
    }) || null;
  }

  function extractCourseIdFromOnclick(onclickText){
    var text = String(onclickText || '');
    var m =
      text.match(/openGradeCriteriaModalForCourse\s*\(\s*['"]([^'"]+)['"]\s*\)/) ||
      text.match(/enterCourse\s*\(\s*['"]([^'"]+)['"]\s*\)/) ||
      text.match(/openCourseDetail\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    return m && m[1] ? String(m[1]).trim() : '';
  }

  function getCourseIdFromEventTarget(evtOrElement){
    var target = evtOrElement && evtOrElement.target ? evtOrElement.target : evtOrElement;
    var el = target && target.closest
      ? target.closest('button, a, [role="button"], [data-course-id]')
      : null;

    if (!el) return '';

    var candidates = [
      el.dataset && el.dataset.courseId,
      el.getAttribute && el.getAttribute('data-course-id'),
      el.closest && el.closest('[data-course-id]') && el.closest('[data-course-id]').getAttribute('data-course-id'),
      extractCourseIdFromOnclick(el.getAttribute && el.getAttribute('onclick'))
    ];

    var ids = validCourseIds();
    for (var i = 0; i < candidates.length; i++) {
      var cid = String(candidates[i] == null ? '' : candidates[i]).trim();
      if (cid && ids.has(cid)) return cid;
    }

    return '';
  }

  function getGradeCriteriaCourseIdStrict(evtOrElement){
    ensureState();

    var ids = validCourseIds();
    var fromEvent = getCourseIdFromEventTarget(evtOrElement);
    if (fromEvent && ids.has(fromEvent)) return fromEvent;

    var modal = byId('grade-criteria-modal');
    var modalCid = modal && modal.dataset && modal.dataset.courseId
      ? String(modal.dataset.courseId).trim()
      : '';

    var visibleCourseDetail = document.querySelector('#view-course-detail:not(.hidden)');
    var detailCid =
      (visibleCourseDetail && visibleCourseDetail.dataset && visibleCourseDetail.dataset.courseId) ||
      (visibleCourseDetail && visibleCourseDetail.getAttribute && visibleCourseDetail.getAttribute('data-course-id')) ||
      '';

    var candidates = [
      detailCid,
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

    for (var i = 0; i < candidates.length; i++) {
      var cid = String(candidates[i] == null ? '' : candidates[i]).trim();
      if (cid && ids.has(cid)) return cid;
    }

    // ห้าม fallback จาก Object.keys(state.courseGrades)[0]
    // ห้าม fallback จาก state.courses[0].id
    return '';
  }

  function stampCourseContext(courseId){
    var cid = String(courseId == null ? '' : courseId).trim();
    if (!cid) return;
    var ids = validCourseIds();
    if (!ids.has(cid)) return;

    var detail = byId('view-course-detail');
    if (detail) detail.dataset.courseId = cid;

    var modal = byId('grade-criteria-modal');
    if (modal && !modal.classList.contains('hidden')) modal.dataset.courseId = cid;

    document.querySelectorAll('button, a').forEach(function(btn){
      var text = String(btn.textContent || '');
      var onclick = String((btn.getAttribute && btn.getAttribute('onclick')) || '');
      if (text.indexOf('ตั้งค่าเกณฑ์เกรด') >= 0 || onclick.indexOf('openGradeCriteriaModalForCurrentCourse') >= 0) {
        btn.setAttribute('data-course-id', cid);
      }
    });
  }

  function installEnterCourseStamp(){
    if (typeof window.enterCourse !== 'function' || window.enterCourse.__schoolhubGradeCriteriaStrictStamped) return;
    var oldEnterCourse = window.enterCourse;
    window.enterCourse = function(courseId){
      var result = oldEnterCourse.apply(this, arguments);
      stampCourseContext(courseId);
      setTimeout(function(){ stampCourseContext(courseId); }, 0);
      setTimeout(function(){ stampCourseContext(courseId); }, 100);
      return result;
    };
    window.enterCourse.__schoolhubGradeCriteriaStrictStamped = true;
  }

  function showAlert(title, message, isError){
    if (typeof window.showCustomAlert === 'function') {
      window.showCustomAlert(title, message, !!isError);
    } else {
      alert(title + '\n' + message);
    }
  }

  function canOpenGradeCriteriaForCourse(course){
    try {
      if (window.isAdmin || (window.currentUser && window.currentUser.uid === 'admin-bypass')) return true;
    } catch(e) {}

    try {
      if (typeof window.schoolhubIsReadonlySharedCourse === 'function' && window.schoolhubIsReadonlySharedCourse(course)) {
        showAlert('ดูได้อย่างเดียว', 'คุณมีสิทธิ์ดูรายวิชานี้เท่านั้น ไม่สามารถตั้งค่าเกณฑ์เกรดได้', true);
        return false;
      }
    } catch(e) {}

    var ok = true;
    try {
      if (typeof window.schoolhubExpandedPlanAllows === 'function') ok = !!window.schoolhubExpandedPlanAllows('gradeCriteria');
    } catch(e) {}

    try {
      if (ok && typeof window.currentPlanAllows === 'function') ok = !!window.currentPlanAllows('gradeCriteria');
    } catch(e) {}

    if (!ok) {
      showAlert('แผนนี้ไม่รองรับการตั้งค่าเกณฑ์เกรด', 'กรุณาอัปเกรดแผนเพื่อตั้งค่าเกณฑ์เกรด', true);
      return false;
    }

    return true;
  }

  function getCriteriaForExactCourse(course){
    if (typeof window.getStoredGradeCriteriaForCourse === 'function') {
      return window.getStoredGradeCriteriaForCourse(course);
    }

    var cid = String(course && course.id);
    window.state.courseGrades = window.state.courseGrades || {};
    var fromMap = window.state.courseGrades[cid];
    var fromCourse = course && course.gradeCriteria;
    var criteria = fromMap || fromCourse || {
      gradeFormat: 'number',
      gradeRules: [
        {label:'4', minScore:80},
        {label:'3.5', minScore:75},
        {label:'3', minScore:70},
        {label:'2.5', minScore:65},
        {label:'2', minScore:60},
        {label:'1.5', minScore:55},
        {label:'1', minScore:50},
        {label:'0', minScore:0}
      ],
      specialRules: [],
      defaultGrade: '0'
    };

    course.gradeCriteria = clone(criteria);
    window.state.courseGrades[cid] = clone(criteria);
    return criteria;
  }

  function ensureModalSkeletonIfNeeded(){
    if (byId('schoolhub-grade-rules-list') && byId('schoolhub-special-rules-list')) return;

    var modal = byId('grade-criteria-modal');
    var form = modal && modal.querySelector('form');
    if (!form) return;

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
      '</div>' +
      '<div class="schoolhub-grade-main-box mt-4">' +
        '<div class="flex items-center justify-between gap-3 mb-3"><div class="schoolhub-grade-main-title mb-0"><i class="fas fa-user-clock text-rose-500"></i> เกณฑ์พิเศษจากการเข้าเรียน</div><button type="button" onclick="startAddGradeSpecialRule && startAddGradeSpecialRule()" class="schoolhub-grade-mini-btn"><i class="fas fa-plus mr-1"></i> เพิ่มเกณฑ์พิเศษ</button></div>' +
        '<div id="schoolhub-special-rules-list"></div>' +
        '<p class="text-xs text-slate-400 font-semibold mt-2">ถ้าจำนวนสายหรือขาดถึงเกณฑ์อย่างใดอย่างหนึ่ง ระบบจะแสดงผลลัพธ์พิเศษก่อนคำนวณเกรดจากคะแนน</p>' +
      '</div>' +
      '<div class="pt-4 flex gap-3"><button type="button" onclick="closeModal && closeModal(\'grade-criteria-modal\')" class="w-1/2 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">ยกเลิก</button><button type="submit" class="w-1/2 py-3 text-white bg-primary rounded-xl font-bold shadow-lg shadow-indigo-200">บันทึก</button></div>';
  }

  function renderExactCriteriaHtml(course, criteria){
    var gradeBox = byId('schoolhub-grade-rules-list');
    var specialBox = byId('schoolhub-special-rules-list');
    var sel = byId('grade-type-select');
    var def = byId('schoolhub-default-grade');

    var rules = Array.isArray(criteria && criteria.gradeRules) ? criteria.gradeRules : [];
    var specialRules = Array.isArray(criteria && criteria.specialRules) ? criteria.specialRules : [];

    window.tempGradeRules = clone(rules);
    window.tempGradeSpecialRules = clone(specialRules);

    if (sel && !window.__schoolhubGradeTypeDirty) sel.value = criteria.gradeFormat || criteria.gradeType || 'number';
    if (def) def.value = criteria.defaultGrade || '';

    if (gradeBox) {
      gradeBox.innerHTML = rules.length
        ? rules.map(function(r, i){
            return '' +
              '<div class="schoolhub-grade-rule-row" data-grade-rule-row="' + i + '">' +
                '<input class="grade-rule-label" type="text" value="' + esc(r && r.label) + '" placeholder="เช่น 4, A, ผ่าน">' +
                '<input class="grade-rule-min" type="number" inputmode="decimal" value="' + esc(r && r.minScore) + '" placeholder="คะแนนขั้นต่ำ">' +
                '<button type="button" class="schoolhub-grade-danger-btn" onclick="deleteGradeRuleRow(' + i + ')"><i class="fas fa-trash"></i></button>' +
              '</div>';
          }).join('')
        : '<div class="schoolhub-grade-empty">ยังไม่มีเกณฑ์เกรด</div>';
    }

    if (specialBox) {
      specialBox.innerHTML = specialRules.length
        ? specialRules.map(function(r, i){
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
          }).join('')
        : '<div class="schoolhub-grade-empty">ยังไม่มีเกณฑ์พิเศษ</div>';
    }

    console.log('[GRADE MODAL] forceRender exact course result', {
      courseId: String(course.id),
      courseName: course.name || course.code || '',
      criteria: criteria,
      gradeRulesCount: rules.length,
      specialRulesCount: specialRules.length
    });
  }

  function forceRenderGradeCriteriaModalStrict(courseId){
    ensureState();

    var modal = byId('grade-criteria-modal');
    var cid = String(
      courseId ||
      (modal && modal.dataset && modal.dataset.courseId) ||
      getGradeCriteriaCourseIdStrict() ||
      ''
    ).trim();

    if (!cid) {
      console.error('[GRADE MODAL] force render blocked: missing strict courseId');
      return false;
    }

    var course = findCourseById(cid);
    if (!course) {
      console.error('[GRADE MODAL] force render blocked: course not found', {
        courseId: cid,
        courses: window.state.courses
      });
      return false;
    }

    if (modal) modal.dataset.courseId = cid;
    stampCourseContext(cid);

    // ให้ loader เดิมใน IIFE หลักได้อัปเดต tempGradeRules/tempGradeSpecialRules ภายใน closure ของมันด้วย
    if (previousForceRenderGradeCriteriaModal && previousForceRenderGradeCriteriaModal !== forceRenderGradeCriteriaModalStrict) {
      try {
        previousForceRenderGradeCriteriaModal(cid);
      } catch(prevErr) {
        console.warn('[GRADE MODAL] previous force render failed for exact course', prevErr);
      }
    }

    ensureModalSkeletonIfNeeded();

    var criteria = getCriteriaForExactCourse(course);
    renderExactCriteriaHtml(course, criteria);

    var gradeBox = byId('schoolhub-grade-rules-list');
    if (gradeBox && /กำลังโหลดเกณฑ์เกรด/.test(gradeBox.innerHTML || '')) {
      gradeBox.innerHTML = '<div class="schoolhub-grade-empty">ยังไม่มีเกณฑ์เกรด</div>';
      console.error('[GRADE MODAL] loading placeholder removed for exact course', { courseId: cid });
    }

    return true;
  }

  window.getGradeCriteriaCourseIdStrict = getGradeCriteriaCourseIdStrict;
  window.getGradeCriteriaCourseId = getGradeCriteriaCourseIdStrict;
  window.findActiveCourseIdFallbackForGradeCriteria = function(){
    return getGradeCriteriaCourseIdStrict();
  };
  window.forceRenderGradeCriteriaModal = forceRenderGradeCriteriaModalStrict;

  window.loadCriteriaToModal = function(courseId){
    var cid = String(courseId || getGradeCriteriaCourseIdStrict() || '').trim();
    if (!cid) {
      console.error('[GRADE MODAL] loadCriteriaToModal blocked: missing strict courseId');
      return false;
    }
    return forceRenderGradeCriteriaModalStrict(cid);
  };

  window.loadCriteriaToModalOnce = async function(){
    var cid = getGradeCriteriaCourseIdStrict();
    if (!cid) {
      console.error('[GRADE MODAL] loadCriteriaToModalOnce blocked: missing strict courseId before load');
      return false;
    }

    if (typeof window.loadStateFromDB === 'function') {
      try {
        await window.loadStateFromDB();
      } catch(err) {
        console.warn('[GRADE MODAL] loadStateFromDB failed in strict loadCriteriaToModalOnce', err);
      }
    }

    return forceRenderGradeCriteriaModalStrict(cid);
  };

  window.openGradeCriteriaModalForCourse = async function(courseId, evt){
    ensureState();

    var cid = String(courseId || getCourseIdFromEventTarget(evt) || '').trim();

    if (!cid) {
      console.error('[GRADE MODAL] missing explicit courseId');
      showAlert('เปิดไม่ได้', 'ไม่พบรหัสรายวิชาที่ต้องตั้งค่าเกณฑ์เกรด', true);
      return false;
    }

    var beforeIds = validCourseIds();

    if (typeof window.loadStateFromDB === 'function') {
      try {
        await window.loadStateFromDB();
      } catch(err) {
        console.warn('[GRADE MODAL] loadStateFromDB failed before strict open', err);
      }
    }

    ensureState();

    if (!validCourseIds().has(cid) && beforeIds.has(cid)) {
      // ใช้ cid เดิมจาก context ถ้าก่อนโหลดมีอยู่ แต่หลังโหลด state ถูกรีเฟรชชั่วคราว
      console.warn('[GRADE MODAL] courseId existed before load but missing after load', { courseId: cid });
    }

    var course = findCourseById(cid);
    if (!course) {
      console.error('[GRADE MODAL] course not found for explicit courseId', {
        courseId: cid,
        courses: window.state.courses
      });
      showAlert('ไม่พบรายวิชา', 'ไม่พบรายวิชานี้ในข้อมูลที่โหลดจาก Firebase', true);
      return false;
    }

    if (!canOpenGradeCriteriaForCourse(course)) return false;

    var modal = byId('grade-criteria-modal');
    if (modal) modal.dataset.courseId = cid;
    stampCourseContext(cid);

    // ล้าง temp ฝั่ง window ทุกครั้ง เพื่อกันค่าข้ามวิชา
    window.tempGradeRules = [];
    window.tempGradeSpecialRules = [];

    var criteria = getCriteriaForExactCourse(course);

    console.log('[GRADE MODAL] open for exact course', {
      courseId: cid,
      courseName: course.name || course.code || '',
      criteria: criteria,
      courseGradeCriteria: course.gradeCriteria,
      courseGradesEntry: window.state.courseGrades && window.state.courseGrades[cid] || null
    });

    forceRenderGradeCriteriaModalStrict(cid);

    if (typeof window.openModal === 'function') {
      window.openModal('grade-criteria-modal');
    } else if (modal) {
      modal.classList.remove('hidden');
    }

    return false;
  };

  window.openGradeCriteriaModalForCurrentCourse = function(evt){
    var cid = getGradeCriteriaCourseIdStrict(evt);

    if (!cid) {
      console.error('[GRADE MODAL] cannot resolve current courseId strictly');
      showAlert('เปิดไม่ได้', 'ไม่พบรายวิชาปัจจุบัน กรุณาเข้าหน้ารายวิชาก่อนตั้งค่าเกณฑ์เกรด', true);
      return false;
    }

    return window.openGradeCriteriaModalForCourse(cid, evt);
  };

  window.openGradeCriteriaModalForCurrentCourse.__schoolhubCanonicalGradeCriteriaOpen = true;
  window.openGradeCriteria = window.openGradeCriteriaModalForCurrentCourse;

  if (previousHandleGradeCriteriaSubmit && previousHandleGradeCriteriaSubmit.__schoolhubStrictPerCourseWrapped !== true) {
    window.handleGradeCriteriaSubmit = async function(e){
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      ensureState();

      var modal = byId('grade-criteria-modal');
      var courseId = String(modal && modal.dataset && modal.dataset.courseId || '').trim();

      if (!courseId) {
        showAlert('บันทึกไม่สำเร็จ', 'ไม่พบรายวิชาของ popup นี้ กรุณาปิดแล้วเปิดใหม่จากรายวิชาที่ต้องการ', true);
        console.error('[GRADE SAVE] missing modal.dataset.courseId');
        return false;
      }

      var course = findCourseById(courseId);
      if (!course) {
        showAlert('บันทึกไม่สำเร็จ', 'ไม่พบรายวิชาใน state.courses', true);
        console.error('[GRADE SAVE] course not found for modal courseId', {
          courseId: courseId,
          courses: window.state.courses
        });
        return false;
      }

      // ใช้ submit เดิมเพื่อรักษา tempGradeSpecialRules ภายใน closure เดิม แต่ล็อก courseId จาก modal.dataset เท่านั้น
      console.log('[GRADE SAVE] strict modal courseId only', {
        courseId: courseId,
        courseName: course.name || course.code || ''
      });

      return previousHandleGradeCriteriaSubmit.call(this, e);
    };

    window.handleGradeCriteriaSubmit.__schoolhubCanonicalGradeCriteriaSubmit = true;
    window.handleGradeCriteriaSubmit.__schoolhubStrictPerCourseWrapped = true;
    window.saveGradeCriteria = window.handleGradeCriteriaSubmit;
    window.savePlusCriteria = window.handleGradeCriteriaSubmit;
    window.saveEnhancedCriteria = window.handleGradeCriteriaSubmit;
  }

  function wrapOpenModalStrict(){
    if (typeof window.openModal !== 'function' || window.openModal.__schoolhubGradeCriteriaStrictPerCourseWrapped) return;

    var oldOpenModal = window.openModal;

    window.openModal = function(id){
      if (id === 'grade-criteria-modal') {
        var cid = getGradeCriteriaCourseIdStrict();

        if (!cid) {
          console.error('[GRADE MODAL] direct openModal blocked: missing strict courseId');
          showAlert('เปิดไม่ได้', 'ไม่พบรายวิชาปัจจุบัน กรุณาเข้าหน้ารายวิชาก่อนตั้งค่าเกณฑ์เกรด', true);
          return false;
        }

        var modal = byId('grade-criteria-modal');
        if (modal) modal.dataset.courseId = cid;

        forceRenderGradeCriteriaModalStrict(cid);
        var result = oldOpenModal.apply(this, arguments);
        return result;
      }

      return oldOpenModal.apply(this, arguments);
    };

    window.openModal.__schoolhubGradeCriteriaStrictPerCourseWrapped = true;
  }

  function bindClickCaptureStrict(){
    if (document.__schoolhubGradeCriteriaStrictPerCourseClickCapture) return;
    document.__schoolhubGradeCriteriaStrictPerCourseClickCapture = true;

    document.addEventListener('click', function(e){
      var btn = e.target && e.target.closest
        ? e.target.closest('button, a, [role="button"]')
        : null;

      if (!btn) return;

      var text = String(btn.textContent || '');
      var onclick = String((btn.getAttribute && btn.getAttribute('onclick')) || '');

      var isGradeCriteriaButton =
        onclick.indexOf('openGradeCriteriaModalForCurrentCourse') >= 0 ||
        onclick.indexOf('openGradeCriteriaModalForCourse') >= 0 ||
        onclick.indexOf('openGradeCriteria') >= 0 ||
        onclick.indexOf("openModal('grade-criteria-modal')") >= 0 ||
        onclick.indexOf('openModal("grade-criteria-modal")') >= 0 ||
        text.indexOf('ตั้งค่าเกณฑ์เกรด') >= 0;

      if (!isGradeCriteriaButton) return;

      var explicitCid =
        getCourseIdFromEventTarget(e) ||
        getGradeCriteriaCourseIdStrict(e);

      if (!explicitCid) {
        console.error('[GRADE MODAL] click blocked: no exact courseId on grade criteria button');
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();

      window.openGradeCriteriaModalForCourse(explicitCid, e);
    }, true);
  }

  function bindVisibleObserverStrict(){
    var modal = byId('grade-criteria-modal');
    if (!modal || modal.__schoolhubGradeCriteriaStrictPerCourseVisibleObserver) return;

    modal.__schoolhubGradeCriteriaStrictPerCourseVisibleObserver = true;

    var observer = new MutationObserver(function(){
      if (!modal.classList.contains('hidden')) {
        var cid = String(modal.dataset && modal.dataset.courseId || '').trim();
        if (!cid) cid = getGradeCriteriaCourseIdStrict();

        if (cid) {
          forceRenderGradeCriteriaModalStrict(cid);
        }
      }
    });

    observer.observe(modal, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  installEnterCourseStamp();
  wrapOpenModalStrict();
  bindClickCaptureStrict();

  if (window.currentActiveCourseId) stampCourseContext(window.currentActiveCourseId);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){
      installEnterCourseStamp();
      wrapOpenModalStrict();
      bindVisibleObserverStrict();
      if (window.currentActiveCourseId) stampCourseContext(window.currentActiveCourseId);
    });
  } else {
    bindVisibleObserverStrict();
  }

  setTimeout(function(){
    installEnterCourseStamp();
    wrapOpenModalStrict();
    bindVisibleObserverStrict();
    if (window.currentActiveCourseId) stampCourseContext(window.currentActiveCourseId);
  }, 500);
})();
