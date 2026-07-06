
(function(){
  if(window.__schoolhubOverviewExcelPopupLikeAttendanceFinal) return;
  window.__schoolhubOverviewExcelPopupLikeAttendanceFinal = true;

  function esc(v){
    if(typeof window.escapeHTML === 'function') return window.escapeHTML(String(v == null ? '' : v));
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function courseId(){ return window.currentActiveCourseId || (window.currentCourse && window.currentCourse.id) || null; }
  function course(){
    var cid=courseId();
    return ((window.state && state.courses) || []).find(function(c){return String(c.id)===String(cid);}) || window.currentCourse || null;
  }
  function studentRoom(st){ return String((st && (st.room || st.grade || st.className || st.classroom)) || '').trim() || 'ไม่ระบุห้อง'; }
  function allCourseStudents(cid){
    if(typeof window.getCourseStudents === 'function') return window.getCourseStudents(cid) || [];
    var c=course();
    var ids=(c && (c.studentIds || c.students || c.studentIdList)) || [];
    return ((window.state && state.students) || []).filter(function(s){ return !ids.length || ids.indexOf(s.id) !== -1 || ids.indexOf(s.code) !== -1; });
  }
  function roomsForCourse(c){
    var arr=[];
    [['studentRooms'],['rooms'],['grades'],['studentGrades'],['classes']].forEach(function(keys){
      var v=c && c[keys[0]];
      if(Array.isArray(v)) arr=arr.concat(v);
    });
    allCourseStudents(courseId()).forEach(function(s){ arr.push(studentRoom(s)); });
    var seen={};
    return arr.map(function(x){return String(x||'').trim();}).filter(function(x){ if(!x) return false; if(seen[x]) return false; seen[x]=true; return true; });
  }
  function studentsForRoom(cid, room){
    var list=allCourseStudents(cid);
    if(!room || room==='all') return list;
    return list.filter(function(s){ return studentRoom(s) === room; });
  }
  function cleanSheetName(name){
    return String(name || 'ชีต').replace(/[\\/?*\[\]:]/g,' ').trim().slice(0,31) || 'ชีต';
  }
  function statusThai(v){ return v==='present'?'มา':(v==='late'?'สาย':(v==='absent'?'ขาด':'-')); }
  function calcGrade(score, criteria, course, student){
    if (typeof window.getFinalGradeForStudent === 'function' && course && student) return window.getFinalGradeForStudent(course, student, score);
    if (typeof window.calculateGradeFromRules === 'function') return window.calculateGradeFromRules(score, criteria);
    return '-';
  }
  function buildOverviewAoa(cid, list, roomName){
    var c=course();
    var cName=(c && (c.name || c.code)) || 'รายวิชา';
    var history=(state.attendance && state.attendance[cid]) || {};
    var attDates=Object.keys(history).sort();
    var plans=((state.coursePlans && state.coursePlans[cid]) || []).slice().sort(function(a,b){return Number(a.week)-Number(b.week);});
    var scores=((state.scores) || []).filter(function(s){return String(s.courseId)===String(cid);});
    var criteria=(state.courseGrades && state.courseGrades[cid]) || window.defaultGradeCriteria;
    var totalMax=0;
    var header=['ลำดับ','รหัสนักเรียน','ชื่อ - นามสกุล','ห้อง','มา','สาย','ขาด'];
    plans.forEach(function(p){
      var full=Number(p.maxScore);
      header.push('สัปดาห์ที่ '+p.week+'\n'+p.title+'\n'+(full===0?'(เช็คงาน)':'(เต็ม '+window.formatScoreDisplay(full,2)+')'));
      if(full!==0) totalMax = window.addScoreToTotal(totalMax, full, 2);
    });
    header.push('รวมคะแนน(เต็ม '+window.formatScoreDisplay(totalMax,2)+')','เกรด');
    var aoa=[['สรุปภาพรวมวิชา: '+cName],['ห้อง: '+(roomName || 'ทุกห้อง')],[],header];
    list.forEach(function(st,idx){
      var pr=0,la=0,ab=0;
      attDates.forEach(function(d){
        var rec=(history[d] && history[d].records) || {};
        var v=rec[st.id];
        if(v==='present') pr++; else if(v==='late') la++; else if(v==='absent') ab++;
      });
      var row=[idx+1, st.code || '', st.name || '', studentRoom(st), pr, la, ab];
      var total=0;
      var isWithdrawn = (window.isWithdrawnStudent || window.isStudentWithdrawn || function(){return false;})(st);
      plans.forEach(function(p){
        if(isWithdrawn){ row.push('ลาออก'); return; }
        var task=scores.find(function(ts){return String(ts.week)===String(p.week) && String(ts.title)===String(p.title);});
        var raw=task && task.records ? task.records[st.id] : null;
        if(Number(p.maxScore)===0){ row.push(raw===1?'ส่งแล้ว':(raw===0?'ยังไม่ส่ง':'-')); }
        else{
          total = window.addScoreToTotal(total, raw, 2);
          row.push(!task ? '-' : ((window.isMissingScoreValue ? window.isMissingScoreValue(raw) : raw==='')?'ขาดส่ง':window.normalizeScoreNumber(raw,2)));
        }
      });
      row.push(isWithdrawn ? 'ลาออก' : window.normalizeScoreNumber(total,2), isWithdrawn ? 'ลาออก' : (totalMax>0 ? calcGrade(window.normalizeScoreNumber(total,2), criteria, c, st) : '-'));
      aoa.push(row);
    });
    return aoa;
  }
  function writeWorkbook(sheets, filename){
    if(typeof XLSX === 'undefined') return showCustomAlert('โหลด Excel ไม่สำเร็จ','ไม่พบไลบรารี XLSX กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่',true);
    var wb=XLSX.utils.book_new();
    Object.keys(sheets).forEach(function(name){ XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheets[name]), cleanSheetName(name)); });
    XLSX.writeFile(wb, filename + '.xlsx');
  }
  function ensureModal(id, html){
    var old=document.getElementById(id); if(old) old.remove();
    var div=document.createElement('div'); div.id=id; div.className='schoolhub-export-popup hidden'; div.innerHTML=html; document.body.appendChild(div); return div;
  }
  function closeModal(id){ var el=document.getElementById(id); if(el) el.classList.add('hidden'); }
  function currentOverviewRoom(cid){
    var select=document.getElementById('schoolhub-overview-room-select-final');
    return (select && select.value) || (window.__overviewRoomFilter && window.__overviewRoomFilter[cid]) || (window.activeCourseRoomFilter && window.activeCourseRoomFilter[cid]) || 'all';
  }


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
    var cid=courseId();
    var c=course();
    if(!cid || !c) return showCustomAlert('ผิดพลาด','ไม่พบรายวิชา',true);
    var all=allCourseStudents(cid);
    if(!all.length) return showCustomAlert('ผิดพลาด','ไม่มีข้อมูลนักเรียนในวิชานี้',true);
    var rooms=roomsForCourse(c);
    var selected=currentOverviewRoom(cid);
    if(selected!=='all' && rooms.indexOf(selected)<0) selected='all';

    var options='';
    if(rooms.length>1){
      options += '<option value="current" '+(selected!=='all'?'selected':'')+'>ห้องที่เลือกอยู่ตอนนี้'+(selected!=='all'?' ('+esc(selected)+')':'')+'</option>';
      options += '<option value="all" '+(selected==='all'?'selected':'')+'>ทุกห้อง (แยกชีตตามห้อง)</option>';
      rooms.forEach(function(r){ options += '<option value="room:'+esc(r)+'" '+(selected===r?'selected':'')+'>'+esc(r)+'</option>'; });
    }else{
      var only=rooms[0] || 'ทุกห้อง';
      options = '<option value="room:'+esc(only)+'" selected>'+esc(only)+'</option>';
    }

    var modal=ensureModal('schoolhub-overview-export-room-modal',
      '<div class="schoolhub-export-box">'+
        '<div class="schoolhub-export-head">'+
          '<div class="schoolhub-export-title"><i class="fas fa-file-excel text-emerald-600"></i> โหลด Excel ภาพรวม</div>'+
          '<button type="button" class="text-slate-400 hover:text-slate-700" onclick="document.getElementById(\'schoolhub-overview-export-room-modal\').classList.add(\'hidden\')"><i class="fas fa-times"></i></button>'+
        '</div>'+
        '<div class="schoolhub-export-body">'+
          '<div><label class="schoolhub-export-label">เลือกข้อมูลที่ต้องการโหลด</label><select id="overview-export-room-select" class="schoolhub-export-input">'+options+'</select></div>'+
          '<p class="text-xs font-semibold text-slate-500">ถ้าเลือกทุกห้อง ระบบจะแยกชีตในไฟล์ Excel เป็นห้องละหน้า ตามชื่อห้องที่ตั้งไว้</p>'+
        '</div>'+
        '<div class="schoolhub-export-actions">'+
          '<button type="button" class="bg-slate-100 text-slate-600" onclick="document.getElementById(\'schoolhub-overview-export-room-modal\').classList.add(\'hidden\')">ยกเลิก</button>'+
          '<button type="button" id="overview-export-confirm" class="bg-emerald-600 hover:bg-emerald-700 text-white"><i class="fas fa-download mr-1"></i> โหลด Excel</button>'+
        '</div>'+
      '</div>'
    );
    modal.classList.remove('hidden');
    setTimeout(function(){ var s=document.getElementById('overview-export-room-select'); if(s) s.focus(); },0);

    document.getElementById('overview-export-confirm').onclick=function(){
      var value=document.getElementById('overview-export-room-select').value;
      var sheets={};
      if(value==='current') value = (selected==='all' ? 'all' : 'room:'+selected);
      if(value==='all'){
        rooms.forEach(function(r){ sheets[r]=buildOverviewAoa(cid, studentsForRoom(cid,r), r); });
      }else{
        var room=value.replace(/^room:/,'');
        sheets[room]=buildOverviewAoa(cid, studentsForRoom(cid,room), room);
      }
      closeModal('schoolhub-overview-export-room-modal');
      writeWorkbook(sheets, 'สรุปภาพรวม_'+((c && (c.code || c.name)) || 'รายวิชา'));
    };
  };

  function fixOverviewExcelButtonText(){
    var btn=document.querySelector('#course-tab-overview button[onclick="exportScoresToExcel()"]');
    if(!btn) return;
    btn.innerHTML='<i class="fas fa-file-excel"></i> โหลด Excel';
  }
  var oldRenderOverview = window.renderCourseOverview;
  if(typeof oldRenderOverview === 'function' && !oldRenderOverview.__overviewExcelPopupLikeAttendanceWrapped){
    var wrapped=function(){ var r=oldRenderOverview.apply(this,arguments); setTimeout(fixOverviewExcelButtonText,0); return r; };
    wrapped.__overviewExcelPopupLikeAttendanceWrapped=true;
    window.renderCourseOverview=wrapped;
  }
  document.addEventListener('DOMContentLoaded',function(){ fixOverviewExcelButtonText(); setTimeout(fixOverviewExcelButtonText,300); });
})();
