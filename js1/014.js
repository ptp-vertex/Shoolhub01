
/* ============================================================
   SchoolHub Firebase Admin Login System
   ระบบรหัสแอดมินกลางใน Firebase
   ค่าเริ่มต้นครั้งแรก:
   username: Admin
   password: Admin123

   หลังจากเปลี่ยนแล้ว ทุกเครื่องจะใช้ค่าจาก Firebase เท่านั้น
   เก็บที่: system_settings/admin_credentials
   ============================================================ */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const adminLoginFirebaseConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
};

const adminLoginApp = getApps().length ? getApp() : initializeApp(adminLoginFirebaseConfig);
const adminLoginDb = getFirestore(adminLoginApp);

const ADMIN_CREDENTIAL_DOC = doc(adminLoginDb, 'system_settings', 'admin_credentials');

async function sha256Text(text) {
    const encoded = new TextEncoder().encode(String(text));
    const buffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function ensureAdminCredentials() {
    const snap = await getDoc(ADMIN_CREDENTIAL_DOC);

    if (!snap.exists()) {
        const passwordHash = await sha256Text('Admin123');
        await setDoc(ADMIN_CREDENTIAL_DOC, {
            username: 'Admin',
            passwordHash,
            mustUseFirebase: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });

        return {
            username: 'Admin',
            passwordHash,
            mustUseFirebase: true
        };
    }

    const data = snap.data() || {};

    // ถ้าเอกสารมี username แต่ยังไม่มี hash ให้เติมค่าเริ่มต้นครั้งเดียว
    if (!data.passwordHash) {
        const passwordHash = await sha256Text('Admin123');
        await setDoc(ADMIN_CREDENTIAL_DOC, {
            username: data.username || 'Admin',
            passwordHash,
            mustUseFirebase: true,
            updatedAt: serverTimestamp()
        }, { merge: true });

        return {
            ...data,
            username: data.username || 'Admin',
            passwordHash,
            mustUseFirebase: true
        };
    }

    return data;
}

async function verifyFirebaseAdminLogin(username, password) {
    const data = await ensureAdminCredentials();
    const inputHash = await sha256Text(password);

    return String(username || '').trim() === String(data.username || '').trim()
        && inputHash === data.passwordHash;
}

async function updateFirebaseAdminCredentials(newUsername, newPassword) {
    const username = String(newUsername || '').trim();
    const password = String(newPassword || '').trim();

    if (!username) throw new Error('กรุณากรอกชื่อผู้ใช้แอดมินใหม่');
    if (!password || password.length < 6) throw new Error('รหัสผ่านแอดมินต้องมีอย่างน้อย 6 ตัวอักษร');

    const passwordHash = await sha256Text(password);

    await setDoc(ADMIN_CREDENTIAL_DOC, {
        username,
        passwordHash,
        mustUseFirebase: true,
        updatedAt: serverTimestamp()
    }, { merge: true });

    return true;
}

function getInputValueByCandidates(ids) {
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el) return el.value || '';
    }
    return '';
}

function setInputValueByCandidates(ids, value) {
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }
}

function tryFindAdminLoginValues() {
    const username = getInputValueByCandidates([
        'admin-username',
        'admin-user',
        'admin-login-username',
        'admin-email',
        'admin-id',
        'login-admin-username'
    ]);

    const password = getInputValueByCandidates([
        'admin-password',
        'admin-pass',
        'admin-login-password',
        'login-admin-password'
    ]);

    return { username, password };
}

// เปิดให้โค้ดเดิมเรียกใช้ได้
window.ensureAdminCredentials = ensureAdminCredentials;
window.verifyFirebaseAdminLogin = verifyFirebaseAdminLogin;
window.updateFirebaseAdminCredentials = updateFirebaseAdminCredentials;
window.changeFirebaseAdminCredentials = updateFirebaseAdminCredentials;

// ฟังก์ชันสำหรับปุ่มเปลี่ยนรหัสแอดมิน ถ้าหน้าเว็บมีปุ่มเรียกใช้
window.openChangeAdminCredentialsPrompt = async function () {
    try {
        const current = await ensureAdminCredentials();

        const newUsername = prompt('ชื่อผู้ใช้แอดมินใหม่', current.username || 'Admin');
        if (newUsername === null) return;

        const newPassword = prompt('รหัสผ่านแอดมินใหม่ (อย่างน้อย 6 ตัวอักษร)');
        if (newPassword === null) return;

        await updateFirebaseAdminCredentials(newUsername, newPassword);
        alert('เปลี่ยนรหัสแอดมินเรียบร้อยแล้ว ทุกเครื่องจะใช้รหัสใหม่นี้ทันที');
    } catch (error) {
        alert(error.message || 'เปลี่ยนรหัสแอดมินไม่สำเร็จ');
        console.error(error);
    }
};

// ดักฟังก์ชัน login แอดมินเดิม ถ้ามี
function hookAdminLoginFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__firebaseAdminHooked) return;

    const wrapped = async function (...args) {
        try {
            let username = '';
            let password = '';

            // รองรับกรณีฟังก์ชันเดิมส่งค่ามาเป็น argument
            if (typeof args[0] === 'string') username = args[0];
            if (typeof args[1] === 'string') password = args[1];

            // รองรับกรณีส่ง event/form
            if (!username || !password) {
                const found = tryFindAdminLoginValues();
                username = username || found.username;
                password = password || found.password;
            }

            if (username || password) {
                const ok = await verifyFirebaseAdminLogin(username, password);
                if (!ok) {
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert('error', 'เข้าสู่ระบบแอดมินไม่สำเร็จ', 'ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ถูกต้อง');
                    } else {
                        alert('ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ถูกต้อง');
                    }
                    return false;
                }
            }

            return original.apply(this, args);
        } catch (error) {
            console.error('Firebase admin login hook error:', error);
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('error', 'เกิดข้อผิดพลาด', error.message || 'ไม่สามารถตรวจสอบรหัสแอดมินจาก Firebase ได้');
            } else {
                alert(error.message || 'ไม่สามารถตรวจสอบรหัสแอดมินจาก Firebase ได้');
            }
            return false;
        }
    };

    wrapped.__firebaseAdminHooked = true;
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

// ดัก submit form ที่น่าจะเป็นฟอร์มแอดมิน
document.addEventListener('submit', async function (event) {
    const form = event.target;
    if (!form || !(form instanceof HTMLFormElement)) return;

    const formText = (form.id + ' ' + form.className + ' ' + form.innerText).toLowerCase();
    const isAdminForm = formText.includes('admin') || formText.includes('แอดมิน') || formText.includes('ผู้ดูแล');

    if (!isAdminForm) return;

    const { username, password } = tryFindAdminLoginValues();

    if (!username && !password) return;

    const ok = await verifyFirebaseAdminLogin(username, password);
    if (!ok) {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (typeof showCustomAlert === 'function') {
            showCustomAlert('error', 'เข้าสู่ระบบแอดมินไม่สำเร็จ', 'ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ถูกต้อง');
        } else {
            alert('ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ถูกต้อง');
        }
    }
}, true);

document.addEventListener('DOMContentLoaded', () => {
    ensureAdminCredentials().catch(console.error);
    hookKnownAdminLoginFunctions();
    setTimeout(hookKnownAdminLoginFunctions, 1200);
    setTimeout(hookKnownAdminLoginFunctions, 3000);
    setInterval(hookKnownAdminLoginFunctions, 5000);
});
