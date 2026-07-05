
(function(){
  if(window.__schoolhubAutoRoomPreviewSelectorFinal) return;
  window.__schoolhubAutoRoomPreviewSelectorFinal = true;

  function esc(v){
    if(window.escapeHTML) return window.escapeHTML(v == null ? '' : v);
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});
  }
  function unique(arr){
    var out=[];
    (arr||[]).forEach(function(v){
      if(Array.isArray(v)){ v.forEach(function(x){ var t=String(x==null?'':x).trim(); if(t && out.indexOf(t)<0) out.push(t); }); return; }
      var t=String(v==null?'':v).trim();
      if(!t || t==='-' || t==='undefined' || t==='null') return;
      if(out.indexOf(t)<0) out.push(t);
    });
    return out.sort(function(a,b){return a.localeCompare(b,'th',{numeric:true});});
  }
  function courses(){ try{return (window.state && Array.isArray(state.courses)) ? state.courses : [];}catch(e){return [];} }
  function students(){ try{return (window.state && Array.isArray(state.students)) ? state.students : [];}catch(e){return [];} }
  function studentRoom(st){
    try{
      var v = window.getStudentClassName ? window.getStudentClassName(st) : (st && (st.room || st.classroom || st.grade || st.className));
      return String(v==null?'':v).trim();
    }catch(e){return '';}
  }
  function courseById(id){ return courses().find(function(c){return c && String(c.id)===String(id);}) || null; }
  function selectedRoomsFromCourse(course){
    if(!course) return [];
    var rooms=[];
    ['studentRooms','studentGrades','rooms','grades','classes','classrooms','selectedRooms','selectedGrades'].forEach(function(k){
      if(Array.isArray(course[k])) rooms = rooms.concat(course[k]);
      else if(typeof course[k] === 'string') rooms = rooms.concat(course[k].split(/[,|،]/));
    });
    return unique(rooms);
  }
  function courseStudents(course){
    if(!course) return [];
    var rooms=selectedRoomsFromCourse(course);
    var extraIds=Array.isArray(course.extraStudentIds) ? course.extraStudentIds.map(String) : [];
    if(!rooms.length && !extraIds.length) return [];
    return students().filter(function(st){
      return rooms.indexOf(studentRoom(st))>=0 || extraIds.indexOf(String(st.id))>=0;
    });
  }
  function roomsForCourse(course){
    var direct=selectedRoomsFromCourse(course);
    if(direct.length) return direct;
    return unique(courseStudents(course).map(studentRoom));
  }
  function currentCourseId(){
    if(window.currentActiveCourseId) return window.currentActiveCourseId;
    var sel=document.getElementById('att-course-select') || document.getElementById('score-course-select');
    if(sel && sel.value) return sel.value;
    return '';
  }

  window.__overviewRoomFilter = window.__overviewRoomFilter || {};

  window.renderOverviewRoomFilter = function(){
    var box=document.getElementById('overview-room-filter');
    if(!box) return;
    var cid=currentCourseId();
    var course=courseById(cid);
    var rooms=roomsForCourse(course);

    if(!cid || rooms.length<=1){
      box.classList.add('hidden','schoolhub-room-filter-hidden');
      box.classList.remove('schoolhub-room-filter-ready');
      box.innerHTML='';
      return;
    }

    var selected=window.__overviewRoomFilter[cid] || 'all';
    if(selected !== 'all' && rooms.indexOf(selected)<0) selected='all';
    window.__overviewRoomFilter[cid]=selected;

    box.classList.remove('hidden','schoolhub-room-filter-hidden');
    box.classList.add('schoolhub-room-filter-ready');
    box.innerHTML = '<div class="schoolhub-room-selector-mini">'+
      '<span class="schoolhub-room-selector-mini-label"><i class="fas fa-door-open"></i> เลือกห้อง</span>'+
      '<select onchange="window.__overviewRoomFilter[\''+esc(cid)+'\']=this.value; if(typeof window.renderCourseOverview===\'function\') window.renderCourseOverview();">'+
      '<option value="all" '+(selected==='all'?'selected':'')+'>ทุกห้อง</option>'+rooms.map(function(r){return '<option value="'+esc(r)+'" '+(selected===r?'selected':'')+'>'+esc(r)+'</option>';}).join('')+
      '</select></div>';
  };

  function applyOverviewFilter(){
    var cid=currentCourseId();
    var course=courseById(cid);
    var rooms=roomsForCourse(course);
    if(!cid || rooms.length<=1) return;
    var selected=window.__overviewRoomFilter[cid] || 'all';
    if(selected==='all') return;

    var table=document.getElementById('course-summary-table');
    if(!table) return;
    var visible=1;
    Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function(row){
      var cells=row.children || [];
      var code=(cells[1] ? (cells[1].innerText || cells[1].textContent || '') : '').replace(/^#?\d+\s*/,'').trim();
      var st=students().find(function(x){return String(x.code||'').trim()===code;});
      var show=st ? studentRoom(st)===selected : true;
      row.style.display=show?'':'none';
      if(show && cells[0]) cells[0].innerHTML='<span class="schoolhub-seq-text">#'+(visible++)+'</span>';
    });
  }

  function decorateCourseRoomPreviews(){
    var grid=document.getElementById('course-grid');
    if(!grid) return;
    var list=courses();
    Array.prototype.slice.call(grid.children||[]).forEach(function(card,idx){
      var id='';
      var onclick=card.getAttribute('onclick')||'';
      var m=onclick.match(/enterCourse\(['\"]([^'\"]+)['\"]\)/);
      if(m) id=m[1];
      if(!id){
        var btn=card.querySelector('[onclick*="enterCourse"]');
        if(btn){ var mm=(btn.getAttribute('onclick')||'').match(/enterCourse\(['\"]([^'\"]+)['\"]\)/); if(mm) id=mm[1]; }
      }
      var course=id ? courseById(id) : list[idx];
      if(!course) return;
      var rooms=roomsForCourse(course);
      var old=card.querySelector('.schoolhub-course-room-preview');
      if(old) old.remove();
      if(!rooms.length) return;
      var anchor=card.querySelector('h3') || card.querySelector('.font-black') || card.querySelector('.font-bold');
      if(!anchor) return;
      var div=document.createElement('div');
      div.className='schoolhub-course-room-preview';
      div.innerHTML='<i class="fas fa-door-open"></i><span>'+esc(rooms.join(', '))+'</span>';
      anchor.insertAdjacentElement('afterend', div);
    });
  }

  function afterOverview(){
    try{ window.renderOverviewRoomFilter(); }catch(e){}
    try{ applyOverviewFilter(); }catch(e){}
    try{ if(window.buildMobileOverviewCards) window.buildMobileOverviewCards(); }catch(e){}
  }

  function afterDashboard(){
    try{ decorateCourseRoomPreviews(); }catch(e){}
  }

  if(typeof window.renderCourseOverview==='function' && !window.renderCourseOverview.__schoolhubFinalAutoRoomWrapped){
    var oldOverview=window.renderCourseOverview;
    var wrapOverview=function(){
      var r=oldOverview.apply(this, arguments);
      afterOverview();
      setTimeout(afterOverview,60);
      setTimeout(afterOverview,220);
      return r;
    };
    wrapOverview.__schoolhubFinalAutoRoomWrapped=true;
    window.renderCourseOverview=wrapOverview;
  }
  if(typeof window.renderCourseGrid==='function' && !window.renderCourseGrid.__schoolhubFinalAutoRoomWrapped){
    var oldGrid=window.renderCourseGrid;
    var wrapGrid=function(){
      var r=oldGrid.apply(this, arguments);
      afterDashboard();
      setTimeout(afterDashboard,80);
      setTimeout(afterDashboard,300);
      return r;
    };
    wrapGrid.__schoolhubFinalAutoRoomWrapped=true;
    window.renderCourseGrid=wrapGrid;
  }
  if(typeof window.enterCourse==='function' && !window.enterCourse.__schoolhubFinalAutoRoomWrapped){
    var oldEnter=window.enterCourse;
    var wrapEnter=function(){
      var r=oldEnter.apply(this, arguments);
      setTimeout(afterOverview,60);
      setTimeout(afterOverview,250);
      return r;
    };
    wrapEnter.__schoolhubFinalAutoRoomWrapped=true;
    window.enterCourse=wrapEnter;
  }

  document.addEventListener('DOMContentLoaded',function(){
    afterDashboard();
    afterOverview();
    var n=0;
    var timer=setInterval(function(){
      afterDashboard();
      afterOverview();
      if(++n>30) clearInterval(timer);
    },500);
    var grid=document.getElementById('course-grid');
    if(grid && window.MutationObserver){
      new MutationObserver(function(){ setTimeout(afterDashboard,50); }).observe(grid,{childList:true,subtree:true});
    }
  });
  document.addEventListener('click',function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(afterDashboard,80); setTimeout(afterOverview,80); },true);
})();
