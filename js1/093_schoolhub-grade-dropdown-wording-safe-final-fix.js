
(function(){
  if(window.__schoolhubGradeDropdownSafeFinalFix) return;
  window.__schoolhubGradeDropdownSafeFinalFix = true;

  function byId(id){ return document.getElementById(id); }
  function setGradeTypeOptionText(){
    var sel = byId('grade-type-select');
    if(!sel) return;
    var n = sel.querySelector('option[value="number"]');
    var l = sel.querySelector('option[value="letter"]');
    if(n && n.textContent.trim() !== 'รูปแบบตัวเลข (4, 3.5)') n.textContent = 'รูปแบบตัวเลข (4, 3.5)';
    if(l && l.textContent.trim() !== 'รูปแบบตัวอักษร (A, B+)') l.textContent = 'รูปแบบตัวอักษร (A, B+)';
  }
  function syncGradeLabels(){
    var sel = byId('grade-type-select');
    if(!sel) return;
    var type = sel.value || 'number';
    var pairs = [
      ['grade-crit-4','เกรด 4','A'],
      ['grade-crit-35','เกรด 3.5','B+'],
      ['grade-crit-3','เกรด 3','B'],
      ['grade-crit-25','เกรด 2.5','C+'],
      ['grade-crit-2','เกรด 2','C'],
      ['grade-crit-15','เกรด 1.5','D+'],
      ['grade-crit-1','เกรด 1','D'],
      ['grade-crit-0','เกรด 0','F']
    ];
    pairs.forEach(function(p){
      var input = byId(p[0]);
      if(!input) return;
      var wrap = input.closest('.flex') || input.parentElement;
      var lab = wrap ? wrap.querySelector('label') : null;
      if(wrap) wrap.style.display = '';
      if(lab) lab.textContent = (type === 'letter' ? p[2] : p[1]);
      input.disabled = p[0] === 'grade-crit-0';
      input.required = p[0] !== 'grade-crit-0';
    });
  }
  function applyOnce(){
    setGradeTypeOptionText();
    syncGradeLabels();
  }

  // ห้าม rebuild dropdown ตอนผู้ใช้กำลังกด/เปิด select เพราะจะทำให้มือถือค้างและ loader หมุน
  var lastSelectTouch = 0;
  document.addEventListener('pointerdown', function(e){
    if(e.target && e.target.closest && e.target.closest('select')) lastSelectTouch = Date.now();
  }, true);
  document.addEventListener('touchstart', function(e){
    if(e.target && e.target.closest && e.target.closest('select')) lastSelectTouch = Date.now();
  }, {capture:true, passive:true});

  var oldInit = window.initStaticDropdowns;
  if(typeof oldInit === 'function' && !oldInit.__schoolhubSafeSelectWrapped){
    var safeInit = function(){
      var active = document.activeElement;
      if(active && active.tagName === 'SELECT') return;
      if(Date.now() - lastSelectTouch < 1200) return;
      return oldInit.apply(this, arguments);
    };
    safeInit.__schoolhubSafeSelectWrapped = true;
    window.initStaticDropdowns = safeInit;
  }

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(applyOnce, 80);
    setTimeout(applyOnce, 500);
  });
  document.addEventListener('change', function(e){
    if(e.target && e.target.id === 'grade-type-select'){
      setGradeTypeOptionText();
      syncGradeLabels();
    }
  }, true);
  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('#grade-criteria-modal')){
      setTimeout(applyOnce, 60);
    }
  }, true);

  // กัน loader ค้างจาก error ระหว่าง dropdown/render โดยไม่รบกวนตอน login ช่วงแรก
  function hideStuckLoader(){
    var loader = byId('global-loader');
    if(!loader) return;
    var isShowing = loader.style.display !== 'none' && !loader.classList.contains('hidden');
    if(!isShowing) return;
    if(document.body && document.body.dataset && document.body.dataset.keepGlobalLoader === '1') return;
    loader.style.display = 'none';
  }
  window.addEventListener('error', function(){ setTimeout(hideStuckLoader, 300); });
  window.addEventListener('unhandledrejection', function(){ setTimeout(hideStuckLoader, 300); });
  document.addEventListener('pointerdown', function(e){
    if(e.target && e.target.closest && e.target.closest('select')) setTimeout(hideStuckLoader, 1500);
  }, true);
  setTimeout(hideStuckLoader, 9000);
})();
