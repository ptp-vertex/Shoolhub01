
(function(){
  if(window.__schoolhubSelectLagHardStopFinal) return;
  window.__schoolhubSelectLagHardStopFinal = true;
  var lastSelectOpen = 0;
  function isSelectTarget(e){
    var t=e && e.target;
    return !!(t && t.closest && t.closest('select'));
  }
  ['pointerdown','touchstart','mousedown'].forEach(function(type){
    document.addEventListener(type,function(e){ if(isSelectTarget(e)) lastSelectOpen=Date.now(); }, {capture:true, passive:true});
  });
  var oldInit = window.initStaticDropdowns;
  if(typeof oldInit === 'function' && !oldInit.__schoolhubSelectHardStopWrapped){
    var wrapped=function(){
      var active=document.activeElement;
      if(active && active.tagName === 'SELECT') return;
      if(Date.now() - lastSelectOpen < 1800) return;
      return oldInit.apply(this, arguments);
    };
    wrapped.__schoolhubSelectHardStopWrapped=true;
    window.initStaticDropdowns=wrapped;
  }
  function alignCourseRooms(){
    var grid=document.getElementById('course-grid');
    if(!grid) return;
    Array.prototype.forEach.call(grid.children||[], function(card){
      var room=card.querySelector('.schoolhub-course-room-preview');
      var foot=card.querySelector('.text-sm.mt-auto');
      if(room && foot && room.nextElementSibling !== foot){
        card.insertBefore(room, foot);
      }
    });
  }
  if(typeof window.renderCourseGrid === 'function' && !window.renderCourseGrid.__schoolhubRoomBottomAlignWrapped){
    var oldGrid=window.renderCourseGrid;
    var wrap=function(){
      var r=oldGrid.apply(this,arguments);
      setTimeout(alignCourseRooms,0);
      setTimeout(alignCourseRooms,180);
      return r;
    };
    wrap.__schoolhubRoomBottomAlignWrapped=true;
    window.renderCourseGrid=wrap;
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(alignCourseRooms,250);});
  document.addEventListener('click',function(e){ if(!isSelectTarget(e)) setTimeout(alignCourseRooms,120); }, true);
})();
