
(function(){
    if (window.__schoolhubReadonlySharedActionAlertPatch) return;
    window.__schoolhubReadonlySharedActionAlertPatch = true;

    function getCurrentCourseForReadonlyPatch(){
        try {
            if (!window.state || !Array.isArray(state.courses) || !window.currentActiveCourseId) return null;
            return state.courses.find(function(c){ return String(c.id) === String(window.currentActiveCourseId); }) || null;
        } catch(e){ return null; }
    }

    function isReadonlySharedCourseForPatch(){
        var c = getCurrentCourseForReadonlyPatch();
        return !!(c && c.__sharedOwnerKey && c.__sharedPermission === 'view');
    }

    function showReadonlySharedAlertForPatch(){
        if (typeof window.showCustomAlert === 'function') {
            window.showCustomAlert('ดูอย่างเดียว', 'รายวิชานี้ถูกแชร์แบบดูอย่างเดียว จึงไม่สามารถจัดการแผนเก็บคะแนนหรือตั้งค่าเกณฑ์เกรดได้');
        } else {
            alert('รายวิชานี้ถูกแชร์แบบดูอย่างเดียว จึงไม่สามารถจัดการแผนเก็บคะแนนหรือตั้งค่าเกณฑ์เกรดได้');
        }
    }

    function keepReadonlyActionButtonsClickable(){
        if (!isReadonlySharedCourseForPatch()) return;
        document.querySelectorAll('button[onclick*="openPlanModalForCurrentCourse"], button[onclick*="openGradeCriteriaModalForCurrentCourse"]').forEach(function(btn){
            btn.disabled = false;
            btn.classList.remove('pointer-events-none');
            btn.classList.remove('opacity-60');
            btn.classList.remove('opacity-50');
            btn.setAttribute('aria-disabled', 'true');
            btn.title = 'รายวิชานี้ถูกแชร์แบบดูอย่างเดียว';
        });
    }

    var oldApplyReadonlyUI = window.schoolhubApplyReadonlyUI;
    if (typeof oldApplyReadonlyUI === 'function' && !oldApplyReadonlyUI.__schoolhubReadonlySharedActionAlertPatchWrapped) {
        var wrappedApplyReadonlyUI = function(){
            var result = oldApplyReadonlyUI.apply(this, arguments);
            keepReadonlyActionButtonsClickable();
            setTimeout(keepReadonlyActionButtonsClickable, 0);
            return result;
        };
        wrappedApplyReadonlyUI.__schoolhubReadonlySharedActionAlertPatchWrapped = true;
        window.schoolhubApplyReadonlyUI = wrappedApplyReadonlyUI;
    }

    var oldOpenPlan = window.openPlanModalForCurrentCourse;
    if (typeof oldOpenPlan === 'function' && !oldOpenPlan.__schoolhubReadonlySharedActionAlertPatchWrapped) {
        var wrappedOpenPlan = function(){
            if (isReadonlySharedCourseForPatch()) {
                showReadonlySharedAlertForPatch();
                return false;
            }
            return oldOpenPlan.apply(this, arguments);
        };
        wrappedOpenPlan.__schoolhubReadonlySharedActionAlertPatchWrapped = true;
        window.openPlanModalForCurrentCourse = wrappedOpenPlan;
    }

    var oldOpenGrade = window.openGradeCriteriaModalForCurrentCourse;
    if (typeof oldOpenGrade === 'function' && !oldOpenGrade.__schoolhubReadonlySharedActionAlertPatchWrapped) {
        var wrappedOpenGrade = function(){
            if (isReadonlySharedCourseForPatch()) {
                showReadonlySharedAlertForPatch();
                return false;
            }
            return oldOpenGrade.apply(this, arguments);
        };
        wrappedOpenGrade.__schoolhubReadonlySharedActionAlertPatchWrapped = true;
        window.openGradeCriteriaModalForCurrentCourse = wrappedOpenGrade;
    }

    document.addEventListener('click', function(e){
        var btn = e.target && e.target.closest && e.target.closest('button[onclick*="openPlanModalForCurrentCourse"], button[onclick*="openGradeCriteriaModalForCurrentCourse"]');
        if (!btn || !isReadonlySharedCourseForPatch()) return;
        keepReadonlyActionButtonsClickable();
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        showReadonlySharedAlertForPatch();
    }, true);

    document.addEventListener('DOMContentLoaded', function(){
        keepReadonlyActionButtonsClickable();
        setTimeout(keepReadonlyActionButtonsClickable, 200);
    });
    setInterval(function(){
        if (isReadonlySharedCourseForPatch()) keepReadonlyActionButtonsClickable();
    }, 700);
})();
