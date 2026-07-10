
/* SchoolHub Firebase-Only Admin Credentials Patch
   บังคับใช้รหัสแอดมินจาก Firebase เท่านั้น
   - ไม่อ่าน/ไม่ใช้ localStorage/sessionStorage ของรหัสแอดมิน
   - เคลียร์ค่า admin เดิมที่เครื่องเคยจำไว้
   - ตรวจรหัสจาก admin_settings/credentials ทุกครั้ง
*/
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const adminOnlyConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
};

const adminOnlyApp = getApps().length ? getApp() : initializeApp(adminOnlyConfig);
const adminOnlyDb = getFirestore(adminOnlyApp);

const credentialsRef = doc(adminOnlyDb, 'admin_settings', 'credentials');
const securityRef = doc(adminOnlyDb, 'admin_settings', 'security');

const DEFAULT_USERNAME = 'Admin';
const DEFAULT_PASSWORD = 'Admin123';

const ADMIN_LOCAL_KEYS = [
    'adminUsername',
    'adminPassword',
    'admin_user',
    'admin_pass',
    'admin_credentials',
    'adminCredentials',
    'schoolhub_admin_username',
    'schoolhub_admin_password',
    'schoolhub_admin_credentials',
    'schoolhub_admin_auth',
    'schoolhub_admin_login',
    'admin_login',
    'adminAuth',
    'isAdminLoggedIn',
    'adminLoggedIn'
];

function clearLocalAdminCredentials() {
    try {
        ADMIN_LOCAL_KEYS.forEach(k => {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        });

        // ลบ key ที่มีคำว่า admin + password/credentials/auth/login เท่านั้น ไม่ยุ่งข้อมูลอื่น
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i) || '';
            const low = k.toLowerCase();
            if (
                low.includes('admin') &&
                (low.includes('password') || low.includes('credential') || low.includes('auth') || low.includes('login'))
            ) {
                localStorage.removeItem(k);
            }
        }

        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const k = sessionStorage.key(i) || '';
            const low = k.toLowerCase();
            if (
                low.includes('admin') &&
                (low.includes('password') || low.includes('credential') || low.includes('auth') || low.includes('login'))
            ) {
                sessionStorage.removeItem(k);
            }
        }
    } catch(e) {
        console.warn('clearLocalAdminCredentials failed:', e);
    }
}

async function ensureAdminFirebaseCredentials() {
    const credSnap = await getDoc(credentialsRef);
    const secSnap = await getDoc(securityRef);

    if (!credSnap.exists()) {
        await setDoc(credentialsRef, {
            username: DEFAULT_USERNAME,
            password: DEFAULT_PASSWORD,
            updatedAt: serverTimestamp(),
            updatedBy: 'system'
        }, { merge: true });
    }

    if (!secSnap.exists()) {
        await setDoc(securityRef, {
            requirePasswordChange: true,
            lastPasswordChange: 0,
            updatedAt: serverTimestamp()
        }, { merge: true });
    }
}

async function readAdminFirebaseCredentials() {
    await ensureAdminFirebaseCredentials();

    const [credSnap, secSnap] = await Promise.all([
        getDoc(credentialsRef),
        getDoc(securityRef)
    ]);

    const credentials = credSnap.exists() ? (credSnap.data() || {}) : {};
    const security = secSnap.exists() ? (secSnap.data() || {}) : {};

    return { credentials, security };
}

async function verifyAdminFromFirebaseOnly(username, password) {
    clearLocalAdminCredentials();

    const { credentials, security } = await readAdminFirebaseCredentials();

    const firebaseUsername = String(credentials.username || DEFAULT_USERNAME).trim();
    const firebasePassword = String(credentials.password || DEFAULT_PASSWORD).trim();

    const inputUsername = String(username || '').trim();
    const inputPassword = String(password || '').trim();

    const ok = inputUsername === firebaseUsername && inputPassword === firebasePassword;

    const requirePasswordChange =
        ok &&
        inputUsername === DEFAULT_USERNAME &&
        inputPassword === DEFAULT_PASSWORD &&
        security.requirePasswordChange !== false;

    return { ok, requirePasswordChange };
}

