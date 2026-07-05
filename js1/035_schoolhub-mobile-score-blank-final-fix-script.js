
(function(){
    function isMobileScoreActive(){
        try{
            var isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
            var courseView = document.getElementById('view-course-detail');
            var scoreTab = document.getElementById('course-tab-scores');
            var scoreWeek = document.getElementById('score-week');
            var scoreArea = document.getElementById('score-area');
            return !!(isMobile && courseView && !courseView.classList.contains('hidden') && scoreTab && !scoreTab.classList.contains('hidden') && scoreWeek && scoreWeek.value && scoreArea && !scoreArea.classList.contains('hidden'));
        }catch(e){ return false; }
    }

    function collapseScoreBlankStats(){
        try{
            var active = isMobileScoreActive();
            document.body.classList.toggle('schoolhub-mobile-score-card-active', active);
            var panel = document.getElementById('admin-global-stats-panel');
            if(!panel) return;
            panel.classList.toggle('schoolhub-mobile-score-hidden-stats', active);
            if(active){
                panel.setAttribute('aria-hidden','true');
                panel.style.setProperty('display','none','important');
                panel.style.setProperty('height','0','important');
                panel.style.setProperty('min-height','0','important');
                panel.style.setProperty('max-height','0','important');
                panel.style.setProperty('margin','0','important');
                panel.style.setProperty('padding','0','important');
                panel.style.setProperty('border','0','important');
                panel.style.setProperty('overflow','hidden','important');
            }else{
                panel.removeAttribute('aria-hidden');
                panel.classList.remove('schoolhub-mobile-score-hidden-stats');
                ['display','height','min-height','max-height','margin','padding','border','overflow'].forEach(function(k){ panel.style.removeProperty(k); });
            }
        }catch(e){}
    }

    document.addEventListener('DOMContentLoaded', function(){ setTimeout(collapseScoreBlankStats, 80); setTimeout(collapseScoreBlankStats, 350); });
    window.addEventListener('resize', function(){ setTimeout(collapseScoreBlankStats, 80); });
    document.addEventListener('change', function(e){ if(e && e.target && e.target.id === 'score-week') { setTimeout(collapseScoreBlankStats, 0); setTimeout(collapseScoreBlankStats, 180); } }, true);
    document.addEventListener('click', function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(collapseScoreBlankStats, 100); }, true);

    var oldRenderScoreList = window.renderScoreList;
    if(typeof oldRenderScoreList === 'function' && !oldRenderScoreList.__schoolhubMobileScoreBlankFinalWrapped){
        var wrapped = function(){
            var r = oldRenderScoreList.apply(this, arguments);
            setTimeout(collapseScoreBlankStats, 0);
            setTimeout(collapseScoreBlankStats, 160);
            return r;
        };
        wrapped.__schoolhubMobileScoreBlankFinalWrapped = true;
        window.renderScoreList = wrapped;
    }

    var oldSwitchCourseTab = window.switchCourseTab;
    if(typeof oldSwitchCourseTab === 'function' && !oldSwitchCourseTab.__schoolhubMobileScoreBlankFinalWrapped){
        var wrappedTab = function(){
            var r = oldSwitchCourseTab.apply(this, arguments);
            setTimeout(collapseScoreBlankStats, 0);
            setTimeout(collapseScoreBlankStats, 160);
            return r;
        };
        wrappedTab.__schoolhubMobileScoreBlankFinalWrapped = true;
        window.switchCourseTab = wrappedTab;
    }

    // Performance: removed polling; updates run on render/tab/change/resize instead.
})();
