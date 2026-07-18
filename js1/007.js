
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, onSnapshot, query, where, orderBy, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        const firebaseConfig = {
  apiKey: "AIzaSyADAbTJEWivV1Nn-au7tXofStx4ADYTCM8",
  authDomain: "shoolhub-5677e.firebaseapp.com",
  projectId: "shoolhub-5677e",
  storageBucket: "shoolhub-5677e.firebasestorage.app",
  messagingSenderId: "630487358153",
  appId: "1:630487358153:web:1866add5d4a29b74abcb18",
  measurementId: "G-2Q6R46DC38"
};

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        // ใช้ Local Persistence ของ Firebase Auth เพื่อให้ Session ค้างในเครื่องนี้จนกว่าจะกดออกจากระบบเอง
        setPersistence(auth, browserLocalPersistence).catch(e => console.warn('Firebase auth persistence failed:', e));
        const db = getFirestore(app);

        // --- ระบบส่งเมลผ่าน Google Apps Script Web App เท่านั้น ---
        // ใช้ hidden iframe + postMessage เพื่อรับผลจริงจาก Apps Script โดยไม่ใช้ no-cors
        const MAIL_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzJZNwyvTWRVr4mmk_g_KARlfDe77VBLbsJdS1grR1WlvZ48dmwHLp0ZaKaH1QGjXU/exec';
        const makeToken = () => Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        function buildSchoolHubLink(params = {}) {
            const url = new URL(window.location.href);
            url.hash = '';
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v || '')));
            return url.toString();
        }
        async function sendMailViaWebApp({ to, subject, message, htmlBody, type = 'schoolhub', name = '', extra = {} } = {}) {
            const target = String(to || '').trim();
            if (!target || !MAIL_WEB_APP_URL) throw new Error('ไม่พบอีเมลผู้รับหรือ URL Apps Script');
            const requestId = 'mail_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            const payload = {
                requestId,
                type: String(type || ''),
                email: target,
                name: String(name || ''),
                link: String((extra && (extra.link || extra.actionLink || extra.returnUrl)) || ''),
                subject: String(subject || ''),
                message: String(message || ''),
                htmlBody: String(htmlBody || '')
            };
            return new Promise((resolve, reject) => {
                const iframeName = 'schoolhub_mail_frame_' + requestId;
                const iframe = document.createElement('iframe');
                iframe.name = iframeName;
                iframe.style.display = 'none';
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = MAIL_WEB_APP_URL;
                form.target = iframeName;
                form.style.display = 'none';
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'payload';
                input.value = JSON.stringify(payload);
                form.appendChild(input);
                const cleanup = () => { window.removeEventListener('message', onMessage); iframe.remove(); form.remove(); };
                const timer = setTimeout(() => { cleanup(); reject(new Error('Apps Script ไม่ตอบกลับ กรุณาตรวจ Deploy และสิทธิ์ Anyone')); }, 20000);
                const onMessage = (event) => {
                    const data = event.data || {};
                    if (!data || data.requestId !== requestId) return;
                    clearTimeout(timer);
                    cleanup();
                    if (data.ok) resolve(data);
                    else reject(new Error(data.error || 'Apps Script ส่งอีเมลไม่สำเร็จ'));
                };
                window.addEventListener('message', onMessage);
                document.body.appendChild(iframe);
                document.body.appendChild(form);
                form.submit();
            });
        }
        window.sendMailViaWebApp = sendMailViaWebApp;

        async function processSchoolHubVerifyFromURL() {
            const params = new URLSearchParams(location.search);
            if (params.get('schoolhubVerify') !== '1') return;
            const email = (params.get('email') || '').trim();
            const token = (params.get('token') || '').trim();
            if (!email || !token) return showCustomAlert('ลิงก์ไม่ถูกต้อง', 'ไม่พบข้อมูลยืนยันอีเมล', true);
            toggleLoader(true);
            try {
                const ref = doc(db, `users_status`, email);
                const snap = await getDoc(ref);
                const saved = snap.exists() ? (snap.data().verifyToken || '') : '';
                if (saved && saved !== token) throw new Error('โทเคนยืนยันไม่ตรงกัน');
                await setDoc(ref, { emailVerified: true, verifyToken: null, verifiedAt: Date.now(), status: 'active' }, { merge: true });
                history.replaceState({}, document.title, location.pathname);
                showCustomAlert('ยืนยันอีเมลสำเร็จ', 'บัญชีนี้ยืนยันอีเมลแล้ว สามารถเข้าสู่ระบบได้ทันที');
            } catch (err) {
                showCustomAlert('ยืนยันอีเมลไม่ได้', err.message || String(err), true);
            }
            toggleLoader(false);
        }
        processSchoolHubVerifyFromURL();

        // ป้องกันหน้าโหลดค้าง: ถ้า Firebase ตอบช้า/โดน Rules บล็อก จะปล่อยหน้าเว็บให้ใช้งานต่อ
        const FIREBASE_TIMEOUT_MS = 8000;
        const withTimeout = (promise, ms = FIREBASE_TIMEOUT_MS, label = 'Firebase') => {
            let timer;
            const timeout = new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
            });
            return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
        };
        const safeAsync = async (task, fallback = null) => {
            try { return await task(); } catch (e) { console.warn(e); return fallback; }
        };
        window.addEventListener('load', () => {
            setTimeout(() => {
                const loader = document.getElementById('global-loader');
                const landing = document.getElementById('landing-view');
                const authView = document.getElementById('auth-view');
                const appView = document.getElementById('main-app');
                if (loader && loader.style.display !== 'none' && landing?.classList.contains('hidden') && authView?.classList.contains('hidden') && appView?.classList.contains('hidden')) {
                    landing?.classList.remove('hidden');
                    loader.style.display = 'none';
                    console.warn('SchoolHub: loader safety fallback activated');
                }
            }, 9000);
        });

        const isSchoolHubValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
        const normalizeSchoolHubEmail = (v) => String(v || '').trim().toLowerCase();
        const getUserKey = (user) => {
            const email = normalizeSchoolHubEmail(user && user.email);
            if (!isSchoolHubValidEmail(email)) {
                console.error('Blocked invalid user creation: email required', user);
                throw new Error('Blocked invalid user creation: email required');
            }
            return email;
        };
        const getPrivatePath = (userKey) => `users/${userKey}/school_data`;
        const getPublicPath = () => `public_users_directory`;
        const getAnnouncementDocRef = () => doc(db, 'system_settings', 'announcements');
        const getPlansDocRef = () => doc(db, 'system_settings', 'subscription_plans');
        const getShareDocRef = (token) => doc(db, 'shared_student_views', token);
        const getPlanRequestDocRef = (id) => doc(db, 'subscription_requests', id);
        const ANNOUNCEMENT_CACHE_KEY = 'schoolhub_public_announcements_cache';
        const PLANS_CACHE_KEY = 'schoolhub_subscription_plans_cache';
        const PENDING_PLAN_KEY = 'schoolhub_pending_plan_request_id';
        const SCHOOLHUB_DEFAULT_PROMPTPAY = '0841973468';
        const SCHOOLHUB_SESSION_KEY = 'schoolhub_web_session_v1';

        function saveSchoolHubSession(user, role) {
            try {
                if (!user) return;
                const payload = {
                    uid: user.uid || '',
                    email: user.email || '',
                    username: user.username || '',
                    displayName: user.displayName || user.name || user.email || user.username || '',
                    role: role || (isAdmin ? 'admin' : 'user'),
                    isAdmin: role === 'admin' || !!isAdmin,
                    savedAt: Date.now()
                };
                localStorage.setItem(SCHOOLHUB_SESSION_KEY, JSON.stringify(payload));
                localStorage.setItem('schoolhub_session_active', 'true');
            } catch(e) { console.warn('save session failed:', e); }
        }

        function readSchoolHubSession() {
            try {
                const raw = localStorage.getItem(SCHOOLHUB_SESSION_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch(e) { return null; }
        }

        function clearSchoolHubSession() {
            try {
                localStorage.removeItem(SCHOOLHUB_SESSION_KEY);
                localStorage.removeItem('schoolhub_session_active');
                localStorage.removeItem('schoolhub_admin_bypass');
                localStorage.removeItem('schoolhub_admin_active');
            } catch(e) {}
        }

        function clearSchoolHubLoginState() {
            try { if (typeof clearSchoolHubRealtimeListeners === 'function') clearSchoolHubRealtimeListeners(); } catch(e) {}
            try {
                [
                    SCHOOLHUB_SESSION_KEY,
                    'schoolhub_session_active',
                    'schoolhub_admin_bypass',
                    'schoolhub_admin_active',
                    'schoolhub_logout_intent',
                    'currentUser',
                    'authUser',
                    'loginSession',
                    'userEmail',
                    'userKey',
                    'schoolhub_current_user',
                    'schoolhub_auth_user',
                    'schoolhub_login_session',
                    'schoolhub_user_email',
                    'schoolhub_user_key'
                ].forEach(key => localStorage.removeItem(key));
                localStorage.setItem('schoolhub_logout_intent', String(Date.now()));
            } catch(e) {}
            try {
                [
                    'currentUser',
                    'authUser',
                    'loginSession',
                    'userEmail',
                    'userKey',
                    'schoolhub_current_user',
                    'schoolhub_auth_user',
                    'schoolhub_login_session',
                    'schoolhub_user_email',
                    'schoolhub_user_key'
                ].forEach(key => sessionStorage.removeItem(key));
            } catch(e) {}
            currentUser = null;
            isAdmin = false;
            window.__currentUserDir = null;
            window.__schoolhubPlanLocked = false;
            window.__schoolhubPendingInvites = [];
        }

        async function loadSchoolHubDataAfterAuth(userForDir) {
            await loadStateFromDB();
            shLoaderProgress(88, 'กำลังซิงค์ข้อมูลล่าสุด...');
            try { await startSchoolHubRealtimeListeners(); } catch(e) { console.warn('start realtime listeners failed:', e); }
            shLoaderProgress(92, 'กำลังโหลดข้อมูลผู้ใช้...');
            try {
                const u = userForDir || currentUser || (auth && auth.currentUser);
                if (u && u.uid && u.uid !== 'admin-bypass') {
                    const dirSnap = await withTimeout(getDoc(doc(db, getPublicPath(), getUserKey(u))), 6000, 'loadAuthUserDir');
                    window.__currentUserDir = dirSnap.exists() ? (dirSnap.data() || {}) : {};
                }
            } catch(e) { console.warn('load auth user dir failed:', e); }
            shLoaderProgress(96, 'กำลังตรวจสอบแผนการใช้งาน...');
            try { await refreshCurrentUserPlanLock(); } catch(e) { console.warn('refresh plan after auth failed:', e); }
            try { await loadPublicPlans(); } catch(e) { console.warn('load plans after auth failed:', e); }
            updateGlobalViews();
            // รอ frame ถัดไปให้แน่ใจว่าการ์ดรายชื่อ (course-grid) วาดเสร็จจริงบนหน้าจอ
            // ก่อนที่จะปิดหน้าโหลดและเปิดหน้าแอปหลัก ป้องกันปัญหาเปิดครั้งแรกแล้วการ์ดว่าง/เลื่อนไม่ได้
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            shLoaderProgress(100, 'พร้อมแล้ว');
        }
        // สำคัญ: ต้อง expose ฟังก์ชันนี้ไว้บน window ด้วย เพราะสคริปต์อื่น (เช่น ระบบ
        // ล็อกเมนูตามแผน 096_schoolhub-canonical-12-rights-script.js) ต้องการ "ครอบ"
        // ฟังก์ชันนี้เพื่อรู้ว่าเมื่อไหร่ข้อมูลแผน/สิทธิ์ผู้ใช้ (__currentUserDir) โหลดเสร็จ
        // แล้วค่อยรีเฟรชสถานะล็อก/ปลดล็อกของปุ่มเมนูต่าง ๆ ให้ตรงกับสิทธิ์จริง
        // ถ้าไม่ expose ไว้ตรงนี้ การครอบจะหาไม่เจอ (window.loadSchoolHubDataAfterAuth
        // เป็น undefined) ทำให้การรีเฟรช UI ตามสิทธิ์หลังล็อกอิน "ไม่เกิดขึ้นเลย" —
        // ปุ่มที่ถูกล็อกไว้ชั่วคราวตอนข้อมูลยังโหลดไม่เสร็จ (เช่น ปุ่มดาว/โบนัสในเมนูมือถือ)
        // จะค้างเป็นสีเทาต่อไปแม้สิทธิ์จริงจะอนุญาตแล้วก็ตาม
        window.loadSchoolHubDataAfterAuth = loadSchoolHubDataAfterAuth;

        async function forceSchoolHubLogout(options = {}) {
            const redirect = options.redirect !== false;
            clearSchoolHubLoginState();
            try {
                if (auth && auth.currentUser) await signOut(auth);
            } catch(e) { console.warn('force logout signOut failed:', e); }
            clearSchoolHubLoginState();
            try { toggleLoader(false); } catch(e) {}
            try {
                const landing = document.getElementById('landing-view');
                const authView = document.getElementById('auth-view');
                const mainApp = document.getElementById('main-app');
                if (mainApp) mainApp.classList.add('hidden');
                if (authView) authView.classList.add('hidden');
                if (landing) landing.classList.remove('hidden');
            } catch(e) {}
            if (redirect) {
                const cleanUrl = window.location.origin + window.location.pathname;
                setTimeout(() => {
                    try { window.location.replace(cleanUrl); }
                    catch(_e) { window.location.href = cleanUrl; }
                }, options.delay || 250);
            }
        }

        async function restoreUserSessionFromLocal(saved) {
            if (!saved || saved.role !== 'user' || !saved.uid) return false;
            try {
                toggleLoader(true);
                currentUser = {
                    uid: saved.uid,
                    email: saved.email || '',
                    displayName: saved.displayName || saved.email || 'ผู้ใช้งาน'
                };
                isAdmin = false;
                // สำคัญ: ห้ามเปิดหน้าแอปหลัก (main-app) ก่อนข้อมูลโหลดเสร็จจริง
                // มิฉะนั้นการ์ดรายชื่อ/รายวิชาจะว่างเปล่าและเลื่อนไม่ได้ในการเปิดครั้งแรก
                // (state.courses/state.students ยังไม่มา) ต้องรอ loadSchoolHubDataAfterAuth
                // เสร็จสมบูรณ์ก่อน แล้วค่อยสลับหน้าจอ เหมือนกับ flow ล็อกอินปกติด้านล่าง
                const dName = currentUser.displayName || 'ผู้ใช้งาน';
                document.getElementById('user-display-name').textContent = dName;
                document.getElementById('user-display-email').textContent = getUserKey(currentUser);
                document.getElementById('user-avatar-initial').textContent = dName.charAt(0).toUpperCase();
                setAdminNavigationMode(false);
                await loadSchoolHubDataAfterAuth(currentUser);
                document.getElementById('landing-view').classList.add('hidden');
                document.getElementById('auth-view').classList.add('hidden');
                document.getElementById('main-app').classList.remove('hidden');
                window.renderPublicAnnouncements?.();
                window.goToHome();
                return true;
            } catch(e) {
                console.warn('restore local session failed:', e);
                clearSchoolHubSession();
                return false;
            } finally { toggleLoader(false); }
        }

        function readLocalJSON(key, fallback) {
            try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
            catch(e) { return fallback; }
        }
        function writeLocalJSON(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
        }
        function getFirebaseErrorText(error) {
            const code = error?.code || '';
            const message = error?.message || '';
            if (code === 'permission-denied' || message.includes('Missing or insufficient permissions')) return 'Firestore Rules ไม่อนุญาตให้อ่าน/เขียนข้อมูลนี้';
            if (code === 'auth/unauthorized-domain') return 'โดเมนนี้ยังไม่ได้เพิ่มใน Firebase Authentication > Authorized domains';
            if (code === 'auth/popup-blocked') return 'เบราว์เซอร์บล็อกหน้าต่าง Google Login';
            if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
            if (code === 'auth/network-request-failed') return 'เชื่อมต่อ Firebase ไม่ได้ โปรดตรวจสอบอินเทอร์เน็ต';
            return message || 'ไม่ทราบสาเหตุ';
        }

        let currentUser = null;
        let isAdmin = false;
        let state = { courses: [], students: [], scores: [], attendance: {}, coursePlans: {}, courseGrades: {}, bonusScores: {}, starGroups: {}, bonusMergeSettings: {} };
        window.state = state;


        /* SchoolHub full realtime state patch
           - listener กลางชุดเดียว ไม่ผูกซ้ำตอนเปลี่ยนหน้า/dropdown/render
           - ฟัง state เจ้าของบัญชี + state รายวิชาที่ถูกแชร์และตอบรับแล้ว
           - render เฉพาะหน้าที่เปิดอยู่หลัง snapshot เปลี่ยน */
        let schoolhubRealtimeUnsubs = [];
        let schoolhubRealtimeOwnerUnsubs = {};
        let schoolhubRealtimeStartedFor = '';
        let schoolhubRealtimeOwnState = null;
        let schoolhubRealtimeOwnerStates = {};
        let schoolhubRealtimePublicUsers = [];
        let schoolhubRealtimeRenderTimer = null;

        function addSchoolHubRealtimeUnsub(unsub){
            if(typeof unsub === 'function') schoolhubRealtimeUnsubs.push(unsub);
        }

        function clearSchoolHubRealtimeListeners(){
            try { Object.keys(schoolhubRealtimeOwnerUnsubs || {}).forEach(k => { try { schoolhubRealtimeOwnerUnsubs[k](); } catch(e){} }); } catch(e) {}
            schoolhubRealtimeOwnerUnsubs = {};
            try { (schoolhubRealtimeUnsubs || []).forEach(unsub => { try { unsub(); } catch(e){} }); } catch(e) {}
            schoolhubRealtimeUnsubs = [];
            schoolhubRealtimeStartedFor = '';
            schoolhubRealtimeOwnState = null;
            schoolhubRealtimeOwnerStates = {};
            schoolhubRealtimePublicUsers = [];
        }
        window.clearSchoolHubRealtimeListeners = clearSchoolHubRealtimeListeners;

        function schoolhubStateFromData(data){
            return {
                courses: Array.isArray(data && data.courses) ? schoolhubCloneClean(data.courses) : [],
                students: Array.isArray(data && data.students) ? schoolhubCloneClean(data.students) : [],
                scores: Array.isArray(data && data.scores) ? schoolhubCloneClean(data.scores) : [],
                attendance: schoolhubCloneClean((data && data.attendance) || {}),
                coursePlans: schoolhubCloneClean((data && data.coursePlans) || {}),
                courseGrades: schoolhubCloneClean((data && data.courseGrades) || {})
            };
        }

        function schoolhubRebuildStateFromRealtime(){
            const base = schoolhubStateFromData(schoolhubRealtimeOwnState || schoolhubOwnStateOnly());
            state.courses = base.courses;
            state.students = base.students;
            state.scores = base.scores;
            state.attendance = base.attendance;
            state.coursePlans = base.coursePlans;
            state.courseGrades = base.courseGrades;
            window.state = state;
            window.__schoolhubIncomingSharedCourses = [];

            const myEmail = schoolhubGetCurrentEmail();
            const myKey = currentUser ? getUserKey(currentUser) : '';
            if(myEmail){
                const seen = new Set((state.courses || []).map(c => schoolhubSharedCourseKey(myKey, c.id)));
                (schoolhubRealtimePublicUsers || []).forEach(u => {
                    const ownerKey = u.userKey || u.email || u.uid;
                    if(!ownerKey || String(ownerKey) === String(myKey) || schoolhubNormEmail(u.email) === myEmail) return;
                    const ownerState = schoolhubRealtimeOwnerStates[ownerKey];
                    if(!ownerState || !Array.isArray(ownerState.courses)) return;
                    ownerState.courses.forEach(c => {
                        const share = schoolhubGetShareEntries(c).find(x => x.email === myEmail);
                        if(!share || share.status === 'declined' || share.status === 'removed') return;
                        const key = schoolhubSharedCourseKey(ownerKey, c.id);
                        if(seen.has(key)) return;
                        const item = { ownerKey, ownerName: u.name || u.email || ownerKey, courseId: c.id, courseName: c.name || '', courseCode: c.code || '', permission: share.permission === 'edit' ? 'edit' : 'view', status: share.status || 'pending' };
                        if(item.status === 'accepted'){
                            schoolhubMergeAcceptedSharedCourse(ownerKey, item.ownerName, ownerState, c, share);
                            seen.add(key);
                        }else{
                            window.__schoolhubIncomingSharedCourses.push(item);
                        }
                    });
                });
            }
            try { hydrateGradeCriteriaAfterLoad({log:false}); } catch(e) { console.warn('[GRADE LOAD] realtime hydrate failed:', e); }
        }

        function schoolhubVisible(id){
            const el = document.getElementById(id);
            return !!(el && !el.classList.contains('hidden'));
        }

        function schoolhubRenderCurrentViewFromRealtime(){
            try {
                const mainApp = document.getElementById('main-app');
                if(!mainApp || mainApp.classList.contains('hidden')) return;
                if(schoolhubVisible('view-dashboard')){
                    updateGlobalViews();
                    try { schoolhubRenderIncomingShares(); } catch(e) {}
                    return;
                }
                if(schoolhubVisible('view-students-master')){
                    try { renderStudentsMaster(); } catch(e) {}
                    return;
                }
                if(schoolhubVisible('view-course-detail')){
                    if(currentActiveCourseId && !(state.courses || []).some(c => String(c.id) === String(currentActiveCourseId))){
                        window.goToHome();
                        return;
                    }
                    const c = (state.courses || []).find(x => String(x.id) === String(currentActiveCourseId));
                    if(c){
                        const title = document.getElementById('page-title');
                        const subtitle = document.getElementById('page-subtitle');
                        const sidebarName = document.getElementById('sidebar-course-name');
                        const mobileCourseName = document.getElementById('mobile-course-name');
                        if(title) title.textContent = c.name || '';
                        if(subtitle) subtitle.innerHTML = `<span class="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs font-bold mr-2">${escapeHTML(c.code || '')}</span> จัดการข้อมูลรายวิชานี้`;
                        if(sidebarName) sidebarName.textContent = `วิชา: ${c.code || ''}`;
                        if(mobileCourseName) mobileCourseName.textContent = `เมนูประจำรายวิชา: ${c.code || ''} ${c.name || ''}`;
                    }
                    try { populateHiddenCourseDropdowns(); } catch(e) {}
                    if(schoolhubVisible('course-tab-overview')){ try { renderCourseOverview(); } catch(e) {} }
                    if(schoolhubVisible('course-tab-attendance')){
                        try { window.initCalendar && window.initCalendar(); } catch(e) {}
                        try { if(document.getElementById('attendance-area') && !document.getElementById('attendance-area').classList.contains('hidden')) renderAttendanceList(); } catch(e) {}
                    }
                    if(schoolhubVisible('course-tab-scores')){
                        try { if(document.getElementById('score-area') && !document.getElementById('score-area').classList.contains('hidden')) renderScoreList(); } catch(e) {}
                        try { if(document.getElementById('plan-modal') && !document.getElementById('plan-modal').classList.contains('hidden')) renderPlanList(currentActiveCourseId); } catch(e) {}
                    }
                    try { schoolhubEnsureCourseTeacherButton(); } catch(e) {}
                    try { schoolhubApplyReadonlyUI(); } catch(e) {}
                }
            } catch(e) { console.warn('realtime render current view failed:', e); }
        }

        function schoolhubScheduleRealtimeRender(){
            if(schoolhubRealtimeRenderTimer) clearTimeout(schoolhubRealtimeRenderTimer);
            schoolhubRealtimeRenderTimer = setTimeout(() => {
                schoolhubRealtimeRenderTimer = null;
                schoolhubRenderCurrentViewFromRealtime();
            }, 80);
        }

        function schoolhubStartOwnerStateListener(ownerKey){
            if(!ownerKey || schoolhubRealtimeOwnerUnsubs[ownerKey]) return;
            try {
                const unsub = onSnapshot(doc(db, getPrivatePath(ownerKey), 'state'), (snap) => {
                    if(snap.exists()) schoolhubRealtimeOwnerStates[ownerKey] = snap.data() || {};
                    else delete schoolhubRealtimeOwnerStates[ownerKey];
                    schoolhubRebuildStateFromRealtime();
                    schoolhubScheduleRealtimeRender();
                }, (err) => console.warn('shared owner realtime failed:', ownerKey, err));
                schoolhubRealtimeOwnerUnsubs[ownerKey] = unsub;
            } catch(e) { console.warn('start shared owner realtime failed:', ownerKey, e); }
        }

        function schoolhubSyncOwnerRealtimeListeners(){
            const myEmail = schoolhubGetCurrentEmail();
            const myKey = currentUser ? getUserKey(currentUser) : '';
            const needed = new Set();
            (schoolhubRealtimePublicUsers || []).forEach(u => {
                const ownerKey = u.userKey || u.email || u.uid;
                if(!ownerKey || String(ownerKey) === String(myKey) || schoolhubNormEmail(u.email) === myEmail) return;
                needed.add(String(ownerKey));
                schoolhubStartOwnerStateListener(String(ownerKey));
            });
            Object.keys(schoolhubRealtimeOwnerUnsubs || {}).forEach(k => {
                if(!needed.has(k)){
                    try { schoolhubRealtimeOwnerUnsubs[k](); } catch(e) {}
                    delete schoolhubRealtimeOwnerUnsubs[k];
                    delete schoolhubRealtimeOwnerStates[k];
                }
            });
        }

        function startSchoolHubRealtimeListeners(){
            return new Promise((resolve) => {
                if(!currentUser || currentUser.uid === 'admin-bypass'){ resolve(false); return; }
                const userKey = getUserKey(currentUser);
                if(schoolhubRealtimeStartedFor === userKey){ resolve(true); return; }
                clearSchoolHubRealtimeListeners();
                schoolhubRealtimeStartedFor = userKey;
                let resolved = false;
                const finishOnce = (v) => { if(!resolved){ resolved = true; resolve(v); } };
                try {
                    const ownUnsub = onSnapshot(doc(db, getPrivatePath(userKey), 'state'), async (snap) => {
                        if(snap.exists()){
                            schoolhubRealtimeOwnState = snap.data() || {};
                        }else{
                            schoolhubRealtimeOwnState = { courses: [], students: [], scores: [], attendance: {}, coursePlans: {}, courseGrades: {} };
                            try { await setDoc(doc(db, getPrivatePath(userKey), 'state'), schoolhubRealtimeOwnState); } catch(e) { console.warn('create realtime state failed:', e); }
                        }
                        schoolhubRebuildStateFromRealtime();
                        schoolhubScheduleRealtimeRender();
                        finishOnce(true);
                    }, (err) => { console.warn('own realtime failed:', err); finishOnce(false); });
                    addSchoolHubRealtimeUnsub(ownUnsub);
                } catch(e) { console.warn('start own realtime failed:', e); finishOnce(false); }

                try {
                    const publicUnsub = onSnapshot(collection(db, getPublicPath()), (snap) => {
                        const users = [];
                        snap.forEach(d => users.push(d.data() || {}));
                        schoolhubRealtimePublicUsers = users;
                        schoolhubSyncOwnerRealtimeListeners();
                        schoolhubRebuildStateFromRealtime();
                        schoolhubScheduleRealtimeRender();
                    }, (err) => console.warn('public users realtime failed:', err));
                    addSchoolHubRealtimeUnsub(publicUnsub);
                } catch(e) { console.warn('start public users realtime failed:', e); }

                setTimeout(() => finishOnce(true), 1200);
            });
        }
        window.startSchoolHubRealtimeListeners = startSchoolHubRealtimeListeners;

        window.isStudentWithdrawn = (student) => (typeof window.isWithdrawnStudent === 'function') ? window.isWithdrawnStudent(student) : !!(student && (student.withdrawn === true || student.isWithdrawn === true || student.status === 'ลาออก' || student.status === 'withdrawn'));
        window.getStudentWithdrawnClass = (student) => window.isStudentWithdrawn(student) ? ' schoolhub-withdrawn-text' : '';
        window.getStudentWithdrawnRowClass = (student) => window.isStudentWithdrawn(student) ? ' schoolhub-withdrawn-row' : '';
        window.getStudentWithdrawnBadge = (student) => window.isStudentWithdrawn(student) ? '<span onclick="event.stopPropagation(); showStudentWithdrawReason(\'' + student.id + '\')" class="schoolhub-withdrawn-badge" title="ดูเหตุผลลาออก" role="button" tabindex="0"><i class="fas fa-user-slash"></i> ลาออก</span>' : '';
        window.refreshWithdrawnStudentViews = function(){
            try { renderStudentsMaster(); } catch(e) {}
            try { updateGlobalViews(); } catch(e) {}
            if (currentActiveCourseId) {
                try { renderAttendanceList(); } catch(e) {}
                try { renderScoreList(); } catch(e) {}
                try { renderCourseOverview(); } catch(e) {}
            }
        };
        window.getWithdrawnOperatorName = function(){
            try { return (currentUser && (currentUser.displayName || currentUser.email || currentUser.uid)) || (window.currentUser && (window.currentUser.displayName || window.currentUser.email || window.currentUser.uid)) || 'ไม่ระบุ'; }
            catch(e){ return 'ไม่ระบุ'; }
        };
        window.showStudentWithdrawReason = function(id){
            const s = state.students.find(x => x.id === id); if(!s) return;
            showCustomAlert('เหตุผลการลาออก', 'นักเรียน: ' + (s.name || '-') + '\nเหตุผล: ' + (s.withdrawReason || '-') + '\nวันที่บันทึก: ' + (s.withdrawDate || '-') + '\nผู้บันทึก: ' + (s.withdrawBy || '-'));
        };
        window.closeStudentWithdrawPopup = function(){ const el = document.getElementById('student-withdraw-popup'); if(el) el.remove(); };
        window.confirmSetStudentWithdrawn = async function(id){
            const s = state.students.find(x => x.id === id); if(!s) return;
            window.closeStudentWithdrawPopup();
            const popup = document.createElement('div');
            popup.id = 'student-withdraw-popup';
            popup.className = 'fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[999999] flex items-center justify-center p-4 fade-in';
            popup.innerHTML = '<div class="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl"><div class="text-center mb-5"><div class="text-5xl text-rose-500 mb-3"><i class="fas fa-user-slash"></i></div><h3 class="text-2xl font-bold text-slate-800">ตั้งเป็นลาออก</h3><p class="text-slate-500 text-sm mt-2">'+escapeHTML(s.code || '')+' '+escapeHTML(s.name || '')+'</p></div><label class="block text-sm font-bold text-slate-700 mb-2">เหตุผลการลาออก <span class="text-rose-500">*</span></label><textarea id="student-withdraw-reason" rows="5" class="w-full border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-rose-100 focus:border-rose-400 outline-none resize-y" placeholder="กรอกเหตุผลการลาออก"></textarea><p id="student-withdraw-error" class="hidden text-rose-500 text-sm font-bold mt-2">กรุณากรอกเหตุผลการลาออก</p><div class="flex gap-3 mt-6"><button type="button" onclick="closeStudentWithdrawPopup()" class="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3.5 rounded-2xl transition">ยกเลิก</button><button type="button" onclick="saveStudentWithdrawn(\''+id+'\')" class="w-1/2 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3.5 rounded-2xl transition">บันทึก</button></div></div>';
            document.body.appendChild(popup);
            setTimeout(function(){ var t=document.getElementById('student-withdraw-reason'); if(t) t.focus(); },50);
        };
        window.saveStudentWithdrawn = async function(id){
            const reasonEl = document.getElementById('student-withdraw-reason');
            const errEl = document.getElementById('student-withdraw-error');
            const reason = reasonEl ? reasonEl.value.trim() : '';
            if(!reason){ if(errEl) errEl.classList.remove('hidden'); if(reasonEl) reasonEl.focus(); return; }
            const idx = state.students.findIndex(s => s.id === id); if(idx < 0) return;
            state.students[idx].withdrawn = true;
            state.students[idx].status = 'ลาออก';
            state.students[idx].withdrawReason = reason;
            state.students[idx].withdrawDate = new Date().toLocaleString('th-TH');
            state.students[idx].withdrawBy = window.getWithdrawnOperatorName();
            window.closeStudentWithdrawPopup();
            window.refreshWithdrawnStudentViews();
            await saveStateToDB();
            showCustomAlert('สำเร็จ', 'ตั้งสถานะลาออกเรียบร้อย');
        };
        window.cancelStudentWithdrawn = async function(id){
            const idx = state.students.findIndex(s => s.id === id); if(idx < 0) return;
            window.showCustomConfirm('ยกเลิกสถานะลาออก', 'ยืนยันยกเลิกสถานะลาออกของนักเรียนคนนี้?', async () => {
                state.students[idx].withdrawn = false;
                state.students[idx].status = '';
                window.refreshWithdrawnStudentViews();
                await saveStateToDB();
                showCustomAlert('สำเร็จ', 'ยกเลิกสถานะลาออกเรียบร้อย');
            });
        };
        window.toggleStudentWithdrawn = async (id) => {
            const s = state.students.find(x => x.id === id); if(!s) return;
            if(window.isStudentWithdrawn(s)) return window.cancelStudentWithdrawn(id);
            return window.confirmSetStudentWithdrawn(id);
        };
        window.isSocialAuthenticating = false;

        let currentActiveCourseId = null;
        Object.defineProperty(window, 'currentActiveCourseId', {
            configurable: true,
            get: function(){ return currentActiveCourseId; },
            set: function(v){ currentActiveCourseId = v; }
        });
        let publicAnnouncements = [];
        let subscriptionPlans = [];
        let adminPlanRequests = [];
        let announcementPopupTimer = null;
        let announcementPopupIndex = 0;
        // เก็บ id ประกาศที่ผู้ใช้กดปิด (X) ไว้ในหน่วยความจำเท่านั้น (ไม่ persist)
        // เพื่อให้เมื่อรีเฟรชหน้าเว็บ ประกาศทั้งหมดกลับมาแสดงใหม่ทุกครั้ง
        // ไม่ว่าจะเป็นหน้าหลัก (landing) หรือหน้าที่เข้าสู่ระบบแล้ว (app)
        const closedAnnouncementIdsInMemory = new Set();

        let editingCourseId = null;
        let editingStudentId = null;
        let editingPlanId = null;

        let calendarYear = new Date().getFullYear();
        let calendarMonth = new Date().getMonth();

        async function loadPublicAnnouncements() {
            publicAnnouncements = readLocalJSON(ANNOUNCEMENT_CACHE_KEY, []);
            renderPublicAnnouncements();
            if (isAdmin) renderAdminAnnouncements();
            try {
                const snap = await withTimeout(getDoc(getAnnouncementDocRef()), 7000, 'loadAnnouncements');
                publicAnnouncements = snap.exists() ? (snap.data().items || []) : publicAnnouncements;
                writeLocalJSON(ANNOUNCEMENT_CACHE_KEY, publicAnnouncements);
            } catch (e) {
                console.warn('loadPublicAnnouncements failed:', e);
            }
            renderPublicAnnouncements();
            if (isAdmin) renderAdminAnnouncements();
        }

        function parseAnnouncementTime(value) {
            if (!value) return null;
            const t = new Date(value).getTime();
            return Number.isFinite(t) ? t : null;
        }

        function isAnnouncementInSchedule(a, now = Date.now()) {
            const start = parseAnnouncementTime(a.startAt);
            const end = parseAnnouncementTime(a.endAt);
            return (!start || now >= start) && (!end || now <= end);
        }

        function getActiveAnnouncements() {
            const now = Date.now();
            return (publicAnnouncements || [])
                .filter(a => a && a.active !== false && isAnnouncementInSchedule(a, now))
                .sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        }

        function announcementMatchesType(a, type) {
            return a.type === type || a.type === 'both';
        }

        function announcementMatchesScope(a, scope) {
            return !a.scope || a.scope === 'both' || a.scope === scope;
        }

        function isAnnouncementMuted(id) {
            const raw = localStorage.getItem(`schoolhub_announcement_mute_${id}`);
            if (!raw) return false;
            const until = Number(raw);
            if (!Number.isFinite(until) || Date.now() > until) {
                localStorage.removeItem(`schoolhub_announcement_mute_${id}`);
                return false;
            }
            return true;
        }

        function muteAnnouncementFor(id, days = 10) {
            localStorage.setItem(`schoolhub_announcement_mute_${id}`, String(Date.now() + days * 24 * 60 * 60 * 1000));
        }

        function isAnnouncementSessionClosed(id) {
            // ใช้ตัวแปรในหน่วยความจำแทน sessionStorage โดยตั้งใจ:
            // sessionStorage จะยังคงค่าไว้แม้กดรีเฟรชหน้าเว็บ (F5) ในแท็บเดิม
            // แต่ requirement ต้องการให้ "กดปิดแล้วไม่แสดงอีกจนกว่าจะรีเฟรช"
            // เมื่อรีเฟรช สคริปต์นี้จะถูกโหลดใหม่ทั้งหมด ตัวแปรนี้จะว่างเปล่า
            // ทำให้ประกาศกลับมาแสดงอีกครั้งตามที่ต้องการ
            return closedAnnouncementIdsInMemory.has(id);
        }

        function closeAnnouncementForSession(id) {
            closedAnnouncementIdsInMemory.add(id);
        }

        function getAnnouncementTrackingIdentity() {
            if (currentUser) {
                const key = getUserKey(currentUser) || currentUser.email || currentUser.uid || 'ผู้ใช้งาน';
                const name = currentUser.displayName || key;
                return { key, name };
            }
            let guestId = localStorage.getItem('schoolhub_guest_id');
            if (!guestId) {
                guestId = 'guest_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
                localStorage.setItem('schoolhub_guest_id', guestId);
            }
            return { key: guestId, name: 'ผู้เยี่ยมชม (ไม่ระบุตัวตน)' };
        }

        function announcementStatDocId(announcementId, key) {
            const safeKey = String(key).replace(/[\/\s]+/g, '_').slice(0, 150);
            return `${announcementId}__${safeKey}`;
        }

        async function trackAnnouncementRead(announcementId) {
            try {
                const { key, name } = getAnnouncementTrackingIdentity();
                const ref = doc(db, 'announcement_reads', announcementStatDocId(announcementId, key));
                const now = Date.now();
                let firstReadAt = now;
                try {
                    const snap = await getDoc(ref);
                    if (snap.exists() && snap.data().firstReadAt) firstReadAt = snap.data().firstReadAt;
                } catch (e) {}
                await setDoc(ref, {
                    announcementId, userKey: key, userName: name,
                    firstReadAt, lastReadAt: now, readCount: increment(1)
                }, { merge: true });
            } catch (e) { console.warn('trackAnnouncementRead failed:', e); }
        }

        async function trackAnnouncementMute(announcementId, days) {
            try {
                const { key, name } = getAnnouncementTrackingIdentity();
                const ref = doc(db, 'announcement_reads', announcementStatDocId(announcementId, key));
                const now = Date.now();
                await setDoc(ref, {
                    announcementId, userKey: key, userName: name,
                    muted: true, mutedAt: now, muteUntil: now + days * 24 * 60 * 60 * 1000
                }, { merge: true });
            } catch (e) { console.warn('trackAnnouncementMute failed:', e); }
        }

        function getRotationMs(items) {
            const first = (items || []).find(a => Number(a.rotationSeconds) > 0);
            const sec = Math.max(2, Number(first?.rotationSeconds || 6));
            return sec * 1000;
        }

        function escapeHTML(text) {
            return String(text || '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
        }

        function formatAdminDateTime(value) {
            if (!value) return 'ไม่กำหนด';
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return 'ไม่กำหนด';
            return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
        }

        function imageMarkup(url, extraClass = '') {
            if (!url) return '';
            return `<img src="${escapeHTML(url)}" alt="ประกาศ" class="${extraClass}" onerror="this.classList.add('hidden')">`;
        }

        function syncLandingTopOffset() {
            const landing = document.getElementById('landing-view');
            const topbar = document.getElementById('public-announcement-topbar');
            if (!landing) return;
            const h = (topbar && !topbar.classList.contains('hidden')) ? topbar.offsetHeight : 0;
            landing.style.setProperty('--sh-topbar-h', h + 'px');
        }
        window.addEventListener('resize', syncLandingTopOffset);

        const topbarRenderState = {
            'public-announcement-topbar': { timer: null, index: 0, onRender: syncLandingTopOffset },
            'app-announcement-topbar': { timer: null, index: 0, onRender: () => {} }
        };

        function renderTopbarInto(containerId, items) {
            const topbar = document.getElementById(containerId);
            const state = topbarRenderState[containerId];
            if (!topbar || !state) return;
            const visible = (items || []).filter(a => !isAnnouncementSessionClosed(a.id) && !isAnnouncementMuted(a.id));
            if (!visible.length) {
                topbar.classList.add('hidden');
                topbar.innerHTML = '';
                if (state.timer) clearInterval(state.timer);
                state.timer = null;
                state.onRender();
                return;
            }
            state.index = state.index % visible.length;
            const top = visible[state.index];
            topbar.classList.remove('hidden', 'sh-topbar-out');
            topbar.innerHTML = `<div class="bg-indigo-600 text-white px-4 py-3 shadow-lg"><div class="max-w-7xl mx-auto flex items-start gap-3 sh-announcement-clickable" onclick="openAnnouncementDetail('${top.id}')"><i class="fas fa-bullhorn mt-1"></i>${top.imageUrl ? `<img src="${escapeHTML(top.imageUrl)}" class="w-12 h-12 object-cover rounded-xl border border-white/20 hidden sm:block" onerror="this.classList.add('hidden')">` : ''}<div class="flex-1 min-w-0"><b>ประกาศ</b><span class="mx-2 hidden sm:inline">•</span><span class="font-bold break-words">${escapeHTML(top.title)}</span><span class="mx-2 hidden sm:inline">•</span><span class="block sm:inline break-words">${escapeHTML(top.message)}</span></div><button onclick="event.stopPropagation(); dismissTopAnnouncement('${top.id}', '${containerId}')" class="sh-announcement-bar-close rounded-full bg-white/15 hover:bg-white/25 shrink-0 flex items-center justify-center"><i class="fas fa-times"></i></button></div></div>`;
            state.onRender();
            if (state.timer) clearInterval(state.timer);
            state.timer = null;
            if (visible.length >= 2) {
                state.timer = setInterval(() => {
                    state.index = (state.index + 1) % visible.length;
                    renderTopbarInto(containerId, visible);
                }, getRotationMs(visible));
            }
        }

        window.renderPublicAnnouncements = () => {
            const active = getActiveAnnouncements();
            const list = document.getElementById('landing-announcement-list');
            const empty = document.getElementById('landing-announcement-empty');
            const landingActive = active.filter(a => announcementMatchesScope(a, 'landing'));
            if (list) {
                list.innerHTML = landingActive.map(a => `
                    <div class="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition overflow-hidden sh-announcement-clickable" onclick="openAnnouncementDetail('${a.id}')">
                        ${imageMarkup(a.imageUrl, 'w-full h-36 object-cover rounded-2xl mb-4 border border-slate-100')}
                        <div class="flex items-start gap-3">
                            <div class="w-11 h-11 rounded-2xl ${announcementMatchesType(a, 'popup') ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-primary'} flex items-center justify-center shrink-0"><i class="fas ${announcementMatchesType(a, 'popup') ? 'fa-window-restore' : 'fa-thumbtack'}"></i></div>
                            <div class="min-w-0">
                                <h3 class="font-black text-slate-800 mb-1 break-words">${escapeHTML(a.title)}</h3>
                                <p class="text-sm text-slate-500 leading-6 whitespace-pre-line break-words">${escapeHTML(a.message)}</p>
                            </div>
                        </div>
                    </div>`).join('');
                if (empty) empty.classList.toggle('hidden', landingActive.length > 0);
            }

            renderTopbarInto('public-announcement-topbar', landingActive.filter(a => announcementMatchesType(a, 'topbar')));
            renderTopbarInto('app-announcement-topbar', active.filter(a => announcementMatchesScope(a, 'app') && announcementMatchesType(a, 'topbar')));
            showFirstVisitPopupAnnouncement();
        };

        window.dismissTopAnnouncement = (id, containerId = 'public-announcement-topbar') => {
            const topbar = document.getElementById(containerId);
            const doClose = () => { closeAnnouncementForSession(id); renderPublicAnnouncements(); };
            if (topbar && !topbar.classList.contains('hidden')) {
                topbar.classList.add('sh-topbar-out');
                setTimeout(doClose, 260);
            } else {
                doClose();
            }
        };

        function showAnnouncementDetailModal(popup) {
            const modal = document.getElementById('public-announcement-popup');
            if (!modal || !popup) return;
            document.getElementById('public-popup-title').textContent = popup.title || 'ประกาศ';
            document.getElementById('public-popup-message').textContent = popup.message || '';
            const img = document.getElementById('public-popup-image');
            if (img) {
                if (popup.imageUrl) { img.src = popup.imageUrl; img.classList.remove('hidden'); }
                else { img.src = ''; img.classList.add('hidden'); }
            }
            const mute = document.getElementById('public-popup-mute-10d');
            if (mute) mute.checked = false;
            modal.dataset.announcementId = popup.id;
            modal.classList.remove('hidden');
            trackAnnouncementRead(popup.id);
        }

        window.openAnnouncementDetail = (id) => {
            const a = (publicAnnouncements || []).find(x => x.id === id);
            if (a) showAnnouncementDetailModal(a);
        };

        function renderPopupAnnouncement(popup) {
            if (!popup) return;
            showAnnouncementDetailModal(popup);
        }

        function showFirstVisitPopupAnnouncement() {
            const scope = currentUser ? 'app' : 'landing';
            const popups = getActiveAnnouncements().filter(a => announcementMatchesScope(a, scope) && announcementMatchesType(a, 'popup') && !isAnnouncementSessionClosed(a.id) && !isAnnouncementMuted(a.id));
            if (!popups.length) return;
            if (announcementPopupTimer) clearInterval(announcementPopupTimer);
            announcementPopupTimer = null;
            announcementPopupIndex = announcementPopupIndex % popups.length;
            renderPopupAnnouncement(popups[announcementPopupIndex]);
            if (popups.length >= 2) {
                announcementPopupTimer = setInterval(() => {
                    announcementPopupIndex = (announcementPopupIndex + 1) % popups.length;
                    renderPopupAnnouncement(popups[announcementPopupIndex]);
                }, getRotationMs(popups));
            }
        }

        window.closePublicAnnouncementPopup = () => {
            const modal = document.getElementById('public-announcement-popup');
            if (announcementPopupTimer) clearInterval(announcementPopupTimer);
            announcementPopupTimer = null;
            const id = modal.dataset.announcementId;
            const mute = document.getElementById('public-popup-mute-10d');
            if (id) {
                if (mute && mute.checked) { muteAnnouncementFor(id, 10); trackAnnouncementMute(id, 10); }
                else closeAnnouncementForSession(id);
            }
            modal.classList.add('hidden');
        };

        window.openAnnouncementStats = async (id) => {
            const modal = document.getElementById('announcement-stats-popup');
            if (!modal) return;
            const a = (publicAnnouncements || []).find(x => x.id === id);
            document.getElementById('announcement-stats-title').textContent = a ? a.title : '';
            document.getElementById('announcement-stats-list').innerHTML = '';
            document.getElementById('announcement-stats-empty').classList.add('hidden');
            document.getElementById('announcement-stats-loading').classList.remove('hidden');
            document.getElementById('announcement-stats-read-count').textContent = '0';
            document.getElementById('announcement-stats-mute-count').textContent = '0';
            modal.classList.remove('hidden');
            try {
                const qs = await withTimeout(getDocs(query(collection(db, 'announcement_reads'), where('announcementId', '==', id))), 9000, 'loadAnnouncementStats');
                const rows = [];
                let readCount = 0, muteCount = 0;
                qs.forEach(d => {
                    const x = d.data();
                    if (x.firstReadAt) readCount++;
                    if (x.muted) muteCount++;
                    rows.push(x);
                });
                rows.sort((x, y) => (y.lastReadAt || y.mutedAt || 0) - (x.lastReadAt || x.mutedAt || 0));
                document.getElementById('announcement-stats-read-count').textContent = readCount;
                document.getElementById('announcement-stats-mute-count').textContent = muteCount;
                const tbody = document.getElementById('announcement-stats-list');
                if (!rows.length) {
                    document.getElementById('announcement-stats-empty').classList.remove('hidden');
                } else {
                    tbody.innerHTML = rows.map(x => {
                        const muteExpired = x.muteUntil && x.muteUntil < Date.now();
                        return `<tr class="border-t border-slate-100">
                            <td class="py-2 font-semibold text-slate-700">${escapeHTML(x.userName || x.userKey || '-')}</td>
                            <td class="py-2 text-slate-500 whitespace-nowrap">${x.firstReadAt ? formatAdminDateTime(x.firstReadAt) : '-'}</td>
                            <td class="py-2 text-slate-500 whitespace-nowrap">${x.lastReadAt ? formatAdminDateTime(x.lastReadAt) : '-'}</td>
                            <td class="py-2 text-center text-slate-500">${x.readCount || 0}</td>
                            <td class="py-2 text-slate-500 whitespace-nowrap">${x.muted && x.muteUntil ? formatAdminDateTime(x.muteUntil) + (muteExpired ? ' <span class="text-rose-500 font-bold">(หมดอายุแล้ว)</span>' : ' <span class="text-emerald-600 font-bold">(กำลังซ่อน)</span>') : '-'}</td>
                        </tr>`;
                    }).join('');
                }
            } catch (e) {
                document.getElementById('announcement-stats-empty').textContent = 'โหลดสถิติไม่สำเร็จ: ' + getFirebaseErrorText(e);
                document.getElementById('announcement-stats-empty').classList.remove('hidden');
            }
            document.getElementById('announcement-stats-loading').classList.add('hidden');
        };

        window.closeAnnouncementStatsPopup = () => {
            document.getElementById('announcement-stats-popup')?.classList.add('hidden');
        };

        window.openLoginFromLanding = () => {
            document.getElementById('landing-view').classList.add('hidden');
            document.getElementById('auth-view').classList.remove('hidden');
            window.toggleAuthMode('login');
        };
        window.openRegisterFromLanding = () => {
            document.getElementById('landing-view').classList.add('hidden');
            document.getElementById('auth-view').classList.remove('hidden');
            window.toggleAuthMode('register');
        };

        window.backToLanding = () => {
            document.getElementById('auth-view').classList.add('hidden');
            document.getElementById('landing-view').classList.remove('hidden');
            renderPublicAnnouncements();
        };

        window.scrollToLandingAnnouncements = () => {
            document.getElementById('landing-announcements-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        function renderAdminAnnouncements() {
            const tbody = document.getElementById('admin-announcement-list');
            if (!tbody) return;
            const items = (publicAnnouncements || []).sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            if (!items.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-slate-400">ยังไม่มีประกาศ</td></tr>';
                return;
            }
            tbody.innerHTML = items.map(a => `
                <tr>
                    <td class="font-bold text-slate-700">${escapeHTML(a.title)}${a.imageUrl ? '<div class="text-xs text-indigo-500 mt-1"><i class="fas fa-image"></i> มีรูปภาพ</div>' : ''}</td>
                    <td class="text-sm text-slate-500 max-w-md whitespace-pre-line">${escapeHTML(a.message)}</td>
                    <td class="text-center"><span class="px-3 py-1 rounded-full text-xs font-bold ${a.type === 'popup' ? 'bg-amber-100 text-amber-700' : (a.type === 'both' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700')}">${a.type === 'popup' ? 'ป็อปอัพ' : (a.type === 'both' ? 'ทั้งสองแบบ' : 'แถบด้านบน')}</span></td>
                    <td class="text-center"><span class="px-3 py-1 rounded-full text-xs font-bold ${a.scope === 'app' ? 'bg-sky-100 text-sky-700' : (a.scope === 'landing' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600')}">${a.scope === 'app' ? 'หลังเข้าสู่ระบบ' : (a.scope === 'landing' ? 'หน้าหลัก' : 'ทั้งสองหน้า')}</span></td>
                    <td class="text-center text-xs text-slate-500 whitespace-nowrap"><div>เริ่ม: ${formatAdminDateTime(a.startAt)}</div><div>หยุด: ${formatAdminDateTime(a.endAt)}</div><div>สลับ: ${Number(a.rotationSeconds || 6)} วิ</div></td>
                    <td class="text-center"><span class="px-3 py-1 rounded-full text-xs font-bold ${a.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${a.active !== false ? 'เปิด' : 'ปิด'}</span></td>
                    <td class="text-right whitespace-nowrap">
                        <button onclick="editAdminAnnouncement('${a.id}')" class="bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1.5 rounded-lg text-sm font-bold"><i class="fas fa-pen"></i> แก้ไข</button>
                        <button onclick="openAnnouncementStats('${a.id}')" class="bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-1.5 rounded-lg text-sm font-bold ml-1"><i class="fas fa-chart-column"></i> สถิติ</button>
                        <button onclick="deleteAdminAnnouncement('${a.id}')" class="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1.5 rounded-lg text-sm font-bold ml-1"><i class="fas fa-trash"></i> ลบ</button>
                    </td>
                </tr>`).join('');
        }

        window.resetAdminAnnouncementForm = () => {
            const id = document.getElementById('announcement-edit-id'); if (!id) return;
            id.value = '';
            document.getElementById('announcement-title').value = '';
            document.getElementById('announcement-message').value = '';
            document.getElementById('announcement-image').value = '';
            document.getElementById('announcement-type').value = 'both';
            document.getElementById('announcement-scope').value = 'both';
            document.getElementById('announcement-start').value = '';
            document.getElementById('announcement-end').value = '';
            document.getElementById('announcement-rotation').value = '6';
            document.getElementById('announcement-active').checked = true;
            const fileInput = document.getElementById('announcement-image-file'); if (fileInput) fileInput.value = '';
            const status = document.getElementById('announcement-image-upload-status'); if (status) status.textContent = '';
            document.getElementById('announcement-image-preview')?.classList.add('hidden');
            window.setAnnouncementImageMode('upload');
        };

        // FIX: สลับโหมด "ใส่ลิงก์" / "อัปโหลดรูป" สำหรับรูปภาพประกาศ
        window.setAnnouncementImageMode = (mode) => {
            const isUpload = mode === 'upload';
            document.getElementById('announcement-image').classList.toggle('hidden', isUpload);
            document.getElementById('announcement-image-upload-wrap').classList.toggle('hidden', !isUpload);
            const linkBtn = document.getElementById('announcement-image-mode-link-btn');
            const uploadBtn = document.getElementById('announcement-image-mode-upload-btn');
            linkBtn.className = 'flex-1 text-xs font-bold py-1.5 rounded-lg ' + (isUpload ? 'bg-slate-100 text-slate-600' : 'bg-primary text-white');
            uploadBtn.className = 'flex-1 text-xs font-bold py-1.5 rounded-lg ' + (isUpload ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600');
        };

        // FIX: บีบอัดรูปประกาศก่อนเก็บเป็น data URL — ประกาศทุกอันถูกเก็บรวมกันใน document เดียว
        // (Firestore จำกัดขนาด document ที่ ~1MB) จึงต้องบีบให้เล็กพอจะใส่ได้หลายอันพร้อมกัน
        // แต่ยังคงความคมชัดไว้ให้มากที่สุดโดยพยายามคงคุณภาพ/ขนาดสูงสุดก่อน แล้วค่อยลดถ้าจำเป็น
        async function compressAnnouncementImage(file){
            const MAX_BYTES = 380000; // เผื่อให้มีประกาศพร้อมรูปได้หลายอันในเอกสารเดียวกัน
            const rawDataUrl = await readFileAsDataURL(file);
            if(dataUrlByteLength(rawDataUrl) <= MAX_BYTES) return rawDataUrl;
            return new Promise((resolve,reject)=>{
                const img = new Image();
                img.onload = () => {
                    try{
                        let maxSide = 1600; // เริ่มจากขนาดใหญ่คมชัดก่อน ค่อยลดถ้ายังใหญ่เกิน
                        let quality = 0.9;
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d', { alpha:false });
                        let result = rawDataUrl;
                        for(let round=0; round<14; round++){
                            const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
                            canvas.width = Math.max(1, Math.round(img.width * ratio));
                            canvas.height = Math.max(1, Math.round(img.height * ratio));
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0,0,canvas.width,canvas.height);
                            ctx.drawImage(img,0,0,canvas.width,canvas.height);
                            result = canvas.toDataURL('image/jpeg', quality);
                            if(dataUrlByteLength(result) <= MAX_BYTES) break;
                            quality = Math.max(0.5, quality - 0.07);
                            maxSide = Math.max(640, Math.floor(maxSide * 0.85));
                        }
                        resolve(result);
                    }catch(e){ reject(e); }
                };
                img.onerror = () => reject(new Error('บีบอัดรูปไม่ได้ กรุณาเลือกรูปใหม่'));
                img.src = rawDataUrl;
            });
        }

        window.handleAnnouncementImageFile = async (input) => {
            const file = input.files && input.files[0];
            const status = document.getElementById('announcement-image-upload-status');
            const preview = document.getElementById('announcement-image-preview');
            if (!file) return;
            if (status) status.textContent = 'กำลังบีบอัดรูป...';
            try {
                const compressed = await compressAnnouncementImage(file);
                document.getElementById('announcement-image').value = compressed;
                if (preview) { preview.src = compressed; preview.classList.remove('hidden'); }
                if (status) status.textContent = 'พร้อมใช้งาน (' + Math.round(dataUrlByteLength(compressed)/1024) + ' KB)';
            } catch (e) {
                if (status) status.textContent = 'บีบอัดรูปไม่สำเร็จ: ' + (e?.message || e);
            }
        };

        window.editAdminAnnouncement = (id) => {
            const a = (publicAnnouncements || []).find(x => x.id === id); if (!a) return;
            document.getElementById('announcement-edit-id').value = a.id;
            document.getElementById('announcement-title').value = a.title || '';
            document.getElementById('announcement-message').value = a.message || '';
            document.getElementById('announcement-image').value = a.imageUrl || '';
            document.getElementById('announcement-type').value = a.type || 'topbar';
            document.getElementById('announcement-scope').value = a.scope || 'both';
            document.getElementById('announcement-start').value = a.startAt || '';
            document.getElementById('announcement-end').value = a.endAt || '';
            document.getElementById('announcement-rotation').value = Number(a.rotationSeconds || 6);
            document.getElementById('announcement-active').checked = a.active !== false;
            window.setAnnouncementImageMode((a.imageUrl||'').startsWith('data:') ? 'upload' : 'link');
            const preview = document.getElementById('announcement-image-preview');
            if (a.imageUrl) { preview.src = a.imageUrl; preview.classList.remove('hidden'); } else { preview.classList.add('hidden'); }
            document.getElementById('announcement-title').focus();
        };

        window.saveAdminAnnouncementForm = async () => {
            if (!isAdmin) return showCustomAlert('ไม่มีสิทธิ์', 'เฉพาะแอดมินเท่านั้น', true);
            const editId = document.getElementById('announcement-edit-id').value;
            const startAt = document.getElementById('announcement-start').value;
            const endAt = document.getElementById('announcement-end').value;
            if (startAt && endAt && new Date(startAt).getTime() > new Date(endAt).getTime()) {
                return showCustomAlert('ช่วงเวลาไม่ถูกต้อง', 'เวลาเริ่มแสดงต้องไม่เกินเวลาหยุดแสดง', true);
            }
            const item = {
                id: editId || `ann_${Date.now()}`,
                title: document.getElementById('announcement-title').value.trim(),
                message: document.getElementById('announcement-message').value.trim(),
                imageUrl: document.getElementById('announcement-image').value.trim(),
                type: document.getElementById('announcement-type').value,
                scope: document.getElementById('announcement-scope').value,
                startAt,
                endAt,
                rotationSeconds: Math.max(2, Number(document.getElementById('announcement-rotation').value || 6)),
                active: document.getElementById('announcement-active').checked,
                updatedAt: Date.now()
            };
            if (!item.title || !item.message) return showCustomAlert('ข้อมูลไม่ครบ', 'กรุณากรอกหัวข้อและข้อความประกาศ', true);
            const next = (publicAnnouncements || []).filter(a => a.id !== item.id);
            next.push(item); publicAnnouncements = next;
            writeLocalJSON(ANNOUNCEMENT_CACHE_KEY, publicAnnouncements);
            toggleLoader(true);
            try {
                await setDoc(getAnnouncementDocRef(), { items: publicAnnouncements, updatedAt: Date.now() }, { merge: true });
                resetAdminAnnouncementForm(); renderAdminAnnouncements(); renderPublicAnnouncements();
                showCustomAlert('บันทึกแล้ว', 'ประกาศถูกบันทึกขึ้น Firebase เรียบร้อย');
            } catch (e) {
                resetAdminAnnouncementForm(); renderAdminAnnouncements(); renderPublicAnnouncements();
                showCustomAlert('บันทึกในเครื่องแล้ว', 'แต่ยังบันทึกขึ้น Firebase ไม่ได้: ' + getFirebaseErrorText(e), true);
            }
            toggleLoader(false);
        };

        window.deleteAdminAnnouncement = (id) => {
            window.showCustomConfirm('ลบประกาศ', 'ต้องการลบประกาศนี้หรือไม่?', async () => {
                publicAnnouncements = (publicAnnouncements || []).filter(a => a.id !== id);
                toggleLoader(true);
                writeLocalJSON(ANNOUNCEMENT_CACHE_KEY, publicAnnouncements);
                try { await setDoc(getAnnouncementDocRef(), { items: publicAnnouncements, updatedAt: Date.now() }, { merge: true }); renderAdminAnnouncements(); renderPublicAnnouncements(); }
                catch(e) { renderAdminAnnouncements(); renderPublicAnnouncements(); showCustomAlert('ลบในเครื่องแล้ว', 'แต่ยังลบจาก Firebase ไม่ได้: ' + getFirebaseErrorText(e), true); }
                toggleLoader(false);
            });
        };

        // --- Subscription Plans ---
        function getDefaultPlans(){return [{id:'free',name:'ฟรี',price:'0 บาท',desc:'เหมาะสำหรับทดลองใช้งาน เริ่มต้นแบบลดแล้วใช้ฟรี',features:['สร้างรายวิชาเบื้องต้น','เช็คชื่อและบันทึกคะแนน','ดูภาพรวมคะแนน'],order:1,featured:false,active:true,updatedAt:Date.now()},{id:'standard',name:'มาตรฐาน',price:'199 บาท/เดือน',desc:'เหมาะสำหรับครูที่ใช้งานจริงทุกสัปดาห์',features:['เพิ่มรายวิชาได้มากขึ้น','ส่งออก Excel','แชร์ข้อมูลให้นักเรียนแบบจำกัดเวลา'],order:2,featured:true,active:true,updatedAt:Date.now()},{id:'school',name:'สถานศึกษา',price:'ติดต่อแอดมิน',desc:'เหมาะสำหรับใช้ทั้งแผนกหรือทั้งโรงเรียน',features:['จัดการผู้ใช้หลายคน','ประกาศหน้าแรก','ตั้งค่าสิทธิ์และแผนได้ครบ'],order:3,featured:false,active:true,updatedAt:Date.now()}];}
        async function loadPublicPlans(){subscriptionPlans=readLocalJSON(PLANS_CACHE_KEY,getDefaultPlans());renderLandingPlans();if(isAdmin)renderAdminPlans();try{const snap=await withTimeout(getDoc(getPlansDocRef()),7000,'loadPlans');subscriptionPlans=(snap.exists()&&Array.isArray(snap.data().items)&&snap.data().items.length)?snap.data().items:subscriptionPlans;writeLocalJSON(PLANS_CACHE_KEY,subscriptionPlans);}catch(e){console.warn('loadPublicPlans failed:',e);}renderLandingPlans();if(isAdmin)renderAdminPlans();}
        function renderLandingPlans(){const box=document.getElementById('landing-plan-list');if(!box)return;const items=(subscriptionPlans||getDefaultPlans()).filter(p=>p.active!==false).sort((a,b)=>Number(a.order||0)-Number(b.order||0));box.innerHTML=items.map(p=>`<div class="pricing-card ${p.featured?'featured':''} rounded-[2rem] p-6 relative overflow-hidden">${p.featured?'<div class="absolute top-4 right-4 bg-primary text-white text-xs font-black px-3 py-1 rounded-full">แนะนำ</div>':''}<h3 class="text-2xl font-black text-slate-900 mb-1">${escapeHTML(p.name||'')}</h3><p class="text-sm text-slate-500 min-h-[42px]">${escapeHTML(p.desc||'')}</p><div class="my-5"><span class="text-3xl font-black text-primary">${escapeHTML(p.price||'')}</span></div><ul class="space-y-3 mb-6">${(p.features||[]).map(f=>`<li class="flex gap-2 text-sm text-slate-600"><i class="fas fa-check text-emerald-500 mt-1"></i><span>${escapeHTML(f)}</span></li>`).join('')}</ul><button onclick="requestSubscriptionPlan('${p.id}')" class="w-full ${p.featured?'bg-primary text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200':'bg-slate-100 text-slate-700 hover:bg-slate-200'} rounded-2xl py-3 font-bold transition"><i class="fas fa-paper-plane mr-1"></i> สมัครแผนนี้</button></div>`).join('');}

        function renderUserPlans(){
            const box=document.getElementById('user-plan-list');
            if(!box) return;
            const items=(subscriptionPlans||getDefaultPlans()).filter(p=>p.active!==false).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
            // ดึงข้อมูลจริงจาก directory ที่ sync มาจาก Firebase
            const dirUser = (window.__currentUserDir) || {};
            const currentPlanId = dirUser.planId || '';
            const currentPlanName = dirUser.planName || '';
            const currentPlanPrice = dirUser.planPrice || '';
            const pendingPlanName = dirUser.requestedPlanName || '';
            const userStatus = dirUser.status || '';
            const currentBox=document.getElementById('user-current-plan-box');
            if(currentBox){
                const currentPlan = items.find(p => String(p.id || '') === String(currentPlanId || '')) || null;
                const planForCard = currentPlan || { name: pendingPlanName || currentPlanName || 'ไม่มีแผน', price: pendingPlanName ? 'คำขออยู่ระหว่างรอตรวจสอบ' : currentPlanPrice, courseLimit: dirUser.courseLimit };
                currentBox.innerHTML = window.renderCurrentPlanCardHTML ? window.renderCurrentPlanCardHTML(planForCard, dirUser) : '';
            }
            const hasPending = !!pendingPlanName;
            box.innerHTML=items.map(p=>{
                const active = p.id===currentPlanId && !!currentPlanId;
                let btnHtml = '';
                if(hasPending && !active){
                    btnHtml = `<button onclick="showCustomAlert('มีคำขออยู่แล้ว','คุณมีคำขอสมัครแผน &quot;${escapeHTML(pendingPlanName)}&quot; ที่รอตรวจสอบอยู่ กรุณารอให้แอดมินดำเนินการก่อนจึงจะส่งคำขอใหม่ได้',true)" class="w-full bg-amber-100 text-amber-700 rounded-2xl py-3 font-bold cursor-not-allowed"><i class="fas fa-hourglass-half mr-1"></i> มีคำขอรออนุมัติอยู่แล้ว</button>`;
                } else if(active){
                    btnHtml = `<button onclick="requestSubscriptionPlan('${p.id}')" class="w-full bg-emerald-100 text-emerald-700 rounded-2xl py-3 font-bold transition"><i class="fas fa-paper-plane mr-1"></i> ขอต่ออายุ</button>`;
                } else {
                    btnHtml = `<button onclick="requestSubscriptionPlan('${p.id}')" class="w-full bg-primary text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 rounded-2xl py-3 font-bold transition"><i class="fas fa-paper-plane mr-1"></i> เลือกแผนนี้</button>`;
                }
                return `<div class="pricing-card ${p.featured?'featured':''} ${active?'ring-2 ring-emerald-400':''} rounded-[2rem] p-6 relative overflow-hidden bg-white">
                    ${p.featured?'<div class="absolute top-4 right-4 bg-primary text-white text-xs font-black px-3 py-1 rounded-full">แนะนำ</div>':''}
                    ${active?'<div class="absolute top-4 left-4 bg-emerald-500 text-white text-xs font-black px-3 py-1 rounded-full">ใช้อยู่</div>':''}
                    <h3 class="text-2xl font-black text-slate-900 mb-1 mt-6">${escapeHTML(p.name||'')}</h3>
                    <p class="text-sm text-slate-500 min-h-[42px]">${escapeHTML(p.desc||'')}</p>
                    <div class="my-5"><span class="text-3xl font-black text-primary">${escapeHTML(p.price||'')}</span></div>
                    <ul class="space-y-3 mb-6">${(p.features||[]).map(f=>`<li class="flex gap-2 text-sm text-slate-600"><i class="fas fa-check text-emerald-500 mt-1"></i><span>${escapeHTML(f)}</span></li>`).join('')}</ul>
                    ${btnHtml}
                </div>`;
            }).join('');
        }

        function planRequestStatusText(status, autoApproved){
            const s = String(status || 'pending').toLowerCase();
            if(s === 'approved') return autoApproved ? ['อนุมัติอัตโนมัติ','emerald','fa-circle-check'] : ['อนุมัติแล้ว','emerald','fa-circle-check'];
            if(s === 'rejected' || s === 'denied') return ['ไม่อนุมัติ','rose','fa-circle-xmark'];
            if(s === 'cancelled' || s === 'canceled') return ['ยกเลิกแล้ว','slate','fa-ban'];
            return ['รอตรวจสอบ','amber','fa-hourglass-half'];
        }
        function formatSchoolHubDateTime(value){
            if(!value) return '-';
            let d;
            if(typeof value === 'number') d = new Date(value);
            else if(value && typeof value.toDate === 'function') d = value.toDate();
            else d = new Date(value);
            if(!d || Number.isNaN(d.getTime())) return '-';
            return d.toLocaleString('th-TH', { dateStyle:'medium', timeStyle:'short' });
        }
        window.loadUserPaymentHistory = async (showToast=false) => {
            const box = document.getElementById('user-payment-history-list');
            if(!box) return;
            if(!currentUser || currentUser.uid === 'admin-bypass'){
                box.innerHTML = `<div class="text-center text-slate-400 py-6"><i class="fas fa-user-lock text-2xl mb-2 block"></i>กรุณาเข้าสู่ระบบผู้ใช้ก่อนดูประวัติ</div>`;
                return;
            }
            box.innerHTML = `<div class="text-center text-slate-400 py-6"><i class="fas fa-spinner fa-spin mr-1"></i> กำลังโหลดประวัติ...</div>`;
            try{
                const userKey = getUserKey(currentUser);
                const snap = await withTimeout(getDocs(collection(db,'subscription_requests')), 9000, 'loadPaymentHistory');
                const rows = snap.docs.map(d => ({ id:d.id, ...(d.data()||{}) }))
                    .filter(r => String(r.userKey||'').toLowerCase() === userKey || String(r.email||'').toLowerCase() === userKey || String(r.uid||'') === String(currentUser.uid||''))
                    .sort((a,b) => Number(b.createdAt||b.updatedAt||0) - Number(a.createdAt||a.updatedAt||0));
                if(!rows.length){
                    box.innerHTML = `<div class="text-center text-slate-400 py-8"><i class="fas fa-receipt text-4xl text-slate-200 mb-3 block"></i>ยังไม่มีประวัติการชำระเงินหรือคำขอแผน</div>`;
                    return;
                }
                box.innerHTML = rows.map(r => {
                    const [label,color,icon] = planRequestStatusText(r.status, r.autoApproved);
                    const amount = r.planAmount || extractPlanAmount(r.planPrice || '');
                    const paid = r.paymentTime || r.paidAt || '';
                    const ref = r.paymentReference || r.slipReference || '-';
                    const reason = r.rejectReason || r.rejectedReason || r.reason || '';
                    return `<div class="rounded-2xl border border-${color}-100 bg-${color}-50/45 p-4">
                        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div class="min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-${color}-100 text-${color}-700"><i class="fas ${icon}"></i> ${label}</span>
                                    ${r.autoApproved ? '<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700"><i class="fas fa-bolt"></i> Auto</span>' : ''}
                                </div>
                                <div class="mt-2 text-lg font-black text-slate-900">${escapeHTML(r.planName || '-')}</div>
                                <div class="mt-1 text-sm text-slate-600 leading-7">
                                    ยอดชำระ: <b>${amount ? Number(amount).toLocaleString('th-TH') + ' บาท' : escapeHTML(r.planPrice || '-')}</b><br>
                                    ผู้ชำระ: <b>${escapeHTML(r.payerName || r.name || '-')}</b><br>
                                    เวลาที่แจ้งชำระ: <b>${escapeHTML(paid || '-')}</b><br>
                                    เลขอ้างอิง: <b>${escapeHTML(ref)}</b>
                                </div>
                                ${reason ? `<div class="mt-2 text-sm text-rose-700 bg-white/70 border border-rose-100 rounded-xl p-3"><b>เหตุผล:</b> ${escapeHTML(reason)}</div>` : ''}
                            </div>
                            <div class="text-xs text-slate-500 md:text-right shrink-0 leading-6">
                                ส่งคำขอ: <b>${formatSchoolHubDateTime(r.createdAt)}</b><br>
                                อัปเดตล่าสุด: <b>${formatSchoolHubDateTime(r.updatedAt || r.approvedAt || r.rejectedAt)}</b>
                            </div>
                        </div>
                    </div>`;
                }).join('');
                if(showToast) showCustomAlert('โหลดประวัติแล้ว','อัปเดตประวัติการชำระเงินล่าสุดเรียบร้อย');
            }catch(e){
                box.innerHTML = `<div class="text-center text-rose-500 py-6"><i class="fas fa-triangle-exclamation mr-1"></i> โหลดประวัติไม่ได้: ${escapeHTML(getFirebaseErrorText(e))}</div>`;
            }
        };
        /* Legacy openUserPlanSelector removed by stable canonical plan selector. */

        function extractPlanAmount(priceText){
            const s=String(priceText||'').replace(/,/g,'');
            const m=s.match(/(\d+(?:\.\d+)?)/);
            return m ? Number(m[1]) : 0;
        }
        function cleanPromptPayId(value){
            return String(value||'').replace(/[^0-9]/g,'');
        }
        function getPromptPayQRUrl(promptpayId, amount){
            const id=cleanPromptPayId(promptpayId);
            if(!id) return '';
            const amt=Number(amount||0);
            return amt>0 ? `https://promptpay.io/${id}/${amt.toFixed(2)}` : `https://promptpay.io/${id}`;
        }
        function setNowToPaymentTime(){
            const input=document.getElementById('payment-paid-at');
            if(!input) return;
            const d=new Date();
            d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
            input.value=d.toISOString().slice(0,16);
        }
        function readFileAsDataURL(file){
            return new Promise((resolve,reject)=>{
                const reader=new FileReader();
                reader.onload=()=>resolve(reader.result);
                reader.onerror=()=>reject(reader.error||new Error('อ่านไฟล์ไม่ได้'));
                reader.readAsDataURL(file);
            });
        }

        // Firestore เก็บ field ได้ไม่เกินประมาณ 1MB ต่อค่า
        // จึงต้องย่อ/บีบอัดสลิปก่อนบันทึกลง subscription_requests
        function dataUrlByteLength(dataUrl){
            try{ return Math.ceil(String(dataUrl||'').length * 0.75); }catch(e){ return 999999999; }
        }
        async function compressSlipForFirestore(file){
            const MAX_BYTES = 760000; // เผื่อพื้นที่ให้ field อื่น ๆ ใน document
            const rawDataUrl = await readFileAsDataURL(file);
            if(dataUrlByteLength(rawDataUrl) <= MAX_BYTES) return rawDataUrl;

            return new Promise((resolve,reject)=>{
                const img = new Image();
                img.onload = () => {
                    try{
                        let maxSide = 1400;
                        let quality = 0.82;
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d', { alpha:false });
                        let result = rawDataUrl;

                        for(let round=0; round<12; round++){
                            const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
                            canvas.width = Math.max(1, Math.round(img.width * ratio));
                            canvas.height = Math.max(1, Math.round(img.height * ratio));
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0,0,canvas.width,canvas.height);
                            ctx.drawImage(img,0,0,canvas.width,canvas.height);
                            result = canvas.toDataURL('image/jpeg', quality);
                            if(dataUrlByteLength(result) <= MAX_BYTES) break;
                            quality = Math.max(0.45, quality - 0.08);
                            maxSide = Math.max(720, Math.floor(maxSide * 0.84));
                        }
                        resolve(result);
                    }catch(e){ reject(e); }
                };
                img.onerror = () => reject(new Error('บีบอัดรูปสลิปไม่ได้ กรุณาเลือกรูปใหม่'));
                img.src = rawDataUrl;
            });
        }
        window.closePlanPaymentModal=()=>{
            document.getElementById('plan-payment-modal')?.classList.add('hidden');
            // clear QR canvas on close
            const canvas = document.getElementById('payment-qr-canvas');
            if (canvas) canvas.innerHTML = '';
        };

        // --- PromptPay QR payload generator (EMVCo) ---
        function _ppTag(id, value){ const s=String(value); return id+String(s.length).padStart(2,'0')+s; }
        function _ppCRC16(str){ let c=0xFFFF; for(let i=0;i<str.length;i++){c^=str.charCodeAt(i)<<8;for(let j=0;j<8;j++)c=(c&0x8000)?(c<<1)^0x1021:c<<1;c&=0xFFFF;} return c.toString(16).toUpperCase().padStart(4,'0'); }
        function _ppFormatId(raw){ const d=String(raw).replace(/\D/g,''); if(d.length===10&&d.startsWith('0'))return '0066'+d.substring(1); return d; }
        function buildPromptPayPayload(ppId, amount){
            const target=_ppFormatId(ppId);
            const merchant=_ppTag('00','A000000677010111')+_ppTag('01',target);
            const base=[_ppTag('00','01'),_ppTag('01','11'),_ppTag('29',merchant),_ppTag('53','764'),_ppTag('54',Number(amount).toFixed(2)),_ppTag('58','TH'),'6304'].join('');
            return base+_ppCRC16(base);
        }

        // ตัวแปรและกติกาตรวจสลิปอัตโนมัติ
        // ปรับค่าได้: ยอดเงินคลาดเคลื่อนได้ 0.01 บาท, เวลาคลาดเคลื่อนได้ 30 นาที, ชื่อใกล้เคียงขั้นต่ำ 45%
        let currentSlipVerification = null;
        const PAYMENT_AUTO_APPROVE_RULES = {
            amountTolerance: 0.01,
            timeToleranceMinutes: 30,
            minNameSimilarity: 0.45
        };

        // --- Strict slip verification before automatic approval ---
        function normalizeThaiTextForMatch(value){
            return String(value||'')
                .toLowerCase()
                .replace(/[^\u0E00-\u0E7Fa-z0-9]/g,'')
                .replace(/นาย|นางสาว|นาง|ดร|คุณ/g,'')
                .trim();
        }
        function levenshteinDistance(a,b){
            a=String(a||''); b=String(b||'');
            const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
            for(let i=0;i<=a.length;i++) dp[i][0]=i;
            for(let j=0;j<=b.length;j++) dp[0][j]=j;
            for(let i=1;i<=a.length;i++){
                for(let j=1;j<=b.length;j++){
                    dp[i][j]=Math.min(
                        dp[i-1][j]+1,
                        dp[i][j-1]+1,
                        dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1)
                    );
                }
            }
            return dp[a.length][b.length];
        }
        function similarityScore(a,b){
            const x=normalizeThaiTextForMatch(a);
            const y=normalizeThaiTextForMatch(b);
            if(!x || !y) return 0;
            // 1. Exact or partial inclusion (Smart match for "ปฏิภาณ บ" vs "ปฏิภาณ บำเรอจิต")
            if(x.includes(y) || y.includes(x)) return 1;
            
            // 2. Check for name prefix match (Common in slips like "Pattipan B.")
            // If at least 5 chars match at start, it's very likely the same person
            if(x.length >= 5 && y.length >= 5){
                const shortLen = Math.min(x.length, y.length);
                const prefixMatch = x.substring(0, shortLen) === y.substring(0, shortLen);
                if(prefixMatch) return 1;
                
                // Case: "ปฏิภาณ บ" vs "ปฏิภาณ บำเรอจิต" -> normalize might strip spaces
                // If the first name is fully matched and followed by a single char (initial)
                const firstNameMatch = x.substring(0, 4) === y.substring(0, 4); // Basic Thai first name check
                if(firstNameMatch && (x.length < 8 || y.length < 8)) return 0.95;
            }

            const maxLen=Math.max(x.length,y.length);
            return maxLen ? 1-(levenshteinDistance(x,y)/maxLen) : 0;
        }
        function extractSlipAmount(ocrText){
            const text=String(ocrText||'').replace(/,/g,'');
            const amountPatterns=[
                /(?:จำนวนเงิน|ยอดเงิน|ยอดชำระ|amount|total)[^\d]{0,20}(\d+(?:\.\d{1,2})?)/i,
                /(\d+(?:\.\d{2}))\s*(?:บาท|THB|฿)/i,
                /฿\s*(\d+(?:\.\d{1,2})?)/i
            ];
            const values=[];
            amountPatterns.forEach(re=>{
                let m;
                const g=new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g');
                while((m=g.exec(text))!==null){
                    const n=Number(m[1]);
                    if(Number.isFinite(n) && n>0 && n<1000000) values.push(n);
                }
            });
            return values.length ? values[0] : null;
        }
        function extractSlipReference(ocrText){
            // Normalizing text: MAKE by KBank uses 'o' instead of '0' or mixed case in ref
            const text=String(ocrText||'').replace(/\s+/g,' ');
            const patterns=[
                // Specific for MAKE by KBank style: 0461895o8vj144vqohmk (alphanumeric, lowercase/mixed)
                /(?:เลขที่รายการ|เลขอ้างอิง|รหัสรายการ|ref\.?|transaction\s*id)[^\w\d]{0,12}([a-z0-9]{15,32})/i,
                /(?:เลขที่รายการ|เลขอ้างอิง|หมายเลขอ้างอิง|เลขที่อ้างอิง|reference|ref\.?|transaction\s*id|รหัสรายการ)[^\w\d]{0,12}([A-Z0-9]{10,32})/i,
                /\b([0-9]{12,32})\b/g,
                /\b([A-Z0-9]{16,32})\b/g,
                // Fallback for long alphanumeric strings that look like references
                /\b([a-z0-9]{18,32})\b/gi
            ];
            for(const re of patterns){
                const g=new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g');
                let m;
                while((m=g.exec(text))!==null){
                    // Keep alphanumeric for MAKE by KBank
                    const ref=String(m[1]||'').replace(/[^A-Za-z0-9]/gi,'');
                    if(ref.length>=10) return ref.toUpperCase(); // Normalize to upper for duplicate check
                }
            }
            return '';
        }
        function parseSlipDateTime(ocrText, userPaidAt){
            const text=String(ocrText||'').replace(/\s+/g,' ');
            const currentYear=new Date().getFullYear();
            const monthMap={
                'ม.ค.':1,'มกราคม':1,'ก.พ.':2,'กุมภาพันธ์':2,'มี.ค.':3,'มีนาคม':3,'เม.ย.':4,'เมษายน':4,
                'พ.ค.':5,'พฤษภาคม':5,'มิ.ย.':6,'มิถุนายน':6,'ก.ค.':7,'กรกฎาคม':7,'ส.ค.':8,'สิงหาคม':8,
                'ก.ย.':9,'กันยายน':9,'ต.ค.':10,'ตุลาคม':10,'พ.ย.':11,'พฤศจิกายน':11,'ธ.ค.':12,'ธันวาคม':12
            };
            let timeMatch=text.match(/(\d{1,2})[:.](\d{2})(?::(\d{2}))?/);
            const time = timeMatch ? {h:Number(timeMatch[1]), m:Number(timeMatch[2]), s:Number(timeMatch[3]||0)} : null;
            let dateObj=null;
            const numeric=text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
            if(numeric){
                let d=Number(numeric[1]), mo=Number(numeric[2]), y=Number(numeric[3]);
                if(y<100) y+=2500;
                if(y>2400) y-=543;
                dateObj=new Date(y,mo-1,d,time?.h||0,time?.m||0,time?.s||0);
            }else{
                const thRe=new RegExp('(\\d{1,2})\\s*('+Object.keys(monthMap).join('|')+')\\s*(\\d{2,4})?');
                const th=text.match(thRe);
                if(th){
                    let y=th[3]?Number(th[3]):currentYear;
                    if(y<100) y+=2500;
                    if(y>2400) y-=543;
                    dateObj=new Date(y,monthMap[th[2]]-1,Number(th[1]),time?.h||0,time?.m||0,time?.s||0);
                }
            }
            if(!dateObj && time && userPaidAt){
                const base=new Date(userPaidAt);
                dateObj=new Date(base.getFullYear(),base.getMonth(),base.getDate(),time.h,time.m,time.s||0);
            }
            return dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj : null;
        }
        function looksLikeBankSlip(ocrText){
            const t=String(ocrText||'').toLowerCase();
            const keywords=['โอนเงิน','โอนสำเร็จ','รายการสำเร็จ','สำเร็จ','สลิป','เลขที่รายการ','เลขอ้างอิง','พร้อมเพย์','promptpay','prompt pay','scb','kbank','krungthai','กรุงไทย','กสิกร','ไทยพาณิชย์','ธนาคาร','บาท','amount','transaction','reference'];
            const hit=keywords.filter(k=>t.includes(k.toLowerCase())).length;
            return hit>=2;
        }
        function setSlipCheckProgress(percent,label){
            const wrap=document.getElementById('payment-slip-progress-wrap');
            const bar=document.getElementById('payment-slip-progress-bar');
            const pct=document.getElementById('payment-slip-progress-percent');
            const lab=document.getElementById('payment-slip-progress-label');
            const safe=Math.max(0,Math.min(100,Number(percent)||0));
            if(wrap) wrap.classList.remove('hidden');
            if(bar){
                bar.style.width=safe+'%';
                bar.className='h-full rounded-full transition-all duration-300 '+(safe>=100?'bg-emerald-500':'bg-amber-400');
            }
            if(pct) pct.textContent=safe+'%';
            if(lab && label) lab.textContent=label;
        }
        let __slipCheckPopupActive = false;
        let __slipDecisionResolver = null;
        function getSlipResultPopupParts(){
            return {
                popup: document.getElementById('slip-result-popup'),
                body: document.getElementById('slip-result-popup-body'),
                title: document.querySelector('#slip-result-popup h3'),
                footer: document.querySelector('#slip-result-popup .p-4.border-t'),
                closeBtn: document.querySelector('#slip-result-popup .p-5 button'),
                leftBtn: document.querySelector('#slip-result-popup .p-4.border-t button:first-child'),
                rightBtn: document.getElementById('slip-result-confirm-btn')
            };
        }
        function bringSlipResultPopupToFront(){
            const parts=getSlipResultPopupParts();
            if(!parts.popup) return;
            // ย้ายไปท้าย body ทุกครั้ง เพื่อให้เป็น modal ชั้นบนสุดจริง ๆ ไม่โดน plan-payment-modal / alert / calendar บัง
            if(parts.popup.parentElement !== document.body || document.body.lastElementChild !== parts.popup){
                document.body.appendChild(parts.popup);
            }
            parts.popup.style.position='fixed';
            parts.popup.style.inset='0';
            parts.popup.style.zIndex='2147483647';
            parts.popup.style.pointerEvents='auto';
            parts.popup.style.isolation='isolate';
            // ลดชั้น modal อื่นเฉพาะตอนตรวจสลิป เพื่อให้ลำดับชัดเจน
            ['plan-payment-modal','custom-alert','custom-confirm','user-profile-modal','admin-plan-request-popup','public-announcement-popup','course-modal','student-edit-modal','grade-criteria-modal','multi-student-modal','share-student-modal'].forEach(id=>{
                const el=document.getElementById(id);
                if(el && el!==parts.popup && !el.classList.contains('hidden')) el.style.zIndex='900000';
            });
        }
        function openSlipCheckPopup(mode='checking'){
            const parts=getSlipResultPopupParts();
            const box=document.getElementById('payment-slip-check-box');
            if(!parts.popup||!parts.body||!box) return;
            __slipCheckPopupActive = true;
            parts.popup.classList.remove('hidden');
            bringSlipResultPopupToFront();
            parts.body.innerHTML = '';
            parts.body.appendChild(box);
            box.classList.remove('hidden');
            if(parts.title) parts.title.innerHTML = '<i class="fas fa-shield-halved text-primary mr-2"></i>ระบบตรวจสลิป';
            if(parts.closeBtn) parts.closeBtn.classList.add('hidden');
            if(parts.footer) parts.footer.classList.add('hidden');
            setTimeout(bringSlipResultPopupToFront,0);
            setTimeout(bringSlipResultPopupToFront,80);
        }
        function closeSlipCheckPopup(){
            const parts=getSlipResultPopupParts();
            if(parts.popup) parts.popup.classList.add('hidden');
            __slipCheckPopupActive = false;
            __slipDecisionResolver = null;
        }
        function setSlipPopupButtons({leftText='', rightText='ตกลง', rightClass='bg-primary hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200', onRight=null, onLeft=null, showLeft=false}={}){
            bringSlipResultPopupToFront();
            const parts=getSlipResultPopupParts();
            if(!parts.footer||!parts.rightBtn||!parts.leftBtn) return;
            parts.footer.classList.remove('hidden');
            parts.leftBtn.className='flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl';
            parts.leftBtn.textContent=leftText||'ยกเลิก';
            parts.leftBtn.classList.toggle('hidden', !showLeft);
            parts.leftBtn.onclick=()=>{ if(onLeft) onLeft(); };
            parts.rightBtn.className='flex-1 font-bold py-3 rounded-2xl '+rightClass;
            parts.rightBtn.textContent=rightText||'ตกลง';
            parts.rightBtn.onclick=()=>{ if(onRight) onRight(); };
        }
        function waitSlipReviewDecision(verification){
            return new Promise(resolve=>{
                __slipDecisionResolver = resolve;
                if(verification?.autoApproved){
                    setSlipPopupButtons({
                        rightText:'ตกลง เพื่อยืนยันและเปิดใช้งาน',
                        rightClass:'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200',
                        onRight:()=>resolve('approve')
                    });
                }else{
                    setSlipPopupButtons({
                        rightText:'ส่งตรวจสอบ',
                        rightClass:'bg-primary hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200',
                        onRight:()=>resolve('pending')
                    });
                }
            });
        }
        function showSlipFinalMessage(status,title,message){
            return new Promise(resolve=>{
                const icon=status==='pass'?'fa-circle-check text-emerald-500':status==='fail'?'fa-clock text-amber-500':'fa-circle-info text-primary';
                setSlipCheckBox(status==='pass'?'pass':status==='fail'?'fail':'idle', title, message, {}, []);
                const parts=getSlipResultPopupParts();
                if(parts.title) parts.title.innerHTML = `<i class="fas ${icon} mr-2"></i>${escapeHTML(title||'แจ้งเตือน')}`;
                setSlipPopupButtons({
                    rightText:'ตกลง',
                    rightClass:'bg-primary hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200',
                    onRight:()=>{ closeSlipCheckPopup(); resolve(); }
                });
            });
        }
        function setSlipCheckSteps(steps){
            const el=document.getElementById('payment-slip-check-steps');
            if(!el) return;
            if(!steps || !steps.length){ el.classList.add('hidden'); el.innerHTML=''; return; }
            el.classList.remove('hidden');
            el.innerHTML=steps.map(step=>{
                const ok=step.status==='pass';
                const fail=step.status==='fail';
                const checking=step.status==='checking';
                const cls=ok?'text-emerald-700 bg-emerald-50 border-emerald-100':fail?'text-rose-700 bg-rose-50 border-rose-100':checking?'text-amber-700 bg-amber-50 border-amber-100':'text-slate-600 bg-white/70 border-white';
                const icon=ok?'fa-circle-check':fail?'fa-circle-xmark':checking?'fa-spinner fa-spin':'fa-circle';
                return `<div class="border ${cls} rounded-xl px-3 py-2 flex items-start gap-2"><i class="fas ${icon} mt-0.5"></i><span>${escapeHTML(step.text||'')}</span></div>`;
            }).join('');
        }
        function setPaymentSubmitBusy(isBusy,label){
            const btn=document.getElementById('payment-submit-btn');
            const lab=document.getElementById('payment-submit-label');
            if(btn) btn.disabled=!!isBusy;
            if(lab){
                lab.innerHTML=isBusy?`<i class="fas fa-spinner fa-spin mr-1"></i> ${escapeHTML(label||'กำลังตรวจสอบ...')}`:`<i class="fas fa-paper-plane mr-1"></i> ส่งหลักฐานการชำระเงิน`;
            }
        }
        function setSlipCheckBox(status,title,message,details,steps){
            if(__slipCheckPopupActive) bringSlipResultPopupToFront();
            const box=document.getElementById('payment-slip-check-box');
            const icon=document.getElementById('payment-slip-check-icon');
            const ttl=document.getElementById('payment-slip-check-title');
            const msg=document.getElementById('payment-slip-check-message');
            const det=document.getElementById('payment-slip-check-details');
            if(!box||!icon||!ttl||!msg) return;
            if(!__slipCheckPopupActive){
                box.classList.add('hidden');
                return;
            }
            box.classList.remove('hidden','border-emerald-200','border-rose-200','border-amber-200','border-slate-200','bg-emerald-50','bg-rose-50','bg-amber-50','bg-slate-50');
            icon.className='w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ';
            const map={
                checking:['bg-amber-100','text-amber-600','border-amber-200','bg-amber-50','fa-spinner fa-spin'],
                pass:['bg-emerald-100','text-emerald-600','border-emerald-200','bg-emerald-50','fa-circle-check'],
                fail:['bg-rose-100','text-rose-600','border-rose-200','bg-rose-50','fa-circle-xmark'],
                idle:['bg-slate-200','text-slate-500','border-slate-200','bg-slate-50','fa-shield-halved']
            }[status]||[];
            icon.classList.add(map[0],map[1]);
            box.classList.add(map[2],map[3]);
            icon.innerHTML=`<i class="fas ${map[4]}"></i>`;
            ttl.textContent=title||'ตรวจสอบสลิป';
            msg.textContent=message||'';
            if(status==='idle'){
                const wrap=document.getElementById('payment-slip-progress-wrap');
                if(wrap) wrap.classList.add('hidden');
                setSlipCheckSteps(steps||[]);
            }
            if(det){
                if(details && Object.keys(details).length){
                    det.classList.remove('hidden');
                    det.innerHTML=Object.entries(details).map(([k,v])=>`<div class="bg-white/70 border border-white rounded-xl p-2"><b class="block text-slate-500">${escapeHTML(k)}</b><span class="font-bold text-slate-800 break-all">${escapeHTML(String(v||'-'))}</span></div>`).join('');
                }else{
                    det.classList.add('hidden'); det.innerHTML='';
                }
            }
            setSlipCheckSteps(steps||[]);
        }
        async function readImageMeta(file){
            return new Promise((resolve,reject)=>{
                const url=URL.createObjectURL(file);
                const img=new Image();
                img.onload=()=>{ const meta={width:img.naturalWidth,height:img.naturalHeight}; URL.revokeObjectURL(url); resolve(meta); };
                img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error('อ่านรูปไม่ได้')); };
                img.src=url;
            });
        }
        async function isReferenceUsed(reference){
            if(!reference) return true;
            const localKey='schoolhub_used_payment_refs';
            const localRefs=readLocalJSON(localKey,[]);
            if(localRefs.includes(reference)) return true;
            try{
                const snap=await getDocs(collection(db,'subscription_requests'));
                return snap.docs.some(d=>{
                    const r=d.data()||{};
                    return String(r.paymentReference||r.slipReference||r.referenceNo||'').toUpperCase()===reference && r.status!=='rejected';
                });
            }catch(e){
                console.warn('ตรวจเลขอ้างอิงใน Firestore ไม่ได้ ใช้ local duplicate guard แทน',e);
                return false;
            }
        }
        function rememberUsedReference(reference){
            if(!reference) return;
            const localKey='schoolhub_used_payment_refs';
            const refs=readLocalJSON(localKey,[]);
            if(!refs.includes(reference)){
                refs.unshift(reference);
                writeLocalJSON(localKey,refs.slice(0,300));
            }
        }
        async function verifySlipBeforeSubmit({file, plan, payerName, paidAt}){
            currentSlipVerification=null;
            openSlipCheckPopup('checking');
            setSlipCheckBox('checking','กำลังอ่านและตรวจสอบสลิป','ระบบกำลังตรวจรูปว่าเป็นสลิปจริง อ่านยอดเงิน เลขอ้างอิง ชื่อ และเวลา กรุณารอสักครู่ ห้ามปิดหน้านี้ระหว่างตรวจสอบ',{},[{status:'checking',text:'เริ่มตรวจสอบรูปสลิป'}]);
            setSlipCheckProgress(5,'เริ่มตรวจสอบ');
            const amountExpected=extractPlanAmount(plan.price);
            const imageMeta=await readImageMeta(file);
            setSlipCheckProgress(12,'ตรวจขนาดและความชัดของรูป');
            if(imageMeta.width<420 || imageMeta.height<420){
                throw new Error('รูปสลิปมีขนาดเล็กเกินไป กรุณาอัปโหลดรูปที่คมชัดกว่าเดิม');
            }
            if(!window.Tesseract){
                setSlipCheckBox('fail','ยังตรวจ OCR ไม่ได้','โหลดระบบอ่านสลิป OCR ไม่สำเร็จ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่ หรือให้แอดมินตรวจเอง',{'สถานะ':'รอตรวจสอบโดยแอดมิน'},[{status:'fail',text:'โหลด OCR ไม่สำเร็จ'}]);
                throw new Error('โหลดระบบ OCR ไม่สำเร็จ จึงยังไม่สามารถอนุมัติอัตโนมัติได้');
            }
            const ocr=await Tesseract.recognize(file,'tha+eng',{ logger: m => {
                if(m?.status==='recognizing text'){
                    const pct=Math.round((m.progress||0)*100);
                    setSlipCheckBox('checking','กำลังอ่านตัวอักษรจากสลิป',`กำลังประมวลผล OCR ${pct}%`,{},[{status:'pass',text:'รูปมีขนาดเพียงพอ'},{status:'checking',text:`กำลังอ่านตัวอักษร OCR ${pct}%`}]);
                    setSlipCheckProgress(15+Math.round(pct*0.55),'กำลังอ่าน OCR');
                }
            }});
            const ocrText=ocr?.data?.text||'';
            setSlipCheckProgress(72,'กำลังแยกข้อมูลจากสลิป');
            setSlipCheckBox('checking','กำลังแยกข้อมูลจากสลิป','อ่าน OCR เสร็จแล้ว กำลังตรวจยอดเงิน เลขอ้างอิง ชื่อ และเวลา...',{},[{status:'pass',text:'อ่าน OCR เสร็จแล้ว'},{status:'checking',text:'กำลังตรวจข้อมูลสำคัญ'}]);
            const amountRead=extractSlipAmount(ocrText);
            const reference=extractSlipReference(ocrText);
            const slipDate=parseSlipDateTime(ocrText,paidAt);
            const userDate=new Date(paidAt);
            const nameScore=Math.max(similarityScore(ocrText,payerName), similarityScore(ocrText,currentUser?.displayName||''), similarityScore(ocrText,currentUser?.email||''));
            const isRealSlip=looksLikeBankSlip(ocrText);
            const amountOk=Number.isFinite(amountRead) && Math.abs(Number(amountRead)-Number(amountExpected))<=PAYMENT_AUTO_APPROVE_RULES.amountTolerance;
            const timeDiffMin=(slipDate && !Number.isNaN(userDate.getTime())) ? Math.abs(slipDate.getTime()-userDate.getTime())/60000 : Infinity;
            const timeOk=timeDiffMin<=PAYMENT_AUTO_APPROVE_RULES.timeToleranceMinutes;
            const nameOk=nameScore>=PAYMENT_AUTO_APPROVE_RULES.minNameSimilarity;
            setSlipCheckProgress(82,'กำลังตรวจเลขอ้างอิงซ้ำ');
            const duplicate=await isReferenceUsed(reference);
            const result={
                autoApproved:false,
                isRealSlip, amountExpected, amountRead, amountOk,
                reference, duplicateReference:duplicate,
                slipTime:slipDate?slipDate.toISOString():'',
                userPaymentTime:paidAt,
                timeDiffMinutes:Number.isFinite(timeDiffMin)?Math.round(timeDiffMin):null,
                timeOk, payerName, nameScore, nameOk,
                ocrTextPreview:ocrText.slice(0,1200),
                checkedAt:Date.now()
            };
            const reasons=[];
            if(!isRealSlip) reasons.push('รูปนี้ยังไม่ชัดว่าเป็นสลิปโอนเงินจริง');
            if(!amountOk) reasons.push(`ยอดเงินไม่ตรงหรืออ่านยอดไม่ได้ (ต้องเป็น ${Number(amountExpected).toLocaleString('th-TH')} บาท)`);
            if(!reference) reasons.push('อ่านเลขอ้างอิงไม่ได้');
            if(reference && duplicate) reasons.push('เลขอ้างอิงนี้เคยถูกใช้แล้ว');
            if(!timeOk) reasons.push('เวลาบนสลิปไม่ตรงหรือห่างจากเวลาที่แจ้งเกิน 30 นาที');
            if(!nameOk) reasons.push('ชื่อผู้ชำระเงินไม่ตรงหรือไม่ใกล้เคียงพอ');
            result.autoApproved = reasons.length===0;
            currentSlipVerification=result;
            const details={
                'ยอดที่อ่านได้': amountRead!=null ? `${amountRead} บาท` : 'อ่านไม่ได้',
                'ยอดที่ต้องชำระ': `${amountExpected} บาท`,
                'เลขอ้างอิง': reference || 'อ่านไม่ได้',
                'ส่วนต่างเวลา': result.timeDiffMinutes!=null ? `${result.timeDiffMinutes} นาที` : 'อ่านเวลาไม่ได้',
                'ความใกล้เคียงชื่อ': `${Math.round(nameScore*100)}%`,
                'ผลอนุมัติอัตโนมัติ': result.autoApproved ? 'ผ่าน' : 'ไม่ผ่าน'
            };
            const finalSteps=[
                {status:isRealSlip?'pass':'fail',text:isRealSlip?'ตรวจแล้ว: รูปมีลักษณะเป็นสลิป':'ไม่ผ่าน: รูปยังไม่ชัดว่าเป็นสลิป'},
                {status:amountOk?'pass':'fail',text:amountOk?'ตรวจแล้ว: ยอดเงินตรง':'ไม่ผ่าน: ยอดเงินไม่ตรงหรืออ่านไม่ได้'},
                {status:(reference && !duplicate)?'pass':'fail',text:(reference && !duplicate)?'ตรวจแล้ว: เลขอ้างอิงไม่ซ้ำ':'ไม่ผ่าน: อ่านเลขอ้างอิงไม่ได้หรือเลขซ้ำ'},
                {status:nameOk?'pass':'fail',text:nameOk?'ตรวจแล้ว: ชื่อใกล้เคียง':'ไม่ผ่าน: ชื่อไม่ใกล้เคียงพอ'},
                {status:timeOk?'pass':'fail',text:timeOk?'ตรวจแล้ว: เวลาใกล้เคียง':'ไม่ผ่าน: เวลาไม่ตรงหรืออ่านเวลาไม่ได้'}
            ];
            setSlipCheckProgress(100,result.autoApproved?'ตรวจสอบผ่าน':'ตรวจสอบไม่ผ่าน');
            if(result.autoApproved){
                setSlipCheckBox('pass','ตรวจสอบผ่าน พร้อมอนุมัติอัตโนมัติ','ข้อมูลสลิปถูกต้องครบ: เป็นสลิปจริง ยอดเงินตรง เลขอ้างอิงไม่ซ้ำ ชื่อใกล้เคียง และเวลาตรง/ใกล้เคียง',details,finalSteps);
            }else{
                setSlipCheckBox('fail','ตรวจสอบแล้ว: ยังไม่อนุมัติอัตโนมัติ',`ระบบตรวจเสร็จแล้ว แต่จะส่งให้แอดมินตรวจสอบ เพราะ:\n- ${reasons.join('\n- ')}`,details,finalSteps);
            }
            return result;
        }
        async function autoApproveVerifiedPlanRequest(reqId,payload,verification){
            const now=Date.now();
            await setDoc(getPlanRequestDocRef(reqId),{
                status:'approved',
                autoApproved:true,
                approvedAt:now,
                approvedBy:'slip-verification-system',
                updatedAt:now,
                slipVerification:verification,
                paymentReference:verification.reference,
                slipReference:verification.reference
            },{merge:true});
            await setDoc(doc(db,getPublicPath(),normalizeSchoolHubEmail(payload.email||payload.userKey)),{
                uid:payload.uid,email:payload.email||'',userKey:normalizeSchoolHubEmail(payload.email||payload.userKey),
                name:payload.name||payload.email||'',role:'user',status:'active',
                planId:payload.planId,planName:payload.planName,planPrice:payload.planPrice,
                planApprovedAt:now,planStartAt:now,
                planNextBillingAt:getPlanNextBillingAt(getPlanById(payload.planId)||payload,now,payload.planBillingCycle||'monthly'),
                planExpiresAt:getPlanNextBillingAt(getPlanById(payload.planId)||payload,now,payload.planBillingCycle||'monthly'),
                courseLimit:Number((getPlanById(payload.planId)||{}).courseLimit||0),
                requestedPlanId:null,requestedPlanName:null,
                lastAutoApprovedPaymentRef:verification.reference
            },{merge:true});
            await setDoc(doc(db,'users_status',normalizeSchoolHubEmail(payload.email||payload.userKey)),{
                status:'active',planId:payload.planId,planName:payload.planName,planPrice:payload.planPrice,
                planApprovedAt:now,planStartAt:now,
                planNextBillingAt:getPlanNextBillingAt(getPlanById(payload.planId)||payload,now,payload.planBillingCycle||'monthly'),
                planExpiresAt:getPlanNextBillingAt(getPlanById(payload.planId)||payload,now,payload.planBillingCycle||'monthly'),
                courseLimit:Number((getPlanById(payload.planId)||{}).courseLimit||0),
                deletedAt:null,
                lastAutoApprovedPaymentRef:verification.reference
            },{merge:true});
            rememberUsedReference(verification.reference);
        }

        window.openPlanPaymentModal=(planId)=>{
            const plan=(subscriptionPlans||getDefaultPlans()).find(p=>p.id===planId);
            if(!plan)return showCustomAlert('ไม่พบแผน','กรุณาเลือกแผนอีกครั้ง',true);
            if(!currentUser||currentUser.uid==='admin-bypass'){
                localStorage.setItem(PENDING_PLAN_KEY,planId);
                return openRegisterFromLanding();
            }
            const amount=extractPlanAmount(plan.price);
            const promptpay=cleanPromptPayId(plan.promptpay||'');

            document.getElementById('payment-plan-id').value=plan.id;
            document.getElementById('payment-plan-name').textContent=plan.name||'-';
            document.getElementById('payment-plan-price').textContent=plan.price||'-';
            document.getElementById('payment-plan-subtitle').textContent=`กรอกข้อมูลและอัปโหลดสลิปสำหรับแผน ${plan.name||''}`;

            const canvas=document.getElementById('payment-qr-canvas');
            const noqr=document.getElementById('payment-no-qr');
            const label=document.getElementById('payment-promptpay-label');
            const amtLabel=document.getElementById('payment-amount-label');
            canvas.innerHTML='';

            if(promptpay && amount>0){
                try{
                    new QRCode(canvas,{text:buildPromptPayPayload(promptpay,amount),width:200,height:200,correctLevel:QRCode.CorrectLevel.M});
                }catch(e){
                    canvas.innerHTML=`<p class="text-xs text-rose-500">สร้าง QR ไม่ได้</p>`;
                }
                canvas.classList.remove('hidden');
                noqr.classList.add('hidden');
                label.textContent=`พร้อมเพย์: ${promptpay}`;
                amtLabel.textContent=`ยอดชำระ ฿${Number(amount).toLocaleString('th-TH')}`;
                amtLabel.classList.remove('hidden');
            }else{
                canvas.classList.add('hidden');
                noqr.classList.remove('hidden');
                label.textContent=promptpay?`พร้อมเพย์: ${promptpay}`:'ยังไม่ได้ตั้งเบอร์พร้อมเพย์';
                amtLabel.classList.add('hidden');
            }

            // reset slip preview
            document.getElementById('payment-proof-file').value='';
            document.getElementById('payment-slip-preview-wrap').classList.add('hidden');
            document.getElementById('payment-slip-preview-img').src='';

            const payer=document.getElementById('payment-payer-name');
            if(payer) payer.value=(currentUser.displayName||'');
            document.getElementById('payment-slip-check-box')?.classList.add('hidden');
            __slipCheckPopupActive = false;
            setPaymentSubmitBusy(false);
            setNowToPaymentTime();
            document.getElementById('plan-payment-modal')?.classList.remove('hidden');
        };

        // Slip preview handler
        window.previewPaymentSlip = (event) => {
            currentSlipVerification = null;
            const file = event?.target?.files?.[0];
            const wrap = document.getElementById('payment-slip-preview-wrap');
            const img  = document.getElementById('payment-slip-preview-img');
            if(!file){
                wrap.classList.add('hidden'); img.src='';
                return;
            }
            if(!file.type.startsWith('image/')){
                showCustomAlert('ไฟล์ไม่ถูกต้อง','กรุณาอัปโหลดรูปภาพเท่านั้น',true);
                event.target.value='';
                return;
            }
            const reader=new FileReader();
            reader.onload=e=>{ img.src=e.target.result; wrap.classList.remove('hidden'); };
            reader.readAsDataURL(file);
        };
        window.submitPlanPaymentForm=async()=>{
            const planId=document.getElementById('payment-plan-id')?.value;
            const plan=(subscriptionPlans||getDefaultPlans()).find(p=>p.id===planId);
            if(!plan)return showCustomAlert('ไม่พบแผน','กรุณาเลือกแผนอีกครั้ง',true);
            if(!currentUser||currentUser.uid==='admin-bypass'){
                localStorage.setItem(PENDING_PLAN_KEY,planId);
                closePlanPaymentModal();
                return openRegisterFromLanding();
            }
            if(await hasPendingPlanRequestForCurrentUser()){
                closePlanPaymentModal();
                return showCustomAlert('มีคำขอรออนุมัติอยู่แล้ว','คุณส่งคำขอสมัครแผนไว้แล้ว กรุณารอแอดมินอนุมัติก่อน ไม่สามารถส่งซ้ำได้',true);
            }
            const payerName=document.getElementById('payment-payer-name')?.value.trim();
            const paidAt=document.getElementById('payment-paid-at')?.value;
            const proofFile=document.getElementById('payment-proof-file')?.files?.[0];
            if(!payerName||!paidAt||!proofFile)return showCustomAlert('ข้อมูลไม่ครบ','กรุณากรอกชื่อ เวลา และอัปโหลดสลิปให้ครบ',true);
            if(!proofFile.type.startsWith('image/'))return showCustomAlert('ไฟล์ไม่ถูกต้อง','กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น',true);
            setPaymentSubmitBusy(true,'กำลังตรวจสอบสลิป...');
            let verification=null;
            try{
                verification=await verifySlipBeforeSubmit({file:proofFile,plan,payerName,paidAt});
            }catch(verifyError){
                verification={
                    autoApproved:false,
                    verificationError:verifyError?.message||String(verifyError),
                    checkedAt:Date.now()
                };
                setSlipCheckProgress(100,'ตรวจสอบไม่สำเร็จ');
                setSlipCheckBox('fail','ตรวจสลิปอัตโนมัติไม่สำเร็จ',`${verification.verificationError}\n\nระบบจะบันทึกเป็น “รอตรวจสอบ” และจะไม่อนุมัติอัตโนมัติจนกว่าข้อมูลจะถูกต้องจริง`,{ 'สถานะ':'รอตรวจสอบโดยแอดมิน' },[{status:'fail',text:'ระบบ OCR หรือตัวตรวจสอบทำงานไม่สำเร็จ'}]);
            }
            const slipDecision = await waitSlipReviewDecision(verification);
            closeSlipCheckPopup();
            if(!slipDecision){
                setPaymentSubmitBusy(false);
                return;
            }
            try{
                setPaymentSubmitBusy(true, slipDecision==='approve' ? 'กำลังยืนยันและเปิดใช้งาน...' : 'กำลังส่งให้แอดมินตรวจสอบ...');
                const slipDataUrl=await compressSlipForFirestore(proofFile);
                const userKey=getUserKey(currentUser);
                const reqId=`${currentUser.uid}_${planId}_${Date.now()}`;
                const payload={
                    id:reqId,
                    uid:currentUser.uid,userKey,email:currentUser.email||'',
                    name:currentUser.displayName||userKey,
                    planId:plan.id,planName:plan.name||'',planPrice:plan.price||'',
                    planDesc:plan.desc||'',planAmount:extractPlanAmount(plan.price),
                    planBillingCycle:getSelectedPlanCycle(plan),
                    promptpay:plan.promptpay||'',
                    payerName,
                    paymentTime:paidAt,
                    paidAt,
                    slipDataUrl,
                    paymentProofDataUrl:slipDataUrl,
                    paymentProofName:proofFile.name,
                    paymentProofType:'image/jpeg',
                    paymentProofOriginalName:proofFile.name,
                    paymentProofOriginalSize:proofFile.size||0,
                    paymentProofCompressed:true,
                    slipVerification:verification,
                    paymentReference:verification?.reference||'',
                    slipReference:verification?.reference||'',
                    status:verification?.autoApproved?'approved':'pending',
                    autoApproved:!!verification?.autoApproved,
                    createdAt:Date.now(),updatedAt:Date.now()
                };
                await setDoc(getPlanRequestDocRef(reqId),payload,{merge:true});
                if(verification?.autoApproved){
                    await autoApproveVerifiedPlanRequest(reqId,payload,verification);
                    await setDoc(doc(db,getPublicPath(),userKey),{
                        uid:currentUser.uid,email:currentUser.email||'',userKey,
                        name:currentUser.displayName||userKey,role:'user',
                        status:'active',
                        requestedPlanId:null,requestedPlanName:null,
                        requestedPlanAt:null
                    },{merge:true});
                }else{
                    await setDoc(doc(db,getPublicPath(),userKey),{
                        uid:currentUser.uid,email:currentUser.email||'',userKey,
                        name:currentUser.displayName||userKey,role:'user',
                        status:'pending_plan',
                        requestedPlanId:plan.id,requestedPlanName:plan.name||'',
                        requestedPlanAt:Date.now()
                    },{merge:true});
                    try{ window.queueAdminNotification&&window.queueAdminNotification('planRequest',{title:`คำขอสมัครแผน (ต้องตรวจสลิปเอง): ${plan.name}`,detail:`ผู้ขอ: ${currentUser.displayName||userKey} (${currentUser.email||userKey})`}); }catch(e){}
                }
                localStorage.removeItem(PENDING_PLAN_KEY);
                closePlanPaymentModal();
                try { if(document.getElementById('view-user-plans') && !document.getElementById('view-user-plans').classList.contains('hidden')) await loadUserPaymentHistory(); } catch(e) {}
                if(verification?.autoApproved){
                    showCustomAlert('อนุมัติอัตโนมัติแล้ว','ระบบตรวจสลิปผ่านครบทุกเงื่อนไข\n- เป็นสลิปจริง\n- ยอดเงินตรง\n- เลขอ้างอิงไม่ซ้ำ\n- ชื่อผู้ชำระเงินใกล้เคียง\n- เวลาตรงหรือใกล้เคียง\n\nสิทธิ์การใช้งานเริ่มนับทันที');
                }else{
                    showCustomAlert('ส่งสลิปแล้ว','บันทึกข้อมูลการชำระเงินเรียบร้อย\nแต่ยังไม่อนุมัติอัตโนมัติ เพราะข้อมูลสลิปยังตรวจไม่ผ่านครบทุกเงื่อนไข\n\nระบบจะรอแอดมินตรวจสอบภายหลัง');
                }
            }catch(e){
                showCustomAlert('ส่งข้อมูลไม่ได้',getFirebaseErrorText(e)+'\nโปรดตรวจสอบ Firestore Rules ของ subscription_requests',true);
            }
            setPaymentSubmitBusy(false);
            toggleLoader(false);
        };

async function submitPlanRequest(planId){
            const plan=(subscriptionPlans||getDefaultPlans()).find(p=>p.id===planId);
            if(!plan)return showCustomAlert('ไม่พบแผน','กรุณาเลือกแผนอีกครั้ง',true);
            if(!currentUser||currentUser.uid==='admin-bypass'){localStorage.setItem(PENDING_PLAN_KEY,planId);return openRegisterFromLanding();}
            const userKey=getUserKey(currentUser);
            const reqId=`${currentUser.uid}_${planId}_${Date.now()}`;
            const payload={id:reqId,uid:currentUser.uid,userKey,email:currentUser.email||'',name:currentUser.displayName||userKey,planId:plan.id,planName:plan.name||'',planPrice:planDisplayPrice(plan),planDesc:plan.desc||'',planBillingCycle:plan.billingCycle||'monthly',status:'pending',createdAt:Date.now(),updatedAt:Date.now()};
            toggleLoader(true);
            try{
                await setDoc(getPlanRequestDocRef(reqId),payload,{merge:true});
                await setDoc(doc(db,getPublicPath(),userKey),{uid:currentUser.uid,email:currentUser.email||'',userKey,name:currentUser.displayName||userKey,role:'user',status:'pending_plan',requestedPlanId:plan.id,requestedPlanName:plan.name||'',requestedPlanAt:Date.now()},{merge:true});
                localStorage.removeItem(PENDING_PLAN_KEY);
                try{ window.queueAdminNotification&&window.queueAdminNotification('planRequest',{title:`คำขอสมัครแผน: ${plan.name}`,detail:`ผู้ขอ: ${currentUser.displayName||userKey} (${currentUser.email||userKey})`}); }catch(e){}
                showCustomAlert('ส่งคำขอแล้ว',`ส่งคำขอสมัครแผน ${plan.name} ให้แอดมินตรวจสอบแล้ว\nเมื่อแอดมินอนุมัติ สิทธิ์ของคุณจะเปลี่ยนตามแผนที่สมัคร`);
            }catch(e){showCustomAlert('ส่งคำขอไม่ได้',getFirebaseErrorText(e)+'\nโปรดตรวจสอบ Firestore Rules ของ subscription_requests',true);}
            toggleLoader(false);
        }
        window.requestSubscriptionPlan=(planId)=>{
            const plan=(subscriptionPlans||getDefaultPlans()).find(p=>p.id===planId);
            if(!plan)return showCustomAlert('ไม่พบแผน','กรุณาเลือกแผนอีกครั้ง',true);
            if(!currentUser||currentUser.uid==='admin-bypass'){localStorage.setItem(PENDING_PLAN_KEY,planId);openRegisterFromLanding();return;}
            // แผนฟรี (ราคา 0 หรือไม่ระบุราคา) → อนุมัติทันที ไม่ต้องจ่ายเงิน
            const amount = extractPlanAmount(plan.price);
            if(amount === 0){
                activateFreePlan(plan);
            } else {
                openPlanPaymentModal(planId);
            }
        };

        async function activateFreePlan(plan){
            if(!currentUser) return;
            toggleLoader(true);
            try{
                const userKey = getUserKey(currentUser);
                const now = Date.now();
                const reqId = `${currentUser.uid}_${plan.id}_${now}`;
                // บันทึก request ที่ approved ทันที
                await setDoc(getPlanRequestDocRef(reqId),{
                    id:reqId, uid:currentUser.uid, userKey,
                    email:currentUser.email||'', name:currentUser.displayName||userKey,
                    planId:plan.id, planName:plan.name||'', planPrice:plan.price||'0 บาท',
                    planAmount:0, status:'approved',
                    createdAt:now, approvedAt:now, updatedAt:now,
                    autoApproved:true
                },{merge:true});
                // อัปเดต directory
                await setDoc(doc(db,getPublicPath(),userKey),{
                    uid:currentUser.uid, email:currentUser.email||'', userKey,
                    name:currentUser.displayName||userKey, role:'user', status:'active',
                    planId:plan.id, planName:plan.name||'', planPrice:plan.price||'0 บาท',
                    planApprovedAt:now, planStartAt:now,
                    requestedPlanId:null, requestedPlanName:null
                },{merge:true});
                await setDoc(doc(db,'users_status',userKey),{
                    status:'active', planId:plan.id, planName:plan.name||'',
                    planPrice:plan.price||'0 บาท', planApprovedAt:now, planStartAt:now, deletedAt:null
                },{merge:true});
                localStorage.removeItem(PENDING_PLAN_KEY);
                showCustomAlert('เปิดใช้งานแล้ว',`แผน ${plan.name} เปิดใช้งานทันที ไม่มีค่าใช้จ่าย 🎉`);
            }catch(e){
                showCustomAlert('เกิดข้อผิดพลาด',getFirebaseErrorText(e),true);
            }
            toggleLoader(false);
        }
        async function processPendingPlanRequestAfterLogin(){
            const planId=localStorage.getItem(PENDING_PLAN_KEY);
            if(planId&&currentUser&&currentUser.uid!=='admin-bypass') {
                const plan=(subscriptionPlans||getDefaultPlans()).find(p=>p.id===planId);
                if(plan){
                    const amount = extractPlanAmount(plan.price);
                    if(amount === 0){
                        // free plan → activate immediately
                        setTimeout(()=>activateFreePlan(plan), 300);
                    } else {
                        setTimeout(()=>openPlanPaymentModal(planId), 300);
                    }
                    return 'pending';
                }
            }
            if(localStorage.getItem('schoolhub_after_register_choose_plan')==='1'){
                localStorage.removeItem('schoolhub_after_register_choose_plan');
                setTimeout(()=>window.openUserPlanSelector(),250);
                return 'choose';
            }
            return '';
        }
        window.scrollToLandingPlans=()=>document.getElementById('landing-plans-section')?.scrollIntoView({behavior:'smooth',block:'start'});
        function renderAdminPlans(){const tbody=document.getElementById('admin-plan-list');if(!tbody)return;const items=(subscriptionPlans||[]).sort((a,b)=>Number(a.order||0)-Number(b.order||0));if(!items.length){tbody.innerHTML='<tr><td colspan="5" class="text-center p-8 text-slate-400">ยังไม่มีแผนการใช้งาน</td></tr>';return;}tbody.innerHTML=items.map(p=>`<tr><td class="font-bold text-slate-700">${escapeHTML(p.name||'')}${p.featured?'<div class="text-xs text-primary mt-1"><i class="fas fa-star"></i> แนะนำ</div>':''}</td><td class="font-black text-primary">${escapeHTML(p.price||'')}<div class="text-xs font-normal text-slate-400">${escapeHTML(p.desc||'')}</div></td><td class="text-sm text-slate-500">${(p.features||[]).slice(0,5).map(f=>`<div>• ${escapeHTML(f)}</div>`).join('')}</td><td class="text-center"><span class="px-3 py-1 rounded-full text-xs font-bold ${p.active!==false?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}">${p.active!==false?'แสดง':'ซ่อน'}</span></td><td class="text-right whitespace-nowrap"><button onclick="editAdminPlan('${p.id}')" class="bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1.5 rounded-lg text-sm font-bold"><i class="fas fa-pen"></i></button><button onclick="deleteAdminPlan('${p.id}')" class="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1.5 rounded-lg text-sm font-bold ml-1"><i class="fas fa-trash"></i></button></td></tr>`).join('');}
        window.resetAdminPlanForm=()=>{['plan-sub-edit-id','plan-sub-name','plan-sub-price','plan-sub-promptpay','plan-sub-desc','plan-sub-features'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('plan-sub-order').value='1';document.getElementById('plan-sub-featured').checked=false;document.getElementById('plan-sub-active').checked=true;};
        window.editAdminPlan=(id)=>{const p=(subscriptionPlans||[]).find(x=>x.id===id);if(!p)return;document.getElementById('plan-sub-edit-id').value=p.id;document.getElementById('plan-sub-name').value=p.name||'';document.getElementById('plan-sub-price').value=p.price||'';document.getElementById('plan-sub-promptpay').value=p.promptpay||'';document.getElementById('plan-sub-desc').value=p.desc||'';document.getElementById('plan-sub-features').value=(p.features||[]).join('\n');document.getElementById('plan-sub-order').value=Number(p.order||1);document.getElementById('plan-sub-featured').checked=!!p.featured;document.getElementById('plan-sub-active').checked=p.active!==false;
        // Sync expanded rights if available
        if (typeof window.writeRightsToForm === 'function') {
            window.writeRightsToForm(p, { syncPopup: true, render: true });
        }
        };
        window.saveAdminPlanForm=async()=>{if(!isAdmin)return showCustomAlert('ไม่มีสิทธิ์','เฉพาะแอดมินเท่านั้น',true);const editId=document.getElementById('plan-sub-edit-id').value;
        // Collect expanded rights if available
        let rights = {};
        if (typeof window.schoolhubGetRealPlanRights === 'function') {
            try {
                const box = document.getElementById('schoolhub-expanded-rights-box');
                if (box) {
                    const inputs = box.querySelectorAll('input[data-schoolhub-canonical-right]');
                    inputs.forEach(inp => {
                        rights[inp.getAttribute('data-schoolhub-canonical-right')] = inp.checked === true;
                    });
                }
            } catch(e) { console.error('Collect rights error:', e); }
        }
        const item={id:editId||`plan_${Date.now()}`,name:document.getElementById('plan-sub-name').value.trim(),price:document.getElementById('plan-sub-price').value.trim(),promptpay:document.getElementById('plan-sub-promptpay').value.trim(),desc:document.getElementById('plan-sub-desc').value.trim(),features:document.getElementById('plan-sub-features').value.split('\n').map(x=>x.trim()).filter(Boolean),order:Number(document.getElementById('plan-sub-order').value||1),featured:document.getElementById('plan-sub-featured').checked,active:document.getElementById('plan-sub-active').checked,updatedAt:Date.now(),...rights};if(!item.name||!item.price)return showCustomAlert('ข้อมูลไม่ครบ','กรุณากรอกชื่อระดับและราคา',true);subscriptionPlans=(subscriptionPlans||[]).filter(p=>p.id!==item.id);subscriptionPlans.push(item);writeLocalJSON(PLANS_CACHE_KEY,subscriptionPlans);renderAdminPlans();renderLandingPlans();if(typeof renderUserPlans==='function')renderUserPlans();resetAdminPlanForm();await new Promise(resolve=>requestAnimationFrame(resolve));const __adminPlanLoaderText=document.querySelector('#global-loader p');const __adminPlanLoaderOldText=__adminPlanLoaderText?__adminPlanLoaderText.textContent:'';if(__adminPlanLoaderText)__adminPlanLoaderText.textContent='กำลังบันทึกการตั้งค่าแผนการใช้งาน...';toggleLoader(true);try{await setDoc(getPlansDocRef(),{items:subscriptionPlans,updatedAt:Date.now()},{merge:true});toggleLoader(false);if(__adminPlanLoaderText)__adminPlanLoaderText.textContent=__adminPlanLoaderOldText;renderAdminPlans();renderLandingPlans();if(typeof renderUserPlans==='function')renderUserPlans();showCustomAlert('บันทึกแล้ว','บันทึกแผนการใช้งานขึ้น Firebase เรียบร้อย');}catch(e){toggleLoader(false);if(__adminPlanLoaderText)__adminPlanLoaderText.textContent=__adminPlanLoaderOldText;renderAdminPlans();renderLandingPlans();if(typeof renderUserPlans==='function')renderUserPlans();showCustomAlert('บันทึกในเครื่องแล้ว','แต่ยังบันทึกขึ้น Firebase ไม่ได้: '+getFirebaseErrorText(e),true);}};
        window.deleteAdminPlan=(id)=>window.showCustomConfirm('ลบแผนการใช้งาน','ต้องการลบแผนนี้หรือไม่?',async()=>{subscriptionPlans=(subscriptionPlans||[]).filter(p=>p.id!==id);writeLocalJSON(PLANS_CACHE_KEY,subscriptionPlans);toggleLoader(true);try{await setDoc(getPlansDocRef(),{items:subscriptionPlans,updatedAt:Date.now()},{merge:true});renderAdminPlans();renderLandingPlans();}catch(e){renderAdminPlans();renderLandingPlans();showCustomAlert('ลบในเครื่องแล้ว','แต่ยังลบจาก Firebase ไม่ได้: '+getFirebaseErrorText(e),true);}toggleLoader(false);});
        window.seedDefaultPlans=async()=>{subscriptionPlans=getDefaultPlans();writeLocalJSON(PLANS_CACHE_KEY,subscriptionPlans);toggleLoader(true);try{await setDoc(getPlansDocRef(),{items:subscriptionPlans,updatedAt:Date.now()},{merge:true});renderAdminPlans();renderLandingPlans();showCustomAlert('สำเร็จ','สร้างแผนตัวอย่าง 3 ระดับ (มาตรฐาน / โปร / ทีม) ขึ้น Firebase แล้ว');}catch(e){renderAdminPlans();renderLandingPlans();showCustomAlert('สร้างในเครื่องแล้ว','แต่ยังบันทึกขึ้น Firebase ไม่ได้: '+getFirebaseErrorText(e),true);}toggleLoader(false);};

        // --- Timed Student Share ---
        function shShareEsc(v){
            if (typeof escapeHTML === 'function') return escapeHTML(v);
            return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
        }
        function shShareAttr(v){ return shShareEsc(v).replace(/`/g, '&#96;'); }
        function isShareWithdrawnStudent(student){
            if (typeof window.isWithdrawnStudent === 'function') {
                try { return window.isWithdrawnStudent(student); } catch(e) {}
            }
            if (typeof window.isStudentWithdrawn === 'function') {
                try { return window.isStudentWithdrawn(student); } catch(e) {}
            }
            return !!(student && (student.withdrawn === true || student.isWithdrawn === true || student.status === 'withdrawn' || student.status === 'ลาออก'));
        }
        function getCurrentShareCourseId(){
            let localCurrentActive = '';
            try { localCurrentActive = typeof currentActiveCourseId !== 'undefined' ? currentActiveCourseId : ''; } catch(e) {}
            const detail = document.querySelector('#view-course-detail:not(.hidden)');
            const modal = document.getElementById('share-student-modal');
            return String(modal?.dataset?.courseId || window.currentActiveCourseId || localCurrentActive || detail?.dataset?.courseId || '').trim();
        }
        function getShareStudentName(student){ return student?.name || student?.fullName || '-'; }
        function getShareStudentCode(student){ return student?.code || student?.studentCode || ''; }
        function getShareableCourseStudents(courseId, query = ''){
            let students = [];
            if (typeof window.getCourseStudents === 'function') {
                try { students = window.getCourseStudents(courseId, { ignoreActionFilter: true }) || []; } catch(e) { students = []; }
            }
            const q = String(query || '').trim().toLowerCase();
            return (students || []).filter(st => st && !isShareWithdrawnStudent(st)).filter(st => {
                if (!q) return true;
                const text = [st.name, st.fullName, st.code, st.studentCode].map(v => String(v || '').toLowerCase()).join(' ');
                return text.includes(q);
            });
        }
        function bindShareStudentSearch(){
            const input = document.getElementById('share-student-search-input');
            if (!input) return false;
            input.placeholder = 'ค้นหาด้วยชื่อ หรือรหัสนักเรียน';
            input.oninput = function(){ renderShareStudentList(); };
            return true;
        }
        function renderShareStudentList(){
            const box = document.getElementById('share-student-list');
            const input = document.getElementById('share-student-search-input');
            if (!box) return false;
            const courseId = getCurrentShareCourseId();
            if (!courseId) {
                box.innerHTML = '<div class="text-center text-slate-400 p-8">ไม่พบรายวิชาปัจจุบัน</div>';
                return false;
            }
            const q = String(input?.value || '').trim();
            const students = getShareableCourseStudents(courseId, q);
            if (!students.length) {
                box.innerHTML = '<div class="text-center text-slate-400 p-8">ไม่พบนักเรียนที่สามารถแชร์ได้</div>';
                return false;
            }
            box.innerHTML = students.map(s => {
                const sid = shShareAttr(s.id || s.studentId || '');
                const name = shShareEsc(getShareStudentName(s));
                const code = shShareEsc(getShareStudentCode(s));
                return `<div class="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between shadow-sm">
                    <div>
                        <div class="font-bold text-slate-800">${name}</div>
                        <div class="text-xs text-slate-400 font-mono">${code || '-'}</div>
                    </div>
                    <button type="button" onclick="openCreateStudentShareLinkPopup('${sid}'); return false;" class="bg-primary hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm"><i class="fas fa-link"></i> แชร์</button>
                </div>`;
            }).join('');
            return true;
        }
        window.renderShareStudentList = renderShareStudentList;
        window.bindShareStudentSearch = bindShareStudentSearch;
        window.openShareStudentModal = function(courseId){
            const cid = String(courseId || window.currentActiveCourseId || (typeof currentActiveCourseId !== 'undefined' ? currentActiveCourseId : '') || document.querySelector('#view-course-detail:not(.hidden)')?.dataset?.courseId || '').trim();
            if (!cid) {
                if (typeof showCustomAlert === 'function') showCustomAlert('เปิดไม่ได้','ไม่พบรายวิชาปัจจุบัน กรุณาเข้าหน้ารายวิชาก่อนแชร์ให้นักเรียน',true);
                return false;
            }
            try { currentActiveCourseId = cid; } catch(e) {}
            window.currentActiveCourseId = cid;
            const modal = document.getElementById('share-student-modal');
            if (modal) modal.dataset.courseId = cid;
            const input = document.getElementById('share-student-search-input');
            if (input) { input.value = ''; input.placeholder = 'ค้นหาด้วยชื่อ หรือรหัสนักเรียน'; }
            bindShareStudentSearch();
            renderShareStudentList();
            if (typeof window.openModal === 'function') window.openModal('share-student-modal');
            else if (modal) modal.classList.remove('hidden');
            setTimeout(renderShareStudentList, 0);
            return false;
        };
        window.closeShareStudentModal = function(){
            if (typeof window.closeModal === 'function') window.closeModal('share-student-modal');
            else document.getElementById('share-student-modal')?.classList.add('hidden');
            return false;
        };
        window.closeStudentShareModal = window.closeShareStudentModal;
        function buildStudentSharePayload(studentId,expireMinutes,note){
            const sid = String(studentId || '').trim();
            const cid = getCurrentShareCourseId();
            const student=(state.students||[]).find(s=>String(s.id)===sid || String(s.studentId||'')===sid || String(s.code||'')===sid || String(s.studentCode||'')===sid);
            const course=(state.courses||[]).find(c=>String(c.id)===String(cid));
            if(!student||!course)return null;
            if(isShareWithdrawnStudent(student)) return null;
            const plans=(state.coursePlans[cid]||[]).sort((a,b)=>a.week-b.week);
            const courseScores=(state.scores||[]).filter(x=>String(x.courseId)===String(cid));
            const attendanceHistory=(state.attendance&&state.attendance[cid])||{};
            const attDates=Object.keys(attendanceHistory).sort();
            let present=0,late=0,absent=0,leave=0;
            const attendanceDetail={present:[],late:[],absent:[],leave:[]};
            attDates.forEach(d=>{
                const st=attendanceHistory[d]?.records?.[student.id];
                if(st==='present'){present++;attendanceDetail.present.push(d);}
                else if(st==='late'){late++;attendanceDetail.late.push(d);}
                else if(st==='absent'){absent++;attendanceDetail.absent.push(d);}
                else if(st==='leave'){
                    leave++;
                    const reason=(attendanceHistory[d]&&attendanceHistory[d].leaveReasons&&attendanceHistory[d].leaveReasons[student.id])||'';
                    attendanceDetail.leave.push({date:d,reason});
                }
            });
            let totalScore=0,totalMax=0;
            const scoreRows=plans.map(p=>{const task=courseScores.find(ts=>Number(ts.week)===Number(p.week)&&String(ts.title)===String(p.title));const raw=task&&task.records?task.records[student.id]:undefined;const checklist=Number(p.maxScore)===0;if(!checklist)totalMax=window.addScoreToTotal(totalMax,p.maxScore,2);let display='-';if(checklist)display=raw===1?'ส่งแล้ว':(raw===0?'ยังไม่ส่ง':'-');else{if(raw!==undefined&&raw!==''&&window.scoreNumberOrNull(raw)!==null){totalScore=window.addScoreToTotal(totalScore,raw,2);display=`${window.formatScoreDisplay(raw,2)}/${window.formatScoreDisplay(p.maxScore,2)}`;}else if(task)display='ขาดส่ง';}return{week:p.week,title:p.title,maxScore:p.maxScore,checklist,display};});

            // Bonus scores (per week, same source as the teacher overview table)
            const bonusByCid=(state.bonusScores&&state.bonusScores[cid])||{};
            let totalBonus=0;
            const bonusDetail=[];
            Object.keys(bonusByCid).forEach(wk=>{
                const wVal=bonusByCid[wk]&&bonusByCid[wk][student.id];
                if(wVal!==undefined&&wVal!==''&&!isNaN(Number(wVal))&&Number(wVal)!==0){
                    totalBonus+=Number(wVal);
                    bonusDetail.push({week:wk.replace('w',''),val:Number(wVal)});
                }
            });
            bonusDetail.sort((a,b)=>Number(a.week)-Number(b.week));

            // Stars (from group membership, same source as the teacher overview table) — Multi-Set aware
            const starCourseData=(state.starGroups&&state.starGroups[cid])||{};
            const starSets=(starCourseData.sets||[]);
            let totalStars=0;
            const starDetailMap={};
            starSets.forEach(starSet=>{
                const starGroups=starSet.groups||[];
                const weekStars=starSet.weekStars||{};
                const studentGroups=starGroups.filter(g=>(g.members||[]).includes(student.id));
                Object.keys(weekStars).forEach(wk=>{
                    const weekData=weekStars[wk]||{};
                    let weekStarSum=0;
                    studentGroups.forEach(g=>{weekStarSum+=weekData[g.id]||0;});
                    if(weekStarSum>0){
                        totalStars+=weekStarSum;
                        starDetailMap[wk]=(starDetailMap[wk]||0)+weekStarSum;
                    }
                });
            });
            // Also handle old single-set structure if migration hasn't happened yet
            if(starCourseData.groups && !starSets.length){
                const oldGroups=(starCourseData.groups||[]).filter(g=>(g.members||[]).includes(student.id));
                const oldWeekStars=starCourseData.weekStars||{};
                Object.keys(oldWeekStars).forEach(wk=>{
                    const weekData=oldWeekStars[wk]||{};
                    let weekStarSum=0;
                    oldGroups.forEach(g=>{weekStarSum+=weekData[g.id]||0;});
                    if(weekStarSum>0){
                        totalStars+=weekStarSum;
                        starDetailMap[wk]=(starDetailMap[wk]||0)+weekStarSum;
                    }
                });
            }
            const starDetail=Object.keys(starDetailMap).map(wk=>({week:wk.replace('w',''),stars:starDetailMap[wk]})).sort((a,b)=>Number(a.week)-Number(b.week));

            // Bonus-merge-into-total setting (configured by the teacher via the +โบนัส header)
            const bmSettings=(state.bonusMergeSettings&&state.bonusMergeSettings[cid])||null;
            let bonusMerged=0, bonusMergeEnabled=false, bonusMergePercent=0;
            if(bmSettings&&bmSettings.enabled){
                const included=bmSettings.mode==='selected'?(bmSettings.selected||[]).includes(student.id):true;
                if(included&&totalBonus){
                    bonusMergePercent=Number(bmSettings.percent)||0;
                    bonusMerged=totalBonus*(bonusMergePercent/100);
                    totalScore=window.addScoreToTotal(totalScore,bonusMerged,2);
                    bonusMergeEnabled=true;
                }
            }

            return{student,course,note,expireMinutes:Number(expireMinutes||1),firstViewedAt:null,expiresAt:null,createdAt:Date.now(),teacherName:currentUser?.displayName||currentUser?.email||'ครูผู้สอน',summary:{present,late,absent,leave,totalScore:window.normalizeScoreNumber(totalScore,2),totalMax:window.normalizeScoreNumber(totalMax,2),totalBonus:window.normalizeScoreNumber(totalBonus,2),totalStars,bonusMerged:window.normalizeScoreNumber(bonusMerged,2),bonusMergeEnabled,bonusMergePercent},scoreRows,attendanceDetail,bonusDetail,starDetail};
        }
        window.openCreateStudentShareLinkPopup = function(studentId){
            const cid = getCurrentShareCourseId();
            const sid = String(studentId || '').trim();
            const student = (state.students||[]).find(s=>String(s.id)===sid || String(s.studentId||'')===sid || String(s.code||'')===sid || String(s.studentCode||'')===sid);
            if (!student || isShareWithdrawnStudent(student)) {
                if (typeof showCustomAlert === 'function') showCustomAlert('แชร์ไม่ได้','ไม่พบนักเรียนที่สามารถแชร์ได้ หรือเป็นนักเรียนที่ลาออกแล้ว',true);
                return false;
            }
            window.__schoolhubShareStudentId = String(student.id || student.studentId || sid);
            window.__schoolhubShareStudentUrl = '';
            const detail = document.getElementById('student-share-create-detail');
            if (detail) {
                const course = (state.courses||[]).find(c=>String(c.id)===String(cid)) || {};
                detail.innerHTML = `<div class="text-xs font-black text-indigo-500 uppercase mb-1">รายละเอียดคนที่จะแชร์</div><div class="text-lg font-black text-slate-800">${shShareEsc(getShareStudentName(student))}</div><div class="text-sm text-slate-500 font-mono mt-1">${shShareEsc(getShareStudentCode(student)) || '-'}</div><div class="text-sm text-primary font-bold mt-2">${shShareEsc(course.code || '')} ${shShareEsc(course.name || '')}</div>`;
            }
            const minute = document.getElementById('student-share-expire-minutes');
            const note = document.getElementById('student-share-note');
            if (minute) minute.value = '1';
            if (note) note.value = '';
            document.getElementById('student-share-create-form')?.classList.remove('hidden');
            document.getElementById('student-share-created-panel')?.classList.add('hidden');
            const copyBtn = document.getElementById('student-share-copy-btn');
            if (copyBtn) {
                copyBtn.disabled = false;
                copyBtn.classList.remove('opacity-80', 'cursor-not-allowed');
                copyBtn.innerHTML = '<i class="fas fa-copy mr-1"></i> คัดลอกลิงก์';
            }
            const popup = document.getElementById('student-share-create-popup');
            if (popup) popup.classList.remove('student-share-popup-closing');
            if (typeof window.openModal === 'function') window.openModal('student-share-create-popup');
            else if (popup) popup.classList.remove('hidden');
            if (popup) popup.style.zIndex = '950000';
            return false;
        };
        window.closeCreateStudentShareLinkPopup = function(){
            if (typeof window.closeModal === 'function') window.closeModal('student-share-create-popup');
            else document.getElementById('student-share-create-popup')?.classList.add('hidden');
            return false;
        };
        window.confirmCreateStudentShareLink = async function(){
            const studentId = window.__schoolhubShareStudentId;
            const expireMinutes = Math.max(1, Number(document.getElementById('student-share-expire-minutes')?.value || 1));
            const note = String(document.getElementById('student-share-note')?.value || '').trim();
            const payload=buildStudentSharePayload(studentId,expireMinutes,note);
            if(!payload){ if(typeof showCustomAlert==='function') showCustomAlert('สร้างลิงก์ไม่ได้','ไม่พบข้อมูลนักเรียน หรือเป็นนักเรียนที่ลาออกแล้ว',true); return false; }
            const token=`sh_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
            toggleLoader(true);
            try{
                await setDoc(getShareDocRef(token),payload);
                const url=`${location.origin}${location.pathname}?share=${encodeURIComponent(token)}`;
                window.__schoolhubShareStudentUrl = url;
                const urlInput = document.getElementById('student-share-created-url');
                if (urlInput) urlInput.value = url;
                const detail = document.getElementById('student-share-created-detail');
                if (detail) detail.textContent = `ลิงก์ของ ${getShareStudentName(payload.student)} หมดอายุหลังเปิดดูครั้งแรก ${expireMinutes} นาที`;
                document.getElementById('student-share-create-form')?.classList.add('hidden');
                document.getElementById('student-share-created-panel')?.classList.remove('hidden');
                const copyBtn = document.getElementById('student-share-copy-btn');
                if (copyBtn) {
                    copyBtn.disabled = false;
                    copyBtn.classList.remove('opacity-80', 'cursor-not-allowed');
                    copyBtn.innerHTML = '<i class="fas fa-copy mr-1"></i> คัดลอกลิงก์';
                }
            }catch(e){
                if(typeof showCustomAlert==='function') showCustomAlert('สร้างลิงก์แชร์ไม่ได้','ต้องแก้ Firestore Rules ของ shared_student_views ก่อน: '+getFirebaseErrorText(e),true);
            }
            toggleLoader(false);
            return false;
        };
        window.copyStudentShareLink = async function(){
            const url = window.__schoolhubShareStudentUrl || document.getElementById('student-share-created-url')?.value || '';
            if(!url) return false;
            const btn = document.getElementById('student-share-copy-btn');
            try{
                await navigator.clipboard.writeText(url);

                if (btn) {
                    btn.innerHTML = '<i class="fas fa-check mr-1"></i> คัดลอกแล้ว';
                    btn.disabled = true;
                    btn.classList.add('opacity-80', 'cursor-not-allowed');
                }

                setTimeout(() => {
                    const popup = document.getElementById('student-share-create-popup');

                    if (popup) {
                        popup.classList.add('student-share-popup-closing');
                    }

                    setTimeout(() => {
                        if (typeof window.closeCreateStudentShareLinkPopup === 'function') {
                            window.closeCreateStudentShareLinkPopup();
                        } else if (popup) {
                            popup.classList.add('hidden');
                        }

                        if (popup) {
                            popup.classList.remove('student-share-popup-closing');
                        }

                        if (btn) {
                            btn.disabled = false;
                            btn.classList.remove('opacity-80', 'cursor-not-allowed');
                            btn.innerHTML = '<i class="fas fa-copy mr-1"></i> คัดลอกลิงก์';
                        }
                    }, 250);
                }, 2000);
            }catch(e){
                const input = document.getElementById('student-share-created-url');
                if(input){ input.focus(); input.select(); }
                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove('opacity-80', 'cursor-not-allowed');
                    btn.innerHTML = '<i class="fas fa-copy mr-1"></i> คัดลอกลิงก์';
                }
                if(typeof showCustomAlert==='function') showCustomAlert('คัดลอกไม่ได้','กรุณาคัดลอกลิงก์จากช่องข้อความด้วยตนเอง',true);
            }
            return false;
        };
        window.createStudentShareLink = function(studentId){ return window.openCreateStudentShareLinkPopup(studentId); };
        window.__studentShareCurrentData = window.__studentShareCurrentData || null;

        function formatStudentShareDateThai(d){
            const thMonth=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
            const parts=String(d).split('-');
            if(parts.length!==3) return d;
            return parseInt(parts[2],10)+' '+thMonth[parseInt(parts[1],10)-1]+' '+(parseInt(parts[0],10)+543);
        }

        window.showStudentShareStatDetail = function(type){
            const data = window.__studentShareCurrentData;
            const modal = document.getElementById('student-share-detail-modal');
            const titleEl = document.getElementById('student-share-detail-title');
            const bodyEl = document.getElementById('student-share-detail-body');
            if(!data || !modal || !titleEl || !bodyEl) return;
            const cfg = {
                present:{label:'มา', color:'#059669', icon:'fa-circle-check'},
                late:{label:'สาย', color:'#d97706', icon:'fa-clock'},
                absent:{label:'ขาด', color:'#e11d48', icon:'fa-circle-xmark'},
                leave:{label:'ลา', color:'#7c3aed', icon:'fa-user-clock'},
                bonus:{label:'คะแนนโบนัส', color:'#059669', icon:'fa-plus-circle'},
                star:{label:'ดาวสะสม', color:'#d97706', icon:'fa-star'}
            }[type];
            if(!cfg) return;
            titleEl.innerHTML = `<i class="fas ${cfg.icon} mr-2" style="color:${cfg.color}"></i>${cfg.label}`;

            let rows = '';
            if(type==='present' || type==='late' || type==='absent'){
                const list = (data.attendanceDetail && data.attendanceDetail[type]) || [];
                rows = list.length
                    ? list.map(d=>`<div class="py-2 border-b border-slate-100 text-sm text-slate-600">• ${formatStudentShareDateThai(d)}</div>`).join('')
                    : `<div class="text-center text-slate-400 py-8">ยังไม่มีข้อมูล</div>`;
            } else if(type==='leave'){
                const list = (data.attendanceDetail && data.attendanceDetail.leave) || [];
                rows = list.length
                    ? list.map(item=>`<div class="py-2 border-b border-slate-100 text-sm text-slate-600">• ${formatStudentShareDateThai(item.date)}${item.reason?` — เหตุผล: ${escapeHTML(item.reason)}`:' — <span class="text-slate-400">ไม่ได้ระบุเหตุผล</span>'}</div>`).join('')
                    : `<div class="text-center text-slate-400 py-8">ยังไม่มีข้อมูล</div>`;
            } else if(type==='bonus'){
                const list = data.bonusDetail || [];
                rows = list.length
                    ? list.map(d=>`<div class="flex justify-between items-center py-2 border-b border-slate-100 text-sm"><span class="text-slate-600">สัปดาห์ที่ ${escapeHTML(String(d.week))}</span><span class="font-bold text-emerald-600">+${window.formatScoreDisplay(d.val,2)} คะแนน</span></div>`).join('')
                        + `<div class="flex justify-between items-center pt-3 mt-2 border-t-2 border-emerald-100 font-black"><span>รวมโบนัส</span><span class="text-emerald-600">+${window.formatScoreDisplay(data.summary?.totalBonus||0,2)} คะแนน</span></div>`
                    : `<div class="text-center text-slate-400 py-8">ยังไม่มีคะแนนโบนัส</div>`;
            } else if(type==='star'){
                const list = data.starDetail || [];
                rows = list.length
                    ? list.map(d=>`<div class="flex justify-between items-center py-2 border-b border-slate-100 text-sm"><span class="text-slate-600">สัปดาห์ที่ ${escapeHTML(String(d.week))}</span><span class="font-bold text-amber-600">${d.stars} ⭐</span></div>`).join('')
                        + `<div class="flex justify-between items-center pt-3 mt-2 border-t-2 border-amber-100 font-black"><span>รวมดาว</span><span class="text-amber-600">${data.summary?.totalStars||0} ⭐</span></div>`
                    : `<div class="text-center text-slate-400 py-8">ยังไม่มีดาวสะสม</div>`;
            }
            bodyEl.innerHTML = rows;
            modal.classList.remove('hidden');
        };

        window.closeStudentShareDetailModal = function(){
            const modal = document.getElementById('student-share-detail-modal');
            if(modal) modal.classList.add('hidden');
        };

        window.__schoolhubStudentShareCountdownTimer = window.__schoolhubStudentShareCountdownTimer || null;

        function clearStudentShareCountdownTimer() {
            if (window.__schoolhubStudentShareCountdownTimer) {
                clearInterval(window.__schoolhubStudentShareCountdownTimer);
                window.__schoolhubStudentShareCountdownTimer = null;
            }
        }

        function renderStudentShareExpired(content) {
            clearStudentShareCountdownTimer();
            window.__studentShareCurrentData = null;

            if (!content) return;

            content.innerHTML = `
                <div class="text-center py-14">
                  <i class="fas fa-clock text-5xl text-rose-300 mb-4"></i>
                  <h2 class="text-2xl font-black text-slate-800">ลิงก์หมดอายุแล้ว</h2>
                  <p class="text-slate-500 mt-2">กรุณาขอลิงก์ใหม่จากครูผู้สอน</p>
                </div>
            `;
        }

        function renderStudentShareDisabled(content) {
            clearStudentShareCountdownTimer();
            window.__studentShareCurrentData = null;

            if (!content) return;

            content.innerHTML = `
                <div class="text-center py-14">
                  <i class="fas fa-ban text-5xl text-amber-300 mb-4"></i>
                  <h2 class="text-2xl font-black text-slate-800">ลิงก์นี้ถูกปิดใช้งานแล้ว</h2>
                  <p class="text-slate-500 mt-2">ครูผู้สอนได้ปิดการเข้าถึงลิงก์นี้ กรุณาขอลิงก์ใหม่จากครูผู้สอน</p>
                </div>
            `;
        }

        function formatStudentShareRemainingTime(ms) {
            const totalSeconds = Math.max(0, Math.floor(ms / 1000));
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            const pad = n => String(n).padStart(2, '0');

            if (hours > 0) {
                return `${hours}:${pad(minutes)}:${pad(seconds)}`;
            }

            return `${pad(minutes)}:${pad(seconds)}`;
        }

        async function loadPublicShareFromURL(){
            const params=new URLSearchParams(location.search);
            const token=params.get('share');
            if(!token)return false;

            clearStudentShareCountdownTimer();

            document.getElementById('global-loader').style.display='flex';
            document.getElementById('landing-view')?.classList.add('hidden');
            document.getElementById('auth-view')?.classList.add('hidden');
            document.getElementById('main-app')?.classList.add('hidden');

            const view=document.getElementById('public-share-view');
            const content=document.getElementById('public-share-content');
            view.classList.remove('hidden');

            try{
                const ref=getShareDocRef(token);
                const snap=await getDoc(ref);
                if(!snap.exists())throw new Error('not-found');

                const data=snap.data();
                const now=Date.now();

                if(data.disabled === true){
                    renderStudentShareDisabled(content);
                    document.getElementById('global-loader').style.display='none';
                    return true;
                }

                const expireMinutes = Math.max(1, Number(data.expireMinutes || 1));
                let firstViewedAt = Number(data.firstViewedAt || now);
                let expiresAt = Number(data.expiresAt || (firstViewedAt + expireMinutes * 60000));

                if(!data.firstViewedAt){
                    await setDoc(ref,{firstViewedAt,expiresAt},{merge:true});
                }

                if(now >= expiresAt){
                    renderStudentShareExpired(content);
                    document.getElementById('global-loader').style.display='none';
                    return true;
                }

                window.__studentShareCurrentData = data;
                const __bonusBadge = data.summary?.bonusMergeEnabled ? `<span style="position:absolute;top:8px;right:12px;font-size:10px;font-weight:800;color:#059669">+${window.formatScoreDisplay(data.summary.bonusMerged,2)} โบนัส</span>` : '';
                content.innerHTML=`<div class="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6"><div><h2 class="text-3xl font-black text-slate-900">${escapeHTML(data.student?.name||'')}</h2><p class="text-slate-500 font-mono mt-1">${escapeHTML(data.student?.code||'')} • ${escapeHTML(data.student?.grade||'')}</p><p class="text-primary font-bold mt-2">${escapeHTML(data.course?.code||'')} ${escapeHTML(data.course?.name||'')}</p></div><div id="student-share-countdown-box" class="bg-amber-50 text-amber-700 px-4 py-3 rounded-2xl font-bold text-sm"><i class="fas fa-clock"></i> เหลือเวลา <span id="student-share-countdown-text">--:--</span></div></div>${data.note?`<div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-5 text-slate-700"><b>หมายเหตุ:</b> ${escapeHTML(data.note)}</div>`:''}<div class="grid grid-cols-3 md:grid-cols-6 gap-3 mb-3"><div class="share-mini-card rounded-2xl p-4 text-center" style="cursor:pointer" onclick="showStudentShareStatDetail('present')" title="แตะเพื่อดูรายละเอียด"><div class="text-2xl font-black text-emerald-600">${data.summary?.present||0}</div><div class="text-xs text-slate-500">มา</div></div><div class="share-mini-card rounded-2xl p-4 text-center" style="cursor:pointer" onclick="showStudentShareStatDetail('late')" title="แตะเพื่อดูรายละเอียด"><div class="text-2xl font-black text-amber-600">${data.summary?.late||0}</div><div class="text-xs text-slate-500">สาย</div></div><div class="share-mini-card rounded-2xl p-4 text-center" style="cursor:pointer" onclick="showStudentShareStatDetail('absent')" title="แตะเพื่อดูรายละเอียด"><div class="text-2xl font-black text-rose-600">${data.summary?.absent||0}</div><div class="text-xs text-slate-500">ขาด</div></div><div class="share-mini-card rounded-2xl p-4 text-center" style="cursor:pointer" onclick="showStudentShareStatDetail('leave')" title="แตะเพื่อดูรายละเอียด"><div class="text-2xl font-black" style="color:#7c3aed">${data.summary?.leave||0}</div><div class="text-xs text-slate-500">ลา</div></div><div class="share-mini-card rounded-2xl p-4 text-center" style="cursor:pointer" onclick="showStudentShareStatDetail('bonus')" title="แตะเพื่อดูรายละเอียด"><div class="text-2xl font-black text-emerald-600">${(data.summary?.totalBonus||0)>0?'+'+window.formatScoreDisplay(data.summary.totalBonus,2):'-'}</div><div class="text-xs text-slate-500">โบนัส</div></div><div class="share-mini-card rounded-2xl p-4 text-center" style="cursor:pointer" onclick="showStudentShareStatDetail('star')" title="แตะเพื่อดูรายละเอียด"><div class="text-2xl font-black text-amber-600">${(data.summary?.totalStars||0)>0?(data.summary.totalStars+'⭐'):'-'}</div><div class="text-xs text-slate-500">ดาว</div></div></div><div class="share-mini-card rounded-2xl p-4 text-center mb-6" style="position:relative">${__bonusBadge}<div class="text-2xl font-black text-primary">${window.formatScoreDisplay(data.summary?.totalScore||0,2)}/${window.formatScoreDisplay(data.summary?.totalMax||0,2)}</div><div class="text-xs text-slate-500">คะแนนรวม${data.summary?.bonusMergeEnabled?' (รวมโบนัสแล้ว)':''}</div></div><div class="rounded-2xl border border-slate-200 overflow-hidden"><div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b"><div style="width:40px;flex-shrink:0">สัปดาห์</div><div style="flex:1 1 auto;min-width:0">งาน</div><div style="flex-shrink:0;max-width:40%;text-align:right">ผล</div></div>${(data.scoreRows||[]).map(r=>`<div style="display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-bottom:1px solid #f1f5f9"><div style="width:40px;flex-shrink:0;font-weight:700;color:#334155">${escapeHTML(String(r.week))}</div><div style="flex:1 1 auto;min-width:0;word-break:break-word;overflow-wrap:anywhere;color:#334155;font-size:12.5px;line-height:1.45">${escapeHTML(r.title||'')}</div><div style="flex-shrink:0;max-width:40%;text-align:right;font-weight:700;color:#4f46e5;word-break:break-word;overflow-wrap:anywhere">${escapeHTML(r.display||'-')}</div></div>`).join('')}</div><p class="text-xs text-slate-400 mt-5">แชร์โดย ${escapeHTML(data.teacherName||'ครูผู้สอน')}</p>`;

                clearStudentShareCountdownTimer();

                const countdownText = document.getElementById('student-share-countdown-text');
                const countdownBox = document.getElementById('student-share-countdown-box');

                function updateStudentShareCountdown() {
                    const remainingMs = Number(expiresAt || 0) - Date.now();

                    if (remainingMs <= 0) {
                        renderStudentShareExpired(content);

                        try {
                            setDoc(ref, { expiredAt: Date.now() }, { merge: true }).catch(() => {});
                        } catch (e) {}

                        return;
                    }

                    if (countdownText) {
                        countdownText.textContent = formatStudentShareRemainingTime(remainingMs);
                    }

                    if (countdownBox) {
                        countdownBox.title = `ลิงก์จะหมดอายุเวลา ${new Date(Number(expiresAt)).toLocaleString('th-TH')}`;
                    }
                }

                updateStudentShareCountdown();

                window.__schoolhubStudentShareCountdownTimer = setInterval(updateStudentShareCountdown, 1000);
            }catch(e){
                clearStudentShareCountdownTimer();
                content.innerHTML='<div class="text-center py-14"><i class="fas fa-triangle-exclamation text-5xl text-amber-300 mb-4"></i><h2 class="text-2xl font-black text-slate-800">เปิดข้อมูลไม่ได้</h2><p class="text-slate-500 mt-2">ลิงก์ไม่ถูกต้อง หรือระบบไม่อนุญาตให้อ่านข้อมูลสาธารณะ</p></div>';
            }

            document.getElementById('global-loader').style.display='none';
            return true;
        }

        window.initStaticDropdowns = () => {
            const planWeek = document.getElementById('plan-week');
            if (planWeek) {
                planWeek.innerHTML = '';
                for(let i=1; i<=20; i++) planWeek.innerHTML += `<option value="${i}">สัปดาห์ที่ ${i}</option>`;
            }
            const scoreWeek = document.getElementById('score-week');
            if (scoreWeek) {
                scoreWeek.innerHTML = '<option value="">-- เลือกสัปดาห์ --</option>';
                for(let i=1; i<=20; i++) scoreWeek.innerHTML += `<option value="${i}">สัปดาห์ที่ ${i}</option>`;
            }
        };
        window.initStaticDropdowns();

        window.showCustomAlert = (title, message, isError = false) => {
            const modal = document.getElementById('custom-alert');
            const box = document.getElementById('custom-alert-box');
            document.getElementById('custom-alert-title').textContent = title;
            document.getElementById('custom-alert-title').className = `text-2xl font-bold mb-2 ${isError ? 'text-rose-600' : 'text-emerald-600'}`;
            document.getElementById('custom-alert-message').textContent = message;
            document.getElementById('custom-alert-icon').innerHTML = isError ? '<i class="fas fa-times-circle text-rose-500 drop-shadow-md"></i>' : '<i class="fas fa-check-circle text-emerald-500 drop-shadow-md"></i>';
            document.body.appendChild(modal); modal.style.zIndex = '999999'; document.body.appendChild(modal); modal.style.zIndex = '999999'; modal.classList.remove('hidden');
            setTimeout(() => { box.classList.remove('scale-95', 'opacity-0'); box.classList.add('scale-100', 'opacity-100'); }, 10);
        }
        window.closeCustomAlert = () => {
            const modal = document.getElementById('custom-alert');
            const box = document.getElementById('custom-alert-box');
            if (box) {
                box.classList.remove('scale-100', 'opacity-100');
                box.classList.add('scale-95', 'opacity-0');
            }
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }

        window.showCustomConfirm = (title, message, confirmCallback, cancelCallback = null) => {
            const modal = document.getElementById('custom-confirm');
            const box = document.getElementById('custom-confirm-box');
            document.getElementById('custom-confirm-title').textContent = title;
            document.getElementById('custom-confirm-message').textContent = message;

            const confirmBtn = document.getElementById('custom-confirm-btn');
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            newConfirmBtn.addEventListener('click', () => { window.closeCustomConfirm(); confirmCallback(); });

            const cancelBtn = document.getElementById('custom-confirm-cancel-btn');
            if (cancelBtn) {
                const newCancelBtn = cancelBtn.cloneNode(true);
                cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
                newCancelBtn.addEventListener('click', () => {
                    window.closeCustomConfirm();
                    if (cancelCallback) cancelCallback();
                });
            }

            modal.classList.remove('hidden');
            setTimeout(() => { box.classList.remove('scale-95', 'opacity-0'); box.classList.add('scale-100', 'opacity-100'); }, 10);
        };
        window.closeCustomConfirm = () => {
            const modal = document.getElementById('custom-confirm');
            const box = document.getElementById('custom-confirm-box');
            box.classList.remove('scale-100', 'opacity-100'); box.classList.add('scale-95', 'opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 200);
        };

        function ensureSchoolHubPopupStacking(){
            ['custom-alert','custom-confirm'].forEach(id=>{const el=document.getElementById(id); if(el){el.style.zIndex='999999'; document.body.appendChild(el);}});
        }
        function toggleLoader(show) {
            const loader = document.getElementById('global-loader');
            if (loader) { loader.style.zIndex = '800000'; loader.style.display = show ? 'flex' : 'none'; }
            if (show) { shLoaderProgress(0, 'กำลังเชื่อมต่อข้อมูล...'); }
            else {
                const wrap = document.getElementById('sh-loader-progress-wrap');
                if (wrap) wrap.classList.remove('sh-loader-progress-active');
            }
        }

        // แถบโหลดเปอร์เซ็นต์จริง: อัปเดตตามความคืบหน้าจริงของการโหลดข้อมูล ไม่ใช่ตัวเลขสมมติ
        // ใช้ตอนรอ state.courses / state.students โหลดเสร็จก่อนเปิดหน้าแอปหลัก (เพื่อไม่ให้การ์ดรายชื่อว่างเปล่า)
        function shLoaderProgress(percent, label) {
            try {
                const wrap = document.getElementById('sh-loader-progress-wrap');
                const bar = document.getElementById('sh-loader-progress-bar');
                const pct = document.getElementById('sh-loader-progress-pct');
                const lbl = document.getElementById('sh-loader-progress-label');
                const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
                if (wrap) wrap.classList.add('sh-loader-progress-active');
                if (bar) bar.style.width = p + '%';
                if (pct) pct.textContent = p + '%';
                if (lbl && label) lbl.textContent = label;
            } catch (e) {}
        }
        window.shLoaderProgress = shLoaderProgress;
        window.openModal = (id) => {
            const m = document.getElementById(id); if(!m) return;
            document.body.appendChild(m);
            m.style.zIndex = '900000';
            m.classList.remove('hidden');
            const box = m.children[0]; if(box) { box.classList.add('scale-95', 'opacity-0'); setTimeout(()=>{box.classList.remove('scale-95', 'opacity-0'); box.classList.add('transition-all','duration-300');}, 10); }
        };
        window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
        window.toggleMobileMenu = () => document.getElementById('mobile-menu').classList.toggle('hidden');


        /* SchoolHub shared course accept + de-duplicate patch
           - ใช้เฉพาะระบบแชร์ครูในรายวิชา
           - กันข้อมูลซ้ำจากรายวิชาที่ถูกแชร์
           - ต้องกดตอบรับก่อนจึงเห็นรายวิชา */
        window.__schoolhubIncomingSharedCourses = [];
        function schoolhubNormEmail(v){ return String(v || '').trim().toLowerCase(); }
        function schoolhubNowISO(){ try { return new Date().toISOString(); } catch(e){ return String(Date.now()); } }
        function schoolhubGetCurrentEmail(){ return schoolhubNormEmail(currentUser && currentUser.email); }
        function schoolhubGetShareEntries(course){
            const src = course && course.sharedTeachers;
            if(!src) return [];
            if(Array.isArray(src)) return src.filter(Boolean).map(x => ({...x, email: schoolhubNormEmail(x.email)})).filter(x => x.email);
            if(typeof src === 'object') return Object.keys(src).map(email => ({...(src[email] || {}), email: schoolhubNormEmail(email)})).filter(x => x.email);
            return [];
        }
        function schoolhubSetShareEntries(course, entries){
            course.sharedTeachers = (entries || []).filter(x => x && x.email).map(x => ({
                email: schoolhubNormEmail(x.email),
                permission: x.permission === 'edit' ? 'edit' : 'view',
                status: x.status || 'pending',
                addedAt: x.addedAt || schoolhubNowISO(),
                addedBy: x.addedBy || (currentUser?.email || ''),
                respondedAt: x.respondedAt || null
            }));
        }
        function schoolhubShareForCurrentUser(course){
            const email = schoolhubGetCurrentEmail();
            if(!email) return null;
            return schoolhubGetShareEntries(course).find(x => schoolhubNormEmail(x.email) === email) || null;
        }
        function schoolhubIsSharedCourse(course){ return !!(course && course.__sharedOwnerKey); }
        function schoolhubSharedCourseKey(ownerKey, courseId){ return String(ownerKey || '') + '::' + String(courseId || ''); }
        function schoolhubCloneClean(obj){ return JSON.parse(JSON.stringify(obj || {})); }
        function schoolhubCloneGradeCriteria(obj){
            try {
                if (typeof structuredClone === 'function') return structuredClone(obj == null ? null : obj);
            } catch(e) {}
            try { return JSON.parse(JSON.stringify(obj == null ? null : obj)); }
            catch(_e) { return obj == null ? null : obj; }
        }
        function schoolhubHasStoredGradeCriteriaForHydrate(raw){
            if(raw && raw.gradeCriteria) raw = raw.gradeCriteria;
            if(!raw || typeof raw !== 'object') return false;
            if(Array.isArray(raw.gradeRules) || Array.isArray(raw.specialRules)) return true;
            if(raw.gradeFormat || raw.gradeType || raw.defaultGrade !== undefined || raw.updatedAt) return true;
            const legacyKeys = ['4','3.5','3','2.5','2','1.5','1','0','A','B+','B','C+','C','D+','D','F'];
            return legacyKeys.some(k => raw[k] !== undefined && raw[k] !== null && raw[k] !== '');
        }
        function schoolhubNormalizeGradeCriteriaForHydrate(raw){
            if(raw && raw.gradeCriteria) raw = raw.gradeCriteria;
            const src = (raw && typeof raw === 'object') ? raw : {};
            let gradeFormat = src.gradeFormat || src.gradeType || 'number';
            if(gradeFormat !== 'number' && gradeFormat !== 'letter' && gradeFormat !== 'custom') gradeFormat = 'number';
            let gradeRules = [];
            if(Array.isArray(src.gradeRules)){
                gradeRules = src.gradeRules.map(r => ({
                    label: String((r && (r.label ?? r.grade)) ?? '').trim(),
                    minScore: Number((r && (r.minScore ?? r.min)) ?? 0)
                })).filter(r => r.label !== '' && Number.isFinite(r.minScore));
            } else if(src && typeof src === 'object') {
                const base = gradeFormat === 'letter'
                    ? [{label:'A',minScore:80},{label:'B+',minScore:75},{label:'B',minScore:70},{label:'C+',minScore:65},{label:'C',minScore:60},{label:'D+',minScore:55},{label:'D',minScore:50},{label:'F',minScore:0}]
                    : [{label:'4',minScore:80},{label:'3.5',minScore:75},{label:'3',minScore:70},{label:'2.5',minScore:65},{label:'2',minScore:60},{label:'1.5',minScore:55},{label:'1',minScore:50},{label:'0',minScore:0}];
                gradeRules = base.filter(r => src[r.label] !== undefined && src[r.label] !== null && src[r.label] !== '').map(r => ({
                    label: r.label,
                    minScore: Number(src[r.label])
                })).filter(r => Number.isFinite(r.minScore));
            }
            gradeRules.sort((a,b) => Number(b.minScore || 0) - Number(a.minScore || 0));
            const specialRules = Array.isArray(src.specialRules) ? schoolhubCloneGradeCriteria(src.specialRules) : [];
            const defaultGrade = src.defaultGrade !== undefined && src.defaultGrade !== null
                ? String(src.defaultGrade)
                : (gradeFormat === 'letter' ? 'F' : '0');
            return {
                ...src,
                gradeFormat,
                gradeType: gradeFormat,
                gradeRules,
                specialRules,
                defaultGrade
            };
        }
        function schoolhubGetCriteriaTime(criteria){
            if(!criteria || !criteria.updatedAt) return 0;
            const t = new Date(criteria.updatedAt).getTime();
            return Number.isFinite(t) ? t : 0;
        }
        function schoolhubIsDefaultLikeGradeCriteria(criteria){
            if(!criteria || typeof criteria !== 'object') return false;
            const format = criteria.gradeFormat || criteria.gradeType || '';
            const defaultGrade = String(criteria.defaultGrade ?? '');
            const rules = Array.isArray(criteria.gradeRules) ? criteria.gradeRules : [];
            const specialRules = Array.isArray(criteria.specialRules) ? criteria.specialRules : [];
            const looksNumberDefault =
                format === 'number' &&
                defaultGrade === '0' &&
                rules.some(r => String(r.label ?? '') === '4' && Number(r.minScore ?? 0) === 80) &&
                rules.some(r => String(r.label ?? '') === '0' && Number(r.minScore ?? 0) === 0);
            return looksNumberDefault && !criteria.updatedAt && !specialRules.length;
        }
        function schoolhubChooseFinalGradeCriteria(courseCriteria, mapCriteria){
            const fromCourse = schoolhubHasStoredGradeCriteriaForHydrate(courseCriteria)
                ? schoolhubNormalizeGradeCriteriaForHydrate(courseCriteria)
                : null;
            const fromMap = schoolhubHasStoredGradeCriteriaForHydrate(mapCriteria)
                ? schoolhubNormalizeGradeCriteriaForHydrate(mapCriteria)
                : null;
            if(fromCourse && fromMap){
                const courseTime = schoolhubGetCriteriaTime(fromCourse);
                const mapTime = schoolhubGetCriteriaTime(fromMap);
                if(courseTime || mapTime) return mapTime >= courseTime ? fromMap : fromCourse;
                if(schoolhubIsDefaultLikeGradeCriteria(fromCourse) && !schoolhubIsDefaultLikeGradeCriteria(fromMap)) return fromMap;
                if(!schoolhubIsDefaultLikeGradeCriteria(fromCourse) && schoolhubIsDefaultLikeGradeCriteria(fromMap)) return fromCourse;
                return fromMap;
            }
            return fromMap || fromCourse || null;
        }
        function hydrateGradeCriteriaAfterLoad(options = {}) {
            try {
                state.courseGrades = state.courseGrades || {};
                (state.courses || []).forEach(course => {
                    if (!course || course.id === undefined || course.id === null) return;
                    const cid = String(course.id);
                    const rawCourseGradeCriteria = course.gradeCriteria || null;
                    const rawCourseGradesEntry = state.courseGrades ? state.courseGrades[cid] : null;
                    const finalCriteria = schoolhubChooseFinalGradeCriteria(rawCourseGradeCriteria, rawCourseGradesEntry);
                    if (finalCriteria) {
                        course.gradeCriteria = schoolhubCloneGradeCriteria(finalCriteria);
                        state.courseGrades[cid] = schoolhubCloneGradeCriteria(finalCriteria);
                    }
                    if (!options || options.log !== false) {
                        console.log('[GRADE LOAD] hydrate duplicated criteria after loadStateFromDB', {
                            courseId: cid,
                            courseName: course.name || course.code || '',
                            rawCourseGradeCriteria,
                            rawCourseGradesEntry,
                            selectedFinalCriteria: finalCriteria
                        });
                    }
                });
                if (!options || options.log !== false) {
                    console.log('[GRADE LOAD] loaded courses', state.courses);
                    console.log('[GRADE LOAD] loaded courseGrades', state.courseGrades);
                }
            } catch(e) { console.warn('[GRADE LOAD] hydrate grade criteria failed:', e); }
        }
        function hydrateGradeCriteriaIntoSavePayload(savePayload) {
            if(!savePayload) return savePayload;
            savePayload.courses = Array.isArray(savePayload.courses) ? savePayload.courses : [];
            savePayload.courseGrades = savePayload.courseGrades || {};
            savePayload.courses.forEach(course => {
                if(!course || course.id === undefined || course.id === null) return;
                const cid = String(course.id);
                const finalCriteria = schoolhubChooseFinalGradeCriteria(
                    course.gradeCriteria,
                    savePayload.courseGrades ? savePayload.courseGrades[cid] : null
                );
                if(finalCriteria){
                    course.gradeCriteria = schoolhubCloneGradeCriteria(finalCriteria);
                    savePayload.courseGrades[cid] = schoolhubCloneGradeCriteria(finalCriteria);
                }
            });
            return savePayload;
        }
        window.schoolhubCloneGradeCriteria = schoolhubCloneGradeCriteria;
        window.schoolhubHasStoredGradeCriteriaForHydrate = schoolhubHasStoredGradeCriteriaForHydrate;
        window.schoolhubNormalizeGradeCriteriaForHydrate = schoolhubNormalizeGradeCriteriaForHydrate;
        window.schoolhubChooseFinalGradeCriteria = schoolhubChooseFinalGradeCriteria;
        window.hydrateGradeCriteriaAfterLoad = hydrateGradeCriteriaAfterLoad;
        window.hydrateGradeCriteriaIntoSavePayload = hydrateGradeCriteriaIntoSavePayload;
        function schoolhubOwnStateOnly(){
            try { hydrateGradeCriteriaAfterLoad({log:false}); } catch(e) { console.warn('[GRADE SAVE] hydrate before owner state failed:', e); }
            const clean = {
                courses: (state.courses || []).filter(c => !schoolhubIsSharedCourse(c)).map(c => {
                    const cc = schoolhubCloneClean(c);
                    delete cc.__sharedOwnerKey; delete cc.__sharedOwnerName; delete cc.__sharedPermission; delete cc.__sharedStatus;
                    return cc;
                }),
                students: (state.students || []).filter(s => !s.__sharedOwnerKey).map(s => { const ss=schoolhubCloneClean(s); delete ss.__sharedOwnerKey; return ss; }),
                scores: (state.scores || []).filter(sc => !sc.__sharedOwnerKey).map(sc => { const x=schoolhubCloneClean(sc); delete x.__sharedOwnerKey; return x; }),
                attendance: {},
                coursePlans: {},
                courseGrades: {},
                bonusScores: {},
                starGroups: {},
                bonusMergeSettings: {}
            };
            const ownCourseIds = new Set(clean.courses.map(c => String(c.id)));
            // รายวิชาที่ "แชร์มาจากคนอื่น" เท่านั้นที่ควรถูกตัดออกจากข้อมูลของเรา
            // ใช้ deny-list (ตัดเฉพาะที่รู้แน่ชัดว่าเป็นของคนอื่น) แทน allow-list เดิม
            // เพื่อป้องกันข้อมูลโบนัส/ดาวหายไปเงียบๆ เมื่อ id ของวิชาไม่ตรงกันชั่วคราว
            // (เช่น หลังกู้คืน backup หรือระหว่างแก้ไขวิชา)
            const sharedCourseIds = new Set((state.courses || []).filter(c => schoolhubIsSharedCourse(c)).map(c => String(c.id)));
            Object.keys(state.attendance || {}).forEach(cid => { if(ownCourseIds.has(String(cid))) clean.attendance[cid] = schoolhubCloneClean(state.attendance[cid]); });
            Object.keys(state.coursePlans || {}).forEach(cid => { if(ownCourseIds.has(String(cid))) clean.coursePlans[cid] = schoolhubCloneClean(state.coursePlans[cid]); });
            Object.keys(state.courseGrades || {}).forEach(cid => { if(ownCourseIds.has(String(cid))) clean.courseGrades[cid] = schoolhubCloneClean(state.courseGrades[cid]); });
            Object.keys(state.bonusScores || {}).forEach(cid => { if(!sharedCourseIds.has(String(cid))) clean.bonusScores[cid] = schoolhubCloneClean(state.bonusScores[cid]); });
            Object.keys(state.starGroups || {}).forEach(cid => { if(!sharedCourseIds.has(String(cid))) clean.starGroups[cid] = schoolhubCloneClean(state.starGroups[cid]); });
            Object.keys(state.bonusMergeSettings || {}).forEach(cid => { if(!sharedCourseIds.has(String(cid))) clean.bonusMergeSettings[cid] = schoolhubCloneClean(state.bonusMergeSettings[cid]); });
            return clean;
        }
        function schoolhubRemoveSharedMergedData(){
            state.courses = (state.courses || []).filter(c => !schoolhubIsSharedCourse(c));
            state.students = (state.students || []).filter(s => !s.__sharedOwnerKey);
            state.scores = (state.scores || []).filter(s => !s.__sharedOwnerKey);
            Object.keys(state.attendance || {}).forEach(cid => {
                const c = (state.courses || []).find(x => String(x.id) === String(cid));
                if(c && c.__sharedOwnerKey) delete state.attendance[cid];
            });
            Object.keys(state.coursePlans || {}).forEach(cid => {
                const c = (state.courses || []).find(x => String(x.id) === String(cid));
                if(c && c.__sharedOwnerKey) delete state.coursePlans[cid];
            });
            Object.keys(state.courseGrades || {}).forEach(cid => {
                const c = (state.courses || []).find(x => String(x.id) === String(cid));
                if(c && c.__sharedOwnerKey) delete state.courseGrades[cid];
            });
            Object.keys(state.bonusScores || {}).forEach(cid => {
                const c = (state.courses || []).find(x => String(x.id) === String(cid));
                if(c && c.__sharedOwnerKey) delete state.bonusScores[cid];
            });
            Object.keys(state.starGroups || {}).forEach(cid => {
                const c = (state.courses || []).find(x => String(x.id) === String(cid));
                if(c && c.__sharedOwnerKey) delete state.starGroups[cid];
            });
            Object.keys(state.bonusMergeSettings || {}).forEach(cid => {
                const c = (state.courses || []).find(x => String(x.id) === String(cid));
                if(c && c.__sharedOwnerKey) delete state.bonusMergeSettings[cid];
            });
        }
        async function schoolhubReadOwnerState(ownerKey){
            if(!ownerKey) return null;
            try{
                const snap = await withTimeout(getDoc(doc(db, getPrivatePath(ownerKey), 'state')), 7000, 'readSharedOwnerState');
                return snap.exists() ? (snap.data() || {}) : null;
            }catch(e){ console.warn('read shared owner failed', ownerKey, e); return null; }
        }
        async function schoolhubWriteOwnerState(ownerKey, ownerState){
            if(!ownerKey || !ownerState) return;
            try { ownerState = hydrateGradeCriteriaIntoSavePayload(ownerState); } catch(e) { console.warn('[GRADE SAVE] hydrate shared owner payload failed:', e); }
            assertSafeState(ownerState);
            const ownerStateRef = doc(db, getPrivatePath(ownerKey), 'state');
            await schoolhubBackupStateBeforeSave(ownerStateRef, ownerState, ownerKey);
            await withTimeout(setDoc(ownerStateRef, ownerState), 8000, 'writeSharedOwnerState');
        }
        function schoolhubMergeAcceptedSharedCourse(ownerKey, ownerName, ownerState, course, share){
            const cid = String(course.id);
            state.courses = (state.courses || []).filter(c => !(schoolhubIsSharedCourse(c) && String(c.id) === cid && String(c.__sharedOwnerKey || '') === String(ownerKey || '')));
            const sharedCourse = schoolhubCloneClean(course);
            sharedCourse.__sharedOwnerKey = ownerKey;
            sharedCourse.__sharedOwnerName = ownerName || ownerKey;
            sharedCourse.__sharedPermission = share.permission === 'edit' ? 'edit' : 'view';
            sharedCourse.__sharedStatus = 'accepted';
            state.courses.push(sharedCourse);
            const courseRooms = Array.isArray(course.studentRooms) ? course.studentRooms : (Array.isArray(course.studentGrades) ? course.studentGrades : []);
            const extraIds = Array.isArray(course.extraStudentIds) ? course.extraStudentIds : [];
            const existingStudentIds = new Set((state.students || []).map(s => String(s.id)));
            (ownerState.students || []).forEach(st => {
                const room = String(st.room || st.grade || st.classroom || '').trim();
                if(courseRooms.map(String).includes(String(room)) || extraIds.map(String).includes(String(st.id))){
                    if(!existingStudentIds.has(String(st.id))){
                        const ss = schoolhubCloneClean(st); ss.__sharedOwnerKey = ownerKey; state.students.push(ss); existingStudentIds.add(String(st.id));
                    }
                }
            });
            state.scores = (state.scores || []).filter(sc => String(sc.courseId) !== cid);
            (ownerState.scores || []).filter(sc => String(sc.courseId) === cid).forEach(sc => { const x=schoolhubCloneClean(sc); x.__sharedOwnerKey=ownerKey; state.scores.push(x); });
            if(!state.attendance) state.attendance = {};
            if(!state.coursePlans) state.coursePlans = {};
            if(!state.courseGrades) state.courseGrades = {};
            state.attendance[cid] = schoolhubCloneClean((ownerState.attendance || {})[cid] || {});
            state.coursePlans[cid] = schoolhubCloneClean((ownerState.coursePlans || {})[cid] || []);
            state.courseGrades[cid] = schoolhubCloneClean((ownerState.courseGrades || {})[cid] || null);
            if(!state.bonusScores) state.bonusScores = {};
            if(!state.starGroups) state.starGroups = {};
            if(!state.bonusMergeSettings) state.bonusMergeSettings = {};
            state.bonusScores[cid] = schoolhubCloneClean((ownerState.bonusScores || {})[cid] || {});
            state.starGroups[cid] = schoolhubCloneClean((ownerState.starGroups || {})[cid] || {});
            state.bonusMergeSettings[cid] = schoolhubCloneClean((ownerState.bonusMergeSettings || {})[cid] || null);
        }
        async function schoolhubLoadSharedCoursesForCurrentUser(){
            window.__schoolhubIncomingSharedCourses = [];
            if(!currentUser || currentUser.uid === 'admin-bypass') return;
            const myEmail = schoolhubGetCurrentEmail();
            if(!myEmail) return;
            schoolhubRemoveSharedMergedData();
            const seen = new Set((state.courses || []).map(c => schoolhubSharedCourseKey(getUserKey(currentUser), c.id)));
            let users = [];
            try{
                const qs = await withTimeout(getDocs(collection(db, getPublicPath())), 8000, 'loadShareUsers');
                qs.forEach(d => users.push(d.data() || {}));
            }catch(e){ console.warn('load shared users failed', e); return; }
            for(const u of users){
                const ownerKey = u.userKey || u.email || u.uid;
                if(!ownerKey || String(ownerKey) === String(getUserKey(currentUser)) || schoolhubNormEmail(u.email) === myEmail) continue;
                const ownerState = await schoolhubReadOwnerState(ownerKey);
                if(!ownerState || !Array.isArray(ownerState.courses)) continue;
                for(const c of ownerState.courses){
                    const share = schoolhubGetShareEntries(c).find(x => x.email === myEmail);
                    if(!share || share.status === 'declined' || share.status === 'removed') continue;
                    const key = schoolhubSharedCourseKey(ownerKey, c.id);
                    if(seen.has(key)) continue;
                    const item = { ownerKey, ownerName: u.name || u.email || ownerKey, courseId: c.id, courseName: c.name || '', courseCode: c.code || '', permission: share.permission === 'edit' ? 'edit' : 'view', status: share.status || 'pending' };
                    if(item.status === 'accepted'){
                        schoolhubMergeAcceptedSharedCourse(ownerKey, item.ownerName, ownerState, c, share);
                        seen.add(key);
                    }else{
                        window.__schoolhubIncomingSharedCourses.push(item);
                    }
                }
            }
            setTimeout(schoolhubRenderIncomingShares, 80);
        }
        async function schoolhubSetSharedTeacherStatus(ownerKey, courseId, status){
            if(!currentUser) return;
            toggleLoader(true);
            try{
                const ownerState = await schoolhubReadOwnerState(ownerKey);
                if(!ownerState) throw new Error('ไม่พบข้อมูลเจ้าของรายวิชา');
                const course = (ownerState.courses || []).find(c => String(c.id) === String(courseId));
                if(!course) throw new Error('ไม่พบรายวิชาที่แชร์');
                const myEmail = schoolhubGetCurrentEmail();
                const entries = schoolhubGetShareEntries(course);
                const idx = entries.findIndex(x => x.email === myEmail);
                if(idx < 0) throw new Error('ไม่พบคำเชิญแชร์รายวิชานี้');
                entries[idx].status = status === 'accepted' ? 'accepted' : 'declined';
                entries[idx].respondedAt = schoolhubNowISO();
                schoolhubSetShareEntries(course, entries);
                await schoolhubWriteOwnerState(ownerKey, ownerState);
                await schoolhubLoadSharedCoursesForCurrentUser();
                updateGlobalViews();
                showCustomAlert(status === 'accepted' ? 'ตอบรับแล้ว' : 'ปฏิเสธแล้ว', status === 'accepted' ? 'เพิ่มรายวิชาที่แชร์เข้าหน้าหลักแล้ว' : 'ซ่อนคำเชิญนี้แล้ว');
            }catch(e){ showCustomAlert('ดำเนินการไม่ได้', getFirebaseErrorText(e) || e.message || String(e), true); }
            toggleLoader(false);
        }
        window.acceptSharedCourseInvite = (ownerKey, courseId) => schoolhubSetSharedTeacherStatus(ownerKey, courseId, 'accepted');
        window.declineSharedCourseInvite = (ownerKey, courseId) => schoolhubSetSharedTeacherStatus(ownerKey, courseId, 'declined');
        function schoolhubRenderIncomingShares(){
            const grid = document.getElementById('course-grid');
            if(!grid) return;
            let box = document.getElementById('schoolhub-incoming-course-shares');
            const items = window.__schoolhubIncomingSharedCourses || [];
            if(!items.length){ if(box) box.remove(); return; }
            if(!box){
                box = document.createElement('div');
                box.id = 'schoolhub-incoming-course-shares';
                box.className = 'mb-5 bg-amber-50 border border-amber-200 rounded-[1.5rem] p-4 md:p-5';
                grid.parentElement.insertBefore(box, grid);
            }
            box.innerHTML = `<div class="flex items-center gap-3 mb-3"><div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center"><i class="fas fa-user-clock"></i></div><div><h3 class="font-black text-slate-800">คำเชิญแชร์รายวิชา</h3><p class="text-xs text-slate-500">กดตอบรับก่อน รายวิชาจึงจะแสดงในหน้าหลัก</p></div></div>` + items.map(it => `<div class="bg-white border border-amber-100 rounded-2xl p-4 mb-2 flex flex-col md:flex-row md:items-center justify-between gap-3"><div><div class="font-black text-slate-800">${escapeHTML(it.courseCode)} ${escapeHTML(it.courseName)}</div><div class="text-xs text-slate-500 mt-1">แชร์โดย ${escapeHTML(it.ownerName)} • สิทธิ์: ${it.permission === 'edit' ? 'แก้ไขได้' : 'ดูอย่างเดียว'}</div></div><div class="flex gap-2"><button type="button" onclick="acceptSharedCourseInvite('${String(it.ownerKey).replace(/'/g,'\\\'')}','${String(it.courseId).replace(/'/g,'\\\'')}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold"><i class="fas fa-check mr-1"></i>ตอบรับ</button><button type="button" onclick="declineSharedCourseInvite('${String(it.ownerKey).replace(/'/g,'\\\'')}','${String(it.courseId).replace(/'/g,'\\\'')}')" class="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold"><i class="fas fa-times mr-1"></i>ปฏิเสธ</button></div></div>`).join('');
        }
        function schoolhubCurrentCourse(){ return (state.courses || []).find(c => String(c.id) === String(currentActiveCourseId)); }
        function schoolhubCurrentCourseRole(){
            const c = schoolhubCurrentCourse();
            if(!c) return 'owner';
            if(!schoolhubIsSharedCourse(c)) return 'owner';
            return c.__sharedPermission === 'edit' ? 'edit' : 'view';
        }
        function schoolhubCanManageTeachers(){ return schoolhubCurrentCourseRole() === 'owner'; }
        function schoolhubCanEditCurrentCourse(){ const r = schoolhubCurrentCourseRole(); return r === 'owner' || r === 'edit'; }
        function schoolhubAssertCanEditCourse(courseId, actionName){
            const c = (state.courses || []).find(x => String(x.id) === String(courseId || currentActiveCourseId));
            if(!c) return true;
            if(!schoolhubIsSharedCourse(c)) return true;
            if(c.__sharedPermission === 'edit') return true;
            const action = actionName || 'แก้ไขข้อมูล';
            if(typeof showCustomAlert === 'function') showCustomAlert('ดูอย่างเดียว', `รายวิชานี้ถูกแชร์แบบดูอย่างเดียว จึงไม่สามารถ${action}ได้`, true);
            else alert(`รายวิชานี้ถูกแชร์แบบดูอย่างเดียว จึงไม่สามารถ${action}ได้`);
            return false;
        }
        window.schoolhubCanEditCurrentCourse = schoolhubCanEditCurrentCourse;
        window.schoolhubAssertCanEditCourse = schoolhubAssertCanEditCourse;
        function schoolhubApplyReadonlyUI(){
            const c = schoolhubCurrentCourse();
            const detail = document.getElementById('view-course-detail');
            if(!detail || !c) return;
            const isView = schoolhubCurrentCourseRole() === 'view';
            const teacherBtn = document.getElementById('course-teachers-manage-btn');
            if(teacherBtn) teacherBtn.classList.toggle('hidden', !schoolhubCanManageTeachers());
            detail.querySelectorAll('input, textarea, select, button').forEach(el => {
                if(el.id === 'course-back-btn' || el.classList.contains('course-tab-btn') || el.classList.contains('mobile-course-tab-btn')) return;
                if(el.id === 'course-teachers-manage-btn') return;
                if(el.classList.contains('week-detail-btn')) return;
                if(isView){ el.disabled = true; el.classList.add('opacity-60','pointer-events-none'); }
                else { el.disabled = false; el.classList.remove('opacity-60','pointer-events-none'); }
            });
            const noteId = 'schoolhub-readonly-note';
            let note = document.getElementById(noteId);
            if(isView){
                if(!note){ note = document.createElement('div'); note.id = noteId; note.className = 'mb-4 bg-sky-50 border border-sky-100 text-sky-700 rounded-2xl p-3 text-sm font-bold'; detail.prepend(note); }
                note.innerHTML = '<i class="fas fa-eye mr-1"></i> รายวิชานี้ถูกแชร์แบบดูอย่างเดียว จึงแก้ไขข้อมูลไม่ได้';
            }else if(note){ note.remove(); }
        }
        function schoolhubEnsureCourseTeacherButton(){
            const actions = document.getElementById('header-actions');
            if(!actions || document.getElementById('course-teachers-manage-btn')) return;
            if(!schoolhubCanManageTeachers()) return;
            const btn = document.createElement('button');
            btn.id = 'course-teachers-manage-btn';
            btn.type = 'button';
            btn.onclick = window.openCourseTeachersModal;
            btn.className = 'bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm flex items-center gap-2';
            btn.innerHTML = '<i class="fas fa-chalkboard-user"></i> <span><span class="mobile-hide-text">จัดการครูในรายวิชา</span></span>';
            actions.appendChild(btn);
        }
        window.openCourseTeachersModal = function(){
            const c = schoolhubCurrentCourse();
            if(!c) return;
            if(!schoolhubCanManageTeachers()) return showCustomAlert('ไม่มีสิทธิ์', 'เฉพาะเจ้าของรายวิชาเท่านั้นที่จัดการครูได้', true);
            const email = document.getElementById('course-teacher-email');
            const perm = document.getElementById('course-teacher-permission');
            if(email) email.value = '';
            if(perm) perm.value = 'view';
            window.renderCourseTeachersList();
            window.openModal('course-teachers-modal');
        };
        window.closeCourseTeachersModal = function(){ window.closeModal('course-teachers-modal'); };
        window.renderCourseTeachersList = function(){
            const c = schoolhubCurrentCourse();
            const list = document.getElementById('course-teachers-list');
            const count = document.getElementById('course-teachers-count');
            if(!list || !c) return;
            const entries = schoolhubGetShareEntries(c).filter(x => x.status !== 'removed');
            if(count) count.textContent = entries.length ? `${entries.length} คน` : 'ยังไม่มี';
            if(!entries.length){ list.innerHTML = '<div class="text-center text-slate-400 p-6 bg-slate-50 rounded-2xl">ยังไม่ได้เพิ่มครูในรายวิชานี้</div>'; return; }
            list.innerHTML = entries.map(x => `<div class="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between"><div><div class="font-black text-slate-800">${escapeHTML(x.email)}</div><div class="text-xs text-slate-500 mt-1">สิทธิ์: <b>${x.permission === 'edit' ? 'แก้ไขได้' : 'ดูอย่างเดียว'}</b> • สถานะ: <b>${x.status === 'accepted' ? 'ตอบรับแล้ว' : (x.status === 'declined' ? 'ปฏิเสธแล้ว' : 'รอตอบรับ')}</b></div></div><div class="flex flex-wrap gap-2"><button type="button" onclick="changeCourseTeacherPermission('${String(x.email).replace(/'/g,'\\\'')}')" class="bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-2 rounded-xl text-xs font-bold"><i class="fas fa-repeat mr-1"></i>เปลี่ยนสิทธิ์</button><button type="button" onclick="removeCourseTeacher('${String(x.email).replace(/'/g,'\\\'')}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-2 rounded-xl text-xs font-bold"><i class="fas fa-trash mr-1"></i>ลบ</button></div></div>`).join('');
        };
        window.addCourseTeacher = async function(){
            const c = schoolhubCurrentCourse();
            if(!c) return;
            if(!schoolhubCanManageTeachers()) return showCustomAlert('ไม่มีสิทธิ์', 'เฉพาะเจ้าของรายวิชาเท่านั้นที่เพิ่มครูได้', true);
            const email = schoolhubNormEmail(document.getElementById('course-teacher-email')?.value);
            const permission = document.getElementById('course-teacher-permission')?.value === 'edit' ? 'edit' : 'view';
            if(!email || !email.includes('@')) return showCustomAlert('อีเมลไม่ถูกต้อง', 'กรุณากรอกอีเมลครูให้ถูกต้อง', true);
            if(email === schoolhubGetCurrentEmail()) return showCustomAlert('เพิ่มไม่ได้', 'ไม่ต้องแชร์รายวิชาให้ตัวเอง', true);
            const entries = schoolhubGetShareEntries(c).filter(x => x.email !== email);
            entries.push({ email, permission, status:'pending', addedAt: schoolhubNowISO(), addedBy: currentUser?.email || '' });
            schoolhubSetShareEntries(c, entries);
            await saveStateToDB();
            window.renderCourseTeachersList();
            showCustomAlert('ส่งคำเชิญแล้ว', 'ครูปลายทางจะเห็นปุ่มตอบรับการแชร์เมื่อเข้าสู่ระบบด้วยอีเมลนี้');
        };
        window.changeCourseTeacherPermission = async function(email){
            const c = schoolhubCurrentCourse(); if(!c) return;
            if(!schoolhubCanManageTeachers()) return;
            const entries = schoolhubGetShareEntries(c);
            const idx = entries.findIndex(x => x.email === schoolhubNormEmail(email));
            if(idx < 0) return;
            entries[idx].permission = entries[idx].permission === 'edit' ? 'view' : 'edit';
            schoolhubSetShareEntries(c, entries);
            await saveStateToDB();
            window.renderCourseTeachersList();
        };
        window.removeCourseTeacher = async function(email){
            const c = schoolhubCurrentCourse(); if(!c) return;
            if(!schoolhubCanManageTeachers()) return;
            window.showCustomConfirm('ลบครูออกจากรายวิชา', 'ยืนยันลบครูคนนี้ออกจากรายวิชา?', async () => {
                const entries = schoolhubGetShareEntries(c).filter(x => x.email !== schoolhubNormEmail(email));
                schoolhubSetShareEntries(c, entries);
                await saveStateToDB();
                window.renderCourseTeachersList();
                showCustomAlert('ลบแล้ว','ลบครูออกจากรายวิชาแล้ว');
            });
        };
        async function schoolhubSaveSharedOwnerStatesFromMergedState(){
            if(!currentUser || currentUser.uid === 'admin-bypass') return;
            const sharedCourses = (state.courses || []).filter(c => schoolhubIsSharedCourse(c) && c.__sharedPermission === 'edit');
            const owners = [...new Set(sharedCourses.map(c => c.__sharedOwnerKey).filter(Boolean))];
            for(const ownerKey of owners){
                const ownerState = await schoolhubReadOwnerState(ownerKey);
                if(!ownerState) continue;
                sharedCourses.filter(c => c.__sharedOwnerKey === ownerKey).forEach(c => {
                    const cid = String(c.id);
                    const idx = (ownerState.courses || []).findIndex(x => String(x.id) === cid);
                    if(idx >= 0){
                        const keepShares = ownerState.courses[idx].sharedTeachers;
                        const cleanCourse = schoolhubCloneClean(c);
                        delete cleanCourse.__sharedOwnerKey; delete cleanCourse.__sharedOwnerName; delete cleanCourse.__sharedPermission; delete cleanCourse.__sharedStatus;
                        cleanCourse.sharedTeachers = keepShares;
                        ownerState.courses[idx] = cleanCourse;
                    }
                    ownerState.scores = (ownerState.scores || []).filter(sc => String(sc.courseId) !== cid).concat((state.scores || []).filter(sc => String(sc.courseId) === cid).map(sc => { const x=schoolhubCloneClean(sc); delete x.__sharedOwnerKey; return x; }));
                    ownerState.attendance = ownerState.attendance || {}; ownerState.attendance[cid] = schoolhubCloneClean((state.attendance || {})[cid] || {});
                    ownerState.coursePlans = ownerState.coursePlans || {}; ownerState.coursePlans[cid] = schoolhubCloneClean((state.coursePlans || {})[cid] || []);
                    ownerState.courseGrades = ownerState.courseGrades || {}; ownerState.courseGrades[cid] = schoolhubCloneClean((state.courseGrades || {})[cid] || null);
                    const currentById = new Map((ownerState.students || []).map(st => [String(st.id), st]));
                    (state.students || []).filter(st => !st.__sharedOwnerKey || st.__sharedOwnerKey === ownerKey).forEach(st => {
                        if(currentById.has(String(st.id))){ const cleanSt=schoolhubCloneClean(st); delete cleanSt.__sharedOwnerKey; currentById.set(String(st.id), cleanSt); }
                    });
                    ownerState.students = Array.from(currentById.values());
                });
                const gradeDebugCid = String(window.__schoolhubGradeCriteriaSaveInProgressCourseId || '');
                const isGradeCriteriaSave = !!window.__schoolhubGradeCriteriaSaveInProgress;
                if(isGradeCriteriaSave){
                    const ownerPayloadCourse = (ownerState.courses || []).find(c => String(c && c.id) === gradeDebugCid) || null;
                    console.log('[GRADE SAVE] shared owner payload before Firebase setDoc', {
                        ownerKey,
                        courseId: gradeDebugCid,
                        courseGradeCriteria: ownerPayloadCourse && ownerPayloadCourse.gradeCriteria ? ownerPayloadCourse.gradeCriteria : null,
                        courseGradesEntry: ownerState.courseGrades ? ownerState.courseGrades[gradeDebugCid] : null
                    });
                }
                await schoolhubWriteOwnerState(ownerKey, ownerState);
                if(isGradeCriteriaSave){
                    try{
                        const ownerSnap = await withTimeout(getDoc(doc(db, getPrivatePath(ownerKey), 'state')), 8000, 'verifySharedOwnerGradeCriteriaSave');
                        const ownerData = ownerSnap.exists() ? (ownerSnap.data() || {}) : {};
                        const ownerCourse = (ownerData.courses || []).find(c => String(c && c.id) === gradeDebugCid) || null;
                        console.log('[GRADE SAVE] shared owner Firebase readback after save', {
                            ownerKey,
                            courseId: gradeDebugCid,
                            hasCourseGradeCriteria: !!(ownerCourse && ownerCourse.gradeCriteria),
                            courseGradeCriteria: ownerCourse && ownerCourse.gradeCriteria ? ownerCourse.gradeCriteria : null,
                            courseGradesEntry: ownerData.courseGrades ? ownerData.courseGrades[gradeDebugCid] : null
                        });
                    }catch(ownerVerifyErr){
                        console.warn('[GRADE SAVE] shared owner Firebase readback failed after save', ownerVerifyErr);
                    }
                }
            }
        }
        window.schoolhubApplyReadonlyUI = schoolhubApplyReadonlyUI;
        window.schoolhubEnsureCourseTeacherButton = schoolhubEnsureCourseTeacherButton;

        // ===== ระบบป้องกันข้อมูลถูกเขียนทับด้วย state ว่าง =====
        function assertSafeState(state) {
            if (!state || typeof state !== 'object') {
                console.error('SAVE BLOCKED\nReason: Empty state detected\nNo data was written to Firestore.', state);
                throw new Error('Blocked: invalid state');
            }
            const required = ['courses', 'students', 'attendance', 'scores'];
            let hasData = false;
            for (const key of required) {
                const value = state[key];
                if (Array.isArray(value) && value.length) { hasData = true; break; }
                if (value && typeof value === 'object' && Object.keys(value).length) { hasData = true; break; }
            }
            if (!hasData) {
                console.error('SAVE BLOCKED\nReason: Empty state detected\nNo data was written to Firestore.', state);
                alert('ระบบป้องกันข้อมูลทำงาน\nพบว่าข้อมูลที่กำลังจะบันทึกว่าง จึงยกเลิกการบันทึก');
                throw new Error('Blocked empty state');
            }
            return state;
        }

        async function schoolhubBackupStateBeforeSave(stateRef, payload, userKey) {
            try {
                const backupRef = doc(db, 'users', userKey, 'school_data_backups', String(Date.now()));
                await withTimeout(setDoc(backupRef, Object.assign({}, payload, { _backedUpAt: Date.now() })), 8000, 'backupState');
            } catch(backupErr) {
                console.error('SAVE BLOCKED\nReason: Backup failed\nNo data was written to Firestore.', backupErr);
                throw new Error('Backup ล้มเหลว จึงยกเลิกการบันทึก state: ' + (backupErr && backupErr.message || backupErr));
            }
        }
        // ===== สิ้นสุดระบบป้องกัน =====

        async function saveStateToDB() {
            if (window.__schoolhubPlanLocked && !isAdmin) { showCustomAlert('บัญชีถูกล็อก', 'แผนของคุณหมดรอบใช้งานแล้ว กรุณาต่ออายุหรือเลือกแผนใหม่ก่อนแก้ไขข้อมูล', true); return false; }
            if (!currentUser || currentUser.uid === 'admin-bypass') return true;
            try { if (typeof window.toggleLoader === 'function') window.toggleLoader(true); } catch(e){}
            try {
                let savePayload = schoolhubOwnStateOnly();
                try { savePayload = hydrateGradeCriteriaIntoSavePayload(savePayload); } catch(e) { console.warn('[GRADE SAVE] hydrate own payload failed:', e); }
                const gradeDebugCid = String(window.__schoolhubGradeCriteriaSaveInProgressCourseId || '');
                const isGradeCriteriaSave = !!window.__schoolhubGradeCriteriaSaveInProgress;
                if (isGradeCriteriaSave) {
                    const payloadCourse = (savePayload.courses || []).find(c => String(c && c.id) === gradeDebugCid) || null;
                    console.log('[GRADE SAVE] payload before Firebase setDoc', {
                        courseId: gradeDebugCid,
                        courseGradeCriteria: payloadCourse && payloadCourse.gradeCriteria ? payloadCourse.gradeCriteria : null,
                        courseGradesEntry: savePayload.courseGrades ? savePayload.courseGrades[gradeDebugCid] : null,
                        payload: savePayload
                    });
                }

                const ownerUserKey = getUserKey(currentUser);
                const stateRef = doc(db, getPrivatePath(ownerUserKey), 'state');
                assertSafeState(savePayload);
                await schoolhubBackupStateBeforeSave(stateRef, savePayload, ownerUserKey);
                await withTimeout(setDoc(stateRef, savePayload), 8000, 'saveState');
                if (isGradeCriteriaSave) console.log('[GRADE SAVE] Firebase setDoc resolved for own state', { courseId: gradeDebugCid });

                await schoolhubSaveSharedOwnerStatesFromMergedState();
                if (isGradeCriteriaSave) {
                    try {
                        const verifySnap = await withTimeout(getDoc(stateRef), 8000, 'verifyGradeCriteriaSave');
                        const verifyData = verifySnap.exists() ? (verifySnap.data() || {}) : {};
                        const verifyCourse = (verifyData.courses || []).find(c => String(c && c.id) === gradeDebugCid) || null;
                        const verifyCourseGradeCriteria = verifyCourse && verifyCourse.gradeCriteria ? verifyCourse.gradeCriteria : null;
                        const verifyCourseGradesEntry = verifyData.courseGrades ? verifyData.courseGrades[gradeDebugCid] : null;
                        console.log('[GRADE SAVE] Firebase readback after save', {
                            courseId: gradeDebugCid,
                            hasCourseGradeCriteria: !!verifyCourseGradeCriteria,
                            courseGradeCriteria: verifyCourseGradeCriteria,
                            courseGradesEntry: verifyCourseGradesEntry
                        });
                        if(!verifyCourseGradeCriteria || !verifyCourseGradesEntry){
                            throw new Error('Firebase readback ไม่พบ gradeCriteria ครบทั้ง courses[index].gradeCriteria และ courseGrades[courseId]');
                        }
                    } catch(verifyErr) {
                        console.warn('[GRADE SAVE] Firebase readback failed after save', verifyErr);
                    }
                }
                return true;
            }
            catch (error) {
                window.__schoolhubLastSaveStateError = error;
                console.error('saveStateToDB failed:', error);
                if (!window.__schoolhubSuppressSaveStateAlert) {
                    showCustomAlert("ผิดพลาด", getFirebaseErrorText(error) || "ข้อมูลไม่ถูกบันทึกลง Cloud โปรดตรวจสอบอินเทอร์เน็ตหรือ Firestore Rules", true);
                }
                return false;
            }
            finally {
                try { if (typeof window.toggleLoader === 'function') window.toggleLoader(false); } catch(e){}
            }
        }
        window.saveStateToDB = saveStateToDB;
        /* expose Firebase internals สำหรับ module อื่น */
        window.__shDB = db;
        window.__shDoc = doc;
        window.__shSetDoc = setDoc;
        window.__shGetDoc = getDoc;
        window.__shGetDocs = getDocs;
        window.__shCollection = collection;
        window.__shQuery = query;
        window.__shWhere = where;
        window.__shOrderBy = orderBy;
        window.__shDeleteDoc = deleteDoc;
        window.__shGetCurrentUser = () => currentUser;
        window.__shGetUserKey = () => (currentUser ? getUserKey(currentUser) : '');
        window.__shGetIsAdmin = () => isAdmin;

        async function loadStateFromDB() {
            if (!currentUser || currentUser.uid === 'admin-bypass') { updateGlobalViews(); return; }
            try {
                shLoaderProgress(15, 'กำลังดึงข้อมูลรายวิชา...');
                const docSnap = await withTimeout(getDoc(doc(db, getPrivatePath(getUserKey(currentUser)), 'state')), 8000, 'loadState');
                shLoaderProgress(55, 'กำลังเตรียมการ์ดรายชื่อ...');
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    state.courses = data.courses || []; state.students = data.students || [];
                    state.scores = data.scores || []; state.attendance = data.attendance || {}; state.coursePlans = data.coursePlans || {};
                    state.courseGrades = data.courseGrades || {};
                    state.bonusScores = data.bonusScores || {};
                    state.starGroups = data.starGroups || {};
                    state.bonusMergeSettings = data.bonusMergeSettings || {};
                    hydrateGradeCriteriaAfterLoad();
                    window.state = state;
                } else {
                    state = { courses: [], students: [], scores: [], attendance: {}, coursePlans: {}, courseGrades: {}, bonusScores: {}, starGroups: {}, bonusMergeSettings: {} };
                    window.state = state;
                    await saveStateToDB();
                }
            } catch (error) {
                console.warn('loadStateFromDB failed:', error);
                const msg = getFirebaseErrorText(error);
                const isPermission = (error?.code === 'permission-denied') || String(error?.message || '').includes('Missing or insufficient permissions');
                const hasInviteParams = (() => {
                    try {
                        const p = new URLSearchParams(location.search);
                        return !!(p.get('teamInvite') || p.get('teamOwner') || p.get('teamEmail'));
                    } catch(e) { return false; }
                })();
                /*
                  ผู้ใช้ใหม่/ผู้ถูกเชิญอาจยังไม่มีพื้นที่ข้อมูลส่วนตัวใน users/{email}/school_data
                  ถ้าเกิด permission ระหว่างเปิดหน้าแผนหรือเปิดลิงก์เชิญ ห้ามเด้ง popup บังหน้า
                  ให้ใช้ state ว่างก่อน แล้วให้ระบบคำเชิญ/หน้าแผนทำงานต่อ
                */
                if (isPermission && (hasInviteParams || window.__schoolhubPlanLocked || document.getElementById('view-user-plans'))) {
                    state = state || { courses: [], students: [], scores: [], attendance: {}, coursePlans: {}, courseGrades: {} };
                    window.state = state;
                    setTimeout(() => { try { window.refreshIncomingInvites && window.refreshIncomingInvites(); } catch(e){} }, 300);
                } else {
                    showCustomAlert("ดึงข้อมูลออนไลน์ไม่ได้", msg, true);
                }
            } finally {
                shLoaderProgress(70, 'กำลังโหลดรายวิชาที่แชร์...');
                await schoolhubLoadSharedCoursesForCurrentUser();
                updateGlobalViews();
                shLoaderProgress(85, 'การ์ดรายชื่อพร้อมแล้ว...');
            }
        }

        window.loadStateFromDB = loadStateFromDB;

        // ===== ระบบกู้ข้อมูลจาก Backup =====
        async function schoolhubListBackups() {
            if (!currentUser) throw new Error('กรุณาเข้าสู่ระบบก่อน');
            const userKey = getUserKey(currentUser);
            const col = collection(db, 'users', userKey, 'school_data_backups');
            const snap = await withTimeout(getDocs(col), 12000, 'listBackups');
            const docs = [];
            snap.forEach(d => { docs.push({ id: d.id, data: d.data() }); });
            docs.sort((a, b) => Number(b.id) - Number(a.id)); // newest first
            return docs;
        }

        async function schoolhubRestoreFromBackup(backupId) {
            if (!currentUser) throw new Error('กรุณาเข้าสู่ระบบก่อน');
            const userKey = getUserKey(currentUser);
            const backupRef = doc(db, 'users', userKey, 'school_data_backups', String(backupId));
            const snap = await withTimeout(getDoc(backupRef), 10000, 'restoreBackup');
            if (!snap.exists()) throw new Error('ไม่พบข้อมูล Backup นี้');
            const data = snap.data();
            // อัปเดต state ในหน่วยความจำก่อน เพื่อให้ UI ใช้ข้อมูลที่กู้คืนได้ทันที
            state.courses = data.courses || [];
            state.students = data.students || [];
            state.scores = data.scores || [];
            state.attendance = data.attendance || {};
            state.coursePlans = data.coursePlans || {};
            state.courseGrades = data.courseGrades || {};
            state.bonusScores = data.bonusScores || {};
            state.starGroups = data.starGroups || {};
            state.bonusMergeSettings = data.bonusMergeSettings || {};
            try { hydrateGradeCriteriaAfterLoad(); } catch(e) {}
            window.state = state;

            // เขียนข้อมูลจาก Backup กลับลง Firestore "ตรงๆ" แทนที่จะพึ่ง saveStateToDB()
            // (ซึ่งจะกรองข้อมูลผ่าน schoolhubOwnStateOnly() อีกรอบ) เพื่อป้องกันความเสี่ยง
            // ที่ข้อมูลโบนัส/ดาวในไฟล์ Backup จะถูกกรองทิ้งซ้ำหากรหัสวิชาไม่ตรงกันชั่วคราว
            // เนื่องจากข้อมูลใน Backup เป็นข้อมูล "ของเราเอง" ที่ผ่านการกรองไว้แล้วตั้งแต่ตอนสำรอง
            const restorePayload = {
                courses: data.courses || [],
                students: data.students || [],
                scores: data.scores || [],
                attendance: data.attendance || {},
                coursePlans: data.coursePlans || {},
                courseGrades: data.courseGrades || {},
                bonusScores: data.bonusScores || {},
                starGroups: data.starGroups || {},
                bonusMergeSettings: data.bonusMergeSettings || {}
            };
            assertSafeState(restorePayload);
            const ownerUserKey = getUserKey(currentUser);
            const stateRef = doc(db, getPrivatePath(ownerUserKey), 'state');
            await schoolhubBackupStateBeforeSave(stateRef, restorePayload, ownerUserKey);
            await withTimeout(setDoc(stateRef, restorePayload), 8000, 'restoreState');

            updateGlobalViews();
            try { if (typeof window.renderCourseOverview === 'function') window.renderCourseOverview(); } catch(e) {}
        }

        window.schoolhubListBackups = schoolhubListBackups;
        window.schoolhubRestoreFromBackup = schoolhubRestoreFromBackup;
        // ===== สิ้นสุดระบบกู้ข้อมูล =====

        async function addUserToDirectory(user, name, role = 'user') {
            const userKey = getUserKey(user);
            const email = userKey;
            if (!user || !user.uid || !isSchoolHubValidEmail(email)) {
                console.error('Blocked invalid user creation: email required', user);
                throw new Error('Blocked invalid user creation: email required');
            }
            const now = new Date().toISOString();
            try {
                await withTimeout(setDoc(doc(db, getPublicPath(), email), {
                    uid: user.uid,
                    email: email,
                    userKey: email,
                    name: name || user.displayName || email,
                    role: role,
                    joinedAt: now,
                    createdAt: now,
                    updatedAt: now,
                    status: 'active'
                }, { merge: true }), 8000, 'addUserDirectory');
            } catch(e) {
                console.error('addUserToDirectory failed:', e);
                throw e;
            }
        }

        window.toggleAuthMode = (mode) => {
            const isLogin = mode === 'login';
            document.getElementById('login-form').classList.toggle('hidden', !isLogin);
            document.getElementById('register-form').classList.toggle('hidden', isLogin);
            document.getElementById('auth-subtitle').textContent = isLogin ? "ระบบจัดการห้องเรียนอัจฉริยะ" : "สร้างบัญชีใหม่เพื่อเริ่มต้นใช้งาน";
        };

        window.openResetPasswordPage = function(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            window.open('./reset-password.html', '_blank', 'noopener,noreferrer');
            return false;
        };

        window.openForgotPassword = window.openResetPasswordPage;

        document.addEventListener('click', function(e) {
            const el = e.target.closest('[data-reset-password], .forgot-password-link');
            if (!el) return;

            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            window.open('./reset-password.html', '_blank', 'noopener,noreferrer');
        }, true);

        window.handleLogin = async (e) => {
            e.preventDefault();
            const rawLoginValue = String(document.getElementById('login-email').value || '').trim();
            const email = normalizeSchoolHubEmail(rawLoginValue);
            const pass = document.getElementById('login-pass').value;

            // Admin shortcut: ใช้จาก Firebase เท่านั้น
            // admin_settings/credentials = { username, email, password }
            // สำคัญ: ห้ามใช้ค่า email ที่ normalize แล้วไปเทียบ username Admin
            // เพราะ Admin ไม่ใช่อีเมล และเดิมถูกแปลงเป็น admin ทำให้ไม่ตรงกับ Admin ใน Firebase
            {
                const loginValue = rawLoginValue;
                const loginLower = loginValue.toLowerCase();

                try {
                    let credSnap = await withTimeout(getDoc(doc(db, 'admin_settings', 'credentials')), 8000, 'getAdminCredentials');
                    let secSnap = await withTimeout(getDoc(doc(db, 'admin_settings', 'security')), 8000, 'getAdminSecurity');

                    if (!credSnap.exists()) {
                        await setDoc(doc(db, 'admin_settings', 'credentials'), {
                            username: 'Admin',
                            email: '',
                            password: 'Admin123',
                            updatedAt: serverTimestamp(),
                            updatedBy: 'system'
                        }, { merge: true });

                        credSnap = await getDoc(doc(db, 'admin_settings', 'credentials'));
                    } else if (!('email' in (credSnap.data() || {}))) {
                        await setDoc(doc(db, 'admin_settings', 'credentials'), { email: '' }, { merge: true });
                        credSnap = await getDoc(doc(db, 'admin_settings', 'credentials'));
                    }

                    if (!secSnap.exists()) {
                        await setDoc(doc(db, 'admin_settings', 'security'), {
                            requirePasswordChange: true,
                            lastPasswordChange: 0,
                            updatedAt: serverTimestamp()
                        }, { merge: true });

                        secSnap = await getDoc(doc(db, 'admin_settings', 'security'));
                    }

                    const adminData = credSnap.data() || {};
                    const securityData = secSnap.exists() ? (secSnap.data() || {}) : {};

                    const adminUsername = String(adminData.username || 'Admin').trim();
                    const adminEmail = String(adminData.email || '').trim().toLowerCase();
                    const adminPassword = String(adminData.password || 'Admin123').trim();

                    const matchedAdmin =
                        loginLower === adminUsername.toLowerCase() ||
                        (adminEmail && loginLower === adminEmail);

                    if (matchedAdmin) {
                        if (pass !== adminPassword) {
                            return showCustomAlert("รหัสผ่าน Admin ไม่ถูกต้อง", "กรุณาใช้รหัสผ่าน Admin จาก Firebase", true);
                        }

                        localStorage.removeItem('schoolhub_admin_password');
                        localStorage.removeItem('schoolhub_admin_default_disabled');
                        localStorage.removeItem('schoolhub_admin_bypass');

                        await enterAdminMode();
                        // Auto-mark admin email as verified in Firestore to prevent false verification prompts
                        if (adminEmail) {
                            setDoc(doc(db, 'users_status', adminEmail), { emailVerified: true, status: 'active', updatedAt: Date.now() }, { merge: true }).catch(() => {});
                        }

                        const isDefaultAdmin =
                            loginValue === 'Admin' &&
                            pass === 'Admin123' &&
                            securityData.requirePasswordChange !== false;

                        if (isDefaultAdmin && typeof openAdminFirstSetupModal === 'function') {
                            setTimeout(() => openAdminFirstSetupModal(), 300);
                        }

                        return;
                    }
                } catch (adminErr) {
                    console.error('Admin Firebase login error:', adminErr);
                    return showCustomAlert("ตรวจสอบ Admin ไม่สำเร็จ", "ไม่สามารถอ่าน admin_settings/credentials จาก Firebase ได้", true);
                }
            }

            if(!email || !pass) return showCustomAlert("ผิดพลาด", "กรุณากรอกอีเมลและรหัสผ่าน", true);
            if(!isSchoolHubValidEmail(email)) return showCustomAlert("ไม่พบอีเมลผู้ใช้", "กรุณาเข้าสู่ระบบด้วยอีเมล", true);

            toggleLoader(true);
            try {
                const statusSnap = await withTimeout(getDoc(doc(db, `users_status`, email)), 8000, 'checkUserStatus');
                if (statusSnap.exists() && ['deleted','blocked'].includes(statusSnap.data().status)) {
                    toggleLoader(false); showCustomAlert("บัญชีถูกบล็อก", "บัญชีนี้ถูกบล็อกโดยผู้ดูแลระบบ กรุณาติดต่อ Admin เพื่อปลดบล็อก", true); return;
                }
            } catch (e) {}

            try {
                const userCred = await signInWithEmailAndPassword(auth, email, pass);
                const authEmail = normalizeSchoolHubEmail(userCred.user && userCred.user.email);
                if(!isSchoolHubValidEmail(authEmail)) {
                    await signOut(auth);
                    toggleLoader(false);
                    return showCustomAlert("ไม่พบอีเมลผู้ใช้ กรุณาเข้าสู่ระบบด้วยอีเมล", "ระบบหยุดการสร้างข้อมูลผู้ใช้ เพราะบัญชีนี้ไม่มีอีเมล", true);
                }
                const verifySnap = await getDoc(doc(db, `users_status`, email));
                const isSchoolHubVerified = verifySnap.exists() && verifySnap.data().emailVerified === true;
                const isFirebaseVerified = userCred.user.emailVerified === true;
                const hasTeamInviteParam = !!(new URLSearchParams(location.search).get('teamInvite'));
                // ถ้า Firebase ยืนยันแล้วแต่ users_status ยังไม่ set ให้ auto-sync
                if (isFirebaseVerified && !isSchoolHubVerified) {
                    try { await setDoc(doc(db, `users_status`, email), { emailVerified: true, verifiedAt: Date.now(), status: 'active' }, { merge: true }); } catch(syncErr) { console.warn('auto-sync emailVerified failed:', syncErr); }
                }
                // Skip email verification check for admin logins
                const __cachedAdminEmail = (localStorage.getItem('schoolhub_admin_email') || '').toLowerCase();
                const __isAdminLogin = rawLoginValue.toLowerCase() === 'admin' || (__cachedAdminEmail && authEmail === __cachedAdminEmail);
                if (!isSchoolHubVerified && !isFirebaseVerified && !__isAdminLogin) {
                    // Sign out, show popup — Apps Script resend does not need Firebase auth
                    await signOut(auth);
                    toggleLoader(false);
                    showSchoolHubEmailVerifyPopup(email);
                    return;
                }
            }
            catch (error) { toggleLoader(false); showCustomAlert("เข้าสู่ระบบไม่ได้", getFirebaseErrorText(error), true); }
        };

        window.handleRegister = async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value.trim();
            const email = normalizeSchoolHubEmail(document.getElementById('reg-email').value);
            const pass = document.getElementById('reg-pass').value;
            const confirmPass = document.getElementById('reg-pass-confirm').value;

            if(!isSchoolHubValidEmail(email)) return showCustomAlert("ไม่พบอีเมลผู้ใช้ กรุณาเข้าสู่ระบบด้วยอีเมล", "กรุณากรอกอีเมลให้ถูกต้องก่อนสมัครสมาชิก", true);
            if(pass !== confirmPass) return showCustomAlert("รหัสไม่ตรงกัน", "กรุณายืนยันรหัสผ่านให้ถูกต้อง", true);
            if(pass.length < 6) return showCustomAlert("รหัสผ่านสั้นเกินไป", "ตั้งรหัสผ่าน 6 ตัวอักษรขึ้นไป", true);

            toggleLoader(true);
            try {
                const statusRef = doc(db, `users_status`, email);
                const statusSnap = await getDoc(statusRef);
                if (statusSnap.exists() && ['deleted','blocked'].includes(statusSnap.data().status)) {
                    toggleLoader(false); showCustomAlert("พบประวัติการใช้งาน", "บัญชีนี้ถูกบล็อกโดยผู้ดูแลระบบ กรุณาติดต่อ Admin เพื่อปลดบล็อก"); return;
                }
            } catch(e){}

            try {
                const userCred = await createUserWithEmailAndPassword(auth, email, pass);
                await updateProfile(userCred.user, { displayName: name });
                await addUserToDirectory(userCred.user, name, 'user');
                await setDoc(doc(db, `users_status`, email), { status: 'active', emailVerified: false, deletedAt: null }, { merge: true });
                // Send verification via Apps Script (custom token) — no Firebase auth needed for link
                await signOut(auth).catch(()=>{});
                toggleLoader(false);
                showSchoolHubEmailVerifyPopup(email);
                // Auto-send first verification email in background
                shSendVerifyEmailViaAppsScript(email).catch(e => console.warn('auto-send on register failed:', e));
            } catch (error) {
                if(error.code === 'auth/email-already-in-use') {
                    toggleLoader(false); showCustomAlert("สมัครไม่ได้", "อีเมลนี้มีผู้ใช้งานในระบบแล้ว", true);
                } else { toggleLoader(false); showCustomAlert("สมัครไม่ได้", getFirebaseErrorText(error), true); }
            }
        };

        function setGoogleLoginButtonLoading(isLoading, text){
            const btn = document.querySelector('.auth-google-btn, button[onclick*=\"handleSocialLogin\"]');
            if(!btn) return;
            if(!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
            btn.disabled = !!isLoading;
            btn.classList.toggle('opacity-70', !!isLoading);
            btn.classList.toggle('cursor-wait', !!isLoading);
            if(isLoading){
                btn.innerHTML = `<i class="fas fa-spinner fa-spin text-primary text-lg"></i><span>${escapeHTML(text||'กำลังเข้าสู่ระบบ...')}</span>`;
            }else{
                btn.innerHTML = btn.dataset.originalHtml;
            }
        }
        window.setGoogleLoginButtonLoading = setGoogleLoginButtonLoading;

        // ---- Email Verification Popup Logic ----
        function showSchoolHubEmailVerifyPopup(email){
            window.__shVerifyEmail = email;
            const emailEl = document.getElementById('sh-verify-popup-email');
            if(emailEl) emailEl.textContent = email;
            const btn = document.getElementById('sh-verify-popup-btn');
            if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane" style="margin-right:.5rem"></i>ส่งอีกครั้ง'; }
            const p = document.getElementById('sh-email-verify-popup');
            if(p) p.classList.add('sh-show');
        }
        // ส่งลิงก์ยืนยันผ่าน Apps Script (custom token) — ไม่ต้อง sign-in Firebase
        async function shSendVerifyEmailViaAppsScript(email){
            const token = makeToken();
            const verifyLink = buildSchoolHubLink({ schoolhubVerify: '1', email, token });
            await setDoc(doc(db, 'users_status', email), {
                emailVerified: false,
                verifyToken: token,
                verifyTokenCreatedAt: Date.now(),
                status: 'active'
            }, { merge: true });
            await sendMailViaWebApp({
                to: email,
                type: 'verify',
                subject: 'SchoolHub — ยืนยันอีเมลของคุณ',
                name: email,
                message: 'สวัสดี\n\nกรุณากดลิงก์ด้านล่างเพื่อยืนยันอีเมลและเข้าสู่ระบบ SchoolHub:\n\n' + verifyLink + '\n\nลิงก์นี้ใช้ได้ครั้งเดียว หากไม่ได้ร้องขอ กรุณาละเว้น\n\n— SchoolHub',
                extra: { link: verifyLink }
            });
        }
        // ปุ่ม "ส่งอีกครั้ง" — ใช้ custom token + Apps Script (ไม่ต้อง Firebase auth)
        window.shSendVerifyEmail = async function(){
            const btn = document.getElementById('sh-verify-popup-btn');
            const email = window.__shVerifyEmail || '';
            if(!email){ showCustomAlert('ไม่พบอีเมล','ลองเข้าสู่ระบบใหม่อีกครั้ง',true); return; }
            if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin" style="margin-right:.5rem"></i>กำลังส่ง...'; }
            try{
                await shSendVerifyEmailViaAppsScript(email);
                if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane" style="margin-right:.5rem"></i>ส่งอีกครั้ง'; }
                showCustomAlert('ส่งลิงก์ยืนยันแล้ว', 'ตรวจสอบกล่องจดหมาย ' + email + ' แล้วกดลิงก์ยืนยัน\n\n⚠️ ถ้าไม่เห็นอีเมล ให้ตรวจสอบในกล่อง Spam / Junk ด้วย');
            } catch(err){
                if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane" style="margin-right:.5rem"></i>ส่งอีกครั้ง'; }
                showCustomAlert('ส่งไม่ได้', err.message || String(err), true);
            }
        };
        window.handleSocialLogin = async (providerType) => {
            if (location.protocol === 'file:') {
                return showCustomAlert('Google Login ใช้ไม่ได้เมื่อเปิดจากไฟล์', 'ให้เปิดผ่านเว็บโฮสต์ หรือรันด้วย localhost เช่น VS Code Live Server / Firebase Hosting แล้วเพิ่มโดเมนใน Firebase Authentication', true);
            }
            const provider = new GoogleAuthProvider();
            window.isSocialAuthenticating = true;
            window.__schoolhubGoogleLoginWaiting = true;
            setGoogleLoginButtonLoading(true, 'กำลังเชื่อมต่อ Google...');
            // ไม่เปิด global-loader เพื่อให้ค้างอยู่ที่หน้าล็อกอินเดิม ระหว่างรอ Google / Firebase
            try {
                const result = await signInWithPopup(auth, provider);
                const email = normalizeSchoolHubEmail(result.user && result.user.email);
                if(!isSchoolHubValidEmail(email)){
                    await signOut(auth);
                    window.isSocialAuthenticating = false;
                    window.__schoolhubGoogleLoginWaiting = false;
                    setGoogleLoginButtonLoading(false);
                    return showCustomAlert('ไม่พบอีเมลผู้ใช้ กรุณาเข้าสู่ระบบด้วยอีเมล','ระบบหยุดการสร้างข้อมูลผู้ใช้ เพราะบัญชี Google นี้ไม่มีอีเมล',true);
                }
                setGoogleLoginButtonLoading(true, 'กำลังเตรียมข้อมูล...');
                await addUserToDirectory(result.user, result.user.displayName || email, 'user');
                window.isSocialAuthenticating = false;
            }
            catch (error) {
                window.isSocialAuthenticating = false;
                window.__schoolhubGoogleLoginWaiting = false;
                setGoogleLoginButtonLoading(false);
                toggleLoader(false);
                showCustomAlert(`เข้าสู่ระบบ Google ไม่ได้`, getFirebaseErrorText(error), true);
            }
        };

        // FIX: แถบประกาศด้านบนหน้าหลักไม่ขึ้นให้ผู้ใช้ทั่วไปสม่ำเสมอ
        // เดิมการโหลด/แสดงประกาศ (loadPublicAnnouncements) ถูกเรียกเฉพาะ "หลัง"
        // Firebase Auth ตรวจสอบสถานะเสร็จ (ภายใน onAuthStateChanged) เท่านั้น
        // ทำให้การแสดงผลของแถบประกาศต้องรอคิวของ Auth ก่อนเสมอ ถ้า Auth ใช้เวลานาน
        // หรือมีจังหวะหน่วงต่างกันในแต่ละครั้ง แถบประกาศก็จะขึ้นช้า/ไม่ทันที ไม่คงเส้นคงวา
        // แก้โดยเรียกโหลด/แสดงประกาศทันทีตั้งแต่สคริปต์นี้เริ่มทำงาน โดยไม่ต้องรอ Auth เลย
        // (ใช้ค่าจากแคชในเครื่องก่อน แล้วค่อยอัปเดตด้วยข้อมูลสดจาก Firestore)
        // ส่วน onAuthStateChanged ด้านล่างยังคงเรียกซ้ำได้อีกครั้งตามปกติ ไม่ชนกัน
        loadPublicAnnouncements().catch(e => console.warn('initial loadPublicAnnouncements failed:', e));

        onAuthStateChanged(auth, async (user) => {
            if (await safeAsync(() => withTimeout(loadPublicShareFromURL(), 7000, 'loadPublicShare'), false)) { toggleLoader(false); return; }
            const logoutIntentAt = Number(localStorage.getItem('schoolhub_logout_intent') || 0);
            const isManualLogout = logoutIntentAt && (Date.now() - logoutIntentAt < 10 * 60 * 1000);
            const savedSession = isManualLogout ? null : readSchoolHubSession();
            if (!isManualLogout && (localStorage.getItem('schoolhub_admin_bypass') === 'true' || savedSession?.role === 'admin')) { await enterAdminMode(); return; }
            if (!user && savedSession?.role === 'user') {
                const restored = await restoreUserSessionFromLocal(savedSession);
                if (restored) return;
            }
            if (user) {
                // Google login fix: ห้าม return ระหว่าง signInWithPopup เพราะบางครั้ง Auth state ยิงก่อนปิด flag แล้วค้างหน้าเปล่า/ต้องรีเฟรช
                if (window.isSocialAuthenticating) { window.isSocialAuthenticating = false; }
                try {
                    toggleLoader(true);
                    currentUser = user; isAdmin = false;
                    saveSchoolHubSession(user, 'user');
                    if (window.__schoolhubGoogleLoginWaiting && typeof setGoogleLoginButtonLoading === 'function') {
                        setGoogleLoginButtonLoading(true, 'กำลังโหลดข้อมูลผู้ใช้...');
                    } else {
                        toggleLoader(true);
                    }

                    const dName = user.displayName || 'ผู้ใช้งาน';
                    document.getElementById('user-display-name').textContent = dName;
                    document.getElementById('user-display-email').textContent = getUserKey(user);
                    document.getElementById('user-avatar-initial').textContent = dName.charAt(0).toUpperCase();

                    setAdminNavigationMode(false);

                    await loadSchoolHubDataAfterAuth(user);

                    // เปิดหน้าเข้าใช้งานเฉพาะหลังโหลดข้อมูลสำเร็จจริง ๆ
                    document.getElementById('landing-view').classList.add('hidden');
                    document.getElementById('auth-view').classList.add('hidden');
                    document.getElementById('main-app').classList.remove('hidden');
                    window.renderPublicAnnouncements?.();
                    window.__schoolhubGoogleLoginWaiting = false;
                    if (typeof setGoogleLoginButtonLoading === 'function') setGoogleLoginButtonLoading(false);

                    const planFlow = await processPendingPlanRequestAfterLogin();
                    if(!planFlow) {
                        window.goToHome();
                    }
                } catch (error) {
                    window.__schoolhubGoogleLoginWaiting = false;
                    if (typeof setGoogleLoginButtonLoading === 'function') setGoogleLoginButtonLoading(false);
                    showCustomAlert("ผิดพลาด", error.message, true);
                }
                finally { toggleLoader(false); }
            } else {
                currentUser = null; isAdmin = false;
                document.getElementById('auth-view').classList.add('hidden');
                document.getElementById('main-app').classList.add('hidden');
                document.getElementById('landing-view').classList.remove('hidden');
                toggleLoader(false);
                // โหลดประกาศ/แผนแบบเบื้องหลังเหมือนไฟล์ที่ไม่ค้าง: Firebase ช้าก็ไม่บล็อกหน้าแรก
                Promise.allSettled([loadPublicAnnouncements(), loadPublicPlans()]).catch(e => console.warn('โหลดหน้าแรกไม่ครบ:', e));
            }
        });

        window.doLogout = async () => {
            await forceSchoolHubLogout({ delay: 120 });
        };

        function setAdminNavigationMode(enabled) {
            // เมนูปกติ (user): ซ่อนเมื่อเป็น admin
            ['nav-main-label','nav-dashboard','nav-students','nav-user-plans','nav-settings',
             'mobile-nav-dashboard','mobile-nav-students','mobile-nav-user-plans','mobile-nav-settings'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('hidden', enabled);
            });
            // course-context-menu: ซ่อนเสมอเมื่อ switch mode — แสดงได้เฉพาะเมื่อ enterCourse()
            const ctxMenu = document.getElementById('course-context-menu');
            if (ctxMenu) ctxMenu.classList.add('hidden');
            // เมนู admin
            ['admin-menu-group','mobile-admin-menu-group'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('hidden', !enabled);
            });
        }

        async function enterAdminMode() {
            let adminName = localStorage.getItem('schoolhub_admin_name') || 'Administrator';
            let adminEmail = 'Admin';
            let adminUsername = 'Admin';
            try {
                if (typeof readAdminCredFinal === 'function') {
                    const adminData = await readAdminCredFinal();
                    adminName = adminData.displayName || adminData.name || adminName || 'Administrator';
                    adminEmail = adminData.email || adminData.username || 'Admin';
                    adminUsername = adminData.username || 'Admin';
                }
            } catch(e) { console.warn('read admin profile for session failed:', e); }
            currentUser = { uid: 'admin-bypass', email: adminEmail, displayName: adminName, username: adminUsername };
            isAdmin = true;
            try {
                localStorage.setItem('schoolhub_admin_bypass','true');
                localStorage.setItem('schoolhub_admin_active','true');
                localStorage.setItem('schoolhub_admin_name', adminName);
                localStorage.setItem('schoolhub_admin_email', adminEmail);
                localStorage.setItem('schoolhub_admin_username', adminUsername);
                saveSchoolHubSession(currentUser, 'admin');
            } catch(e) {}
            document.getElementById('landing-view').classList.add('hidden'); document.getElementById('auth-view').classList.add('hidden'); document.getElementById('main-app').classList.remove('hidden');
            window.renderPublicAnnouncements?.();
            document.getElementById('user-display-name').textContent = adminName; document.getElementById('user-display-email').textContent = adminEmail || adminUsername || 'Admin';
            setAdminNavigationMode(true);
            try {
                toggleLoader(true);
                await loadStateFromDB();
                window.switchView('admin-permissions');
                toggleLoader(false);
                Promise.allSettled([loadPublicPlans(), loadPublicAnnouncements()]).then(() => { if (isAdmin) { renderAdminPlans(); renderAdminAnnouncements(); } });
            } catch (error) {
                console.warn('enterAdminMode failed:', error);
                toggleLoader(false);
                try { window.switchView('admin-permissions'); } catch(e) {}
                showCustomAlert('โหลดแอดมินไม่ครบ', getFirebaseErrorText(error), true);
            }
        }


        window.openUserProfileSettings = () => {
            if (!currentUser) return showCustomAlert('ยังไม่ได้เข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนใช้งานโปรไฟล์', true);
            const isAdminBypass = currentUser?.uid === 'admin-bypass';
            const nameInput = document.getElementById('profile-display-name-input');
            const emailInput = document.getElementById('profile-email-input');
            const adminPassWrap = document.getElementById('admin-profile-password-wrap');
            const adminPassInput = document.getElementById('admin-profile-password-input');
            if (nameInput) nameInput.value = currentUser.displayName || localStorage.getItem('schoolhub_admin_name') || '';
            if (emailInput) emailInput.value = currentUser.email || 'Admin';
            if (adminPassWrap) adminPassWrap.classList.toggle('hidden', !isAdminBypass);
            if (adminPassInput) adminPassInput.value = '';
            const resetBtn = document.querySelector('#user-profile-modal [data-reset-password]');
            if (resetBtn) {
                resetBtn.classList.toggle('hidden', isAdminBypass);
                resetBtn.innerHTML = '<i class="fas fa-key mr-1"></i> ขอรีเซ็ตรหัสผ่าน';
            }
            openModal('user-profile-modal');
        };

        window.saveUserProfileChanges = async () => {
            const newName = (document.getElementById('profile-display-name-input')?.value || '').trim();
            if (!newName) return showCustomAlert('กรุณากรอกชื่อ', 'ชื่อที่แสดงห้ามว่าง', true);
            try {
                toggleLoader(true);
                if (currentUser?.uid === 'admin-bypass') {
                    const newAdminPass = (document.getElementById('admin-profile-password-input')?.value || '').trim();
                    if (newAdminPass && newAdminPass.length < 6) {
                        toggleLoader(false);
                        return showCustomAlert('รหัสผ่านสั้นเกินไป', 'รหัสผ่าน Admin ต้องมีอย่างน้อย 6 ตัวอักษร', true);
                    }
                    if (newAdminPass && newAdminPass === 'Admin123') {
                        toggleLoader(false);
                        return showCustomAlert('ห้ามใช้รหัสเริ่มต้น', 'เพื่อความปลอดภัย รหัส Admin123 ใช้ได้เฉพาะครั้งแรกก่อนตั้งค่าเท่านั้น', true);
                    }
                    localStorage.setItem('schoolhub_admin_name', newName);
                    if (newAdminPass) {
                        localStorage.setItem('schoolhub_admin_password', newAdminPass);
                        localStorage.removeItem('schoolhub_admin_default_disabled');
                    }
                    currentUser.displayName = newName;
                } else if (auth.currentUser) {
                    await updateProfile(auth.currentUser, { displayName: newName });
                    currentUser.displayName = newName;
                    await addUserToDirectory(auth.currentUser, newName, isAdmin ? 'admin' : 'user');
                }
                const nameEl = document.getElementById('user-display-name');
                const avatarEl = document.getElementById('user-avatar-initial');
                if (nameEl) nameEl.textContent = newName;
                if (avatarEl) avatarEl.textContent = newName.charAt(0).toUpperCase();
                saveSchoolHubSession(currentUser, currentUser?.uid === 'admin-bypass' ? 'admin' : 'user');
                closeModal('user-profile-modal');
                showCustomAlert('บันทึกสำเร็จ', 'เปลี่ยนชื่อโปรไฟล์เรียบร้อยแล้ว');
            } catch (err) {
                showCustomAlert('บันทึกชื่อไม่สำเร็จ', getFirebaseErrorText(err), true);
            } finally { toggleLoader(false); }
        };

        window.requestOwnPasswordReset = function(event) {
            return window.openResetPasswordPage(event);
        };

        window.openAdminFirstSetupModal = () => {
            const modal = document.getElementById('admin-first-setup-modal');
            if (!modal) return;
            document.getElementById('admin-setup-name').value = localStorage.getItem('schoolhub_admin_name') || 'Administrator';
            document.getElementById('admin-setup-password').value = '';
            openModal('admin-first-setup-modal');
        };

        window.saveAdminFirstSetup = () => {
            const name = (document.getElementById('admin-setup-name')?.value || '').trim();
            const pass = document.getElementById('admin-setup-password')?.value || '';
            if (!name) return showCustomAlert('กรุณากรอกชื่อแอดมิน', 'ชื่อแอดมินห้ามว่าง', true);
            if (!pass || pass.length < 6) return showCustomAlert('รหัสผ่านสั้นเกินไป', 'รหัสผ่าน Admin ต้องมีอย่างน้อย 6 ตัวอักษร', true);
            if (pass === 'Admin123') return showCustomAlert('ห้ามใช้รหัสเริ่มต้น', 'เพื่อความปลอดภัย กรุณาตั้งรหัสผ่านใหม่ที่ไม่ใช่ Admin123', true);
            localStorage.setItem('schoolhub_admin_name', name);
            /* disabled: admin password saved to Firebase only */
            localStorage.removeItem('schoolhub_admin_default_disabled');
            if (currentUser?.uid === 'admin-bypass') currentUser.displayName = name;
            const nameEl = document.getElementById('user-display-name');
            const emailEl = document.getElementById('user-display-email');
            const avatarEl = document.getElementById('user-avatar-initial');
            if (nameEl) nameEl.textContent = name;
            if (emailEl) emailEl.textContent = 'Admin';
            if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
            closeModal('admin-first-setup-modal');
            showCustomAlert('ตั้งค่า Admin สำเร็จ', 'ครั้งต่อไปให้กรอกอีเมลว่า Admin และกรอกรหัสผ่าน Admin ที่ตั้งไว้');
        };



        /* SchoolHub Settings Center + Admin Contact Messages
           เพิ่มเมนูตั้งค่าและติดต่อผู้ดูแลระบบแบบแยก namespace ไม่แตะระบบคะแนน/เกรด/Export/สิทธิ์เดิม */
        function schoolhubGetContactUserEmail() {
            const u = currentUser || (auth && auth.currentUser) || {};
            return String(u.email || u.username || localStorage.getItem('schoolhub_admin_email') || localStorage.getItem('schoolhub_user_email') || '').trim();
        }

        function schoolhubPrefillContactEmail() {
            const emailInput = document.getElementById('schoolhub-contact-email');
            if (emailInput && !emailInput.value) emailInput.value = schoolhubGetContactUserEmail();
        }

        function schoolhubNormalizeSettingsTab(tab) {
            tab = String(tab || 'general').trim() || 'general';
            if (tab === 'admin-messages') tab = 'contact-messages';
            return tab;
        }

        function schoolhubUnlockSettingsControls() {
            const modal = document.getElementById('settings-modal');
            if (!modal) return;
            modal.querySelectorAll('button, input, textarea, select, a').forEach(el => {
                try {
                    el.setAttribute('data-schoolhub-always-allowed', '1');
                    if (el.closest('#settings-modal')) {
                        el.disabled = false;
                        el.removeAttribute('disabled');
                        el.removeAttribute('aria-disabled');
                        el.style.pointerEvents = 'auto';
                        el.style.opacity = '';
                    }
                } catch(e) {}
            });
        }

        window.switchSettingsTab = function(tab = 'general') {
            return window.schoolhubOpenSettingsTab(schoolhubNormalizeSettingsTab(tab));
        };

        window.openSettingsModal = function(tab = 'general') {
            const modal = document.getElementById('settings-modal');
            if (!modal) return;
            window.__schoolhubSettingsActiveTab = schoolhubNormalizeSettingsTab(tab);
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('schoolhub-settings-modal-open');
            schoolhubUnlockSettingsControls();
            if (typeof window.renderSchoolHubSettings === 'function') window.renderSchoolHubSettings();
            else if (typeof window.schoolhubOpenSettingsTab === 'function') window.schoolhubOpenSettingsTab(window.__schoolhubSettingsActiveTab);
            setTimeout(schoolhubUnlockSettingsControls, 0);
            setTimeout(function(){ document.querySelector('#settings-modal .settings-close')?.focus?.(); }, 0);
        };

        window.closeSettingsModal = function() {
            const modal = document.getElementById('settings-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('schoolhub-settings-modal-open');
        };

        window.openSchoolHubSettings = function(tab = 'general') {
            if (!currentUser && !(auth && auth.currentUser)) {
                return showCustomAlert('ยังไม่ได้เข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนเปิดเมนูตั้งค่า', true);
            }
            try {
                currentActiveCourseId = null;
                document.getElementById('course-context-menu')?.classList.add('hidden');
                const headerActions = document.getElementById('header-actions');
                if (headerActions) headerActions.innerHTML = '';
            } catch(e) {}
            window.openSettingsModal(tab || 'general');
        };

        window.renderSchoolHubSettings = function() {
            const adminMode = !!isAdmin;
            const badge = document.getElementById('schoolhub-settings-role-badge');
            if (badge) {
                badge.textContent = adminMode ? 'แอดมิน' : 'ผู้ใช้งานทั่วไป';
                badge.className = adminMode
                    ? 'settings-role-badge bg-rose-50 text-rose-600 border-rose-100'
                    : 'settings-role-badge bg-indigo-50 text-primary border-indigo-100';
            }
            document.getElementById('schoolhub-settings-admin-messages-tab')?.classList.toggle('hidden', !adminMode);
            document.getElementById('schoolhub-settings-user-shortcuts')?.classList.toggle('hidden', adminMode);
            document.getElementById('schoolhub-settings-admin-shortcuts')?.classList.toggle('hidden', !adminMode);
            schoolhubPrefillContactEmail();
            schoolhubUnlockSettingsControls();
            window.schoolhubOpenSettingsTab(window.__schoolhubSettingsActiveTab || 'general');
        };

        window.schoolhubOpenSettingsTab = function(tab = 'general') {
            tab = schoolhubNormalizeSettingsTab(tab);
            if (tab === 'contact-messages' && !isAdmin) {
                tab = 'contact-admin';
                showCustomAlert('สำหรับแอดมินเท่านั้น', 'เมนูข้อความจากผู้ใช้เปิดได้เฉพาะแอดมิน', true);
            }
            window.__schoolhubSettingsActiveTab = tab;
            document.querySelectorAll('.schoolhub-settings-tab, .settings-tab').forEach(btn => {
                const active = btn.dataset.settingsTab === tab;
                btn.classList.toggle('active', active);
                btn.classList.toggle('bg-indigo-50', active && tab !== 'contact-messages');
                btn.classList.toggle('text-primary', active && tab !== 'contact-messages');
                btn.classList.toggle('border-indigo-100', active && tab !== 'contact-messages');
                btn.classList.toggle('bg-rose-50', active && tab === 'contact-messages');
                btn.classList.toggle('text-rose-600', active && tab === 'contact-messages');
                btn.classList.toggle('border-rose-100', active && tab === 'contact-messages');
                btn.classList.toggle('bg-slate-50', !active);
                btn.classList.toggle('text-slate-700', !active);
                btn.classList.toggle('border-slate-100', !active);
            });
            document.querySelectorAll('.schoolhub-settings-panel').forEach(panel => panel.classList.add('hidden'));
            document.getElementById(`schoolhub-settings-panel-${tab}`)?.classList.remove('hidden');
            if (tab === 'contact-admin') schoolhubPrefillContactEmail();
            if (tab === 'contact-messages') loadAdminContactMessages();
            schoolhubUnlockSettingsControls();
        };

        document.addEventListener('click', function(e) {
            const settingsBtn = e.target.closest && e.target.closest('[data-open-settings], .settings-menu-btn');
            if (settingsBtn) {
                e.preventDefault();
                e.stopPropagation();
                window.openSchoolHubSettings(settingsBtn.dataset.settingsTab || 'general');
                return;
            }
            const tabBtn = e.target.closest && e.target.closest('#settings-modal .settings-tab[data-settings-tab], #settings-modal .schoolhub-settings-tab[data-settings-tab]');
            if (tabBtn) {
                e.preventDefault();
                window.switchSettingsTab(tabBtn.dataset.settingsTab);
                return;
            }
            const shortcutBtn = e.target.closest && e.target.closest('#settings-modal .settings-content button[onclick]');
            if (shortcutBtn && !shortcutBtn.closest('#schoolhub-admin-contact-form')) {
                const action = shortcutBtn.getAttribute('onclick') || '';
                if (/openUserProfileSettings|openUserPlanSelector|openStudentsManager|switchView|openCustomMenuAdmin/.test(action) && !/schoolhubOpenSettingsTab|renderSchoolHubSettings/.test(action)) {
                    setTimeout(window.closeSettingsModal, 0);
                }
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') window.closeSettingsModal();
        });

        window.switchView = (viewId) => {
            if (viewId === 'settings') {
                window.openSettingsModal(window.__schoolhubSettingsActiveTab || 'general');
                return;
            }
            document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
            const targetView = document.getElementById(`view-${viewId}`);
            if (!targetView) return;
            targetView.classList.remove('hidden');

            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.remove('bg-indigo-50', 'text-primary');
                if(btn.dataset.target === viewId) btn.classList.add('bg-indigo-50', 'text-primary');
            });

            if(viewId === 'user-plans' && !isAdmin) { document.getElementById('page-title').textContent = 'เลือก / เปลี่ยนแผน'; document.getElementById('page-subtitle').textContent = 'เลือกแผนการใช้งานที่ต้องการ'; renderUserPlans(); }
            if(viewId === 'admin-permissions' && isAdmin) { document.getElementById('page-title').textContent = 'จัดการสิทธิ์'; document.getElementById('page-subtitle').textContent = 'ควบคุมสถานะผู้ใช้งานระบบ'; loadPlanRequests(); loadAdminData(); }
            if(viewId === 'admin-dashboard' && isAdmin) { document.getElementById('page-title').textContent = 'แดชบอร์ดรวม'; document.getElementById('page-subtitle').textContent = 'ภาพรวมข้อมูลทั้งหมดจาก global_stats/summary'; if(typeof loadAdminGlobalDashboard === 'function') loadAdminGlobalDashboard(); }
            if(viewId === 'admin-announcements' && isAdmin) { document.getElementById('page-title').textContent = 'ประกาศ'; document.getElementById('page-subtitle').textContent = 'จัดการประกาศหน้าแรก แถบบน และป็อปอัพ'; loadPublicAnnouncements(); renderAdminAnnouncements(); }
            if(viewId === 'admin-plans' && isAdmin) { document.getElementById('page-title').textContent = 'แผนการใช้งาน'; document.getElementById('page-subtitle').textContent = 'ตั้งค่าระดับ ราคา และสิทธิ์การใช้งาน'; loadPublicPlans(); renderAdminPlans(); }
            if(viewId === 'admin-import-control' && isAdmin) { document.getElementById('page-title').textContent = 'ควบคุม Import'; document.getElementById('page-subtitle').textContent = 'จัดการการเข้าถึงเมนูนำเข้า Excel'; adminLoadImportControl(); }
            if(viewId === 'import-excel') { document.getElementById('page-title').textContent = 'นำเข้าข้อมูล Excel'; document.getElementById('page-subtitle').textContent = 'อัพโหลดไฟล์เช็คชื่อ / ภาพรวม เพื่อเพิ่มข้อมูลอัตโนมัติ'; }
            /* settings opens as modal; no standalone settings page */
        };

        window.goToHome = () => {
            currentActiveCourseId = null;
            document.getElementById('course-context-menu').classList.add('hidden');
            document.getElementById('page-title').textContent = 'ห้องเรียนของฉัน';
            document.getElementById('page-subtitle').textContent = 'เลือกรายวิชาเพื่อเข้าสู่การจัดการ';
            document.getElementById('header-actions').innerHTML = '';
            updateGlobalViews();
            window.switchView('dashboard');
        };

        window.openStudentsManager = () => {
            currentActiveCourseId = null;
            document.getElementById('course-context-menu').classList.add('hidden');
            document.getElementById('page-title').textContent = 'ฐานข้อมูลนักเรียน';
            document.getElementById('page-subtitle').textContent = 'จัดการรายชื่อนักเรียนส่วนกลางของระบบ';
            document.getElementById('header-actions').innerHTML = '';
            renderStudentsMaster();
            window.switchView('students-master');
        };

        window.enterCourse = (id) => {
            const course = state.courses.find(c => String(c.id) === String(id));
            if(!course) {
                console.error('[SHARE STUDENT] enterCourse course not found', {
                    inputId: id,
                    courses: state.courses
                });
                return;
            }

            const cid = String(course.id);
            currentActiveCourseId = cid;
            window.currentActiveCourseId = cid;

            const detailView = document.getElementById('view-course-detail');
            if (detailView) {
                detailView.dataset.courseId = cid;
            }

            populateHiddenCourseDropdowns();
            document.getElementById('att-course-select').value = cid;
            document.getElementById('score-course-select').value = cid;
            document.querySelectorAll('button[data-action="share-student"]').forEach(btn => {
                btn.dataset.courseId = cid;
                btn.setAttribute('data-course-id', cid);
            });

            document.getElementById('course-context-menu').classList.remove('hidden');
            document.getElementById('sidebar-course-name').textContent = `วิชา: ${course.code}`;

            document.getElementById('page-title').textContent = course.name;
            document.getElementById('page-subtitle').innerHTML = `<span class="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs font-bold mr-2">${course.code}</span> จัดการข้อมูลรายวิชานี้`;
            const mobileCourseName = document.getElementById('mobile-course-name');
            if (mobileCourseName) mobileCourseName.textContent = `เมนูประจำรายวิชา: ${course.code} ${course.name}`;

            document.getElementById('header-actions').innerHTML = `
                <button id="course-back-btn" onclick="goToHome()" class="bg-white border text-slate-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition shadow-sm">
                    <i class="fas fa-arrow-left"></i> <span><span class="mobile-hide-text">กลับหน้าหลัก</span></span>
                </button>
            `;
            schoolhubEnsureCourseTeacherButton();

            window.switchView('course-detail');
            window.switchCourseTab('overview');
            setTimeout(schoolhubApplyReadonlyUI, 60);
            setTimeout(() => { if (typeof window.unlockShareStudentButton === 'function') window.unlockShareStudentButton(); }, 0);
            setTimeout(() => { if (typeof window.unlockShareStudentButton === 'function') window.unlockShareStudentButton(); }, 100);
        };

        window.switchCourseTab = (tabId) => {
            document.querySelectorAll('.course-subview').forEach(el => el.classList.add('hidden'));
            document.getElementById(`course-tab-${tabId}`).classList.remove('hidden');

            document.querySelectorAll('.course-tab-btn').forEach(btn => {
                btn.classList.remove('bg-indigo-50', 'text-primary', 'font-bold', 'border-indigo-100');
                if(btn.classList.contains('mobile-course-tab-btn')) btn.classList.add('bg-slate-50', 'text-slate-700');
                if(btn.dataset.tab === tabId) {
                    btn.classList.remove('bg-slate-50', 'text-slate-700');
                    btn.classList.add('bg-indigo-50', 'text-primary', 'font-bold', 'border-indigo-100');
                }
            });

            if(tabId === 'overview') renderCourseOverview();
            if(tabId === 'attendance') { window.initCalendar(); document.getElementById('attendance-placeholder').classList.remove('hidden'); document.getElementById('attendance-area').classList.add('hidden'); document.getElementById('att-date').value = '';}
            if(tabId === 'scores') { handleScoreCourseChange(); document.getElementById('score-placeholder').classList.remove('hidden'); document.getElementById('score-area').classList.add('hidden');}
            setTimeout(schoolhubApplyReadonlyUI, 60);
        };

        function updateGlobalViews() {
            document.getElementById('stat-students').textContent = state.students.length;
            document.getElementById('stat-courses').textContent = state.courses.length;
            document.getElementById('stat-tasks').textContent = state.scores.length;
            renderCourseGrid();
        }

        const dayNames = { 0: 'อา.', 1: 'จ.', 2: 'อ.', 3: 'พ.', 4: 'พฤ.', 5: 'ศ.', 6: 'ส.' };

        window.getStudentClassName = (student) => (student?.room || student?.classroom || student?.grade || '-').toString().trim() || '-';

        window.getCourseSelectedRooms = (courseId = currentActiveCourseId) => {
            const course = state.courses.find(c => String(c.id) === String(courseId));
            if (!course) return [];
            return Array.isArray(course.studentRooms) ? course.studentRooms : (Array.isArray(course.studentGrades) ? course.studentGrades : []);
        };

        window.getCourseStudents = (courseId = currentActiveCourseId, options = {}) => {
            const course = state.courses.find(c => String(c.id) === String(courseId));
            if (!course) return [];
            const rooms = window.getCourseSelectedRooms(courseId);
            const extraIds = Array.isArray(course.extraStudentIds) ? course.extraStudentIds : [];
            // ถ้ารายวิชาไม่ได้เลือกห้องและไม่ได้เพิ่มรายบุคคล จะไม่ขึ้นรายชื่อเลย
            if (rooms.length === 0 && extraIds.length === 0) return [];

            const actionFilter = options.ignoreActionFilter ? '' : (window.activeCourseRoomFilter?.[String(courseId)] || '');
            let list = (state.students || []).filter(st => {
                const room = window.getStudentClassName(st);
                const roomKeys = rooms.map(String);
                const extraKeys = extraIds.map(String);
                const inRoom = roomKeys.includes(String(room));
                const isExtra = extraKeys.includes(String(st.id)) || extraKeys.includes(String(st.studentId || '')) || extraKeys.includes(String(st.code || '')) || extraKeys.includes(String(st.studentCode || ''));
                if (!inRoom && !isExtra) return false;
                if (rooms.length > 1 && actionFilter) return String(room) === String(actionFilter);
                return true;
            });
            return list.sort((a,b)=> String(window.getStudentClassName(a)).localeCompare(String(window.getStudentClassName(b)), 'th') || String(a.code||'').localeCompare(String(b.code||''), 'th', {numeric:true}) || String(a.name||'').localeCompare(String(b.name||''), 'th'));
        };

        window.ensureCourseRoomActionFilter = (target, courseId = currentActiveCourseId) => {
            const area = document.getElementById(target);
            if (!area || !courseId) return;
            const rooms = window.getCourseSelectedRooms(courseId);
            let box = document.getElementById(`${target}-room-filter`);
            if (!box) {
                box = document.createElement('div');
                box.id = `${target}-room-filter`;
                box.className = 'mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4';
                area.parentNode.insertBefore(box, area);
            }
            if (rooms.length <= 1) { box.classList.add('hidden'); window.activeCourseRoomFilter = window.activeCourseRoomFilter || {}; delete window.activeCourseRoomFilter[String(courseId)]; return; }
            window.activeCourseRoomFilter = window.activeCourseRoomFilter || {};
            if (!window.activeCourseRoomFilter[String(courseId)] || !rooms.map(String).includes(String(window.activeCourseRoomFilter[String(courseId)]))) window.activeCourseRoomFilter[String(courseId)] = rooms[0];
            box.classList.remove('hidden');
            const filterHTML = `<label class="block text-sm font-black text-slate-800 mb-2"><i class="fas fa-door-open text-primary mr-1"></i> เลือกห้อง/ชั้นสำหรับรายการนี้</label><select class="w-full bg-white border border-indigo-100 rounded-xl p-3 font-bold text-primary focus:ring-2 focus:ring-primary focus:outline-none" onchange="window.activeCourseRoomFilter=window.activeCourseRoomFilter||{}; window.activeCourseRoomFilter[String('${courseId}')]=this.value; if('${target}'==='attendance-area') renderAttendanceList(); else renderScoreList();">${rooms.map(r=>`<option value="${escapeHTML(r)}" ${String(window.activeCourseRoomFilter[String(courseId)])===String(r)?'selected':''}>${escapeHTML(r)}</option>`).join('')}</select><p class="text-xs text-slate-500 mt-2">รายวิชานี้เลือกไว้หลายห้อง จึงต้องเลือกห้องก่อนเช็คชื่อหรือบันทึกคะแนน</p>`;
            if (box.dataset.schoolhubFilterHtml !== filterHTML) { box.innerHTML = filterHTML; box.dataset.schoolhubFilterHtml = filterHTML; }
        };

        window.getAllStudentRooms = () => {
            return [...new Set((state.students || []).map(s => window.getStudentClassName(s)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
        };

        window.renderCourseStudentSelectors = (course = null) => {
            const roomBox = document.getElementById('course-room-checkboxes');
            const empty = document.getElementById('course-room-empty');
            if (!roomBox) return;
            const rooms = window.getAllStudentRooms();
            const selectedRooms = course?.studentRooms || course?.studentGrades || [];
            roomBox.innerHTML = '';
            if (rooms.length === 0) { empty?.classList.remove('hidden'); } else {
                empty?.classList.add('hidden');
                roomBox.innerHTML = rooms.map(r => `<label class="cursor-pointer inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-indigo-50 hover:border-indigo-200"><input type="checkbox" class="course-room-checkbox w-4 h-4 text-primary rounded" value="${escapeHTML(r)}" ${selectedRooms.includes(r) ? 'checked' : ''}> ${escapeHTML(r)}</label>`).join('');
            }
            window.courseSelectedIndividualIds = Array.isArray(course?.extraStudentIds) ? [...course.extraStudentIds] : [];
            const search = document.getElementById('course-student-search');
            if (search) search.value = '';
            window.renderCourseIndividualStudentChoices();
            window.renderSelectedCourseIndividuals();
        };

        window.selectAllCourseRooms = () => {
            document.querySelectorAll('.course-room-checkbox').forEach(cb => cb.checked = true);
        };

        window.renderCourseIndividualStudentChoices = () => {
            const box = document.getElementById('course-individual-choices');
            if (!box) return;
            const q = (document.getElementById('course-student-search')?.value || '').trim().toLowerCase();
            const selected = window.courseSelectedIndividualIds || [];
            let list = (state.students || []).filter(s => !selected.includes(s.id));
            if (q) list = list.filter(s => `${s.code} ${s.name} ${window.getStudentClassName(s)}`.toLowerCase().includes(q));
            list = list.slice(0, 30);
            if (list.length === 0) { box.innerHTML = '<div class="text-sm text-slate-400 p-3 bg-slate-50 rounded-xl border border-dashed md:col-span-2">ไม่พบนักเรียนที่ค้นหา</div>'; return; }
            box.innerHTML = list.map(s => `<label class="cursor-pointer bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 hover:bg-indigo-50 hover:border-indigo-200"><input type="checkbox" class="course-individual-choice w-4 h-4 text-primary rounded" value="${s.id}"><span><span class="block font-bold text-slate-700 text-sm">${escapeHTML(s.name)}</span><span class="block text-xs text-slate-400 font-mono">${escapeHTML(s.code)} • ${escapeHTML(window.getStudentClassName(s))}</span></span></label>`).join('');
        };

        window.addSelectedCourseIndividuals = () => {
            if (!window.courseSelectedIndividualIds) window.courseSelectedIndividualIds = [];
            document.querySelectorAll('.course-individual-choice:checked').forEach(cb => { if (!window.courseSelectedIndividualIds.includes(cb.value)) window.courseSelectedIndividualIds.push(cb.value); });
            window.renderCourseIndividualStudentChoices();
            window.renderSelectedCourseIndividuals();
        };

        window.removeSelectedCourseIndividual = (id) => {
            window.courseSelectedIndividualIds = (window.courseSelectedIndividualIds || []).filter(x => x !== id);
            window.renderCourseIndividualStudentChoices();
            window.renderSelectedCourseIndividuals();
        };

        window.renderSelectedCourseIndividuals = () => {
            const box = document.getElementById('course-selected-individuals');
            if (!box) return;
            const ids = window.courseSelectedIndividualIds || [];
            if (ids.length === 0) { box.innerHTML = '<span class="text-xs text-slate-400 p-2">ยังไม่ได้เพิ่มรายบุคคล</span>'; return; }
            box.innerHTML = ids.map(id => { const s = state.students.find(x => x.id === id); if (!s) return ''; return `<span class="inline-flex items-center gap-2 bg-indigo-50 text-primary border border-indigo-100 px-3 py-1.5 rounded-full text-xs font-bold">${escapeHTML(s.name)} <button type="button" onclick="removeSelectedCourseIndividual('${id}')" class="hover:text-rose-500"><i class="fas fa-times"></i></button></span>`; }).join('');
        };

        window.openCourseModal = () => {
            editingCourseId = null;
            document.getElementById('course-code-input').value = '';
            document.getElementById('course-name-input').value = '';
            document.querySelectorAll('.course-day').forEach(cb => cb.checked = false);
            document.getElementById('course-time-start').value = '';
            document.getElementById('course-time-end').value = '';
            document.getElementById('course-modal-title').textContent = 'สร้างรายวิชาใหม่';
            window.renderCourseStudentSelectors(null);
            window.openModal('course-modal');
        };
        window.closeCourseModal = () => window.closeModal('course-modal');

        window.renderCourseGrid = () => {
            const grid = document.getElementById('course-grid'); grid.innerHTML = '';
            if (state.courses.length === 0) {
                document.getElementById('empty-course-grid').classList.remove('hidden');
                grid.classList.add('hidden');
            } else {
                document.getElementById('empty-course-grid').classList.add('hidden');
                grid.classList.remove('hidden');
                const __shCanEdit = (typeof window.currentPlanAllows === 'function') ? window.currentPlanAllows('edit') : true;
                const __shCanDelete = (typeof window.currentPlanAllows === 'function') ? window.currentPlanAllows('delete') : true;
                state.courses.forEach(c => {
                    let scheduleDisplay = 'ไม่ได้กำหนดเวลา';
                    if (c.schedule && c.schedule.days && c.schedule.days.length > 0) {
                        const daysStr = c.schedule.days.map(d => dayNames[d]).join(', ');
                        const timeStr = (c.schedule.startTime) ? ` (${c.schedule.startTime} - ${c.schedule.endTime})` : '';
                        scheduleDisplay = `<span class="text-emerald-600 font-medium"><i class="fas fa-clock mr-1"></i> ${daysStr}${timeStr}</span>`;
                    }

                    grid.innerHTML += `
                        <div class="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200 hover:shadow-xl hover:border-indigo-200 transition-all duration-300 group flex flex-col h-full cursor-pointer" onclick="enterCourse('${c.id}')">
                            <div class="flex justify-between items-start mb-4">
                                <div class="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-primary text-xl group-hover:scale-110 transition"><i class="fas fa-book"></i></div>
                                <div class="flex gap-2 relative z-10" onclick="event.stopPropagation()">
                                    <button onclick="editCourse('${c.id}')" data-right="edit" data-action-name="แก้ไขรายวิชา" data-permission-allowed="${__shCanEdit ? '1' : '0'}" aria-disabled="${__shCanEdit ? 'false' : 'true'}" class="text-slate-400 hover:text-blue-500 w-8 h-8 rounded-full hover:bg-blue-50 flex items-center justify-center transition ${__shCanEdit ? '' : 'sh-permission-disabled opacity-50 cursor-not-allowed'}"><i class="fas fa-pen text-sm"></i></button>
                                    <button onclick="deleteCourse('${c.id}')" data-right="delete" data-action-name="ลบรายวิชา" data-permission-allowed="${__shCanDelete ? '1' : '0'}" aria-disabled="${__shCanDelete ? 'false' : 'true'}" class="text-slate-400 hover:text-rose-500 w-8 h-8 rounded-full hover:bg-rose-50 flex items-center justify-center transition ${__shCanDelete ? '' : 'sh-permission-disabled opacity-50 cursor-not-allowed'}"><i class="fas fa-trash text-sm"></i></button>
                                </div>
                            </div>
                            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">${c.code}</h4>
                            <h3 class="text-xl font-bold text-slate-800 mb-2 leading-tight line-clamp-2">${c.name}</h3>
                            <div class="text-sm mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                                ${scheduleDisplay}
                                <span class="bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-white transition"><i class="fas fa-chevron-right text-sm"></i></span>
                            </div>
                        </div>`;
                });
            }
        };


        if (window.renderCourseGrid && !window.renderCourseGrid.__schoolhubSharedInviteWrapped) {
            const __oldRenderCourseGridSharedInvite = window.renderCourseGrid;
            window.renderCourseGrid = function(){
                const result = __oldRenderCourseGridSharedInvite.apply(this, arguments);
                setTimeout(schoolhubRenderIncomingShares, 0);
                setTimeout(schoolhubApplyReadonlyUI, 0);
                return result;
            };
            window.renderCourseGrid.__schoolhubSharedInviteWrapped = true;
        }

        window.editCourse = (id) => {
            const c = state.courses.find(x => x.id === id); if(!c) return;
            editingCourseId = id;
            document.getElementById('course-code-input').value = c.code; document.getElementById('course-name-input').value = c.name;
            document.querySelectorAll('.course-day').forEach(cb => cb.checked = (c.schedule?.days?.includes(parseInt(cb.value))));
            document.getElementById('course-time-start').value = c.schedule?.startTime || ''; document.getElementById('course-time-end').value = c.schedule?.endTime || '';
            document.getElementById('course-modal-title').textContent = 'แก้ไขข้อมูลรายวิชา';
            window.renderCourseStudentSelectors(c);
            window.openModal('course-modal');
        };

        window.handleCourseSubmit = async (e) => {
            if (window.__schoolhubPlanLocked && !isAdmin) return showCustomAlert('บัญชีถูกล็อก','กรุณาต่ออายุแผนก่อนเพิ่มหรือแก้ไขรายวิชา',true);
            if (!editingCourseId && !canCreateMoreCourses()) return showCustomAlert('เกินจำนวนรายวิชาของแผน','แผนปัจจุบันเพิ่มรายวิชาได้สูงสุด ' + getCurrentCourseLimitText() + ' กรุณาอัปเกรดแผนก่อน',true);
            const selectedDays = []; document.querySelectorAll('.course-day:checked').forEach(cb => selectedDays.push(parseInt(cb.value)));
            const schedule = { days: selectedDays, startTime: document.getElementById('course-time-start').value, endTime: document.getElementById('course-time-end').value };
            const studentRooms = Array.from(document.querySelectorAll('.course-room-checkbox:checked')).map(cb => cb.value);
            const extraStudentIds = [...new Set(window.courseSelectedIndividualIds || [])];
            if(editingCourseId) {
                const idx = state.courses.findIndex(c => c.id === editingCourseId);
                if(idx > -1) { state.courses[idx].code = document.getElementById('course-code-input').value; state.courses[idx].name = document.getElementById('course-name-input').value; state.courses[idx].schedule = schedule; state.courses[idx].studentRooms = studentRooms; state.courses[idx].studentGrades = studentRooms; state.courses[idx].extraStudentIds = extraStudentIds; }
                showCustomAlert('สำเร็จ', 'แก้ไขรายวิชาสำเร็จ');
            } else {
                state.courses.push({ id: Date.now().toString(), code: document.getElementById('course-code-input').value, name: document.getElementById('course-name-input').value, schedule: schedule, studentRooms, studentGrades: studentRooms, extraStudentIds });
                showCustomAlert('สำเร็จ', 'เพิ่มรายวิชาใหม่สำเร็จ');
            }
            e.target.reset(); window.closeCourseModal(); updateGlobalViews(); await saveStateToDB();
        };

        window.deleteCourse = (id) => {
            window.showCustomConfirm("ยืนยันลบรายวิชา", "ลบวิชานี้และแผนคะแนนทั้งหมดทิ้งใช่หรือไม่?", async () => {
                state.courses = state.courses.filter(c => c.id !== id); updateGlobalViews(); await saveStateToDB(); showCustomAlert('สำเร็จ', 'ลบรายวิชาเรียบร้อย');
            });
        };

        // Students Master Management
        window.renderStudentsMaster = () => {
            const tbody = document.getElementById('student-list-master');
            if (!tbody) return;
            tbody.innerHTML = '';
            const students = state.students || [];
            if (students.length === 0) {
                document.getElementById('empty-student-master').classList.remove('hidden');
                return;
            }
            document.getElementById('empty-student-master').classList.add('hidden');
            const rooms = {};
            students.forEach(st => {
                const room = window.getStudentClassName(st);
                if (!rooms[room]) rooms[room] = [];
                rooms[room].push(st);
            });
            const __shCanEditStudent = (typeof window.currentPlanAllows === 'function') ? window.currentPlanAllows('edit') : true;
            const __shCanDeleteStudent = (typeof window.currentPlanAllows === 'function') ? window.currentPlanAllows('delete') : true;
            Object.keys(rooms).sort((a,b)=>a.localeCompare(b,'th')).forEach((room, idx) => {
                const groupId = 'student-room-group-' + idx;
                const list = rooms[room].sort((a,b)=>String(a.code||'').localeCompare(String(b.code||''),'th',{numeric:true}) || String(a.name||'').localeCompare(String(b.name||''),'th'));
                const __roomDeleteBtn = __shCanDeleteStudent ? `<button onclick="event.stopPropagation(); deleteStudentRoom(this)" data-room="${escapeHTML(room)}" class="text-rose-500 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1"><i class="fas fa-trash mr-1"></i>ลบทั้งห้อง</button>` : '';
                tbody.innerHTML += `<tr class="bg-indigo-50/80 border-y border-indigo-100"><td colspan="4" class="p-4"><div class="flex items-center justify-between"><div class="font-black text-primary cursor-pointer" onclick="toggleStudentRoomGroup('${groupId}')"><i class="fas fa-door-open mr-2"></i>${escapeHTML(room)}</div><div class="flex items-center gap-2"><div class="text-xs font-bold text-indigo-500 bg-white px-3 py-1 rounded-full">${list.length} คน</div>${__roomDeleteBtn}</div></div></td></tr>`;
                list.forEach(s => {
                    tbody.innerHTML += `
                        <tr class="${groupId}${window.getStudentWithdrawnRowClass(s)}">
                            <td class="font-mono font-medium text-slate-500${window.getStudentWithdrawnClass(s)}">${escapeHTML(s.code)}</td>
                            <td class="font-bold text-slate-700${window.getStudentWithdrawnClass(s)}">${escapeHTML(s.name)}${window.getStudentWithdrawnBadge(s)}</td>
                            <td><span class="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-lg text-xs font-bold">${escapeHTML(window.getStudentClassName(s))}</span></td>
                            <td class="text-right">
                                <button onclick="event.stopPropagation(); showStudentMoreMenu('${s.id}', this)" class="text-slate-600 bg-slate-100 px-2 h-8 rounded-lg hover:bg-slate-200 text-xs font-bold mr-1">อื่นๆ</button>
                                <button onclick="event.stopPropagation(); editStudent('${s.id}')" data-right="edit" data-action-name="แก้ไขข้อมูลนักเรียน" data-permission-allowed="${__shCanEditStudent ? '1' : '0'}" aria-disabled="${__shCanEditStudent ? 'false' : 'true'}" class="text-blue-500 bg-blue-50 w-8 h-8 rounded-lg hover:bg-blue-100 ${__shCanEditStudent ? '' : 'sh-permission-disabled opacity-50 cursor-not-allowed'}"><i class="fas fa-edit"></i></button>
                                <button onclick="event.stopPropagation(); deleteStudent('${s.id}')" data-right="delete" data-action-name="ลบนักเรียน" data-permission-allowed="${__shCanDeleteStudent ? '1' : '0'}" aria-disabled="${__shCanDeleteStudent ? 'false' : 'true'}" class="text-rose-500 bg-rose-50 w-8 h-8 rounded-lg hover:bg-rose-100 ml-1 ${__shCanDeleteStudent ? '' : 'sh-permission-disabled opacity-50 cursor-not-allowed'}"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>`;
                });
            });
        };

        window.toggleStudentRoomGroup = (groupId) => {
            document.querySelectorAll('.' + groupId).forEach(row => row.classList.toggle('hidden'));
        };

        window.openMultiStudentModal = () => {
            const tbody = document.getElementById('multi-student-tbody'); tbody.innerHTML = '';
            for(let i=0; i<3; i++) addStudentRow();
            window.openModal('multi-student-modal');
        };

        window.addStudentRow = () => {
            const tr = document.createElement('tr'); tr.className = "border-b hover:bg-slate-50 transition group";
            tr.innerHTML = `
                <td class="p-2 border-r"><input type="text" class="student-code-input w-full p-2 outline-none bg-transparent" placeholder="รหัส (วางข้อมูลที่นี่)" onpaste="handlePasteStudent(event, this)"></td>
                <td class="p-2 border-r"><input type="text" class="student-name-input w-full p-2 outline-none bg-transparent" placeholder="ชื่อ-นามสกุล"></td>
                <td class="p-2 border-r"><input type="text" class="student-grade-input w-full p-2 outline-none bg-transparent" placeholder="ปวช.2/1 หรือ ห้อง 1"></td>
                <td class="p-2 text-center"><button type="button" onclick="this.closest('tr').remove()" class="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition"><i class="fas fa-times"></i></button></td>
            `;
            document.getElementById('multi-student-tbody').appendChild(tr);
        };

        window.handlePasteStudent = (e, targetInput) => {
            e.preventDefault(); const pastedData = (e.clipboardData || window.clipboardData).getData('Text'); if(!pastedData) return;
            const rows = pastedData.split(/\r\n|\n|\r/).filter(row => row.trim() !== '');
            let currentTr = targetInput.closest('tr');
            rows.forEach(row => {
                const cols = row.split(/\t/);
                if(!currentTr) { addStudentRow(); currentTr = document.getElementById('multi-student-tbody').lastElementChild; }
                const inputs = currentTr.querySelectorAll('input');
                if(cols[0]) inputs[0].value = cols[0].trim(); if(cols[1]) inputs[1].value = cols[1].trim(); if(cols[2]) inputs[2].value = cols[2].trim();
                currentTr = currentTr.nextElementSibling;
            });
        };

        window.handleMultiStudentSubmit = async () => {
            let added = 0;
            document.querySelectorAll('#multi-student-tbody tr').forEach(tr => {
                const c = tr.querySelector('.student-code-input').value.trim(), n = tr.querySelector('.student-name-input').value.trim(), g = tr.querySelector('.student-grade-input').value.trim();
                if(c && n) { state.students.push({ id: Date.now().toString() + Math.random().toString(36).substr(2, 5), code: c, name: n, grade: g || '-', room: g || '-' }); added++; }
            });
            window.closeModal('multi-student-modal'); renderStudentsMaster(); updateGlobalViews();
            if(added > 0) { await saveStateToDB(); showCustomAlert("สำเร็จ", `นำเข้านักเรียน ${added} รายการสำเร็จ`); }
        };

        // Grade Criteria Logic
        const defaultGradeCriteria = { 4: 80, 3.5: 75, 3: 70, 2.5: 65, 2: 60, 1.5: 55, 1: 50 };
        window.defaultGradeCriteria = defaultGradeCriteria;

        window.openGradeCriteriaModalForCurrentCourse = () => {
            if(!currentActiveCourseId) return;
            const cid = currentActiveCourseId;
            if(!state.courseGrades) state.courseGrades = {};
            const criteria = state.courseGrades[cid] || defaultGradeCriteria;

            document.getElementById('grade-crit-4').value = criteria['4'];
            document.getElementById('grade-crit-35').value = criteria['3.5'];
            document.getElementById('grade-crit-3').value = criteria['3'];
            document.getElementById('grade-crit-25').value = criteria['2.5'];
            document.getElementById('grade-crit-2').value = criteria['2'];
            document.getElementById('grade-crit-15').value = criteria['1.5'];
            document.getElementById('grade-crit-1').value = criteria['1'];

            window.openModal('grade-criteria-modal');
        };

        async function legacyNumericGradeCriteriaSubmitDisabled() {
            // Legacy numeric-only save is intentionally disabled.
            // The real save path is the final canonical submit handler, which writes gradeRules/specialRules to course.gradeCriteria.
            return false;
        }

        function calculateGrade(score, criteria) {
            if (typeof window.calculateGradeFromRules === 'function') {
                return window.calculateGradeFromRules(score, criteria);
            }
            return '';
        }

        // Legacy getFinalGradeForStudent placeholder removed. The canonical implementation is defined once later.

        window.editStudent = (id) => {
            const s = state.students.find(x => x.id === id); if(!s) return;
            editingStudentId = id;
            document.getElementById('edit-student-code').value = s.code; document.getElementById('edit-student-name').value = s.name; document.getElementById('edit-student-grade').value = s.grade; if(document.getElementById('edit-student-withdrawn')) document.getElementById('edit-student-withdrawn').checked = window.isStudentWithdrawn(s);
            window.openModal('student-edit-modal');
        };

        window.handleStudentEditSubmit = async (e) => {
            if(!editingStudentId) return;
            const idx = state.students.findIndex(s => s.id === editingStudentId);
            if(idx > -1) {
                state.students[idx].code = document.getElementById('edit-student-code').value;
                state.students[idx].name = document.getElementById('edit-student-name').value;
                state.students[idx].grade = document.getElementById('edit-student-grade').value; state.students[idx].room = document.getElementById('edit-student-grade').value;
            }
            window.closeModal('student-edit-modal'); renderStudentsMaster(); await saveStateToDB(); showCustomAlert('สำเร็จ', 'อัปเดตข้อมูลนักเรียนเรียบร้อย');
        };

        window.deleteStudent = (id) => { window.showCustomConfirm("ยืนยันการลบ", "ลบนักเรียนคนนี้ออกจากฐานข้อมูล?", async () => { state.students = state.students.filter(s => s.id !== id); renderStudentsMaster(); updateGlobalViews(); await saveStateToDB(); }); };
        window.deleteStudentRoom = (btnEl) => {
            const room = btnEl ? btnEl.getAttribute('data-room') : null;
            if (!room) return;
            const roomStudents = (state.students || []).filter(s => window.getStudentClassName(s) === room);
            if (roomStudents.length === 0) return;
            window.showCustomConfirm(
                'ลบนักเรียนทั้งห้อง',
                `ต้องการลบนักเรียนทั้งหมด ${roomStudents.length} คน ในห้อง "${room}" ออกจากฐานข้อมูลหรือไม่?\nการกระทำนี้ไม่สามารถย้อนกลับได้`,
                async () => {
                    const ids = new Set(roomStudents.map(s => s.id));
                    state.students = (state.students || []).filter(s => !ids.has(s.id));
                    renderStudentsMaster();
                    updateGlobalViews();
                    await saveStateToDB();
                    showCustomAlert('สำเร็จ', `ลบนักเรียนห้อง "${room}" จำนวน ${roomStudents.length} คน เรียบร้อยแล้ว`);
                }
            );
        };

        // --- THE NEW OVERVIEW SUMMARY TABLE (Horizontal Matrix) ---
        window.showPlanDetail = (courseId, planId) => {
            const plan = ((state.coursePlans && state.coursePlans[courseId]) || []).find(p => p.id === planId);
            if(!plan) return;
            const isChecklist = Number(plan.maxScore) === 0;
            const scoreText = isChecklist ? 'เช็คงาน' : `${plan.maxScore} คะแนน`;
            showCustomAlert(`สัปดาห์ที่ ${plan.week}`, `ชื่องาน: ${plan.title}\nคะแนนเต็ม: ${scoreText}`);
        };
        window.renderCourseOverview = () => {
            const table = document.getElementById('course-summary-table'); table.innerHTML = '';
            const courseStudents = window.getCourseStudents(currentActiveCourseId);
            if(!currentActiveCourseId || courseStudents.length === 0) {
                document.getElementById('empty-summary').classList.remove('hidden'); return;
            }
            document.getElementById('empty-summary').classList.add('hidden');

            const cid = currentActiveCourseId;
            const history = state.attendance[cid] || {};
            const attDates = Object.keys(history);
            const plans = (state.coursePlans[cid] || []).sort((a,b) => a.week - b.week);
            const courseScores = state.scores.filter(s => s.courseId === cid);
            const gradeCriteria = (state.courseGrades && state.courseGrades[cid]) ? state.courseGrades[cid] : defaultGradeCriteria;

            // Build Header
            let thead = `<thead><tr><th class="sticky summary-sticky-no summary-no-col bg-slate-50 z-20 border-r text-center align-middle">ลำดับ</th><th class="sticky summary-sticky-code summary-code-col bg-slate-50 z-20 border-r text-center align-middle">รหัสนักเรียน</th><th class="sticky summary-sticky-name summary-name-col bg-slate-50 z-20 border-r text-center align-middle">ชื่อ - นามสกุล</th>`;
            thead += `<th class="text-center bg-emerald-50 text-emerald-700 summary-att-col" style="cursor:pointer" title="มา/สาย/ขาด/ลา — ดับเบิลคลิกที่ช่องของนักเรียนแต่ละคนเพื่อดูรายละเอียดวันที่">เช็คชื่อ<br><span class="text-[9px]">มา/สาย/ขาด/ลา</span></th>`;
            let totalMax = 0;
            plans.forEach(p => {
                const isChecklist = Number(p.maxScore) === 0;
                const subtitle = isChecklist ? 'เช็คงาน' : `เต็ม ${p.maxScore}`;
                thead += `<th class="text-center bg-indigo-50 text-indigo-700 summary-score-col" title="คลิกเพื่อดูรายละเอียด: สัปดาห์ ${p.week} | ${p.title} | ${subtitle}"><button type="button" onclick="showPlanDetail('${cid}', '${p.id}')" class="week-detail-btn inline-flex items-center justify-center bg-white border border-indigo-200 text-primary font-bold hover:bg-primary hover:text-white transition shadow-sm">${p.week}</button></th>`;
                if (!isChecklist) totalMax = window.addScoreToTotal(totalMax, p.maxScore, 2);
            });
            thead += `<th class="text-center bg-slate-800 text-white font-bold summary-total-col">รวม<br><span class="text-[9px] text-slate-300">${window.formatScoreDisplay(totalMax, 2)}</span></th>`;
            thead += `<th class="text-center bg-emerald-600 text-white font-bold sh-bonus-col" style="font-size:10px;padding:2px 1px;white-space:nowrap" title="คะแนนโบนัส — คลิกที่ช่องของนักเรียนเพื่อดูรายละเอียด, ดับเบิลคลิกที่หัวข้อนี้เพื่อตั้งค่าการรวมกับคะแนนรวม" ondblclick="shOvOpenBonusMergeSettings('${cid}')">+โบนัส</th>`;
            thead += `<th class="text-center bg-amber-500 text-white font-bold sh-star-col" style="font-size:10px;padding:2px 1px;white-space:nowrap;cursor:pointer" title="ดับเบิลคลิกเพื่อแปลงดาวเป็นคะแนน" ondblclick="if(typeof window.openStarConversionPopup==='function') window.openStarConversionPopup()">⭐ดาว</th>`;
            thead += `<th class="text-center bg-amber-50 text-amber-700 font-bold summary-grade-col">เกรด</th></tr></thead>`;
            table.innerHTML = thead;

            let tbody = '<tbody>';
            courseStudents.forEach((s, index) => {
                // Calculate Attendance
                let pr=0, la=0, ab=0, lv=0;
                const __attDetail = { present:[], late:[], absent:[], leave:[] };
                attDates.forEach(d => {
                    const st = history[d].records[s.id];
                    if(st==='present'){ pr++; __attDetail.present.push(d); }
                    else if(st==='late'){ la++; __attDetail.late.push(d); }
                    else if(st==='absent'){ ab++; __attDetail.absent.push(d); }
                    else if(st==='leave'){
                        lv++;
                        const __reason = (history[d].leaveReasons && history[d].leaveReasons[s.id]) || '';
                        __attDetail.leave.push({ date: d, reason: __reason });
                    }
                });
                const __attDetailJson = encodeURIComponent(JSON.stringify(__attDetail));

                tbody += `<tr class="${window.getStudentWithdrawnRowClass(s)}"><td class="sticky summary-sticky-no summary-no-col bg-white z-20 border-r text-center font-bold text-slate-500${window.getStudentWithdrawnClass(s)}">${index + 1}</td><td class="sticky summary-sticky-code summary-code-col bg-white z-20 border-r font-mono text-slate-700${window.getStudentWithdrawnClass(s)}" title="${s.code}">${s.code}</td><td class="sticky summary-sticky-name summary-name-col bg-white z-20 border-r font-bold text-slate-700${window.getStudentWithdrawnClass(s)}" title="${s.name}">${s.name}${window.getStudentWithdrawnBadge(s)}</td>`;
                tbody += `<td class="text-center font-bold summary-att-col" style="cursor:pointer" title="ดับเบิลคลิกเพื่อดูรายละเอียดวันที่มา/สาย/ขาด/ลา" ondblclick="shOvShowAttendanceDetail('${s.id}','${(s.name||s.id).replace(/'/g,"\\'")}','${__attDetailJson}')"><span class="text-emerald-500">${pr}</span>/<span class="text-amber-500">${la}</span>/<span class="text-rose-500">${ab}</span>/<span style="color:#7c3aed">${lv}</span></td>`;

                let totalScore = 0;
                plans.forEach(p => {
                    const task = courseScores.find(ts => ts.week === p.week && ts.title === p.title);
                    const rawScore = task && task.records[s.id] !== undefined ? task.records[s.id] : null;
                    const isChecklist = Number(p.maxScore) === 0;

                    if (isChecklist) {
                        const icon = rawScore === 1 ? '<span class="summary-score-cell-content text-emerald-500"><i class="fas fa-check"></i></span>' : (rawScore === 0 ? '<span class="summary-score-cell-content text-rose-300"><i class="fas fa-times"></i></span>' : '<span class="summary-score-cell-content text-slate-300">-</span>');
                        tbody += `<td class="text-center summary-score-col">${icon}</td>`;
                    } else {
                        totalScore = window.addScoreToTotal(totalScore, rawScore, 2);

                        let displayHtml = '';
                        if (!task) {
                            // ยังไม่มีการบันทึกสัปดาห์นี้
                            displayHtml = `<span class="summary-score-cell-content text-slate-300">-</span>`;
                        } else if ((window.isMissingScoreValue ? window.isMissingScoreValue(rawScore) : rawScore==='')) {
                            // มีการบันทึกแล้ว แต่ช่องของเด็กคนนี้เว้นว่างไว้ (ไม่ได้กรอก)
                            displayHtml = `<span class="summary-score-cell-content text-rose-600 font-black">X</span>`;
                        } else {
                            const __convInfo = (typeof window.shStarConvGetCellInfo === 'function') ? window.shStarConvGetCellInfo(cid, p.week, p.title, s.id) : null;
                            if (__convInfo && __convInfo.amount > 0) {
                                displayHtml = `<span class="summary-score-cell-content" style="color:#b45309;font-weight:800" title="${escapeHTML(__convInfo.tooltip)}">${window.formatScoreDisplay(rawScore, 2)} ⭐</span>`;
                            } else {
                                displayHtml = `<span class="summary-score-cell-content text-slate-700">${window.formatScoreDisplay(rawScore, 2)}</span>`;
                            }
                        }
                        tbody += `<td class="text-center font-mono summary-score-col">${displayHtml}</td>`;
                    }
                });
                // Bonus scores for this student
                const __bonusByCid = (state.bonusScores && state.bonusScores[cid]) || {};
                let __totalBonus = 0;
                const __bonusDetail = [];
                Object.keys(__bonusByCid).forEach(wk => {
                  const wVal = __bonusByCid[wk] && __bonusByCid[wk][s.id];
                  if (wVal !== undefined && wVal !== '' && !isNaN(Number(wVal)) && Number(wVal) !== 0) {
                    __totalBonus += Number(wVal);
                    const __isConv = /^Bonus-Stars-/.test(wk);
                    __bonusDetail.push({ week: __isConv ? wk : wk.replace(/^w/, ''), val: Number(wVal), key: wk, isConv: __isConv });
                  }
                });
                const __bonusDetailJson = encodeURIComponent(JSON.stringify(__bonusDetail));
                const __bonusCellColor = __totalBonus > 0 ? 'color:#065f46;font-weight:800' : 'color:#94a3b8';
                const __bonusCellBg = __totalBonus > 0 ? 'background:#d1fae5' : '';

                // Stars for this student (from group membership) - Supports Multi-Set
                const __starCourseData = (state.starGroups && state.starGroups[cid]) || {};
                const __starSets = __starCourseData.sets || [];
                let __totalStars = 0;
                const __starDetailMap = {}; // Use map to merge same week from different sets
                
                __starSets.forEach(__set => {
                  const __groups = __set.groups || [];
                  const __weekStars = __set.weekStars || {};
                  const __studentGroups = __groups.filter(g => (g.members||[]).includes(s.id));
                  
                  Object.keys(__weekStars).forEach(wk => {
                    const weekData = __weekStars[wk] || {};
                    let weekStarSum = 0;
                    __studentGroups.forEach(g => { weekStarSum += weekData[g.id] || 0; });
                    if (weekStarSum > 0) {
                      __totalStars += weekStarSum;
                      __starDetailMap[wk] = (__starDetailMap[wk] || 0) + weekStarSum;
                    }
                  });
                });
                
                const __starDetail = Object.keys(__starDetailMap).map(wk => ({
                  week: wk.replace('w',''),
                  stars: __starDetailMap[wk]
                })).sort((a,b) => parseInt(a.week) - parseInt(b.week));
                const __starDetailJson = encodeURIComponent(JSON.stringify(__starDetail));
                const __starCellColor = __totalStars > 0 ? 'color:#92400e;font-weight:800' : 'color:#94a3b8';
                const __starCellBg = __totalStars > 0 ? 'background:#fef3c7' : '';

                // Apply bonus-merge-into-total setting (configured via double-click on the +โบนัส header)
                const __bmSettings = (state.bonusMergeSettings && state.bonusMergeSettings[cid]) || null;
                let __bonusMerged = 0;
                if (__bmSettings && __bmSettings.enabled) {
                    const __included = __bmSettings.mode === 'selected' ? (__bmSettings.selected||[]).includes(s.id) : true;
                    if (__included && __totalBonus) {
                        __bonusMerged = __totalBonus * ((Number(__bmSettings.percent)||0) / 100);
                        totalScore = window.addScoreToTotal(totalScore, __bonusMerged, 2);
                    }
                }
                const __isWithdrawnForBonus = window.isStudentWithdrawn(s);
                const __totalCellTitle = __bonusMerged ? `title="รวมคะแนนโบนัส +${window.formatScoreDisplay(__bonusMerged,2)} แล้ว (${__bmSettings.percent}%)"` : '';
                tbody += `<td class="text-center font-bold text-primary bg-slate-50 border-r summary-total-col" style="position:relative" ${__totalCellTitle}>${window.formatScoreDisplay(totalScore, 2)}${__bonusMerged ? '<span style="position:absolute;top:2px;right:4px;font-size:9px;font-weight:800;color:#059669;line-height:1">+'+window.formatScoreDisplay(__bonusMerged,2)+'</span>' : ''}</td>`;
                if (__isWithdrawnForBonus) {
                    tbody += `<td class="text-center sh-bonus-col withdrawn-score-cell">ลาออก</td>`;
                    tbody += `<td class="text-center sh-star-col withdrawn-score-cell">ลาออก</td>`;
                } else {
                    tbody += `<td class="text-center sh-bonus-col" style="${__bonusCellBg};cursor:pointer" title="โบนัสรวม: ${__totalBonus} คะแนน — คลิกเพื่อดูรายละเอียด" onclick="shOvShowBonusDetail('${s.id}','${(s.name||s.id).replace(/'/g,"\\'")}','${__bonusDetailJson}','${cid}')" ondblclick="shOvShowBonusDetail('${s.id}','${(s.name||s.id).replace(/'/g,"\\'")}','${__bonusDetailJson}','${cid}')"><span style="${__bonusCellColor}">${__totalBonus > 0 ? '+'+__totalBonus : '-'}</span></td>`;
                    tbody += `<td class="text-center sh-star-col" style="${__starCellBg};cursor:pointer" title="ดาวรวม: ${__totalStars} — คลิกเพื่อดูรายละเอียด" onclick="shOvShowStarDetail('${s.id}','${(s.name||s.id).replace(/'/g,"\\'")}','${__starDetailJson}','${cid}')" ondblclick="shOvShowStarDetail('${s.id}','${(s.name||s.id).replace(/'/g,"\\'")}','${__starDetailJson}','${cid}')"><span style="${__starCellColor}">${__totalStars > 0 ? __totalStars+'⭐' : '-'}</span></td>`;
                }

                // Calculate and display grade (single source of truth)
                let gradeDisplay = '-';
                let gradeColor = 'text-slate-400';
                if (totalMax > 0) {
                     const gradeCourse = (state.courses || []).find(c => String(c.id) === String(cid)) || {id: cid, gradeCriteria: gradeCriteria};
                     if (gradeCriteria) gradeCourse.gradeCriteria = gradeCriteria;
                     gradeDisplay = window.getFinalGradeForStudent(gradeCourse, s, window.normalizeScoreNumber(totalScore, 2));
                     gradeColor = (typeof window.schoolhubGradeColor === 'function') ? window.schoolhubGradeColor(gradeDisplay, gradeCriteria) : gradeColor;
                     if(gradeColor === 'text-slate-400') {
                       if(['4','3.5','A','B+'].includes(gradeDisplay)) gradeColor = 'text-emerald-500';
                       else if (['3','2.5','B','C+','C'].includes(gradeDisplay)) gradeColor = 'text-blue-500';
                       else if (['2','1.5','D+','D'].includes(gradeDisplay)) gradeColor = 'text-amber-500';
                       else if (['1','0','F'].includes(gradeDisplay)) gradeColor = 'text-rose-500';
                     }
                }
                tbody += `<td class="text-center font-bold ${gradeColor} bg-amber-50/30 summary-grade-col">${gradeDisplay}</td></tr>`;
            });
            tbody += '</tbody>';
            table.innerHTML += tbody;
        };

        // Course Plans
        window.openPlanModalForCurrentCourse = () => {
            if (typeof window.currentPlanAllows === 'function' && !window.currentPlanAllows('planScores')) {
                if (typeof window.showCustomAlert === 'function') {
                    window.showCustomAlert('แผนนี้ไม่รองรับการจัดการแผนคะแนน', 'กรุณาอัปเกรดแผนเพื่อจัดการแผนเก็บคะแนน', true);
                } else {
                    alert('แผนนี้ไม่รองรับการจัดการแผนคะแนน\nกรุณาอัปเกรดแผนเพื่อจัดการแผนเก็บคะแนน');
                }
                return false;
            }
            if(!currentActiveCourseId) return false;
            const c = state.courses.find(x => x.id === currentActiveCourseId);
            document.getElementById('plan-modal-title').textContent = `(${c && c.code ? c.code : ''})`;
            document.getElementById('plan-course-id').value = currentActiveCourseId;
            window.cancelEditPlan(); window.renderPlanList(currentActiveCourseId); window.openModal('plan-modal');
            return false;
        };
        window.closePlanModal = () => { window.cancelEditPlan(); window.closeModal('plan-modal'); if(currentActiveCourseId) renderCourseOverview(); };

        window.renderPlanList = (id) => {
            const tbody = document.getElementById('plan-list'); tbody.innerHTML = '';
            const plans = state.coursePlans[id] || [];
            if(plans.length === 0) document.getElementById('empty-plan').classList.remove('hidden');
            else {
                document.getElementById('empty-plan').classList.add('hidden');
                const isMobileCardView = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
                const __shCanEditPlanData = (typeof window.currentPlanAllows === 'function') ? window.currentPlanAllows('edit') : true;
                const __shCanDeletePlanData = (typeof window.currentPlanAllows === 'function') ? window.currentPlanAllows('delete') : true;
                const rows = [];
                plans.sort((a,b) => a.week - b.week).forEach(p => {
                    if (isMobileCardView) {
                        const canEditPlan = schoolhubGetShareInfo(id).canEdit;
                        rows.push(`<tr class="schoolhub-mobile-row"><td colspan="4" class="schoolhub-mobile-cell">
                            <div class="schoolhub-mobile-card schoolhub-mobile-plan-card">
                                <div class="schoolhub-mobile-card-head schoolhub-mobile-plan-card-head">
                                    <div class="min-w-0 schoolhub-mobile-plan-title-wrap">
                                        <div class="schoolhub-mobile-card-title">${escapeHTML(p.title||'')}</div>
                                        <div class="schoolhub-mobile-card-sub" style="display:block!important;visibility:visible!important;overflow:visible!important;max-height:none!important"><i class="fas fa-calendar-week text-primary mr-1"></i>สัปดาห์ ${escapeHTML(p.week||'')} · คะแนนเต็ม ${escapeHTML(p.maxScore||'0')} คะแนน</div>
                                    </div>
                                    <button onclick="deletePlan('${id}', '${p.id}')" data-right="delete" data-action-name="ลบแผนคะแนน" data-share-locked="${canEditPlan ? '0' : '1'}" data-permission-allowed="${__shCanDeletePlanData ? '1' : '0'}" aria-disabled="${(canEditPlan && __shCanDeletePlanData) ? 'false' : 'true'}" ${canEditPlan ? '' : 'disabled'} class="schoolhub-mobile-plan-delete-x ${(canEditPlan && __shCanDeletePlanData) ? '' : 'sh-permission-disabled opacity-50'} ${canEditPlan ? '' : 'pointer-events-none'}" aria-label="ลบแผนคะแนน"><i class="fas fa-times"></i></button>
                                </div>
                                <div class="schoolhub-mobile-card-actions">
                                    <button onclick="editPlan('${id}', '${p.id}')" data-right="edit" data-action-name="แก้ไขแผนคะแนน" data-share-locked="${canEditPlan ? '0' : '1'}" data-permission-allowed="${__shCanEditPlanData ? '1' : '0'}" aria-disabled="${(canEditPlan && __shCanEditPlanData) ? 'false' : 'true'}" ${canEditPlan ? '' : 'disabled'} class="schoolhub-mobile-action-btn edit ${(canEditPlan && __shCanEditPlanData) ? '' : 'sh-permission-disabled opacity-50'} ${canEditPlan ? '' : 'pointer-events-none'}"><i class="fas fa-edit"></i> แก้ไข</button>
                                </div>
                            </div>
                        </td></tr>`);
                    } else {
                        rows.push(`<tr class="border-b"><td class="p-3 font-bold text-slate-600">สัปดาห์ ${p.week}</td><td class="p-3 font-medium">${p.title}</td><td class="p-3 text-center text-primary font-bold">${p.maxScore}</td><td class="p-3 text-right" style="position:relative;z-index:12;pointer-events:auto"><button onmousedown="event.stopPropagation();editPlan('${id}','${p.id}')" data-right="edit" data-action-name="แก้ไขแผนคะแนน" data-permission-allowed="${__shCanEditPlanData ? '1' : '0'}" aria-disabled="${__shCanEditPlanData ? 'false' : 'true'}" class="text-blue-500 bg-blue-50 w-8 h-8 rounded hover:bg-blue-100 mr-1 ${__shCanEditPlanData ? '' : 'sh-permission-disabled opacity-50 cursor-not-allowed'}" style="cursor:pointer;position:relative;z-index:13;pointer-events:auto"><i class="fas fa-edit"></i></button><button onmousedown="event.stopPropagation();deletePlan('${id}','${p.id}')" data-right="delete" data-action-name="ลบแผนคะแนน" data-permission-allowed="${__shCanDeletePlanData ? '1' : '0'}" aria-disabled="${__shCanDeletePlanData ? 'false' : 'true'}" class="text-rose-500 bg-rose-50 w-8 h-8 rounded hover:bg-rose-100 ${__shCanDeletePlanData ? '' : 'sh-permission-disabled opacity-50 cursor-not-allowed'}" style="cursor:pointer;position:relative;z-index:13;pointer-events:auto"><i class="fas fa-trash"></i></button></td></tr>`);
                    }
                });
                tbody.innerHTML = rows.join('');
            }
        };

        window.editPlan = (courseId, planId) => {
            if(!schoolhubAssertCanEditCourse(courseId, 'แก้ไขแผนคะแนน')) return;
            const p = state.coursePlans[courseId].find(x => x.id === planId); if(!p) return;
            editingPlanId = planId;
            document.getElementById('plan-week').value = p.week; document.getElementById('plan-title').value = p.title; document.getElementById('plan-max').value = p.maxScore;
            document.getElementById('plan-submit-btn').innerHTML = '<i class="fas fa-save"></i> บันทึก'; document.getElementById('plan-submit-btn').classList.replace('bg-primary', 'bg-blue-600');
            document.getElementById('plan-cancel-edit-btn').classList.remove('hidden'); document.getElementById('plan-edit-badge').classList.remove('hidden');

            const scrollPlanModalToTop = () => {
                const modal = document.getElementById('plan-modal');
                if(!modal) return;
                const scrollers = [];
                const modalBox = modal.querySelector(':scope > div');
                if(modalBox) scrollers.push(modalBox);
                modal.querySelectorAll('.overflow-y-auto').forEach(el => scrollers.push(el));
                if(modalBox && modalBox.children[1]) scrollers.push(modalBox.children[1]);
                scrollers.push(modal);
                scrollers.forEach(el => { try { el.scrollTop = 0; } catch(e) {} });
            };

            // Snap to the top immediately, then re-assert it after the DOM/keyboard settles,
            // no matter which row (week) triggered the edit.
            scrollPlanModalToTop();
            requestAnimationFrame(() => {
                scrollPlanModalToTop();
                setTimeout(() => {
                    scrollPlanModalToTop();
                    const titleInput = document.getElementById('plan-title');
                    if(titleInput && titleInput.focus) titleInput.focus({ preventScroll: true });
                    setTimeout(scrollPlanModalToTop, 120);
                }, 50);
            });
        };
        window.cancelEditPlan = () => {
            editingPlanId = null; document.getElementById('plan-week').value = '1'; document.getElementById('plan-title').value = ''; document.getElementById('plan-max').value = '10';
            document.getElementById('plan-submit-btn').innerHTML = '<i class="fas fa-plus"></i>'; document.getElementById('plan-submit-btn').classList.replace('bg-blue-600', 'bg-primary');
            document.getElementById('plan-cancel-edit-btn').classList.add('hidden'); document.getElementById('plan-edit-badge').classList.add('hidden');
        };
        window.handleAddPlan = async (e) => {
            const id = document.getElementById('plan-course-id').value; if(!schoolhubAssertCanEditCourse(id, 'เพิ่มหรือแก้ไขแผนคะแนน')) return;
            if(!state.coursePlans[id]) state.coursePlans[id] = [];

            const newWeek = document.getElementById('plan-week').value;
            const newTitle = document.getElementById('plan-title').value;
            const newMax = document.getElementById('plan-max').value;

            // คะแนนที่บันทึกไว้ (state.scores) จะผูกกับ "สัปดาห์ + ชื่องาน" ของแผนนี้
            // ถ้าแก้ไขสัปดาห์/ชื่องานแล้วบันทึกทันที คะแนนเดิมจะหลุดการเชื่อมโยง (ดูเหมือนหายไป)
            // ฟังก์ชันนี้จึงต้องถามผู้ใช้ก่อนว่าจะ "เก็บคะแนนเดิมไว้" (ย้ายไปผูกกับชื่อ/สัปดาห์ใหม่)
            // หรือจะ "ล้างคะแนนเดิมทิ้ง" เมื่อพบว่ามีคะแนนที่เคยบันทึกไว้ของสัปดาห์/ชื่องานเดิมอยู่จริง
            const commitPlanSave = async (keepOldScore) => {
                if (editingPlanId) {
                    const idx = state.coursePlans[id].findIndex(p => p.id === editingPlanId);
                    if (idx > -1) {
                        const oldWeek = state.coursePlans[id][idx].week;
                        const oldTitle = state.coursePlans[id][idx].title;
                        const oldScoreIdx = state.scores.findIndex(s => s.courseId === id && String(s.week) === String(oldWeek) && String(s.title) === String(oldTitle));
                        if (oldScoreIdx > -1 && (String(oldWeek) !== String(newWeek) || String(oldTitle) !== String(newTitle))) {
                            if (keepOldScore) {
                                // ย้ายคะแนนเดิมไปผูกกับสัปดาห์/ชื่องานใหม่ เพื่อไม่ให้คะแนนหาย
                                state.scores[oldScoreIdx].week = newWeek;
                                state.scores[oldScoreIdx].title = newTitle;
                                state.scores[oldScoreIdx].maxScore = newMax;
                            } else {
                                // ล้างคะแนนเดิมทิ้งตามที่ผู้ใช้เลือก
                                state.scores.splice(oldScoreIdx, 1);
                            }
                        }
                        state.coursePlans[id][idx].week = newWeek; state.coursePlans[id][idx].title = newTitle; state.coursePlans[id][idx].maxScore = newMax;
                    }
                } else {
                    state.coursePlans[id].push({ id: Date.now().toString(), week: newWeek, title: newTitle, maxScore: newMax });
                }
                window.cancelEditPlan(); window.renderPlanList(id); await saveStateToDB();
            };

            if (editingPlanId) {
                const idx = state.coursePlans[id].findIndex(p => p.id === editingPlanId);
                if (idx > -1) {
                    const oldWeek = state.coursePlans[id][idx].week;
                    const oldTitle = state.coursePlans[id][idx].title;
                    const weekOrTitleChanged = String(oldWeek) !== String(newWeek) || String(oldTitle) !== String(newTitle);
                    const hasOldScore = weekOrTitleChanged && state.scores.some(s => s.courseId === id && String(s.week) === String(oldWeek) && String(s.title) === String(oldTitle));
                    if (hasOldScore) {
                        window.showCustomConfirm(
                            'พบคะแนนที่เคยบันทึกไว้',
                            `งาน "${oldTitle}" (สัปดาห์ที่ ${oldWeek}) มีการบันทึกคะแนนไว้แล้ว\n\nกด "ยืนยัน" เพื่อเก็บคะแนนเดิมไว้ (ย้ายไปผูกกับชื่องาน/สัปดาห์ที่แก้ไขใหม่)\nกด "ยกเลิก" เพื่อล้างคะแนนเดิมทิ้ง แล้วเริ่มเก็บคะแนนใหม่ในสัปดาห์นี้`,
                            async () => { await commitPlanSave(true); },
                            async () => { await commitPlanSave(false); }
                        );
                        return;
                    }
                }
            }

            await commitPlanSave(true);
        };
        window.deletePlan = (cId, pId) => { if(!schoolhubAssertCanEditCourse(cId, 'ลบแผนคะแนน')) return; window.showCustomConfirm("ยืนยัน", "ต้องการลบแผนคะแนนนี้ใช่หรือไม่?", async () => { state.coursePlans[cId] = state.coursePlans[cId].filter(p => p.id !== pId); window.renderPlanList(cId); await saveStateToDB(); }); };

        window.populateHiddenCourseDropdowns = () => {
            const opts = '<option value="">-- เลือกวิชา --</option>' + state.courses.map(c => `<option value="${c.id}">${c.code}</option>`).join('');
            ['att-course-select', 'score-course-select'].forEach(id => { const el = document.getElementById(id); if(el && el.dataset.schoolhubOptionsHtml !== opts) { el.innerHTML = opts; el.dataset.schoolhubOptionsHtml = opts; } });
        };

        // Attendance Logic
        const monthNamesThai = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
        window.changeMonth = (dir) => { calendarMonth += dir; if(calendarMonth > 11) { calendarMonth = 0; calendarYear++; } else if(calendarMonth < 0) { calendarMonth = 11; calendarYear--; } window.initCalendar(); };

        window.openAttendanceCalendarPopup = () => {
            const popup = document.getElementById('attendance-calendar-popup');
            if (popup) popup.classList.remove('hidden');
            window.initCalendar();
        };

        window.closeAttendanceCalendarPopup = () => {
            const popup = document.getElementById('attendance-calendar-popup');
            if (popup) popup.classList.add('hidden');
        };

        document.addEventListener('click', function(e){
            const popup = document.getElementById('attendance-calendar-popup');
            if (popup && e.target === popup) window.closeAttendanceCalendarPopup();
        });

        window.initCalendar = () => {
            const cid = currentActiveCourseId; const calGrid = document.getElementById('calendar-grid');
            if(!cid) return;
            document.getElementById('cal-month-year').textContent = `${monthNamesThai[calendarMonth]} ${calendarYear + 543}`;
            const course = state.courses.find(c => c.id === cid); const classDays = course?.schedule?.days || [];
            const history = state.attendance[cid] || {}; calGrid.innerHTML = '';
            const firstDay = new Date(calendarYear, calendarMonth, 1).getDay(); const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
            for(let i=0; i<firstDay; i++) calGrid.innerHTML += `<div class="p-2 border border-transparent"></div>`;
            for(let i=1; i<=daysInMonth; i++) {
                const dateStr = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
                const isClassDay = classDays.includes(new Date(calendarYear, calendarMonth, i).getDay());
                const hasRecord = history[dateStr] !== undefined;
                let classes = "cal-day border rounded-xl p-2 flex flex-col items-center justify-center h-16";
                if(isClassDay) classes += " class-day"; if(hasRecord) classes += " has-record text-emerald-600";
                let html = `<span class="font-bold text-lg leading-none ${hasRecord?'':'text-slate-600'}">${i}</span>`;
                if(hasRecord) html += `<i class="fas fa-check-circle mt-1 text-[10px]"></i>`;
                calGrid.innerHTML += `<div class="${classes}" onclick="selectAttendanceDate('${dateStr}')" id="cal-day-${dateStr}">${html}</div>`;
            }
            const cd = document.getElementById('att-date').value;
            if (cd && cd.startsWith(`${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}`)) {
                // แค่ highlight วันที่เดิม ไม่ปิด popup และไม่ trigger renderAttendanceList ซ้ำ
                document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('active-day'));
                const dayEl = document.getElementById(`cal-day-${cd}`);
                if(dayEl) dayEl.classList.add('active-day');
            }
        };

        window.selectAttendanceDate = (dateStr) => {
            document.getElementById('att-date').value = dateStr;
            document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('active-day'));
            const dayEl = document.getElementById(`cal-day-${dateStr}`); if(dayEl) dayEl.classList.add('active-day');
            const [y,m,d] = dateStr.split('-');
            const displayText = `${parseInt(d)} ${monthNamesThai[parseInt(m)-1]} ${parseInt(y)+543}`;
            document.getElementById('att-selected-date-display').innerHTML = `<i class="fas fa-calendar-day text-primary mr-2"></i> ${displayText}`;
            const miniDisplay = document.getElementById('attendance-calendar-selected-mini');
            if (miniDisplay) miniDisplay.innerHTML = `<i class="fas fa-calendar-check text-emerald-600 mr-1"></i> วันที่เลือก: <span class="text-primary">${displayText}</span>`;
            document.getElementById('attendance-placeholder').classList.add('hidden');
            document.getElementById('attendance-area').classList.remove('hidden');
            renderAttendanceList();
            window.closeAttendanceCalendarPopup();
        };

        window.renderAttendanceList = () => {
            const cid = currentActiveCourseId; const date = document.getElementById('att-date').value; const tbody = document.getElementById('attendance-list');
            window.ensureCourseRoomActionFilter('attendance-area', cid);
            const courseStudents = window.getCourseStudents(cid); if(!cid || !date) return; tbody.innerHTML = '';
            if(courseStudents.length===0) { tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400 font-semibold">ยังไม่ได้เลือกห้องนักเรียนสำหรับรายวิชานี้ หรือไม่มีนักเรียนในห้องที่เลือก</td></tr>'; return; }
            if(!state.attendance[cid]) state.attendance[cid] = {};
            const existing = state.attendance[cid][date] || { records: {}, updatedAt: null };
            const hasData = !!state.attendance[cid][date];

            const delBtn = document.getElementById('btn-delete-attendance');
            if (delBtn) {
                if (hasData) delBtn.classList.remove('hidden');
                else delBtn.classList.add('hidden');
            }

            document.getElementById('att-last-saved').innerHTML = existing.updatedAt ? `<i class="fas fa-history text-emerald-500"></i> ล่าสุด: ${new Date(existing.updatedAt).toLocaleString('th-TH')}` : `<i class="fas fa-asterisk text-amber-500"></i> ยังไม่ได้บันทึก`;
            const isMobileCardView = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
            courseStudents.forEach((s, index) => {
                const studentOrder = index + 1;
                const hasSavedStatus = existing.records && Object.prototype.hasOwnProperty.call(existing.records, s.id);
                const st = hasSavedStatus ? existing.records[s.id] : (isMobileCardView ? '' : 'present');
                const isWithdrawn = window.isStudentWithdrawn(s);
                const disabledAttr = isWithdrawn ? 'disabled' : '';
                const disabledClass = isWithdrawn ? ' schoolhub-withdrawn-control' : '';
                if (isMobileCardView) {
                    tbody.innerHTML += `
                    <tr class="schoolhub-mobile-row"><td colspan="4" class="schoolhub-mobile-cell">
                        <div class="schoolhub-mobile-card">
                            <div class="schoolhub-mobile-card-head">
                                <div class="min-w-0">
                                    <div class="schoolhub-seq-text${window.getStudentWithdrawnClass(s)}">#${studentOrder}</div>
                                    <div class="schoolhub-mobile-card-title${window.getStudentWithdrawnClass(s)}">${escapeHTML(s.name||'')}${window.getStudentWithdrawnBadge(s)}</div>
                                    <div class="schoolhub-mobile-card-sub${window.getStudentWithdrawnClass(s)}">${escapeHTML(s.code||'')}</div>
                                </div>
                            </div>
                            <div class="schoolhub-mobile-att-actions${disabledClass}" style="flex-wrap:wrap;gap:6px">
                                <label class="schoolhub-mobile-att-btn present ${st==='present'?'is-active':''}" onclick="schoolhubOnAttRadioChange('${s.id}','${cid}','${date}','present')"><input type="radio" name="att_${s.id}" value="present" ${st==='present'?'checked':''} class="w-4 h-4 text-emerald-500 accent-emerald-500" ${disabledAttr}> <span>มา</span></label>
                                <label class="schoolhub-mobile-att-btn late ${st==='late'?'is-active':''}" onclick="schoolhubOnAttRadioChange('${s.id}','${cid}','${date}','late')"><input type="radio" name="att_${s.id}" value="late" ${st==='late'?'checked':''} class="w-4 h-4 text-amber-500 accent-amber-500" ${disabledAttr}> <span>สาย</span></label>
                                <label class="schoolhub-mobile-att-btn absent ${st==='absent'?'is-active':''}" onclick="schoolhubOnAttRadioChange('${s.id}','${cid}','${date}','absent')"><input type="radio" name="att_${s.id}" value="absent" ${st==='absent'?'checked':''} class="w-4 h-4 text-rose-500 accent-rose-500" ${disabledAttr}> <span>ขาด</span></label>
                                <label class="schoolhub-mobile-att-btn leave ${st==='leave'?'is-active':''}" onclick="schoolhubOnAttRadioChange('${s.id}','${cid}','${date}','leave')"><input type="radio" name="att_${s.id}" value="leave" ${st==='leave'?'checked':''} class="w-4 h-4 text-purple-500 accent-purple-500" ${disabledAttr}> <span>ลา</span></label>
                                <span id="leave-btn-wrap-${s.id}" style="width:100%">${st==='leave'?'<button type="button" onclick="openLeaveReasonView(\''+cid+'\',\''+date+'\',\''+s.id+'\')" style="font-size:11px;background:#ede9fe;color:#7c3aed;border:1px solid #c4b5fd;border-radius:8px;padding:4px 10px;font-weight:700;width:100%;text-align:center;cursor:pointer;margin-top:4px"><i class=\'fas fa-align-left mr-1\'></i>เหตุผลการลา</button>':''}</span>
                            </div>
                        </div>
                    </td></tr>`;
                } else {
                    tbody.innerHTML += `
                    <tr class="${window.getStudentWithdrawnRowClass(s)}">
                        <td class="text-center"><span class="schoolhub-seq-text${window.getStudentWithdrawnClass(s)}">#${studentOrder}</span></td><td class="font-mono text-slate-400${window.getStudentWithdrawnClass(s)}">${s.code}</td><td class="font-bold text-slate-700${window.getStudentWithdrawnClass(s)}">${s.name}${window.getStudentWithdrawnBadge(s)}</td>
                        <td>
                            <div class="flex justify-center gap-3 flex-wrap bg-slate-50 p-2 rounded-xl${disabledClass}">
                                <label class="cursor-pointer flex items-center gap-2" onclick="schoolhubOnAttRadioChange('${s.id}','${cid}','${date}','present')"><input type="radio" name="att_${s.id}" value="present" ${st==='present'?'checked':''} class="w-4 h-4 text-emerald-500 accent-emerald-500" ${disabledAttr}> <span class="font-bold text-emerald-700">มา</span></label>
                                <label class="cursor-pointer flex items-center gap-2" onclick="schoolhubOnAttRadioChange('${s.id}','${cid}','${date}','late')"><input type="radio" name="att_${s.id}" value="late" ${st==='late'?'checked':''} class="w-4 h-4 text-amber-500 accent-amber-500" ${disabledAttr}> <span class="font-bold text-amber-600">สาย</span></label>
                                <label class="cursor-pointer flex items-center gap-2" onclick="schoolhubOnAttRadioChange('${s.id}','${cid}','${date}','absent')"><input type="radio" name="att_${s.id}" value="absent" ${st==='absent'?'checked':''} class="w-4 h-4 text-rose-500 accent-rose-500" ${disabledAttr}> <span class="font-bold text-rose-600">ขาด</span></label>
                                <label class="cursor-pointer flex items-center gap-2" onclick="schoolhubOnAttRadioChange('${s.id}','${cid}','${date}','leave')"><input type="radio" name="att_${s.id}" value="leave" ${st==='leave'?'checked':''} class="w-4 h-4 text-purple-500 accent-purple-500" ${disabledAttr}> <span class="font-bold text-purple-600">ลา</span></label>
                                <span id="leave-btn-wrap-${s.id}">${st==='leave'?'<button type="button" onclick="openLeaveReasonView(\''+cid+'\',\''+date+'\',\''+s.id+'\')" class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-lg font-bold border border-purple-200 hover:bg-purple-200"><i class=\'fas fa-align-left mr-1\'></i>เหตุผล</button>':''}</span>
                            </div>
                        </td>
                    </tr>`;
                }
            });
        };
        window.saveAttendance = async () => {
            const cid = currentActiveCourseId; if(!schoolhubAssertCanEditCourse(cid, 'บันทึกเช็คชื่อ')) return; const date = document.getElementById('att-date').value; if(!cid || !date) return;
            const records = Object.assign({}, (state.attendance[cid] && state.attendance[cid][date] && state.attendance[cid][date].records) ? state.attendance[cid][date].records : {});
            const leaveReasons = Object.assign({}, (state.attendance[cid] && state.attendance[cid][date] && state.attendance[cid][date].leaveReasons) ? state.attendance[cid][date].leaveReasons : {});
            window.getCourseStudents(cid).forEach(s => { if(window.isStudentWithdrawn(s)) return; const checked = document.querySelector(`input[name="att_${s.id}"]:checked`); if(checked) records[s.id] = checked.value; });
            if(!state.attendance[cid]) state.attendance[cid] = {}; state.attendance[cid][date] = { records, leaveReasons, updatedAt: Date.now() };
            await saveStateToDB(); window.initCalendar();
            document.getElementById('att-date').value = '';
            document.getElementById('att-selected-date-display').innerHTML = '';
            const miniDisplay = document.getElementById('attendance-calendar-selected-mini');
            if (miniDisplay) miniDisplay.innerHTML = '<i class="fas fa-calendar-day text-slate-400 mr-1"></i> ยังไม่ได้เลือกวันที่';
            document.getElementById('attendance-area').classList.add('hidden');
            document.getElementById('attendance-placeholder').classList.remove('hidden');
            showCustomAlert('สำเร็จ', 'บันทึกเช็คชื่อเรียบร้อย');
        };

        window.deleteAttendance = () => {
            const cid = currentActiveCourseId; if(!schoolhubAssertCanEditCourse(cid, 'ลบข้อมูลเช็คชื่อ')) return; const date = document.getElementById('att-date').value; if(!cid || !date) return;
            if(!state.attendance[cid] || !state.attendance[cid][date]) return;

            window.showCustomConfirm("ยืนยันการลบ", "คุณต้องการลบข้อมูลการเช็คชื่อของวันที่เลือกใช่หรือไม่?\n(สถานะของทุกคนในวันนี้จะถูกรีเซ็ต)", async () => {
                delete state.attendance[cid][date];
                await saveStateToDB();
                window.initCalendar();
                window.renderAttendanceList();
                showCustomAlert('สำเร็จ', 'ลบข้อมูลเช็คชื่อของวันนี้เรียบร้อยแล้ว');
            });
        };

        // Score Logic
        window.handleScoreCourseChange = () => {
            document.getElementById('score-week').value = ''; document.getElementById('score-title-input').value = ''; document.getElementById('score-max').value = '10';
            document.getElementById('score-title-input').classList.remove('hidden'); document.getElementById('score-title-select').classList.add('hidden');
            document.getElementById('score-area').classList.add('hidden');
            document.getElementById('score-placeholder').classList.remove('hidden');
        };

        window.isSchoolHubMobileView = window.isSchoolHubMobileView || (() => {
            return window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
        });

        window.withMobileScrollLock = window.withMobileScrollLock || ((fn) => {
            if (!window.isSchoolHubMobileView()) {
                return fn();
            }
            const scroller = document.querySelector('main > div.flex-1.overflow-y-auto') || document.scrollingElement || document.documentElement;
            const keepTop = scroller ? scroller.scrollTop : 0;
            const keepLeft = scroller ? scroller.scrollLeft : 0;
            const keepWindowY = window.pageYOffset || document.documentElement.scrollTop || 0;
            const result = fn();
            const restore = () => {
                if (scroller) {
                    scroller.scrollTop = keepTop;
                    scroller.scrollLeft = keepLeft;
                }
                window.scrollTo(0, keepWindowY);
            };
            restore();
            requestAnimationFrame(() => {
                restore();
                requestAnimationFrame(restore);
            });
            return result;
        });

        window.handleScoreWeekChange = () => window.withMobileScrollLock(() => {
            const cid = currentActiveCourseId; const week = document.getElementById('score-week').value;
            const inf = document.getElementById('score-title-input'), sel = document.getElementById('score-title-select'), mx = document.getElementById('score-max');

            sel.classList.remove('bg-indigo-50', 'text-primary', 'font-bold', 'border-indigo-300');

            if (!cid || !week) { inf.classList.remove('hidden'); sel.classList.add('hidden'); mx.removeAttribute('readonly'); document.getElementById('score-placeholder').classList.remove('hidden'); document.getElementById('score-area').classList.add('hidden'); return; }
            const plans = (state.coursePlans[cid] || []).filter(p => p.week === week);
            if (plans.length > 0) {
                inf.classList.add('hidden'); sel.classList.remove('hidden');
                const planOptionsHTML = '<option value="">-- เลือกงานตามแผน --</option>' + plans.map(p => `<option value="${p.title}" data-max="${p.maxScore}">${p.title}</option>`).join('') + '<option value="__custom__">+ เพิ่มงานใหม่ (นอกแผน)</option>';
                if (sel.dataset.schoolhubOptionsHtml !== planOptionsHTML) { sel.innerHTML = planOptionsHTML; sel.dataset.schoolhubOptionsHtml = planOptionsHTML; }

                sel.value = plans[0].title;
                window.handleScoreTitleSelection();
            } else {
                inf.classList.remove('hidden'); sel.classList.add('hidden'); inf.value = ''; mx.value = '10'; mx.removeAttribute('readonly'); document.getElementById('score-placeholder').classList.add('hidden'); renderScoreList();
            }
        });
        window.handleScoreTitleSelection = () => window.withMobileScrollLock(() => {
            const sel = document.getElementById('score-title-select'), inf = document.getElementById('score-title-input'), mx = document.getElementById('score-max');

            if (sel.value && sel.value !== '__custom__') {
                sel.classList.add('bg-indigo-50', 'text-primary', 'font-bold', 'border-indigo-300');
            } else {
                sel.classList.remove('bg-indigo-50', 'text-primary', 'font-bold', 'border-indigo-300');
            }

            if (sel.value === '__custom__') { sel.classList.add('hidden'); inf.classList.remove('hidden'); inf.value = ''; if (!window.isSchoolHubMobileView()) inf.focus(); mx.value = '10'; mx.removeAttribute('readonly'); document.getElementById('score-area').classList.add('hidden'); document.getElementById('score-placeholder').classList.remove('hidden');}
            else if (sel.value) { mx.value = sel.options[sel.selectedIndex].getAttribute('data-max'); mx.setAttribute('readonly', 'true'); document.getElementById('score-placeholder').classList.add('hidden'); renderScoreList(); }
            else { mx.value = ''; document.getElementById('score-area').classList.add('hidden'); document.getElementById('score-placeholder').classList.remove('hidden');}
        });
        window.updateMaxScores = () => { const max = parseFloat(document.getElementById('score-max').value) || 0; document.querySelectorAll('.score-input').forEach(inp => { inp.max = max; if(parseFloat(inp.value)>max) inp.value = max; }); };
        window.getScoreTitle = () => { const inf = document.getElementById('score-title-input'); return !inf.classList.contains('hidden') ? inf.value.trim() : document.getElementById('score-title-select').value; };

        window.formatSavedAtThai = (dateValue) => {
            if (!dateValue) return '';
            const d = new Date(dateValue);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleString('th-TH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        };

        window.updateScoreSavedStatus = (existing, week, title) => {
            const lastSavedEl = document.getElementById('score-last-saved');
            const deleteBtn = document.getElementById('btn-delete-scores');
            const workLabel = document.getElementById('score-current-work-label');
            if (workLabel) workLabel.textContent = week && title ? `สัปดาห์ที่ ${week} : ${title}` : '';
            if (!lastSavedEl || !deleteBtn) return;

            if (existing) {
                const savedText = window.formatSavedAtThai(existing.savedAt || existing.updatedAt || existing.createdAt);
                lastSavedEl.textContent = savedText ? `บันทึกล่าสุด: ${savedText}` : 'มีข้อมูลคะแนนที่เคยบันทึกไว้';
                lastSavedEl.className = 'text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 shadow-sm text-emerald-700';
                deleteBtn.classList.remove('hidden');
            } else {
                lastSavedEl.textContent = 'ยังไม่เคยบันทึกคะแนน';
                lastSavedEl.className = 'text-xs font-semibold px-3 py-1.5 rounded-full bg-white border shadow-sm text-slate-500';
                deleteBtn.classList.add('hidden');
            }
        };

        window.renderScoreList = () => window.withMobileScrollLock(() => {
            const cid = currentActiveCourseId; const week = document.getElementById('score-week').value; const title = window.getScoreTitle(); const area = document.getElementById('score-area'); const tbody = document.getElementById('score-list'); const max = document.getElementById('score-max').value;
            window.ensureCourseRoomActionFilter('score-area', cid);
            const courseStudents = window.getCourseStudents(cid); if(!cid || !week || (!title || title === '__custom__')) { area.classList.add('hidden'); window.updateScoreSavedStatus(null, week, title); return; }
            if(courseStudents.length===0) { area.classList.remove('hidden'); document.getElementById('score-placeholder').classList.add('hidden'); tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400 font-semibold">ยังไม่ได้เลือกห้องนักเรียนสำหรับรายวิชานี้ หรือไม่มีนักเรียนในห้องที่เลือก</td></tr>'; window.updateScoreSavedStatus(null, week, title); return; }
            area.classList.remove('hidden'); document.getElementById('score-placeholder').classList.add('hidden'); tbody.innerHTML = '';
            const existing = state.scores.find(s => s.courseId === cid && s.week === week && s.title === title); const saved = existing ? existing.records : {};
            window.updateScoreSavedStatus(existing, week, title);
            const maxScoreNum = parseFloat(max);

            const isMobileCardView = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
            courseStudents.forEach((s, index) => {
                const studentOrder = index + 1;
                const isWithdrawn = (typeof window.isWithdrawnStudent === 'function') ? window.isWithdrawnStudent(s) : window.isStudentWithdrawn(s);
                const sc = (!isWithdrawn && saved[s.id] !== undefined && saved[s.id] !== null) ? saved[s.id] : '';
                let inputHtml = '';
                if (isWithdrawn) {
                    inputHtml = window.renderWithdrawnScoreCell ? window.renderWithdrawnScoreCell() : '<span class="withdrawn-score-cell">ลาออก</span>';
                } else if (maxScoreNum === 0) {
                    const isChecked = (sc === 1 || sc === '1' || sc === true) ? 'checked' : '';
                    inputHtml = `<input type="checkbox" class="score-checkbox w-6 h-6 text-primary rounded focus:ring-primary cursor-pointer mx-auto block shadow-sm" ${isChecked} data-studentid="${s.id}">`;
                } else {
                    // เอา placeholder="0" ออก ให้แสดงว่างเปล่า และกัน null/undefined หลุดเข้าช่องกรอก
                    inputHtml = `<input type="number" inputmode="decimal" pattern="[0-9]*" min="0" max="${max}" placeholder="" value="${escapeHTML(window.safeText ? window.safeText(sc) : (sc ?? ''))}" class="score-input w-24 bg-white border border-slate-200 rounded-lg p-2.5 text-center font-bold text-primary focus:ring-2 focus:ring-primary focus:outline-none mx-auto block shadow-sm" data-studentid="${s.id}" oninput="if(parseFloat(this.value)>${max}) this.value=${max};" onkeydown="if(event.key === 'Enter') { event.preventDefault(); const inputs = document.querySelectorAll('.score-input'); const i = Array.from(inputs).indexOf(this); if(i > -1 && i < inputs.length - 1) { inputs[i+1].focus(); inputs[i+1].scrollIntoView({block: 'center', behavior: 'smooth'}); } }">`;
                }
                if (isMobileCardView) {
                    const scoreLabel = maxScoreNum === 0 ? 'สถานะงาน' : `คะแนน / ${escapeHTML(max)}`;
                    tbody.innerHTML += `<tr class="schoolhub-mobile-row${window.getStudentWithdrawnRowClass(s)}"><td colspan="4" class="schoolhub-mobile-cell">
                        <div class="schoolhub-mobile-card">
                            <div class="schoolhub-mobile-card-head">
                                <div class="min-w-0">
                                    <div class="schoolhub-seq-text${window.getStudentWithdrawnClass(s)}">#${studentOrder}</div>
                                    <div class="schoolhub-mobile-card-title${window.getStudentWithdrawnClass(s)}">${escapeHTML(s.name||'')}${window.getStudentWithdrawnBadge(s)}</div>
                                    <div class="schoolhub-mobile-card-sub${window.getStudentWithdrawnClass(s)}">${escapeHTML(s.code||'')}</div>
                                </div>
                            </div>
                            <div class="schoolhub-mobile-score-box">
                                <div class="text-xs font-black text-slate-500 mb-2">${scoreLabel}</div>
                                <div class="flex items-center justify-center${window.isStudentWithdrawn(s)?' schoolhub-withdrawn-control':''}">${inputHtml}</div>
                            </div>
                        </div>
                    </td></tr>`;
                } else {
                    tbody.innerHTML += `<tr class="${window.getStudentWithdrawnRowClass(s)}"><td class="text-center"><span class="schoolhub-seq-text${window.getStudentWithdrawnClass(s)}">#${studentOrder}</span></td><td class="font-mono text-slate-400${window.getStudentWithdrawnClass(s)}">${s.code}</td><td class="font-bold text-slate-700${window.getStudentWithdrawnClass(s)}">${s.name}${window.getStudentWithdrawnBadge(s)}</td><td class="bg-indigo-50/50 text-center${window.isStudentWithdrawn(s)?' schoolhub-withdrawn-control':''}">${inputHtml}</td></tr>`;
                }
            });

            setTimeout(() => { if (!window.isSchoolHubMobileView()) area.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
        });
        window.saveScores = async () => {
            const cId = currentActiveCourseId; if(!schoolhubAssertCanEditCourse(cId, 'บันทึกคะแนน')) return; const week = document.getElementById('score-week').value; const title = window.getScoreTitle(); const maxScore = document.getElementById('score-max').value;
            if(!cId || !week || !title || maxScore === '') return showCustomAlert("ข้อมูลไม่ครบ", "ระบุงานและคะแนนเต็มให้ครบ", true);
            const existingScoreRow = state.scores.find(s => s.courseId === cId && s.week === week && s.title === title);
            const records = Object.assign({}, existingScoreRow && existingScoreRow.records ? existingScoreRow.records : {});
            const maxScoreNum = parseFloat(maxScore);

            if (maxScoreNum === 0) {
                document.querySelectorAll('.score-checkbox').forEach((cb) => {
                    if(cb.disabled) return;
                    records[cb.getAttribute('data-studentid')] = cb.checked ? 1 : 0;
                });
            } else {
                document.querySelectorAll('.score-input').forEach((inp, idx) => {
                    if(inp.disabled) return;
                    // หากไม่กรอก จะเก็บเป็น '' (ว่าง) ไม่ใช่ 0
                    records[inp.getAttribute('data-studentid') || window.getCourseStudents(cId)[idx].id] = inp.value !== '' ? parseFloat(inp.value) : '';
                });
            }

            const nowSavedAt = new Date().toISOString();
            const idx = state.scores.findIndex(s => s.courseId === cId && s.week === week && s.title === title);
            if (idx !== -1) { state.scores[idx].maxScore = maxScore; state.scores[idx].records = records; state.scores[idx].savedAt = nowSavedAt; } else { state.scores.push({ id: Date.now().toString(), courseId: cId, week: week, title: title, maxScore: maxScore, records: records, savedAt: nowSavedAt }); }

            // เพิ่มเฉพาะหน้าบันทึกคะแนน:
            // ถ้าเลือกสัปดาห์ที่ยังไม่มีแผน/พิมพ์ชื่องานเองแล้วกดบันทึก
            // ให้สร้างแผนคะแนนของสัปดาห์นั้นอัตโนมัติ เพื่อให้หน้าภาพรวมและรายการแผนเห็นงานนี้ทันที
            if (!state.coursePlans[cId]) state.coursePlans[cId] = [];
            const cleanTitle = String(title || '').trim();
            const hasSamePlan = state.coursePlans[cId].some(p => String(p.week) === String(week) && String(p.title || '').trim() === cleanTitle);
            if (cleanTitle && !hasSamePlan) {
                state.coursePlans[cId].push({
                    id: `auto_${Date.now()}`,
                    week: String(week),
                    title: cleanTitle,
                    maxScore: String(maxScore)
                });
            }

            await saveStateToDB();

            document.getElementById('score-week').value = '';
            window.handleScoreWeekChange();

            showCustomAlert('สำเร็จ', 'บันทึกคะแนนเรียบร้อยแล้ว\nระบบได้เคลียร์หน้าจอเพื่อพร้อมรับข้อมูลของงานใหม่ทันทีครับ');
        };

        window.deleteScores = async () => {
            const cId = currentActiveCourseId; if(!schoolhubAssertCanEditCourse(cId, 'ลบคะแนน')) return;
            const week = document.getElementById('score-week').value;
            const title = window.getScoreTitle();
            if(!cId || !week || !title || title === '__custom__') return showCustomAlert("ข้อมูลไม่ครบ", "กรุณาเลือกสัปดาห์และชื่องานที่ต้องการลบ", true);

            const idx = state.scores.findIndex(s => s.courseId === cId && s.week === week && s.title === title);
            if (idx === -1) return showCustomAlert("ไม่มีข้อมูลให้ลบ", "งานนี้ยังไม่เคยบันทึกคะแนนไว้", true);

            showCustomConfirm("ยืนยันการลบคะแนน", `ต้องการลบคะแนนของ\nสัปดาห์ที่ ${week} : ${title}\nใช่หรือไม่?\n\nเมื่อลบแล้ว ระบบจะกลับไปเหมือนไม่เคยตั้ง/บันทึกคะแนนนี้ไว้`, async () => {
                state.scores.splice(idx, 1);
                await saveStateToDB();
                window.renderScoreList();
                renderCourseSummary();
                showCustomAlert("ลบเรียบร้อย", "ลบคะแนนนี้แล้ว ระบบกลับไปเหมือนไม่เคยบันทึกคะแนนนี้ไว้");
            });
        };

        // Export Logics
        window.downloadExcelMultiSheet = (sheetsDataObj, fileName) => {
            try { if (typeof window.toggleLoader === 'function') window.toggleLoader(true); } catch(e){}
            try {
            const wb = XLSX.utils.book_new();
            for (const sheetName in sheetsDataObj) {
                const data = sheetsDataObj[sheetName];
                const ws = Array.isArray(data[0]) ? XLSX.utils.aoa_to_sheet(data) : XLSX.utils.json_to_sheet(data);

                const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
                // หาแถวหัวตาราง (แถวแรกที่มีข้อความหลายช่อง) เพื่อทำสีหัวตารางให้สวยงาม
                let headerRowIdx = -1;
                for (let R = 0; R <= range.e.r; R++) {
                    let filled = 0;
                    for (let C = 0; C <= range.e.c; C++) { if (ws[XLSX.utils.encode_cell({r:R,c:C})]) filled++; }
                    if (filled >= Math.max(2, Math.floor((range.e.c+1) * 0.5))) { headerRowIdx = R; break; }
                }
                let noteColIdx = -1;
                if (headerRowIdx >= 0) {
                    for (let Cn = 0; Cn <= range.e.c; Cn++) {
                        const hCell = ws[XLSX.utils.encode_cell({r:headerRowIdx,c:Cn})];
                        if (hCell && String(hCell.v||'').trim() === 'หมายเหตุ') { noteColIdx = Cn; break; }
                    }
                }
                for(let R=0; R<=range.e.r; R++){
                    for(let C=0; C<=range.e.c; C++){
                        const ref = XLSX.utils.encode_cell({r:R,c:C});
                        const cell = ws[ref];
                        if(!cell) continue;
                        const v = String(cell.v == null ? '' : cell.v).trim();

                        if (R === headerRowIdx) {
                            cell.s = { fill:{patternType:'solid',fgColor:{rgb:'4F46E5'}}, font:{bold:true,color:{rgb:'FFFFFF'},sz:7}, alignment:{horizontal:'center',vertical:'center',wrapText:true}, border:{bottom:{style:'thin',color:{rgb:'C7D2FE'}}} };
                            continue;
                        }

                        let fill = null, fontColor = null, bold = false;
                        if(v === 'ส่งแล้ว' || v === 'มา'){ fill='DCFCE7'; fontColor='166534'; }
                        else if(v === 'สาย'){ fill='FEF9C3'; fontColor='854D0E'; }
                        else if(v === 'ขาด'){ fill='FEE2E2'; fontColor='991B1B'; }
                        else if(v === 'ลา'){ fill='EDE9FE'; fontColor='6D28D9'; }
                        else if(v.includes('ขาดส่ง') || v === 'ยังไม่ส่ง'){ fill='FECACA'; fontColor='991B1B'; }
                        else if(v === 'ลาออก'){ fill='F1F5F9'; fontColor='64748B'; }
                        else if(/^\+\d/.test(v) || /⭐/.test(v)){ fill='FEF3C7'; fontColor='92400E'; bold=true; }

                        const isLeftCol = C<=2 || C===noteColIdx;
                        cell.s = Object.assign(
                            { alignment:{horizontal: (isLeftCol ? 'left':'center'), vertical:'center'}, border:{bottom:{style:'hair',color:{rgb:'E2E8F0'}}} },
                            fill ? { fill:{patternType:'solid',fgColor:{rgb:fill}}, font:{color:{rgb:fontColor},bold:bold} } : (R % 2 === 0 ? { fill:{patternType:'solid',fgColor:{rgb:'F8FAFC'}} } : {})
                        );
                    }
                }
                ws['!cols'] = Array.from({length: range.e.c+1}, (_,C) => {
                    let maxLen = 4;
                    for(let R=0; R<=range.e.r; R++){
                        if(R <= headerRowIdx) continue; // ไม่นับแถวหัวตาราง และแถวชื่อวิชา/ห้อง (เหนือหัวตาราง)
                        const cell = ws[XLSX.utils.encode_cell({r:R,c:C})];
                        if(cell && cell.v != null){ String(cell.v).split('\n').forEach(line => { maxLen = Math.max(maxLen, line.length); }); }
                    }
                    return { wch: Math.min(maxLen + 2, 40) };
                });
                if (headerRowIdx >= 0) ws['!freeze'] = { xSplit: 0, ySplit: headerRowIdx + 1 };

                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            }
            XLSX.writeFile(wb, fileName + '.xlsx');
            } finally {
                try { if (typeof window.toggleLoader === 'function') window.toggleLoader(false); } catch(e){}
            }
        };
        window.exportStudentsToExcel = () => {
            if(state.students.length===0) return showCustomAlert("ผิดพลาด", "ไม่มีข้อมูล", true);
            window.downloadExcelMultiSheet({"รายชื่อนักเรียน": state.students.map(s => ({"รหัส":s.code,"ชื่อ":s.name,"ชั้น":s.grade}))}, "รายชื่อนักเรียนส่วนกลาง");
        };
        window.exportScoresToExcel = () => {
            const cid = currentActiveCourseId;
            const courseStudents = window.getCourseStudents(cid); if(!cid || courseStudents.length===0) return showCustomAlert("ผิดพลาด", "ไม่มีข้อมูลนักเรียนในวิชานี้", true);
            const course = state.courses.find(c=>c.id===cid) || {id: cid};
            const cName = course.name || 'Unknown';
            const history = state.attendance[cid] || {}; const attDates = Object.keys(history);
            const plans = (state.coursePlans[cid] || []).sort((a,b) => a.week - b.week);
            const courseScores = state.scores.filter(s => s.courseId === cid);
            const gradeCriteria = (state.courseGrades && state.courseGrades[cid]) ? state.courseGrades[cid] : defaultGradeCriteria;

            const aoa = [[`สรุปภาพรวมวิชา: ${cName}`], []];
            const headerRow = ["รหัส", "ชื่อ", "ชั้น", "มา", "สาย", "ขาด"];
            let tMax = 0; plans.forEach(p => {
                const isChecklist = Number(p.maxScore) === 0;
                headerRow.push(`${p.title}(${isChecklist ? 'เช็คงาน' : 'เต็ม '+window.formatScoreDisplay(p.maxScore,2)})`);
                if(!isChecklist) tMax = window.addScoreToTotal(tMax, p.maxScore, 2);
            });
            headerRow.push(`รวมคะแนน(เต็ม ${window.formatScoreDisplay(tMax, 2)})`);
            headerRow.push(`เกรดที่ได้`);
            aoa.push(headerRow);

            courseStudents.forEach(s => {
                let pr=0, la=0, ab=0; attDates.forEach(d => { const st = history[d].records[s.id]; if(st==='present') pr++; else if(st==='late') la++; else if(st==='absent') ab++; });
                const row = [s.code, s.name, s.grade, pr, la, ab];
                let totalScore = 0;
                plans.forEach(p => {
                    const task = courseScores.find(ts => ts.week === p.week && ts.title === p.title);
                    const isChecklist = Number(p.maxScore) === 0;

                    if (isChecklist) {
                        const status = (task && task.records[s.id] === 1) ? 'ส่งแล้ว' : ((task && task.records[s.id] === 0) ? 'ยังไม่ส่ง' : '-');
                        row.push(status);
                    } else {
                        const rawScore = task && task.records[s.id] !== undefined ? task.records[s.id] : null;
                        totalScore = window.addScoreToTotal(totalScore, rawScore, 2);

                        // ปรับตอนออก Excel: ถ้ายังไม่เคยบันทึก = -, ถ้าบันทึกแล้วแต่เว้นว่าง = ขาดส่ง (-)
                        if (!task) row.push('-');
                        else if ((window.isMissingScoreValue ? window.isMissingScoreValue(rawScore) : rawScore==='')) row.push('ขาดส่ง');
                        else row.push(window.normalizeScoreNumber(rawScore, 2));
                    }
                });
                row.push(window.normalizeScoreNumber(totalScore, 2));

                let gradeDisplay = '-';
                if(tMax > 0) {
                    if (gradeCriteria) course.gradeCriteria = gradeCriteria;
                    gradeDisplay = window.getFinalGradeForStudent(course, s, window.normalizeScoreNumber(totalScore, 2));
                }
                row.push(gradeDisplay || '-');

                aoa.push(row);
            });
            window.downloadExcelMultiSheet({ "สรุปภาพรวม": aoa }, `ภาพรวม_${cName}`);
        };

        // --- Subscription Plan Requests ---
        window.loadPlanRequests = async () => {
            const tbody=document.getElementById('admin-plan-request-list');
            if(tbody) tbody.innerHTML='<tr><td colspan="4" class="text-center p-8 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลดคำขอสมัครแผน...</td></tr>';
            try{
                const qs=await withTimeout(getDocs(collection(db,'subscription_requests')),8000,'loadPlanRequests');
                const items=[];
                qs.forEach(d=>items.push({docId:d.id,...(d.data()||{})}));
                items.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
                adminPlanRequests = items;
                const pendingCount=items.filter(x=>x.status==='pending').length;
                const badge=document.getElementById('admin-plan-request-badge');
                if(badge){badge.textContent=pendingCount;badge.classList.toggle('hidden',pendingCount===0);}
                const summary=document.getElementById('admin-plan-request-summary');
                const summaryCount=document.getElementById('admin-plan-request-summary-count');
                if(summaryCount) summaryCount.textContent=pendingCount;
                if(summary) summary.classList.toggle('hidden',pendingCount===0);
                if(tbody){
                    tbody.innerHTML=items.length?items.map(r=>{
                        const isPending=r.status==='pending';
                        const statusBadge=r.status==='approved'?(r.autoApproved?'<span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">อนุมัติอัตโนมัติ</span>':'<span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">อนุมัติแล้ว</span>'):(r.status==='rejected'?'<span class="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold">ไม่อนุมัติ</span>':'<span class="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">รอตรวจสอบ</span>');
                        const when=r.createdAt?new Date(r.createdAt).toLocaleString('th-TH'):'';
                        const actions=isPending?`<button onclick="approvePlanRequest('${r.docId}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-sm font-bold"><i class="fas fa-check"></i> อนุมัติ</button><button onclick="rejectPlanRequest('${r.docId}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 px-3 py-2 rounded-xl text-sm font-bold ml-2"><i class="fas fa-times"></i> ไม่อนุมัติ</button>`:'<span class="text-xs text-slate-400">ดำเนินการแล้ว</span>';
                        return `<tr><td class="font-bold text-slate-700">${escapeHTML(r.name||'ไม่มีชื่อ')}<br><span class="text-xs font-normal text-slate-400 font-mono">${escapeHTML(r.email||r.userKey||'')}</span><br><span class="text-[11px] text-slate-400">${escapeHTML(when)}</span></td><td><div class="font-bold text-primary">${escapeHTML(r.planName||'-')}</div><div class="text-xs text-slate-500">${escapeHTML(r.planPrice||'')}</div><div class="text-[11px] text-slate-400 mt-1 font-mono">Ref: ${escapeHTML(r.paymentReference||r.slipReference||'-')}</div></td><td class="text-center">${statusBadge}</td><td class="text-right whitespace-nowrap">${actions}</td></tr>`;
                    }).join(''):'<tr><td colspan="4" class="text-center p-8 text-slate-400">ยังไม่มีคำขอสมัครแผน</td></tr>';
                }
                return items;
            }catch(e){
                adminPlanRequests = [];
                const badge=document.getElementById('admin-plan-request-badge');
                if(badge) badge.classList.add('hidden');
                const summary=document.getElementById('admin-plan-request-summary');
                if(summary) summary.classList.add('hidden');
                if(tbody) tbody.innerHTML=`<tr><td colspan="4" class="text-center p-8 text-rose-500">โหลดคำขอไม่ได้<br><span class="text-xs text-slate-500">${escapeHTML(getFirebaseErrorText(e))}</span></td></tr>`;
                return [];
            }
        };

        function getRequestsForUser(u, uid){
            const email=String(u.email||'').toLowerCase();
            const userKey=String(u.userKey||'').toLowerCase();
            const id=String(uid||u.uid||'').toLowerCase();
            return (adminPlanRequests||[]).filter(r=>{
                const rUid=String(r.uid||'').toLowerCase();
                const rEmail=String(r.email||'').toLowerCase();
                const rKey=String(r.userKey||'').toLowerCase();
                return (id && rUid && rUid===id) || (email && rEmail && rEmail===email) || (userKey && rKey && rKey===userKey);
            }).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
        }

        window.closePlanRequestPopup = () => {
            const modal=document.getElementById('admin-plan-request-popup');
            if(modal) modal.classList.add('hidden');
        };

        window.openPlanRequestPopup = (uid) => {
            const modal=document.getElementById('admin-plan-request-popup');
            const body=document.getElementById('admin-plan-request-popup-body');
            const userBox=document.getElementById('admin-plan-request-popup-user');
            if(!modal||!body)return;
            const user=(window.__adminUsersByUid||{})[uid]||{};
            const reqs=getRequestsForUser(user, uid);
            if(userBox) userBox.textContent = `${user.name||'ไม่มีชื่อ'} • ${user.email||user.userKey||uid}`;
            if(!reqs.length){
                body.innerHTML='<div class="text-center py-10 text-slate-400"><i class="fas fa-inbox text-4xl mb-3 text-slate-300"></i><p class="font-semibold">ผู้ใช้นี้ยังไม่มีคำขอสมัครแผน</p></div>';
            }else{
                body.innerHTML=reqs.map(r=>{
                    const isPending=r.status==='pending';
                    const statusBadge=r.status==='approved'?'<span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">อนุมัติแล้ว</span>':(r.status==='rejected'?'<span class="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold">ไม่อนุมัติ</span>':'<span class="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">รอตรวจสอบ</span>');
                    const when=r.createdAt?new Date(r.createdAt).toLocaleString('th-TH'):'-';
                    const paidAt=r.paymentTime||r.paidAt||r.paymentDate||'-';
                    const startAt=r.status==='approved'&&r.approvedAt?new Date(r.approvedAt).toLocaleString('th-TH'):null;
                    const slip=r.slipDataUrl||r.paymentProofDataUrl||r.slipUrl||r.proofUrl||'';
                    const slipHTML=slip?`<div class="mt-3"><p class="text-xs text-slate-400 font-bold mb-1">สลิปการโอนเงิน</p><img src="${escapeHTML(slip)}" class="max-h-72 rounded-2xl border border-slate-200 object-contain bg-slate-50 mx-auto" alt="หลักฐานการชำระเงิน"></div>`:'<div class="mt-3 text-xs text-slate-400 bg-slate-50 border border-dashed rounded-2xl p-4 text-center">ไม่มีรูปหลักฐานในรายการนี้</div>';
                    const actions=isPending?`<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4"><button onclick="approvePlanRequest('${r.docId}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-2xl text-sm font-bold"><i class="fas fa-check"></i> อนุมัติแผนนี้</button><button onclick="rejectPlanRequest('${r.docId}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 px-4 py-3 rounded-2xl text-sm font-bold"><i class="fas fa-times"></i> ไม่อนุมัติ</button></div>`:'<div class="mt-4 text-xs text-slate-400 text-center">รายการนี้ดำเนินการแล้ว</div>';
                    return `<div class="border border-slate-200 rounded-[1.5rem] p-5 bg-white shadow-sm"><div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3"><div><div class="text-xl font-black text-primary">${escapeHTML(r.planName||'-')}</div><div class="text-sm font-bold text-slate-500">${escapeHTML(r.planPrice||'')}</div></div>${statusBadge}</div><div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm"><div class="bg-slate-50 rounded-2xl p-3"><div class="text-xs text-slate-400 font-bold">ชื่อผู้ชำระ</div><div class="font-bold text-slate-700">${escapeHTML(r.payerName||r.name||'-')}</div></div><div class="bg-slate-50 rounded-2xl p-3"><div class="text-xs text-slate-400 font-bold">เวลาที่ชำระเงิน</div><div class="font-bold text-slate-700">${escapeHTML(paidAt)}</div></div><div class="bg-slate-50 rounded-2xl p-3"><div class="text-xs text-slate-400 font-bold">เวลาส่งรายการ</div><div class="font-bold text-slate-700">${escapeHTML(when)}</div></div>${startAt?`<div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-3"><div class="text-xs text-emerald-500 font-bold">⏱ รอบเริ่มนับตั้งแต่</div><div class="font-bold text-emerald-700">${escapeHTML(startAt)}</div></div>`:''}</div>${slipHTML}${actions}</div>`;
                }).join('');
            }
            modal.classList.remove('hidden');
        };

        window.approvePlanRequest=async(id)=>{
            const snap=await getDoc(getPlanRequestDocRef(id));
            if(!snap.exists())return showCustomAlert('ไม่พบคำขอ','คำขอนี้อาจถูกลบไปแล้ว',true);
            const r=snap.data();
            window.showCustomConfirm('อนุมัติแผน',`อนุมัติให้ ${r.name||r.email} ใช้แผน ${r.planName} หรือไม่?\n\n⏱ รอบการใช้งานจะเริ่มนับตั้งแต่วันนี้ทันที`,async()=>{
                toggleLoader(true);
                const now=Date.now();
                try{
                    await setDoc(getPlanRequestDocRef(id),{status:'approved',approvedAt:now,approvedBy:currentUser?.email||'admin',updatedAt:now},{merge:true});
                    await setDoc(doc(db,getPublicPath(),normalizeSchoolHubEmail(r.email||r.userKey)),{
                        uid:r.uid,email:r.email||'',userKey:normalizeSchoolHubEmail(r.email||r.userKey),
                        name:r.name||r.email||'',role:'user',status:'active',
                        planId:r.planId,planName:r.planName,planPrice:r.planPrice,
                        planApprovedAt:now,
                        planStartAt:now,          // ← รอบเริ่มนับจากวันอนุมัติ
                        requestedPlanId:null,requestedPlanName:null
                    },{merge:true});
                    await setDoc(doc(db,'users_status',normalizeSchoolHubEmail(r.email||r.userKey)),{
                        status:'active',planId:r.planId,planName:r.planName,planPrice:r.planPrice,
                        planApprovedAt:now,planStartAt:now,deletedAt:null
                    },{merge:true});
                    sendMailViaWebApp({
                        to: r.email || r.userKey,
                        name: r.name || '',
                        type: 'plan_approved',
                        subject: `อนุมัติแผน ${r.planName || ''} แล้ว`,
                        message: `สวัสดี ${r.name || r.email || ''}\n\nคำขอสมัครแผน ${r.planName || ''} ได้รับการอนุมัติแล้ว\nรอบการใช้งานเริ่มนับตั้งแต่วันนี้\n\nขอบคุณที่ใช้ SchoolHub`,
                        extra: { planName: r.planName || '', planPrice: r.planPrice || '', requestId: id }
                    });
                    await loadPlanRequests();await loadAdminData();window.closePlanRequestPopup();
                    showCustomAlert('อนุมัติแล้ว',`เปลี่ยนสิทธิ์ผู้ใช้เป็นแผน ${r.planName} แล้ว\n⏱ รอบการใช้งานเริ่มต้นวันนี้`);
                }catch(e){showCustomAlert('อนุมัติไม่ได้',getFirebaseErrorText(e),true);}
                toggleLoader(false);
            });
        };
        window.rejectPlanRequest=async(id)=>{
            const snap=await getDoc(getPlanRequestDocRef(id));
            const r=snap.exists()?snap.data():{};
            window.showCustomConfirm('ไม่อนุมัติคำขอ','ต้องการปฏิเสธคำขอนี้หรือไม่?',async()=>{
                toggleLoader(true);
                try{
                    await setDoc(getPlanRequestDocRef(id),{status:'rejected',rejectedAt:Date.now(),rejectedBy:currentUser?.email||'admin',updatedAt:Date.now()},{merge:true});
                    if(r.uid) await setDoc(doc(db,getPublicPath(),normalizeSchoolHubEmail(r.email||r.userKey)),{status:'active',requestedPlanId:null,requestedPlanName:null},{merge:true});
                    sendMailViaWebApp({
                        to: r.email || r.userKey,
                        name: r.name || '',
                        type: 'plan_rejected',
                        subject: `คำขอสมัครแผน ${r.planName || ''} ไม่ผ่านการอนุมัติ`,
                        message: `สวัสดี ${r.name || r.email || ''}\n\nคำขอสมัครแผน ${r.planName || ''} ยังไม่ผ่านการอนุมัติ กรุณาตรวจสอบข้อมูลการชำระเงินหรือส่งหลักฐานใหม่อีกครั้ง`,
                        extra: { planName: r.planName || '', planPrice: r.planPrice || '', requestId: id }
                    });
                    await loadPlanRequests();await loadAdminData();window.closePlanRequestPopup();
                }catch(e){showCustomAlert('บันทึกไม่ได้',getFirebaseErrorText(e),true);}
                toggleLoader(false);
            });
        };



        /* --- Enhanced Subscription Plan Rules: single pending request, real plan settings, billing/locking --- */
        const PLAN_LOCK_CACHE_KEY = 'schoolhub_plan_lock_state';
        function normalizePlanId(value){ return String(value||'').trim(); }
        function moneyText(amount){ const n=Number(amount||0); return n>0 ? `${n.toLocaleString('th-TH')} บาท` : '0 บาท'; }
        function addMonths(ts,n){ const d=new Date(ts||Date.now()); d.setMonth(d.getMonth()+Number(n||1)); return d.getTime(); }
        function addYears(ts,n){ const d=new Date(ts||Date.now()); d.setFullYear(d.getFullYear()+Number(n||1)); return d.getTime(); }
        function getPlanById(planId){ return (subscriptionPlans||getDefaultPlans()).find(p=>normalizePlanId(p.id)===normalizePlanId(planId)); }
        function planDisplayPrice(p){
            if(!p) return '-';
            if(p.freeForever || p.billingCycle==='forever') return 'ฟรีตลอด';
            const monthly=Number(p.monthlyPrice||0), yearly=Number(p.yearlyPrice||0);
            if(p.freeFirstMonth && monthly>0) return `ฟรีเดือนแรก / ต่อไป ${moneyText(monthly)} ต่อเดือน`;
            if(monthly>0 && yearly>0) return `${moneyText(monthly)}/เดือน หรือ ${moneyText(yearly)}/ปี`;
            if(yearly>0 && p.billingCycle==='yearly') return `${moneyText(yearly)}/ปี`;
            if(monthly>0) return `${moneyText(monthly)}/เดือน`;
            return p.price || '0 บาท';
        }
        function getSelectedPlanCycle(plan){
            const sel=document.getElementById('payment-billing-cycle');
            return sel && sel.value ? sel.value : (plan?.billingCycle || 'monthly');
        }
        function getPlanChargeAmount(plan, cycle){
            if(!plan) return 0;
            if(plan.freeForever || plan.billingCycle==='forever') return 0;
            const c=cycle||plan.billingCycle||'monthly';
            if(c==='yearly') return Number(plan.yearlyPrice||extractPlanAmount(plan.price)||0);
            if(plan.freeFirstMonth && !window.__currentUserDir?.planId) return 0;
            return Number(plan.monthlyPrice||extractPlanAmount(plan.price)||0);
        }
        function getPlanNextBillingAt(plan, startAt, cycle){
            if(!plan || plan.freeForever || plan.billingCycle==='forever') return null;
            const c=cycle||plan.billingCycle||'monthly';
            return c==='yearly' ? addYears(startAt,1) : addMonths(startAt,1);
        }
        function getCurrentCourseLimit(){
            const dir=window.__currentUserDir||{};
            const plan=getPlanById(dir.planId);
            const limit=Number((plan&&plan.courseLimit)!=null?plan.courseLimit:dir.courseLimit||0);
            return limit; // 0 = unlimited
        }
        function getCurrentCourseLimitText(){ const l=getCurrentCourseLimit(); return l===0?'ไม่จำกัด':`${l} วิชา`; }
        function canCreateMoreCourses(){ const l=getCurrentCourseLimit(); return l===0 || state.courses.length < l; }
        async function hasPendingPlanRequestForCurrentUser(){
            if(!currentUser || currentUser.uid==='admin-bypass') return false;
            const dir=window.__currentUserDir||{};
            if(dir.requestedPlanId || dir.requestedPlanName || dir.status==='pending_plan') return true;
            try{
                const qs=await withTimeout(getDocs(collection(db,'subscription_requests')),8000,'checkPendingPlan');
                let found=false;
                qs.forEach(d=>{const r=d.data()||{}; if(r.status==='pending' && (r.uid===currentUser.uid || String(r.email||'').toLowerCase()===String(currentUser.email||'').toLowerCase())) found=true;});
                return found;
            }catch(e){ return !!(dir.requestedPlanId || dir.status==='pending_plan'); }
        }
        async function refreshCurrentUserPlanLock(){
            if(!currentUser || currentUser.uid==='admin-bypass' || isAdmin) return false;
            const userKey = getUserKey(currentUser);
            try{
                const snap=await withTimeout(getDoc(doc(db,getPublicPath(),getUserKey(currentUser))),6000,'refreshPlanLock');
                if(snap.exists()) window.__currentUserDir=snap.data()||{};
            }catch(e){}
            const dir=window.__currentUserDir||{};
            const now=Date.now();
            let locked=false, reason='';
            if(!dir.planId && !dir.requestedPlanId && !(dir.teamStatus==='accepted' || dir.teamOwnerUid)){ locked=true; reason='ยังไม่ได้เลือกแผน กรุณาเลือกแผนก่อนเริ่มใช้งาน'; }
            else if((dir.status==='pending_plan' || dir.requestedPlanId) && !dir.planId){ locked=true; reason='คำขอแผนของคุณอยู่ระหว่างรอแอดมินอนุมัติ'; }
            else if(dir.planNextBillingAt && Number(dir.planNextBillingAt) <= now){ locked=true; reason='ถึงรอบเรียกเก็บเงินแล้ว หากยังไม่ชำระ ระบบจะล็อกการแก้ไข ใช้ดูข้อมูลได้เท่านั้น'; }
            window.__schoolhubPlanLocked=locked;
            window.__schoolhubPlanLockReason=reason;
            localStorage.setItem(PLAN_LOCK_CACHE_KEY,JSON.stringify({locked,reason,checkedAt:now}));
            if(locked){
                try{ await setDoc(doc(db,getPublicPath(),userKey),{status:dir.status==='pending_plan'?'pending_plan':'plan_locked',planLockedAt:now,planLockReason:reason},{merge:true}); }catch(e){}
                /* ไม่เด้งเตือนเลือกแผนทันที: บังคับเฉพาะตอนกดใช้งานจริง */
            }
            return locked;
        }
        function applyPlanToUserPayload(plan, startAt, cycle, extra){
            const amount=getPlanChargeAmount(plan, cycle);
            const next=getPlanNextBillingAt(plan,startAt,cycle);
            return Object.assign({
                status:'active', planId:plan.id, planName:plan.name||'', planPrice:planDisplayPrice(plan),
                planAmount:amount, planBillingCycle:cycle||plan.billingCycle||'monthly', courseLimit:Number(plan.courseLimit||0),
                planApprovedAt:startAt, planStartAt:startAt, planNextBillingAt:next, planExpiresAt:next,
                requestedPlanId:null, requestedPlanName:null, requestedPlanAt:null, planLockedAt:null, planLockReason:null
            }, extra||{});
        }
        function formatNextBilling(dir){
            if(!dir) return '';
            if(!dir.planNextBillingAt) return 'ไม่มีรอบเรียกเก็บเงิน';
            return new Date(Number(dir.planNextBillingAt)).toLocaleString('th-TH');
        }
        getDefaultPlans = function(){
            const now=Date.now();
            return [
                {id:'standard',name:'มาตรฐาน',monthlyPrice:99,yearlyPrice:990,price:'ฟรีเดือนแรก / ต่อไป 99 บาทต่อเดือน',billingCycle:'monthly',freeFirstMonth:true,courseLimit:3,promptpay:'',desc:'เหมาะสำหรับเริ่มใช้งาน ฟรีเดือนแรก เดือนถัดไปชำระตามราคาที่ตั้ง',features:['เพิ่มรายวิชาได้ 3 วิชา','เช็คชื่อและบันทึกคะแนน','ดูภาพรวมและแชร์ผลคะแนน'],order:1,featured:true,active:true,updatedAt:now},
                {id:'pro',name:'มืออาชีพ',monthlyPrice:199,yearlyPrice:1990,price:'199 บาทต่อเดือน / 1,990 บาทต่อปี',billingCycle:'monthly',freeFirstMonth:false,courseLimit:10,promptpay:'',desc:'เหมาะสำหรับครูที่ใช้หลายรายวิชาและต้องการความยืดหยุ่น',features:['เพิ่มรายวิชาได้ 10 วิชา','ส่งออก Excel','จัดการนักเรียนและแผนคะแนนได้มากขึ้น'],order:2,featured:false,active:true,updatedAt:now},
                {id:'unlimited',name:'ฟรีตลอด',monthlyPrice:0,yearlyPrice:0,price:'ฟรีตลอด',billingCycle:'forever',freeForever:true,courseLimit:1,promptpay:'',desc:'ใช้ได้ตลอดโดยไม่หมดอายุ เหมาะสำหรับทดลองระยะยาว',features:['เพิ่มรายวิชาได้ 1 วิชา','ใช้งานพื้นฐานได้ตลอด','ไม่มีรอบเรียกเก็บ'],order:3,featured:false,active:true,updatedAt:now},
                {id:'school',name:'สถานศึกษา',monthlyPrice:499,yearlyPrice:4990,price:'499 บาทต่อเดือน / 4,990 บาทต่อปี',billingCycle:'monthly',courseLimit:0,promptpay:'',desc:'เหมาะสำหรับใช้ทั้งแผนก เพิ่มผู้ใช้และรายวิชาได้มาก',features:['เพิ่มรายวิชาไม่จำกัด','เหมาะกับทีม/แผนก','ตั้งค่าสิทธิ์และประกาศครบ'],allowTeam:true,teamMemberLimit:20,order:4,featured:false,active:false,updatedAt:now}
            ];
        };
        const __oldRenderLandingPlans = renderLandingPlans;
        renderLandingPlans = function(){
            const box=document.getElementById('landing-plan-list'); if(!box)return;
            const items=(subscriptionPlans||getDefaultPlans()).filter(p=>p.active!==false).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
            box.innerHTML=items.map(p=>`<div class="pricing-card ${p.featured?'featured':''} rounded-[2rem] p-6 relative overflow-hidden">${p.featured?'<div class="absolute top-4 right-4 bg-primary text-white text-xs font-black px-3 py-1 rounded-full">แนะนำ</div>':''}<h3 class="text-2xl font-black text-slate-900 mb-1">${escapeHTML(p.name||'')}</h3><p class="text-sm text-slate-500 min-h-[42px]">${escapeHTML(p.desc||'')}</p><div class="my-5"><span class="text-3xl font-black text-primary">${escapeHTML(planDisplayPrice(p))}</span></div><div class="mb-4 text-xs font-bold text-slate-500 bg-slate-50 rounded-2xl p-3"><i class="fas fa-book mr-1 text-primary"></i> เพิ่มรายวิชาได้ ${Number(p.courseLimit||0)===0?'ไม่จำกัด':Number(p.courseLimit||0)+' วิชา'}<br><i class="fas fa-calendar-check mr-1 text-primary"></i> ${p.freeForever||p.billingCycle==='forever'?'ไม่มีวันหมดอายุ':'มีรอบเรียกเก็บ/ต่ออายุ'}</div><ul class="space-y-3 mb-6">${(p.features||[]).map(f=>`<li class="flex gap-2 text-sm text-slate-600"><i class="fas fa-check text-emerald-500 mt-1"></i><span>${escapeHTML(f)}</span></li>`).join('')}</ul><button onclick="requestSubscriptionPlan('${p.id}')" class="w-full ${p.featured?'bg-primary text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200':'bg-slate-100 text-slate-700 hover:bg-slate-200'} rounded-2xl py-3 font-bold transition"><i class="fas fa-paper-plane mr-1"></i> สมัครแผนนี้</button></div>`).join('');
        };
        renderUserPlans = function(){
            const box=document.getElementById('user-plan-list'); if(!box)return;
            const items=(subscriptionPlans||getDefaultPlans()).filter(p=>p.active!==false).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
            const dirUser=window.__currentUserDir||{}; const currentPlanId=dirUser.planId||''; const pendingPlanName=dirUser.requestedPlanName||''; const hasPending=!!pendingPlanName || dirUser.status==='pending_plan';
            const currentBox=document.getElementById('user-current-plan-box');
            if(currentBox){
                const currentPlan = items.find(p => String(p.id || '') === String(currentPlanId || '')) || null;
                const planForCard = currentPlan || { name: pendingPlanName || dirUser.planName || 'ไม่มีแผน', price: hasPending ? 'คำขออยู่ระหว่างรอตรวจสอบ' : (dirUser.planPrice || ''), courseLimit: dirUser.courseLimit };
                currentBox.innerHTML = window.renderCurrentPlanCardHTML ? window.renderCurrentPlanCardHTML(planForCard, dirUser) : '';
            }
            box.innerHTML=items.map(p=>{ const active=p.id===currentPlanId&&!!currentPlanId; let btn=''; if(hasPending&&!active) btn=`<button onclick="showCustomAlert('มีคำขออยู่แล้ว','คุณมีคำขอสมัครแผนที่รอตรวจสอบอยู่ ไม่สามารถส่งซ้ำได้',true)" class="w-full bg-amber-100 text-amber-700 rounded-2xl py-3 font-bold cursor-not-allowed"><i class="fas fa-hourglass-half mr-1"></i> มีคำขอรออนุมัติอยู่แล้ว</button>`; else btn=`<button onclick="requestSubscriptionPlan('${p.id}')" class="w-full ${active?'bg-emerald-100 text-emerald-700':'bg-primary text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'} rounded-2xl py-3 font-bold transition"><i class="fas ${active?'fa-rotate':'fa-paper-plane'} mr-1"></i> ${active?'ต่ออายุ/เปลี่ยนรอบ':'เลือกแผนนี้'}</button>`; return `<div class="pricing-card ${p.featured?'featured':''} ${active?'ring-2 ring-emerald-400':''} rounded-[2rem] p-6 relative overflow-hidden bg-white">${p.featured?'<div class="absolute top-4 right-4 bg-primary text-white text-xs font-black px-3 py-1 rounded-full">แนะนำ</div>':''}${active?'<div class="absolute top-4 left-4 bg-emerald-500 text-white text-xs font-black px-3 py-1 rounded-full">ใช้อยู่</div>':''}<h3 class="text-2xl font-black text-slate-900 mb-1 mt-6">${escapeHTML(p.name||'')}</h3><p class="text-sm text-slate-500 min-h-[42px]">${escapeHTML(p.desc||'')}</p><div class="my-5"><span class="text-3xl font-black text-primary">${escapeHTML(planDisplayPrice(p))}</span></div><div class="mb-4 text-xs font-bold text-slate-500 bg-slate-50 rounded-2xl p-3">เพิ่มรายวิชาได้ ${Number(p.courseLimit||0)===0?'ไม่จำกัด':Number(p.courseLimit||0)+' วิชา'}<br>${p.freeForever||p.billingCycle==='forever'?'ฟรีตลอด ไม่มีรอบเก็บเงิน':'รอบถัดไปจะแจ้งหลังอนุมัติ'}</div><ul class="space-y-3 mb-6">${(p.features||[]).map(f=>`<li class="flex gap-2 text-sm text-slate-600"><i class="fas fa-check text-emerald-500 mt-1"></i><span>${escapeHTML(f)}</span></li>`).join('')}</ul>${btn}</div>`; }).join('');
        };
        renderAdminPlans = function(){
            const tbody=document.getElementById('admin-plan-list'); if(!tbody)return; const items=(subscriptionPlans||[]).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
            if(!items.length){tbody.innerHTML='<tr><td colspan="5" class="text-center p-8 text-slate-400">ยังไม่มีแผนการใช้งาน</td></tr>';return;}
            tbody.innerHTML=items.map(p=>`<tr><td class="font-bold text-slate-700">${escapeHTML(p.name||'')}${p.featured?'<div class="text-xs text-primary mt-1"><i class="fas fa-star"></i> แนะนำ</div>':''}<div class="text-[11px] text-slate-400 mt-1">ID: ${escapeHTML(p.id||'')}</div></td><td class="font-black text-primary">${escapeHTML(planDisplayPrice(p))}<div class="text-xs font-normal text-slate-400">${escapeHTML(p.desc||'')}</div><div class="text-xs text-slate-500 mt-1">รอบ: ${p.billingCycle==='yearly'?'รายปี':(p.billingCycle==='forever'?'ฟรีตลอด':'รายเดือน')}</div></td><td class="text-sm text-slate-500"><div class="font-bold text-slate-700">รายวิชา: ${Number(p.courseLimit||0)===0?'ไม่จำกัด':Number(p.courseLimit||0)+' วิชา'}</div>${(p.features||[]).slice(0,5).map(f=>`<div>• ${escapeHTML(f)}</div>`).join('')}</td><td class="text-center"><span class="px-3 py-1 rounded-full text-xs font-bold ${p.active!==false?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}">${p.active!==false?'แสดง':'ซ่อน'}</span></td><td class="text-right whitespace-nowrap"><button onclick="editAdminPlan('${p.id}')" class="bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1.5 rounded-lg text-sm font-bold"><i class="fas fa-pen"></i></button><button onclick="deleteAdminPlan('${p.id}')" class="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1.5 rounded-lg text-sm font-bold ml-1"><i class="fas fa-trash"></i></button></td></tr>`).join('');
        };
        window.resetAdminPlanForm=()=>{['plan-sub-edit-id','plan-sub-name','plan-sub-price','plan-sub-promptpay','plan-sub-desc','plan-sub-features','plan-sub-monthly-price','plan-sub-yearly-price'].forEach(id=>{const el=document.getElementById(id); if(el)el.value='';}); const set=(id,v)=>{const e=document.getElementById(id); if(e)e.value=v}; set('plan-sub-order','1'); set('plan-sub-course-limit','1'); set('plan-sub-billing-cycle','monthly'); ['plan-sub-featured','plan-sub-active','plan-sub-free-first-month'].forEach(id=>{const el=document.getElementById(id); if(el)el.checked=(id==='plan-sub-active');});};
        window.editAdminPlan=(id)=>{const p=(subscriptionPlans||[]).find(x=>x.id===id);if(!p)return; const set=(id,v)=>{const e=document.getElementById(id); if(e)e.value=v??''}; set('plan-sub-edit-id',p.id);set('plan-sub-name',p.name||'');set('plan-sub-price',p.price||planDisplayPrice(p));set('plan-sub-promptpay',p.promptpay||'');set('plan-sub-desc',p.desc||'');set('plan-sub-features',(p.features||[]).join('\n'));set('plan-sub-order',Number(p.order||1));set('plan-sub-course-limit',Number(p.courseLimit||0));set('plan-sub-monthly-price',Number(p.monthlyPrice||0));set('plan-sub-yearly-price',Number(p.yearlyPrice||0));set('plan-sub-billing-cycle',p.freeForever?'forever':(p.billingCycle||'monthly')); const chk=(id,v)=>{const e=document.getElementById(id); if(e)e.checked=!!v}; chk('plan-sub-featured',p.featured);chk('plan-sub-active',p.active!==false);chk('plan-sub-free-first-month',p.freeFirstMonth);};
        window.saveAdminPlanForm=async()=>{if(!isAdmin)return showCustomAlert('ไม่มีสิทธิ์','เฉพาะแอดมินเท่านั้น',true); const editId=document.getElementById('plan-sub-edit-id').value; const monthly=Number(document.getElementById('plan-sub-monthly-price')?.value||0); const yearly=Number(document.getElementById('plan-sub-yearly-price')?.value||0); const cycle=document.getElementById('plan-sub-billing-cycle')?.value||'monthly'; const item={id:editId||`plan_${Date.now()}`,name:document.getElementById('plan-sub-name').value.trim(),monthlyPrice:monthly,yearlyPrice:yearly,billingCycle:cycle,freeForever:cycle==='forever',freeFirstMonth:document.getElementById('plan-sub-free-first-month')?.checked||false,courseLimit:Number(document.getElementById('plan-sub-course-limit')?.value||0),price:document.getElementById('plan-sub-price').value.trim(),promptpay:document.getElementById('plan-sub-promptpay').value.trim(),desc:document.getElementById('plan-sub-desc').value.trim(),features:document.getElementById('plan-sub-features').value.split('\n').map(x=>x.trim()).filter(Boolean),order:Number(document.getElementById('plan-sub-order').value||1),featured:document.getElementById('plan-sub-featured').checked,active:document.getElementById('plan-sub-active').checked,updatedAt:Date.now()}; if(!item.price)item.price=planDisplayPrice(item); if(!item.name)return showCustomAlert('ข้อมูลไม่ครบ','กรุณากรอกชื่อระดับ',true); subscriptionPlans=(subscriptionPlans||[]).filter(p=>p.id!==item.id); subscriptionPlans.push(item); writeLocalJSON(PLANS_CACHE_KEY,subscriptionPlans); toggleLoader(true); try{await setDoc(getPlansDocRef(),{items:subscriptionPlans,updatedAt:Date.now()},{merge:true}); resetAdminPlanForm(); renderAdminPlans(); renderLandingPlans(); showCustomAlert('บันทึกแล้ว','บันทึกแผนการใช้งานขึ้น Firebase เรียบร้อย');}catch(e){resetAdminPlanForm();renderAdminPlans();renderLandingPlans();showCustomAlert('บันทึกในเครื่องแล้ว','แต่ยังบันทึกขึ้น Firebase ไม่ได้: '+getFirebaseErrorText(e),true);} toggleLoader(false);};
        window.seedDefaultPlans=async()=>{subscriptionPlans=getDefaultPlans();writeLocalJSON(PLANS_CACHE_KEY,subscriptionPlans);toggleLoader(true);try{await setDoc(getPlansDocRef(),{items:subscriptionPlans,updatedAt:Date.now()},{merge:true});renderAdminPlans();renderLandingPlans();showCustomAlert('สำเร็จ','สร้างแผนตัวอย่าง 3 ระดับ (มาตรฐาน / โปร / ทีม) ขึ้น Firebase แล้ว');}catch(e){renderAdminPlans();renderLandingPlans();showCustomAlert('สร้างในเครื่องแล้ว','แต่ยังบันทึกขึ้น Firebase ไม่ได้: '+getFirebaseErrorText(e),true);}toggleLoader(false);};
        function updatePlanPaymentRequirementUI(plan, cycle){
            const amount = getPlanChargeAmount(plan, cycle);
            const canvas = document.getElementById('payment-qr-canvas');
            const noqr = document.getElementById('payment-no-qr');
            const label = document.getElementById('payment-promptpay-label');
            const amtLabel = document.getElementById('payment-amount-label');
            const payerWrap = document.getElementById('payment-payer-name')?.closest('div');
            const paidAtWrap = document.getElementById('payment-paid-at')?.closest('div');
            const fileWrap = document.getElementById('payment-proof-file')?.closest('div');
            const submitBtn = document.getElementById('payment-submit-btn');
            const submitLabel = document.getElementById('payment-submit-label');
            const payerInput = document.getElementById('payment-payer-name');
            const paidAtInput = document.getElementById('payment-paid-at');
            const fileInput = document.getElementById('payment-proof-file');
            const promptpay = cleanPromptPayId(plan.promptpay || SCHOOLHUB_DEFAULT_PROMPTPAY || '');

            if(canvas) canvas.innerHTML = '';
            if(amtLabel){
                amtLabel.textContent = amount > 0 ? `ยอดชำระ ฿${amount.toLocaleString('th-TH')}` : 'ไม่มีค่าใช้จ่ายรอบนี้';
                amtLabel.classList.remove('hidden');
            }

            const requiresPayment = amount > 0;
            [payerWrap, paidAtWrap, fileWrap].forEach(el => el?.classList.toggle('hidden', !requiresPayment));
            if(payerInput) payerInput.required = requiresPayment;
            if(paidAtInput) paidAtInput.required = requiresPayment;
            if(fileInput) fileInput.required = requiresPayment;
            if(submitLabel) submitLabel.innerHTML = requiresPayment ? '<i class="fas fa-paper-plane mr-1"></i> ส่งหลักฐานการชำระเงิน' : '<i class="fas fa-check mr-1"></i> ส่งคำขอแผนฟรี';

            if(requiresPayment){
                if(promptpay){
                    if(canvas){
                        try{
                            canvas.classList.remove('hidden');
                            if(typeof QRCode !== 'undefined'){
                                new QRCode(canvas,{text:buildPromptPayPayload(promptpay,amount),width:200,height:200,correctLevel:QRCode.CorrectLevel.M});
                            }else{
                                canvas.innerHTML = `<img src="${getPromptPayQRUrl(promptpay, amount)}" alt="PromptPay QR" class="w-[200px] h-[200px] object-contain mx-auto rounded-2xl border border-slate-100">`;
                            }
                        }catch(e){
                            canvas.innerHTML = `<img src="${getPromptPayQRUrl(promptpay, amount)}" alt="PromptPay QR" class="w-[200px] h-[200px] object-contain mx-auto rounded-2xl border border-slate-100">`;
                        }
                    }
                    noqr?.classList.add('hidden');
                    if(label) label.textContent = `พร้อมเพย์: ${promptpay}`;
                }else{
                    canvas?.classList.add('hidden');
                    noqr?.classList.remove('hidden');
                    if(noqr) noqr.innerHTML = '<i class="fas fa-triangle-exclamation text-amber-500 text-2xl mb-2 block"></i>แผนนี้มีค่าใช้จ่าย<br>แต่ยังไม่ได้ตั้งเบอร์พร้อมเพย์';
                    if(label) label.textContent = 'กรุณาให้แอดมินตั้งค่าเบอร์พร้อมเพย์ในแผนนี้';
                }
            }else{
                canvas?.classList.add('hidden');
                noqr?.classList.remove('hidden');
                if(noqr) noqr.innerHTML = '<i class="fas fa-circle-info text-primary text-2xl mb-2 block"></i>แผนนี้ไม่มีค่าใช้จ่าย<br>ไม่ต้องสแกน QR และไม่ต้องกรอกข้อมูลชำระเงิน';
                if(label) label.textContent = 'ไม่มีค่าใช้จ่าย';
            }
        }

        openPlanPaymentModal = window.openPlanPaymentModal = async function(planId){
            const plan=getPlanById(planId); if(!plan)return showCustomAlert('ไม่พบแผน','กรุณาเลือกแผนอีกครั้ง',true);
            if(!currentUser||currentUser.uid==='admin-bypass'){localStorage.setItem(PENDING_PLAN_KEY,planId);return openRegisterFromLanding();}
            if(await hasPendingPlanRequestForCurrentUser()) return showCustomAlert('มีคำขอรออนุมัติอยู่แล้ว','คุณขอแผนไปแล้ว กรุณารอแอดมินอนุมัติ ไม่สามารถขอซ้ำได้',true);
            document.getElementById('payment-plan-id').value=plan.id;
            document.getElementById('payment-plan-name').textContent=plan.name||'-';
            document.getElementById('payment-plan-price').textContent=planDisplayPrice(plan);
            document.getElementById('payment-plan-subtitle').textContent=`${plan.name||''} — เลือกรอบชำระ ระบบจะแสดง QR เฉพาะกรณีมีค่าใช้จ่าย`;
            let cycleBox=document.getElementById('payment-billing-cycle-wrap');
            if(!cycleBox){
                const priceEl=document.getElementById('payment-plan-price');
                cycleBox=document.createElement('div');
                cycleBox.id='payment-billing-cycle-wrap';
                cycleBox.className='mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-3 text-left';
                cycleBox.innerHTML='<label class="block text-xs font-black text-slate-500 mb-1">เลือกรอบชำระ</label><select id="payment-billing-cycle" class="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-slate-700"></select><div id="payment-next-billing-preview" class="text-xs text-slate-500 mt-2"></div>';
                priceEl?.parentElement?.appendChild(cycleBox);
            }
            const sel=document.getElementById('payment-billing-cycle');
            const opts=[];
            if(plan.monthlyPrice>0||plan.freeFirstMonth||plan.billingCycle==='monthly')opts.push(`<option value="monthly">รายเดือน ${plan.freeFirstMonth&&!window.__currentUserDir?.planId?'(ฟรีเดือนแรก)':moneyText(plan.monthlyPrice||extractPlanAmount(plan.price))}</option>`);
            if(plan.yearlyPrice>0||plan.billingCycle==='yearly')opts.push(`<option value="yearly">รายปี ${moneyText(plan.yearlyPrice||extractPlanAmount(plan.price))}</option>`);
            if(plan.freeForever||plan.billingCycle==='forever')opts.push('<option value="forever">ฟรีตลอด</option>');
            sel.innerHTML=opts.join('')||'<option value="monthly">รายเดือน</option>';
            sel.value=plan.billingCycle==='yearly'?'yearly':(plan.billingCycle==='forever'?'forever':'monthly');
            sel.onchange=()=>{
                const amount=getPlanChargeAmount(plan,sel.value);
                const preview=document.getElementById('payment-next-billing-preview');
                if(preview) preview.textContent=(plan.freeForever||sel.value==='forever')?'ไม่มีรอบเรียกเก็บเงิน':`เรียกเก็บครั้งต่อไป: ${new Date(getPlanNextBillingAt(plan,Date.now(),sel.value)).toLocaleDateString('th-TH')}`;
                updatePlanPaymentRequirementUI(plan, sel.value);
            };
            sel.onchange();
            document.getElementById('payment-proof-file').value='';
            document.getElementById('payment-slip-preview-wrap').classList.add('hidden');
            document.getElementById('payment-slip-preview-img').src='';
            const payer=document.getElementById('payment-payer-name'); if(payer)payer.value=currentUser.displayName||'';
            document.getElementById('payment-slip-check-box')?.classList.add('hidden');
            __slipCheckPopupActive = false;
            setPaymentSubmitBusy(false); setNowToPaymentTime();
            document.getElementById('plan-payment-modal')?.classList.remove('hidden');
        };
        const __oldExtractPlanAmount = extractPlanAmount;
        extractPlanAmount = function(priceText){ const planId=document.getElementById('payment-plan-id')?.value; const plan=getPlanById(planId); if(plan) return getPlanChargeAmount(plan,getSelectedPlanCycle(plan)); return __oldExtractPlanAmount(priceText); };
        requestSubscriptionPlan = window.requestSubscriptionPlan = async function(planId){
            const plan=getPlanById(planId); if(!plan)return showCustomAlert('ไม่พบแผน','กรุณาเลือกแผนอีกครั้ง',true);
            if(!currentUser||currentUser.uid==='admin-bypass'){localStorage.setItem(PENDING_PLAN_KEY,planId);openRegisterFromLanding();return;}
            toggleLoader(true);
            try{
                if(await hasPendingPlanRequestForCurrentUser()){ toggleLoader(false); return showCustomAlert('มีคำขอรออนุมัติอยู่แล้ว','คุณส่งคำขอสมัครแผนไว้แล้ว กรุณารอแอดมินอนุมัติก่อน ไม่สามารถขอซ้ำได้',true); }
                const amount=getPlanChargeAmount(plan,plan.billingCycle);
                if(amount===0){ await activateFreePlan(plan); } else { await openPlanPaymentModal(planId); toggleLoader(false); }
            }catch(e){
                toggleLoader(false);
                showCustomAlert('เกิดข้อผิดพลาด', (typeof getFirebaseErrorText==='function'?getFirebaseErrorText(e):(e.message||String(e))), true);
            }
        };
        activateFreePlan = async function(plan){
            if(!currentUser)return; if(await hasPendingPlanRequestForCurrentUser())return showCustomAlert('มีคำขอรออนุมัติอยู่แล้ว','ไม่สามารถขอแผนซ้ำได้',true); toggleLoader(true);
            try{ const userKey=getUserKey(currentUser); const now=Date.now(); const reqId=`${currentUser.uid}_${plan.id}_${now}`; const cycle=plan.billingCycle||'monthly'; const planPayload=applyPlanToUserPayload(plan,now,cycle,{uid:currentUser.uid,email:currentUser.email||'',userKey,name:currentUser.displayName||userKey,role:'user'}); await setDoc(getPlanRequestDocRef(reqId),{id:reqId,uid:currentUser.uid,userKey,email:currentUser.email||'',name:currentUser.displayName||userKey,planId:plan.id,planName:plan.name||'',planPrice:planDisplayPrice(plan),planAmount:0,planBillingCycle:cycle,status:'approved',createdAt:now,approvedAt:now,updatedAt:now,autoApproved:true},{merge:true}); await setDoc(doc(db,getPublicPath(),userKey),planPayload,{merge:true}); await setDoc(doc(db,'users_status',userKey),planPayload,{merge:true}); window.__currentUserDir=Object.assign(window.__currentUserDir||{},planPayload); window.__schoolhubPlanLocked=false; localStorage.removeItem(PENDING_PLAN_KEY); showCustomAlert('เปิดใช้งานแล้ว',`แผน ${plan.name} เปิดใช้งานแล้ว\nเรียกเก็บครั้งต่อไป: ${formatNextBilling(planPayload)}`); renderUserPlans(); }catch(e){showCustomAlert('เกิดข้อผิดพลาด',getFirebaseErrorText(e),true);} toggleLoader(false);
        };
        const __oldSubmitPlanPaymentForm = window.submitPlanPaymentForm;
        // submitPlanPaymentForm เดิมยังใช้ OCR/สลิปเดิม แต่หลังบันทึกจะได้รอบชำระจากแผนที่เลือกผ่าน extractPlanAmount
        approvePlanRequest = window.approvePlanRequest = async function(id){
            const snap=await getDoc(getPlanRequestDocRef(id)); if(!snap.exists())return showCustomAlert('ไม่พบคำขอ','คำขอนี้อาจถูกลบไปแล้ว',true); const r=snap.data(); const plan=getPlanById(r.planId)||r; window.showCustomConfirm('อนุมัติแผน',`อนุมัติให้ ${r.name||r.email} ใช้แผน ${r.planName} หรือไม่?`,async()=>{ toggleLoader(true); const now=Date.now(); const cycle=r.planBillingCycle||plan.billingCycle||'monthly'; const planPayload=applyPlanToUserPayload(plan,now,cycle,{uid:r.uid,email:r.email||'',userKey:normalizeSchoolHubEmail(r.email||r.userKey),name:r.name||r.email||'',role:'user'}); try{ await setDoc(getPlanRequestDocRef(id),{status:'approved',approvedAt:now,approvedBy:currentUser?.email||'admin',updatedAt:now,planNextBillingAt:planPayload.planNextBillingAt,planExpiresAt:planPayload.planExpiresAt,courseLimit:planPayload.courseLimit},{merge:true}); await setDoc(doc(db,getPublicPath(),normalizeSchoolHubEmail(r.email||r.userKey)),planPayload,{merge:true}); await setDoc(doc(db,'users_status',normalizeSchoolHubEmail(r.email||r.userKey)),planPayload,{merge:true}); sendMailViaWebApp({to:r.email||r.userKey,name:r.name||'',type:'plan_approved',subject:`อนุมัติแผน ${r.planName||''} แล้ว`,message:`สวัสดี ${r.name||r.email||''}\n\nคำขอสมัครแผน ${r.planName||''} ได้รับการอนุมัติแล้ว\nเรียกเก็บครั้งต่อไป: ${formatNextBilling(planPayload)}\n\nขอบคุณที่ใช้ SchoolHub`,extra:{planName:r.planName||'',planPrice:r.planPrice||'',requestId:id}}); await loadPlanRequests();await loadAdminData();window.closePlanRequestPopup(); showCustomAlert('อนุมัติแล้ว',`เปลี่ยนสิทธิ์ผู้ใช้เป็นแผน ${r.planName}\nเรียกเก็บครั้งต่อไป: ${formatNextBilling(planPayload)}`);}catch(e){showCustomAlert('อนุมัติไม่ได้',getFirebaseErrorText(e),true);} toggleLoader(false); });
        };
        /* Legacy openUserPlanSelector wrapper removed by stable canonical plan selector. */

        // Smart scrollbar: ถ้าเนื้อหาไม่เกิน ไม่ต้องให้เลื่อนเปล่า
        function applySmartScroll(el, axis){
            if(!el) return;
            // เพิ่ม threshold 8px กัน sub-pixel / rounding ทำให้ scroll เปิดโดยไม่จำเป็น
            const THRESHOLD = 8;
            if(axis === 'x'){
                el.style.overflowX = el.scrollWidth > el.clientWidth + THRESHOLD ? 'auto' : 'hidden';
            }else if(axis === 'y'){
                el.style.overflowY = el.scrollHeight > el.clientHeight + THRESHOLD ? 'auto' : 'hidden';
            }else{
                el.style.overflowX = el.scrollWidth > el.clientWidth + THRESHOLD ? 'auto' : 'hidden';
                el.style.overflowY = el.scrollHeight > el.clientHeight + THRESHOLD ? 'auto' : 'hidden';
            }
        }
        window.updateSmartScrollbars = function(){
            document.documentElement.style.overflowX = 'hidden';
            document.body.style.overflowX = 'hidden';
            // main scroll area
            const content = document.querySelector('main > div.flex-1');
            if(content) applySmartScroll(content, 'y');
            // sidebar nav
            const sidebar = document.querySelector('aside nav.flex-1');
            if(sidebar) applySmartScroll(sidebar, 'y');
            // horizontal tables only
            document.querySelectorAll('.table-container > .overflow-x-auto, .overflow-x-auto').forEach(el => applySmartScroll(el, 'x'));
        };
        window.addEventListener('resize', () => setTimeout(updateSmartScrollbars, 80));
        document.addEventListener('DOMContentLoaded', () => setTimeout(updateSmartScrollbars, 400));

        // ResizeObserver: เมื่อเนื้อหาใน main scroll area เปลี่ยนขนาด ให้วัดซ้ำทันที
        // ครอบคลุมทุกกรณี: renderUserPlans, loadAdminData, loadPlanRequests ฯลฯ
        document.addEventListener('DOMContentLoaded', () => {
            const target = document.querySelector('main > div.flex-1');
            if(!target || !window.ResizeObserver) return;
            const ro = new ResizeObserver(() => {
                // debounce 40ms
                clearTimeout(ro._t);
                ro._t = setTimeout(updateSmartScrollbars, 40);
            });
            ro.observe(target);
        });

        // patch switchView เพื่อเรียก updateSmartScrollbars ทุกครั้งที่เปลี่ยนหน้า
        const _origSwitchView = window.switchView;
        window.switchView = function(viewId){
            _origSwitchView(viewId);
            // รอให้ DOM render เสร็จก่อนวัด
            requestAnimationFrame(() => setTimeout(updateSmartScrollbars, 60));
        };

        // Admin Logics (Retained)
        window.loadAdminData = async () => {
            const tbody = document.getElementById('admin-user-list');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลดข้อมูลผู้ใช้...</td></tr>';
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000));
            try {
                if (!Array.isArray(adminPlanRequests) || adminPlanRequests.length === 0) {
                    try { await window.loadPlanRequests(); } catch(e) { console.warn('load requests before users failed:', e); }
                }
                const querySnapshot = await Promise.race([getDocs(collection(db, getPublicPath())), timeout]);
                let rows = '';
                window.__adminUsersByUid = {};
                querySnapshot.forEach((d) => {
                    const u = d.data() || {};
                    const uid = u.uid || d.id;
                    window.__adminUsersByUid[uid] = {...u, uid};
                    const isDel = ['blocked','deleted'].includes(String(u.status||'').toLowerCase()) || u.blocked === true;
                    const displayKey = u.userKey || u.email || uid;
                    const safeKey = String(displayKey).replace(/'/g, "\\'");
                    const userRequests = getRequestsForUser(u, uid);
                    const pendingRequests = userRequests.filter(r=>r.status==='pending');
                    const roleBadge = u.role === 'admin' ? '<span class="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">Admin</span>' : (isDel ? '<span class="bg-slate-100 text-slate-800 px-3 py-1 rounded-full text-xs">บล็อก</span>' : (pendingRequests.length?'<span class="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold">มีคำขอแผน</span>':'<span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs">User</span>'));
                    let planBadge = '';
                    if (u.role === 'admin') {
                        planBadge = '<span class="text-xs text-slate-400">-</span>';
                    } else if (pendingRequests.length) {
                        const latest = pendingRequests[0];
                        planBadge = `<button onclick="openPlanRequestPopup('${uid}')" class="clickable-plan-cell inline-flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-full text-xs font-black border border-amber-200"><i class="fas fa-bell animate-pulse"></i> ${escapeHTML(latest.planName||'คำขอแผน')}</button>`;
                    } else if (userRequests.length) {
                        const latest = userRequests[0];
                        const cls = latest.status==='approved' ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border-emerald-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200';
                        planBadge = `<button onclick="openPlanRequestPopup('${uid}')" class="clickable-plan-cell inline-flex items-center gap-2 ${cls} px-3 py-1.5 rounded-full text-xs font-bold border">${escapeHTML(u.planName || latest.planName || 'ดูประวัติแผน')}</button>`;
                    } else if (u.planName) {
                        planBadge = `<span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">${escapeHTML(u.planName)}</span>`;
                    } else if (u.requestedPlanName) {
                        planBadge = `<button onclick="openPlanRequestPopup('${uid}')" class="clickable-plan-cell inline-flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200">ขอ ${escapeHTML(u.requestedPlanName)}</button>`;
                    } else {
                        planBadge = '<span class="text-xs text-slate-400">ยังไม่กำหนด</span>';
                    }
                    const actionBtn = u.role === 'admin' ? '' : `<button onclick="updateUserStatus('${uid}', '${safeKey}', '${isDel?'active':'blocked'}')" class="${isDel?'text-emerald-500 bg-emerald-50':'text-rose-500 bg-rose-50'} px-3 py-1 rounded-lg text-sm font-bold border"><i class="fas ${isDel?'fa-check':'fa-ban'}"></i> ${isDel?'ปลดบล็อก':'บล็อก'}</button>`;
                    rows += `<tr><td class="font-bold text-slate-700">${escapeHTML(u.name || 'ไม่มีชื่อ')}<br><span class="text-xs font-normal text-slate-400 font-mono">${escapeHTML(displayKey)}</span></td><td class="text-center">${planBadge}</td><td class="text-center">${roleBadge}</td><td class="text-right">${actionBtn}</td></tr>`;
                });
                tbody.innerHTML = rows || '<tr><td colspan="4" class="text-center p-8 text-slate-400">ยังไม่มีข้อมูลผู้ใช้ใน public_users_directory<br><span class="text-xs">หากมีผู้ใช้แล้ว ให้ตรวจสอบฟังก์ชัน addUserToDirectory หรือ Firestore Rules</span></td></tr>';
            } catch(e) {
                const msg = e.message === 'timeout' ? 'ดึงข้อมูลนานเกินไป อาจเกิดจาก Firestore Rules หรืออินเทอร์เน็ต' : (e.message || 'ไม่ทราบสาเหตุ');
                tbody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-rose-500"><i class="fas fa-triangle-exclamation text-3xl mb-3"></i><br>โหลดข้อมูลผู้ใช้ไม่ได้<br><span class="text-xs text-slate-500">${escapeHTML(msg)}</span></td></tr>`;
            } finally {
                setTimeout(updateSmartScrollbars, 80);
            }
        };

        window.updateUserStatus = (uid, userKey, status) => {
            const target = (status === 'blocked' || status === 'deleted') ? 'blocked' : 'active';
            if (target === 'blocked') window.showCustomConfirm("บล็อกผู้ใช้", "บล็อกเฉพาะการใช้งาน ไม่ลบข้อมูล และผู้ใช้ที่ออนไลน์อยู่จะถูกเด้งออก ต้องการทำต่อหรือไม่?", async () => { executeUserStatusUpdate(uid, userKey, target); });
            else executeUserStatusUpdate(uid, userKey, target);
        };
        window.executeUserStatusUpdate = async (uid, userKey, status) => {
            try {
                toggleLoader(true);
                const makeBlocked = (status === 'blocked' || status === 'deleted');
                const payload = makeBlocked
                    ? { status: 'blocked', blocked: true, blockedAt: Date.now(), deletedAt: null, updatedAt: Date.now() }
                    : { status: 'active', blocked: false, blockedAt: null, deletedAt: null, unblockedAt: Date.now(), updatedAt: Date.now() };
                const emailKey = isSchoolHubValidEmail(userKey) ? normalizeSchoolHubEmail(userKey) : (isSchoolHubValidEmail(uid) ? normalizeSchoolHubEmail(uid) : '');
                if (emailKey) {
                    await setDoc(doc(db, getPublicPath(), emailKey), payload, { merge: true });
                    await setDoc(doc(db, `users_status`, emailKey), payload, { merge: true });
                }
                await Promise.allSettled([loadAdminData(), (typeof renderBlockedUsersList === 'function' ? renderBlockedUsersList() : Promise.resolve())]);
                showCustomAlert(makeBlocked ? 'บล็อกแล้ว' : 'ปลดบล็อกแล้ว', makeBlocked ? 'บล็อกเฉพาะการใช้งานแล้ว ข้อมูลผู้ใช้ยังอยู่ครบ' : 'ผู้ใช้กลับมาใช้งานได้แล้ว');
            } catch(e) { showCustomAlert('เปลี่ยนสถานะไม่ได้', getFirebaseErrorText(e), true); }
            finally { toggleLoader(false); }
        };
        window.clearEntireSystem = () => { window.showCustomConfirm("ล้างระบบทั้งหมด!", "ลบข้อมูลผู้ใช้ทุกคน (ยกเว้นแอดมิน)?", async () => { toggleLoader(true); try { const qs = await getDocs(collection(db, getPublicPath())); const toDel = []; qs.forEach(d => { const u = d.data(); if(u.role !== 'admin') toDel.push(u); }); for(let u of toDel) { const key = u.userKey || u.email; await deleteDoc(doc(db, getPublicPath(), u.uid)); await deleteDoc(doc(db, `users_status`, key)); await deleteDoc(doc(db, getPrivatePath(key), 'state')); } loadAdminData(); } catch (e) {} toggleLoader(false); }); };
    