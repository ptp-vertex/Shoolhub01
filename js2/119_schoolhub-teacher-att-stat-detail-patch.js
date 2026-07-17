
(function(){
  /* ปิดแพตช์นี้ทั้งหมด: ถูกแทนที่โดย v3 (121) + v4 (123) ที่คลิกผ่าน capture phase
     ทำงานก่อนแพตช์นี้เสมออยู่แล้ว การเปิดทิ้งไว้มีแต่กินเวลาโดยไม่มีผลจริง และเสี่ยงชนกับ modal เดียวกัน */
  if (true) return;
  if (window.__teacherAttStatPatchLoaded) return;
  window.__teacherAttStatPatchLoaded = true;

  /* ── Make modal draggable (mouse + touch) ── */
  function makeDraggable(modal) {
    var handle = document.getElementById('teacher-att-stat-modal-header');
    if (!handle || handle.__dragBound) return;
    handle.__dragBound = true;
    var startX, startY, origLeft, origTop;

    function getPos(e) {
      if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: e.clientX, y: e.clientY };
    }

    function onStart(e) {
      if (e.target.closest('button')) return;
      var rect = modal.getBoundingClientRect();
      var p = getPos(e);
      startX = p.x; startY = p.y;
      origLeft = rect.left; origTop = rect.top;
      modal.style.transform = 'none';
      modal.style.left = origLeft + 'px';
      modal.style.top = origTop + 'px';
      handle.style.cursor = 'grabbing';
      e.preventDefault();
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    }

    function onMove(e) {
      var p = getPos(e);
      var dx = p.x - startX;
      var dy = p.y - startY;
      var newLeft = Math.max(0, Math.min(window.innerWidth - modal.offsetWidth, origLeft + dx));
      var newTop = Math.max(0, Math.min(window.innerHeight - modal.offsetHeight, origTop + dy));
      modal.style.left = newLeft + 'px';
      modal.style.top = newTop + 'px';
      e.preventDefault();
    }

    function onEnd() {
      handle.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    }

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
  }

  /* ── Format date string to Thai ── */
  function formatDateThai(d) {
    try {
      var parts = d.split('-');
      if (parts.length === 3) {
        var months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        var y = parseInt(parts[0]) + 543;
        var m = months[parseInt(parts[1]) - 1] || parts[1];
        return parts[2] + ' ' + m + ' ' + y;
      }
    } catch(e) {}
    return d;
  }

  /* ── Find student ID from name/code + cid ── */
  function findStudentId(name, code, cid) {
    var lists = [];
    try {
      if (typeof window.getCourseStudents === 'function' && cid) lists = window.getCourseStudents(cid);
    } catch(e) {}
    if (!lists.length && window.state && window.state.students) lists = window.state.students;
    for (var i = 0; i < lists.length; i++) {
      var s = lists[i];
      if (code && s.code && s.code === code) return s.id;
      if (name && s.name && s.name === name) return s.id;
    }
    return null;
  }

  /* ── Main show function ── */
  window.showTeacherAttStatDetail = function(studentName, studentId, cid, type) {
    var modal = document.getElementById('teacher-att-stat-modal');
    if (!modal) return;

    var cfg = {
      present: { label: 'มา', color: '#059669', icon: 'fa-circle-check', bg: '#ecfdf5' },
      late:    { label: 'สาย', color: '#d97706', icon: 'fa-clock',         bg: '#fffbeb' },
      absent:  { label: 'ขาด', color: '#e11d48', icon: 'fa-circle-xmark',  bg: '#fff1f2' },
      leave:   { label: 'ลา',  color: '#7c3aed', icon: 'fa-user-clock',    bg: '#f5f3ff' }
    }[type];
    if (!cfg) return;

    /* Find dates from state */
    var history = (window.state && window.state.attendance && window.state.attendance[cid]) || {};
    var dates = [];
    var leaveReasons = {};
    Object.keys(history).sort().forEach(function(d) {
      var rec = (history[d] && history[d].records) || {};
      if (rec[studentId] === type) {
        dates.push(d);
        if (type === 'leave' && history[d].leaveReasons) {
          leaveReasons[d] = history[d].leaveReasons[studentId] || '';
        }
      }
    });

    /* Update modal header */
    var icon = document.getElementById('teacher-att-stat-modal-icon');
    var title = document.getElementById('teacher-att-stat-modal-title');
    var sub = document.getElementById('teacher-att-stat-modal-sub');
    icon.className = 'fas ' + cfg.icon;
    icon.style.color = cfg.color;
    title.textContent = cfg.label + ' — ' + (studentName || '');
    sub.textContent = dates.length + ' ครั้ง';
    sub.style.color = cfg.color;
    document.getElementById('teacher-att-stat-modal-header').style.background = cfg.bg;

    /* Build date list */
    var body = document.getElementById('teacher-att-stat-modal-body');
    if (dates.length === 0) {
      body.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:2rem 0;font-weight:700">ไม่มีข้อมูล</div>';
    } else {
      body.innerHTML = dates.map(function(d, i) {
        var reason = leaveReasons[d] ? ' <span style="color:#94a3b8;font-weight:600">— ' + leaveReasons[d] + '</span>' : '';
        return '<div style="padding:.55rem 0;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:.6rem">'
          + '<span style="background:' + cfg.bg + ';color:' + cfg.color + ';font-weight:900;font-size:.72rem;'
          + 'border-radius:.4rem;padding:.15rem .45rem;flex-shrink:0">' + (i + 1) + '</span>'
          + '<span style="color:#334155;font-weight:600">' + formatDateThai(d) + reason + '</span>'
          + '</div>';
      }).join('');
    }

    modal.style.display = 'flex';
    makeDraggable(modal);

    /* Reset position to center each time */
    modal.style.left = '50%';
    modal.style.top = '30%';
    modal.style.transform = 'translateX(-50%)';
  };

  window.closeTeacherAttStatModal = function() {
    var modal = document.getElementById('teacher-att-stat-modal');
    if (modal) modal.style.display = 'none';
  };

  /* ── Event delegation: click on any .summary-mobile-stat ── */
  document.addEventListener('click', function(e) {
    var stat = e.target.closest('.summary-mobile-stat');
    if (!stat) return;

    /* Determine type from text content */
    var text = (stat.textContent || '').replace(/\s+/g,'');
    var type = null;
    if (/มา$/.test(text)) type = 'present';
    else if (/สาย$/.test(text)) type = 'late';
    else if (/ขาด$/.test(text)) type = 'absent';
    else if (/ลา$/.test(text)) type = 'leave';
    if (!type) return;

    /* Find card */
    var card = stat.closest('.summary-mobile-card');
    if (!card) return;

    /* Try to get student info */
    var nameEl = card.querySelector('.summary-mobile-card-name');
    var studentName = nameEl ? (nameEl.textContent || '').trim() : '';

    /* Try student ID from data attributes (summary-mobile-plan or bonus cell) */
    var idEl = card.querySelector('[data-student-id]');
    var cidEl = card.querySelector('[data-course-id]');
    var studentId = idEl ? idEl.getAttribute('data-student-id') : null;
    var cid = cidEl ? cidEl.getAttribute('data-course-id') : null;

    /* Fallback: use code text + active course */
    if (!cid && typeof window.currentActiveCourseId !== 'undefined') {
      cid = window.currentActiveCourseId;
    }

    /* Fallback: find student ID by name/code */
    if (!studentId && cid) {
      var codeEl = card.querySelector('.summary-mobile-card-code');
      var code = codeEl ? (codeEl.textContent || '').replace(/เปิด\/ปิดรหัสนักเรียน/g,'').trim() : '';
      studentId = findStudentId(studentName, code, cid);
    }

    if (!studentId || !cid) return;
    window.showTeacherAttStatDetail(studentName, studentId, cid, type);
    e.stopPropagation();
  });

  /* ── Also make stat badges look clickable (cursor pointer) ── */
  var styleEl = document.createElement('style');
  styleEl.textContent = '.summary-mobile-stat { cursor:pointer; transition: transform .12s, box-shadow .12s; }' +
    '.summary-mobile-stat:hover { transform: scale(1.06); box-shadow: 0 2px 8px rgba(0,0,0,.10); }' +
    '.summary-mobile-stat:active { transform: scale(0.97); }';
  document.head.appendChild(styleEl);

  /* Close on Escape */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') window.closeTeacherAttStatModal();
  });

})();
