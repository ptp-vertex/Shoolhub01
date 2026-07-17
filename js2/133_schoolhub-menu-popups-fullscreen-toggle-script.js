/*
  PATCH: เพิ่มปุ่ม "ขยายเต็มจอ" ให้เมนูเพิ่มเติมที่ฝังมาจากระบบแอดมิน
  (#schoolhub-custom-menu-user-view - หน้าที่เปิดจากการกดเมนูซึ่งแอดมินเพิ่มเข้ามาเอง
  เช่นลิงก์/iframe ที่ตั้งค่าไว้ใน "เมนูหลักเพิ่มเติม") ทำงานร่วมกับโหมดป็อปอัพเดิม
  จาก js2/114 + css/097 ซึ่งครอบคลุมทั้งเดสก์ท็อปและมือถืออยู่แล้ว
  ปุ่มนี้แค่เพิ่มตัวเลือก "ขยายเต็มจอ" ให้กดสลับได้ในตัวป็อปอัพเดียวกัน
*/
(function () {
  if (window.__schoolhubCustomMenuMaximizeInit) return;
  window.__schoolhubCustomMenuMaximizeInit = true;

  function makeMaximizeBtn(onToggle) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sh-popup-maximize-btn';
    btn.title = 'ขยายเต็มจอ';
    btn.setAttribute('aria-label', 'ขยายเต็มจอ');
    btn.innerHTML = '<i class="fas fa-expand"></i>';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var expanded = onToggle();
      btn.innerHTML = '<i class="fas ' + (expanded ? 'fa-compress' : 'fa-expand') + '"></i>';
    });
    return btn;
  }

  function ensureCustomMenuMaximizeBtn() {
    var view = document.getElementById('schoolhub-custom-menu-user-view');
    if (!view) return;
    var panel = view.querySelector(':scope > div');
    var closeBtn = panel && panel.querySelector('#shcm-popup-close-x');
    if (!panel || !closeBtn || panel.querySelector('#shcm-popup-maximize-x')) return;

    var btn = makeMaximizeBtn(function () {
      view.classList.toggle('sh-menu-maximized');
      return view.classList.contains('sh-menu-maximized');
    });
    btn.id = 'shcm-popup-maximize-x';
    closeBtn.insertAdjacentElement('beforebegin', btn);

    // ปิดป็อปอัพ -> คืนสถานะขยายเต็มจอเสมอ ไม่ให้ค้างไปรอบถัดไป
    closeBtn.addEventListener('click', function () {
      view.classList.remove('sh-menu-maximized');
      btn.innerHTML = '<i class="fas fa-expand"></i>';
    });
  }

  document.addEventListener('DOMContentLoaded', ensureCustomMenuMaximizeBtn);
  var iv = setInterval(ensureCustomMenuMaximizeBtn, 1000);
  window.addEventListener('beforeunload', function () { clearInterval(iv); });
  ensureCustomMenuMaximizeBtn();
})();
