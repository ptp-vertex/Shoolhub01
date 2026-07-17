
(function(){
  if(window.__schoolhubRealOkButtonCloseFix) return;
  window.__schoolhubRealOkButtonCloseFix = true;

  function closeAlert(){
    var modal = document.getElementById('custom-alert');
    var box = document.getElementById('custom-alert-box');
    if(box){
      box.classList.remove('scale-100','opacity-100');
      box.classList.add('scale-95','opacity-0');
    }
    if(modal){
      modal.classList.add('hidden');
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden','true');
    }
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  window.closeCustomAlert = closeAlert;

  function bindOk(){
    var modal = document.getElementById('custom-alert');
    if(!modal) return;
    var btns = modal.querySelectorAll('button');
    btns.forEach(function(btn){
      btn.disabled = false;
      btn.removeAttribute('disabled');
      btn.removeAttribute('aria-disabled');
      btn.style.pointerEvents = 'auto';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      if(!btn.__schoolhubOkBound){
        btn.__schoolhubOkBound = true;
        btn.onclick = function(e){
          if(e){
            e.preventDefault();
            e.stopPropagation();
            if(e.stopImmediatePropagation) e.stopImmediatePropagation();
          }
          closeAlert();
          return false;
        };
      }
    });
  }

  function installOkButtonWrap(){
    if(typeof window.showCustomAlert === 'function' && !window.showCustomAlert.__okButtonRealFixWrapped){
      var oldShow = window.showCustomAlert;
      var wrapped = function(){
        var r = oldShow.apply(this, arguments);
        setTimeout(function(){
          var modal = document.getElementById('custom-alert');
          if(modal){
            modal.style.display = '';
            modal.removeAttribute('aria-hidden');
          }
          bindOk();
        }, 20);
        return r;
      };
      wrapped.__okButtonRealFixWrapped = true;
      window.showCustomAlert = wrapped;
    }
  }
  installOkButtonWrap();
  // js1/007.js โหลดแบบ type="module" จึงทำงาน "หลัง" ไฟล์นี้เสมอ และมันเซ็ต
  // window.showCustomAlert ของตัวเองทับ ทำให้การ wrap ปุ่ม "ตกลง" นี้หายไปด้วย
  // ต้องห่อซ้ำอีกครั้งตอน DOMContentLoaded ซึ่งจะยิงหลัง 007.js เสมอ
  document.addEventListener('DOMContentLoaded', function(){
    if(typeof window.__schoolhubReinstallShowCustomAlert === 'function') window.__schoolhubReinstallShowCustomAlert();
    installOkButtonWrap();
  });

  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest ? e.target.closest('#custom-alert button') : null;
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    closeAlert();
    return false;
  }, true);

  document.addEventListener('DOMContentLoaded', function(){
    bindOk();
    setTimeout(bindOk, 300);
  });
})();
