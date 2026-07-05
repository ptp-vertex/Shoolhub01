
(function(){
  if(window.__schoolhubDropdownRebuildStopFinalFix) return;
  window.__schoolhubDropdownRebuildStopFinalFix = true;

  function byId(id){ return document.getElementById(id); }
  function hideLoaderSoon(){
    setTimeout(function(){
      try{
        var loader = byId('global-loader');
        if(loader && !(document.body && document.body.dataset && document.body.dataset.keepGlobalLoader === '1')) loader.style.display = 'none';
      }catch(e){}
    }, 250);
  }
  function getWeekLimit(){
    try{
      if(typeof window.getCurrentPlanWeekLimit === 'function') return Math.max(1, Number(window.getCurrentPlanWeekLimit() || 20));
    }catch(e){}
    return 20;
  }
  function setOptionsIfChanged(el, html){
    if(!el) return;
    if(el.dataset.schoolhubFinalOptionsHtml === html) return;
    if(document.activeElement === el) return;
    var oldVal = el.value;
    el.innerHTML = html;
    el.dataset.schoolhubFinalOptionsHtml = html;
    if(oldVal && Array.prototype.some.call(el.options, function(o){ return o.value === oldVal; })) el.value = oldVal;
  }
  function buildWeekOptions(maxWeeks, hasBlank){
    var html = hasBlank ? '<option value="">-- เลือกสัปดาห์ --</option>' : '';
    for(var i=1;i<=maxWeeks;i++) html += '<option value="'+i+'">สัปดาห์ที่ '+i+'</option>';
    return html;
  }

  // ตัวนี้แทน initStaticDropdowns เก่าที่ rebuild innerHTML หลายชั้นจน select หน่วง
  window.initStaticDropdowns = function(){
    var maxWeeks = getWeekLimit();
    setOptionsIfChanged(byId('plan-week'), buildWeekOptions(maxWeeks, false));
    setOptionsIfChanged(byId('score-week'), buildWeekOptions(maxWeeks, true));
  };

  function updateGradeDropdownText(){
    var sel = byId('grade-type-select');
    if(!sel) return;
    var num = sel.querySelector('option[value="number"]');
    var letOpt = sel.querySelector('option[value="letter"]');
    if(num) num.textContent = 'รูปแบบตัวเลข (4, 3.5)';
    if(letOpt) letOpt.textContent = 'รูปแบบตัวอักษร (A, B+)';
  }
  function syncGradeModalLabels(){
    updateGradeDropdownText();
    var sel = byId('grade-type-select');
    if(!sel) return;
    var type = sel.value || 'number';
    var rows = [
      ['grade-crit-4','เกรด 4','A'], ['grade-crit-35','เกรด 3.5','B+'],
      ['grade-crit-3','เกรด 3','B'], ['grade-crit-25','เกรด 2.5','C+'],
      ['grade-crit-2','เกรด 2','C'], ['grade-crit-15','เกรด 1.5','D+'],
      ['grade-crit-1','เกรด 1','D'], ['grade-crit-0','เกรด 0','F']
    ];
    rows.forEach(function(r){
      var input = byId(r[0]); if(!input) return;
      var wrap = input.closest('.flex') || input.parentElement;
      var lab = wrap ? wrap.querySelector('label') : null;
      if(lab) lab.textContent = type === 'letter' ? r[2] : r[1];
    });
  }

  // ลด lag: ไม่ดัก pointermove/mousemove ของ select แล้ว เพราะทำให้ native dropdown หน่วงบนมือถือ
  ['pointerdown','mousedown','touchstart'].forEach(function(type){
    document.addEventListener(type, function(e){
      var t = e.target;
      if(t && t.closest && t.closest('select')) hideLoaderSoon();
    }, {capture:true, passive:true});
  });

  document.addEventListener('DOMContentLoaded', function(){
    try{ window.initStaticDropdowns(); }catch(e){}
    setTimeout(syncGradeModalLabels, 150);
  });
  document.addEventListener('change', function(e){
    if(e.target && e.target.id === 'grade-type-select') syncGradeModalLabels();
  }, true);

  var oldOpenModal = window.openModal;
  if(typeof oldOpenModal === 'function' && !oldOpenModal.__gradeScrollFinalWrapped){
    window.openModal = function(id){
      var r = oldOpenModal.apply(this, arguments);
      if(id === 'grade-criteria-modal'){
        setTimeout(function(){
          syncGradeModalLabels();
          var modal = byId('grade-criteria-modal');
          if(modal) modal.scrollTop = 0;
          var form = modal ? modal.querySelector('form') : null;
          if(form) form.scrollTop = 0;
        }, 30);
      }
      return r;
    };
    window.openModal.__gradeScrollFinalWrapped = true;
  }
})();
