
(function(){
  if (window.__schoolhubMobileOverviewAttTitleOnlyFix) return;
  window.__schoolhubMobileOverviewAttTitleOnlyFix = true;

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }
  function cleanText(el){
    return (el && (el.innerText || el.textContent) || '').replace(/\s+/g,' ').trim();
  }
  function splitAttendance(v){
    var m = String(v || '').match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)(?:\s*\/\s*(\d+))?/);
    return m ? [m[1],m[2],m[3],m[4]||'0'] : ['0','0','0','0'];
  }
  function ensureBox(){
    var table = document.getElementById('course-summary-table');
    if (!table) return null;
    var box = document.getElementById('course-summary-mobile-cards');
    if (!box) {
      box = document.createElement('div');
      box.id = 'course-summary-mobile-cards';
      var wrap = table.closest('.overflow-x-auto') || table.parentNode;
      if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(box, wrap.nextSibling);
      else table.parentNode.insertBefore(box, table.nextSibling);
    }
    return box;
  }
  function parseHeader(th, fallbackIndex){
    var titleAttr = (th && th.getAttribute && th.getAttribute('title')) || '';
    var week = '';
    var title = '';
    if (titleAttr) {
      var parts = titleAttr.replace(/^คลิกเพื่อดูรายละเอียด:\s*/,'').split('|').map(function(x){ return x.trim(); });
      week = (parts[0] || '').replace(/^สัปดาห์\s*/,'').trim();
      title = parts[1] || '';
    }
    if (!week) {
      var t = cleanText(th);
      var wm = t.match(/\d+/);
      week = wm ? wm[0] : String(fallbackIndex + 1);
    }
    if (!title) title = cleanText(th).replace(/^สัปดาห์\s*/,'').trim() || 'งาน';
    return { week: week, title: title };
  }

  function buildFixedMobileOverviewCards(){
    if (!window.matchMedia || !window.matchMedia('(max-width: 767px)').matches) return;
    var table = document.getElementById('course-summary-table');
    var box = ensureBox();
    if (!table || !box) return;
    var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
    if (!rows.length) { box.innerHTML = ''; return; }
    var headers = Array.prototype.slice.call(table.querySelectorAll('thead th'));

    box.innerHTML = rows.map(function(row, idx){
      var cells = Array.prototype.slice.call(row.children);
      var texts = cells.map(cleanText);
      var no = texts[0] || String(idx + 1);
      var code = texts[1] || '-';
      var name = texts[2] || '-';

      /* ตารางบางเวอร์ชันมีคอลัมน์ ชั้น/ห้อง ก่อนคอลัมน์เช็คชื่อ และบางเวอร์ชันไม่มี
         จึงหาเซลล์เช็คชื่อจากรูปแบบ มา/สาย/ขาด โดยตรง เพื่อให้ช่องสีเขียว/ส้ม/แดงตรงเสมอ */
      var attIndex = texts.findIndex(function(t){ return /^\d+\s*\/\s*\d+\s*\/\s*\d+/.test(t); });
      if (attIndex < 0) attIndex = 3;
      var att = splitAttendance(texts[attIndex]);
      var room = '-';
      if (attIndex > 3) room = texts[3] || '-';

      var bonusColIdx2=-1,starColIdx2=-1,totalIdx2=cells.length-2,gradeIdx2=cells.length-1;
      for(var ci=0;ci<headers.length;ci++){
        var hcls=headers[ci].className||'';
        if(hcls.indexOf('summary-total-col')>=0) totalIdx2=ci;
        else if(hcls.indexOf('summary-grade-col')>=0) gradeIdx2=ci;
        else if(hcls.indexOf('sh-bonus-col')>=0) bonusColIdx2=ci;
        else if(hcls.indexOf('sh-star-col')>=0) starColIdx2=ci;
      }
      var total = cells[totalIdx2] ? cleanText(cells[totalIdx2]) : '0';
      var grade = cells[gradeIdx2] ? cleanText(cells[gradeIdx2]) : '-';
      var bonus2 = bonusColIdx2>=0&&cells[bonusColIdx2] ? cleanText(cells[bonusColIdx2]) : '-';
      var stars2 = starColIdx2>=0&&cells[starColIdx2] ? cleanText(cells[starColIdx2]).replace(/[^\d]/g,'') : '-'; if(stars2===''||stars2==='0') stars2='-';

      var planHtml = '';
      for (var i = attIndex + 1; i < totalIdx2; i++) {
        if(i===bonusColIdx2||i===starColIdx2) continue;
        var h = parseHeader(headers[i], i - attIndex - 1);
        var value = texts[i] || '-';
        var isMissingSavedScore = value === '-' && !!(cells[i] && cells[i].querySelector && cells[i].querySelector('.text-rose-500, .text-rose-600'));
        var valueHtml = (isMissingSavedScore || String(value).trim().toUpperCase() === 'X') ? '<span class="schoolhub-mobile-missing-score schoolhub-missing-score-clickable">X</span>' : esc(value);
        planHtml += '<div class="summary-mobile-plan">'
          + '<div class="summary-mobile-plan-top"><span>สัปดาห์ที่ '+esc(h.week)+'</span><span>'+valueHtml+'</span></div>'
          + '<div class="summary-mobile-plan-title">'+esc(h.title)+'</div>'
          + '</div>';
      }
      if (!planHtml) planHtml = '<div class="col-span-2 text-center text-slate-400 text-sm font-bold py-3">ยังไม่มีแผนคะแนน</div>';
      var bonusStarHtml2='<div class="summary-mobile-bonus-star"><div class="summary-mobile-bonus-cell" onclick="if(window.shOvShowBonusDetail)window.shOvShowBonusDetail(this)"><span>+โบนัส</span><b>'+esc(bonus2)+'</b></div><div class="summary-mobile-star-cell"><span>⭐ดาว</span><b>'+esc(stars2)+'</b></div></div>';

      return '<div class="summary-mobile-card">'
        + '<div class="flex items-start justify-between gap-3"><div><div class="summary-mobile-card-name">'+esc(name)+'</div><div class="summary-mobile-card-room">'+esc(room)+'</div></div><div class="summary-mobile-card-no">#'+esc(String(no).replace(/^#/,''))+'</div></div>'
        + '<details class="summary-mobile-card-code"><summary><i class="fas fa-id-card mr-1"></i>เปิด/ปิดรหัสนักเรียน</summary><div>'+esc(code)+'</div></details>'
        + '<div class="summary-mobile-stats"><div class="summary-mobile-stat text-emerald-600"><b>'+esc(att[0])+'</b>มา</div><div class="summary-mobile-stat text-amber-600"><b>'+esc(att[1])+'</b>สาย</div><div class="summary-mobile-stat text-rose-600"><b>'+esc(att[2])+'</b>ขาด</div><div class="summary-mobile-stat" style="color:#7c3aed"><b>'+esc(att[3]||0)+'</b>ลา</div></div>'
        + '<div class="summary-mobile-plans">'+planHtml+'</div>'
        + bonusStarHtml2
        + '<div class="summary-mobile-total"><span>รวม '+(function(){var _p=String(total).split('+');return esc(_p[0])+(_p.length>1?'<sup style="font-size:.6em;color:#4ade80;font-weight:900;vertical-align:super;line-height:1">+'+esc(_p[1])+'</sup>':'')})()+'</span><span>เกรด '+esc(grade)+'</span></div>'
        + '</div>';
    }).join('');
  }

  window.buildMobileOverviewCards = buildFixedMobileOverviewCards;
  function hookRender(){
    if (typeof window.renderCourseOverview === 'function' && !window.renderCourseOverview.__mobileAttTitleOnlyWrapped) {
      var old = window.renderCourseOverview;
      var fn = function(){
        var r = old.apply(this, arguments);
        setTimeout(buildFixedMobileOverviewCards, 40);
        setTimeout(buildFixedMobileOverviewCards, 180);
        return r;
      };
      fn.__mobileAttTitleOnlyWrapped = true;
      window.renderCourseOverview = fn;
    }
  }
  hookRender();
  document.addEventListener('DOMContentLoaded', function(){ hookRender(); setTimeout(buildFixedMobileOverviewCards, 300); });
  window.addEventListener('resize', function(){ setTimeout(buildFixedMobileOverviewCards, 100); });
  document.addEventListener('click', function(e){ if(window.isDropdownRelatedElement && window.isDropdownRelatedElement(e.target)) return; setTimeout(buildFixedMobileOverviewCards, 120); });
})();
