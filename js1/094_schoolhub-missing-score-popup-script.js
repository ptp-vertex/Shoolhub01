
(function(){
  if(window.__schoolhubMissingScorePopupPatch) return;
  window.__schoolhubMissingScorePopupPatch = true;

  function esc(v){
    try{return window.escapeHTML ? window.escapeHTML(v) : String(v ?? '').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
    catch(e){return String(v ?? '');}
  }
  function cls(st){
    return (window.getStudentClassName ? window.getStudentClassName(st) : (st && (st.room || st.classroom || st.grade)) || '-').toString().trim() || '-';
  }
  function courseRooms(courseId){
    var course = (window.state && state.courses || []).find(function(c){ return c.id === courseId; }) || {};
    return Array.isArray(course.studentRooms) ? course.studentRooms : (Array.isArray(course.studentGrades) ? course.studentGrades : []);
  }
  function allStudentsForCourse(courseId){
    if(!courseId || !window.state) return [];
    var course = (state.courses || []).find(function(c){ return c.id === courseId; }) || {};
    var rooms = courseRooms(courseId);
    var extraIds = Array.isArray(course.extraStudentIds) ? course.extraStudentIds : [];
    return (state.students || []).filter(function(st){ return rooms.includes(cls(st)) || extraIds.includes(st.id); })
      .sort(function(a,b){ return String(cls(a)).localeCompare(String(cls(b)),'th',{numeric:true}) || String(a.code||'').localeCompare(String(b.code||''),'th',{numeric:true}) || String(a.name||'').localeCompare(String(b.name||''),'th'); });
  }
  function visibleStudents(courseId){
    var all = allStudentsForCourse(courseId);
    var selectedRoom = (window.__overviewRoomFilter && window.__overviewRoomFilter[courseId]) || 'all';
    var rooms = Array.from(new Set(all.map(cls).filter(Boolean)));
    return (rooms.length > 1 && selectedRoom && selectedRoom !== 'all') ? all.filter(function(st){return cls(st) === selectedRoom;}) : all;
  }
  function plansForCourse(courseId){
    return (((window.state && state.coursePlans && state.coursePlans[courseId]) || []).slice()).sort(function(a,b){ return Number(a.week)-Number(b.week); });
  }
  function isMissingX(el){
    if(!el) return false;
    var text = (el.textContent || '').trim().toUpperCase();
    return text === 'X' && (el.className || '').toString().indexOf('text-rose') !== -1;
  }
  function annotateMissingScores(){
    var cid = window.currentActiveCourseId;
    if(!cid || !window.state) return;
    var students = visibleStudents(cid);
    var plans = plansForCourse(cid);
    var table = document.getElementById('course-summary-table');
    if(table){
      Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function(tr, rowIndex){
        var st = students[rowIndex];
        if(!st) return;
        if (typeof window.isWithdrawnStudent === 'function' && window.isWithdrawnStudent(st)) return;
        var cells = Array.prototype.slice.call(tr.children || []);
        var scoreCells = cells.filter(function(td){ return td && td.classList && td.classList.contains('summary-score-col'); });
        plans.forEach(function(p, planIndex){
          if(Number(p.maxScore) === 0) return;
          var td = scoreCells[planIndex] || cells[4 + planIndex];
          var target = td && td.querySelector('.summary-score-cell-content');
          if(target && isMissingX(target)) mark(target, cid, st, rowIndex + 1, p);
        });
      });
    }
    var mobile = document.getElementById('course-summary-mobile-cards');
    if(mobile){
      Array.prototype.forEach.call(mobile.querySelectorAll('.summary-mobile-card'), function(card, rowIndex){
        var st = students[rowIndex];
        if(!st) return;
        Array.prototype.forEach.call(card.querySelectorAll('.summary-mobile-plan'), function(planCard, planIndex){
          var p = plans[planIndex];
          if(!p || Number(p.maxScore) === 0) return;
          var top = planCard.querySelector('.summary-mobile-plan-top span:last-child');
          if(top && (top.textContent || '').trim().toUpperCase().indexOf('X/') === 0) mark(top, cid, st, rowIndex + 1, p);
          var miss = planCard.querySelector('.schoolhub-mobile-missing-score');
          if(miss) mark(miss, cid, st, rowIndex + 1, p);
        });
      });
    }
  }
  function mark(el, cid, st, seq, p){
    if (typeof window.isWithdrawnStudent === 'function' && window.isWithdrawnStudent(st)) return;
    el.classList.add('schoolhub-missing-score-clickable');
    el.dataset.missingScore = '1';
    el.dataset.courseId = cid;
    el.dataset.studentId = st.id || '';
    el.dataset.studentName = st.name || '';
    el.dataset.studentCode = st.code || '';
    el.dataset.studentSeq = String(seq || '');
    el.dataset.week = String(p.week || '');
    el.dataset.title = String(p.title || '');
    el.dataset.maxScore = String(p.maxScore || '');
    el.title = 'ดับเบิลคลิกเพื่อกรอกคะแนน';
  }
  function ensurePopup(){
    var pop = document.getElementById('schoolhub-missing-score-popup');
    if(pop) return pop;
    pop = document.createElement('div');
    pop.id = 'schoolhub-missing-score-popup';
    pop.className = 'hidden';
    pop.innerHTML = '<div class="schoolhub-missing-score-box">'+
      '<div class="schoolhub-missing-score-head"><div><div class="schoolhub-missing-score-title">กรอกคะแนนช่อง X</div><div class="text-xs font-bold text-rose-500 mt-1">ข้อมูลของนักเรียนและงานนี้</div></div><button type="button" class="bg-white text-slate-400 hover:text-slate-700 w-9 h-9 flex items-center justify-center" onclick="closeMissingScorePopup()"><i class="fas fa-times"></i></button></div>'+
      '<div class="schoolhub-missing-score-body"><div class="schoolhub-missing-score-info" id="schoolhub-missing-score-info"></div>'+
      '<label class="block text-sm font-black text-slate-700 mb-2">กรอกคะแนน</label><input id="schoolhub-missing-score-input" type="number" inputmode="decimal" min="0" step="0.01" placeholder="คะแนนที่ได้">'+
      '<div class="schoolhub-missing-score-actions"><button type="button" class="bg-slate-100 text-slate-700 hover:bg-slate-200" onclick="closeMissingScorePopup()">ยกเลิก</button><button type="button" class="bg-indigo-600 text-white hover:bg-indigo-700" onclick="saveMissingScorePopup()">บันทึก</button></div></div></div>';
    document.body.appendChild(pop);
    pop.addEventListener('click', function(e){ if(e.target === pop) window.closeMissingScorePopup(); });
    return pop;
  }
  window.closeMissingScorePopup = function(){ var p=document.getElementById('schoolhub-missing-score-popup'); if(p) p.classList.add('hidden'); window.__missingScorePopupData=null; };
  window.openMissingScorePopup = function(data){
    if(!data || !data.courseId || !data.studentId) return;
    if(window.schoolhubAssertCanEditCourse && !window.schoolhubAssertCanEditCourse(data.courseId, 'กรอกคะแนน')) return;
    var pop = ensurePopup();
    window.__missingScorePopupData = data;
    var info = document.getElementById('schoolhub-missing-score-info');
    info.innerHTML = '<b>ลำดับ</b><span>#'+esc(data.studentSeq)+'</span>'+
      '<b>ชื่อ</b><span>'+esc(data.studentName)+'</span>'+
      '<b>รหัส</b><span>'+esc(data.studentCode || '-')+'</span>'+
      '<b>สัปดาห์ที่</b><span>'+esc(data.week)+'</span>'+
      '<b>ชื่องาน</b><span>'+esc(data.title)+'</span>'+
      '<b>คะแนนเต็ม</b><span>'+esc(data.maxScore)+'</span>';
    var input = document.getElementById('schoolhub-missing-score-input');
    input.value = '';
    input.max = data.maxScore || '';
    pop.classList.remove('hidden');
    setTimeout(function(){ try{ input.focus(); }catch(e){} }, 50);
  };
  window.saveMissingScorePopup = async function(){
    var data = window.__missingScorePopupData;
    if(!data) return;
    var input = document.getElementById('schoolhub-missing-score-input');
    var val = input ? input.value : '';
    if(val === '') return showCustomAlert ? showCustomAlert('ข้อมูลไม่ครบ','กรุณากรอกคะแนน',true) : alert('กรุณากรอกคะแนน');
    var num = parseFloat(val);
    var max = parseFloat(data.maxScore);
    if(isNaN(num) || num < 0) return showCustomAlert ? showCustomAlert('คะแนนไม่ถูกต้อง','กรุณากรอกคะแนนเป็นตัวเลขตั้งแต่ 0 ขึ้นไป',true) : alert('คะแนนไม่ถูกต้อง');
    if(!isNaN(max) && num > max) return showCustomAlert ? showCustomAlert('คะแนนเกินเต็ม','คะแนนเต็มของงานนี้คือ '+data.maxScore,true) : alert('คะแนนเกินเต็ม');
    var idx = (state.scores || []).findIndex(function(s){ return s.courseId === data.courseId && String(s.week) === String(data.week) && String(s.title) === String(data.title); });
    var now = new Date().toISOString();
    if(idx === -1){
      state.scores.push({id:String(Date.now()), courseId:data.courseId, week:String(data.week), title:String(data.title), maxScore:String(data.maxScore), records:{}, savedAt:now});
      idx = state.scores.length - 1;
    }
    if(!state.scores[idx].records) state.scores[idx].records = {};
    state.scores[idx].records[data.studentId] = num;
    state.scores[idx].maxScore = String(data.maxScore);
    state.scores[idx].savedAt = now;
    if(typeof saveStateToDB === 'function') await saveStateToDB();
    window.closeMissingScorePopup();
    if(typeof renderCourseOverview === 'function') renderCourseOverview();
    if(typeof renderScoreList === 'function') { try{ renderScoreList(); }catch(e){} }
    if(typeof showCustomAlert === 'function') showCustomAlert('สำเร็จ','บันทึกคะแนนเรียบร้อยแล้ว');
  };

  var oldRender = window.renderCourseOverview;
  if(typeof oldRender === 'function' && !oldRender.__missingScoreAnnotated){
    var fn = function(){ var out = oldRender.apply(this, arguments); setTimeout(annotateMissingScores, 0); return out; };
    fn.__missingScoreAnnotated = true;
    window.renderCourseOverview = fn;
  }
  var lastTap = {t:0, el:null};
  document.addEventListener('dblclick', function(e){
    var el = e.target && e.target.closest ? e.target.closest('[data-missing-score="1"]') : null;
    if(!el) return;
    e.preventDefault();
    e.stopPropagation();
    window.openMissingScorePopup(Object.assign({}, el.dataset));
  }, true);
  document.addEventListener('click', function(e){
    var el = e.target && e.target.closest ? e.target.closest('[data-missing-score="1"]') : null;
    if(!el) return;

    var now = Date.now();
    if(lastTap.el === el && now - lastTap.t < 420){
      e.preventDefault();
      e.stopPropagation();
      window.openMissingScorePopup(Object.assign({}, el.dataset));
      lastTap = {t:0, el:null};
    } else {
      lastTap = {t:now, el:el};
    }
  }, true);
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(annotateMissingScores, 500); });
  setInterval(function(){ try{ annotateMissingScores(); }catch(e){} }, 1500);
})();
