
(function(){
  function isHistoryStillLoading(){
    const box=document.getElementById('user-payment-history-list');
    return !!(box && /กำลังโหลดประวัติ/.test(box.textContent||''));
  }
  function kickPaymentHistoryLoad(delay){
    setTimeout(function(){
      try{
        const view=document.getElementById('view-user-plans');
        if(view && !view.classList.contains('hidden') && typeof window.loadUserPaymentHistory==='function'){
          window.loadUserPaymentHistory(false);
        }
      }catch(e){ console.warn('payment history kick failed:', e); }
    }, delay||0);
  }
  function installSwitchWrapper(){
    if(typeof window.switchView==='function' && !window.switchView.__paymentHistoryWrappedFinal){
      const old=window.switchView;
      const wrapped=function(viewId){
        const r=old.apply(this, arguments);
        if(viewId==='user-plans'){
          kickPaymentHistoryLoad(80);
          kickPaymentHistoryLoad(900);
          setTimeout(function(){
            if(isHistoryStillLoading()){
              const box=document.getElementById('user-payment-history-list');
              if(box) box.innerHTML='<div class="text-center text-slate-500 py-6"><i class="fas fa-triangle-exclamation text-amber-500 mr-1"></i> โหลดประวัติช้า กำลังกระตุ้นโหลดข้อมูลอีกครั้ง...</div>';
              kickPaymentHistoryLoad(100);
            }
          }, 4500);
        }
        return r;
      };
      wrapped.__paymentHistoryWrappedFinal=true;
      window.switchView=wrapped;
    }
  }
  function bringSlipPopup(){
    const popup=document.getElementById('slip-result-popup');
    if(!popup || popup.classList.contains('hidden')) return;
    if(popup.parentElement!==document.body || document.body.lastElementChild!==popup) document.body.appendChild(popup);
    popup.style.position='fixed'; popup.style.inset='0'; popup.style.zIndex='2147483647'; popup.style.pointerEvents='auto';
  }
  document.addEventListener('DOMContentLoaded', function(){
    installSwitchWrapper();
    setInterval(function(){ installSwitchWrapper(); bringSlipPopup(); }, 500);
    kickPaymentHistoryLoad(1600);
  });
  document.addEventListener('click', function(e){
    const t=e.target && e.target.closest && e.target.closest('[onclick*="openUserPlanSelector"],[data-target="user-plans"],#slip-result-popup,#payment-submit-btn');
    if(t){ setTimeout(bringSlipPopup,0); setTimeout(bringSlipPopup,80); }
  }, true);
})();
