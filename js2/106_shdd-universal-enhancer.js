
(function(){
'use strict';

// Never enhance these internal hidden selects
var SKIP = { 'att-course-select':1, 'score-course-select':1 };
// These get a week-number grid instead of a list
var WEEK_GRID = { 'score-week':1, 'plan-week':1 };

var CHEVRON_SVG = '<svg class="shdd-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>';

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function getLabel(sel){ var i=sel.selectedIndex; return (i>=0&&sel.options[i])?sel.options[i].text:''; }

// ── Global panel state ──────────────────────────────────────────────────────
var _panel=null, _wrap=null, _sel=null;

function closeAll(){
  if(_panel) _panel.classList.remove('shdd-open');
  if(_wrap)  _wrap.classList.remove('shdd-open');
  _panel=null; _wrap=null; _sel=null;
}

// ── Portal positioning (position:fixed based on button's viewport rect) ──────
function positionPanel(panel, btnEl){
  var r = btnEl.getBoundingClientRect();
  var vw = window.innerWidth, vh = window.innerHeight;
  var pw = Math.max(r.width, 190);
  var left = r.left;
  if(left+pw > vw-6) left = vw-pw-6;
  if(left < 6) left = 6;
  panel.style.left = left+'px';
  panel.style.width = pw+'px';
  panel.style.right = '';
  var inner = panel.querySelector('.shdd-panel-inner');
  var spaceBelow = vh - r.bottom - 6;
  var spaceAbove = r.top - 6;
  if(spaceBelow >= 100 || spaceBelow >= spaceAbove){
    panel.style.top = (r.bottom+4)+'px';
    panel.style.bottom = '';
    if(inner) inner.style.maxHeight = Math.max(100, Math.min(280, spaceBelow-4))+'px';
  } else {
    panel.style.top = '';
    panel.style.bottom = (vh-r.top+4)+'px';
    if(inner) inner.style.maxHeight = Math.max(100, Math.min(280, spaceAbove-4))+'px';
  }
}

function onScrollResize(){
  if(!_panel||!_wrap) return;
  var btn = _wrap.querySelector('.shdd-btn');
  if(btn) positionPanel(_panel, btn); else closeAll();
}
window.addEventListener('scroll', onScrollResize, {passive:true, capture:true});
window.addEventListener('resize', onScrollResize, {passive:true});

// Close on outside mousedown — this fires before click so panel is already gone before click propagates
document.addEventListener('mousedown', function(e){
  if(!_panel) return;
  var t = e.target;
  if(_panel.contains(t)) return;
  if(_wrap && _wrap.contains(t)) return;
  closeAll();
}, false);
document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeAll(); });

