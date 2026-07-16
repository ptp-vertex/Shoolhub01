
import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function(){
  if (window.__schoolhubProfileAvatarPatch) return;
  window.__schoolhubProfileAvatarPatch = true;

  const firebaseConfig = {
    apiKey: "AIzaSyADAbTJEWivV1Nn-au7tXofStx4ADYTCM8",
    authDomain: "shoolhub-5677e.firebaseapp.com",
    projectId: "shoolhub-5677e",
    storageBucket: "shoolhub-5677e.firebasestorage.app",
    messagingSenderId: "630487358153",
    appId: "1:630487358153:web:1866add5d4a29b74abcb18",
    measurementId: "G-2Q6R46DC38"
  };
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const PUBLIC = 'public_users_directory';

  const alertBox = (t, m, err = false) => (window.showCustomAlert ? window.showCustomAlert(t, m, err) : alert(t + '\n' + (m || '')));
  const norm = v => String(v || '').trim().toLowerCase();
  const isAdminSession = () => (typeof window.isAdminSession === 'function') ? window.isAdminSession() : (localStorage.getItem('schoolhub_admin_active') === 'true');

  // undefined = ยังไม่แก้ไข, null = ต้องการลบรูป, string(dataURL) = รูปใหม่ที่บีบอัดแล้ว
  let pendingAvatarDataUrl = undefined;

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('อ่านไฟล์ไม่ได้'));
      reader.readAsDataURL(file);
    });
  }
  function dataUrlByteLength(dataUrl) {
    try { return Math.ceil(String(dataUrl || '').length * 0.75); } catch (e) { return 999999999; }
  }
  // บีบอัดรูปโปรไฟล์ด้วยวิธีเดียวกับ compressSlipForFirestore ที่ใช้กับสลิปโอนเงิน
  // รับ dataURL ตรงๆ (ใช้ได้ทั้งไฟล์ต้นฉบับ และรูปที่ผ่านการครอบวงกลมมาแล้ว)
  function compressDataUrlForFirestore(rawDataUrl) {
    const MAX_BYTES = 350000; // เผื่อพื้นที่ document ไว้เยอะกว่าฝั่งสลิปเพราะรูปโปรไฟล์เล็กกว่ามาก
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          let maxSide = 480;
          let quality = 0.86;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { alpha: false });
          let result = rawDataUrl;
          for (let round = 0; round < 12; round++) {
            const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
            canvas.width = Math.max(1, Math.round(img.width * ratio));
            canvas.height = Math.max(1, Math.round(img.height * ratio));
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            result = canvas.toDataURL('image/jpeg', quality);
            if (dataUrlByteLength(result) <= MAX_BYTES) break;
            quality = Math.max(0.4, quality - 0.08);
            maxSide = Math.max(160, Math.floor(maxSide * 0.85));
          }
          resolve(result);
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error('บีบอัดรูปโปรไฟล์ไม่ได้ กรุณาเลือกรูปใหม่'));
      img.src = rawDataUrl;
    });
  }
  async function compressAvatarForFirestore(file) {
    const rawDataUrl = await readFileAsDataURL(file);
    return compressDataUrlForFirestore(rawDataUrl);
  }

  // ── ตัวครอบรูปโปรไฟล์เป็นวงกลม (drag เพื่อเลื่อน, แถบเลื่อนเพื่อซูม) ──────────
  // คืนค่าเป็น dataURL สี่เหลี่ยมจัตุรัสของส่วนที่อยู่ในกรอบวงกลม (พร้อมส่งต่อให้ compressDataUrlForFirestore)
  // หรือคืนค่า null ถ้าผู้ใช้กดยกเลิก
  function openAvatarCropper(file) {
    return new Promise((resolve) => {
      const rawUrl = URL.createObjectURL(file);
      const VIEWPORT = 260;
      const OUTPUT = 640;

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.85);z-index:2147483100;display:flex;align-items:center;justify-content:center;padding:20px;';

      const panel = document.createElement('div');
      panel.style.cssText = 'background:#fff;border-radius:28px;padding:20px;width:100%;max-width:340px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4);font-family:inherit;';

      const title = document.createElement('div');
      title.textContent = 'ครอบรูปโปรไฟล์';
      title.style.cssText = 'font-weight:800;font-size:18px;color:#1e1b4b;margin-bottom:4px;';

      const subtitle = document.createElement('div');
      subtitle.textContent = 'ลากรูปเพื่อเลื่อนตำแหน่ง ใช้แถบเลื่อนเพื่อซูม';
      subtitle.style.cssText = 'font-size:12px;color:#64748b;margin-bottom:14px;';

      const viewportWrap = document.createElement('div');
      viewportWrap.style.cssText = `position:relative;width:${VIEWPORT}px;height:${VIEWPORT}px;margin:0 auto;overflow:hidden;border-radius:9999px;background:#f1f5f9;cursor:grab;touch-action:none;box-shadow:0 0 0 4px #eef2ff, 0 0 0 5px #c7d2fe;`;

      const imgEl = document.createElement('img');
      imgEl.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;user-select:none;pointer-events:none;max-width:none;max-height:none;';
      imgEl.draggable = false;
      viewportWrap.appendChild(imgEl);

      const zoomRow = document.createElement('div');
      zoomRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:16px;';
      const zoomIconMinus = document.createElement('i');
      zoomIconMinus.className = 'fas fa-magnifying-glass-minus';
      zoomIconMinus.style.cssText = 'color:#94a3b8;font-size:12px;';
      const zoomSlider = document.createElement('input');
      zoomSlider.type = 'range';
      zoomSlider.min = '100';
      zoomSlider.max = '300';
      zoomSlider.value = '100';
      zoomSlider.style.cssText = 'flex:1;accent-color:#4f46e5;';
      const zoomIconPlus = document.createElement('i');
      zoomIconPlus.className = 'fas fa-magnifying-glass-plus';
      zoomIconPlus.style.cssText = 'color:#94a3b8;font-size:12px;';
      zoomRow.appendChild(zoomIconMinus);
      zoomRow.appendChild(zoomSlider);
      zoomRow.appendChild(zoomIconPlus);

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:10px;margin-top:18px;';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'ยกเลิก';
      cancelBtn.style.cssText = 'flex:1;padding:12px;border-radius:16px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-weight:700;cursor:pointer;';
      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.innerHTML = '<i class="fas fa-check mr-1"></i> ใช้รูปนี้';
      confirmBtn.disabled = true;
      confirmBtn.style.cssText = 'flex:1;padding:12px;border-radius:16px;border:none;background:#4f46e5;color:#fff;font-weight:800;cursor:pointer;opacity:.5;';
      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(confirmBtn);

      panel.appendChild(title);
      panel.appendChild(subtitle);
      panel.appendChild(viewportWrap);
      panel.appendChild(zoomRow);
      panel.appendChild(btnRow);
      overlay.appendChild(panel);

      let naturalW = 0, naturalH = 0, baseScale = 1, scale = 1, tx = 0, ty = 0;
      let dragging = false, startX = 0, startY = 0, startTx = 0, startTy = 0;
      let settled = false;

      function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

      function applyTransform() {
        const dispW = naturalW * scale;
        const dispH = naturalH * scale;
        tx = clamp(tx, VIEWPORT - dispW, 0);
        ty = clamp(ty, VIEWPORT - dispH, 0);
        imgEl.style.width = dispW + 'px';
        imgEl.style.height = dispH + 'px';
        imgEl.style.left = tx + 'px';
        imgEl.style.top = ty + 'px';
      }

      function finish(result) {
        if (settled) return;
        settled = true;
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        URL.revokeObjectURL(rawUrl);
        resolve(result);
      }

      imgEl.onload = () => {
        naturalW = imgEl.naturalWidth;
        naturalH = imgEl.naturalHeight;
        if (!naturalW || !naturalH) { finish(null); alertBox('เปิดรูปไม่สำเร็จ', 'กรุณาเลือกไฟล์รูปภาพใหม่', true); return; }
        baseScale = Math.max(VIEWPORT / naturalW, VIEWPORT / naturalH);
        scale = baseScale;
        tx = (VIEWPORT - naturalW * scale) / 2;
        ty = (VIEWPORT - naturalH * scale) / 2;
        applyTransform();
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
      };
      imgEl.onerror = () => { finish(null); alertBox('เปิดรูปไม่สำเร็จ', 'กรุณาเลือกไฟล์รูปภาพใหม่', true); };
      imgEl.src = rawUrl;

      viewportWrap.addEventListener('pointerdown', (e) => {
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startTx = tx; startTy = ty;
        viewportWrap.style.cursor = 'grabbing';
        try { viewportWrap.setPointerCapture(e.pointerId); } catch (err) {}
      });
      viewportWrap.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        tx = startTx + (e.clientX - startX);
        ty = startTy + (e.clientY - startY);
        applyTransform();
      });
      function endDrag() { dragging = false; viewportWrap.style.cursor = 'grab'; }
      viewportWrap.addEventListener('pointerup', endDrag);
      viewportWrap.addEventListener('pointercancel', endDrag);
      viewportWrap.addEventListener('pointerleave', endDrag);

      zoomSlider.addEventListener('input', () => {
        if (!naturalW) return;
        const factor = Number(zoomSlider.value) / 100;
        const centerX = VIEWPORT / 2, centerY = VIEWPORT / 2;
        const imgCenterX = (centerX - tx) / scale;
        const imgCenterY = (centerY - ty) / scale;
        scale = baseScale * factor;
        tx = centerX - imgCenterX * scale;
        ty = centerY - imgCenterY * scale;
        applyTransform();
      });

      cancelBtn.addEventListener('click', () => finish(null));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(null); });
      confirmBtn.addEventListener('click', () => {
        try {
          const sx = -tx / scale;
          const sy = -ty / scale;
          const sSize = VIEWPORT / scale;
          const outCanvas = document.createElement('canvas');
          outCanvas.width = OUTPUT;
          outCanvas.height = OUTPUT;
          const ctx = outCanvas.getContext('2d', { alpha: false });
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, OUTPUT, OUTPUT);
          ctx.drawImage(imgEl, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);
          const dataUrl = outCanvas.toDataURL('image/jpeg', 0.95);
          finish(dataUrl);
        } catch (e) {
          finish(null);
          alertBox('ครอบรูปไม่สำเร็จ', e?.message || String(e), true);
        }
      });

      document.body.appendChild(overlay);
    });
  }


  function setSettingsAvatarPreview(url) {
    const img = document.getElementById('settings-profile-avatar-img');
    const initial = document.getElementById('settings-profile-avatar-initial');
    if (img) {
      if (url) { img.src = url; img.classList.remove('hidden'); } else { img.src = ''; img.classList.add('hidden'); }
    }
    if (initial) initial.classList.toggle('hidden', !!url);
    const removeBtn = document.getElementById('settings-profile-avatar-remove-btn');
    if (removeBtn) removeBtn.classList.toggle('hidden', !url);
  }

  // เช่นเดียวกับ setSettingsAvatarPreview แต่สำหรับป็อปอัพ "โปรไฟล์ผู้ใช้งาน" (user-profile-modal)
  function setUserProfileModalAvatarPreview(url) {
    const img = document.getElementById('user-profile-avatar-img');
    const initial = document.getElementById('user-profile-avatar-initial');
    if (img) {
      if (url) { img.src = url; img.classList.remove('hidden'); } else { img.src = ''; img.classList.add('hidden'); }
    }
    if (initial) initial.classList.toggle('hidden', !!url);
    const removeBtn = document.getElementById('user-profile-avatar-remove-btn');
    if (removeBtn) removeBtn.classList.toggle('hidden', !url);
  }

  // อัปเดต preview ทุกจุดที่แสดงรูปโปรไฟล์พร้อมกัน (แผงตั้งค่า + ป็อปอัพโปรไฟล์)
  function setAllAvatarPreviews(url) {
    setSettingsAvatarPreview(url);
    setUserProfileModalAvatarPreview(url);
  }

  // เปิดรูปโปรไฟล์แบบเต็มจอ (กดที่รูปเพื่อ "ดู")
  function openAvatarLightbox(url) {
    if (!url) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.85);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out;';
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'รูปโปรไฟล์';
    img.style.cssText = 'max-width:min(90vw,420px);max-height:80vh;border-radius:24px;box-shadow:0 20px 60px rgba(0,0,0,.5);border:4px solid #fff;';
    overlay.appendChild(img);
    const closeIt = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') closeIt(); };
    overlay.addEventListener('click', closeIt);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  }

  // อัปเดตรูปโปรไฟล์วงกลมที่แถบเมนูด้านซ้าย (sidebar) ทันทีเมื่อโหลด/บันทึกเสร็จ
  window.setUserAvatarPhoto = function (url) {
    const img = document.getElementById('user-avatar-photo');
    const initial = document.getElementById('user-avatar-initial');
    if (img) {
      if (url) { img.src = url; img.classList.remove('hidden'); } else { img.src = ''; img.classList.add('hidden'); }
    }
    if (initial) initial.style.visibility = url ? 'hidden' : 'visible';
  };

  async function loadAvatarForCurrentUser() {
    pendingAvatarDataUrl = undefined;
    let url = '';
    try {
      if (isAdminSession()) {
        const snap = await getDoc(doc(db, 'admin_settings', 'credentials'));
        url = snap.exists() ? (snap.data().photoURL || '') : '';
      } else {
        const user = auth.currentUser;
        const email = norm(user && user.email);
        if (email) {
          const snap = await getDoc(doc(db, PUBLIC, email));
          url = snap.exists() ? (snap.data().photoURL || '') : '';
        }
      }
    } catch (e) { console.warn('โหลดรูปโปรไฟล์ไม่สำเร็จ', e); }
    setAllAvatarPreviews(url);
    window.setUserAvatarPhoto(url);
    return url;
  }
  window.schoolhubLoadProfileAvatar = loadAvatarForCurrentUser;

  async function saveAvatarIfChanged() {
    if (pendingAvatarDataUrl === undefined) return; // ผู้ใช้ไม่ได้แก้รูป ไม่ต้องบันทึกซ้ำ
    const value = pendingAvatarDataUrl === null ? '' : pendingAvatarDataUrl;
    if (isAdminSession()) {
      await setDoc(doc(db, 'admin_settings', 'credentials'), { photoURL: value, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      const user = auth.currentUser;
      const email = norm(user && user.email);
      if (email) {
        await setDoc(doc(db, PUBLIC, email), { photoURL: value, updatedAt: serverTimestamp() }, { merge: true });
      }
    }
    pendingAvatarDataUrl = undefined;
    window.setUserAvatarPhoto(value);
    setAllAvatarPreviews(value);
  }

  document.addEventListener('click', function (e) {
    const pickBtn = e.target.closest && e.target.closest('#settings-profile-avatar-pick-btn, #user-profile-avatar-pick-btn');
    if (pickBtn) {
      e.preventDefault();
      const inputId = pickBtn.id === 'user-profile-avatar-pick-btn' ? 'user-profile-avatar-input' : 'settings-profile-avatar-input';
      document.getElementById(inputId)?.click();
      return;
    }
    const removeBtn = e.target.closest && e.target.closest('#settings-profile-avatar-remove-btn, #user-profile-avatar-remove-btn');
    if (removeBtn) {
      e.preventDefault();
      pendingAvatarDataUrl = null;
      setAllAvatarPreviews('');
      return;
    }
    // กดที่รูปโปรไฟล์เอง (ทั้งวงกลมตัวอักษร และรูปจริง) ในป็อปอัพ -> ถ้ามีรูปแล้วให้ดูขนาดเต็ม ถ้ายังไม่มีรูปให้เปิดเลือกไฟล์เลย
    const avatarImg = e.target.closest && e.target.closest('#user-profile-avatar-img');
    if (avatarImg) {
      e.preventDefault();
      openAvatarLightbox(avatarImg.src);
      return;
    }
    const avatarInitial = e.target.closest && e.target.closest('#user-profile-avatar-initial');
    if (avatarInitial) {
      e.preventDefault();
      document.getElementById('user-profile-avatar-input')?.click();
      return;
    }
  });

  document.addEventListener('change', async function (e) {
    const input = e.target.closest && e.target.closest('#settings-profile-avatar-input, #user-profile-avatar-input');
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    if (!file.type || !file.type.startsWith('image/')) {
      alertBox('ไฟล์ไม่ถูกต้อง', 'กรุณาเลือกไฟล์รูปภาพ (JPG/PNG)', true);
      input.value = '';
      return;
    }
    input.value = ''; // เคลียร์ไว้ก่อน เพื่อให้เลือกไฟล์เดิมซ้ำได้ในครั้งถัดไป
    try {
      const croppedDataUrl = await openAvatarCropper(file);
      if (!croppedDataUrl) return; // ผู้ใช้กดยกเลิกตอนครอบรูป
      if (typeof window.loader === 'function') window.loader(true);
      const compressed = await compressDataUrlForFirestore(croppedDataUrl);
      pendingAvatarDataUrl = compressed;
      setAllAvatarPreviews(compressed);
    } catch (err) {
      alertBox('บีบอัดรูปไม่สำเร็จ', err?.message || String(err), true);
    } finally {
      if (typeof window.loader === 'function') window.loader(false);
    }
  });

  // เมื่อแผงโปรไฟล์ในหน้าตั้งค่าถูก render ขึ้นมา (มีปุ่มกล้องปรากฏ) ให้โหลดรูปปัจจุบันมาแสดง
  const observer = new MutationObserver(function () {
    const host = document.getElementById('schoolhub-settings-profile-host');
    if (host && host.querySelector('#settings-profile-avatar-pick-btn') && host.dataset.shcmAvatarLoaded !== '1') {
      host.dataset.shcmAvatarLoaded = '1';
      loadAvatarForCurrentUser();
    }
    // ถ้าแผงถูก render ใหม่ทับ (เช่นสลับแท็บไปมา) ให้รีเซ็ต flag เพื่อโหลดรูปให้ตรงกับ session ปัจจุบันอีกครั้ง
    if (host && !host.querySelector('#settings-profile-avatar-pick-btn')) {
      host.dataset.shcmAvatarLoaded = '';
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ห่อฟังก์ชันบันทึกโปรไฟล์เดิม เพื่อบันทึกรูปโปรไฟล์ไปพร้อมกันทุกครั้งที่กด "บันทึกโปรไฟล์"
  function wrapSaveProfile() {
    const fn = window.saveSettingsProfileChanges;
    if (typeof fn !== 'function' || fn.__avatarPatchWrapped) return;
    const original = fn;
    const wrapped = async function () {
      try { await saveAvatarIfChanged(); } catch (e) { console.warn('บันทึกรูปโปรไฟล์ไม่สำเร็จ', e); alertBox('บันทึกรูปโปรไฟล์ไม่สำเร็จ', e?.message || String(e), true); }
      return original.apply(this, arguments);
    };
    wrapped.__avatarPatchWrapped = true;
    window.saveSettingsProfileChanges = wrapped;
  }
  let saveWrapTries = 0;
  const saveWrapIv = setInterval(function () {
    wrapSaveProfile();
    saveWrapTries++;
    if (saveWrapTries > 60) clearInterval(saveWrapIv);
  }, 1000);
  document.addEventListener('DOMContentLoaded', wrapSaveProfile);
  wrapSaveProfile();

  // ห่อฟังก์ชันเปิด/บันทึกของป็อปอัพ "โปรไฟล์ผู้ใช้งาน" (user-profile-modal) เพื่อให้โหลด/บันทึกรูปโปรไฟล์ไปพร้อมกันด้วย
  function wrapUserProfilePopup() {
    const openFn = window.openUserProfileSettings;
    if (typeof openFn === 'function' && !openFn.__avatarPatchWrapped) {
      const originalOpen = openFn;
      const wrappedOpen = async function () {
        const result = await originalOpen.apply(this, arguments);
        try { await loadAvatarForCurrentUser(); } catch (e) { console.warn('โหลดรูปโปรไฟล์ในป็อปอัพไม่สำเร็จ', e); }
        return result;
      };
      wrappedOpen.__avatarPatchWrapped = true;
      window.openUserProfileSettings = wrappedOpen;
    }
    const saveFn = window.saveUserProfileChanges;
    if (typeof saveFn === 'function' && !saveFn.__avatarPatchWrapped) {
      const originalSave = saveFn;
      const wrappedSave = async function () {
        try { await saveAvatarIfChanged(); } catch (e) { console.warn('บันทึกรูปโปรไฟล์ในป็อปอัพไม่สำเร็จ', e); alertBox('บันทึกรูปโปรไฟล์ไม่สำเร็จ', e?.message || String(e), true); }
        return originalSave.apply(this, arguments);
      };
      wrappedSave.__avatarPatchWrapped = true;
      window.saveUserProfileChanges = wrappedSave;
    }
  }
  let userProfileWrapTries = 0;
  const userProfileWrapIv = setInterval(function () {
    wrapUserProfilePopup();
    userProfileWrapTries++;
    if (userProfileWrapTries > 60) clearInterval(userProfileWrapIv);
  }, 1000);
  document.addEventListener('DOMContentLoaded', wrapUserProfilePopup);
  wrapUserProfilePopup();

  onAuthStateChanged(auth, function (user) {
    if (user) setTimeout(loadAvatarForCurrentUser, 700);
    else window.setUserAvatarPhoto('');
  });
})();
