
/* SchoolHub Admin Direct Firebase Login Final Patch */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const finalAdminConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
};

const finalAdminApp = getApps().length ? getApp() : initializeApp(finalAdminConfig);
const finalAdminDb = getFirestore(finalAdminApp);

function clearOldAdminLocal() {
    try {
        [
            'schoolhub_admin_password',
            'schoolhub_admin_default_disabled',
            'schoolhub_admin_bypass',
            'adminUsername',
            'adminPassword',
            'admin_credentials',
            'adminCredentials'
        ].forEach(k => {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        });
    } catch(e) {}
}

async function ensureFinalAdminDocs() {
    const credRef = doc(finalAdminDb, 'admin_settings', 'credentials');
    const secRef = doc(finalAdminDb, 'admin_settings', 'security');

    const credSnap = await getDoc(credRef);
    const secSnap = await getDoc(secRef);

    if (!credSnap.exists()) {
        await setDoc(credRef, {
            username: 'Admin',
            email: '',
            password: 'Admin123',
            updatedAt: serverTimestamp(),
            updatedBy: 'system'
        }, { merge: true });
    } else if (!('email' in (credSnap.data() || {}))) {
        await setDoc(credRef, { email: '' }, { merge: true });
    }

    if (!secSnap.exists()) {
        await setDoc(secRef, {
            requirePasswordChange: true,
            lastPasswordChange: 0,
            updatedAt: serverTimestamp()
        }, { merge: true });
    }
}

window.saveAdminCredentialsToFirebaseOnly = async function(username, email, password) {
    username = String(username || '').trim();
    email = String(email || '').trim().toLowerCase();
    password = String(password || '').trim();

    if (!username) throw new Error('กรุณากรอกชื่อผู้ใช้ Admin');
    if (password.length < 6) throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');

    await setDoc(doc(finalAdminDb, 'admin_settings', 'credentials'), {
        username,
        email,
        password,
        updatedAt: serverTimestamp(),
        updatedBy: 'admin'
    }, { merge: true });

    await setDoc(doc(finalAdminDb, 'admin_settings', 'security'), {
        requirePasswordChange: false,
        lastPasswordChange: serverTimestamp(),
        updatedAt: serverTimestamp()
    }, { merge: true });

    clearOldAdminLocal();
};

document.addEventListener('DOMContentLoaded', () => {
    clearOldAdminLocal();
    ensureFinalAdminDocs().catch(console.error);
    setInterval(clearOldAdminLocal, 3000);
});