// ── Build options inside panel ───────────────────────────────────────────────
function buildOptions(panel, wrap, sel){
  var inner = panel.querySelector('.shdd-panel-inner');
  if(!inner) return;
  var isWeek = !!WEEK_GRID[sel.id];
  var cur = String(sel.value);
  var parts = [isWeek ? '<div class="shdd-grid">' : '<div class="shdd-list">'];
  Array.prototype.forEach.call(sel.options, function(opt){
    var v = String(opt.value), active = v===cur && cur!=='';
    if(isWeek){
      if(v===''){ parts.push('<button type="button" class="shdd-week-blank shdd-opt" data-val="">'+esc(opt.text)+'</button>'); }
      else { parts.push('<button type="button" class="shdd-week-item shdd-opt'+(active?' shdd-selected':'')+'" data-val="'+esc(v)+'">'+esc(v)+'</button>'); }
    } else {
      parts.push('<button type="button" class="shdd-list-item shdd-opt'+(active?' shdd-selected':'')+'" data-val="'+esc(v)+'" title="'+esc(opt.text)+'">'+esc(opt.text)+'</button>');
    }
  });
  parts.push('</div>');
  inner.innerHTML = parts.join('');

  // Use mousedown so event fires before click — bypasses plan-modal's click-stopPropagation trap
  inner.querySelectorAll('.shdd-opt').forEach(function(item){
    item.addEventListener('mousedown', function(e){
      e.preventDefault(); e.stopPropagation();
      var v = item.dataset.val;
      var origSet = HTMLSelectElement.prototype.__shddOrigSet || function(x){this.value=x;};
      origSet.call(sel, v);
      sel.dispatchEvent(new Event('change',{bubbles:true}));

      // Sync ALL elements with the same ID (handle duplicate-id selects inserted by JS patches)
      if(sel.id){
        document.querySelectorAll('select[id="'+sel.id+'"]').forEach(function(other){
          if(other === sel) return;
          origSet.call(other, v);
          // Fire change on the canonical element that has an onchange handler
          if(other.hasAttribute('onchange')){
            other.dispatchEvent(new Event('change',{bubbles:true}));
          }
        });
        // Also call any global function named in the *first* onchange found for this ID
        var canonical = document.querySelector('select[id="'+sel.id+'"][onchange]');
        if(!canonical && sel.hasAttribute('onchange')) canonical = sel;
        if(canonical){
          var fn = (canonical.getAttribute('onchange')||'').replace(/\s*\(.*$/,'').trim();
          if(fn && typeof window[fn]==='function') window[fn]();
        }
      }

      var lbl = wrap.querySelector('.shdd-label');
      if(lbl) lbl.textContent = getLabel(sel);
      inner.querySelectorAll('.shdd-opt').forEach(function(i){ i.classList.remove('shdd-selected'); });
      item.classList.add('shdd-selected');
      closeAll();
    });
  });
}

function syncLabel(wrap, sel){
  var lbl = wrap.querySelector('.shdd-label');
  if(!lbl) return;
  var t = getLabel(sel);
  if(lbl.textContent !== t) lbl.textContent = t;
  if(_wrap===wrap && _panel){
    var cur=String(sel.value);
    _panel.querySelectorAll('.shdd-opt').forEach(function(i){
      i.classList.toggle('shdd-selected', String(i.dataset.val)===cur && cur!=='');
    });
  }
}

// Hide/show wrapper based on select's own 'hidden' class
function syncVisibility(wrap, sel){
  var hidden = sel.classList.contains('hidden');
  wrap.classList.toggle('shdd-hidden', hidden);
  if(hidden && _wrap===wrap) closeAll();
}

// ── Enhance one select ───────────────────────────────────────────────────────
function enhance(sel){
  if(!sel||sel._shddDone) return;
  if(SKIP[sel.id]) return;
  if(sel.classList.contains('shdd-real-select')) return;
  if(sel.closest&&sel.closest('.shdd-wrap')) return;
  sel._shddDone = true;

  // Portal panel appended to body
  var panel = document.createElement('div');
  panel.className = 'shdd-portal-panel';
  panel.innerHTML = '<div class="shdd-panel-inner"></div>';
  document.body.appendChild(panel);

  // Wrapper replaces select in DOM
  var wrap = document.createElement('div');
  wrap.className = 'shdd-wrap';
  if(sel.id) wrap.id = 'shdd-wrap-'+sel.id;
  if(sel.classList.contains('w-full')) wrap.classList.add('w-full');

  sel.parentNode.insertBefore(wrap, sel);
  sel.classList.add('shdd-real-select');
  wrap.appendChild(sel);

  // Trigger button — NOTE: pointer-events:none on children ensures the button is always the target
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'shdd-btn';
  btn.innerHTML = '<span class="shdd-label">'+esc(getLabel(sel))+'</span>'+CHEVRON_SVG;
  wrap.appendChild(btn);

  sel._shddWrap=wrap; sel._shddPanel=panel;
  wrap._shddSel=sel; wrap._shddPanel=panel;

  // Sync initial visibility (e.g. score-title-select starts hidden)
  syncVisibility(wrap, sel);

  if(sel.options.length>0) buildOptions(panel, wrap, sel);

  // KEY FIX: use 'mousedown' not 'click'
  // The plan-modal has: modal.addEventListener('click', e => e.stopPropagation(), true)
  // which prevents 'click' from reaching elements inside via bubble.
  // 'mousedown' is not blocked by that listener.
  btn.addEventListener('mousedown', function(e){
    // Only respond to primary button
    if(e.button!==0) return;
    e.preventDefault();
    e.stopPropagation();
    if(_panel===panel){ closeAll(); return; }
    closeAll();
    buildOptions(panel, wrap, sel);
    positionPanel(panel, btn);
    panel.classList.add('shdd-open');
    wrap.classList.add('shdd-open');
    _panel=panel; _wrap=wrap; _sel=sel;
    var active = panel.querySelector('.shdd-selected');
    if(active) setTimeout(function(){ active.scrollIntoView({block:'nearest'}); }, 20);
  });

  // Also handle touchstart for mobile (touch doesn't fire mousedown the same way)
  btn.addEventListener('touchstart', function(e){
    e.preventDefault();
    e.stopPropagation();
    if(_panel===panel){ closeAll(); return; }
    closeAll();
    buildOptions(panel, wrap, sel);
    positionPanel(panel, btn);
    panel.classList.add('shdd-open');
    wrap.classList.add('shdd-open');
    _panel=panel; _wrap=wrap; _sel=sel;
  }, {passive:false});

  // Watch for option changes (dynamic population) and class changes (hidden/visible)
  var mo = new MutationObserver(function(muts){
    var children=false, attrs=false;
    muts.forEach(function(m){ if(m.type==='childList') children=true; if(m.type==='attributes') attrs=true; });
    if(children){ syncLabel(wrap,sel); if(_panel===panel) buildOptions(panel,wrap,sel); }
    if(attrs) syncVisibility(wrap, sel);
  });
  mo.observe(sel, {childList:true, attributes:true, attributeFilter:['class']});
}

// ── Patch select.value setter to auto-update custom label ────────────────────
(function(){
  var proto = HTMLSelectElement.prototype;
  var desc = Object.getOwnPropertyDescriptor(proto,'value');
  if(!desc||!desc.set||desc.set._shddPatched) return;
  var origSet = desc.set;
  proto.__shddOrigSet = origSet;
  var patchedSet = function(v){
    origSet.call(this,v);
    if(this._shddWrap) syncLabel(this._shddWrap, this);
  };
  patchedSet._shddPatched = true;
  Object.defineProperty(proto,'value',{set:patchedSet,get:desc.get,configurable:true,enumerable:desc.enumerable});
})();

// ── Watch DOM for dynamically added selects ──────────────────────────────────
var domMo = new MutationObserver(function(muts){
  muts.forEach(function(m){
    m.addedNodes.forEach(function(n){
      if(!n||n.nodeType!==1) return;
      if(n.tagName==='SELECT'){ enhance(n); return; }
      if(n.querySelectorAll) n.querySelectorAll('select:not(.shdd-real-select)').forEach(enhance);
    });
  });
});
if(document.body) domMo.observe(document.body,{childList:true,subtree:true});

// ── Initial conversion ───────────────────────────────────────────────────────
function convertAll(){
  document.querySelectorAll('select:not(.shdd-real-select)').forEach(enhance);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', function(){ convertAll(); setTimeout(convertAll,400); setTimeout(convertAll,1200); });
} else { convertAll(); setTimeout(convertAll,400); setTimeout(convertAll,1200); }

})();

