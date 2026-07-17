
(function(){
  if(window.__schoolhubCustomMenuSafeIconFramePatch) return;
  window.__schoolhubCustomMenuSafeIconFramePatch = true;

  var ICONS = [
    ['fas fa-link','🔗 ลิงก์ / Link'],
    ['fas fa-globe','🌐 เว็บไซต์ / Website'],
    ['fas fa-book','📘 คู่มือ / Book'],
    ['fas fa-file-lines','📄 เอกสาร / Document'],
    ['fas fa-file-pen','📝 แบบฟอร์ม / Form'],
    ['fas fa-clipboard-list','📋 รายการ / Checklist'],
    ['fas fa-chart-line','📈 รายงาน / Report'],
    ['fas fa-graduation-cap','🎓 การศึกษา / Education'],
    ['fas fa-school','🏫 โรงเรียน / School'],
    ['fas fa-chalkboard-user','👨‍🏫 ครูผู้สอน / Teacher'],
    ['fas fa-users','👥 ผู้ใช้งาน / Users'],
    ['fas fa-user-graduate','🧑‍🎓 นักเรียน / Student'],
    ['fas fa-calendar-days','📅 ปฏิทิน / Calendar'],
    ['fas fa-clock','⏰ เวลา / Time'],
    ['fas fa-star','⭐ คะแนน / Score'],
    ['fas fa-medal','🏅 เกณฑ์เกรด / Grade'],
    ['fas fa-download','⬇️ ดาวน์โหลด / Download'],
    ['fas fa-upload','⬆️ อัปโหลด / Upload'],
    ['fas fa-folder-open','📂 ไฟล์ / Folder'],
    ['fas fa-image','🖼️ รูปภาพ / Image'],
    ['fas fa-video','🎥 วิดีโอ / Video'],
    ['fas fa-bullhorn','📢 ประกาศ / Announcement'],
    ['fas fa-comments','💬 ติดต่อ / Chat'],
    ['fas fa-envelope','✉️ อีเมล / Email'],
    ['fas fa-phone','☎️ โทรศัพท์ / Phone'],
    ['fas fa-location-dot','📍 สถานที่ / Location'],
    ['fas fa-truck-fast','🚚 โลจิสติกส์ / Logistics'],
    ['fas fa-route','🛣️ เส้นทาง / Route'],
    ['fas fa-suitcase-rolling','🧳 ท่องเที่ยว / Tourism'],
    ['fas fa-language','🌏 ภาษา / Language'],
    ['fas fa-handshake','🤝 ความร่วมมือ / Cooperation'],
    ['fas fa-gear','⚙️ ตั้งค่า / Settings'],
    ['fas fa-shield-halved','🛡️ สิทธิ์ / Permission'],
    ['fas fa-lock','🔒 ล็อก / Lock'],
    ['fas fa-qrcode','▦ QR Code'],
    ['custom','กำหนดเอง...']
  ];

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"]/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m];});
  }

  function enhanceIconPicker(){
    var input = document.getElementById('shcm-icon');
    if(!input || input.dataset.safeIconEnhanced === '1') return;
    input.dataset.safeIconEnhanced = '1';

    var oldWrap = input.closest('div');
    if(!oldWrap) return;

    var current = input.value || 'fas fa-link';
    var html = '<label class="text-xs font-bold text-slate-500">ไอคอน Font Awesome</label>' +
      '<div class="shcm-icon-picker-safe-grid grid grid-cols-[64px_1fr] gap-2 items-center">' +
      '<div id="shcm-icon-preview-safe" class="h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-primary flex items-center justify-center text-2xl"><i class="'+esc(current)+'"></i></div>' +
      '<select id="shcm-icon-select-safe" class="shcm-field">' +
      ICONS.map(function(it){return '<option value="'+esc(it[0])+'">'+esc(it[1])+'</option>';}).join('') +
      '</select></div>';

    oldWrap.insertAdjacentHTML('afterbegin', html);
    input.classList.add('mt-2');

    var select = document.getElementById('shcm-icon-select-safe');
    var preview = document.getElementById('shcm-icon-preview-safe');

    function syncFromInput(){
      var val = (input.value || 'fas fa-link').trim() || 'fas fa-link';
      if(preview) preview.innerHTML = '<i class="'+esc(val)+'"></i>';
      if(select){
        var found = false;
        Array.prototype.forEach.call(select.options, function(o){ if(o.value === val) found = true; });
        select.value = found ? val : 'custom';
      }
      input.classList.toggle('hidden', select && select.value !== 'custom');
    }

    if(select){
      select.addEventListener('change', function(){
        if(select.value !== 'custom') input.value = select.value;
        input.classList.toggle('hidden', select.value !== 'custom');
        syncFromInput();
        if(select.value === 'custom') input.focus();
      });
    }
    input.addEventListener('input', syncFromInput);
    syncFromInput();
  }

  function autosizeCurrentFrame(){
    var frame = document.querySelector('#shcm-user-content iframe');
    if(!frame || frame.dataset.safeAutoHeight === '1') return;
    frame.dataset.safeAutoHeight = '1';
    frame.setAttribute('scrolling','no');
    frame.style.overflow = 'hidden';

    function setH(h){
      h = Math.max(820, Number(h || 0) + 24);
      frame.style.height = h + 'px';
    }

    frame.addEventListener('load', function(){
      try{
        var d = frame.contentDocument || frame.contentWindow.document;
        if(d){
          var apply = function(){
            var b=d.body, e=d.documentElement;
            if(!b || !e) return;
            b.style.overflow = 'hidden';
            e.style.overflow = 'hidden';
            setH(Math.max(b.scrollHeight,e.scrollHeight,b.offsetHeight,e.offsetHeight,b.clientHeight,e.clientHeight));
          };
          apply();
          try{ new ResizeObserver(apply).observe(d.body); }catch(_){}
          setTimeout(apply,300); setTimeout(apply,1000); setTimeout(apply,2000);
          return;
        }
      }catch(e){}
      setH(Math.max(window.innerHeight * 2.2, 1500));
    });
  }

  window.addEventListener('message', function(ev){
    if(!ev || !ev.data || ev.data.type !== 'SHCM_FRAME_HEIGHT') return;
    var frame = document.querySelector('#shcm-user-content iframe');
    if(frame) frame.style.height = Math.max(820, Number(ev.data.height || 0) + 24) + 'px';
  });

  // Wrap after original functions exist, but do not replace if missing.
  function wrapOriginals(){
    enhanceIconPicker();

    if(typeof window.openCustomMenuAdmin === 'function' && !window.openCustomMenuAdmin.__safeIconPatchWrapped){
      var oldAdmin = window.openCustomMenuAdmin;
      var newAdmin = function(){
        var r = oldAdmin.apply(this, arguments);
        setTimeout(enhanceIconPicker, 50);
        setTimeout(enhanceIconPicker, 300);
        return r;
      };
      newAdmin.__safeIconPatchWrapped = true;
      window.openCustomMenuAdmin = newAdmin;
    }

    if(typeof window.editCustomMenu === 'function' && !window.editCustomMenu.__safeIconPatchWrapped){
      var oldEdit = window.editCustomMenu;
      var newEdit = function(){
        var r = oldEdit.apply(this, arguments);
        setTimeout(enhanceIconPicker, 50);
        setTimeout(function(){
          var input=document.getElementById('shcm-icon');
          if(input) input.dispatchEvent(new Event('input'));
        },120);
        return r;
      };
      newEdit.__safeIconPatchWrapped = true;
      window.editCustomMenu = newEdit;
    }

    if(typeof window.openCustomMenuUser === 'function' && !window.openCustomMenuUser.__safeFramePatchWrapped){
      var oldUser = window.openCustomMenuUser;
      var newUser = function(){
        var r = oldUser.apply(this, arguments);
        setTimeout(autosizeCurrentFrame, 50);
        setTimeout(autosizeCurrentFrame, 300);
        return r;
      };
      newUser.__safeFramePatchWrapped = true;
      window.openCustomMenuUser = newUser;
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    wrapOriginals();
    setTimeout(wrapOriginals,300);
    setTimeout(wrapOriginals,1000);
  });
  document.addEventListener('click', function(e){
    var adminBtn = e.target && e.target.closest && e.target.closest('#nav-admin-custom-menus,#mobile-nav-admin-custom-menus,[onclick*="openCustomMenuAdmin"]');
    if(adminBtn) setTimeout(function(){ wrapOriginals(); enhanceIconPicker(); },120);
    var userBtn = e.target && e.target.closest && e.target.closest('.shcm-user-nav-btn,[onclick*="openCustomMenuUser"]');
    if(userBtn) setTimeout(autosizeCurrentFrame,120);
  }, true);
  setInterval(wrapOriginals, 1500);
})();
