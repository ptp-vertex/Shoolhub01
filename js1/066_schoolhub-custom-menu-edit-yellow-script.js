
(function(){
  if(window.__schoolhubCustomMenuEditYellowFix) return;
  window.__schoolhubCustomMenuEditYellowFix = true;

  function getFormCard(){
    var title=document.getElementById('shcm-form-title');
    if(!title) return null;
    var card=title.closest('.bg-slate-50') || title.closest('div');
    if(card) card.classList.add('shcm-form-card');
    return card;
  }

  function setMode(mode){
    var card=getFormCard();
    if(!card) return;
    card.classList.remove('shcm-mode-add','shcm-mode-edit');
    card.classList.add(mode === 'edit' ? 'shcm-mode-edit' : 'shcm-mode-add');
  }

  function syncByTitle(){
    var title=document.getElementById('shcm-form-title');
    if(!title) return;
    var text=(title.textContent||'').trim();
    setMode(text.indexOf('แก้ไข') !== -1 ? 'edit' : 'add');
  }

  function wrap(){
    if(typeof window.openCustomMenuAdmin === 'function' && !window.openCustomMenuAdmin.__editYellowWrapped){
      var oldOpen=window.openCustomMenuAdmin;
      window.openCustomMenuAdmin=function(){
        var r=oldOpen.apply(this,arguments);
        setTimeout(syncByTitle,50);
        setTimeout(syncByTitle,250);
        return r;
      };
      window.openCustomMenuAdmin.__editYellowWrapped=true;
    }

    if(typeof window.editCustomMenu === 'function' && !window.editCustomMenu.__editYellowWrapped){
      var oldEdit=window.editCustomMenu;
      window.editCustomMenu=function(){
        var r=oldEdit.apply(this,arguments);
        setTimeout(function(){setMode('edit');},30);
        setTimeout(function(){setMode('edit');},200);
        return r;
      };
      window.editCustomMenu.__editYellowWrapped=true;
    }
  }

  document.addEventListener('click',function(e){
    var btn=e.target && e.target.closest && e.target.closest('button');
    if(!btn) return;
    var txt=(btn.textContent||'').trim();
    var on=btn.getAttribute('onclick')||'';
    if(on.indexOf('editCustomMenu') !== -1 || txt.indexOf('แก้ไข') !== -1){
      setTimeout(function(){setMode('edit');},50);
    }
    if(btn.id === 'shcm-add-btn' || btn.id === 'shcm-reset-btn' || txt.indexOf('เพิ่มเมนู') !== -1 || txt.indexOf('ล้าง') !== -1){
      setTimeout(function(){setMode('add');},50);
    }
  },true);

  document.addEventListener('DOMContentLoaded',function(){
    wrap();
    setTimeout(function(){wrap(); syncByTitle();},300);
    setTimeout(function(){wrap(); syncByTitle();},1000);
  });

  setInterval(function(){wrap(); syncByTitle();},1200);
})();
