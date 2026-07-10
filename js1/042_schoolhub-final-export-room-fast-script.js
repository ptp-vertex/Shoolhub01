
(function(){
  if(window.__schoolhubFinalExportRoomFastPatch) return;
  window.__schoolhubFinalExportRoomFastPatch = true;

  function esc(v){
    if(window.escapeHTML) return window.escapeHTML(v == null ? '' : v);
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});
  }
  function courseId(){ return window.currentActiveCourseId || ''; }
  function course(){ var cid=courseId(); return (window.state&&state.courses||[]).find(function(c){return String(c.id)===String(cid);}) || null; }
  function studentRoom(st){ try{return String(window.getStudentClassName ? window.getStudentClassName(st) : (st && (st.room||st.classroom||st.grade||st.className)) || '-').trim() || '-';}catch(e){return '-';} }
  function unique(arr){ var out=[]; (arr||[]).forEach(function(v){ if(Array.isArray(v)){v.forEach(function(x){var t=String(x||'').trim(); if(t&&t!=='-'&&out.indexOf(t)<0) out.push(t);}); return;} var t=String(v||'').trim(); if(t&&t!=='-'&&t!=='undefined'&&t!=='null'&&out.indexOf(t)<0) out.push(t); }); return out.sort(function(a,b){return a.localeCompare(b,'th',{numeric:true});}); }
  function roomsForCourse(c){
    if(!c) return [];
    var rooms=[];
    ['studentRooms','studentGrades','rooms','grades','classes','classrooms','selectedRooms','selectedGrades'].forEach(function(k){
      if(Array.isArray(c[k])) rooms=rooms.concat(c[k]);
      else if(typeof c[k]==='string') rooms=rooms.concat(c[k].split(/[,|،]/));
    });
    rooms=unique(rooms);
    if(rooms.length) return rooms;
    var extraIds=Array.isArray(c.extraStudentIds)?c.extraStudentIds.map(String):[];
    if(!extraIds.length) return [];
    return unique((state.students||[]).filter(function(st){return extraIds.indexOf(String(st.id))>=0;}).map(studentRoom));
  }
  function allCourseStudents(cid){ return (window.getCourseStudents ? window.getCourseStudents(cid,{ignoreActionFilter:true}) : []); }
  function studentsForRoom(cid, room){
    var list=allCourseStudents(cid);
    if(room && room !== 'all') list=list.filter(function(st){return studentRoom(st)===room;});
    return list.sort(function(a,b){return studentRoom(a).localeCompare(studentRoom(b),'th',{numeric:true}) || String(a.code||'').localeCompare(String(b.code||''),'th',{numeric:true}) || String(a.name||'').localeCompare(String(b.name||''),'th');});
  }
  function cleanSheetName(name){ return String(name||'ชีต').replace(/[\\/?*\[\]:]/g,' ').trim().slice(0,31) || 'ชีต'; }
  function statusThai(v){ return v==='present'?'มา':(v==='late'?'สาย':(v==='absent'?'ขาด':'-')); }
  function getPlans(cid){ return ((state.coursePlans&&state.coursePlans[cid])||[]).slice().sort(function(a,b){return Number(a.week)-Number(b.week);}); }
  function calcGrade(score, criteria, course, student){
    if (typeof window.getFinalGradeForStudent === 'function' && course && student) return window.getFinalGradeForStudent(course, student, score);
    if (typeof window.calculateGradeFromRules === 'function') return window.calculateGradeFromRules(score, criteria);
    return '-';
  }
  function buildOverviewAoa(cid, list, roomName){
    var c=(state.courses||[]).find(function(x){return String(x.id)===String(cid);})||{};
    var cName=c.name||c.code||'Unknown';
    var history=(state.attendance&&state.attendance[cid])||{};
    var attDates=Object.keys(history).sort();
    var plans=getPlans(cid);
    var scores=(state.scores||[]).filter(function(s){return String(s.courseId)===String(cid);});
    var criteria=(state.courseGrades&&state.courseGrades[cid])?state.courseGrades[cid]:window.defaultGradeCriteria;
    var header=['ลำดับ','รหัสนักเรียน','ชื่อ - นามสกุล','ห้อง','มา','สาย','ขาด'];
    var totalMax=0;
    plans.forEach(function(p){ var full=Number(p.maxScore); header.push('สัปดาห์ที่ '+p.week+'\n'+p.title+'\n'+(full===0?'(เช็คงาน)':'(เต็ม '+window.formatScoreDisplay(full,2)+')')); if(full!==0) totalMax = window.addScoreToTotal(totalMax, full, 2); });
    header.push('รวมคะแนน(เต็ม '+window.formatScoreDisplay(totalMax,2)+')','เกรด');
    var aoa=[['สรุปภาพรวมวิชา: '+cName],['ห้อง: '+(roomName||'ทุกห้อง')],[],header];
    list.forEach(function(st,idx){
      var pr=0,la=0,ab=0;
      attDates.forEach(function(d){ var rec=history[d]&&history[d].records||{}; var v=rec[st.id]; if(v==='present')pr++; else if(v==='late')la++; else if(v==='absent')ab++; });
      var row=[idx+1,st.code||'',st.name||'',studentRoom(st),pr,la,ab];
      var total=0;
      var isWithdrawn = (window.isWithdrawnStudent || window.isStudentWithdrawn || function(){return false;})(st);
      plans.forEach(function(p){
        if(isWithdrawn){ row.push('ลาออก'); return; }
        var task=scores.find(function(ts){return String(ts.week)===String(p.week) && String(ts.title)===String(p.title);});
        var raw=task&&task.records?task.records[st.id]:null;
        if(Number(p.maxScore)===0){ row.push(raw===1?'ส่งแล้ว':(raw===0?'ยังไม่ส่ง':'-')); }
        else { total = window.addScoreToTotal(total, raw, 2); row.push(!task?'-':((window.isMissingScoreValue ? window.isMissingScoreValue(raw) : raw==='')?'ขาดส่ง':window.normalizeScoreNumber(raw,2))); }
      });
      row.push(isWithdrawn ? 'ลาออก' : window.normalizeScoreNumber(total,2), isWithdrawn ? 'ลาออก' : (totalMax>0?calcGrade(window.normalizeScoreNumber(total,2),criteria,c,st):'-'));
      aoa.push(row);
    });
    return aoa;
  }
  function writeWorkbook(sheets, filename){
    if(typeof XLSX==='undefined') return showCustomAlert('โหลด Excel ไม่สำเร็จ','ไม่พบไลบรารี XLSX กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่',true);
    var wb=XLSX.utils.book_new();
    Object.keys(sheets).forEach(function(name){ XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheets[name]), cleanSheetName(name)); });
    XLSX.writeFile(wb, filename+'.xlsx');
  }
  function ensureModal(id, html){
    var old=document.getElementById(id); if(old) old.remove();
    var div=document.createElement('div'); div.id=id; div.className='schoolhub-export-popup hidden'; div.innerHTML=html; document.body.appendChild(div); return div;
  }
  function closeModal(id){ var el=document.getElementById(id); if(el) el.classList.add('hidden'); }


  window.closeStudentMoreMenu = function(){ var el=document.getElementById('student-more-menu'); if(el) el.remove(); };
  window.showStudentMoreMenu = function(id, btn){
    var st=(state.students||[]).find(function(x){return x.id===id;}); if(!st) return;
    window.closeStudentMoreMenu();
    var isW=window.isStudentWithdrawn&&window.isStudentWithdrawn(st);
    var menu=document.createElement('div');
    menu.id='student-more-menu';
    menu.className='fixed z-[999999] bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 min-w-[220px]';
    var reasonBtn=isW?'<button type="button" onclick="closeStudentMoreMenu(); showStudentWithdrawReason(\''+id+'\')" class="w-full text-left px-4 py-2.5 rounded-xl hover:bg-rose-50 text-rose-600 text-sm font-bold"><i class="fas fa-circle-info w-5"></i> ดูเหตุผลลาออก</button>':'';
    var cancelBtn=isW?'<button type="button" data-right="edit" data-action-name="เปลี่ยนสถานะนักเรียน" onclick="closeStudentMoreMenu(); cancelStudentWithdrawn(\''+id+'\')" class="w-full text-left px-4 py-2.5 rounded-xl hover:bg-emerald-50 text-emerald-600 text-sm font-bold"><i class="fas fa-user-check w-5"></i> ยกเลิกสถานะลาออก</button>':'';
    var setBtn=!isW?'<button type="button" data-right="edit" data-action-name="เปลี่ยนสถานะนักเรียน" onclick="closeStudentMoreMenu(); confirmSetStudentWithdrawn(\''+id+'\')" class="w-full text-left px-4 py-2.5 rounded-xl hover:bg-rose-50 text-rose-600 text-sm font-bold"><i class="fas fa-user-slash w-5"></i> ตั้งเป็นลาออก</button>':'';
    menu.innerHTML='<button type="button" onclick="closeStudentMoreMenu(); showStudentInfo(\''+id+'\')" class="w-full text-left px-4 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 text-sm font-bold"><i class="fas fa-id-card w-5"></i> ดูข้อมูลนักเรียน</button><button type="button" data-right="edit" data-action-name="แก้ไขข้อมูลนักเรียน" onclick="closeStudentMoreMenu(); editStudent(\''+id+'\')" class="w-full text-left px-4 py-2.5 rounded-xl hover:bg-indigo-50 text-indigo-600 text-sm font-bold"><i class="fas fa-pen w-5"></i> แก้ไขข้อมูลนักเรียน</button>'+setBtn+reasonBtn+cancelBtn;
    document.body.appendChild(menu);
    var r=btn&&btn.getBoundingClientRect?btn.getBoundingClientRect():{left:16,bottom:16};
    var left=Math.min(r.left, window.innerWidth-240);
    var top=Math.min(r.bottom+8, window.innerHeight-menu.offsetHeight-16);
    menu.style.left=Math.max(12,left)+'px';
    menu.style.top=Math.max(12,top)+'px';
    setTimeout(function(){ document.addEventListener('click', window.closeStudentMoreMenu, {once:true}); },0);
  };
  window.showStudentInfo = function(id){
    var st=(state.students||[]).find(function(x){return x.id===id;}); if(!st) return;
    showCustomAlert('ข้อมูลนักเรียน', 'รหัสนักเรียน: '+(st.code||'-')+'\nชื่อ-นามสกุล: '+(st.name||'-')+'\nชั้น/ห้อง: '+(window.getStudentClassName?window.getStudentClassName(st):(st.grade||st.room||'-'))+'\nสถานะ: '+((window.isStudentWithdrawn&&window.isStudentWithdrawn(st))?'ลาออก':'ปกติ'));
  };
  window.exportScoresToExcel = function(){
    var cid=courseId(); if(!cid) return showCustomAlert('ผิดพลาด','ไม่พบรายวิชา',true);
    var c=course(); var rooms=roomsForCourse(c); var all=allCourseStudents(cid);
    if(!all.length) return showCustomAlert('ผิดพลาด','ไม่มีข้อมูลนักเรียนในวิชานี้',true);
    if(rooms.length>1){
      var opts='<option value="all">ทุกห้อง (แยกชีตตามห้อง)</option>'+rooms.map(function(r){return '<option value="'+esc(r)+'">'+esc(r)+'</option>';}).join('');
      var modal=ensureModal('schoolhub-overview-export-room-modal','<div class="schoolhub-export-box"><div class="schoolhub-export-head"><div class="schoolhub-export-title"><i class="fas fa-file-excel text-emerald-600"></i> โหลดตารางภาพรวม</div><button class="text-slate-400 hover:text-slate-700" onclick="document.getElementById(\'schoolhub-overview-export-room-modal\').classList.add(\'hidden\')"><i class="fas fa-times"></i></button></div><div class="schoolhub-export-body"><div><label class="schoolhub-export-label">เลือกห้องที่ต้องการโหลด</label><select id="overview-export-room-select" class="schoolhub-export-input">'+opts+'</select></div><p class="text-xs font-semibold text-slate-500">ถ้าเลือกทุกห้อง ระบบจะแยกชีตในไฟล์ Excel เป็นห้องละ 1 หน้า</p></div><div class="schoolhub-export-actions"><button class="bg-slate-100 text-slate-600" onclick="document.getElementById(\'schoolhub-overview-export-room-modal\').classList.add(\'hidden\')">ยกเลิก</button><button id="overview-export-confirm" class="bg-emerald-600 hover:bg-emerald-700 text-white"><i class="fas fa-download mr-1"></i> โหลด Excel</button></div></div>');
      modal.classList.remove('hidden');
      document.getElementById('overview-export-confirm').onclick=function(){
        var selected=document.getElementById('overview-export-room-select').value;
        var sheets={};
        if(selected==='all') rooms.forEach(function(r){ sheets[r]=buildOverviewAoa(cid, studentsForRoom(cid,r), r); });
        else sheets[selected]=buildOverviewAoa(cid, studentsForRoom(cid,selected), selected);
        closeModal('schoolhub-overview-export-room-modal');
        writeWorkbook(sheets, 'สรุปภาพรวม_'+((c&&c.code)||'รายวิชา'));
      };
    }else{
      var room=rooms[0]||'ทุกห้อง';
      writeWorkbook({[room]:buildOverviewAoa(cid, all, room)}, 'สรุปภาพรวม_'+((c&&c.code)||'รายวิชา'));
    }
  };

  window.exportAttendanceToExcel = function(){
    var cid=courseId(); var c=course(); if(!cid||!c) return showCustomAlert('ผิดพลาด','ไม่พบรายวิชา',true);
    var history=(state.attendance&&state.attendance[cid])||{};
    var dates=Object.keys(history).sort();
    if(!dates.length) return showCustomAlert('ยังไม่มีข้อมูล','ยังไม่มีวันที่เคยเช็คชื่อในรายวิชานี้',true);
    var rooms=roomsForCourse(c); var selectedRoom=(window.activeCourseRoomFilter&&window.activeCourseRoomFilter[cid])||'all';
    var roomOpts = rooms.length>1 ? '<div><label class="schoolhub-export-label">เลือกห้อง</label><select id="attendance-export-room" class="schoolhub-export-input"><option value="all">ทุกห้อง</option>'+rooms.map(function(r){return '<option value="'+esc(r)+'" '+(selectedRoom===r?'selected':'')+'>'+esc(r)+'</option>';}).join('')+'</select></div>' : '';
    var dateOpts=dates.map(function(d){return '<option value="'+esc(d)+'">'+esc(d)+'</option>';}).join('');
    var modal=ensureModal('schoolhub-attendance-export-modal','<div class="schoolhub-export-box"><div class="schoolhub-export-head"><div class="schoolhub-export-title"><i class="fas fa-calendar-check text-emerald-600"></i> โหลดเช็คชื่อ Excel</div><button class="text-slate-400 hover:text-slate-700" onclick="document.getElementById(\'schoolhub-attendance-export-modal\').classList.add(\'hidden\')"><i class="fas fa-times"></i></button></div><div class="schoolhub-export-body">'+roomOpts+'<div><label class="schoolhub-export-label">รูปแบบวันที่</label><select id="attendance-export-mode" class="schoolhub-export-input"><option value="all">ทุกวันที่เคยเช็ค</option><option value="range">เลือกช่วงวันที่</option></select></div><div id="attendance-export-range" class="grid grid-cols-1 sm:grid-cols-2 gap-3 hidden"><div><label class="schoolhub-export-label">เริ่มวันที่</label><select id="attendance-export-start" class="schoolhub-export-input">'+dateOpts+'</select></div><div><label class="schoolhub-export-label">ถึงวันที่</label><select id="attendance-export-end" class="schoolhub-export-input">'+dateOpts+'</select></div></div><p class="text-xs font-semibold text-slate-500">ไฟล์จะเรียงรายชื่อนักเรียน และวันที่เช็คชื่อตามลำดับ</p></div><div class="schoolhub-export-actions"><button class="bg-slate-100 text-slate-600" onclick="document.getElementById(\'schoolhub-attendance-export-modal\').classList.add(\'hidden\')">ยกเลิก</button><button id="attendance-export-confirm" class="bg-emerald-600 hover:bg-emerald-700 text-white"><i class="fas fa-download mr-1"></i> โหลด Excel</button></div></div>');
    modal.classList.remove('hidden');
    var mode=document.getElementById('attendance-export-mode');
    mode.onchange=function(){ document.getElementById('attendance-export-range').classList.toggle('hidden', this.value!=='range'); };
    document.getElementById('attendance-export-end').value=dates[dates.length-1];
    document.getElementById('attendance-export-confirm').onclick=function(){
      var useDates=dates.slice();
      if(mode.value==='range'){
        var a=document.getElementById('attendance-export-start').value, b=document.getElementById('attendance-export-end').value;
        if(a>b){var t=a;a=b;b=t;}
        useDates=dates.filter(function(d){return d>=a && d<=b;});
      }
      var roomSel=(document.getElementById('attendance-export-room')||{}).value || 'all';
      var list=studentsForRoom(cid, roomSel);
      var header=['ลำดับ','รหัสนักเรียน','ชื่อ - นามสกุล','ห้อง'].concat(useDates);
      var aoa=[['รายงานเช็คชื่อ: '+(c.name||c.code||'รายวิชา')],['ช่วงวันที่: '+(useDates[0]||'-')+' ถึง '+(useDates[useDates.length-1]||'-')],[],header];
      list.forEach(function(st,idx){ var row=[idx+1,st.code||'',st.name||'',studentRoom(st)]; useDates.forEach(function(d){ var rec=history[d]&&history[d].records||{}; row.push(statusThai(rec[st.id])); }); aoa.push(row); });
      closeModal('schoolhub-attendance-export-modal');
      writeWorkbook({'เช็คชื่อ':aoa}, 'เช็คชื่อ_'+(c.code||'รายวิชา'));
    };
  };

  function ensureAttendanceExportButton(){
    var oldBtn=document.getElementById('btn-export-attendance-excel');
    var header=document.querySelector('#attendance-area > .p-5.border-b');
    if(!header) return;
    var rightWrap=header.querySelector('#schoolhub-attendance-header-actions');
    if(!rightWrap){
      rightWrap=document.createElement('div');
      rightWrap.id='schoolhub-attendance-header-actions';
      rightWrap.className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto';
      var lastSaved=document.getElementById('att-last-saved');
      if(lastSaved) rightWrap.appendChild(lastSaved);
      header.appendChild(rightWrap);
    }
    if(oldBtn && oldBtn.parentElement!==rightWrap) oldBtn.remove();
    if(document.getElementById('btn-export-attendance-excel')) return;
    var btn=document.createElement('button');
    btn.id='btn-export-attendance-excel';
    btn.type='button';
    btn.className='bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition shadow-sm w-full sm:w-auto justify-center text-sm';
    btn.innerHTML='<i class="fas fa-file-excel"></i> โหลด Excel';
    btn.onclick=window.exportAttendanceToExcel;
    rightWrap.appendChild(btn);
  }
  function ensureOverviewRoomSelector(){
    var box=document.getElementById('overview-room-filter');
    var exportBtn=document.querySelector('#course-tab-overview button[onclick="exportScoresToExcel()"]');
    if(box && exportBtn && exportBtn.parentElement && box.parentElement!==exportBtn.parentElement) exportBtn.insertAdjacentElement('afterend', box);
  }
  window.renderOverviewRoomFilter = function(){
    ensureOverviewRoomSelector();
    var box=document.getElementById('overview-room-filter'); var cid=courseId(); var c=course(); var rooms=roomsForCourse(c);
    if(!box) return;
    if(!cid || rooms.length<=1){ box.className='hidden schoolhub-room-filter-hidden'; box.innerHTML=''; return; }

    // Prevent native select popup from being destroyed by overview re-render/click refresh.
    // This fixes: click room button/select -> opens briefly -> closes immediately.
    var existingSelect = box.querySelector('#schoolhub-overview-room-select-final');
    if(window.__schoolhubOverviewRoomSelectOpening && existingSelect){
      return;
    }

    window.__overviewRoomFilter=window.__overviewRoomFilter||{};
    window.activeCourseRoomFilter=window.activeCourseRoomFilter||{};
    var selected=window.activeCourseRoomFilter[cid] || window.__overviewRoomFilter[cid] || 'all';
    if(selected!=='all' && rooms.indexOf(selected)<0) selected='all';
    window.__overviewRoomFilter[cid]=selected;
    box.className='schoolhub-room-filter-ready';
    box.innerHTML='<div class="schoolhub-room-selector-mini"><span class="schoolhub-room-selector-mini-label"><i class="fas fa-door-open"></i> เลือกห้อง</span><select id="schoolhub-overview-room-select-final" onpointerdown="window.__schoolhubOverviewRoomSelectOpening=true; clearTimeout(window.__schoolhubOverviewRoomSelectTimer); window.__schoolhubOverviewRoomSelectTimer=setTimeout(function(){window.__schoolhubOverviewRoomSelectOpening=false;},1200);" onmousedown="window.__schoolhubOverviewRoomSelectOpening=true;" onclick="event.stopPropagation();" onfocus="window.__schoolhubOverviewRoomSelectOpening=true;" onblur="clearTimeout(window.__schoolhubOverviewRoomSelectTimer); window.__schoolhubOverviewRoomSelectTimer=setTimeout(function(){window.__schoolhubOverviewRoomSelectOpening=false;},120);"><option value="all" '+(selected==='all'?'selected':'')+'>ทุกห้อง</option>'+rooms.map(function(r){return '<option value="'+esc(r)+'" '+(selected===r?'selected':'')+'>'+esc(r)+'</option>';}).join('')+'</select></div>';
  };
  document.addEventListener('change',function(e){
    var sel=e.target && e.target.closest && e.target.closest('#schoolhub-overview-room-select-final');
    if(!sel) return;
    e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    var cid=courseId(); if(!cid) return;
    window.__overviewRoomFilter=window.__overviewRoomFilter||{}; window.activeCourseRoomFilter=window.activeCourseRoomFilter||{};
    window.__overviewRoomFilter[cid]=sel.value;
    if(sel.value==='all') delete window.activeCourseRoomFilter[cid]; else window.activeCourseRoomFilter[cid]=sel.value;
    window.__schoolhubOverviewRoomSelectOpening=false;
    clearTimeout(window.__schoolhubOverviewRoomSelectTimer);
    if(typeof window.renderCourseOverview==='function') setTimeout(function(){ window.renderCourseOverview(); },0);
  }, true);
  if(typeof window.renderCourseOverview==='function' && !window.renderCourseOverview.__finalFastSelectorExportWrapped){
    var old=window.renderCourseOverview;
    var fn=function(){ var r=old.apply(this,arguments); try{window.renderOverviewRoomFilter();}catch(e){} try{ensureAttendanceExportButton();}catch(e){} return r; };
    fn.__finalFastSelectorExportWrapped=true; window.renderCourseOverview=fn;
  }
  if(typeof window.renderAttendanceList==='function' && !window.renderAttendanceList.__finalExportButtonWrapped){
    var oldA=window.renderAttendanceList;
    var fnA=function(){ var r=oldA.apply(this,arguments); try{ensureAttendanceExportButton();}catch(e){} return r; };
    fnA.__finalExportButtonWrapped=true; window.renderAttendanceList=fnA;
  }
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(function(){ensureOverviewRoomSelector(); if(window.renderOverviewRoomFilter) window.renderOverviewRoomFilter(); ensureAttendanceExportButton();},300); });
})();
