
(function(){
    function syncMobileScoreGuard(){
        try{
            var isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
            var courseView = document.getElementById('view-course-detail');
            var scoreTab = document.getElementById('course-tab-scores');
            var scoreWeek = document.getElementById('score-week');
            var inCourse = !!courseView && !courseView.classList.contains('hidden');
            var inScore = !!scoreTab && !scoreTab.classList.contains('hidden');
            var hasWeek = !!(scoreWeek && scoreWeek.value);
            document.body.classList.toggle('schoolhub-mobile-score-card-active', !!(isMobile && inCourse && inScore && hasWeek));
        }catch(e){}
    }

    document.addEventListener('DOMContentLoaded', syncMobileScoreGuard);
    window.addEventListener('resize', syncMobileScoreGuard);
    document.addEventListener('change', function(e){
        if(e && e.target && e.target.id === 'score-week') setTimeout(syncMobileScoreGuard, 0);
    }, true);
    document.addEventListener('click', function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(syncMobileScoreGuard, 80); }, true);

    var originalSwitchCourseTab = window.switchCourseTab;
    if (typeof originalSwitchCourseTab === 'function' && !originalSwitchCourseTab.__schoolhubMobileScoreGuardWrapped) {
        var wrappedSwitchCourseTab = function(){
            var result = originalSwitchCourseTab.apply(this, arguments);
            setTimeout(syncMobileScoreGuard, 0);
            return result;
        };
        wrappedSwitchCourseTab.__schoolhubMobileScoreGuardWrapped = true;
        window.switchCourseTab = wrappedSwitchCourseTab;
    }

    var originalRenderScoreList = window.renderScoreList;
    if (typeof originalRenderScoreList === 'function' && !originalRenderScoreList.__schoolhubMobileScoreGuardWrapped) {
        var wrappedRenderScoreList = function(){
            var result = originalRenderScoreList.apply(this, arguments);
            setTimeout(syncMobileScoreGuard, 0);
            return result;
        };
        wrappedRenderScoreList.__schoolhubMobileScoreGuardWrapped = true;
        window.renderScoreList = wrappedRenderScoreList;
    }

    // Performance: removed polling; updates run on render/tab/change/resize instead.
})();
