/*
  PATCH: แก้เมนูหลักเพิ่มเติม (เมนูที่แอดมินฝังเว็บ/HTML ให้ผู้ใช้งาน)
  ปัญหาเดิม:
    1) บางครั้งกดเมนูแล้วเจอ "หน้าขาวเต็มหน้าจอ" แทนที่จะเป็นป็อปอัพ เพราะการเปิดป็อปอัพ
       (js2/114) ผูกอยู่กับการห่อฟังก์ชัน window.openCustomMenuUser ซึ่งช้ากว่าปกติ
       หรือถูกเรียกก่อนสคริปต์ห่อฟังก์ชันจะพร้อม ทำให้หน้าเมนูฝังโผล่มาแบบเพจเต็มหน้าจอ
       (ไม่ใช่ป็อปอัพ) พื้นหลังจึงกลายเป็นสีขาวทั้งหน้าแทนที่จะเป็นป็อปอัพลอยกลางจอ
    2) เนื้อหาเว็บ/HTML ที่ฝังในป็อปอัพ (iframe) ถูกสคริปต์เก่า (js1/065) คำนวณความสูงจาก
       เนื้อหาข้างในแล้วตั้งค่า frame.style.height ตรง ๆ โดยไม่มีเพดานสูงสุด บางกรณีเกิด
       ลูปวัดขนาดซ้ำไปเรื่อย ๆ (ResizeObserver) ทำให้ iframe สูงขึ้นเรื่อย ๆ ไม่จบ ดันความสูง
       ของทั้งหน้าเว็บยาวลงไปเรื่อย ๆ

  วิธีแก้ (ทำงานอิสระ ไม่พึ่งลำดับการห่อฟังก์ชันของสคริปต์เก่า):
    - เฝ้าดู (MutationObserver) การเปลี่ยน class ของกล่องเมนูผู้ใช้งานโดยตรง ทันทีที่กล่องนี้
      ถูกเปิดขึ้นมา (เอา class hidden ออก) จะบังคับใส่โหมดป็อปอัพ (shcm-popup-mode) และปุ่มปิด
      ให้ทันที ไม่ว่าจะถูกเรียกจากจุดไหนหรือช้าแค่ไหนก็ตาม จึงไม่มีจังหวะที่ขึ้นเป็นหน้าขาวเต็มจอ
      (คู่กับ CSS ที่ซ่อนกล่องนี้ไว้จนกว่าจะเข้าโหมดป็อปอัพจริง)
    - บังคับให้ iframe เต็มพื้นที่กล่องป็อปอัพเสมอ (height:100% แบบ !important ผ่านไฟล์ CSS คู่กัน)
      เพื่อกัน inline height ที่สคริปต์เก่าตั้งไว้ ไม่ให้ดันความสูงหน้าเว็บทั้งหน้าอีกต่อไป
*/
(function () {
  if (window.__schoolhubCustomMenuPopupRobustFix) return;
  window.__schoolhubCustomMenuPopupRobustFix = true;

  function getView() {
    return document.getElementById('schoolhub-custom-menu-user-view');
  }

  function closePopup() {
    var view = getView();
    if (!view) return;
    view.classList.add('hidden');
    view.classList.remove('shcm-popup-mode', 'sh-menu-maximized');
    document.body.classList.remove('schoolhub-custom-menu-popup-open');
  }
  window.closeCustomMenuUserPopup = closePopup;

  function ensureCloseButton(view) {
    var panel = view.querySelector(':scope > div');
    if (!panel) return;
    panel.style.position = panel.style.position || 'relative';

    var backBtn = panel.querySelector('button[onclick*="goToHome"]');
    if (backBtn) backBtn.style.display = 'none';

    if (!panel.querySelector('#shcm-popup-close-x')) {
      var x = document.createElement('button');
      x.type = 'button';
      x.id = 'shcm-popup-close-x';
      x.setAttribute('aria-label', 'ปิด');
      x.innerHTML = '<i class="fas fa-times"></i>';
      x.addEventListener('click', function (e) {
        e.preventDefault();
        closePopup();
      });
      panel.appendChild(x);
    }
  }

  function lockIframeSize(view) {
    var frame = view.querySelector('#shcm-user-content iframe');
    if (!frame) return;
    // ตัดพฤติกรรมเดิมที่ตั้งความสูงเป็นพิกเซลตายตัว ให้ CSS (height:100% !important) คุมแทน
    frame.removeAttribute('scrolling');
    frame.style.removeProperty('height');
    frame.style.removeProperty('overflow');
  }

  function syncPopupState() {
    var view = getView();
    if (!view) return;
    var isOpen = !view.classList.contains('hidden');
    if (isOpen) {
      view.classList.add('shcm-popup-mode');
      document.body.classList.add('schoolhub-custom-menu-popup-open');
      ensureCloseButton(view);
      lockIframeSize(view);
    } else {
      view.classList.remove('shcm-popup-mode', 'sh-menu-maximized');
      document.body.classList.remove('schoolhub-custom-menu-popup-open');
    }
  }

  // ปิดป็อปอัพเมื่อคลิกพื้นหลังมืด หรือกด Esc
  document.addEventListener('click', function (e) {
    var view = getView();
    if (view && view.classList.contains('shcm-popup-mode') && e.target === view) closePopup();
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var view = getView();
      if (view && view.classList.contains('shcm-popup-mode')) closePopup();
    }
  });

  function watchContentBox(view) {
    var box = document.getElementById('shcm-user-content');
    if (!box || box.dataset.shcmRobustWatched === '1') return;
    box.dataset.shcmRobustWatched = '1';
    var mo = new MutationObserver(function () { lockIframeSize(view); });
    mo.observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  }

  function start() {
    var view = getView();
    if (!view) { setTimeout(start, 300); return; }
    syncPopupState();
    watchContentBox(view);
    var moClass = new MutationObserver(function () {
      syncPopupState();
      watchContentBox(view);
    });
    moClass.observe(view, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
