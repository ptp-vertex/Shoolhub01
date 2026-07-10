
/* SchoolHub Central Admin Credentials Patch
   แก้เฉพาะระบบรหัสแอดมิน:
   - ใช้ Firestore: admin_settings/credentials และ admin_settings/security
   - ค่าเริ่มต้นทุกเครื่อง: Admin / Admin123
   - หลัง login ครั้งแรก บังคับเปลี่ยนรหัส
   - เมื่อเปลี่ยนแล้ว ทุกเครื่องใช้รหัสใหม่ทันที
*/
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const centralAdminConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
};

const centralAdminApp = getApps().length ? getApp() : initializeApp(centralAdminConfig);
const centralAdminDb = getFirestore(centralAdminApp);
const credentialsRef = doc(centralAdminDb, 'admin_settings', 'credentials');
const securityRef = doc(centralAdminDb, 'admin_settings', 'security');

const DEFAULT_ADMIN_USERNAME = 'Admin';
const DEFAULT_ADMIN_PASSWORD = 'Admin123';

let centralAdminLoggedInWithDefault = false;

async function ensureCentralAdminDocs() {
    const credSnap = await getDoc(credentialsRef);
    const secSnap = await getDoc(securityRef);

    if (!credSnap.exists()) {
        await setDoc(credentialsRef, {
            username: DEFAULT_ADMIN_USERNAME,
            password: DEFAULT_ADMIN_PASSWORD,
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

async function getCentralAdminCredentials() {
    await ensureCentralAdminDocs();
    const [credSnap, secSnap] = await Promise.all([
        getDoc(credentialsRef),
        getDoc(securityRef)
    ]);

    return {
        credentials: credSnap.exists() ? (credSnap.data() || {}) : {},
        security: secSnap.exists() ? (secSnap.data() || {}) : {}
    };
}

async function verifyCentralAdminCredentials(username, password) {
    const { credentials, security } = await getCentralAdminCredentials();

    const inputUsername = String(username || '').trim();
    const inputPassword = String(password || '').trim();

    const ok = inputUsername === String(credentials.username || DEFAULT_ADMIN_USERNAME).trim()
        && inputPassword === String(credentials.password || DEFAULT_ADMIN_PASSWORD).trim();

    if (ok) {
        centralAdminLoggedInWithDefault =
            inputUsername === DEFAULT_ADMIN_USERNAME &&
            inputPassword === DEFAULT_ADMIN_PASSWORD &&
            security.requirePasswordChange !== false;
    }

    return {
        ok,
        requirePasswordChange: ok && centralAdminLoggedInWithDefault
    };
}

async function saveCentralAdminCredentials(newUsername, newPassword) {
    const username = String(newUsername || '').trim();
    const password = String(newPassword || '').trim();

    if (!username) throw new Error('กรุณากรอกชื่อผู้ใช้ใหม่');
    if (password.length < 6) throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');

    await setDoc(credentialsRef, {
        username,
        password,
        updatedAt: serverTimestamp(),
        updatedBy: 'admin'
    }, { merge: true });

    await setDoc(securityRef, {
        requirePasswordChange: false,
        lastPasswordChange: serverTimestamp(),
        updatedAt: serverTimestamp()
    }, { merge: true });

    centralAdminLoggedInWithDefault = false;
}

function findAdminInputs() {
    const allInputs = Array.from(document.querySelectorAll('input'));
    const usernameCandidates = [
        'admin-username', 'admin-user', 'admin-login-username', 'login-admin-username',
        'admin-email', 'admin-id'
    ];
    const passwordCandidates = [
        'admin-password', 'admin-pass', 'admin-login-password', 'login-admin-password'
    ];

    let usernameEl = usernameCandidates.map(id => document.getElementById(id)).find(Boolean);
    let passwordEl = passwordCandidates.map(id => document.getElementById(id)).find(Boolean);

    if (!usernameEl) {
        usernameEl = allInputs.find(el => {
            const t = ((el.id || '') + ' ' + (el.name || '') + ' ' + (el.placeholder || '')).toLowerCase();
            return t.includes('admin') && (t.includes('user') || t.includes('ชื่อ') || t.includes('email'));
        });
    }

    if (!passwordEl) {
        passwordEl = allInputs.find(el => {
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

function showCentralAdminChangeModal() {
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

function hideCentralAdminChangeModal() {
    document.getElementById('central-admin-change-modal')?.classList.add('hidden');
}

function showCentralAdminError(message) {
    if (typeof window.showCustomAlert === 'function') {
        window.showCustomAlert('error', 'เข้าสู่ระบบแอดมินไม่สำเร็จ', message);
    } else {
        alert(message);
    }
}

// hook ฟังก์ชัน login admin เดิม ถ้ามี
function hookAdminLoginFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__centralAdminHooked) return;

    const wrapped = async function(...args) {
        const found = findAdminInputs();
        const username = args.find(a => typeof a === 'string') || found.username;
        const password = args.filter(a => typeof a === 'string')[1] || found.password;

        if (username || password) {
            try {
                const result = await verifyCentralAdminCredentials(username, password);
                if (!result.ok) {
                    showCentralAdminError('ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ถูกต้อง');
                    return false;
                }

                const originalResult = await original.apply(this, args);

                if (result.requirePasswordChange) {
                    setTimeout(showCentralAdminChangeModal, 500);
                }

                return originalResult;
            } catch (error) {
                console.error('central admin login error:', error);
                showCentralAdminError(error.message || 'ไม่สามารถตรวจสอบรหัสแอดมินจาก Firebase ได้');
                return false;
            }
        }

        return original.apply(this, args);
    };

    wrapped.__centralAdminHooked = true;
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

// ดัก submit form แอดมิน เผื่อฟังก์ชัน login เป็น inline หรือชื่อไม่ตรง
document.addEventListener('submit', async function(event) {
    const form = event.target;
    if (!form || !(form instanceof HTMLFormElement)) return;

    const text = ((form.id || '') + ' ' + (form.className || '') + ' ' + (form.innerText || '')).toLowerCase();
    const isAdminForm = text.includes('admin') || text.includes('แอดมิน') || text.includes('ผู้ดูแล');
    if (!isAdminForm) return;

    const found = findAdminInputs();
    if (!found.username && !found.password) return;

    const result = await verifyCentralAdminCredentials(found.username, found.password);
    if (!result.ok) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showCentralAdminError('ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ถูกต้อง');
        return;
    }

    if (result.requirePasswordChange) {
        setTimeout(showCentralAdminChangeModal, 900);
    }
}, true);

// ดักคลิกปุ่ม login admin เผื่อไม่มี form submit
document.addEventListener('click', async function(event) {
    const btn = event.target.closest('button, a');
    if (!btn) return;

    const text = (btn.innerText || btn.textContent || btn.getAttribute('onclick') || '').toLowerCase();
    const isAdminLoginButton =
        (text.includes('admin') || text.includes('แอดมิน') || text.includes('ผู้ดูแล')) &&
        (text.includes('login') || text.includes('เข้าสู่ระบบ') || text.includes('ล็อกอิน'));

    if (!isAdminLoginButton) return;

    const found = findAdminInputs();
    if (!found.username && !found.password) return;

    const result = await verifyCentralAdminCredentials(found.username, found.password);
    if (!result.ok) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showCentralAdminError('ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ถูกต้อง');
        return;
    }

    if (result.requirePasswordChange) {
        setTimeout(showCentralAdminChangeModal, 900);
    }
}, true);

document.addEventListener('DOMContentLoaded', () => {
    ensureCentralAdminDocs().catch(console.error);

    hookKnownAdminLoginFunctions();
    setTimeout(hookKnownAdminLoginFunctions, 1000);
    setTimeout(hookKnownAdminLoginFunctions, 3000);
    setInterval(hookKnownAdminLoginFunctions, 5000);

    const form = document.getElementById('central-admin-change-form');
    if (form && !form.__centralAdminChangeBound) {
        form.__centralAdminChangeBound = true;
        form.addEventListener('submit', async function(event) {
            event.preventDefault();

            const username = document.getElementById('central-admin-new-username')?.value.trim() || '';
            const password = document.getElementById('central-admin-new-password')?.value.trim() || '';
            const confirm = document.getElementById('central-admin-confirm-password')?.value.trim() || '';

            if (!username) return alert('กรุณากรอกชื่อผู้ใช้ใหม่');
            if (password.length < 6) return alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
            if (password !== confirm) return alert('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');

            try {
                await saveCentralAdminCredentials(username, password);
                hideCentralAdminChangeModal();
                if (typeof window.showCustomAlert === 'function') {
                    window.showCustomAlert('success', 'บันทึกแล้ว', 'เปลี่ยนรหัสแอดมินเรียบร้อย ทุกเครื่องจะใช้รหัสใหม่นี้ทันที');
                } else {
                    alert('เปลี่ยนรหัสแอดมินเรียบร้อย ทุกเครื่องจะใช้รหัสใหม่นี้ทันที');
                }
            } catch (error) {
                console.error(error);
                alert(error.message || 'เปลี่ยนรหัสแอดมินไม่สำเร็จ');
            }
        });
    }
});

window.ensureCentralAdminDocs = ensureCentralAdminDocs;
window.verifyCentralAdminCredentials = verifyCentralAdminCredentials;
window.saveCentralAdminCredentials = saveCentralAdminCredentials;
