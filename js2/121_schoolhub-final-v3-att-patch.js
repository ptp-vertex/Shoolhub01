
(function(){
  if(window.__shFinalV3Loaded) return;
  window.__shFinalV3Loaded = true;

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function txt(el){ return el?(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim():''; }
  function splitAtt(s){ var p=String(s||'').split('/'); return [parseInt(p[0])||0,parseInt(p[1])||0,parseInt(p[2])||0,parseInt(p[3])||0]; }

  /* Format date → Thai */
  function fmtDate(d){
    var months=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    var p=String(d).split('-');
    if(p.length!==3) return d;
    return parseInt(p[2],10)+' '+months[parseInt(p[1],10)-1]+' '+(parseInt(p[0],10)+543);
  }

  /* ── CORE: show popup using teacher-att-stat-modal ── */
  window.teacherShowAttStat = function(e, studentId, cidVal, type){
    e.stopPropagation();
    e.preventDefault();
    var cid = cidVal || window.currentActiveCourseId;
    if(!cid || !studentId) return;

    var cfg = {
      present:{ label:'มา',  color:'#059669', icon:'fa-circle-check', bg:'#ecfdf5' },
      late:   { label:'สาย', color:'#d97706', icon:'fa-clock',         bg:'#fffbeb' },
      absent: { label:'ขาด', color:'#e11d48', icon:'fa-circle-xmark',  bg:'#fff1f2' },
      leave:  { label:'ลา',  color:'#7c3aed', icon:'fa-user-clock',    bg:'#f5f3ff' }
    }[type];
    if(!cfg) return;

    /* build date list from state.attendance */
    var history = (window.state && window.state.attendance && window.state.attendance[cid]) || {};
    var dates = [];
    Object.keys(history).sort().forEach(function(d){
      var rec = (history[d]&&history[d].records) || {};
      if(rec[studentId] === type){
        var reason = (type==='leave' && history[d].leaveReasons) ? (history[d].leaveReasons[studentId]||'') : '';
        dates.push({ date:d, reason:reason });
      }
    });

    /* find student name */
    var studentName = '';
    try {
      var sts = (typeof window.getCourseStudents==='function') ? (window.getCourseStudents(cid,{ignoreActionFilter:true})||[]) : [];
      if(!sts.length && window.state && window.state.students) sts = window.state.students;
      for(var i=0;i<sts.length;i++){
        if(String(sts[i].id)===String(studentId)){ studentName=sts[i].name||''; break; }
      }
    } catch(er){}

    /* populate teacher-att-stat-modal */
    var modal = document.getElementById('teacher-att-stat-modal');
    if(!modal) return;
    var iconEl  = document.getElementById('teacher-att-stat-modal-icon');
    var titleEl = document.getElementById('teacher-att-stat-modal-title');
    var subEl   = document.getElementById('teacher-att-stat-modal-sub');
    var bodyEl  = document.getElementById('teacher-att-stat-modal-body');
    if(iconEl){ iconEl.className='fas '+cfg.icon; iconEl.style.color=cfg.color; }
    if(titleEl) titleEl.textContent = cfg.label + (studentName ? ' — '+studentName : '');
    if(subEl){ subEl.textContent = dates.length+' ครั้ง'; subEl.style.color=cfg.color; }
    var hdr = document.getElementById('teacher-att-stat-modal-header');
    if(hdr) hdr.style.background = cfg.bg;

    if(bodyEl){
      if(!dates.length){
        bodyEl.innerHTML='<div style="text-align:center;color:#94a3b8;padding:2rem 0;font-weight:700">ไม่มีข้อมูล</div>';
      } else {
        bodyEl.innerHTML = dates.map(function(item,i){
          var r = item.reason ? ' <span style="color:#94a3b8;font-weight:600">— '+esc(item.reason)+'</span>' : '';
          return '<div style="padding:.55rem 0;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:.6rem">'
            +'<span style="background:'+cfg.bg+';color:'+cfg.color+';font-weight:900;font-size:.72rem;border-radius:.4rem;padding:.15rem .45rem;flex-shrink:0">'+(i+1)+'</span>'
            +'<span style="color:#334155;font-weight:600">'+fmtDate(item.date)+r+'</span>'
            +'</div>';
        }).join('');
      }
    }

    /* show modal */
    modal.style.display = 'flex';

    /* reset position */
    modal.style.left = '50%';
    modal.style.top = '30%';
    modal.style.transform = 'translateX(-50%)';
  };

  /* Ensure close function exists */
  if(!window.closeTeacherAttStatModal){
    window.closeTeacherAttStatModal = function(){
      var m=document.getElementById('teacher-att-stat-modal');
      if(m) m.style.display='none';
    };
  }

  /* ── Ensure mobile cards box ── */
  function ensureBox(){
    var b=document.getElementById('course-summary-mobile-cards');
    if(!b){
      var wrap=document.querySelector('#course-tab-overview .overflow-x-auto');
      if(wrap){ b=document.createElement('div'); b.id='course-summary-mobile-cards'; wrap.parentNode.insertBefore(b,wrap.nextSibling); }
    }
    return b;
  }

  /* ── กันไม่ให้ DOM ของการ์ดถูกสร้างใหม่ทับขณะที่นิ้วผู้ใช้กำลังแตะปุ่มอยู่
     (สาเหตุที่กดปุ่ม มา/สาย/ขาด/ลา แล้วบางครั้งไม่ติด ต้องกด 2 ครั้ง) ── */
  function trackTouchGuard(box){
    if(!box || box.__shTouchGuardBound) return;
    box.__shTouchGuardBound = true;
    function release(){
      box.__shTouchActive = false;
      if(box.__shPendingHtml != null){
        var pending = box.__shPendingHtml;
        box.__shPendingHtml = null;
        if(box.innerHTML !== pending) box.innerHTML = pending;
      }
    }
    box.addEventListener('touchstart', function(){ box.__shTouchActive = true; }, {passive:true});
    box.addEventListener('touchend', function(){ setTimeout(release, 350); }, {passive:true});
    box.addEventListener('touchcancel', release, {passive:true});
  }

  /* ── Build final mobile cards (v3: uses data-student-id from table) ── */
  function buildV3Cards(){
    if(!window.matchMedia||!window.matchMedia('(max-width:767px)').matches) return;
    var table=document.getElementById('course-summary-table');
    var box=ensureBox();
    if(!table||!box) return;
    trackTouchGuard(box);
    var rows=[].slice.call(table.querySelectorAll('tbody tr'));
    if(!rows.length){ box.innerHTML=''; return; }
    var ths=[].slice.call(table.querySelectorAll('thead th'));
    var cid = String(window.currentActiveCourseId||'');

    var totalIdx=ths.length-2, gradeIdx=ths.length-1, bonusIdx=-1, starIdx=-1;
    for(var ci=0;ci<ths.length;ci++){
      var hc=ths[ci].className||'';
      if(hc.indexOf('summary-total-col')>=0) totalIdx=ci;
      else if(hc.indexOf('summary-grade-col')>=0) gradeIdx=ci;
      else if(hc.indexOf('sh-bonus-col')>=0) bonusIdx=ci;
      else if(hc.indexOf('sh-star-col')>=0) starIdx=ci;
    }

    var __html = rows.map(function(row, idx){
      var cells=[].slice.call(row.children);
      var texts=cells.map(txt);
      var no=texts[0]||String(idx+1);
      var code=texts[1]||'-';
      /* strip withdrawn badge from name */
      var name=(texts[2]||'-').replace(/\s*ลาออก\s*$/, '').trim();

      /* extract studentId from any cell that has data-student-id */
      var studentId='';
      for(var ci2=0;ci2<cells.length;ci2++){
        var sid=cells[ci2].getAttribute?cells[ci2].getAttribute('data-student-id'):'';
        if(sid){ studentId=sid; break; }
      }

      /* find attendance column */
      var attIdx=-1;
      for(var ai=3;ai<texts.length;ai++){
        if(/^\d+\s*\/\s*\d+\s*\/\s*\d+/.test(texts[ai])){ attIdx=ai; break; }
      }
      if(attIdx<0) attIdx=4;
      var att=splitAtt(texts[attIdx]);
      var room=attIdx>3?(texts[3]||''):'-';

      var total=cells[totalIdx]?txt(cells[totalIdx]):'0';
      var grade=cells[gradeIdx]?txt(cells[gradeIdx]):'-';
      var bonus=bonusIdx>=0&&cells[bonusIdx]?txt(cells[bonusIdx]):'-';
      var stars=starIdx>=0&&cells[starIdx]?txt(cells[starIdx]).replace(/[^\d]/g,''):'-';
      if(stars===''||stars==='0') stars='-';

      var withdrawn=row.classList.contains('schoolhub-withdrawn-row')||total==='ลาออก'||grade==='ลาออก';
      var numStr=String(no).replace(/^#/,'');

      /* meta line */
      var metaParts=[];
      if(code&&code!=='-') metaParts.push(code);
      if(withdrawn) metaParts.push('ลาออก');
      else if(room&&room!=='-') metaParts.push(room);
      var metaStr=metaParts.join('  ·  ');

      var __grade = (window.__shGetStudentGrade ? window.__shGetStudentGrade(code) : '') || '-';
      var hdrHtml='<div style="margin-bottom:.5rem">'
        +'<div style="font-size:.68rem;font-weight:800;color:#94a3b8;letter-spacing:.02em">ลำดับ #'+esc(numStr)+'</div>'
        +'<div style="font-size:.98rem;font-weight:900;color:#0f172a;line-height:1.35;margin-top:.12rem">'+esc(name)+(withdrawn?' <span style="color:#ef4444;font-size:.68rem;font-weight:800">(ลาออก)</span>':'')+'</div>'
        +'<div style="font-size:.76rem;font-weight:700;color:#64748b;margin-top:.28rem">รหัสนักเรียน '+esc(code&&code!=='-'?code:'-')+'</div>'
        +'<div style="font-size:.76rem;font-weight:700;color:#64748b">ชั้นปี '+esc(__grade)+'</div>'
        +'</div>';

      /* stat badges — onclick passes studentId + cid directly */
      var ocBase='window.teacherShowAttStat(event,\''+esc(studentId)+'\',\''+esc(cid)+'\',\'';
      var statsHtml='<div class="summary-mobile-stats">'
        +'<div class="summary-mobile-stat text-emerald-600" onclick="'+ocBase+'present\')"><b>'+esc(att[0])+'</b>มา</div>'
        +'<div class="summary-mobile-stat text-amber-600" onclick="'+ocBase+'late\')"><b>'+esc(att[1])+'</b>สาย</div>'
        +'<div class="summary-mobile-stat text-rose-600" onclick="'+ocBase+'absent\')"><b>'+esc(att[2])+'</b>ขาด</div>'
        +'<div class="summary-mobile-stat" style="color:#7c3aed" onclick="'+ocBase+'leave\')"><b>'+esc(att[3]||0)+'</b>ลา</div>'
        +'</div>';

      /* total bar */
      var _p=String(total).split('+');
      var totalInner='รวม '+esc(_p[0])+(_p.length>1?'<sup style="font-size:.6em;color:#4ade80;font-weight:900;vertical-align:super;line-height:1">+'+esc(_p[1])+'</sup>':'');
      var totalHtml='<div class="summary-mobile-total"'+(withdrawn?' style="justify-content:center"':'')+'>'
        +'<span>'+totalInner+'</span>'
        +'<span>เกรด '+esc(grade)+'</span>'
        +'</div>';

      /* WITHDRAWN: no plan cards */
      if(withdrawn){
        return '<div class="summary-mobile-card" style="opacity:.48">'
          +hdrHtml+statsHtml
          +'<div style="display:flex;align-items:center;justify-content:center;background:#0f172a;color:#f8fafc;border-radius:.9rem;font-size:.9rem;font-weight:900;letter-spacing:.06em;padding:.65rem .85rem;margin-top:.75rem">ลาออก</div>'
          +totalHtml+'</div>';
      }

      /* NORMAL: plan cards */
      var planHtml='';
      for(var i=attIdx+1;i<totalIdx;i++){
        if(i===bonusIdx||i===starIdx) continue;
        var h=ths[i];
        var hTitle=(h&&h.getAttribute)?h.getAttribute('title')||'':'';
        var label=hTitle?hTitle.replace(/^คลิกเพื่อดูรายละเอียด[: ]*/,'').split('|').map(function(x){return x.trim();}).join(' '):(txt(h)||('งาน '+(i-attIdx)));
        var val=texts[i]||'-';
        var isMiss=val==='-'&&!!(cells[i]&&cells[i].querySelector&&cells[i].querySelector('.text-rose-500,.text-rose-600'));
        var valHtml=(isMiss||String(val).trim().toUpperCase()==='X')?'<span class="schoolhub-mobile-missing-score schoolhub-missing-score-clickable">X</span>':esc(val);
        var weekNum=(label.match(/\d+/)||[''])[0];
        var weekLabel=weekNum?('สัปดาห์ที่ '+weekNum):(label.split(' ')[0]||label);
        var titleLabel=label.replace(/^สัปดาห์(ที่)?\s*\d+\s*/,'').trim()||label;
        planHtml+='<div class="summary-mobile-plan">'
          +'<div class="summary-mobile-plan-top"><span>'+esc(weekLabel)+'</span><span>'+valHtml+'</span></div>'
          +'<div class="summary-mobile-plan-title">'+esc(titleLabel)+'</div>'
          +'</div>';
      }
      if(!planHtml) planHtml='<div class="col-span-2 text-center text-slate-400 text-sm font-bold py-3">ยังไม่มีแผนคะแนน</div>';

      var bonusStarHtml='<div class="summary-mobile-bonus-star">'
        +'<div class="summary-mobile-bonus-cell" onclick="if(window.shOvShowBonusDetail)window.shOvShowBonusDetail(this)"><span>+โบนัส</span><b>'+esc(bonus)+'</b></div>'
        +'<div class="summary-mobile-star-cell"><span>⭐ดาว</span><b>'+esc(stars)+'</b></div>'
        +'</div>';

      return '<div class="summary-mobile-card">'
        +hdrHtml+statsHtml
        +'<div class="summary-mobile-plans">'+planHtml+'</div>'
        +bonusStarHtml+totalHtml+'</div>';
    }).join('');

    /* ถ้านิ้วผู้ใช้กำลังแตะอยู่ในการ์ด ให้รอสร้าง DOM ใหม่จนกว่าจะปล่อยนิ้ว
       และเขียนทับ DOM เฉพาะตอนที่เนื้อหาเปลี่ยนจริง ๆ เท่านั้น ลดโอกาสที่ปุ่มจะถูกสร้างใหม่ทับขณะกด */
    if(box.__shTouchActive){ box.__shPendingHtml = __html; return; }
    if(box.innerHTML !== __html) box.innerHTML = __html;
  }

  // ให้โค้ดจุดอื่นที่เรียก window.buildMobileOverviewCards() ยังใช้งานได้ตามปกติ
  // แต่ชี้มาที่ตัวเรนเดอร์การ์ดเวอร์ชันสุดท้าย (v3) เพียงเวอร์ชันเดียว ไม่ให้มีของเก่าปนอีก
  window.buildMobileOverviewCards = buildV3Cards;

  /* ── Hook at 280ms (after v2's 260ms) ── */
  function hookV3(){
    if(typeof window.renderCourseOverview==='function'&&!window.renderCourseOverview.__shV3Hooked){
      var old=window.renderCourseOverview;
      var fn=function(){ var r=old.apply(this,arguments); setTimeout(buildV3Cards,280); return r; };
      fn.__shV3Hooked=true;
      window.renderCourseOverview=fn;
    }
  }
  hookV3();
  document.addEventListener('DOMContentLoaded',function(){ hookV3(); setTimeout(buildV3Cards,450); });
  window.addEventListener('resize',function(){ setTimeout(buildV3Cards,150); });

  if(typeof window.switchCourseTab==='function'&&!window.switchCourseTab.__shV3TabHooked){
    var oldSw=window.switchCourseTab;
    var sw=function(tabId){ var r=oldSw.apply(this,arguments); if(tabId==='overview') setTimeout(buildV3Cards,280); return r; };
    sw.__shV3TabHooked=true;
    window.switchCourseTab=sw;
  }

  /* close on Escape (in case not already bound) */
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') window.closeTeacherAttStatModal&&window.closeTeacherAttStatModal(); });

})();
