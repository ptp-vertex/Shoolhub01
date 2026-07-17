
(function(){
  if(window.__schoolhubOverviewRoomSelectorBesideExcelFinal) return;
  window.__schoolhubOverviewRoomSelectorBesideExcelFinal = true;
  function esc(v){
    if(window.escapeHTML) return window.escapeHTML(v == null ? '' : v);
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});
  }
  function courses(){try{return window.state && Array.isArray(state.courses) ? state.courses : [];}catch(e){return [];}}
  function students(){try{return window.state && Array.isArray(state.students) ? state.students : [];}catch(e){return [];}}
  function currentCourseId(){
    if(window.currentActiveCourseId) return window.currentActiveCourseId;
    var sel=document.getElementById('att-course-select') || document.getElementById('score-course-select');
    return sel && sel.value ? sel.value : '';
  }
  function courseById(id){return courses().find(function(c){return c && String(c.id)===String(id);}) || null;}
  function unique(arr){var out=[];(arr||[]).forEach(function(v){if(Array.isArray(v)){v.forEach(function(x){var t=String(x==null?'':x).trim(); if(t&&t!=='-'&&out.indexOf(t)<0) out.push(t);});return;} var t=String(v==null?'':v).trim(); if(t&&t!=='-'&&t!=='undefined'&&t!=='null'&&out.indexOf(t)<0) out.push(t);}); return out.sort(function(a,b){return a.localeCompare(b,'th',{numeric:true});});}
  function studentRoom(st){try{return String(window.getStudentClassName ? window.getStudentClassName(st) : (st && (st.room||st.classroom||st.grade||st.className)) || '').trim();}catch(e){return '';}}
  function selectedRoomsFromCourse(course){
    if(!course) return [];
    var rooms=[];
    ['studentRooms','studentGrades','rooms','grades','classes','classrooms','selectedRooms','selectedGrades'].forEach(function(k){
      if(Array.isArray(course[k])) rooms=rooms.concat(course[k]);
      else if(typeof course[k]==='string') rooms=rooms.concat(course[k].split(/[,|،]/));
    });
    return unique(rooms);
  }
  function roomsForCourse(course){
    var direct=selectedRoomsFromCourse(course);
    if(direct.length) return direct;
    var extraIds=Array.isArray(course&&course.extraStudentIds) ? course.extraStudentIds.map(String) : [];
    if(!course || !extraIds.length) return [];
    return unique(students().filter(function(st){return extraIds.indexOf(String(st.id))>=0;}).map(studentRoom));
  }
  function ensureSelectorPosition(){
    var box=document.getElementById('overview-room-filter');
    var exportBtn=document.querySelector('#course-tab-overview button[onclick="exportScoresToExcel()"]');
    if(box && exportBtn && exportBtn.parentElement && box.parentElement!==exportBtn.parentElement){
      exportBtn.insertAdjacentElement('afterend', box);
    }
  }
  window.__overviewRoomFilter = window.__overviewRoomFilter || {};
  window.renderOverviewRoomFilter = function(){
    ensureSelectorPosition();
    var box=document.getElementById('overview-room-filter');
    var cid=currentCourseId();
    if(!box || !cid) return;
    var rooms=roomsForCourse(courseById(cid));
    if(!cid || rooms.length<=1){
      box.classList.add('hidden','schoolhub-room-filter-hidden');
      box.classList.remove('schoolhub-room-filter-ready');
      box.innerHTML='';
      return;
    }
    if(window.__schoolhubRoomSelectActive && box.querySelector('select')) return;
    var selected=window.__overviewRoomFilter[cid] || 'all';
    if(selected!=='all' && rooms.indexOf(selected)<0) selected='all';
    window.__overviewRoomFilter[cid]=selected;
    box.classList.remove('hidden','schoolhub-room-filter-hidden');
    box.classList.add('schoolhub-room-filter-ready');
    box.innerHTML='<div class="schoolhub-room-selector-mini">'+
      '<span class="schoolhub-room-selector-mini-label"><i class="fas fa-door-open"></i> เลือกห้อง</span>'+ 
      '<select onpointerdown="window.__schoolhubRoomSelectActive=true;" onmousedown="window.__schoolhubRoomSelectActive=true;" onfocus="window.__schoolhubRoomSelectActive=true;" onblur="setTimeout(function(){window.__schoolhubRoomSelectActive=false;},120);" onchange="window.__schoolhubRoomSelectActive=false; window.__overviewRoomFilter[\''+esc(cid)+'\']=this.value; if(typeof window.renderCourseOverview===\'function\') window.renderCourseOverview();">'+
      '<option value="all" '+(selected==='all'?'selected':'')+'>ทุกห้อง</option>'+rooms.map(function(r){return '<option value="'+esc(r)+'" '+(selected===r?'selected':'')+'>'+esc(r)+'</option>';}).join('')+
      '</select></div>';
  };
  setTimeout(function(){ensureSelectorPosition(); if(typeof window.renderOverviewRoomFilter==='function') window.renderOverviewRoomFilter();},100);
  document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){ensureSelectorPosition(); if(typeof window.renderOverviewRoomFilter==='function') window.renderOverviewRoomFilter();},300);});
})();