async function updateAdminFirebaseCredentials(username, password) {
    const newUsername = String(username || '').trim();
    const newPassword = String(password || '').trim();

    if (!newUsername) throw new Error('กรุณากรอกชื่อผู้ใช้ใหม่');
    if (newPassword.length < 6) throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');

    await setDoc(credentialsRef, {
        username: newUsername,
        password: newPassword,
        updatedAt: serverTimestamp(),
        updatedBy: 'admin'
    }, { merge: true });

    await setDoc(securityRef, {
        requirePasswordChange: false,
        lastPasswordChange: serverTimestamp(),
        updatedAt: serverTimestamp()
    }, { merge: true });

    clearLocalAdminCredentials();
}

function getAdminInputs() {
    const usernameIds = [
        'admin-username', 'admin-user', 'admin-login-username', 'login-admin-username',
        'admin-email', 'admin-id'
    ];
    const passwordIds = [
        'admin-password', 'admin-pass', 'admin-login-password', 'login-admin-password'
    ];

    let usernameEl = usernameIds.map(id => document.getElementById(id)).find(Boolean);
    let passwordEl = passwordIds.map(id => document.getElementById(id)).find(Boolean);

    const all = Array.from(document.querySelectorAll('input'));

    if (!usernameEl) {
        usernameEl = all.find(el => {
            const t = ((el.id || '') + ' ' + (el.name || '') + ' ' + (el.placeholder || '')).toLowerCase();
            return t.includes('admin') && (t.includes('user') || t.includes('ชื่อ') || t.includes('email'));
        });
    }

    if (!passwordEl) {
        passwordEl = all.find(el => {
            const t = ((el.id || '') + ' ' + (el.name || '') + ' ' + (el.placeholder || '')).toLowerCase();
            return el.type === 'password' && (t.includes('admin') || t.includes('รหัส') || t.includes('password'));
        });
    }

    return {
        usernameEl,
        passwordEl,
        username: usernameEl ? usernameEl.value : '',
        password: passwordEl ? passwordEl.value : ''
    };
}

function showError(msg) {
    if (typeof window.showCustomAlert === 'function') {
        window.showCustomAlert('error', 'เข้าสู่ระบบแอดมินไม่สำเร็จ', msg);
    } else {
        alert(msg);
    }
}

function openChangeRequiredModal() {
    const modal = document.getElementById('central-admin-change-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const u = document.getElementById('central-admin-new-username');
    const p = document.getElementById('central-admin-new-password');
    const c = document.getElementById('central-admin-confirm-password');

    if (u) u.value = '';
    if (p) p.value = '';
    if (c) c.value = '';
    setTimeout(() => u?.focus(), 100);
}

function closeChangeRequiredModal() {
    document.getElementById('central-admin-change-modal')?.classList.add('hidden');
}

// override local admin credential getters/setters ที่เครื่องเคยจำไว้
window.getAdminCredentials = readAdminFirebaseCredentials;
window.verifyCentralAdminCredentials = verifyAdminFromFirebaseOnly;
window.verifyFirebaseAdminLogin = async function(username, password) {
    const r = await verifyAdminFromFirebaseOnly(username, password);
    return r.ok;
};
window.updateFirebaseAdminCredentials = updateAdminFirebaseCredentials;
window.saveCentralAdminCredentials = updateAdminFirebaseCredentials;
window.ensureCentralAdminDocs = ensureAdminFirebaseCredentials;

function hookAdminLoginFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__firebaseOnlyAdminHooked) return;

    const wrapped = async function(...args) {
        clearLocalAdminCredentials();

        const found = getAdminInputs();

        let username = '';
        let password = '';

        const stringArgs = args.filter(a => typeof a === 'string');
        username = stringArgs[0] || found.username;
        password = stringArgs[1] || found.password;

        if (username || password) {
            try {
                const result = await verifyAdminFromFirebaseOnly(username, password);

                if (!result.ok) {
                    showError('ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ตรงกับ Firebase');
                    return false;
                }

                const originalResult = await original.apply(this, args);

                clearLocalAdminCredentials();

                if (result.requirePasswordChange) {
                    setTimeout(openChangeRequiredModal, 500);
                }

                return originalResult;
            } catch(error) {
                console.error(error);
                showError(error.message || 'ไม่สามารถตรวจสอบรหัสแอดมินจาก Firebase ได้');
                return false;
            }
        }

        return original.apply(this, args);
    };

    wrapped.__firebaseOnlyAdminHooked = true;
    window[name] = wrapped;
}

