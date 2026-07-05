
(function(){
  if (window.__schoolhubGradeTypeDirtyGuardInstalled) return;
  window.__schoolhubGradeTypeDirtyGuardInstalled = true;
  window.__schoolhubGradeTypeDirty = false;

  document.addEventListener('change', function(e){
    if (e.target && e.target.id === 'grade-type-select') {
      window.__schoolhubGradeTypeDirty = true;
    }
  }, true);

  // Wrap whichever "open grade criteria modal" functions exist at this point
  // (this script runs last, so these are the final/active versions) so that
  // every fresh "open" clears the dirty flag BEFORE any of the modal's
  // render functions run. This lets a freshly opened modal still load the
  // saved value, while a user's in-progress selection is never clobbered
  // by the redundant re-render calls that happen while the modal stays open.
  ['openGradeCriteriaModalForCurrentCourse', 'openGradeCriteriaModalForCourse'].forEach(function(name){
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__schoolhubGradeTypeDirtyResetWrapped) return;
    var wrapped = function(){
      window.__schoolhubGradeTypeDirty = false;
      return orig.apply(this, arguments);
    };
    wrapped.__schoolhubGradeTypeDirtyResetWrapped = true;
    window[name] = wrapped;
  });
})();
