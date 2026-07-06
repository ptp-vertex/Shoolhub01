
/* =========================================================
   FINAL FIX: Profile button works for every logged-in account
   - ไม่อ้าง currentUser ที่เป็นตัวแปรใน module อื่น
   - Admin bypass ใช้สถานะจาก localStorage/หน้าหลัก + อ่าน Firestore โดยตรง
   - ผู้ใช้ปกติใช้ Firebase Auth currentUser
   ========================================================= */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const profileFixConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
};

const profileFixApp = getApps().length ? getApp() : initializeApp(profileFixConfig);
const profileFixDb = getFirestore(profileFixApp);
const profileFixAuth = getAuth(profileFixApp);
const $pf = (id) => document.getElementById(id);

function pfAlert(title, message, isError=false){
    if (typeof window.showCustomAlert === 'function') return window.showCustomAlert(title, message, isError);
    alert((title || '') + (message ? '\n' + message : ''));
}
function pfOpenModal(id){
    if (typeof window.openModal === 'function') return window.openModal(id);
    $pf(id)?.classList.remove('hidden');
}
function pfCloseModal(id){
    if (typeof window.closeModal === 'function') return window.closeModal(id);
    $pf(id)?.classList.add('hidden');
}
function pfLoader(show){
    if (typeof window.toggleLoader === 'function') window.toggleLoader(!!show);
}
function pfEnsureAdminFields(){
    const emailInput = $pf('profile-email-input');
    const passWrap = $pf('admin-profile-password-wrap');
    if (emailInput) {
        emailInput.removeAttribute('readonly');
        emailInput.classList.remove('bg-slate-100','text-slate-500');
        emailInput.classList.add('bg-slate-50');
    }
    if (!$pf('profile-admin-username-input') && emailInput) {
        const wrap = document.createElement('div');
        wrap.id = 'profile-admin-username-wrap';
        wrap.innerHTML = `
            <label class="block text-sm font-bold text-slate-700 mb-1.5">ชื่อผู้ใช้ Admin</label>
            <input id="profile-admin-username-input" type="text" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-primary" placeholder="เช่น Admin">
        `;
        emailInput.closest('div')?.insertAdjacentElement('beforebegin', wrap);
    }
    const uInput = $pf('profile-admin-username-input');
    if (uInput) {
        const uWrap = uInput.closest('div');
        if (uWrap && uWrap.id !== 'profile-admin-username-wrap') uWrap.id = 'profile-admin-username-wrap';
    }
    if (passWrap) {
        const note = passWrap.querySelector('p');
        if (note) note.textContent = 'แก้ชื่อผู้ใช้ อีเมล และรหัสผ่าน Admin ได้จากโปรไฟล์นี้ โดยบันทึกลง Firebase โดยตรง';
    }
}
function pfIsMainVisible(){
    const main = $pf('main-app');
    return !!main && !main.classList.contains('hidden');
}
function pfIsAdminSession(){
    const nameText = ($pf('user-display-name')?.textContent || '').trim().toLowerCase();
    const emailText = ($pf('user-display-email')?.textContent || '').trim().toLowerCase();
    return localStorage.getItem('schoolhub_admin_active') === 'true'
        || localStorage.getItem('schoolhub_admin_logged_in') === 'true'
        || localStorage.getItem('schoolhub_is_admin') === 'true'
        || nameText.includes('admin')
        || emailText === 'admin'
        || emailText.includes('ptp.vertex')
        || (pfIsMainVisible() && document.body.innerText.includes('จัดการระบบ'));
}
async function pfReadAdmin(){
    const ref = doc(profileFixDb, 'admin_settings', 'credentials');
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : {};
}
async function pfWriteAdmin(data){
    const ref = doc(profileFixDb, 'admin_settings', 'credentials');
    const sec = doc(profileFixDb, 'admin_settings', 'security');
    await setDoc(ref, data, { merge:true });
    await setDoc(sec, { requirePasswordChange:false, updatedAt:serverTimestamp(), lastPasswordChange:serverTimestamp() }, { merge:true });
}
function pfSetHeader(name, email){
    if ($pf('user-display-name')) $pf('user-display-name').textContent = name || 'Administrator';
    if ($pf('user-display-email')) $pf('user-display-email').textContent = email || 'Admin';
    if ($pf('user-avatar-initial')) $pf('user-avatar-initial').textContent = (name || 'A').trim().charAt(0).toUpperCase();
}

