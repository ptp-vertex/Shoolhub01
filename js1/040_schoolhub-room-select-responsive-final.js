
(function(){
  if(window.__schoolhubRoomSelectResponsiveFinal) return;
  window.__schoolhubRoomSelectResponsiveFinal = true;
  function currentCourseId(){
    return window.currentActiveCourseId || ((document.getElementById('att-course-select')||document.getElementById('score-course-select')||{}).value) || '';
  }
  function applyRoomValue(value){
    var cid=currentCourseId();
    if(!cid) return;
    window.__overviewRoomFilter = window.__overviewRoomFilter || {};
    window.__overviewRoomFilter[cid]=value || 'all';
    if(typeof window.renderCourseOverview === 'function'){
      window.requestAnimationFrame ? requestAnimationFrame(function(){ window.renderCourseOverview(); }) : setTimeout(function(){ window.renderCourseOverview(); },0);
    }
  }
  document.addEventListener('change', function(e){
    var sel=e.target && e.target.closest && e.target.closest('#overview-room-filter select');
    if(!sel) return;
    e.stopPropagation();
    applyRoomValue(sel.value);
  }, true);
})();