function hookKnownAdminLoginFunctions() {
    [
        'handleAdminLogin',
        'adminLogin',
        'loginAdmin',
        'handleAdminAuth',
        'handleAdminBypass',
        'adminBypassLogin',
        'checkAdminLogin',
        'verifyAdminLogin'
    ].forEach(hookAdminLoginFunction);
}

// ดัก submit ของฟอร์มแอดมินก่อนโค้ดเดิม
document.addEventListener('submit', async function(event) {
    const form = event.target;
    if (!form || !(form instanceof HTMLFormElement)) return;

    const txt = ((form.id || '') + ' ' + (form.className || '') + ' ' + (form.innerText || '')).toLowerCase();
    const isAdminForm = txt.includes('admin') || txt.includes('แอดมิน') || txt.includes('ผู้ดูแล');

    if (!isAdminForm) return;

    const found = getAdminInputs();
    if (!found.username && !found.password) return;

    clearLocalAdminCredentials();

    const result = await verifyAdminFromFirebaseOnly(found.username, found.password);

    if (!result.ok) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showError('ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ตรงกับ Firebase');
        return;
    }

    if (result.requirePasswordChange) {
        setTimeout(openChangeRequiredModal, 900);
    }

    clearLocalAdminCredentials();
}, true);

// ดักคลิกปุ่ม login admin ก่อนโค้ดเดิม
document.addEventListener('click', async function(event) {
    const btn = event.target.closest('button, a');
    if (!btn) return;

    const txt = (btn.innerText || btn.textContent || btn.getAttribute('onclick') || '').toLowerCase();
    const isAdminLoginButton =
        (txt.includes('admin') || txt.includes('แอดมิน') || txt.includes('ผู้ดูแล')) &&
        (txt.includes('login') || txt.includes('เข้าสู่ระบบ') || txt.includes('ล็อกอิน'));

    if (!isAdminLoginButton) return;

    const found = getAdminInputs();
    if (!found.username && !found.password) return;

    clearLocalAdminCredentials();

    const result = await verifyAdminFromFirebaseOnly(found.username, found.password);

    if (!result.ok) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showError('ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ตรงกับ Firebase');
        return;
    }

    if (result.requirePasswordChange) {
        setTimeout(openChangeRequiredModal, 900);
    }

    clearLocalAdminCredentials();
}, true);

document.addEventListener('DOMContentLoaded', () => {
    clearLocalAdminCredentials();

    ensureAdminFirebaseCredentials().catch(console.error);

    hookKnownAdminLoginFunctions();
    setTimeout(hookKnownAdminLoginFunctions, 1000);
    setTimeout(hookKnownAdminLoginFunctions, 3000);
    setInterval(hookKnownAdminLoginFunctions, 5000);

    const form = document.getElementById('central-admin-change-form');
    if (form && !form.__firebaseOnlyAdminBound) {
        form.__firebaseOnlyAdminBound = true;
        form.addEventListener('submit', async function(event) {
            event.preventDefault();

            const username = document.getElementById('central-admin-new-username')?.value.trim() || '';
            const password = document.getElementById('central-admin-new-password')?.value.trim() || '';
            const confirm = document.getElementById('central-admin-confirm-password')?.value.trim() || '';

            if (!username) return alert('กรุณากรอกชื่อผู้ใช้ใหม่');
            if (password.length < 6) return alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
            if (password !== confirm) return alert('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');

            try {
                await updateAdminFirebaseCredentials(username, password);
                closeChangeRequiredModal();

                if (typeof window.showCustomAlert === 'function') {
                    window.showCustomAlert('success', 'บันทึกแล้ว', 'เปลี่ยนรหัสแอดมินเรียบร้อย ทุกเครื่องจะใช้รหัสจาก Firebase เท่านั้น');
                } else {
                    alert('เปลี่ยนรหัสแอดมินเรียบร้อย ทุกเครื่องจะใช้รหัสจาก Firebase เท่านั้น');
                }
            } catch(error) {
                console.error(error);
                alert(error.message || 'เปลี่ยนรหัสแอดมินไม่สำเร็จ');
            }
        });
    }
});

// เคลียร์ซ้ำหลังโหลด เผื่อโค้ดเดิมเขียน localStorage กลับมา
setInterval(clearLocalAdminCredentials, 3000);
