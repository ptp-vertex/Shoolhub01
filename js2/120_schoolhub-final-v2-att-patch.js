
(function(){
  if(window.__shFinalV2Loaded) return;
  window.__shFinalV2Loaded = true;

  /* helpers */
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function txt(el){ return el?(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim():''; }
  function splitAtt(s){ var p=String(s||'').split('/'); return [parseInt(p[0])||0,parseInt(p[1])||0,parseInt(p[2])||0,parseInt(p[3])||0]; }

  /* ── Click handler: show stat detail using share modal ── */
  window.teacherShowAttStat = function(e, code, type){
    e.stopPropagation();
    e.preventDefault();
    var cid = window.currentActiveCourseId;
    if(!cid) return;

    /* find student ID by code */
    var students = [];
    try{ if(typeof window.getCourseStudents==='function') students=window.getCourseStudents(cid)||[]; }catch(err){}
    if(!students.length && window.state && window.state.students) students=window.state.students;
    var studentId=null, studentName='';
    for(var i=0;i<students.length;i++){
      if(students[i].code===code){ studentId=students[i].id; studentName=students[i].name||''; break; }
    }
    if(!studentId) return;

    /* build attendanceDetail from state.attendance (same structure as share) */
    var history=(window.state&&window.state.attendance&&window.state.attendance[cid])||{};
    var detail={present:[],late:[],absent:[],leave:[]};
    Object.keys(history).sort().forEach(function(d){
      var rec=(history[d]&&history[d].records)||{};
      var st=rec[studentId];
      if(st==='present') detail.present.push(d);
      else if(st==='late') detail.late.push(d);
      else if(st==='absent') detail.absent.push(d);
      else if(st==='leave'){
        var reason=(history[d].leaveReasons&&history[d].leaveReasons[studentId])||'';
        detail.leave.push({date:d,reason:reason});
      }
    });

    /* set share data and open share modal */
    window.__studentShareCurrentData={attendanceDetail:detail};
    if(typeof window.showStudentShareStatDetail==='function'){
      window.showStudentShareStatDetail(type);
      /* optionally add student name to title */
      var titleEl=document.getElementById('student-share-detail-title');
      if(titleEl&&studentName) titleEl.innerHTML=titleEl.innerHTML+' — <span style="font-size:.85em;color:#64748b">'+esc(studentName)+'</span>';
    }
  };

  /* ── Ensure mobile cards box ── */
  function ensureBox(){
    var b=document.getElementById('course-summary-mobile-cards');
    if(!b){
      var wrap=document.querySelector('#course-tab-overview .overflow-x-auto');
      if(wrap){ b=document.createElement('div'); b.id='course-summary-mobile-cards'; wrap.parentNode.insertBefore(b,wrap.nextSibling); }
    }
    return b;
  }

  /* ── Build final correct mobile cards ── */
  function buildFinalCards(){
    if(!window.matchMedia||!window.matchMedia('(max-width:767px)').matches) return;
    var table=document.getElementById('course-summary-table');
    var box=ensureBox();
    if(!table||!box) return;
    var rows=[].slice.call(table.querySelectorAll('tbody tr'));
    if(!rows.length){box.innerHTML='';return;}
    var ths=[].slice.call(table.querySelectorAll('thead th'));

    var totalIdx=ths.length-2,gradeIdx=ths.length-1,bonusIdx=-1,starIdx=-1;
    for(var ci=0;ci<ths.length;ci++){
      var hc=ths[ci].className||'';
      if(hc.indexOf('summary-total-col')>=0) totalIdx=ci;
      else if(hc.indexOf('summary-grade-col')>=0) gradeIdx=ci;
      else if(hc.indexOf('sh-bonus-col')>=0) bonusIdx=ci;
      else if(hc.indexOf('sh-star-col')>=0) starIdx=ci;
    }

    box.innerHTML=rows.map(function(row,idx){
      var cells=[].slice.call(row.children);
      var texts=cells.map(txt);
      var no=texts[0]||String(idx+1);
      var code=texts[1]||'-';
      /* name cell may include withdrawn badge text: strip trailing badge text */
      var nameFull=texts[2]||'-';
      var name=nameFull.replace(/\s*ลาออก\s*$/,'').trim();

      var attIdx=-1;
      for(var ai=3;ai<texts.length;ai++){
        if(/^\d+\s*\/\s*\d+\s*\/\s*\d+/.test(texts[ai])){attIdx=ai;break;}
      }
      if(attIdx<0) attIdx=4;
      var att=splitAtt(texts[attIdx]);
      var room=attIdx>3?texts[3]||'':'-';

      var total=cells[totalIdx]?txt(cells[totalIdx]):'0';
      var grade=cells[gradeIdx]?txt(cells[gradeIdx]):'-';
      var bonus=bonusIdx>=0&&cells[bonusIdx]?txt(cells[bonusIdx]):'-';
      var stars=starIdx>=0&&cells[starIdx]?txt(cells[starIdx]).replace(/[^\d]/g,''):'-';
      if(stars===''||stars==='0') stars='-';

      var withdrawn=row.classList.contains('schoolhub-withdrawn-row')||total==='ลาออก'||grade==='ลาออก';
      var numStr=String(no).replace(/^#/,'');

      /* meta line: code · room (or · ลาออก for withdrawn) */
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

      /* stat badges with onclick */
      var statsHtml='<div class="summary-mobile-stats">'
        +'<div class="summary-mobile-stat text-emerald-600" onclick="window.teacherShowAttStat(event,\''+esc(code)+'\',\'present\')"><b>'+esc(att[0])+'</b>มา</div>'
        +'<div class="summary-mobile-stat text-amber-600" onclick="window.teacherShowAttStat(event,\''+esc(code)+'\',\'late\')"><b>'+esc(att[1])+'</b>สาย</div>'
        +'<div class="summary-mobile-stat text-rose-600" onclick="window.teacherShowAttStat(event,\''+esc(code)+'\',\'absent\')"><b>'+esc(att[2])+'</b>ขาด</div>'
        +'<div class="summary-mobile-stat" style="color:#7c3aed" onclick="window.teacherShowAttStat(event,\''+esc(code)+'\',\'leave\')"><b>'+esc(att[3]||0)+'</b>ลา</div>'
        +'</div>';

      var _p=String(total).split('+');
      var totalHtml='<div class="summary-mobile-total"'+(withdrawn?' style="justify-content:center"':'')+'>'
        +'<span>รวม '+esc(_p[0])+(_p.length>1?'<sup style="font-size:.6em;color:#4ade80;font-weight:900;vertical-align:super;line-height:1">+'+esc(_p[1])+'</sup>':'')+'</span>'
        +(withdrawn?'':('<span>เกรด '+esc(grade)+'</span>'))
        +'</div>';

      /* ── WITHDRAWN: simple layout only (no plan cards) ── */
      if(withdrawn){
        return '<div class="summary-mobile-card" style="opacity:.48">'
          +hdrHtml+statsHtml
          +'<div style="display:flex;align-items:center;justify-content:center;background:#0f172a;color:#f8fafc;border-radius:.9rem;font-size:.9rem;font-weight:900;letter-spacing:.06em;padding:.65rem .85rem;margin-top:.75rem">ลาออก</div>'
          +totalHtml
          +'</div>';
      }

      /* ── NORMAL: plan cards + bonus/star ── */
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
        +bonusStarHtml
        +'<div class="summary-mobile-total"><span>รวม '+esc(_p[0])+(_p.length>1?'<sup style="font-size:.6em;color:#4ade80;font-weight:900;vertical-align:super;line-height:1">+'+esc(_p[1])+'</sup>':'')+'</span><span>เกรด '+esc(grade)+'</span></div>'
        +'</div>';
    }).join('');
  }

  /* ── Hook renderCourseOverview at 260ms (after all previous patches: 180-200ms) ── */
  function hookFinal(){
    if(typeof window.renderCourseOverview==='function'&&!window.renderCourseOverview.__shFinalV2Hooked){
      var old=window.renderCourseOverview;
      var fn=function(){ var r=old.apply(this,arguments); setTimeout(buildFinalCards,260); return r; };
      fn.__shFinalV2Hooked=true;
      window.renderCourseOverview=fn;
    }
  }
  hookFinal();
  document.addEventListener('DOMContentLoaded',function(){ hookFinal(); setTimeout(buildFinalCards,400); });
  window.addEventListener('resize',function(){ setTimeout(buildFinalCards,130); });

  /* hook switchCourseTab at 260ms */
  if(typeof window.switchCourseTab==='function'&&!window.switchCourseTab.__shFinalV2TabHooked){
    var oldSw=window.switchCourseTab;
    var sw=function(tabId){ var r=oldSw.apply(this,arguments); if(tabId==='overview') setTimeout(buildFinalCards,260); return r; };
    sw.__shFinalV2TabHooked=true;
    window.switchCourseTab=sw;
  }

})();
