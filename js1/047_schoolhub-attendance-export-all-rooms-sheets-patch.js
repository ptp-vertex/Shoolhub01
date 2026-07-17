
(function(){
  if(window.__schoolhubAttendanceExportAllRoomsSheetsPatch) return;
  window.__schoolhubAttendanceExportAllRoomsSheetsPatch = true;

  function esc(v){
    if(typeof window.escapeHTML === 'function') return window.escapeHTML(String(v == null ? '' : v));
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function cid(){ return window.currentActiveCourseId || (window.currentCourse && window.currentCourse.id) || ''; }
  function course(){
    var id=cid();
    return ((window.state && state.courses) || []).find(function(c){return String(c.id)===String(id);}) || window.currentCourse || null;
  }
  function roomOf(st){
    try{
      if(typeof window.getStudentClassName === 'function') return String(window.getStudentClassName(st) || '').trim() || 'ไม่ระบุห้อง';
    }catch(e){}
    return String((st && (st.room || st.classroom || st.className || st.grade || st.level)) || '').trim() || 'ไม่ระบุห้อง';
  }
  function unique(arr){
    var out=[];
    (arr||[]).forEach(function(v){
      if(Array.isArray(v)){ v.forEach(function(x){ var t=String(x||'').trim(); if(t && t!=='-' && out.indexOf(t)<0) out.push(t); }); return; }
      var t=String(v||'').trim();
      if(t && t!=='-' && t!=='undefined' && t!=='null' && out.indexOf(t)<0) out.push(t);
    });
    return out.sort(function(a,b){return a.localeCompare(b,'th',{numeric:true});});
  }
  function roomsForCourse(c){
    if(!c) return [];
    var rooms=[];
    ['studentRooms','studentGrades','rooms','grades','classes','classrooms','selectedRooms','selectedGrades'].forEach(function(k){
      if(Array.isArray(c[k])) rooms=rooms.concat(c[k]);
      else if(typeof c[k] === 'string') rooms=rooms.concat(c[k].split(/[,|،]/));
    });
    var fromCourse=unique(rooms);
    if(fromCourse.length) return fromCourse;
    var list=allCourseStudents();
    return unique(list.map(roomOf));
  }
  function allCourseStudents(){
    var id=cid();
    if(typeof window.getCourseStudents === 'function'){
      try{ return window.getCourseStudents(id,{ignoreActionFilter:true}) || []; }catch(e){}
      try{ return window.getCourseStudents(id) || []; }catch(e){}
    }
    return ((window.state && state.students) || []).slice();
  }
  function studentsForRoom(room){
    var list=allCourseStudents();
    if(room && room !== 'all') list=list.filter(function(st){return roomOf(st) === room;});
    return list.sort(function(a,b){
      return roomOf(a).localeCompare(roomOf(b),'th',{numeric:true}) || String(a.code||'').localeCompare(String(b.code||''),'th',{numeric:true}) || String(a.name||'').localeCompare(String(b.name||''),'th');
    });
  }
  function statusThai(v){ return v==='present'?'มา':(v==='late'?'สาย':(v==='absent'?'ขาด':(v==='leave'?'ลา':'-'))); }
  function sheetName(name, used){
    var base=String(name || 'เช็คชื่อ').replace(/[\\/?*\[\]:]/g,' ').trim().slice(0,31) || 'เช็คชื่อ';
    var n=base, i=2;
    used=used||{};
    while(used[n]){
      var suffix=' '+i++;
      n=base.slice(0,31-suffix.length)+suffix;
    }
    used[n]=true;
    return n;
  }
  function ensureModal(id, html){
    var old=document.getElementById(id); if(old) old.remove();
    var div=document.createElement('div'); div.id=id; div.className='schoolhub-export-popup hidden'; div.innerHTML=html; document.body.appendChild(div); return div;
  }
  function buildAttendanceAoa(students, roomName, dates){
    var c=course() || {};
    var history=(state.attendance && state.attendance[cid()]) || {};
    var header=['ลำดับ','รหัสนักเรียน','ชื่อ - นามสกุล','ห้อง'].concat(dates, ['มา (รวม)','สาย (รวม)','ขาด (รวม)','ลา (รวม)']);
    var aoa=[['รายงานเช็คชื่อ: '+(c.name || c.code || 'รายวิชา')],['ห้อง: '+(roomName || 'ทุกห้อง')],['ช่วงวันที่: '+(dates[0] || '-')+' ถึง '+(dates[dates.length-1] || '-')],[],header];
    students.forEach(function(st,idx){
      var row=[idx+1, st.code || '', st.name || '', roomOf(st)];
      var pr=0, la=0, ab=0, lv=0;
      dates.forEach(function(d){
        var rec=(history[d] && history[d].records) || {};
        var v=rec[st.id];
        row.push(statusThai(v));
        if(v==='present') pr++; else if(v==='late') la++; else if(v==='absent') ab++; else if(v==='leave') lv++;
      });
      row.push(pr, la, ab, lv);
      aoa.push(row);
    });
    return aoa;
  }
  function writeAttendanceWorkbook(roomChoice, dates){
    if(typeof XLSX === 'undefined') return showCustomAlert('โหลด Excel ไม่สำเร็จ','ไม่พบไลบรารี XLSX กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่',true);
    try { if (typeof window.toggleLoader === 'function') window.toggleLoader(true); } catch(e){}
    try {
    var c=course() || {};
    var rooms=roomsForCourse(c);
    var wb=XLSX.utils.book_new();
    var used={};
    if(roomChoice === 'all' && rooms.length > 1){
      rooms.forEach(function(r){
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildAttendanceAoa(studentsForRoom(r), r, dates)), sheetName(r, used));
      });
    }else{
      var room=(roomChoice && roomChoice !== 'all') ? roomChoice : (rooms[0] || 'เช็คชื่อ');
      var list=(roomChoice && roomChoice !== 'all') ? studentsForRoom(roomChoice) : allCourseStudents();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildAttendanceAoa(list, roomChoice==='all'?'ทุกห้อง':room, dates)), sheetName(roomChoice==='all'?'เช็คชื่อ':room, used));
    }
    XLSX.writeFile(wb, 'เช็คชื่อ_'+(c.code || c.name || 'รายวิชา')+'.xlsx');
    } finally {
      try { if (typeof window.toggleLoader === 'function') window.toggleLoader(false); } catch(e){}
    }
  }

  window.exportAttendanceToExcel = function(){
    var id=cid(), c=course();
    if(!id || !c) return showCustomAlert('ผิดพลาด','ไม่พบรายวิชา',true);
    var history=(state.attendance && state.attendance[id]) || {};
    var dates=Object.keys(history).sort();
    if(!dates.length) return showCustomAlert('ยังไม่มีข้อมูล','ยังไม่มีวันที่เคยเช็คชื่อในรายวิชานี้',true);

    var rooms=roomsForCourse(c);
    var selectedRoom=(window.activeCourseRoomFilter && window.activeCourseRoomFilter[id]) || 'all';
    var roomHtml='';
    if(rooms.length > 1){
      roomHtml='<div><label class="schoolhub-export-label">เลือกห้อง</label><select id="attendance-export-room" class="schoolhub-export-input"><option value="all">ทุกห้อง (แยกชีตตามห้อง)</option>'+rooms.map(function(r){return '<option value="'+esc(r)+'" '+(selectedRoom===r?'selected':'')+'>'+esc(r)+'</option>';}).join('')+'</select></div>';
    }else{
      var only=rooms[0] || 'เช็คชื่อ';
      roomHtml='<div><label class="schoolhub-export-label">ห้อง</label><select id="attendance-export-room" class="schoolhub-export-input"><option value="'+esc(only)+'" selected>'+esc(only)+'</option></select></div>';
    }
    var dateOpts=dates.map(function(d){return '<option value="'+esc(d)+'">'+esc(d)+'</option>';}).join('');
    var modal=ensureModal('schoolhub-attendance-export-modal',
      '<div class="schoolhub-export-box"><div class="schoolhub-export-head"><div class="schoolhub-export-title"><i class="fas fa-calendar-check text-emerald-600"></i> โหลดเช็คชื่อ Excel</div><button type="button" class="text-slate-400 hover:text-slate-700" onclick="document.getElementById(\'schoolhub-attendance-export-modal\').classList.add(\'hidden\')"><i class="fas fa-times"></i></button></div>'+ 
      '<div class="schoolhub-export-body">'+roomHtml+'<div><label class="schoolhub-export-label">รูปแบบวันที่</label><select id="attendance-export-mode" class="schoolhub-export-input"><option value="all">ทุกวันที่เคยเช็ค</option><option value="range">เลือกช่วงวันที่</option></select></div>'+ 
      '<div id="attendance-export-range" class="grid grid-cols-1 sm:grid-cols-2 gap-3 hidden"><div><label class="schoolhub-export-label">เริ่มวันที่</label><select id="attendance-export-start" class="schoolhub-export-input">'+dateOpts+'</select></div><div><label class="schoolhub-export-label">ถึงวันที่</label><select id="attendance-export-end" class="schoolhub-export-input">'+dateOpts+'</select></div></div>'+ 
      '<p class="text-xs font-semibold text-slate-500">ถ้าเลือกทุกห้อง ระบบจะแยกชีตในไฟล์ Excel เป็นห้องละหน้า โดยใช้ชื่อชีตเป็นชื่อห้องที่ตั้งไว้</p></div>'+ 
      '<div class="schoolhub-export-actions"><button type="button" class="bg-slate-100 text-slate-600" onclick="document.getElementById(\'schoolhub-attendance-export-modal\').classList.add(\'hidden\')">ยกเลิก</button><button type="button" id="attendance-export-confirm" class="bg-emerald-600 hover:bg-emerald-700 text-white"><i class="fas fa-download mr-1"></i> โหลด Excel</button></div></div>');
    modal.classList.remove('hidden');
    var mode=document.getElementById('attendance-export-mode');
    var range=document.getElementById('attendance-export-range');
    mode.onchange=function(){ range.classList.toggle('hidden', this.value !== 'range'); };
    document.getElementById('attendance-export-end').value=dates[dates.length-1];
    document.getElementById('attendance-export-confirm').onclick=function(){
      var useDates=dates.slice();
      if(mode.value === 'range'){
        var a=document.getElementById('attendance-export-start').value;
        var b=document.getElementById('attendance-export-end').value;
        if(a>b){ var t=a; a=b; b=t; }
        useDates=dates.filter(function(d){ return d>=a && d<=b; });
      }
      var roomChoice=(document.getElementById('attendance-export-room') || {}).value || 'all';
      modal.classList.add('hidden');
      writeAttendanceWorkbook(roomChoice, useDates);
    };
  };

  var oldEnsure=setInterval(function(){
    var btn=document.getElementById('btn-export-attendance-excel');
    if(btn){ btn.onclick=window.exportAttendanceToExcel; clearInterval(oldEnsure); }
  },300);
})();