// ── วางคะแนนหลายคนพร้อมกัน (Paste Scores) ────────────────────────────────────
// วิธีใช้: คลิกที่ช่องคะแนนของนักเรียนคนแรก แล้ว Ctrl+V (หรือ Cmd+V)
// รองรับ: 1 ตัวเลขต่อบรรทัด, คัดลอกมาจาก Excel/Google Sheets (tab-separated)
document.addEventListener('paste', function(e){
  var target = document.activeElement;
  if(!target || !target.classList.contains('score-input')) return;
  var raw = (e.clipboardData || window.clipboardData).getData('text');
  if(!raw) return;
  e.preventDefault();

  // Split by newlines; for each line take the last numeric part (handles spreadsheet columns)
  var lines = raw.split(/\r?\n|\r/).filter(function(l){ return l.trim() !== ''; });
  var nums = [];
  lines.forEach(function(line){
    var parts = line.split(/\t/);
    for(var i = parts.length-1; i >= 0; i--){
      var v = parseFloat(parts[i].replace(/,/g,'').trim());
      if(!isNaN(v)){ nums.push(v); break; }
    }
    // If line has no numeric value at all, push NaN as placeholder to preserve position
    if(nums.length < lines.indexOf(line)+1) nums.push(NaN);
  });

  var inputs = Array.from(document.querySelectorAll('#score-list .score-input'));
  if(!inputs.length) return;
  var startIdx = inputs.indexOf(target);
  if(startIdx < 0) startIdx = 0;

  var filled = 0;
  nums.forEach(function(num, i){
    if(isNaN(num)) return; // skip non-numeric lines (keep position)
    var inp = inputs[startIdx + i];
    if(!inp) return;
    var maxVal = parseFloat(inp.getAttribute('max'));
    if(num < 0) num = 0;
    if(!isNaN(maxVal) && isFinite(maxVal) && maxVal > 0 && num > maxVal) num = maxVal;
    num = Math.round(num * 100) / 100; // round to 2dp
    inp.value = String(num);
    inp.dispatchEvent(new Event('input', {bubbles:true}));
    // Brief highlight
    inp.style.transition = 'background .3s';
    inp.style.background = '#eef2ff';
    setTimeout((function(el){ return function(){ el.style.background=''; }; })(inp), 800);
    filled++;
  });

  if(filled > 0){
    var toast = document.createElement('div');
    toast.textContent = '\u2713 วางคะแนน ' + filled + ' คน เรียบร้อยแล้ว';
    toast.style.cssText = [
      'position:fixed','bottom:28px','left:50%','transform:translateX(-50%)',
      'background:#4f46e5','color:#fff','padding:10px 24px','border-radius:9999px',
      'font-size:14px','font-weight:700','z-index:2147483647',
      'box-shadow:0 4px 20px rgba(79,70,229,.45)','pointer-events:none','opacity:1',
      'transition:opacity .5s'
    ].join(';');
    document.body.appendChild(toast);
    setTimeout(function(){ toast.style.opacity='0'; }, 2200);
    setTimeout(function(){ if(toast.parentNode) toast.parentNode.removeChild(toast); }, 2800);
  }
});

