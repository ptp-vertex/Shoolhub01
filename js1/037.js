
(function(){
  if(window.__schoolhubFinalRoomSelectorRealFix) return;
  window.__schoolhubFinalRoomSelectorRealFix = true;

  function esc(v){
    if(window.escapeHTML) return window.escapeHTML(v == null ? '' : v);
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});
  }
  function unique(arr){
    var out=[];
    (arr||[]).forEach(function(v){ v=String(v == null ? '' : v).trim(); if(v && out.indexOf(v)<0) out.push(v); });
    return out.sort(function(a,b){return a.localeCompare(b,'th',{numeric:true});});
  }
  function getCourse(cid){
    try{return ((window.state&&state.courses)||[]).find(function(c){return c && c.id===cid;})||null;}catch(e){return null;}
  }
  function getRooms(course){
    if(!course) return [];
    var rooms=[];
    if(Array.isArray(course.studentRooms)) rooms=rooms.concat(course.studentRooms);
    if(Array.isArray(course.studentGrades)) rooms=rooms.concat(course.studentGrades);
    return unique(rooms);
  }
  function getStudentRoom(st){
    try{
      var v = window.getStudentClassName ? window.getStudentClassName(st) : (st && (st.room||st.classroom||st.grade||st.className));
      return String(v == null ? '' : v).trim();
    }catch(e){ return ''; }
  }
  function getStudentByCode(code){
    code=String(code||'').trim();
    try{return ((window.state&&state.students)||[]).find(function(st){return String(st.code||'').trim()===code;})||null;}catch(e){return null;}
  }

  window.__overviewRoomFilter = window.__overviewRoomFilter || {};

  window.renderOverviewRoomFilter = function(){
    var cid=window.currentActiveCourseId;
    var course=getCourse(cid);
    var rooms=getRooms(course);
    var box=document.getElementById('overview-room-filter');
    if(!box) return;

    if(rooms.length<=1){
      box.classList.add('hidden','schoolhub-room-filter-hidden');
      box.classList.remove('schoolhub-room-filter-ready');
      box.innerHTML='';
      return;
    }

    var selected=window.__overviewRoomFilter[cid] || 'all';
    if(selected!=='all' && rooms.indexOf(selected)<0) selected='all';
    window.__overviewRoomFilter[cid]=selected;

    box.classList.remove('hidden','schoolhub-room-filter-hidden');
    box.classList.add('schoolhub-room-filter-ready');
    box.innerHTML='<div class="schoolhub-room-selector-mini">'+
      '<span class="schoolhub-room-selector-mini-label"><i class="fas fa-door-open"></i> เลือกห้อง</span>'+
      '<select onchange="window.__overviewRoomFilter[\''+esc(cid)+'\']=this.value; if(typeof window.renderCourseOverview===\'function\') window.renderCourseOverview();">'+
        '<option value="all" '+(selected==='all'?'selected':'')+'>ทุกห้อง</option>'+rooms.map(function(r){return '<option value="'+esc(r)+'" '+(selected===r?'selected':'')+'>'+esc(r)+'</option>';}).join('')+
      '</select></div>';
  };

  function applyOverviewRoomFilterToTable(){
    var cid=window.currentActiveCourseId;
    var course=getCourse(cid);
    var rooms=getRooms(course);
    if(rooms.length<=1) return;
    var selected=window.__overviewRoomFilter[cid] || 'all';
    if(selected==='all') return;
    var table=document.getElementById('course-summary-table');
    if(!table) return;
    var rows=Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
    var visibleIndex=1;
    rows.forEach(function(row){
      var cells=row.children||[];
      var codeCell=cells[1];
      var st=getStudentByCode(codeCell ? (codeCell.innerText||codeCell.textContent) : '');
      var room=getStudentRoom(st);
      var show=room===selected;
      row.style.display=show?'':'none';
      if(show && cells[0]) cells[0].innerHTML='<span class="schoolhub-seq-text">#'+(visibleIndex++)+'</span>';
    });
  }

  function decorateCourseRoomPreviews(){
    var grid=document.getElementById('course-grid');
    if(!grid) return;
    var cards=Array.prototype.slice.call(grid.children||[]);
    cards.forEach(function(card){
      var id='';
      var onclick=card.getAttribute('onclick')||'';
      var m=onclick.match(/enterCourse\(['\"]([^'\"]+)['\"]\)/);
      if(m) id=m[1];
      if(!id){
        var btn=card.querySelector('[onclick*="enterCourse"]');
        if(btn){ var mm=(btn.getAttribute('onclick')||'').match(/enterCourse\(['\"]([^'\"]+)['\"]\)/); if(mm) id=mm[1]; }
      }
      if(!id) return;
      var course=getCourse(id);
      var rooms=getRooms(course);
      var old=card.querySelector('.schoolhub-course-room-preview'); if(old) old.remove();
      if(!rooms.length) return;
      var anchor=card.querySelector('h3') || card.querySelector('.font-black') || card.querySelector('.font-bold');
      if(!anchor) return;
      var div=document.createElement('div');
      div.className='schoolhub-course-room-preview';
      div.innerHTML='<i class="fas fa-door-open"></i><span>'+esc(rooms.join(', '))+'</span>';
      anchor.insertAdjacentElement('afterend', div);
    });
  }

  function afterOverviewRender(){
    try{window.renderOverviewRoomFilter();}catch(e){}
    try{applyOverviewRoomFilterToTable();}catch(e){}
    try{if(window.buildMobileOverviewCards) window.buildMobileOverviewCards();}catch(e){}
  }

  if(typeof window.renderCourseOverview==='function' && !window.renderCourseOverview.__schoolhubFinalRoomSelectorRealWrapped){
    var oldOverview=window.renderCourseOverview;
    var wrapped=function(){
      var r=oldOverview.apply(this, arguments);
      afterOverviewRender();
      setTimeout(afterOverviewRender,60);
      setTimeout(afterOverviewRender,180);
      return r;
    };
    wrapped.__schoolhubFinalRoomSelectorRealWrapped=true;
    window.renderCourseOverview=wrapped;
  }
  if(typeof window.renderCourseGrid==='function' && !window.renderCourseGrid.__schoolhubFinalRoomPreviewWrapped){
    var oldGrid=window.renderCourseGrid;
    var gridWrapped=function(){var r=oldGrid.apply(this,arguments); setTimeout(decorateCourseRoomPreviews,0); setTimeout(decorateCourseRoomPreviews,150); return r;};
    gridWrapped.__schoolhubFinalRoomPreviewWrapped=true;
    window.renderCourseGrid=gridWrapped;
  }
  if(typeof window.enterCourse==='function' && !window.enterCourse.__schoolhubRoomFilterEnterWrapped){
    var oldEnter=window.enterCourse;
    var enterWrapped=function(cid){ var r=oldEnter.apply(this,arguments); setTimeout(afterOverviewRender,120); return r; };
    enterWrapped.__schoolhubRoomFilterEnterWrapped=true;
    window.enterCourse=enterWrapped;
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(decorateCourseRoomPreviews,300);setTimeout(afterOverviewRender,350);});
  document.addEventListener('click',function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(decorateCourseRoomPreviews,120);},true);
})();
