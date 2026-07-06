
(function(){
  if(window.__schoolhubOverviewRoomSelectorCardPreviewFix) return;
  window.__schoolhubOverviewRoomSelectorCardPreviewFix = true;

  function esc(v){
    if(window.escapeHTML) return window.escapeHTML(v == null ? '' : v);
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});
  }
  function courseById(id){
    try{return (window.state && Array.isArray(state.courses) ? state.courses : []).find(function(c){return c && c.id === id;}) || null;}catch(e){return null;}
  }
  function studentClassName(st){
    try{return (window.getStudentClassName ? window.getStudentClassName(st) : (st && (st.room || st.classroom || st.grade || st.className))) || '';}catch(e){return '';}
  }
  function unique(arr){
    var out=[];
    (arr||[]).forEach(function(v){v=String(v == null ? '' : v).trim(); if(v && out.indexOf(v) < 0) out.push(v);});
    return out.sort(function(a,b){return a.localeCompare(b,'th',{numeric:true});});
  }
  function getSelectedRoomsForCourse(course){
    if(!course) return [];
    var rooms=[];
    if(Array.isArray(course.studentRooms)) rooms = rooms.concat(course.studentRooms);
    if(Array.isArray(course.studentGrades)) rooms = rooms.concat(course.studentGrades);
    return unique(rooms);
  }
  function getStudentsForCourse(course){
    if(!course || !window.state || !Array.isArray(state.students)) return [];
    var rooms=getSelectedRoomsForCourse(course);
    var extraIds=Array.isArray(course.extraStudentIds) ? course.extraStudentIds : [];
    return state.students.filter(function(st){return rooms.indexOf(studentClassName(st)) >= 0 || extraIds.indexOf(st.id) >= 0;});
  }
  function getRoomsForOverview(courseId){
    var course=courseById(courseId);
    var rooms=getSelectedRoomsForCourse(course);
    if(rooms.length) return rooms;
    return unique(getStudentsForCourse(course).map(studentClassName));
  }

  window.__overviewRoomFilter = window.__overviewRoomFilter || {};

  window.renderOverviewRoomFilter = function(){
    var box=document.getElementById('overview-room-filter');
    var cid=window.currentActiveCourseId;
    if(!box || !cid) return;
    var rooms=getRoomsForOverview(cid);

    if(rooms.length <= 1){
      box.classList.add('hidden');
      box.innerHTML='';
      box.style.display='none';
      if(rooms.length === 1) window.__overviewRoomFilter[cid] = rooms[0];
      return;
    }

    var selected=window.__overviewRoomFilter[cid] || rooms[0];
    if(rooms.indexOf(selected) < 0) selected=rooms[0];
    window.__overviewRoomFilter[cid]=selected;

    box.style.display='block';
    box.classList.remove('hidden');
    box.innerHTML = ''+
      '<div class="bg-white rounded-2xl border border-indigo-100 shadow-sm p-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-2">'+
        '<button type="button" class="bg-primary text-white px-4 py-2 rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-default"><i class="fas fa-door-open"></i> เลือกห้อง</button>'+
        '<select class="bg-white border border-indigo-100 rounded-xl px-3 py-2 text-sm font-bold text-primary focus:ring-2 focus:ring-primary outline-none flex-1" onchange="window.__overviewRoomFilter[\''+esc(cid)+'\']=this.value; if(typeof renderCourseOverview===\'function\') renderCourseOverview();">'+
          rooms.map(function(r){return '<option value="'+esc(r)+'" '+(selected===r?'selected':'')+'>'+esc(r)+'</option>';}).join('')+
        '</select>'+
      '</div>';
  };

  function decorateCourseRoomPreviews(){
    var grid=document.getElementById('course-grid');
    if(!grid || !window.state || !Array.isArray(state.courses)) return;
    var cards=Array.prototype.slice.call(grid.children || []);
    cards.forEach(function(card){
      var onclick=card.getAttribute('onclick') || '';
      var m=onclick.match(/enterCourse\(['\"]([^'\"]+)['\"]\)/);
      if(!m) return;
      var course=courseById(m[1]);
      if(!course) return;
      var old=card.querySelector('.schoolhub-course-room-preview');
      if(old) old.remove();
      var rooms=getSelectedRoomsForCourse(course);
      if(!rooms.length) return;
      var title=card.querySelector('h3');
      if(!title) return;
      var div=document.createElement('div');
      div.className='schoolhub-course-room-preview';
      div.innerHTML='<i class="fas fa-door-open"></i><span>'+esc(rooms.join(', '))+'</span>';
      title.insertAdjacentElement('afterend', div);
    });
  }

  if(typeof window.renderCourseGrid === 'function' && !window.renderCourseGrid.__schoolhubRoomPreviewWrapped){
    var oldGrid=window.renderCourseGrid;
    var wrappedGrid=function(){
      var r=oldGrid.apply(this, arguments);
      setTimeout(decorateCourseRoomPreviews, 0);
      setTimeout(decorateCourseRoomPreviews, 120);
      return r;
    };
    wrappedGrid.__schoolhubRoomPreviewWrapped=true;
    window.renderCourseGrid=wrappedGrid;
  }

  if(typeof window.renderCourseOverview === 'function' && !window.renderCourseOverview.__schoolhubRoomSelectorTopWrapped){
    var oldOverview=window.renderCourseOverview;
    var wrappedOverview=function(){
      try{window.renderOverviewRoomFilter();}catch(e){}
      var r=oldOverview.apply(this, arguments);
      try{window.renderOverviewRoomFilter();}catch(e){}
      setTimeout(function(){try{window.renderOverviewRoomFilter();}catch(e){}},80);
      return r;
    };
    wrappedOverview.__schoolhubRoomSelectorTopWrapped=true;
    window.renderCourseOverview=wrappedOverview;
  }

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(decorateCourseRoomPreviews, 200);
    setTimeout(function(){try{window.renderOverviewRoomFilter();}catch(e){}}, 250);
  });
  document.addEventListener('click', function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(decorateCourseRoomPreviews, 120);}, true);
})();
