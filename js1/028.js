
(function(){
  if (window.__schoolhubOverviewCardRequiredPatch) return;
  window.__schoolhubOverviewCardRequiredPatch = true;

  function esc(v){
    try { return window.escapeHTML ? window.escapeHTML(v) : String(v ?? '').replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }
    catch(e){ return String(v ?? ''); }
  }
  function cls(st){
    return (window.getStudentClassName ? window.getStudentClassName(st) : (st && (st.room || st.classroom || st.grade)) || '-').toString().trim() || '-';
  }
  function courseRooms(courseId){
    var course = (window.state && state.courses || []).find(function(c){ return c.id === courseId; }) || {};
    return Array.isArray(course.studentRooms) ? course.studentRooms : (Array.isArray(course.studentGrades) ? course.studentGrades : []);
  }
  function allStudentsForCourse(courseId){
    if (!courseId || !window.state) return [];
    var course = (state.courses || []).find(function(c){ return c.id === courseId; }) || {};
    var rooms = courseRooms(courseId);
    var extraIds = Array.isArray(course.extraStudentIds) ? course.extraStudentIds : [];
    if (!rooms.length && !extraIds.length) return [];
    return (state.students || []).filter(function(st){ return rooms.includes(cls(st)) || extraIds.includes(st.id); })
      .sort(function(a,b){ return String(cls(a)).localeCompare(String(cls(b)), 'th', {numeric:true}) || String(a.code||'').localeCompare(String(b.code||''), 'th', {numeric:true}) || String(a.name||'').localeCompare(String(b.name||''), 'th'); });
  }
  function getRoomsFromStudents(students){
    return Array.from(new Set((students || []).map(cls).filter(Boolean))).sort(function(a,b){ return a.localeCompare(b,'th',{numeric:true}); });
  }

  window.__overviewRoomFilter = window.__overviewRoomFilter || {};

  window.renderOverviewRoomFilter = function(){
    var box = document.getElementById('overview-room-filter');
    var cid = window.currentActiveCourseId;
    if (!box || !cid) return;
    var all = allStudentsForCourse(cid);
    var rooms = getRoomsFromStudents(all);
    if (rooms.length <= 1) {
      box.classList.add('hidden');
      box.innerHTML = '';
      if (rooms.length === 1) window.__overviewRoomFilter[cid] = rooms[0];
      return;
    }
    var selected = window.__overviewRoomFilter[cid] || '';
    if (selected && !rooms.includes(selected)) selected = window.__overviewRoomFilter[cid] = '';
    box.classList.remove('hidden');
    box.innerHTML = '<div class="bg-white rounded-2xl border border-indigo-100 shadow-sm p-3 flex flex-col sm:flex-row sm:items-center gap-2">'+
      '<button type="button" class="bg-primary text-white px-4 py-2 rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-default"><i class="fas fa-door-open"></i> เลือกห้อง</button>'+
      '<select class="bg-white border border-indigo-100 rounded-xl px-3 py-2 text-sm font-bold text-primary focus:ring-2 focus:ring-primary outline-none flex-1" onchange="window.__overviewRoomFilter[\''+cid+'\']=this.value; renderCourseOverview();">'+
      '<option value="" '+(selected===''?'selected':'')+'>-- เลือกชั้นปี/ห้องก่อน --</option>'+
      rooms.map(function(r){ return '<option value="'+esc(r)+'" '+(selected===r?'selected':'')+'>'+esc(r)+'</option>'; }).join('')+
      '</select></div>';
  };

  function ensureMobileContainer(){
    var table = document.getElementById('course-summary-table');
    if (!table) return null;
    var box = document.getElementById('course-summary-mobile-cards');
    if (!box) {
      box = document.createElement('div');
      box.id = 'course-summary-mobile-cards';
      table.parentNode.insertBefore(box, table.nextSibling);
    }
    return box;
  }

  function scoreAndGrade(student, total, totalMax, gradeCriteria, cid){
    var course = (state.courses || []).find(function(c){ return String(c.id) === String(cid); }) || {id:cid, gradeCriteria:gradeCriteria};
    var grade = totalMax > 0 ? window.getFinalGradeForStudent(course, student, total) : '-';
    return {
      grade:grade,
      value:grade,
      html:esc(grade),
      color:(typeof window.schoolhubGradeColor === 'function' ? window.schoolhubGradeColor(grade, window.getCourseGradeCriteria ? window.getCourseGradeCriteria(course) : gradeCriteria) : 'text-slate-600'),
      isWithdrawn:String(grade) === 'ลาออก'
    };
  }

  window.renderCourseOverview = function(){
    var table = document.getElementById('course-summary-table');
    if (!table) return;
    table.innerHTML = '';
    var mobileBox = ensureMobileContainer();
    if (mobileBox) mobileBox.innerHTML = '';

    var cid = window.currentActiveCourseId;
    window.renderOverviewRoomFilter();
    var all = allStudentsForCourse(cid);
    var rooms = getRoomsFromStudents(all);
    var selectedRoom = window.__overviewRoomFilter[cid] || 'all';
    var requiresSelect = rooms.length > 1;
    var students = (requiresSelect && selectedRoom && selectedRoom !== 'all') ? all.filter(function(st){ return cls(st) === selectedRoom; }) : all;

    var empty = document.getElementById('empty-summary');
    if (!cid || !students.length) {
      if (empty) {
        empty.classList.remove('hidden');
        empty.innerHTML = false
          ? '<i class="fas fa-door-open text-4xl text-indigo-200 mb-3"></i><p class="text-slate-600 font-black">กรุณาเลือกชั้นปี/ห้องก่อน</p><p class="text-xs text-slate-400 mt-1">เมื่อยังไม่เลือก ระบบจะยังไม่แสดงข้อมูลภาพรวม</p>'
          : '<i class="fas fa-table text-4xl text-slate-200 mb-3"></i><p class="text-slate-500 font-medium">ยังไม่มีข้อมูลคะแนนหรืองานในวิชานี้</p>';
      }
      if (mobileBox) mobileBox.innerHTML = '';
      return;
    }
    if (empty) empty.classList.add('hidden');

    var history = (state.attendance && state.attendance[cid]) || {};
    var attDates = Object.keys(history);
    var plans = ((state.coursePlans && state.coursePlans[cid]) || []).sort(function(a,b){ return Number(a.week)-Number(b.week); });
    var courseScores = (state.scores || []).filter(function(s){ return s.courseId === cid; });
    var gradeCriteria = (state.courseGrades && state.courseGrades[cid]) ? state.courseGrades[cid] : (window.defaultGradeCriteria || []);
    var totalMax = 0;
    plans.forEach(function(p){ if (Number(p.maxScore) !== 0) totalMax = window.addScoreToTotal(totalMax, p.maxScore, 2); });

    var thead = '<thead><tr><th class="sticky summary-sticky-no summary-no-col bg-slate-50 z-20 border-r text-center align-middle">ลำดับ</th><th class="sticky summary-sticky-code summary-code-col bg-slate-50 z-20 border-r text-center align-middle">รหัสนักเรียน</th><th class="sticky summary-sticky-name summary-name-col bg-slate-50 z-20 border-r text-center align-middle">ชื่อ - นามสกุล</th><th class="text-center bg-slate-100 text-slate-600">ชั้น/ห้อง</th>';
    thead += '<th class="text-center bg-emerald-50 text-emerald-700 summary-att-col">เช็คชื่อ<br><span class="text-[9px]">มา/สาย/ขาด</span></th>';
    plans.forEach(function(p){
      var isChecklist = Number(p.maxScore) === 0;
      var subtitle = isChecklist ? 'เช็คงาน' : 'เต็ม '+window.formatScoreDisplay(p.maxScore,2);
      thead += '<th class="text-center bg-indigo-50 text-indigo-700 summary-score-col" title="คลิกเพื่อดูรายละเอียด: สัปดาห์ '+esc(p.week)+' | '+esc(p.title)+' | '+esc(subtitle)+'"><button type="button" onclick="showPlanDetail(\''+cid+'\', \''+p.id+'\')" class="week-detail-btn inline-flex items-center justify-center bg-white border border-indigo-200 text-primary font-bold hover:bg-primary hover:text-white transition shadow-sm">'+esc(p.week)+'</button></th>';
    });
    thead += '<th class="text-center bg-slate-800 text-white font-bold summary-total-col">รวม<br><span class="text-[9px] text-slate-300">'+window.formatScoreDisplay(totalMax,2)+'</span></th><th class="text-center bg-amber-50 text-amber-700 font-bold summary-grade-col">เกรด</th></tr></thead>';

    var tbody = '<tbody>';
    var mobileHtml = '';
    students.forEach(function(st, index){
      var isWithdrawn = (typeof window.isWithdrawnStudent === 'function') ? window.isWithdrawnStudent(st) : (window.isStudentWithdrawn && window.isStudentWithdrawn(st));
      var pr=0, la=0, ab=0, lv=0;
      attDates.forEach(function(d){ var rec = (history[d] && history[d].records) || {}; var x = rec[st.id]; if(x==='present') pr++; else if(x==='late') la++; else if(x==='absent') ab++; else if(x==='leave') lv++; });
      var total = 0;
      var planCells = '';
      var planCards = '';
      plans.forEach(function(p){
        if (isWithdrawn) {
          planCells += '<td class="text-center font-mono summary-score-col withdrawn"><span class="summary-score-cell-content">'+(window.renderWithdrawnScoreCell ? window.renderWithdrawnScoreCell() : '<span class="withdrawn-score-cell">ลาออก</span>')+'</span></td>';
          planCards += '<div class="summary-mobile-plan withdrawn"><div class="summary-mobile-plan-top"><span>สัปดาห์ที่ '+esc(p.week)+'</span><span>ลาออก</span></div><div class="summary-mobile-plan-title">'+esc(p.title || 'งาน')+'</div></div>';
          return;
        }
        var task = courseScores.find(function(ts){ return ts.week == p.week && ts.title === p.title; });
        var raw = task && task.records ? task.records[st.id] : null;
        var isChecklist = Number(p.maxScore) === 0;
        if (isChecklist) {
          var label = raw === 1 ? '<span class="text-emerald-500"><i class="fas fa-check"></i></span>' : (raw === 0 ? '<span class="text-rose-400"><i class="fas fa-times"></i></span>' : '<span class="text-slate-300">-</span>');
          planCells += '<td class="text-center summary-score-col"><span class="summary-score-cell-content">'+label+'</span></td>';
          planCards += '<div class="summary-mobile-plan"><div class="summary-mobile-plan-top"><span>สัปดาห์ที่ '+esc(p.week)+'</span><span>'+label+'</span></div><div class="summary-mobile-plan-title">'+esc(p.title || 'เช็คงาน')+'</div></div>';
        } else {
          total = window.addScoreToTotal(total, raw, 2);
          var missingScore = !!task && (window.isMissingScoreValue ? window.isMissingScoreValue(raw) : raw === '');
          var display = !task ? '-' : (missingScore ? 'X' : window.formatScoreDisplay(raw, 2));
          var maxText = window.formatScoreDisplay(p.maxScore || 0, 2);
          var cellClass = !task ? 'text-slate-300' : (missingScore ? 'text-rose-600 font-black schoolhub-missing-score-clickable' : 'text-slate-700');
          var scoreDataAttrs = missingScore
            ? ' data-missing-score="1" data-course-id="'+esc(cid)+'" data-student-id="'+esc(st.id || '')+'" data-student-name="'+esc(st.name || '')+'" data-student-code="'+esc(st.code || '')+'" data-student-seq="'+esc(index + 1)+'" data-week="'+esc(p.week || '')+'" data-title="'+esc(p.title || '')+'" data-max-score="'+esc(p.maxScore || '')+'" title="ดับเบิลคลิกเพื่อกรอกคะแนน"'
            : '';
          var valueHtml = missingScore ? '<span class="schoolhub-mobile-missing-score schoolhub-missing-score-clickable"'+scoreDataAttrs+'>X</span>' : esc(display);
          planCells += '<td class="text-center font-mono summary-score-col" data-score-cell="1" data-course-id="'+esc(cid)+'" data-student-id="'+esc(st.id || '')+'" data-week="'+esc(p.week || '')+'" data-title="'+esc(p.title || '')+'"><span class="summary-score-cell-content '+cellClass+'"'+scoreDataAttrs+'>'+(missingScore ? 'X' : esc(display))+'</span></td>';
          planCards += '<div class="summary-mobile-plan" data-course-id="'+esc(cid)+'" data-student-id="'+esc(st.id || '')+'" data-week="'+esc(p.week || '')+'" data-title="'+esc(p.title || '')+'"><div class="summary-mobile-plan-top"><span>สัปดาห์ที่ '+esc(p.week)+'</span><span>'+(missingScore ? valueHtml : esc(display)+'/'+esc(maxText))+'</span></div><div class="summary-mobile-plan-title">'+esc(p.title || 'งาน')+'</div></div>';
        }
      });
      total = isWithdrawn ? 0 : window.normalizeScoreNumber(total, 2);
      var gg = scoreAndGrade(st, total, totalMax, gradeCriteria, cid);
      var totalCell = isWithdrawn ? '<td class="text-center font-bold bg-slate-50 border-r summary-total-col withdrawn">'+(window.renderWithdrawnScoreCell ? window.renderWithdrawnScoreCell() : '<span class="withdrawn-score-cell">ลาออก</span>')+'</td>' : '<td class="text-center font-bold text-primary bg-slate-50 border-r summary-total-col">'+window.formatScoreDisplay(total,2)+'</td>';
      var gradeCell = isWithdrawn ? '<td class="text-center font-bold bg-amber-50/30 summary-grade-col withdrawn">'+(window.renderWithdrawnGradeCell ? window.renderWithdrawnGradeCell() : '<span class="withdrawn-grade withdrawn-grade-cell">ลาออก</span>')+'</td>' : '<td class="text-center font-bold '+gg.color+' bg-amber-50/30 summary-grade-col">'+(gg.html || esc(gg.grade))+'</td>';
      var attendanceCell = isWithdrawn ? '<td class="text-center font-bold summary-att-col withdrawn-score-cell">ลาออก</td>' : '<td class="text-center font-bold summary-att-col"><span class="text-emerald-500">'+pr+'</span>/<span class="text-amber-500">'+la+'</span>/<span class="text-rose-500">'+ab+'</span>/<span style="color:#7c3aed">'+lv+'</span></td>';
      tbody += '<tr class="'+(window.getStudentWithdrawnRowClass?window.getStudentWithdrawnRowClass(st):'')+'"><td class="sticky summary-sticky-no summary-no-col bg-white z-20 border-r text-center"><span class="schoolhub-seq-text'+(window.getStudentWithdrawnClass?window.getStudentWithdrawnClass(st):'')+'">#'+(index+1)+'</span></td><td class="sticky summary-sticky-code summary-code-col bg-white z-20 border-r font-mono text-slate-700'+(window.getStudentWithdrawnClass?window.getStudentWithdrawnClass(st):'')+'">'+esc(st.code)+'</td><td class="sticky summary-sticky-name summary-name-col bg-white z-20 border-r font-bold text-slate-700'+(window.getStudentWithdrawnClass?window.getStudentWithdrawnClass(st):'')+'">'+esc(st.name)+(window.getStudentWithdrawnBadge?window.getStudentWithdrawnBadge(st):'')+'</td><td class="text-center text-xs font-bold text-slate-500 bg-slate-50">'+esc(cls(st))+'</td>'+attendanceCell+planCells+totalCell+gradeCell+'</tr>';

      mobileHtml += '<div class="summary-mobile-card '+(window.getStudentWithdrawnRowClass?window.getStudentWithdrawnRowClass(st):'')+'"><div class="flex items-start justify-between gap-3"><div><div class="summary-mobile-card-name '+(window.getStudentWithdrawnClass?window.getStudentWithdrawnClass(st):'')+'">'+esc(st.name)+(window.getStudentWithdrawnBadge?window.getStudentWithdrawnBadge(st):'')+'</div><div class="text-xs font-bold text-slate-400 mt-1">'+esc(cls(st))+'</div></div><div class="schoolhub-seq-text '+(window.getStudentWithdrawnClass?window.getStudentWithdrawnClass(st):'')+'">#'+(index+1)+'</div></div><details class="summary-mobile-card-code"><summary><i class="fas fa-id-card mr-1"></i>เปิด/ปิดรหัสนักเรียน</summary><div class="'+(window.getStudentWithdrawnClass?window.getStudentWithdrawnClass(st):'')+'">'+esc(st.code)+'</div></details><div class="summary-mobile-stats"><div class="summary-mobile-stat text-emerald-600"><b>'+pr+'</b>มา</div><div class="summary-mobile-stat text-amber-600"><b>'+la+'</b>สาย</div><div class="summary-mobile-stat text-rose-600"><b>'+ab+'</b>ขาด</div><div class="summary-mobile-stat" style="color:#7c3aed"><b>'+lv+'</b>ลา</div></div><div class="summary-mobile-plans">'+(planCards || '<div class="col-span-2 text-center text-slate-400 text-sm font-bold py-3">ยังไม่มีแผนคะแนน</div>')+'</div><div class="summary-mobile-bonus-star">'+
        '<div class="summary-mobile-bonus-cell" onclick="if(window.shOvShowBonusDetail)window.shOvShowBonusDetail(this)" data-student-id="'+esc(st.id||'')+'" data-course-id="'+esc(cid)+'" data-student-name="'+esc(st.name||'')+'"><span>+โบนัส</span><b>'+(function(){ var b=(typeof window.shOvGetBonusScore==='function')?window.shOvGetBonusScore(cid,st.id):null; return (b!==null&&b!==undefined)?esc(window.formatScoreDisplay(b,2)):'-'; })()+'</b></div>'+
        '<div class="summary-mobile-star-cell"><span>⭐ดาว</span><b>'+(function(){ var s=(typeof window.shOvGetStarTotal==='function')?window.shOvGetStarTotal(cid,st.id):0; return (s&&s>0)?esc(String(s)):'-'; })()+'</b></div>'+
        '</div>'+
        '<div class="summary-mobile-total"><span>รวม '+(isWithdrawn ? 'ลาออก' : window.formatScoreDisplay(total,2)+'/'+window.formatScoreDisplay(totalMax,2))+'</span><span class="'+gg.color+'">เกรด '+esc(gg.grade)+'</span></div></div>';
    });
    tbody += '</tbody>';
    table.innerHTML = thead + tbody;
    if (mobileBox) mobileBox.innerHTML = mobileHtml;
  };
})();
