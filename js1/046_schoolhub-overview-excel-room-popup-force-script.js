
(function(){
  if(window.__schoolhubOverviewExcelRoomPopupForce) return;
  window.__schoolhubOverviewExcelRoomPopupForce = true;

  function esc(v){
    if(typeof window.escapeHTML === 'function') return window.escapeHTML(String(v == null ? '' : v));
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function getCourseId(){ return window.currentActiveCourseId || (window.currentCourse && window.currentCourse.id) || null; }
  function getCourse(){
    var cid=getCourseId();
    return ((window.state && state.courses) || []).find(function(c){ return String(c.id) === String(cid); }) || window.currentCourse || null;
  }
  function roomOf(st){
    return String((st && (st.room || st.classroom || st.className || st.grade || st.level)) || '').trim() || 'ไม่ระบุห้อง';
  }
  function courseRoomList(course){
    var out=[];
    ['studentRooms','studentGrades','rooms','grades','classes','classrooms'].forEach(function(k){
      if(course && Array.isArray(course[k])) out = out.concat(course[k]);
    });
    var seen={};
    return out.map(function(x){return String(x||'').trim();}).filter(function(x){ if(!x || seen[x]) return false; seen[x]=1; return true; });
  }
  function allStudentsForCourse(){
    var cid=getCourseId(), c=getCourse();
    var all=((window.state && state.students) || []).slice();
    var rooms=courseRoomList(c);
    var extra=(c && (c.extraStudentIds || c.studentIds || c.students)) || [];
    if(rooms.length || extra.length){
      return all.filter(function(st){ return rooms.indexOf(roomOf(st)) !== -1 || extra.indexOf(st.id) !== -1 || extra.indexOf(st.code) !== -1; });
    }
    if(typeof window.getCourseStudents === 'function'){
      try { return window.getCourseStudents(cid) || []; } catch(e){}
    }
    return all;
  }
  function roomsForExport(){
    var c=getCourse();
    var rooms=courseRoomList(c);
    allStudentsForCourse().forEach(function(st){ rooms.push(roomOf(st)); });
    var seen={};
    return rooms.map(function(x){return String(x||'').trim();}).filter(function(x){ if(!x || seen[x]) return false; seen[x]=1; return true; }).sort(function(a,b){return a.localeCompare(b,'th',{numeric:true});});
  }
  function selectedOverviewRoom(){
    var cid=getCourseId();
    var el=document.querySelector('#overview-room-filter select, #schoolhub-overview-room-select-final, .overview-room-select');
    return (el && el.value && el.value !== '') ? el.value : ((window.__overviewRoomFilter && window.__overviewRoomFilter[cid]) || 'all');
  }
  function studentsByRoom(room){
    var list=allStudentsForCourse();
    if(room && room !== 'all') list=list.filter(function(st){ return roomOf(st) === room; });
    return list.sort(function(a,b){ return String(roomOf(a)).localeCompare(String(roomOf(b)),'th',{numeric:true}) || String(a.code||'').localeCompare(String(b.code||''),'th',{numeric:true}) || String(a.name||'').localeCompare(String(b.name||''),'th'); });
  }
  function safeSheetName(v){ return String(v || 'ชีต').replace(/[\\/?*\[\]:]/g,' ').trim().slice(0,31) || 'ชีต'; }
  function gradeOf(total, criteria, course, student){
    if (typeof window.getFinalGradeForStudent === 'function' && course && student) return window.getFinalGradeForStudent(course, student, total);
    if (typeof window.calculateGradeFromRules === 'function') return window.calculateGradeFromRules(total, criteria);
    return '-';
  }
  function makeAoa(room){
    var cid=getCourseId(), c=getCourse();
    var cName=(c && (c.name || c.code)) || 'รายวิชา';
    var students=studentsByRoom(room);
    var history=(state.attendance && state.attendance[cid]) || {};
    var dates=Object.keys(history).sort();
    var plans=((state.coursePlans && state.coursePlans[cid]) || []).slice().sort(function(a,b){return Number(a.week)-Number(b.week);});
    var scores=((state.scores) || []).filter(function(s){ return String(s.courseId) === String(cid); });
    var criteria=(state.courseGrades && state.courseGrades[cid]) || window.defaultGradeCriteria || [];
    var totalMax=0;
    var header=['ลำดับ','รหัสนักเรียน','ชื่อ - นามสกุล','ห้อง','มา','สาย','ขาด','ลา'];
    plans.forEach(function(p){ var full=Number(p.maxScore||0); header.push('สัปดาห์ที่ '+p.week+'\n'+(p.title||'')+'\n'+(full===0?'(เช็คงาน)':'(เต็ม '+window.formatScoreDisplay(full,2)+')')); if(full!==0) totalMax = window.addScoreToTotal(totalMax, full, 2); });
    header.push('รวมคะแนน(เต็ม '+window.formatScoreDisplay(totalMax,2)+')','เกรด','โบนัส','ดาว','หมายเหตุ');
    var aoa=[['สรุปภาพรวมวิชา: '+cName],['ห้อง: '+(room || 'ทุกห้อง')],[],header];
    var bonusByCid=(state.bonusScores && state.bonusScores[cid]) || {};
    var starCourseData=(state.starGroups && state.starGroups[cid]) || {};
    var starSets = starCourseData.sets || [];
    var bmSettings=(state.bonusMergeSettings && state.bonusMergeSettings[cid]) || null;
    students.forEach(function(st,idx){
      var pr=0, la=0, ab=0, lv=0;
      dates.forEach(function(d){ var rec=(history[d] && history[d].records) || {}; var v=rec[st.id]; if(v==='present') pr++; else if(v==='late') la++; else if(v==='absent') ab++; else if(v==='leave') lv++; });
      var row=[idx+1, st.code||'', st.name||'', roomOf(st), pr, la, ab, lv];
      var total=0;
      var isWithdrawn = (window.isWithdrawnStudent || window.isStudentWithdrawn || function(){return false;})(st);
      plans.forEach(function(p){
        if(isWithdrawn){ row.push('ลาออก'); return; }
        var task=scores.find(function(ts){ return String(ts.week)===String(p.week) && String(ts.title)===String(p.title); });
        var raw=task && task.records ? task.records[st.id] : null;
        if(Number(p.maxScore||0)===0) row.push(raw===1?'ส่งแล้ว':(raw===0?'ยังไม่ส่ง':'-'));
        else { total = window.addScoreToTotal(total, raw, 2); row.push(!task ? '-' : ((window.isMissingScoreValue ? window.isMissingScoreValue(raw) : raw==='')?'ขาดส่ง':window.normalizeScoreNumber(raw,2))); }
      });
      if (isWithdrawn) { row.push('ลาออก','ลาออก','ลาออก','ลาออก','ลาออก'); aoa.push(row); return; }
      var totalBonus=0;
      Object.keys(bonusByCid).forEach(function(wk){ var wVal=bonusByCid[wk] && bonusByCid[wk][st.id]; if(wVal!==undefined && wVal!=='' && !isNaN(Number(wVal)) && Number(wVal)!==0) totalBonus += Number(wVal); });
      var totalStars=0;
      starSets.forEach(function(s){
        var groups = s.groups || [];
        var weekStars = s.weekStars || {};
        var studentGroups = groups.filter(function(g){ return (g.members||[]).indexOf(st.id) !== -1; });
        Object.keys(weekStars).forEach(function(wk){
          var weekData = weekStars[wk] || {};
          studentGroups.forEach(function(g){ totalStars += weekData[g.id] || 0; });
        });
      });
      // Merge bonus into the total exactly like the on-screen overview table, if the teacher has enabled it
      var note = '';
      if (bmSettings && bmSettings.enabled) {
        var included = bmSettings.mode === 'selected' ? (bmSettings.selected||[]).indexOf(st.id) !== -1 : true;
        if (included && totalBonus) {
          var mergedAmount = totalBonus * ((Number(bmSettings.percent)||0) / 100);
          total = window.addScoreToTotal(total, mergedAmount, 2);
          note = 'รวมคะแนนโบนัส +' + window.formatScoreDisplay(mergedAmount,2) + ' คะแนนในคะแนนรวมแล้ว (' + (Number(bmSettings.percent)||0) + '%)';
        }
      }
      total = window.normalizeScoreNumber(total,2);
      row.push(total, (totalMax>0 ? gradeOf(total, criteria, c, st) : '-'));
      row.push(totalBonus > 0 ? ('+'+totalBonus) : '-', totalStars > 0 ? (totalStars+'⭐') : '-');
      row.push(note);
      aoa.push(row);
    });
    return aoa;
  }
  function writeExcel(value){
    if(typeof XLSX === 'undefined') return showCustomAlert('โหลด Excel ไม่สำเร็จ','ไม่พบไลบรารี XLSX',true);
    try { if (typeof window.toggleLoader === 'function') window.toggleLoader(true); } catch(e){}
    try {
    var cid=getCourseId(), c=getCourse();
    var rooms=roomsForExport();
    var wb=XLSX.utils.book_new();
    if(value === 'all'){
      rooms.forEach(function(r){ XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(makeAoa(r)), safeSheetName(r)); });
    }else{
      var room=value.replace(/^room:/,'');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(makeAoa(room)), safeSheetName(room));
    }
    XLSX.writeFile(wb, 'ภาพรวม_'+(((c && (c.code || c.name)) || 'รายวิชา'))+'.xlsx');
    } finally {
      try { if (typeof window.toggleLoader === 'function') window.toggleLoader(false); } catch(e){}
    }
  }
  function openPopup(){
    if (window.__schoolhubDenyExportNow && window.__schoolhubDenyExportNow()) return;

    var cid=getCourseId(), c=getCourse();
    if(!cid || !c) return showCustomAlert('ผิดพลาด','ไม่พบรายวิชา',true);
    var all=allStudentsForCourse();
    if(!all.length) return showCustomAlert('ผิดพลาด','ไม่มีข้อมูลนักเรียนในวิชานี้',true);
    var rooms=roomsForExport();
    var selected=selectedOverviewRoom();
    if(selected && selected !== 'all' && rooms.indexOf(selected) === -1) selected='all';
    var options='';
    if(rooms.length > 1){
      options += '<option value="all" '+(selected==='all'?'selected':'')+'>ทุกห้อง</option>';
      rooms.forEach(function(r){ options += '<option value="room:'+esc(r)+'" '+(selected===r?'selected':'')+'>'+esc(r)+'</option>'; });
    }else{
      var only=rooms[0] || roomOf(all[0]) || 'ห้อง';
      options += '<option value="room:'+esc(only)+'" selected>'+esc(only)+'</option>';
    }
    var old=document.getElementById('schoolhub-overview-excel-room-modal-force'); if(old) old.remove();
    var modal=document.createElement('div');
    modal.id='schoolhub-overview-excel-room-modal-force';
    modal.className='schoolhub-overview-excel-room-modal';
    modal.innerHTML='<div class="schoolhub-overview-excel-room-box">'+
      '<div class="schoolhub-overview-excel-room-head"><div class="schoolhub-overview-excel-room-title"><i class="fas fa-file-excel text-emerald-600"></i> โหลดภาพรวม Excel</div><button type="button" id="schoolhub-overview-excel-room-close" class="text-slate-400 hover:text-slate-700 text-xl"><i class="fas fa-times"></i></button></div>'+
      '<div class="schoolhub-overview-excel-room-body"><div><label class="schoolhub-overview-excel-room-label">เลือกห้อง</label><select id="schoolhub-overview-excel-room-choice" class="schoolhub-overview-excel-room-select">'+options+'</select></div><p class="text-xs font-bold text-slate-500">ถ้าเลือกทุกห้อง ระบบจะแยกชีตด้านในเป็นห้องละหน้า โดยใช้ชื่อชีตเป็นชื่อห้องที่ตั้งไว้</p></div>'+
      '<div class="schoolhub-overview-excel-room-actions"><button type="button" class="schoolhub-overview-excel-room-cancel" id="schoolhub-overview-excel-room-cancel">ยกเลิก</button><button type="button" class="schoolhub-overview-excel-room-confirm" id="schoolhub-overview-excel-room-confirm"><i class="fas fa-download mr-1"></i> โหลด Excel</button></div>'+
      '</div>';
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    function close(){ modal.classList.add('hidden'); }
    document.getElementById('schoolhub-overview-excel-room-close').onclick=close;
    document.getElementById('schoolhub-overview-excel-room-cancel').onclick=close;
    document.getElementById('schoolhub-overview-excel-room-confirm').onclick=function(){ var v=document.getElementById('schoolhub-overview-excel-room-choice').value; close(); writeExcel(v); };
  }

  window.exportScoresToExcel = openPopup;
  document.addEventListener('click', function(e){
    var btn=e.target.closest && e.target.closest('#course-tab-overview button');
    if(!btn) return;
    var on=btn.getAttribute('onclick') || '';
    var txt=(btn.textContent || '').replace(/\s+/g,' ');
    if(on.indexOf('exportScoresToExcel') !== -1 || (txt.indexOf('Excel') !== -1 && txt.indexOf('โหลด') !== -1)){
      e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); openPopup();
    }
  }, true);
})();
