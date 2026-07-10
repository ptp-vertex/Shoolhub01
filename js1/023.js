
/* SchoolHub Admin Email Login Patch
   ใช้ Firebase เท่านั้น:
   admin_settings/credentials:
   - username
   - email
   - password

   ล็อกอินได้ด้วย:
   1) username + password
   2) email + password
*/
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const adminEmailConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
};

const adminEmailApp = getApps().length ? getApp() : initializeApp(adminEmailConfig);
const adminEmailDb = getFirestore(adminEmailApp);

const credentialsRef = doc(adminEmailDb, 'admin_settings', 'credentials');
const securityRef = doc(adminEmailDb, 'admin_settings', 'security');

const DEFAULT_USERNAME = 'Admin';
const DEFAULT_PASSWORD = 'Admin123';
const DEFAULT_EMAIL = '';

const ADMIN_LOCAL_KEYS = [
    'adminUsername','adminPassword','admin_user','admin_pass','admin_credentials','adminCredentials',
    'schoolhub_admin_username','schoolhub_admin_password','schoolhub_admin_credentials',
    'schoolhub_admin_auth','schoolhub_admin_login','admin_login','adminAuth',
    'isAdminLoggedIn','adminLoggedIn'
];

function norm(v) {
    return String(v || '').trim();
}
function normLower(v) {
    return norm(v).toLowerCase();
}
function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm(v));
}
function clearLocalAdminCredentials() {
    try {
        ADMIN_LOCAL_KEYS.forEach(k => {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        });

        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i) || '';
            const low = k.toLowerCase();
            if (low.includes('admin') && (low.includes('password') || low.includes('credential') || low.includes('auth') || low.includes('login'))) {
                localStorage.removeItem(k);
            }
        }

        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const k = sessionStorage.key(i) || '';
            const low = k.toLowerCase();
            if (low.includes('admin') && (low.includes('password') || low.includes('credential') || low.includes('auth') || low.includes('login'))) {
                sessionStorage.removeItem(k);
            }
        }
    } catch(e) {}
}

