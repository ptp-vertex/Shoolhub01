
/* SchoolHub Admin Credentials Setup/Profile Final Override
   แก้เฉพาะการตั้งค่าแอดมิน:
   - ป็อปอัพสีแดงครั้งแรกบันทึกไป admin_settings/credentials จริง
   - โปรไฟล์ Admin แก้ username / email / password ได้ และบันทึกไป Firebase จริง
   - ไม่ใช้ localStorage สำหรับรหัสแอดมิน
*/
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const adminCredFinalConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
};

const adminCredFinalApp = getApps().length ? getApp() : initializeApp(adminCredFinalConfig);
const adminCredFinalDb = getFirestore(adminCredFinalApp);
const adminCredRef = doc(adminCredFinalDb, 'admin_settings', 'credentials');
const adminSecRef = doc(adminCredFinalDb, 'admin_settings', 'security');

function $(id){ return document.getElementById(id); }
function norm(v){ return String(v || '').trim(); }
function normEmail(v){ return norm(v).toLowerCase(); }
function isEmail(v){ const s = norm(v); return !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

function clearOldAdminLocalFinal(){
    try{
        [
            'schoolhub_admin_password',
            'schoolhub_admin_default_disabled',
            'schoolhub_admin_bypass',
            'schoolhub_admin_name',
            'adminUsername',
            'adminPassword',
            'admin_credentials',
            'adminCredentials'
        ].forEach(k=>{
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        });
    }catch(e){}
}

async function ensureAdminCredDocsFinal(){
    const [credSnap, secSnap] = await Promise.all([getDoc(adminCredRef), getDoc(adminSecRef)]);
    if(!credSnap.exists()){
        await setDoc(adminCredRef, {
            username: 'Admin',
            email: '',
            password: 'Admin123',
            displayName: 'Administrator',
            updatedAt: serverTimestamp(),
            updatedBy: 'system'
        }, {merge:true});
    }else{
        const d = credSnap.data() || {};
        const patch = {};
        if(!('username' in d)) patch.username = 'Admin';
        if(!('email' in d)) patch.email = '';
        if(!('password' in d)) patch.password = 'Admin123';
        if(!('displayName' in d)) patch.displayName = d.name || 'Administrator';
        if(Object.keys(patch).length) await setDoc(adminCredRef, patch, {merge:true});
    }
    if(!secSnap.exists()){
        await setDoc(adminSecRef, {
            requirePasswordChange: true,
            lastPasswordChange: 0,
            updatedAt: serverTimestamp()
        }, {merge:true});
    }
}

async function readAdminCredFinal(){
    await ensureAdminCredDocsFinal();
    const snap = await getDoc(adminCredRef);
    return snap.exists() ? (snap.data() || {}) : {};
}

async function saveAdminCredFinal({username, email, password, displayName, requirePasswordChange=false}){
    username = norm(username);
    email = normEmail(email);
    password = norm(password);
    displayName = norm(displayName) || username || 'Administrator';

    if(!username) throw new Error('กรุณากรอกชื่อผู้ใช้ Admin');
    if(!isEmail(email)) throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
    if(!password || password.length < 6) throw new Error('รหัสผ่าน Admin ต้องมีอย่างน้อย 6 ตัวอักษร');

    await setDoc(adminCredRef, {
        username,
        email,
        password,
        displayName,
        updatedAt: serverTimestamp(),
        updatedBy: 'admin'
    }, {merge:true});

    await setDoc(adminSecRef, {
        requirePasswordChange,
        lastPasswordChange: serverTimestamp(),
        updatedAt: serverTimestamp()
    }, {merge:true});

    clearOldAdminLocalFinal();
}

function ensureFirstSetupFields(){
    const modal = $('admin-first-setup-modal');
    if(!modal) return;

    const nameInput = $('admin-setup-name');
    if(nameInput){
        const label = nameInput.closest('div')?.querySelector('label');
        if(label) label.textContent = 'ชื่อที่แสดง';
    }

    if(!$('admin-setup-username') && nameInput){
        const div = document.createElement('div');
        div.innerHTML = `
            <label class="block text-sm font-bold text-slate-700 mb-1.5">ชื่อผู้ใช้ Admin</label>
            <input id="admin-setup-username" type="text" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-400" placeholder="เช่น Admin">
        `;
        nameInput.closest('div')?.before(div);
    }

    if(!$('admin-setup-email') && nameInput){
        const div = document.createElement('div');
        div.innerHTML = `
            <label class="block text-sm font-bold text-slate-700 mb-1.5">อีเมล Admin</label>
            <input id="admin-setup-email" type="email" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-400" placeholder="เว้นว่างได้ หรือใส่อีเมลที่ให้ล็อกอินได้">
        `;
        nameInput.closest('div')?.after(div);
    }
}

function ensureProfileAdminFields(){
    const emailInput = $('profile-email-input');
    const passWrap = $('admin-profile-password-wrap');
    if(!emailInput) return;

    // ให้แก้อีเมลได้
    emailInput.removeAttribute('readonly');
    emailInput.classList.remove('bg-slate-100','text-slate-500');
    emailInput.classList.add('bg-slate-50');

    if(!$('profile-admin-username-input')){
        const div = document.createElement('div');
        div.innerHTML = `
            <label class="block text-sm font-bold text-slate-700 mb-1.5">ชื่อผู้ใช้ Admin</label>
            <input id="profile-admin-username-input" type="text" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-primary" placeholder="เช่น Admin">
        `;
        emailInput.closest('div')?.before(div);
    }

    const passText = passWrap?.querySelector('p');
    if(passText) passText.textContent = 'แก้ชื่อผู้ใช้ อีเมล และรหัสผ่าน Admin ได้จากโปรไฟล์นี้ โดยบันทึกลง Firebase โดยตรง';
}

window.openAdminFirstSetupModal = async function(){
    ensureFirstSetupFields();
    const d = await readAdminCredFinal();
    if($('admin-setup-username')) $('admin-setup-username').value = d.username || 'Admin';
    if($('admin-setup-name')) $('admin-setup-name').value = d.displayName || d.name || 'Administrator';
    if($('admin-setup-email')) $('admin-setup-email').value = d.email || '';
    if($('admin-setup-password')) $('admin-setup-password').value = '';
    if(typeof openModal === 'function') openModal('admin-first-setup-modal');
    else $('admin-first-setup-modal')?.classList.remove('hidden');
};

window.saveAdminFirstSetup = async function(){
    ensureFirstSetupFields();
    const username = $('admin-setup-username')?.value || 'Admin';
    const displayName = $('admin-setup-name')?.value || 'Administrator';
    const email = $('admin-setup-email')?.value || '';
    const password = $('admin-setup-password')?.value || '';

    if(!norm(username)) return showCustomAlert('กรุณากรอกชื่อผู้ใช้ Admin', 'ช่องชื่อผู้ใช้ Admin ห้ามว่าง', true);
    if(!norm(displayName)) return showCustomAlert('กรุณากรอกชื่อที่แสดง', 'ชื่อที่แสดงห้ามว่าง', true);
    if(!isEmail(email)) return showCustomAlert('อีเมลไม่ถูกต้อง', 'กรุณากรอกอีเมลให้ถูกต้อง หรือเว้นว่างไว้', true);
    if(!password || password.length < 6) return showCustomAlert('รหัสผ่านสั้นเกินไป', 'รหัสผ่าน Admin ต้องมีอย่างน้อย 6 ตัวอักษร', true);

    if(typeof toggleLoader === 'function') toggleLoader(true);
    try{
        await saveAdminCredFinal({username, email, password, displayName, requirePasswordChange:false});
        if(typeof currentUser !== 'undefined' && currentUser) {
            currentUser.displayName = displayName;
            currentUser.email = email || username;
        }
        if($('user-display-name')) $('user-display-name').textContent = displayName;
        if($('user-display-email')) $('user-display-email').textContent = email || username;
        if($('user-avatar-initial')) $('user-avatar-initial').textContent = displayName.charAt(0).toUpperCase();
        if(typeof closeModal === 'function') closeModal('admin-first-setup-modal');
        else $('admin-first-setup-modal')?.classList.add('hidden');
        showCustomAlert('ตั้งค่า Admin สำเร็จ', 'บันทึกชื่อผู้ใช้ อีเมล และรหัสผ่าน Admin ลง Firebase เรียบร้อยแล้ว');
    }catch(err){
        showCustomAlert('บันทึก Admin ไม่สำเร็จ', err.message || String(err), true);
    }finally{
        if(typeof toggleLoader === 'function') toggleLoader(false);
    }
};

const oldOpenUserProfileSettingsFinal = window.openUserProfileSettings;
window.openUserProfileSettings = async function(){
    if(typeof oldOpenUserProfileSettingsFinal === 'function') oldOpenUserProfileSettingsFinal();
    setTimeout(async ()=>{
        ensureProfileAdminFields();
        if(typeof currentUser !== 'undefined' && currentUser?.uid === 'admin-bypass'){
            try{
                const d = await readAdminCredFinal();
                if($('profile-admin-username-input')) $('profile-admin-username-input').value = d.username || 'Admin';
                if($('profile-display-name-input')) $('profile-display-name-input').value = d.displayName || d.name || 'Administrator';
                if($('profile-email-input')) $('profile-email-input').value = d.email || '';
                if($('admin-profile-password-wrap')) $('admin-profile-password-wrap').classList.remove('hidden');
            }catch(e){}
        }
    }, 80);
};

const oldSaveUserProfileChangesFinal = window.saveUserProfileChanges;
window.saveUserProfileChanges = async function(){
    if(typeof currentUser === 'undefined' || currentUser?.uid !== 'admin-bypass'){
        return oldSaveUserProfileChangesFinal ? oldSaveUserProfileChangesFinal() : undefined;
    }

    ensureProfileAdminFields();

    let username = $('profile-admin-username-input')?.value || 'Admin';
    const displayName = $('profile-display-name-input')?.value || 'Administrator';
    let email = $('profile-email-input')?.value || '';
    const newPassword = $('admin-profile-password-input')?.value || '';

    username = norm(username);
    email = normEmail(email);

    // กันกรอกสลับช่อง: ถ้าช่องชื่อผู้ใช้เป็นอีเมล และช่องอีเมลเป็นคำว่า Admin/ไม่ใช่อีเมล ให้สลับกลับให้อัตโนมัติ
    if(isEmail(username) && username.includes('@') && email && !isEmail(email)){
        const swappedUsername = email;
        email = username;
        username = swappedUsername;
        if($('profile-admin-username-input')) $('profile-admin-username-input').value = username;
        if($('profile-email-input')) $('profile-email-input').value = email;
    }

    if(!norm(username)) return showCustomAlert('กรุณากรอกชื่อผู้ใช้ Admin', 'ช่องชื่อผู้ใช้ Admin ห้ามว่าง', true);
    if(!norm(displayName)) return showCustomAlert('กรุณากรอกชื่อ', 'ชื่อที่แสดงห้ามว่าง', true);
    if(email && !isEmail(email)) return showCustomAlert('อีเมลไม่ถูกต้อง', 'กรุณากรอกอีเมลให้ถูกต้อง หรือเว้นว่างไว้', true);

    if(typeof toggleLoader === 'function') toggleLoader(true);
    try{
        const old = await readAdminCredFinal();
        const password = newPassword ? newPassword : (old.password || 'Admin123');
        if(password.length < 6) throw new Error('รหัสผ่าน Admin ต้องมีอย่างน้อย 6 ตัวอักษร');

        await saveAdminCredFinal({username, email, password, displayName, requirePasswordChange:false});

        currentUser.displayName = displayName;
        currentUser.email = email || username;
        if($('user-display-name')) $('user-display-name').textContent = displayName;
        if($('user-display-email')) $('user-display-email').textContent = email || username;
        if($('user-avatar-initial')) $('user-avatar-initial').textContent = displayName.charAt(0).toUpperCase();
        if($('admin-profile-password-input')) $('admin-profile-password-input').value = '';
        if(typeof closeModal === 'function') closeModal('user-profile-modal');
        else $('user-profile-modal')?.classList.add('hidden');
        showCustomAlert('บันทึกสำเร็จ', 'แก้ไขชื่อผู้ใช้ อีเมล และรหัสผ่าน Admin ใน Firebase เรียบร้อยแล้ว');
    }catch(err){
        showCustomAlert('บันทึก Admin ไม่สำเร็จ', err.message || String(err), true);
    }finally{
        if(typeof toggleLoader === 'function') toggleLoader(false);
    }
};

document.addEventListener('DOMContentLoaded', ()=>{
    ensureFirstSetupFields();
    ensureProfileAdminFields();
    clearOldAdminLocalFinal();
});

/* =========================================================
   FINAL PATCH: Admin profile saves directly to Firebase
   - fixes swapped username/email
   - fixes currentUser.email showing Admin
   - writes to admin_settings/credentials every time
   ========================================================= */
window.saveUserProfileChanges = async function(){
    if(typeof currentUser === 'undefined' || currentUser?.uid !== 'admin-bypass'){
        if(typeof oldSaveUserProfileChangesFinal === 'function') return oldSaveUserProfileChangesFinal();
        return;
    }

    ensureProfileAdminFields();

    let username = norm($('profile-admin-username-input')?.value || 'Admin');
    const displayName = norm($('profile-display-name-input')?.value || 'Administrator') || 'Administrator';
    let email = normEmail($('profile-email-input')?.value || '');
    const newPassword = norm($('admin-profile-password-input')?.value || '');

    // ถ้ากรอกสลับช่อง เช่น ชื่อผู้ใช้เป็นอีเมล และอีเมลเป็น Admin ให้สลับกลับก่อนบันทึก
    if(username.includes('@') && (!email || !email.includes('@'))){
        const maybeUsername = email && !email.includes('@') ? email : 'Admin';
        email = normEmail(username);
        username = maybeUsername || 'Admin';
        if($('profile-admin-username-input')) $('profile-admin-username-input').value = username;
        if($('profile-email-input')) $('profile-email-input').value = email;
    }

    if(!username) return showCustomAlert('กรุณากรอกชื่อผู้ใช้ Admin', 'ช่องชื่อผู้ใช้ Admin ห้ามว่าง', true);
    if(email && !isEmail(email)) return showCustomAlert('อีเมลไม่ถูกต้อง', 'กรุณากรอกอีเมลให้ถูกต้อง หรือเว้นว่างไว้', true);
    if(newPassword && newPassword.length < 6) return showCustomAlert('รหัสผ่านสั้นเกินไป', 'รหัสผ่าน Admin ต้องมีอย่างน้อย 6 ตัวอักษร', true);

    if(typeof toggleLoader === 'function') toggleLoader(true);
    try{
        const old = await readAdminCredFinal();
        const password = newPassword || old.password || 'Admin123';

        await setDoc(adminCredRef, {
            username: username,
            email: email,
            password: password,
            displayName: displayName,
            updatedAt: serverTimestamp(),
            updatedBy: 'admin'
        }, { merge: true });

        await setDoc(adminSecRef, {
            requirePasswordChange: false,
            lastPasswordChange: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });

        clearOldAdminLocalFinal();

        currentUser.displayName = displayName;
        currentUser.email = email || username;

        if($('user-display-name')) $('user-display-name').textContent = displayName;
        if($('user-display-email')) $('user-display-email').textContent = email || username;
        if($('user-avatar-initial')) $('user-avatar-initial').textContent = displayName.charAt(0).toUpperCase();
        if($('admin-profile-password-input')) $('admin-profile-password-input').value = '';

        if(typeof closeModal === 'function') closeModal('user-profile-modal');
        else $('user-profile-modal')?.classList.add('hidden');

        showCustomAlert('บันทึกสำเร็จ', 'บันทึกชื่อผู้ใช้ อีเมล และรหัสผ่าน Admin ลง Firebase แล้ว');
    }catch(err){
        showCustomAlert('บันทึก Admin ไม่สำเร็จ', (typeof getFirebaseErrorText === 'function' ? getFirebaseErrorText(err) : (err.message || String(err))), true);
    }finally{
        if(typeof toggleLoader === 'function') toggleLoader(false);
    }
};

window.openUserProfileSettings = async function(){
    if(typeof currentUser === 'undefined' || !currentUser) return showCustomAlert('ยังไม่ได้เข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนใช้งานโปรไฟล์', true);

    ensureProfileAdminFields();

    const isAdminBypass = currentUser?.uid === 'admin-bypass';
    if(isAdminBypass){
        try{
            const d = await readAdminCredFinal();
            if($('profile-display-name-input')) $('profile-display-name-input').value = d.displayName || d.name || currentUser.displayName || 'Administrator';
            if($('profile-admin-username-input')) $('profile-admin-username-input').value = d.username || 'Admin';
            if($('profile-email-input')) $('profile-email-input').value = d.email || '';
            if($('admin-profile-password-input')) $('admin-profile-password-input').value = '';
            if($('admin-profile-password-wrap')) $('admin-profile-password-wrap').classList.remove('hidden');
            const resetBtn = document.querySelector('#user-profile-modal [data-reset-password]');
            if(resetBtn) resetBtn.classList.add('hidden');
        }catch(e){}
    }else{
        if($('profile-display-name-input')) $('profile-display-name-input').value = currentUser.displayName || '';
        if($('profile-email-input')) $('profile-email-input').value = currentUser.email || '';
        if($('admin-profile-password-wrap')) $('admin-profile-password-wrap').classList.add('hidden');
    }

    if(typeof openModal === 'function') openModal('user-profile-modal');
    else $('user-profile-modal')?.classList.remove('hidden');
};


/* =========================================================
   FINAL HOTFIX: เปิดโปรไฟล์ Admin ได้แม้ currentUser หลุด
   - ใช้ isAdmin / localStorage / หน้าหลักที่กำลังแสดงอยู่เป็นหลักฐานว่าเข้า Admin แล้ว
   - ไม่ขึ้น "ยังไม่ได้เข้าสู่ระบบ" หลังล็อกอิน Admin
   ========================================================= */
function restoreAdminSessionForProfileFinal(){
    const mainAppVisible = !$('main-app')?.classList.contains('hidden');
    const adminActive = isAdmin === true || localStorage.getItem('schoolhub_admin_active') === 'true';
    if((!currentUser || currentUser.uid !== 'admin-bypass') && (adminActive || mainAppVisible)){
        const name = localStorage.getItem('schoolhub_admin_name') || 'Administrator';
        const email = localStorage.getItem('schoolhub_admin_email') || localStorage.getItem('schoolhub_admin_username') || 'Admin';
        const username = localStorage.getItem('schoolhub_admin_username') || 'Admin';
        currentUser = { uid:'admin-bypass', email, displayName:name, username };
        isAdmin = true;
    }
    return currentUser && currentUser.uid === 'admin-bypass';
}

window.openUserProfileSettings = async function(){
    restoreAdminSessionForProfileFinal();

    if(!currentUser){
        return showCustomAlert('ยังไม่ได้เข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนใช้งานโปรไฟล์', true);
    }

    ensureProfileAdminFields();

    const isAdminBypass = currentUser?.uid === 'admin-bypass' || isAdmin === true;
    if(isAdminBypass){
        try{
            const d = await readAdminCredFinal();
            const displayName = d.displayName || d.name || currentUser.displayName || localStorage.getItem('schoolhub_admin_name') || 'Administrator';
            const username = d.username || currentUser.username || localStorage.getItem('schoolhub_admin_username') || 'Admin';
            const email = d.email || currentUser.email || localStorage.getItem('schoolhub_admin_email') || '';

            currentUser = { uid:'admin-bypass', email: email || username, displayName, username };
            isAdmin = true;
            localStorage.setItem('schoolhub_admin_active','true');
            localStorage.setItem('schoolhub_admin_name', displayName);
            localStorage.setItem('schoolhub_admin_username', username);
            localStorage.setItem('schoolhub_admin_email', email || username);

            if($('profile-display-name-input')) $('profile-display-name-input').value = displayName;
            if($('profile-admin-username-input')) $('profile-admin-username-input').value = username;
            if($('profile-email-input')) $('profile-email-input').value = email || '';
            if($('admin-profile-password-input')) $('admin-profile-password-input').value = '';
            if($('admin-profile-password-wrap')) $('admin-profile-password-wrap').classList.remove('hidden');
            if($('user-display-name')) $('user-display-name').textContent = displayName;
            if($('user-display-email')) $('user-display-email').textContent = email || username;
            if($('user-avatar-initial')) $('user-avatar-initial').textContent = displayName.charAt(0).toUpperCase();

            const resetBtn = document.querySelector('#user-profile-modal [data-reset-password]');
            if(resetBtn) resetBtn.classList.add('hidden');
        }catch(e){
            console.warn('load admin profile failed:', e);
            if($('profile-display-name-input')) $('profile-display-name-input').value = currentUser.displayName || 'Administrator';
            if($('profile-admin-username-input')) $('profile-admin-username-input').value = currentUser.username || 'Admin';
            if($('profile-email-input')) $('profile-email-input').value = currentUser.email === 'Admin' ? '' : (currentUser.email || '');
            if($('admin-profile-password-input')) $('admin-profile-password-input').value = '';
            if($('admin-profile-password-wrap')) $('admin-profile-password-wrap').classList.remove('hidden');
        }
    }else{
        if($('profile-display-name-input')) $('profile-display-name-input').value = currentUser.displayName || '';
        if($('profile-email-input')) $('profile-email-input').value = currentUser.email || '';
        if($('admin-profile-password-wrap')) $('admin-profile-password-wrap').classList.add('hidden');
    }

    if(typeof openModal === 'function') openModal('user-profile-modal');
    else $('user-profile-modal')?.classList.remove('hidden');
};

