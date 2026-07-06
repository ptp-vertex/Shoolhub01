
(function(){
  if(window.__shMobileCardOverride) return;
  window.__shMobileCardOverride = true;

  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function txt(el){ return el?(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim():''; }
  function splitAtt(v){
    var m=String(v||'').match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)(?:\s*\/\s*(\d+))?/);
    return m?[m[1],m[2],m[3],m[4]||'0']:['0','0','0','0'];
  }
  function parseHdr(th,fb){
    var ta=(th&&th.getAttribute&&th.getAttribute('title'))||'';
    var week='',title='';
    if(ta){
      var p=ta.replace(/^คลิกเพื่อดูรายละเอียด:\s*/,'').split('|').map(function(x){return x.trim();});
      week=(p[0]||'').replace(/^สัปดาห์\s*/,'').trim();
      title=p[1]||'';
    }
    if(!week){var t=txt(th);var wm=t.match(/\d+/);week=wm?wm[0]:String(fb+1);}
    if(!title) title=txt(th).replace(/^สัปดาห์\s*/,'').trim()||'งาน';
    return {week:week,title:title};
  }
  function ensureBox(){
    var table=document.getElementById('course-summary-table');
    var box=document.getElementById('course-summary-mobile-cards');
    if(!box){
      box=document.createElement('div');
      box.id='course-summary-mobile-cards';
      var wrap=table&&(table.closest('.overflow-x-auto')||table.parentNode);
      if(wrap&&wrap.parentNode) wrap.parentNode.insertBefore(box,wrap.nextSibling);
      else if(table) table.parentNode.insertBefore(box,table.nextSibling);
    }
    return box;
  }

  /* stop all clicks from .summary-mobile-stats propagating to any global handler */
  var _statsGuardSet = false;
  function installStatsClickGuard(){
    if(_statsGuardSet) return;
    _statsGuardSet = true;
    document.addEventListener('click', function(e){
      if(e.target && e.target.closest && e.target.closest('.summary-mobile-stats')){
        e.stopPropagation();
        if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      }
    }, true); /* capture phase — fires before any delegated handler */
  }
  // installStatsClickGuard(); // disabled: was blocking มา/สาย/ขาด/ลา popup clicks

  function buildCards(){
    if(!window.matchMedia||!window.matchMedia('(max-width:767px)').matches) return;
    var table=document.getElementById('course-summary-table');
    var box=ensureBox();
    if(!table||!box) return;
    var rows=[].slice.call(table.querySelectorAll('tbody tr'));
    if(!rows.length){box.innerHTML='';return;}
    var ths=[].slice.call(table.querySelectorAll('thead th'));

    var totalIdx=ths.length-2, gradeIdx=ths.length-1, bonusIdx=-1, starIdx=-1;
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

      var no    = texts[0]||String(idx+1);
      var code  = texts[1]||'-';
      var name  = texts[2]||'-';

      /* find attendance column */
      var attIdx=-1;
      for(var ai=3;ai<texts.length;ai++){
        if(/^\d+\s*\/\s*\d+\s*\/\s*\d+/.test(texts[ai])){attIdx=ai;break;}
      }
      if(attIdx<0) attIdx=4;
      var att=splitAtt(texts[attIdx]);
      var room=attIdx>3?texts[3]||'-':'-';

      var total = cells[totalIdx]?txt(cells[totalIdx]):'0';
      var grade = cells[gradeIdx]?txt(cells[gradeIdx]):'-';
      var bonus = bonusIdx>=0&&cells[bonusIdx]?txt(cells[bonusIdx]):'-';
      var stars = starIdx>=0&&cells[starIdx]?txt(cells[starIdx]).replace(/[^\d]/g,''):'-';
      if(stars===''||stars==='0') stars='-';

      var withdrawn = row.classList.contains('schoolhub-withdrawn-row')
        || total==='ลาออก' || grade==='ลาออก';

      var numStr=String(no).replace(/^#/,'');

      var metaParts=[];
      if(code&&code!=='-') metaParts.push(code);
      if(room&&room!=='-') metaParts.push(room);
      var metaStr=metaParts.join('  ·  ');

      /* ── new header block: 4 บรรทัดแยกกันชัดเจน ── */
      var __grade = (window.__shGetStudentGrade ? window.__shGetStudentGrade(code) : '') || '-';
      var hdrHtml=''
        +'<div style="margin-bottom:.5rem">'
        +'<div style="font-size:.68rem;font-weight:800;color:#94a3b8;letter-spacing:.02em">ลำดับ #'+esc(numStr)+'</div>'
        +'<div style="font-size:.98rem;font-weight:900;color:#0f172a;line-height:1.35;margin-top:.12rem">'+esc(name)+(withdrawn?' <span style="color:#ef4444;font-size:.68rem;font-weight:800">(ลาออก)</span>':'')+'</div>'
        +'<div style="font-size:.76rem;font-weight:700;color:#64748b;margin-top:.28rem">รหัสนักเรียน '+esc(code&&code!=='-'?code:'-')+'</div>'
        +'<div style="font-size:.76rem;font-weight:700;color:#64748b">ชั้นปี '+esc(__grade)+'</div>'
        +'</div>';

      /* ── stats: onclick=stopPropagation on container prevents any global popup ── */
      var statsHtml='<div class="summary-mobile-stats" onclick="event.stopPropagation();event.preventDefault()" style="pointer-events:all">'
        +'<div class="summary-mobile-stat text-emerald-600"><b>'+esc(att[0])+'</b>มา</div>'
        +'<div class="summary-mobile-stat text-amber-600"><b>'+esc(att[1])+'</b>สาย</div>'
        +'<div class="summary-mobile-stat text-rose-600"><b>'+esc(att[2])+'</b>ขาด</div>'
        +'<div class="summary-mobile-stat" style="color:#7c3aed"><b>'+esc(att[3]||0)+'</b>ลา</div>'
        +'</div>';

      /* ── total bar ── */
      var _p=String(total).split('+');
      var totalHtml='<div class="summary-mobile-total"'
        +(withdrawn?' style="justify-content:center"':'')+'>'
        +'<span>รวม '+esc(_p[0])+(_p.length>1?'<sup style="font-size:.6em;color:#4ade80;font-weight:900;vertical-align:super;line-height:1">+'+esc(_p[1])+'</sup>':'')+'</span>'
        +'<span>เกรด '+esc(grade)+'</span>'
        +'</div>';

      if(withdrawn){
        return '<div class="summary-mobile-card" style="opacity:.48">'
          +hdrHtml+statsHtml
          +'<div style="display:flex;align-items:center;justify-content:center;background:#0f172a;color:#f8fafc;'
          +'border-radius:.9rem;font-size:.9rem;font-weight:900;letter-spacing:.06em;'
          +'padding:.65rem .85rem;margin-top:.75rem">ลาออก</div>'
          +totalHtml
          +'</div>';
      }

      /* ── plan cards ── */
      var planHtml='';
      for(var i=attIdx+1;i<totalIdx;i++){
        if(i===bonusIdx||i===starIdx) continue;
        var h=parseHdr(ths[i],i-attIdx-1);
        var value=texts[i]||'-';
        var isMiss=value==='-'&&!!(cells[i]&&cells[i].querySelector&&cells[i].querySelector('.text-rose-500,.text-rose-600'));
        var valHtml=(isMiss||String(value).trim().toUpperCase()==='X')
          ?'<span class="schoolhub-mobile-missing-score schoolhub-missing-score-clickable">X</span>':esc(value);
        planHtml+='<div class="summary-mobile-plan">'
          +'<div class="summary-mobile-plan-top"><span>สัปดาห์ที่ '+esc(h.week)+'</span><span>'+valHtml+'</span></div>'
          +'<div class="summary-mobile-plan-title">'+esc(h.title)+'</div>'
          +'</div>';
      }
      if(!planHtml) planHtml='<div class="col-span-2 text-center text-slate-400 text-sm font-bold py-3">ยังไม่มีแผนคะแนน</div>';

      var bonusStarHtml='<div class="summary-mobile-bonus-star">'
        +'<div class="summary-mobile-bonus-cell" onclick="if(window.shOvShowBonusDetail)window.shOvShowBonusDetail(this)">'
        +'<span>+โบนัส</span><b>'+esc(bonus)+'</b></div>'
        +'<div class="summary-mobile-star-cell"><span>⭐ดาว</span><b>'+esc(stars)+'</b></div>'
        +'</div>';

      return '<div class="summary-mobile-card">'
        +hdrHtml+statsHtml
        +'<div class="summary-mobile-plans">'+planHtml+'</div>'
        +bonusStarHtml+totalHtml
        +'</div>';
    }).join('');
  }

  window.buildMobileOverviewCards = buildCards;

  function hookRender(){
    if(typeof window.renderCourseOverview!=='function'||window.renderCourseOverview.__shOvFinalHooked) return;
    var old=window.renderCourseOverview;
    var fn=function(){
      var r=old.apply(this,arguments);
      setTimeout(buildCards,50);
      setTimeout(buildCards,200);
      return r;
    };
    fn.__shOvFinalHooked=true;
    window.renderCourseOverview=fn;
  }
  hookRender();

  if(typeof window.switchCourseTab==='function'&&!window.switchCourseTab.__shOvFinalHooked){
    var oldSw=window.switchCourseTab;
    var sw=function(tabId){var r=oldSw.apply(this,arguments);if(tabId==='overview')setTimeout(buildCards,160);return r;};
    sw.__shOvFinalHooked=true;
    window.switchCourseTab=sw;
  }

  document.addEventListener('DOMContentLoaded',function(){ hookRender(); setTimeout(buildCards,300); });
  window.addEventListener('resize',function(){ setTimeout(buildCards,80); });
})();
