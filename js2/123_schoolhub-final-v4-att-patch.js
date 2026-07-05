
(function(){
  if(window.__shFinalV4Loaded) return;
  window.__shFinalV4Loaded = true;

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* หา "ชั้นปี" ของนักเรียนจาก state โดยตรง (ตารางไม่มีคอลัมน์นี้ให้ scrape) ใช้ร่วมกันโดยทุก patch การ์ดมือถือ */
  window.__shGetStudentGrade = function(code){
    try {
      var list = (window.state && window.state.students) || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].code === code) return list[i].grade || list[i].room || '-';
      }
    } catch(e){}
    return '-';
  };
  function fmtDate(d){
    var months=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    var p=String(d).split('-');
    if(p.length!==3) return d;
    return parseInt(p[2],10)+' '+months[parseInt(p[1],10)-1]+' '+(parseInt(p[0],10)+543);
  }

  /* หา studentId / courseId ของการ์ดที่ถูกคลิก โดยไม่พึ่งพา data-student-id ที่อาจไม่มีอยู่จริง */
  function findStudent(card){
    var idEl = card.querySelector('[data-student-id]');
    var cidEl = card.querySelector('[data-course-id]');
    var studentId = idEl ? idEl.getAttribute('data-student-id') : '';
    var cid = cidEl ? cidEl.getAttribute('data-course-id') : (window.currentActiveCourseId || '');
    var nameEl = card.querySelector('.summary-mobile-card-name');
    var name = nameEl ? (nameEl.textContent || '').replace(/ลาออก\s*$/,'').trim() : '';

    if(!studentId && cid){
      var students = [];
      try { if (typeof window.getCourseStudents === 'function') students = window.getCourseStudents(cid, {ignoreActionFilter:true}) || []; } catch(e){}
      if (!students.length && window.state && window.state.students) students = window.state.students;
      for (var i = 0; i < students.length; i++) {
        if (students[i].name === name) { studentId = students[i].id; break; }
      }
    }
    return { studentId: studentId, cid: cid, name: name };
  }

  /* ── กันพื้นหลังไม่มืด/ยังเลื่อนได้ตอนเปิด popup มา/สาย/ขาด/ลา:
     สร้าง backdrop สีเข้มคลุมทั้งจอ + ล็อกสกอลล์ของพื้นที่เนื้อหาไว้ชั่วคราว
     แล้วคืนสภาพให้ตรงทุกครั้งที่ปิด (กันไม่ให้เกิดปัญหาค้างแบบปุ่ม X เดิม) ── */
  function getScrollHost(){
    var hdr = document.getElementById('main-header');
    if(hdr && hdr.nextElementSibling && hdr.nextElementSibling.classList.contains('overflow-y-auto')){
      return hdr.nextElementSibling;
    }
    /* สำรอง: หา .flex-1.overflow-y-auto ที่อยู่ใน <main> เท่านั้น (กัน match ผิดตัวกับแถบเมนูด้านข้าง) */
    var main = document.querySelector('main');
    return main ? main.querySelector('.flex-1.overflow-y-auto') : null;
  }

  function ensureBackdrop(){
    var bd = document.getElementById('teacher-att-stat-backdrop');
    if(!bd){
      bd = document.createElement('div');
      bd.id = 'teacher-att-stat-backdrop';
      bd.style.position = 'fixed';
      bd.style.inset = '0';
      bd.style.background = 'rgba(15,23,42,.55)';
      bd.style.zIndex = '2147483646';
      bd.style.display = 'none';
      bd.addEventListener('click', function(){ window.closeTeacherAttStatModal && window.closeTeacherAttStatModal(); });
      document.body.appendChild(bd);
    }
    return bd;
  }

  function lockBackgroundScroll(){
    var host = getScrollHost();
    if(host && !host.__shAttScrollLocked){
      host.__shAttScrollLocked = true;
      host.__shPrevOverflow = host.style.overflow;
      host.__shPrevTouchAction = host.style.touchAction;
      host.style.overflow = 'hidden';
      host.style.touchAction = 'none';
    }
  }
  function unlockBackgroundScroll(){
    var host = getScrollHost();
    if(host && host.__shAttScrollLocked){
      host.__shAttScrollLocked = false;
      host.style.overflow = host.__shPrevOverflow || '';
      host.style.touchAction = host.__shPrevTouchAction || '';
    }
  }

  function openPopup(studentId, cid, type, name){
    if(!studentId || !cid || !type) return;
    var cfg = {
      present:{ label:'มา',  color:'#059669', icon:'fa-circle-check', bg:'#ecfdf5' },
      late:   { label:'สาย', color:'#d97706', icon:'fa-clock',         bg:'#fffbeb' },
      absent: { label:'ขาด', color:'#e11d48', icon:'fa-circle-xmark',  bg:'#fff1f2' },
      leave:  { label:'ลา',  color:'#7c3aed', icon:'fa-user-clock',    bg:'#f5f3ff' }
    }[type];
    if(!cfg) return;

    var history = (window.state && window.state.attendance && window.state.attendance[cid]) || {};
    var dates = [];
    Object.keys(history).sort().forEach(function(d){
      var rec = (history[d] && history[d].records) || {};
      if(rec[studentId] === type){
        var reason = (type === 'leave' && history[d].leaveReasons) ? (history[d].leaveReasons[studentId] || '') : '';
        dates.push({ date:d, reason:reason });
      }
    });

    var modal = document.getElementById('teacher-att-stat-modal');
    if(!modal) return;

    /* ย้าย modal ไปเป็น element สุดท้ายของ body เสมอ กันกรณีถูกวาดซ้อนอยู่หลังกล่องอื่น */
    document.body.appendChild(modal);
    modal.style.zIndex = '2147483647';

    var iconEl  = document.getElementById('teacher-att-stat-modal-icon');
    var titleEl = document.getElementById('teacher-att-stat-modal-title');
    var subEl   = document.getElementById('teacher-att-stat-modal-sub');
    var bodyEl  = document.getElementById('teacher-att-stat-modal-body');
    var hdr     = document.getElementById('teacher-att-stat-modal-header');
    if(iconEl){ iconEl.className = 'fas ' + cfg.icon; iconEl.style.color = cfg.color; }
    if(titleEl) titleEl.textContent = cfg.label + (name ? ' — ' + name : '');
    if(subEl){ subEl.textContent = dates.length + ' ครั้ง'; subEl.style.color = cfg.color; }
    if(hdr) hdr.style.background = cfg.bg;
    if(bodyEl){
      bodyEl.innerHTML = dates.length ? dates.map(function(item, i){
        var r = item.reason ? ' <span style="color:#94a3b8;font-weight:600">— ' + esc(item.reason) + '</span>' : '';
        return '<div style="padding:.55rem 0;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:.6rem">'
          + '<span style="background:' + cfg.bg + ';color:' + cfg.color + ';font-weight:900;font-size:.72rem;border-radius:.4rem;padding:.15rem .45rem;flex-shrink:0">' + (i + 1) + '</span>'
          + '<span style="color:#334155;font-weight:600">' + fmtDate(item.date) + r + '</span></div>';
      }).join('') : '<div style="text-align:center;color:#94a3b8;padding:2rem 0;font-weight:700">ไม่มีข้อมูล</div>';
    }

    modal.style.display = 'flex';
    modal.style.left = '50%';
    modal.style.top = '30%';
    modal.style.transform = 'translateX(-50%)';

    var backdrop = ensureBackdrop();
    backdrop.style.display = 'block';
    lockBackgroundScroll();
  }

  window.closeTeacherAttStatModal = function(){
    var m = document.getElementById('teacher-att-stat-modal');
    if(m) m.style.display = 'none';
    var backdrop = document.getElementById('teacher-att-stat-backdrop');
    if(backdrop) backdrop.style.display = 'none';
    unlockBackgroundScroll();
  };

  /* Capture phase = ทำงานก่อนเสมอ ไม่ว่า patch เก่าตัวไหนจะดักคลิกไว้ก่อน */
  document.addEventListener('click', function(e){
    var stat = e.target.closest && e.target.closest('.summary-mobile-stat');
    if(!stat) return;

    var text = (stat.textContent || '').replace(/\s+/g, '');
    var type = null;
    if (/มา$/.test(text)) type = 'present';
    else if (/สาย$/.test(text)) type = 'late';
    else if (/ขาด$/.test(text)) type = 'absent';
    else if (/ลา$/.test(text)) type = 'leave';
    if(!type) return;

    e.stopPropagation();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    e.preventDefault();

    var card = stat.closest('.summary-mobile-card');
    if(!card) return;
    var info = findStudent(card);
    openPopup(info.studentId, info.cid, type, info.name);
  }, true);

  /* ปิดด้วย Escape เผื่อยังไม่มี handler */
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') window.closeTeacherAttStatModal && window.closeTeacherAttStatModal();
  });
})();
