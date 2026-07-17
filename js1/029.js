
(function(){
  if(window.__schoolhubFinalMobileOverviewCardsFix) return;
  window.__schoolhubFinalMobileOverviewCardsFix = true;
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];}); }
  function text(el){ return (el && (el.innerText || el.textContent) || '').replace(/\s+/g,' ').trim(); }
  function ensureBox(){
    var table=document.getElementById('course-summary-table');
    if(!table) return null;
    var box=document.getElementById('course-summary-mobile-cards');
    if(!box){
      box=document.createElement('div');
      box.id='course-summary-mobile-cards';
      var wrap=table.closest('.overflow-x-auto') || table.parentNode;
      if(wrap && wrap.parentNode) wrap.parentNode.insertBefore(box, wrap.nextSibling);
      else table.parentNode.insertBefore(box, table.nextSibling);
    }
    return box;
  }
  function splitAttendance(v){
    var m=String(v||'').match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)(?:\s*\/\s*(\d+))?/);
    return m ? [m[1],m[2],m[3],m[4]||'0'] : ['0','0','0','0'];
  }
  function buildMobileOverviewCards(){
    if(!window.matchMedia || !window.matchMedia('(max-width: 767px)').matches) return;
    var table=document.getElementById('course-summary-table');
    var box=ensureBox();
    if(!table || !box) return;
    var rows=[].slice.call(table.querySelectorAll('tbody tr'));
    if(!rows.length){ box.innerHTML=''; return; }
    var headerEls=[].slice.call(table.querySelectorAll('thead th'));
    function findColIdx(cls,fb){ for(var i=0;i<headerEls.length;i++){ if(headerEls[i].className.indexOf(cls)>=0) return i; } return fb; }
    var totalColIdx=findColIdx('summary-total-col',headerEls.length-2);
    var gradeColIdx=findColIdx('summary-grade-col',headerEls.length-1);
    var bonusColIdx=findColIdx('sh-bonus-col',-1);
    var starColIdx=findColIdx('sh-star-col',-1);
    box.innerHTML=rows.map(function(row, idx){
      var cells=[].slice.call(row.children);
      var no=text(cells[0]) || String(idx+1);
      var code=text(cells[1]) || '-';
      var name=text(cells[2]) || '-';
      var room=text(cells[3]) || '-';
      var att=splitAttendance(text(cells[4]));
      var total=cells[totalColIdx] ? text(cells[totalColIdx]) : '0';
      var grade=cells[gradeColIdx] ? text(cells[gradeColIdx]) : '-';
      var bonus=bonusColIdx>=0&&cells[bonusColIdx] ? text(cells[bonusColIdx]) : '-';
      var stars=starColIdx>=0&&cells[starColIdx] ? text(cells[starColIdx]).replace(/[^\d]/g,'') : '-'; if(stars===''||stars==='0') stars='-';
      var planHtml='';
      for(var i=5;i<totalColIdx;i++){
        if(i===bonusColIdx||i===starColIdx) continue;
        var hdr=headerEls[i];
        var titleAttr=(hdr&&hdr.getAttribute&&hdr.getAttribute('title'))||'';
        var label=titleAttr ? titleAttr.replace(/^คลิกเพื่อดูรายละเอียด[: ]*/,'').split('|').map(function(x){return x.trim();}).join(' ') : (text(hdr)||('งาน '+(i-4)));
        var value=text(cells[i]) || '-';
        var weekNum=(label.match(/\d+/)||[''])[0];
        var weekLabel=weekNum?('สัปดาห์ที่ '+weekNum):(label.split(' ')[0]||label);
        var titleLabel=label.replace(/^สัปดาห์(ที่)?\s*\d+\s*/,'').trim()||label;
        planHtml += '<div class="summary-mobile-plan"><div class="summary-mobile-plan-top"><span>'+esc(weekLabel)+'</span><span>'+esc(value)+'</span></div><div class="summary-mobile-plan-title">'+esc(titleLabel)+'</div></div>';
      }
      if(!planHtml) planHtml='<div class="col-span-2 text-center text-slate-400 text-sm font-bold py-3">ยังไม่มีแผนคะแนน</div>';
      var bonusStarHtml='<div class="summary-mobile-bonus-star"><div class="summary-mobile-bonus-cell" onclick="if(window.shOvShowBonusDetail)window.shOvShowBonusDetail(this)"><span>+โบนัส</span><b>'+esc(bonus)+'</b></div><div class="summary-mobile-star-cell"><span>⭐ดาว</span><b>'+esc(stars)+'</b></div></div>';
      return '<div class="summary-mobile-card">'+
        '<div class="flex items-start justify-between gap-3"><div><div class="summary-mobile-card-name">'+esc(name)+'</div><div class="summary-mobile-card-room">'+esc(room)+'</div></div><div class="summary-mobile-card-no">#'+esc(String(no).replace(/^#/,''))+'</div></div>'+
        '<details class="summary-mobile-card-code"><summary><i class="fas fa-id-card mr-1"></i>เปิด/ปิดรหัสนักเรียน</summary><div>'+esc(code)+'</div></details>'+
        '<div class="summary-mobile-stats"><div class="summary-mobile-stat text-emerald-600"><b>'+esc(att[0])+'</b>มา</div><div class="summary-mobile-stat text-amber-600"><b>'+esc(att[1])+'</b>สาย</div><div class="summary-mobile-stat text-rose-600"><b>'+esc(att[2])+'</b>ขาด</div><div class="summary-mobile-stat" style="color:#7c3aed"><b>'+esc(att[3]||0)+'</b>ลา</div></div>'+
        '<div class="summary-mobile-plans">'+planHtml+'</div>'+
        bonusStarHtml+
        '<div class="summary-mobile-total"><span>รวม '+(function(){var _p=String(total).split('+');return esc(_p[0])+(_p.length>1?'<sup style="font-size:.6em;color:#4ade80;font-weight:900;vertical-align:super;line-height:1">+'+esc(_p[1])+'</sup>':'')})()+'</span><span>เกรด '+esc(grade)+'</span></div>'+
      '</div>';
    }).join('');
  }
  window.buildMobileOverviewCards = buildMobileOverviewCards;
  function wrapRender(){
    if(typeof window.renderCourseOverview === 'function' && !window.renderCourseOverview.__mobileCardWrapped){
      var old=window.renderCourseOverview;
      var fn=function(){ var r=old.apply(this, arguments); setTimeout(buildMobileOverviewCards, 30); setTimeout(buildMobileOverviewCards, 180); return r; };
      fn.__mobileCardWrapped=true;
      window.renderCourseOverview=fn;
    }
  }
  wrapRender();
  document.addEventListener('DOMContentLoaded', function(){ wrapRender(); setTimeout(buildMobileOverviewCards,300); });
  window.addEventListener('resize', function(){ setTimeout(buildMobileOverviewCards,80); });
  var oldSwitch=window.switchCourseTab;
  if(typeof oldSwitch === 'function' && !oldSwitch.__mobileOverviewFinalWrapped){
    var sw=function(tabId){ var r=oldSwitch.apply(this, arguments); if(tabId==='overview') setTimeout(buildMobileOverviewCards,160); return r; };
    sw.__mobileOverviewFinalWrapped=true;
    window.switchCourseTab=sw;
  }
})();
