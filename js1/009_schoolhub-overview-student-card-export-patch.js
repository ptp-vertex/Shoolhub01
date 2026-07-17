
(function(){
  if (window.__schoolhubOverviewStudentCardPatch) return;
  window.__schoolhubOverviewStudentCardPatch = true;

  function esc(v){ try { return window.escapeHTML ? window.escapeHTML(v) : String(v||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); } catch(e){ return String(v||''); } }
  function className(st){ return (window.getStudentClassName ? window.getStudentClassName(st) : (st && (st.room||st.classroom||st.grade)) || '-').toString().trim() || '-'; }
  function courseRooms(courseId){
    try { return window.getCourseSelectedRooms ? window.getCourseSelectedRooms(courseId) : []; } catch(e){ return []; }
  }
  function allStudentsForCourse(courseId){
    if (!courseId || !window.state) return [];
    var course = (state.courses||[]).find(c=>c.id===courseId) || {};
    var rooms = Array.isArray(course.studentRooms) ? course.studentRooms : (Array.isArray(course.studentGrades) ? course.studentGrades : []);
    var extraIds = Array.isArray(course.extraStudentIds) ? course.extraStudentIds : [];
    if (!rooms.length && !extraIds.length) return [];
    return (state.students||[]).filter(st => rooms.includes(className(st)) || extraIds.includes(st.id))
      .sort((a,b)=>String(className(a)).localeCompare(String(className(b)),'th',{numeric:true}) || String(a.code||'').localeCompare(String(b.code||''),'th',{numeric:true}) || String(a.name||'').localeCompare(String(b.name||''),'th'));
  }
  window.__overviewRoomFilter = window.__overviewRoomFilter || {};
  function getOverviewStudents(courseId){
    var students = allStudentsForCourse(courseId);
    var rooms = Array.from(new Set(students.map(className))).sort((a,b)=>a.localeCompare(b,'th',{numeric:true}));
    var selected = window.__overviewRoomFilter[courseId] || 'all';
    if (selected !== 'all') students = students.filter(st => className(st) === selected);
    return {students, rooms, selected};
  }
  window.renderOverviewRoomFilter = function(){
    var box = document.getElementById('overview-room-filter');
    if (!box || !window.currentActiveCourseId) return;
    var courseId = window.currentActiveCourseId;
    var data = getOverviewStudents(courseId);
    if (data.rooms.length <= 1) { box.classList.add('hidden'); box.innerHTML=''; return; }
    box.classList.remove('hidden');
    box.innerHTML = '<div class="overview-room-select-wrap flex items-center gap-2">'+
      '<label class="text-xs font-black text-slate-500 whitespace-nowrap hidden sm:inline-flex items-center gap-1"><i class="fas fa-door-open text-primary"></i> ห้อง</label>'+ 
      '<select class="overview-room-select bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-bold text-primary focus:ring-2 focus:ring-primary outline-none min-w-[120px]" onclick="event.stopPropagation();" onchange="event.stopPropagation(); window.__overviewRoomFilter=window.__overviewRoomFilter||{}; window.__overviewRoomFilter[\''+courseId+'\']=this.value; window.requestAnimationFrame(function(){ renderCourseOverview(); });">'+
      '<option value="all" '+(data.selected==='all'?'selected':'')+'>ทุกห้อง</option>'+ data.rooms.map(function(r){ return '<option value="'+esc(r)+'" '+(data.selected===r?'selected':'')+'>'+esc(r)+'</option>'; }).join('') + '</select></div>';
  };

  window.renderCourseOverview = function(){
    var table = document.getElementById('course-summary-table'); if(!table) return; table.innerHTML='';
    var cid = window.currentActiveCourseId;
    var overview = getOverviewStudents(cid);
    var courseStudents = overview.students;
    window.renderOverviewRoomFilter();
    if(!cid || courseStudents.length===0){ var empty=document.getElementById('empty-summary'); if(empty) empty.classList.remove('hidden'); return; }
    var empty=document.getElementById('empty-summary'); if(empty) empty.classList.add('hidden');
    var history = (state.attendance && state.attendance[cid]) || {}; var attDates = Object.keys(history);
    var plans = ((state.coursePlans && state.coursePlans[cid]) || []).sort((a,b)=>Number(a.week)-Number(b.week));
    var courseScores = (state.scores||[]).filter(s=>s.courseId===cid);
    var gradeCriteria = (state.courseGrades && state.courseGrades[cid]) ? state.courseGrades[cid] : (window.defaultGradeCriteria || []);
    var totalMax=0;
    var thead='<thead><tr><th class="sticky summary-sticky-no summary-no-col bg-slate-50 z-20 border-r text-center align-middle">ลำดับ</th><th class="sticky summary-sticky-code summary-code-col bg-slate-50 z-20 border-r text-center align-middle">รหัสนักเรียน</th><th class="sticky summary-sticky-name summary-name-col bg-slate-50 z-20 border-r text-center align-middle">ชื่อ - นามสกุล</th><th class="text-center bg-slate-100 text-slate-600">ชั้น/ห้อง</th>';
    thead += '<th class="text-center bg-emerald-50 text-emerald-700 summary-att-col">เช็คชื่อ<br><span class="text-[9px]">มา/สาย/ขาด</span></th>';
    plans.forEach(function(p){ var isChecklist=Number(p.maxScore)===0; var subtitle=isChecklist?'เช็คงาน':'เต็ม '+window.formatScoreDisplay(p.maxScore,2); thead += '<th class="text-center bg-indigo-50 text-indigo-700 summary-score-col" title="คลิกเพื่อดูรายละเอียด: สัปดาห์ '+esc(p.week)+' | '+esc(p.title)+' | '+esc(subtitle)+'"><button type="button" onclick="showPlanDetail(\''+cid+'\', \''+p.id+'\')" class="week-detail-btn inline-flex items-center justify-center bg-white border border-indigo-200 text-primary font-bold hover:bg-primary hover:text-white transition shadow-sm">'+esc(p.week)+'</button></th>'; if(!isChecklist) totalMax = window.addScoreToTotal(totalMax, p.maxScore, 2); });
    thead += '<th class="text-center bg-slate-800 text-white font-bold summary-total-col">รวม<br><span class="text-[9px] text-slate-300">'+window.formatScoreDisplay(totalMax,2)+'</span></th><th class="text-center bg-amber-50 text-amber-700 font-bold summary-grade-col">เกรด</th></tr></thead>';
    var tbody='<tbody>';
    courseStudents.forEach(function(st,index){
      var pr=0,la=0,ab=0; attDates.forEach(function(d){ var rec=history[d]&&history[d].records||{}; var x=rec[st.id]; if(x==='present')pr++; else if(x==='late')la++; else if(x==='absent')ab++; });
      tbody += '<tr class="'+(window.getStudentWithdrawnRowClass?window.getStudentWithdrawnRowClass(st):'')+'"><td class="sticky summary-sticky-no summary-no-col bg-white z-20 border-r text-center"><span class="schoolhub-seq-text'+(window.getStudentWithdrawnClass?window.getStudentWithdrawnClass(st):'')+'">#'+(index+1)+'</span></td><td class="sticky summary-sticky-code summary-code-col bg-white z-20 border-r font-mono text-slate-700'+(window.getStudentWithdrawnClass?window.getStudentWithdrawnClass(st):'')+'">'+esc(st.code)+'</td><td class="sticky summary-sticky-name summary-name-col bg-white z-20 border-r font-bold text-slate-700'+(window.getStudentWithdrawnClass?window.getStudentWithdrawnClass(st):'')+'">'+esc(st.name)+(window.getStudentWithdrawnBadge?window.getStudentWithdrawnBadge(st):'')+'</td><td class="text-center text-xs font-bold text-slate-500 bg-slate-50">'+esc(className(st))+'</td>';
      tbody += '<td class="text-center font-bold summary-att-col"><span class="text-emerald-500">'+pr+'</span>/<span class="text-amber-500">'+la+'</span>/<span class="text-rose-500">'+ab+'</span></td>';
      var total=0;
      plans.forEach(function(p){ var task=courseScores.find(ts=>ts.week==p.week && ts.title===p.title); var raw=task && task.records ? task.records[st.id] : null; var isChecklist=Number(p.maxScore)===0; if(isChecklist){ var icon= raw===1 ? '<span class="summary-score-cell-content text-emerald-500"><i class="fas fa-check"></i></span>' : (raw===0 ? '<span class="summary-score-cell-content text-rose-300"><i class="fas fa-times"></i></span>' : '<span class="summary-score-cell-content text-slate-300">-</span>'); tbody += '<td class="text-center summary-score-col">'+icon+'</td>'; } else { total = window.addScoreToTotal(total, raw, 2); var disp=!task?'<span class="summary-score-cell-content text-slate-300">-</span>':((window.isMissingScoreValue ? window.isMissingScoreValue(raw) : raw==='')?'<span class="summary-score-cell-content text-rose-600 font-black">X</span>':'<span class="summary-score-cell-content text-slate-700">'+esc(window.formatScoreDisplay(raw,2))+'</span>'); tbody += '<td class="text-center font-mono summary-score-col">'+disp+'</td>'; }});
      var grade='-', color='text-slate-400';
      if(totalMax>0){
        var gradeCourse=(state.courses||[]).find(function(c){return String(c.id)===String(cid);}) || {id:cid, gradeCriteria:gradeCriteria};
        grade = window.getFinalGradeForStudent(gradeCourse, st, window.normalizeScoreNumber(total,2));
        color = (typeof window.schoolhubGradeColor === 'function') ? window.schoolhubGradeColor(grade, (window.getCourseGradeCriteria ? window.getCourseGradeCriteria(gradeCourse) : gradeCriteria)) : color;
        if(color === 'text-slate-400') { if(['4','3.5','A','B+'].includes(grade)) color='text-emerald-500'; else if(['3','2.5','B','C+','C'].includes(grade)) color='text-blue-500'; else if(['2','1.5','D+','D'].includes(grade)) color='text-amber-500'; else if(['1','0','F'].includes(grade)) color='text-rose-500'; }
      }
      tbody += '<td class="text-center font-bold text-primary bg-slate-50 border-r summary-total-col">'+window.formatScoreDisplay(total,2)+'</td><td class="text-center font-bold '+color+' bg-amber-50/30 summary-grade-col">'+esc(grade)+'</td></tr>';
    });
    tbody+='</tbody>'; table.innerHTML=thead+tbody;
  };

  window.renderStudentsMaster = function(){
    var tbody=document.getElementById('student-list-master'); if(!tbody) return;
    var students=(state.students||[]).slice(); tbody.innerHTML='';
    var empty=document.getElementById('empty-student-master');
    if(!students.length){ if(empty) empty.classList.remove('hidden'); return; } if(empty) empty.classList.add('hidden');
    var rooms={}; students.forEach(function(st){ var r=className(st); (rooms[r]||(rooms[r]=[])).push(st); });
    var __shCanEditStudentCard = (typeof window.currentPlanAllows === 'function') ? window.currentPlanAllows('edit') : true;
    Object.keys(rooms).sort((a,b)=>a.localeCompare(b,'th',{numeric:true})).forEach(function(room){
      var list=rooms[room].sort((a,b)=>String(a.code||'').localeCompare(String(b.code||''),'th',{numeric:true}) || String(a.name||'').localeCompare(String(b.name||''),'th'));
      var cards=list.map(function(st){ return '<div class="bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md rounded-2xl p-4 transition '+(window.getStudentWithdrawnRowClass?window.getStudentWithdrawnRowClass(st):'')+'"><div class="flex items-start justify-between gap-3"><button type="button" data-right="edit" data-action-name="แก้ไขข้อมูลนักเรียน" data-permission-allowed="'+(__shCanEditStudentCard?'1':'0')+'" aria-disabled="'+(__shCanEditStudentCard?'false':'true')+'" onclick="editStudent(\''+st.id+'\')" class="text-left flex-1 min-w-0 '+(__shCanEditStudentCard?'':'sh-permission-disabled opacity-50 cursor-not-allowed')+'"><div class="font-black text-slate-800 '+(window.getStudentWithdrawnClass?window.getStudentWithdrawnClass(st):'')+'">'+esc(st.name)+(window.getStudentWithdrawnBadge?window.getStudentWithdrawnBadge(st):'')+'</div><div class="text-xs font-mono text-slate-400 mt-1 '+(window.getStudentWithdrawnClass?window.getStudentWithdrawnClass(st):'')+'">'+esc(st.code)+'</div></button><button type="button" onclick="showStudentMoreMenu(\''+st.id+'\', this)" class="text-slate-600 bg-slate-100 rounded-xl px-3 h-9 text-xs font-black hover:bg-slate-200">อื่นๆ</button></div></div>'; }).join('');
      tbody.innerHTML += '<tr><td colspan="4" class="p-4 bg-slate-50/60"><div class="bg-indigo-50/80 border border-indigo-100 rounded-3xl p-4"><div class="flex items-center justify-between mb-4"><div class="font-black text-primary text-lg"><i class="fas fa-door-open mr-2"></i>'+esc(room)+'</div><div class="text-xs font-bold text-indigo-500 bg-white px-3 py-1 rounded-full">'+list.length+' คน</div></div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">'+cards+'</div></div></td></tr>';
    });
  };


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
    var cid=window.currentActiveCourseId; if(!cid) return showCustomAlert('ผิดพลาด','กรุณาเลือกรายวิชา',true);
    var all=allStudentsForCourse(cid); if(!all.length) return showCustomAlert('ผิดพลาด','ไม่มีข้อมูลนักเรียนในวิชานี้',true);
    var course=(state.courses||[]).find(c=>c.id===cid)||{}; var cName=course.name||'Unknown';
    var history=(state.attendance&&state.attendance[cid])||{}; var attDates=Object.keys(history);
    var plans=((state.coursePlans&&state.coursePlans[cid])||[]).sort((a,b)=>Number(a.week)-Number(b.week));
    var courseScores=(state.scores||[]).filter(s=>s.courseId===cid);
    var gradeCriteria=(state.courseGrades&&state.courseGrades[cid])?state.courseGrades[cid]:(window.defaultGradeCriteria||[]);
    var rooms={}; all.forEach(st=>{ var r=className(st); (rooms[r]||(rooms[r]=[])).push(st); });
    var sheets={};
    Object.keys(rooms).sort((a,b)=>a.localeCompare(b,'th',{numeric:true})).forEach(function(room){
      var list=rooms[room].sort((a,b)=>String(a.code||'').localeCompare(String(b.code||''),'th',{numeric:true}));
      var aoa=[[`สรุปภาพรวมวิชา: ${cName}`],[`ชั้น/ห้อง: ${room}`],[]]; var header=['รหัส','ชื่อ','ชั้น/ห้อง','มา','สาย','ขาด']; var tMax=0;
      plans.forEach(function(p){ var isChecklist=Number(p.maxScore)===0; header.push(`${p.title}(${isChecklist?'เช็คงาน':'เต็ม '+window.formatScoreDisplay(p.maxScore,2)})`); if(!isChecklist) tMax = window.addScoreToTotal(tMax, p.maxScore, 2); }); header.push(`รวมคะแนน(เต็ม ${window.formatScoreDisplay(tMax, 2)})`,'เกรดที่ได้'); aoa.push(header);
      list.forEach(function(st){ var pr=0,la=0,ab=0; attDates.forEach(function(d){ var rec=history[d]&&history[d].records||{}; var x=rec[st.id]; if(x==='present')pr++; else if(x==='late')la++; else if(x==='absent')ab++; }); var row=[st.code,st.name,room,pr,la,ab]; var total=0; plans.forEach(function(p){ var task=courseScores.find(ts=>ts.week==p.week && ts.title===p.title); var raw=task&&task.records?task.records[st.id]:null; if(Number(p.maxScore)===0){ row.push(raw===1?'ส่งแล้ว':(raw===0?'ยังไม่ส่ง':'-')); } else { total = window.addScoreToTotal(total, raw, 2); row.push(!task?'-':((window.isMissingScoreValue ? window.isMissingScoreValue(raw) : raw==='')?'ขาดส่ง':window.normalizeScoreNumber(raw,2))); }}); row.push(window.normalizeScoreNumber(total,2)); row.push(tMax>0 ? window.getFinalGradeForStudent(course, st, window.normalizeScoreNumber(total,2)) : '-'); aoa.push(row); });
      var sheetName=String(room||'ชั้น').replace(/[\\/?*\[\]:]/g,' ').slice(0,31) || 'ชั้น'; sheets[sheetName]=aoa;
    });
    window.downloadExcelMultiSheet(sheets, `ภาพรวม_${cName}_แยกชั้น`);
  };

  var oldSwitch = window.switchCourseTab;
  if (oldSwitch) window.switchCourseTab = function(tabId){ oldSwitch(tabId); if(tabId==='overview') setTimeout(function(){ try{renderOverviewRoomFilter();}catch(e){} },50); };

  /* Patch: block must not delete data, global admin credentials, team plan controls */
  const SCHOOLHUB_ADMIN_CONFIG_PATH = ['schoolhub_system','admin_config'];
  async function getSystemAdminConfig_(){
    try{ const snap = await getDoc(doc(db, SCHOOLHUB_ADMIN_CONFIG_PATH[0], SCHOOLHUB_ADMIN_CONFIG_PATH[1])); return snap.exists() ? (snap.data()||{}) : {}; }
    catch(e){ console.warn('getSystemAdminConfig failed', e); return {}; }
  }
  async function setSystemAdminConfig_(payload){
    await setDoc(doc(db, SCHOOLHUB_ADMIN_CONFIG_PATH[0], SCHOOLHUB_ADMIN_CONFIG_PATH[1]), Object.assign({}, payload, {updatedAt:Date.now()}), {merge:true});
  }

  const __oldEnterAdminModeGlobal = window.enterAdminMode;
  window.enterAdminMode = async function(){
    try{
      const cfg = await getSystemAdminConfig_();
      if(cfg && cfg.name) localStorage.setItem('schoolhub_admin_name', cfg.name);
      if(cfg && cfg.password){ localStorage.setItem('schoolhub_admin_password', cfg.password); localStorage.setItem('schoolhub_admin_default_disabled','true'); }
    }catch(e){}
    return __oldEnterAdminModeGlobal();
  };

  const __oldSaveUserProfileGlobalAdmin = window.saveUserProfileChanges;
  window.saveUserProfileChanges = async function(){
    if(currentUser?.uid !== 'admin-bypass') return __oldSaveUserProfileGlobalAdmin();
    const newName = (document.getElementById('profile-display-name-input')?.value || '').trim();
    const newAdminPass = (document.getElementById('admin-profile-password-input')?.value || '').trim();
    if(!newName) return showCustomAlert('กรุณากรอกชื่อ','ชื่อที่แสดงห้ามว่าง',true);
    if(newAdminPass && newAdminPass.length < 6) return showCustomAlert('รหัสผ่านสั้นเกินไป','รหัสผ่าน Admin ต้องมีอย่างน้อย 6 ตัวอักษร',true);
    if(newAdminPass === 'Admin123') return showCustomAlert('ห้ามใช้รหัสเริ่มต้น','รหัส Admin123 ใช้ได้เฉพาะก่อนตั้งค่าครั้งแรกเท่านั้น',true);
    toggleLoader(true);
    try{
      const payload = {name:newName, defaultDisabled:true};
      if(newAdminPass) payload.password = newAdminPass;
      await setSystemAdminConfig_(payload);
      localStorage.setItem('schoolhub_admin_name', newName);
      if(newAdminPass){ localStorage.setItem('schoolhub_admin_password', newAdminPass); localStorage.setItem('schoolhub_admin_default_disabled','true'); }
      currentUser.displayName = newName;
      document.getElementById('user-display-name').textContent = newName;
      document.getElementById('user-avatar-initial').textContent = newName.charAt(0).toUpperCase();
      closeModal('user-profile-modal'); showCustomAlert('บันทึกสำเร็จ','แก้ไขชื่อ/รหัสผ่าน Admin ในระบบเรียบร้อยแล้ว');
    }catch(e){ showCustomAlert('บันทึก Admin ไม่สำเร็จ', getFirebaseErrorText(e), true); }
    toggleLoader(false);
  };

  window.executeUserStatusUpdate = async function(uid, userKey, status){
    try{
      toggleLoader(true);
      const blocked = status === 'blocked' || status === 'deleted';
      const payload = blocked ? {status:'blocked', blocked:true, blockedAt:Date.now(), deletedAt:null} : {status:'active', blocked:false, blockedAt:null, deletedAt:null};
      const emailKey = isSchoolHubValidEmail(userKey) ? normalizeSchoolHubEmail(userKey) : (isSchoolHubValidEmail(uid) ? normalizeSchoolHubEmail(uid) : '');
      if(emailKey) await setDoc(doc(db, getPublicPath(), emailKey), payload, { merge:true });
      if(emailKey) await setDoc(doc(db, 'users_status', emailKey), payload, { merge:true });
      await loadAdminData();
      showCustomAlert(blocked?'บล็อกแล้ว':'ปลดบล็อกแล้ว', blocked?'ผู้ใช้นี้ยังอยู่ในรายชื่อ ข้อมูลไม่ถูกลบ และจะเข้าใช้งานไม่ได้':'ผู้ใช้นี้กลับมาใช้งานได้แล้ว');
    }catch(e){ showCustomAlert('เปลี่ยนสถานะไม่ได้', getFirebaseErrorText(e), true); }
    toggleLoader(false);
  };
  window.updateUserStatus = function(uid, userKey, status){
    const target = (status === 'deleted' || status === 'blocked') ? 'blocked' : 'active';
    if(target === 'blocked') window.showCustomConfirm('บล็อกผู้ใช้','บล็อกเฉพาะการใช้งาน ไม่ลบข้อมูล และผู้ใช้ที่ออนไลน์อยู่จะถูกเด้งออก ต้องการทำต่อหรือไม่?',()=>executeUserStatusUpdate(uid,userKey,target));
    else executeUserStatusUpdate(uid,userKey,target);
  };

  const __oldLoadAdminDataBlock = window.loadAdminData;
  window.loadAdminData = async function(){
    const tbody = document.getElementById('admin-user-list');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลดข้อมูลผู้ใช้...</td></tr>';
    try{
      if (!Array.isArray(adminPlanRequests) || adminPlanRequests.length === 0) { try { await window.loadPlanRequests(); } catch(e){} }
      const querySnapshot = await getDocs(collection(db, getPublicPath()));
      let rows=''; window.__adminUsersByUid = {};
      querySnapshot.forEach((d)=>{
        const u=d.data()||{}; const uid=u.uid||d.id; window.__adminUsersByUid[uid]={...u,uid};
        const isBlocked = ['blocked','deleted'].includes(u.status) || u.blocked === true;
        const displayKey=u.userKey||u.email||uid; const safeKey=String(displayKey).replace(/'/g,"\\'");
        const userRequests=getRequestsForUser(u,uid); const pendingRequests=userRequests.filter(r=>r.status==='pending');
        const roleBadge = u.role==='admin' ? '<span class="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">Admin</span>' : (isBlocked?'<span class="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-black">บล็อก</span>':(pendingRequests.length?'<span class="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold">มีคำขอแผน</span>':'<span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs">User</span>'));
        let planBadge='';
        if(u.role==='admin') planBadge='<span class="text-xs text-slate-400">-</span>';
        else if(pendingRequests.length){ const latest=pendingRequests[0]; planBadge=`<button onclick="openPlanRequestPopup('${uid}')" class="clickable-plan-cell inline-flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-full text-xs font-black border border-amber-200"><i class="fas fa-bell animate-pulse"></i> ${escapeHTML(latest.planName||'คำขอแผน')}</button>`; }
        else if(userRequests.length){ const latest=userRequests[0]; const cls=latest.status==='approved'?'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border-emerald-200':'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'; planBadge=`<button onclick="openPlanRequestPopup('${uid}')" class="clickable-plan-cell inline-flex items-center gap-2 ${cls} px-3 py-1.5 rounded-full text-xs font-bold border">${escapeHTML(u.planName||latest.planName||'ดูประวัติแผน')}</button>`; }
        else if(u.planName) planBadge=`<span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">${escapeHTML(u.planName)}</span>`;
        else planBadge='<span class="text-xs text-slate-400">ยังไม่กำหนด</span>';
        const actionBtn = u.role==='admin'?'':`<button onclick="updateUserStatus('${uid}', '${safeKey}', '${isBlocked?'active':'blocked'}')" class="${isBlocked?'text-emerald-600 bg-emerald-50 border-emerald-100':'text-rose-600 bg-rose-50 border-rose-100'} px-3 py-1 rounded-lg text-sm font-bold border"><i class="fas ${isBlocked?'fa-unlock':'fa-ban'}"></i> ${isBlocked?'ปลดบล็อก':'บล็อก'}</button>`;
        rows += `<tr class="${isBlocked?'bg-rose-50/30':''}"><td class="font-bold text-slate-700">${escapeHTML(u.name||'ไม่มีชื่อ')}<br><span class="text-xs font-normal text-slate-400 font-mono">${escapeHTML(displayKey)}</span>${isBlocked?'<div class="text-[11px] text-rose-500 font-bold mt-1">ถูกบล็อก ข้อมูลยังคงอยู่</div>':''}</td><td class="text-center">${planBadge}</td><td class="text-center">${roleBadge}</td><td class="text-right">${actionBtn}</td></tr>`;
      });
      tbody.innerHTML = rows || '<tr><td colspan="4" class="text-center p-8 text-slate-400">ยังไม่มีข้อมูลผู้ใช้</td></tr>';
    }catch(e){ tbody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-rose-500">โหลดข้อมูลผู้ใช้ไม่ได้<br><span class="text-xs text-slate-500">${escapeHTML(e.message||String(e))}</span></td></tr>`; }
    finally{ setTimeout(updateSmartScrollbars,80); }
  };

  async function forceLogoutIfBlocked_(){
    try{
      if(!auth.currentUser || currentUser?.uid === 'admin-bypass') return;
      const key = auth.currentUser.email || getUserKey(auth.currentUser);
      const s = await getDoc(doc(db, 'users_status', key));
      const p = await getDoc(doc(db, getPublicPath(), auth.currentUser.uid));
      const sd=s.exists()?s.data():{}; const pd=p.exists()?p.data():{};
      if(['blocked','deleted'].includes(sd.status)||sd.blocked===true||['blocked','deleted'].includes(pd.status)||pd.blocked===true){
        await signOut(auth);
        currentUser=null; isAdmin=false; localStorage.removeItem('schoolhub_admin_bypass');
        document.getElementById('main-app')?.classList.add('hidden'); document.getElementById('auth-view')?.classList.remove('hidden');
        showCustomAlert('บัญชีถูกบล็อก','บัญชีนี้ถูกบล็อกโดยผู้ดูแลระบบ จึงถูกออกจากระบบทันที',true);
      }
    }catch(e){}
  }
  setInterval(forceLogoutIfBlocked_, 5000);


})();
