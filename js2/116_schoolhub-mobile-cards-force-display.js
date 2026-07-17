
/* Force #course-summary-mobile-cards to be visible after renderCourseOverview populates it.
   Sets inline style directly — overrides any CSS cascade issue. */
(function(){
  if (window.__schoolhubMobileCardsForceDisplayWrapped) return;
  window.__schoolhubMobileCardsForceDisplayWrapped = true;

  function forceCardsDisplay(){
    var box = document.getElementById('course-summary-mobile-cards');
    if (!box) return;
    var isMobile = window.matchMedia ? window.matchMedia('(max-width:767px)').matches : (window.innerWidth <= 767);
    if (!isMobile) {
      box.style.removeProperty('display');
      return;
    }
    if (box.children.length > 0) {
      box.style.setProperty('display', 'grid', 'important');
      box.style.setProperty('grid-template-columns', '1fr', 'important');
      box.style.setProperty('gap', '.85rem', 'important');
      box.style.setProperty('padding', '1rem', 'important');
      box.style.setProperty('background', '#f8fafc', 'important');
    } else {
      box.style.setProperty('display', 'none', 'important');
    }
  }

  function hookRenderCourseOverview(){
    if (typeof window.renderCourseOverview !== 'function') return;
    if (window.renderCourseOverview.__schoolhubForceDisplayWrapped) return;
    var old = window.renderCourseOverview;
    var wrapped = function(){
      var r = old.apply(this, arguments);
      forceCardsDisplay();
      setTimeout(forceCardsDisplay, 80);
      setTimeout(forceCardsDisplay, 300);
      return r;
    };
    wrapped.__schoolhubForceDisplayWrapped = true;
    // copy all flag properties from old
    Object.keys(old).forEach(function(k){ wrapped[k] = old[k]; });
    wrapped.__schoolhubForceDisplayWrapped = true;
    window.renderCourseOverview = wrapped;
  }

  // Try to hook immediately, then retry until it's available
  hookRenderCourseOverview();
  document.addEventListener('DOMContentLoaded', function(){
    hookRenderCourseOverview();
    setTimeout(forceCardsDisplay, 500);
  });
  // Also hook on every click (tab switches) as a safety net
  document.addEventListener('click', function(){
    hookRenderCourseOverview();
    setTimeout(forceCardsDisplay, 150);
  }, true);
  window.addEventListener('resize', forceCardsDisplay);
})();
