
(function(){
  if(window.__schoolhubGradeMsRulesFix) return;
  window.__schoolhubGradeMsRulesFix = true;

  const NUM_DEFAULT = {'4':80,'3.5':75,'3':70,'2.5':65,'2':60,'1.5':55,'1':50,'0':0, gradeType:'number'};
  const LETTER_DEFAULT = {A:80,B:70,C:60,D:50,F:0, gradeType:'letter'};

  function byId(id){return document.getElementById(id);}
  function n(v,fb){v=Number(v);return Number.isFinite(v)?v:(fb||0);}
  function getCid(){
    try{return window.currentActiveCourseId || (typeof currentActiveCourseId!=='undefined'?currentActiveCourseId:null) || '';}catch(e){return '';}
  }
  function ensureState(){
    if(!window.state) window.state={};
    if(!state.courseGrades) state.courseGrades={};
    return state;
  }
  function getCriteria(cid){
    ensureState();
    return (state.courseGrades && state.courseGrades[cid]) || window.defaultGradeCriteria || NUM_DEFAULT;
  }
  function getRules(cid){
    const c=getCriteria(cid);
    return {
      gradeType: c.gradeType || 'number',
      lateToAbsent: Math.max(0,n(c.lateToAbsent,3)),
      msAbsentLimit: Math.max(0,n(c.msAbsentLimit,5)),
      msAbsentPercent: Math.max(0,n(c.msAbsentPercent,20)),
      msEnabled: c.msEnabled !== false
    };
  }

  function ensureExtraUI(){
    const modal=byId('grade-criteria-modal');
    const form=modal && modal.querySelector('form');
    if(!form || byId('schoolhub-grade-extra-rules')) return;
    const p=form.querySelector('p');
    if(p) p.textContent='กำหนดคะแนนขั้นต่ำ รูปแบบเกรด และเงื่อนไข มส. จากการขาด/สาย';

    form.insertAdjacentHTML('afterbegin', `
      <div id="schoolhub-grade-extra-rules">
        <div class="sgr-title"><i class="fas fa-sliders text-primary"></i> รูปแบบเกรดและเงื่อนไข มส.</div>
        <div class="sgr-grid">
          <div>
            <label>รูปแบบเกรด</label>
            <select id="grade-type-select">
              <option value="number">รูปแบบตัวเลข (4, 3.5)</option>
              <option value="letter">รูปแบบตัวอักษร (A, B+)</option>
            </select>
          </div>
          <div>
            <label>สายกี่ครั้ง = ขาด 1 ครั้ง</label>
            <input id="grade-late-to-absent" type="number" inputmode="numeric" min="0" placeholder="เช่น 3">
          </div>
          <div>
            <label>ขาดรวมกี่ครั้งขึ้นไป = มส. <span class="font-normal">(0 = ไม่ใช้)</span></label>
            <input id="grade-ms-absent-limit" type="number" inputmode="numeric" min="0" placeholder="เช่น 5">
          </div>
          <div>
            <label>ขาดรวมเกินกี่ % ของวันเช็คชื่อ = มส. <span class="font-normal">(0 = ไม่ใช้)</span></label>
            <input id="grade-ms-absent-percent" type="number" inputmode="decimal" min="0" max="100" placeholder="เช่น 20">
          </div>
        </div>
        <label class="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700">
          <input id="grade-ms-enabled" type="checkbox" class="w-4 h-4 accent-indigo-600">
          เปิดใช้การคำนวณ มส. จากขาด/สาย
        </label>
        <div class="sgr-hint">ตัวอย่าง: สาย 3 ครั้ง = ขาด 1 ครั้ง, ถ้าขาดจริง 4 ครั้ง + สาย 3 ครั้ง จะนับขาดรวม 5 ครั้ง แล้วแสดง มส. ทันทีหากถึงเกณฑ์</div>
      </div>
    `);

    const typeSel=byId('grade-type-select');
    if(typeSel) typeSel.addEventListener('change', syncGradeTypeUI);
  }

  function syncGradeTypeUI(){
    const type=(byId('grade-type-select')||{}).value || 'number';
    const pairs=[
      ['grade-crit-4','เกรด 4','A'],
      ['grade-crit-35','เกรด 3.5',''],
      ['grade-crit-3','เกรด 3','B'],
      ['grade-crit-25','เกรด 2.5',''],
      ['grade-crit-2','เกรด 2','C'],
      ['grade-crit-15','เกรด 1.5',''],
      ['grade-crit-1','เกรด 1','D'],
      ['grade-crit-0','เกรด 0','F']
    ];
    pairs.forEach(([id,numLabel,letterLabel])=>{
      const input=byId(id); if(!input) return;
      const wrap=input.closest('.flex');
      const lab=wrap && wrap.querySelector('label');
      if(type==='letter'){
        if(['grade-crit-35','grade-crit-25','grade-crit-15'].includes(id)){
          if(wrap) wrap.style.display='none';
          input.required=false;
        }else{
          if(wrap) wrap.style.display='';
          if(lab) lab.textContent=letterLabel;
          input.disabled = id==='grade-crit-0';
          input.required = id!=='grade-crit-0';
        }
      }else{
        if(wrap) wrap.style.display='';
        if(lab) lab.textContent=numLabel;
        input.disabled = id==='grade-crit-0';
        input.required = id!=='grade-crit-0';
      }
    });
  }

  function fillGradeModal(){
    ensureExtraUI();
    const cid=getCid();
    const c=getCriteria(cid);
    const type=c.gradeType || 'number';
    const set=(id,v)=>{const el=byId(id); if(el) el.value = v;};
    const chk=(id,v)=>{const el=byId(id); if(el) el.checked=!!v;};
    set('grade-type-select', type);
    set('grade-late-to-absent', c.lateToAbsent ?? 3);
    set('grade-ms-absent-limit', c.msAbsentLimit ?? 5);
    set('grade-ms-absent-percent', c.msAbsentPercent ?? 20);
    chk('grade-ms-enabled', c.msEnabled !== false);

    if(type==='letter'){
      set('grade-crit-4', c.A ?? c['4'] ?? 80);
      set('grade-crit-3', c.B ?? c['3'] ?? 70);
      set('grade-crit-2', c.C ?? c['2'] ?? 60);
      set('grade-crit-1', c.D ?? c['1'] ?? 50);
      set('grade-crit-0', c.F ?? 0);
    }else{
      set('grade-crit-4', c['4'] ?? 80);
      set('grade-crit-35', c['3.5'] ?? 75);
      set('grade-crit-3', c['3'] ?? 70);
      set('grade-crit-25', c['2.5'] ?? 65);
      set('grade-crit-2', c['2'] ?? 60);
      set('grade-crit-15', c['1.5'] ?? 55);
      set('grade-crit-1', c['1'] ?? 50);
      set('grade-crit-0', 0);
    }
    syncGradeTypeUI();
  }

  const oldOpen=window.openGradeCriteriaModalForCurrentCourse;
  window.openGradeCriteriaModalForCurrentCourse=function(){
    const r = typeof oldOpen==='function' ? oldOpen.apply(this,arguments) : undefined;
    setTimeout(fillGradeModal,20);
    setTimeout(fillGradeModal,180);
    return r;
  };

  // Disabled legacy calculateGrade override. Final source of truth is defined in schoolhub-real-grade-rules-special-script.

  function getAttendanceStats(cid, studentId){
    const hist=(window.state && state.attendance && state.attendance[cid]) || {};
    let present=0, late=0, absent=0, total=0;
    Object.keys(hist).forEach(date=>{
      const st = hist[date] && hist[date][studentId];
      if(!st) return;
      total++;
      if(st==='present') present++;
      else if(st==='late') late++;
      else if(st==='absent') absent++;
    });
    return {present,late,absent,total};
  }
  function msInfo(cid, studentId, criteria){
    var course = (window.state && state.courses || []).find(function(c){ return String(c.id) === String(cid); }) || {id:cid, gradeCriteria:criteria};
    var st = studentId && window.state && (state.students || []).find(function(x){ return String(x.id) === String(studentId); });
    var special = (typeof window.calculateSpecialGradeByAttendance === 'function') ? window.calculateSpecialGradeByAttendance(course, st) : '';
    return {isMS:!!special, specialLabel:special || '', present:0, late:0, absent:0, total:0, converted:0, effective:0, percent:0};
  }
  window.schoolhubGradeMsInfo = msInfo;
  window.schoolhubCalculateFinalGrade = function(score, criteria, cid, studentId, student){
    const st = student || (studentId && window.state && (state.students || []).find(function(x){ return String(x.id) === String(studentId); }));
    if((window.isWithdrawnStudent || window.isStudentWithdrawn || function(){return false;})(st)) return 'ลาออก';
    const info = cid && studentId ? msInfo(cid, studentId, criteria) : {isMS:false};
    if(typeof window.getFinalGradeForStudent === 'function' && cid && st) {
      var course = (state.courses || []).find(function(c){ return String(c.id) === String(cid); }) || {id:cid, gradeCriteria:criteria};
      return window.getFinalGradeForStudent(course, st, score);
    }
    if(info.isMS){
      return (info && info.specialLabel) || '';
    }
    return window.calculateGrade(score, criteria, st);
  };

  function saveEnhancedCriteria(e){
    // Redirect legacy save name to the canonical gradeRules/specialRules submit handler only.
    if (typeof window.handleGradeCriteriaSubmit === 'function') return window.handleGradeCriteriaSubmit(e);
    return false;
  }
  window.saveEnhancedCriteria = saveEnhancedCriteria;
  // Disabled legacy submit override that used state.courseGrades[cid] = base.


  function gradeColor(g){
    if(g==='มส.' || g==='F' || g==='0') return 'text-rose-600 schoolhub-grade-ms';
    if(['4','3.5','A','B'].includes(String(g))) return 'text-emerald-500';
    if(['3','2.5','C'].includes(String(g))) return 'text-blue-500';
    if(['2','1.5','D'].includes(String(g))) return 'text-amber-500';
    if(['1'].includes(String(g))) return 'text-rose-500';
    return 'text-slate-400';
  }

  function patchRenderedGrades(){
    // Disabled: grade cells are rendered only by renderCourseOverview -> schoolhubRenderGrade.
    return;
  }

  function wrapRender(){
    // Disabled: do not patch or rewrite grade cells after render.
    return;
  }

  document.addEventListener('DOMContentLoaded',function(){
    ensureExtraUI(); wrapRender();
  });
  document.addEventListener('change',function(e){
    if(e.target && e.target.id==='grade-type-select') syncGradeTypeUI();
  },true);
  document.addEventListener('click',function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; ensureExtraUI(); },true);
  // ปิด polling เกรดซ้ำทุก 1.5 วิ เพื่อลดอาการหน่วงของ dropdown บนมือถือ
})();