window.openUserProfileSettings = async function(){
    const authUser = profileFixAuth.currentUser;
    const isAdmin = pfIsAdminSession();

    if (!authUser && !isAdmin && !pfIsMainVisible()) {
        return pfAlert('ยังไม่ได้เข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนใช้งานโปรไฟล์', true);
    }

    pfEnsureAdminFields();

    if (isAdmin) {
        try {
            const d = await pfReadAdmin();
            const username = (d.username || localStorage.getItem('schoolhub_admin_username') || 'Admin').trim();
            const displayName = (d.displayName || d.name || localStorage.getItem('schoolhub_admin_name') || 'Administrator').trim();
            const email = (d.email || localStorage.getItem('schoolhub_admin_email') || '').trim();

            if ($pf('profile-admin-username-wrap')) $pf('profile-admin-username-wrap').classList.remove('hidden');
            if ($pf('profile-display-name-input')) $pf('profile-display-name-input').value = displayName;
            if ($pf('profile-admin-username-input')) $pf('profile-admin-username-input').value = username;
            if ($pf('profile-email-input')) $pf('profile-email-input').value = email;
            if ($pf('admin-profile-password-input')) $pf('admin-profile-password-input').value = '';
            if ($pf('admin-profile-password-wrap')) $pf('admin-profile-password-wrap').classList.remove('hidden');
            const resetBtn = document.querySelector('#user-profile-modal [data-reset-password]');
            if (resetBtn) resetBtn.classList.add('hidden');

            localStorage.setItem('schoolhub_admin_active', 'true');
            localStorage.setItem('schoolhub_admin_username', username);
            localStorage.setItem('schoolhub_admin_name', displayName);
            localStorage.setItem('schoolhub_admin_email', email || username);
            pfSetHeader(displayName, email || username);
        } catch (e) {
            console.warn('Admin profile load failed:', e);
            if ($pf('profile-display-name-input')) $pf('profile-display-name-input').value = localStorage.getItem('schoolhub_admin_name') || 'Administrator';
            if ($pf('profile-admin-username-input')) $pf('profile-admin-username-input').value = localStorage.getItem('schoolhub_admin_username') || 'Admin';
            if ($pf('profile-email-input')) $pf('profile-email-input').value = localStorage.getItem('schoolhub_admin_email') || '';
            if ($pf('admin-profile-password-wrap')) $pf('admin-profile-password-wrap').classList.remove('hidden');
        }
    } else {
        const wrap = $pf('profile-admin-username-wrap');
        if (wrap) wrap.classList.add('hidden');
        if ($pf('profile-display-name-input')) $pf('profile-display-name-input').value = authUser?.displayName || ($pf('user-display-name')?.textContent || '').trim();
        if ($pf('profile-email-input')) $pf('profile-email-input').value = authUser?.email || ($pf('user-display-email')?.textContent || '').trim();
        if ($pf('admin-profile-password-wrap')) $pf('admin-profile-password-wrap').classList.add('hidden');
        const resetBtn = document.querySelector('#user-profile-modal [data-reset-password]');
        if (resetBtn) resetBtn.classList.remove('hidden');
    }

    pfOpenModal('user-profile-modal');
};

function pfSetSaveBtnLoading(loading){
    const btn = $pf('user-profile-save-btn');
    if (!btn) return;
    if (loading) {
        if (!btn.dataset.origHtml) btn.dataset.origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.classList.add('opacity-70','cursor-not-allowed');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> กำลังบันทึก...';
    } else {
        btn.disabled = false;
        btn.classList.remove('opacity-70','cursor-not-allowed');
        if (btn.dataset.origHtml) { btn.innerHTML = btn.dataset.origHtml; delete btn.dataset.origHtml; }
    }
}

window.saveUserProfileChanges = async function(){
    const isAdmin = pfIsAdminSession();
    const authUser = profileFixAuth.currentUser;
    const displayName = ($pf('profile-display-name-input')?.value || '').trim();
    if (!displayName) return pfAlert('กรอกข้อมูลไม่ครบ', 'กรุณากรอกชื่อที่แสดง', true);

    pfSetSaveBtnLoading(true);
    pfLoader(true);
    try {
        if (isAdmin) {
            let username = ($pf('profile-admin-username-input')?.value || 'Admin').trim() || 'Admin';
            let email = ($pf('profile-email-input')?.value || '').trim();
            const newPass = ($pf('admin-profile-password-input')?.value || '').trim();
            const old = await pfReadAdmin();
            const password = newPass || old.password || 'Admin123';
            if (password.length < 6) throw new Error('รหัสผ่าน Admin ต้องมีอย่างน้อย 6 ตัวอักษร');
            await pfWriteAdmin({
                username,
                email,
                displayName,
                password,
                updatedAt: serverTimestamp(),
                updatedBy: 'admin'
            });
            localStorage.setItem('schoolhub_admin_active', 'true');
            localStorage.setItem('schoolhub_admin_username', username);
            localStorage.setItem('schoolhub_admin_name', displayName);
            localStorage.setItem('schoolhub_admin_email', email || username);
            pfSetHeader(displayName, email || username);
            if ($pf('admin-profile-password-input')) $pf('admin-profile-password-input').value = '';
            pfCloseModal('user-profile-modal');
            pfAlert('บันทึกสำเร็จ', 'บันทึกโปรไฟล์ Admin ลง Firebase แล้ว');
        } else {
            if (!authUser) throw new Error('ไม่พบข้อมูลผู้ใช้ที่เข้าสู่ระบบ');
            await updateProfile(authUser, { displayName });
            if ($pf('user-display-name')) $pf('user-display-name').textContent = displayName;
            if ($pf('user-avatar-initial')) $pf('user-avatar-initial').textContent = displayName.charAt(0).toUpperCase();
            pfCloseModal('user-profile-modal');
            pfAlert('บันทึกสำเร็จ', 'แก้ไขชื่อที่แสดงเรียบร้อยแล้ว');
        }
    } catch (e) {
        pfAlert('บันทึกไม่สำเร็จ', e?.message || String(e), true);
    } finally {
        pfLoader(false);
        pfSetSaveBtnLoading(false);
    }
};

window.requestOwnPasswordReset = function(event){
    if (typeof window.openResetPasswordPage === 'function') {
        return window.openResetPasswordPage(event);
    }
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    window.open('./reset-password.html', '_blank', 'noopener,noreferrer');
    return false;
};
