
(function(){
  if(window.__schoolhubExportPopupRealCloseFix) return;
  window.__schoolhubExportPopupRealCloseFix = true;

  var EXPORT_MODAL_SELECTOR = [
    '.schoolhub-export-popup',
    '#schoolhub-overview-export-room-modal',
    '#schoolhub-attendance-export-modal',
    '#student-export-room-modal',
    '#export-date-modal',
    '#download-modal',
    '#attendance-export-modal',
    '#export-room-modal',
    '#schoolhub-overview-excel-room-modal',
    '#schoolhub-overview-excel-room-modal-force'
  ].join(',');

  function closeExportModal(modal){
    if(!modal) return false;

    modal.classList.add('hidden');
    modal.style.display = 'none';
    modal.style.pointerEvents = 'none';
    modal.style.visibility = 'hidden';

    document.body.classList.remove('modal-open', 'overflow-hidden');

    return true;
  }

  window.schoolhubCloseExportModal = function(idOrEl){
    var modal = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    return closeExportModal(modal);
  };

  function isExportDismissButton(btn){
    if(!btn) return false;

    var text = (btn.textContent || '').trim();
    var oc = btn.getAttribute('onclick') || '';
    var idClass = (btn.id || '') + ' ' + (btn.className || '');
    var aria = btn.getAttribute('aria-label') || '';

    var hasCloseIcon = !!btn.querySelector(
      'i.fa-times, i.fa-xmark, i.fa-close, .fa-times, .fa-xmark, .fa-close'
    );

    return (
      btn.hasAttribute('data-export-dismiss') ||
      hasCloseIcon ||
      /^(×|x)$/i.test(text) ||
      /ยกเลิก|ปิด|close|cancel|dismiss|fa-times|fa-xmark|modal-close/i.test(
        text + ' ' + oc + ' ' + idClass + ' ' + aria
      )
    );
  }
  window.schoolhubIsExportDismissButton = isExportDismissButton;

  function markExportDismissButtons(root){
    root = root || document;

    root.querySelectorAll(EXPORT_MODAL_SELECTOR + ' button, ' + EXPORT_MODAL_SELECTOR + ' a').forEach(function(btn){
      if(!isExportDismissButton(btn)) return;

      btn.type = 'button';
      btn.setAttribute('data-export-dismiss', 'true');
      btn.setAttribute('aria-label', btn.getAttribute('aria-label') || 'ปิด');
      btn.style.pointerEvents = 'auto';
      btn.disabled = false;
      btn.removeAttribute('disabled');
      btn.classList.remove('sh-permission-disabled', 'schoolhub-locked-action-stable', 'pointer-events-none', 'schoolhub-plan-right-locked', 'schoolhub-permission-disabled-soft', 'opacity-50', 'opacity-40', 'cursor-not-allowed', 'grayscale', 'disabled');
    });
  }

  document.addEventListener('click', function(e){
    var modal = e.target && e.target.closest ? e.target.closest(EXPORT_MODAL_SELECTOR) : null;
    if(!modal) return;

    var btn = e.target.closest && e.target.closest('button,a,[role="button"]');

    if(btn && isExportDismissButton(btn)){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      closeExportModal(modal);
      return false;
    }

    if(e.target === modal){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      closeExportModal(modal);
      return false;
    }
  }, true);

  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;

    var modals = Array.prototype.slice.call(document.querySelectorAll(EXPORT_MODAL_SELECTOR))
      .filter(function(m){ return !m.classList.contains('hidden') && m.style.display !== 'none'; });

    if(!modals.length) return;

    e.preventDefault();
    closeExportModal(modals[modals.length - 1]);
  }, true);

  markExportDismissButtons(document);
  document.addEventListener('DOMContentLoaded', function(){ markExportDismissButtons(document); });

  new MutationObserver(function(ms){
    ms.forEach(function(m){
      Array.prototype.slice.call(m.addedNodes || []).forEach(function(n){
        if(n && n.nodeType === 1) markExportDismissButtons(n);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
