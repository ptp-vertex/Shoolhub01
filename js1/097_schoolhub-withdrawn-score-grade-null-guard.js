
(function(){
  if(window.__schoolhubWithdrawnGradeCanonicalFix) return;
  window.__schoolhubWithdrawnGradeCanonicalFix = true;

  function safeText(value, fallback){
    if(value === null || value === undefined) return fallback || '';
    return String(value);
  }
  window.safeText = window.safeText || safeText;

  function isWithdrawnStudent(student){
    return !!(student && (
      student.withdrawn === true ||
      student.isWithdrawn === true ||
      student.status === 'withdrawn' ||
      student.status === 'ลาออก'
    ));
  }
  window.isWithdrawnStudent = isWithdrawnStudent;
  window.isStudentWithdrawn = isWithdrawnStudent;

  function esc(v){
    return safeText(v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});
  }

  function renderWithdrawnScoreCell(){ return '<span class="withdrawn-score-cell">ลาออก</span>'; }
  function renderWithdrawnGradeCell(){ return '<span class="withdrawn-grade withdrawn-grade-cell">ลาออก</span>'; }
  window.renderWithdrawnScoreCell = renderWithdrawnScoreCell;
  window.renderWithdrawnGradeCell = renderWithdrawnGradeCell;
  window.renderWithdrawnGrade = renderWithdrawnGradeCell;

  const gradeSignature = window.gradeSignature || new WeakMap();
  window.gradeSignature = gradeSignature;

  function studentById(studentId){
    return studentId && window.state && (state.students || []).find(function(x){ return String(x.id) === String(studentId); });
  }

  function gradeColor(g){
    g = String(g == null ? '' : g);
    if(g === 'ลาออก') return 'withdrawn-grade-cell';
    if(g === 'มส.' || g === 'F' || g === '0') return 'text-rose-600 schoolhub-grade-ms';
    if(['4','3.5','A','B+'].indexOf(g) >= 0) return 'text-emerald-500';
    if(['3','2.5','B','C+','C'].indexOf(g) >= 0) return 'text-blue-500';
    if(['2','1.5','D+','D'].indexOf(g) >= 0) return 'text-amber-500';
    if(['1'].indexOf(g) >= 0) return 'text-rose-500';
    return 'text-slate-400';
  }
  window.schoolhubGradeColor = gradeColor;

  function schoolhubRenderGrade(student, total, criteria, courseId, totalMax){
    if(isWithdrawnStudent(student)){
      return {grade:'ลาออก', value:'ลาออก', html:renderWithdrawnGradeCell(), color:'withdrawn-grade-cell', isWithdrawn:true, signature:'withdrawn'};
    }
    if(!(Number(totalMax) > 0)){
      return {grade:'-', value:'-', html:'-', color:'text-slate-300', isWithdrawn:false, signature:'-'};
    }
    var grade = '-';
    if(typeof window.getFinalGradeForStudent === 'function'){
      var courseObj = (window.state && state.courses || []).find(function(c){ return String(c.id) === String(courseId); }) || {id:courseId, gradeCriteria:criteria};
      grade = window.getFinalGradeForStudent(courseObj, student, total);
    }
    if(grade === null || grade === undefined || grade === '') grade = '-';
    grade = String(grade);
    return {grade:grade, value:grade, html:esc(grade), color:gradeColor(grade), isWithdrawn:false, signature:'grade:'+grade};
  }
  window.schoolhubRenderGrade = schoolhubRenderGrade;

  function schoolhubApplyGradeCell(cell, gradeInfo){
    if(!cell || !gradeInfo) return;
    var sig = gradeInfo.signature || (gradeInfo.isWithdrawn ? 'withdrawn' : String(gradeInfo.value));
    if(gradeSignature.get(cell) === sig) return;
    gradeSignature.set(cell, sig);
    cell.className = gradeInfo.isWithdrawn
      ? 'text-center font-bold bg-amber-50/30 summary-grade-col withdrawn'
      : 'text-center font-bold '+gradeInfo.color+' bg-amber-50/30 summary-grade-col';
    cell.innerHTML = gradeInfo.html;
  }
  window.schoolhubApplyGradeCell = schoolhubApplyGradeCell;

  var oldFinalGrade = window.schoolhubCalculateFinalGrade;
  if(typeof oldFinalGrade === 'function' && !oldFinalGrade.__withdrawnCanonicalGuard){
    window.schoolhubCalculateFinalGrade = function(score, criteria, courseId, studentId, student){
      var st = student || studentById(studentId);
      if(isWithdrawnStudent(st)) return 'ลาออก';
      return oldFinalGrade.apply(this, arguments);
    };
    window.schoolhubCalculateFinalGrade.__withdrawnCanonicalGuard = true;
  }

  // Disabled legacy calculateGrade withdrawn wrapper; final calculateGrade must remain a simple rule-only helper.

  var oldOpenMissing = window.openMissingScorePopup;
  if(typeof oldOpenMissing === 'function' && !oldOpenMissing.__withdrawnGuard){
    window.openMissingScorePopup = function(data){
      var sid = data && data.studentId;
      var st = sid && studentById(sid);
      if(isWithdrawnStudent(st)) return false;
      return oldOpenMissing.apply(this, arguments);
    };
    window.openMissingScorePopup.__withdrawnGuard = true;
  }

  function patchXlsxAoaToSheet(){
    if(!window.XLSX || !XLSX.utils || !XLSX.utils.aoa_to_sheet || XLSX.utils.aoa_to_sheet.__withdrawnCanonicalGuard) return;
    var old = XLSX.utils.aoa_to_sheet;
    XLSX.utils.aoa_to_sheet = function(aoa){
      if(Array.isArray(aoa)) sanitizeExportAoa(aoa);
      var ws = old.apply(this, arguments);
      try { schoolhubBeautifySheet(ws); } catch(e){ console.warn('beautify sheet failed', e); }
      return ws;
    };
    XLSX.utils.aoa_to_sheet.__withdrawnCanonicalGuard = true;
  }

  /* จัดสีและรูปแบบทุกไฟล์ Excel ที่สร้างในระบบให้สวยงามและอ่านง่าย
     - หัวตารางพื้นสีน้ำเงินม่วง ตัวหนังสือขาวหนา จัดกึ่งกลาง
     - เซลล์สถานะ มา/สาย/ขาด/ลา/โบนัส/ดาว ใส่สีตามความหมาย
     - แถวลายม้าลาย (สลับสีอ่อน) ให้อ่านง่ายเมื่อข้อมูลเยอะ
     - ปรับความกว้างคอลัมน์อัตโนมัติ และตรึงแถวหัวตาราง */
  function schoolhubBeautifySheet(ws){
    if(!ws || !ws['!ref'] || !window.XLSX || !XLSX.utils) return;
    var range = XLSX.utils.decode_range(ws['!ref']);
    var headerRowIdx = -1;
    for (var R = range.s.r; R <= range.e.r; R++) {
      var filled = 0;
      for (var C = range.s.c; C <= range.e.c; C++) { if (ws[XLSX.utils.encode_cell({r:R,c:C})]) filled++; }
      if (filled >= Math.max(2, Math.floor((range.e.c - range.s.c + 1) * 0.5))) { headerRowIdx = R; break; }
    }
    var STATUS_COLORS = {
      'มา':['DCFCE7','166534'], 'ส่งแล้ว':['DCFCE7','166534'],
      'สาย':['FEF9C3','854D0E'],
      'ขาด':['FEE2E2','991B1B'], 'ยังไม่ส่ง':['FEE2E2','991B1B'],
      'ลา':['EDE9FE','6D28D9'],
      'ลาออก':['F1F5F9','64748B']
    };
    var noteColIdx = -1;
    if (headerRowIdx >= 0) {
      for (var Cn = range.s.c; Cn <= range.e.c; Cn++) {
        var hCell = ws[XLSX.utils.encode_cell({r:headerRowIdx,c:Cn})];
        if (hCell && String(hCell.v||'').trim() === 'หมายเหตุ') { noteColIdx = Cn; break; }
      }
    }
    for (var R2 = range.s.r; R2 <= range.e.r; R2++) {
      for (var C2 = range.s.c; C2 <= range.e.c; C2++) {
        var ref = XLSX.utils.encode_cell({r:R2,c:C2});
        var cell = ws[ref];
        if(!cell) continue;
        var v = String(cell.v == null ? '' : cell.v).trim();

        if (R2 === headerRowIdx) {
          var isTaskOrTotalHeader = /^รวมคะแนน/.test(v) || /\((เต็ม |เช็คงาน)/.test(v);
          cell.s = { fill:{patternType:'solid',fgColor:{rgb:'4F46E5'}}, font:{bold:true,color:{rgb:'FFFFFF'},sz:(isTaskOrTotalHeader?7:11)}, alignment:{horizontal:'center',vertical:'center',wrapText:true}, border:{bottom:{style:'thin',color:{rgb:'C7D2FE'}}} };
          continue;
        }
        if (R2 < headerRowIdx) {
          if (C2 === range.s.c) cell.s = { font:{bold:true,color:{rgb:'1E293B'},sz:12} };
          continue;
        }

        var fill=null, fontColor=null, bold=false;
        if (STATUS_COLORS[v]) { fill=STATUS_COLORS[v][0]; fontColor=STATUS_COLORS[v][1]; }
        else if (v.indexOf('ขาดส่ง') !== -1) { fill='FECACA'; fontColor='991B1B'; }
        else if (/^\+\d/.test(v) || v.indexOf('⭐') !== -1) { fill='FEF3C7'; fontColor='92400E'; bold=true; }

        var isLeftCol = C2 <= range.s.c+2 || C2 === noteColIdx;
        cell.s = Object.assign(
          { alignment:{horizontal:(isLeftCol ? 'left':'center'), vertical:'center'}, border:{bottom:{style:'hair',color:{rgb:'E2E8F0'}}} },
          fill ? { fill:{patternType:'solid',fgColor:{rgb:fill}}, font:{color:{rgb:fontColor},bold:bold} } : ((R2 - headerRowIdx) % 2 === 0 ? { fill:{patternType:'solid',fgColor:{rgb:'F8FAFC'}} } : {})
        );
      }
    }
    var cols = [];
    for (var C3 = range.s.c; C3 <= range.e.c; C3++) {
      var maxLen = 4;
      for (var R3 = range.s.r; R3 <= range.e.r; R3++) {
        if (R3 <= headerRowIdx) continue; // ไม่นับแถวหัวตาราง และแถวชื่อวิชา/ห้อง (เหนือหัวตาราง) ซึ่งมักยาวกว่าข้อมูลจริงมาก
        var c3 = ws[XLSX.utils.encode_cell({r:R3,c:C3})]; if (c3 && c3.v != null) {
          var lines3 = String(c3.v).split('\n');
          for (var li3=0; li3<lines3.length; li3++) maxLen = Math.max(maxLen, lines3[li3].length);
        }
      }
      cols.push({ wch: Math.min(maxLen + 2, 40) });
    }
    ws['!cols'] = cols;
    if (headerRowIdx >= 0) ws['!freeze'] = { xSplit: 0, ySplit: headerRowIdx + 1 };
  }
  window.schoolhubBeautifySheet = schoolhubBeautifySheet;

  function sanitizeExportAoa(aoa){
    aoa.forEach(function(row){
      if(Array.isArray(row)) for(var i=0;i<row.length;i++) if(row[i] === null || row[i] === undefined || row[i] === 'null' || row[i] === 'undefined') row[i] = '';
    });
    var headerIndex = aoa.findIndex(function(row){ return Array.isArray(row) && row.indexOf('ชื่อ - นามสกุล') !== -1 && row.indexOf('เกรด') !== -1; });
    if(headerIndex < 0 || !window.state) return;
    var header = aoa[headerIndex];
    var codeIndex = header.indexOf('รหัสนักเรียน');
    var nameIndex = header.indexOf('ชื่อ - นามสกุล');
    var gradeIndex = header.indexOf('เกรด');
    var totalIndex = header.findIndex(function(h){ return /^รวมคะแนน/.test(String(h || '')); });
    var firstPlanIndex = header.findIndex(function(h){ return /^สัปดาห์/.test(String(h || '')); });
    if(gradeIndex < 0 || totalIndex < 0 || firstPlanIndex < 0) return;
    for(var r=headerIndex+1; r<aoa.length; r++){
      var row = aoa[r];
      if(!Array.isArray(row) || !row.length) continue;
      var st = (state.students || []).find(function(x){
        var sameCode = codeIndex >= 0 && safeText(x.code) && safeText(x.code) === safeText(row[codeIndex]);
        var sameName = nameIndex >= 0 && safeText(x.name) && safeText(x.name) === safeText(row[nameIndex]);
        return sameCode && sameName;
      }) || (state.students || []).find(function(x){ return nameIndex >= 0 && safeText(x.name) && safeText(x.name) === safeText(row[nameIndex]); });
      if(!isWithdrawnStudent(st)) continue;
      for(var c=firstPlanIndex; c<totalIndex; c++) row[c] = 'ลาออก';
      row[totalIndex] = 'ลาออก';
      row[gradeIndex] = 'ลาออก';
    }
  }

  document.addEventListener('dblclick', function(e){
    var el = e.target && e.target.closest ? e.target.closest('[data-missing-score="1"]') : null;
    if(!el) return;
    var sid = el.dataset && el.dataset.studentId;
    var st = sid && studentById(sid);
    if(isWithdrawnStudent(st)){
      e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      return false;
    }
  }, true);

  patchXlsxAoaToSheet();
})();
