
(function(){
    if (window.__schoolhubPlanScoreModalMobileOnlyFix) return;
    window.__schoolhubPlanScoreModalMobileOnlyFix = true;
    function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 767px)').matches; }
    function movePlanModalToBody(){
        var modal = document.getElementById('plan-modal');
        if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);
        return modal;
    }
    function makePlanModalTopLayer(){
        var modal = movePlanModalToBody();
        if (!modal) return;
        modal.classList.add('schoolhub-score-plan-modal');
        if (isMobile() && !modal.classList.contains('hidden')) {
            modal.style.zIndex = '2147483647';
            modal.style.position = 'fixed';
            modal.style.inset = '0';
        }
    }
    var oldOpenPlan = window.openPlanModalForCurrentCourse;
    if (typeof oldOpenPlan === 'function' && !oldOpenPlan.__schoolhubPlanScoreModalMobileOnlyFixWrapped) {
        var wrappedOpenPlan = function(){
            movePlanModalToBody();
            var result = oldOpenPlan.apply(this, arguments);
            makePlanModalTopLayer();
            setTimeout(makePlanModalTopLayer, 0);
            setTimeout(makePlanModalTopLayer, 80);
            return result;
        };
        wrappedOpenPlan.__schoolhubPlanScoreModalMobileOnlyFixWrapped = true;
        window.openPlanModalForCurrentCourse = wrappedOpenPlan;
    }
    var oldOpenModal = window.openModal;
    if (typeof oldOpenModal === 'function' && !oldOpenModal.__schoolhubPlanScoreModalMobileOnlyFixWrapped) {
        var wrappedOpenModal = function(id){
            if (id === 'plan-modal') movePlanModalToBody();
            var result = oldOpenModal.apply(this, arguments);
            if (id === 'plan-modal') makePlanModalTopLayer();
            return result;
        };
        wrappedOpenModal.__schoolhubPlanScoreModalMobileOnlyFixWrapped = true;
        window.openModal = wrappedOpenModal;
    }
    document.addEventListener('click', function(e){
        var modal = document.getElementById('plan-modal');
        if (!modal || modal.classList.contains('hidden')) return;
        if (e.target === modal) {
            if (typeof window.closePlanModal === 'function') window.closePlanModal();
            else modal.classList.add('hidden');
        }
    }, true);
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(movePlanModalToBody, 100); });
})();
