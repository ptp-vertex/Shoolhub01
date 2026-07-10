
(function(){
    if (window.__schoolhubPlanScoreModalXCloseFinalFix) return;
    window.__schoolhubPlanScoreModalXCloseFinalFix = true;

    function byId(id){ return document.getElementById(id); }
    var swallowClicksUntil = 0;

    function stopEvent(ev){
        if (!ev) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }

    function forceClosePlanModal(ev){
        stopEvent(ev);
        var modal = byId('plan-modal');
        try { if (typeof window.cancelEditPlan === 'function') window.cancelEditPlan(); } catch(e) {}
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            modal.style.pointerEvents = 'none';
            modal.removeAttribute('aria-modal');
        }
        // กัน ghost click หลังปิด ไม่ให้ทะลุไปโดนปุ่มเมนูด้านหลังบนมือถือ
        swallowClicksUntil = Date.now() + 650;
        // คืน scroll เฉพาะเมื่อไม่มี modal หลักอื่นเปิดอยู่
        try {
            var stillOpen = Array.prototype.some.call(document.querySelectorAll('.fixed.inset-0:not(.hidden)'), function(el){
                return el && el.id && el.id !== 'plan-modal' && getComputedStyle(el).display !== 'none';
            });
            if (!stillOpen) document.body.style.overflow = '';
        } catch(e) { document.body.style.overflow = ''; }
        try { if (window.currentActiveCourseId && typeof window.renderCourseOverview === 'function') window.renderCourseOverview(); } catch(e) {}
        return false;
    }

    window.closePlanModal = forceClosePlanModal;

    function preparePlanCloseButton(){
        var modal = byId('plan-modal');
        if (!modal) return;
        modal.setAttribute('aria-modal', modal.classList.contains('hidden') ? 'false' : 'true');
        if (!modal.dataset.schoolhubPlanClickStopperAttached) {
            modal.dataset.schoolhubPlanClickStopperAttached = '1';
            modal.addEventListener('click', function(e){ e.stopPropagation(); }, true);
            modal.addEventListener('touchend', function(e){ e.stopPropagation(); }, true);
            modal.addEventListener('pointerup', function(e){ e.stopPropagation(); }, true);
        }
        var btn = modal.querySelector('[data-schoolhub-plan-modal-close="1"], button[onclick*="closePlanModal"]');
        if (!btn) return;
        btn.type = 'button';
        btn.setAttribute('data-schoolhub-plan-modal-close', '1');
        btn.setAttribute('aria-label', 'ปิดป็อปอัพแผนคะแนน');
        btn.classList.add('schoolhub-plan-modal-close-btn');
        btn.onclick = function(ev){
            return forceClosePlanModal(ev);
        };
    }

    document.addEventListener('DOMContentLoaded', preparePlanCloseButton);
    setTimeout(preparePlanCloseButton, 0);
    setTimeout(preparePlanCloseButton, 300);

    // ใช้ click อย่างเดียวเพื่อไม่ให้ touchstart ปิด modal ก่อน แล้วเกิด click ทะลุไปโดนเมนูด้านหลัง
    document.addEventListener('click', function(e){
        var btn = e.target && e.target.closest ? e.target.closest('#plan-modal [data-schoolhub-plan-modal-close="1"], #plan-modal .schoolhub-plan-modal-close-btn, #plan-modal button[onclick*="closePlanModal"]') : null;
        if (!btn) return;
        forceClosePlanModal(e);
    }, true);

    // ปุ่มกากบาท "ยกเลิกแก้ไข" (plan-cancel-edit-btn) โดน stopPropagation ของ modal (capture) ดักไว้เหมือนกัน
    // เลยต้องดักที่ document ก่อนถึง modal เสมอ แล้วเรียก cancelEditPlan ตรงๆ
    document.addEventListener('click', function(e){
        var btn = e.target && e.target.closest ? e.target.closest('#plan-cancel-edit-btn') : null;
        if (!btn) return;
        if (typeof window.cancelEditPlan === 'function') window.cancelEditPlan();
    }, true);

    ['click','touchend','pointerup'].forEach(function(evName){
        document.addEventListener(evName, function(e){
            if (Date.now() > swallowClicksUntil) return;
            var modal = byId('plan-modal');
            var insidePlanModal = modal && e.target && modal.contains(e.target);
            if (!insidePlanModal) stopEvent(e);
        }, true);
    });

    // ถ้าเปิดด้วยแพตช์มือถือเดิมที่ใส่ inline display:flex ให้ตอนปิด hidden ชนะเสมอ
    var observer = new MutationObserver(function(){
        var modal = byId('plan-modal');
        if (!modal) return;
        if (modal.classList.contains('hidden')) {
            modal.style.display = 'none';
            modal.style.pointerEvents = 'none';
            modal.setAttribute('aria-modal', 'false');
        } else {
            modal.style.zIndex = '2147483647';
            modal.style.pointerEvents = 'auto';
            modal.setAttribute('aria-modal', 'true');
        }
    });
    document.addEventListener('DOMContentLoaded', function(){
        var modal = byId('plan-modal');
        if (modal) observer.observe(modal, { attributes:true, attributeFilter:['class'] });
    });
})();
