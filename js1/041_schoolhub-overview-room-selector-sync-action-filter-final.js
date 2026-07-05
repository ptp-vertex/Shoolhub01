
(function(){
  if(window.__schoolhubOverviewRoomSelectorSyncActionFilterFinal) return;
  window.__schoolhubOverviewRoomSelectorSyncActionFilterFinal = true;

  function currentCourseId(){
    return window.currentActiveCourseId || ((document.getElementById('att-course-select')||document.getElementById('score-course-select')||{}).value) || '';
  }

  function applyOverviewRoomFilterValue(value){
    var cid = currentCourseId();
    if(!cid) return;

    window.__overviewRoomFilter = window.__overviewRoomFilter || {};
    window.activeCourseRoomFilter = window.activeCourseRoomFilter || {};

    if(!value || value === 'all'){
      window.__overviewRoomFilter[cid] = 'all';
      delete window.activeCourseRoomFilter[cid];
    }else{
      window.__overviewRoomFilter[cid] = value;
      window.activeCourseRoomFilter[cid] = value;
    }

    if(typeof window.renderCourseOverview === 'function'){
      window.renderCourseOverview();
    }
  }

  function syncSelectorFromRealFilter(){
    var cid = currentCourseId();
    if(!cid) return;
    window.__overviewRoomFilter = window.__overviewRoomFilter || {};
    window.activeCourseRoomFilter = window.activeCourseRoomFilter || {};

    var real = window.activeCourseRoomFilter[cid];
    if(real) window.__overviewRoomFilter[cid] = real;
    else if(!window.__overviewRoomFilter[cid]) window.__overviewRoomFilter[cid] = 'all';

    var sel = document.querySelector('#overview-room-filter select');
    if(sel){
      var target = window.__overviewRoomFilter[cid] || 'all';
      if(Array.prototype.some.call(sel.options, function(o){return o.value === target;})){
        sel.value = target;
      }
    }
  }

  document.addEventListener('change', function(e){
    var sel = e.target && e.target.closest && e.target.closest('#overview-room-filter select');
    if(!sel) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    applyOverviewRoomFilterValue(sel.value);
  }, true);

  function hookRenderOverviewFilter(){
    if(typeof window.renderOverviewRoomFilter === 'function' && !window.renderOverviewRoomFilter.__syncActionFilterWrapped){
      var old = window.renderOverviewRoomFilter;
      var fn = function(){
        syncSelectorFromRealFilter();
        var r = old.apply(this, arguments);
        syncSelectorFromRealFilter();
        return r;
      };
      fn.__syncActionFilterWrapped = true;
      window.renderOverviewRoomFilter = fn;
    }
  }

  function hookCourseOverview(){
    if(typeof window.renderCourseOverview === 'function' && !window.renderCourseOverview.__syncOverviewRoomAfterWrapped){
      var old = window.renderCourseOverview;
      var fn = function(){
        syncSelectorFromRealFilter();
        var r = old.apply(this, arguments);
        setTimeout(syncSelectorFromRealFilter, 0);
        setTimeout(syncSelectorFromRealFilter, 120);
        return r;
      };
      fn.__syncOverviewRoomAfterWrapped = true;
      window.renderCourseOverview = fn;
    }
  }

  hookRenderOverviewFilter();
  hookCourseOverview();
  document.addEventListener('DOMContentLoaded', function(){
    hookRenderOverviewFilter();
    hookCourseOverview();
    setTimeout(syncSelectorFromRealFilter, 300);
  });
})();