async function ensureAdminFirebaseCredentials() {
    const credSnap = await getDoc(credentialsRef);
    const secSnap = await getDoc(securityRef);

    if (!credSnap.exists()) {
        await setDoc(credentialsRef, {
            username: DEFAULT_USERNAME,
            email: DEFAULT_EMAIL,
            password: DEFAULT_PASSWORD,
            updatedAt: serverTimestamp(),
            updatedBy: 'system'
        }, { merge: true });
    } else {
        const d = credSnap.data() || {};
        if (!('email' in d)) {
            await setDoc(credentialsRef, { email: DEFAULT_EMAIL }, { merge: true });
        }
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

    return {
        credentials: credSnap.exists() ? (credSnap.data() || {}) : {},
        security: secSnap.exists() ? (secSnap.data() || {}) : {}
    };
}

async function verifyAdminFromFirebaseOnly(loginValue, password) {
    clearLocalAdminCredentials();

    const { credentials, security } = await readAdminFirebaseCredentials();

    const firebaseUsername = norm(credentials.username || DEFAULT_USERNAME);
    const firebaseEmail = normLower(credentials.email || DEFAULT_EMAIL);
    const firebasePassword = norm(credentials.password || DEFAULT_PASSWORD);

    const inputLogin = norm(loginValue);
    const inputLoginLower = normLower(loginValue);
    const inputPassword = norm(password);

    const matchUsername = inputLogin === firebaseUsername;
    const matchEmail = firebaseEmail && inputLoginLower === firebaseEmail;
    const matchPassword = inputPassword === firebasePassword;

    const ok = (matchUsername || matchEmail) && matchPassword;

    const requirePasswordChange =
        ok &&
        matchUsername &&
        inputLogin === DEFAULT_USERNAME &&
        inputPassword === DEFAULT_PASSWORD &&
        security.requirePasswordChange !== false;

    return { ok, requirePasswordChange };
}

async function updateAdminFirebaseCredentials(username, email, password) {
    const newUsername = norm(username);
    const newEmail = normLower(email);
    const newPassword = norm(password);

    if (!newUsername) throw new Error('กรุณากรอกชื่อผู้ใช้ใหม่');
    if (newEmail && !isEmail(newEmail)) throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
    if (newPassword.length < 6) throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');

    await setDoc(credentialsRef, {
        username: newUsername,
        email: newEmail,
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
        'admin-username','admin-user','admin-login-username','login-admin-username',
        'admin-email','admin-id'
    ];
    const passwordIds = [
        'admin-password','admin-pass','admin-login-password','login-admin-password'
    ];

    let usernameEl = usernameIds.map(id => document.getElementById(id)).find(Boolean);
    let passwordEl = passwordIds.map(id => document.getElementById(id)).find(Boolean);

    const all = Array.from(document.querySelectorAll('input'));

    if (!usernameEl) {
        usernameEl = all.find(el => {
            const t = ((el.id || '') + ' ' + (el.name || '') + ' ' + (el.placeholder || '')).toLowerCase();
            return t.includes('admin') && (t.includes('user') || t.includes('ชื่อ') || t.includes('email') || t.includes('อีเมล'));
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
        loginValue: usernameEl ? usernameEl.value : '',
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
    const e = document.getElementById('central-admin-new-email');
    const p = document.getElementById('central-admin-new-password');
    const c = document.getElementById('central-admin-confirm-password');

    if (u) u.value = '';
    if (e) e.value = '';
    if (p) p.value = '';
    if (c) c.value = '';
    setTimeout(() => u?.focus(), 100);
}

function closeChangeRequiredModal() {
    document.getElementById('central-admin-change-modal')?.classList.add('hidden');
}

// expose
window.getAdminCredentials = readAdminFirebaseCredentials;
window.verifyCentralAdminCredentials = verifyAdminFromFirebaseOnly;
window.verifyFirebaseAdminLogin = async function(loginValue, password) {
    const r = await verifyAdminFromFirebaseOnly(loginValue, password);
    return r.ok;
};
window.updateFirebaseAdminCredentials = updateAdminFirebaseCredentials;
window.saveCentralAdminCredentials = updateAdminFirebaseCredentials;
window.ensureCentralAdminDocs = ensureAdminFirebaseCredentials;

function hookAdminLoginFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__adminEmailLoginHooked) return;

    const wrapped = async function(...args) {
        clearLocalAdminCredentials();

        const found = getAdminInputs();
        const stringArgs = args.filter(a => typeof a === 'string');

        const loginValue = stringArgs[0] || found.loginValue;
        const password = stringArgs[1] || found.password;

        if (loginValue || password) {
            try {
                const result = await verifyAdminFromFirebaseOnly(loginValue, password);

                if (!result.ok) {
                    showError('ชื่อผู้ใช้/อีเมล หรือรหัสผ่านแอดมินไม่ตรงกับ Firebase');
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

    wrapped.__adminEmailLoginHooked = true;
    window[name] = wrapped;
}

function hookKnownAdminLoginFunctions() {
    [
        'handleAdminLogin','adminLogin','loginAdmin','handleAdminAuth',
        'handleAdminBypass','adminBypassLogin','checkAdminLogin','verifyAdminLogin'
    ].forEach(hookAdminLoginFunction);
}

document.addEventListener('submit', async function(event) {
    const form = event.target;
    if (!form || !(form instanceof HTMLFormElement)) return;

    const txt = ((form.id || '') + ' ' + (form.className || '') + ' ' + (form.innerText || '')).toLowerCase();
    const isAdminForm = txt.includes('admin') || txt.includes('แอดมิน') || txt.includes('ผู้ดูแล');

    if (!isAdminForm) return;

    const found = getAdminInputs();
    if (!found.loginValue && !found.password) return;

    clearLocalAdminCredentials();

    const result = await verifyAdminFromFirebaseOnly(found.loginValue, found.password);

    if (!result.ok) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showError('ชื่อผู้ใช้/อีเมล หรือรหัสผ่านแอดมินไม่ตรงกับ Firebase');
        return;
    }

    if (result.requirePasswordChange) {
        setTimeout(openChangeRequiredModal, 900);
    }

    clearLocalAdminCredentials();
}, true);

document.addEventListener('click', async function(event) {
    const btn = event.target.closest('button, a');
    if (!btn) return;

    const txt = (btn.innerText || btn.textContent || btn.getAttribute('onclick') || '').toLowerCase();
    const isAdminLoginButton =
        (txt.includes('admin') || txt.includes('แอดมิน') || txt.includes('ผู้ดูแล')) &&
        (txt.includes('login') || txt.includes('เข้าสู่ระบบ') || txt.includes('ล็อกอิน'));

    if (!isAdminLoginButton) return;

    const found = getAdminInputs();
    if (!found.loginValue && !found.password) return;

    clearLocalAdminCredentials();

    const result = await verifyAdminFromFirebaseOnly(found.loginValue, found.password);

    if (!result.ok) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showError('ชื่อผู้ใช้/อีเมล หรือรหัสผ่านแอดมินไม่ตรงกับ Firebase');
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
    if (form && !form.__adminEmailLoginBound) {
        form.__adminEmailLoginBound = true;
        form.addEventListener('submit', async function(event) {
            event.preventDefault();

            const username = document.getElementById('central-admin-new-username')?.value.trim() || '';
            const email = document.getElementById('central-admin-new-email')?.value.trim() || '';
            const password = document.getElementById('central-admin-new-password')?.value.trim() || '';
            const confirm = document.getElementById('central-admin-confirm-password')?.value.trim() || '';

            if (!username) return alert('กรุณากรอกชื่อผู้ใช้ใหม่');
            if (email && !isEmail(email)) return alert('รูปแบบอีเมลไม่ถูกต้อง');
            if (password.length < 6) return alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
            if (password !== confirm) return alert('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');

            try {
                await updateAdminFirebaseCredentials(username, email, password);
                closeChangeRequiredModal();

                if (typeof window.showCustomAlert === 'function') {
                    window.showCustomAlert('success', 'บันทึกแล้ว', 'เปลี่ยนข้อมูลแอดมินเรียบร้อย ทุกเครื่องจะใช้ชื่อผู้ใช้/อีเมล/รหัสผ่านจาก Firebase');
                } else {
                    alert('เปลี่ยนข้อมูลแอดมินเรียบร้อย ทุกเครื่องจะใช้ชื่อผู้ใช้/อีเมล/รหัสผ่านจาก Firebase');
                }
            } catch(error) {
                console.error(error);
                alert(error.message || 'เปลี่ยนข้อมูลแอดมินไม่สำเร็จ');
            }
        });
    }
});

setInterval(clearLocalAdminCredentials, 3000);
