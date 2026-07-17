
(function(){
  if(window.__schoolhubOverviewRoomSelectOpenLockFinal) return;
  window.__schoolhubOverviewRoomSelectOpenLockFinal = true;
  function markOpen(){
    window.__schoolhubOverviewRoomSelectOpening = true;
    clearTimeout(window.__schoolhubOverviewRoomSelectTimer);
    window.__schoolhubOverviewRoomSelectTimer = setTimeout(function(){ window.__schoolhubOverviewRoomSelectOpening = false; }, 1200);
  }
  ['pointerdown','mousedown','touchstart','click','focus'].forEach(function(type){
    document.addEventListener(type, function(e){
      var sel = e.target && e.target.closest && e.target.closest('#schoolhub-overview-room-select-final');
      if(!sel) return;
      markOpen();
      e.stopPropagation();
    }, true);
  });
  document.addEventListener('change', function(e){
    var sel = e.target && e.target.closest && e.target.closest('#schoolhub-overview-room-select-final');
    if(!sel) return;
    window.__schoolhubOverviewRoomSelectOpening = false;
    clearTimeout(window.__schoolhubOverviewRoomSelectTimer);
  }, true);
  document.addEventListener('blur', function(e){
    var sel = e.target && e.target.closest && e.target.closest('#schoolhub-overview-room-select-final');
    if(!sel) return;
    clearTimeout(window.__schoolhubOverviewRoomSelectTimer);
    window.__schoolhubOverviewRoomSelectTimer = setTimeout(function(){ window.__schoolhubOverviewRoomSelectOpening = false; }, 120);
  }, true);
})();
