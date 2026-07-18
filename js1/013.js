
/* ============================================================
   SchoolHub Stats Restore Render
   แก้ตัวเลขขึ้น — ทั้งหมด
   - ใช้ Firebase 11.6.1 ตามไฟล์เดิม
   - ไม่ใช้ onSnapshot
   - โหลด global_stats/summary ก่อนเสมอ
   - sync user_stats จาก users/{userKey}/school_data/state แบบหน่วงเวลา
   ============================================================ */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const cfg = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
};

const app = getApps().length ? getApp() : initializeApp(cfg);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
let syncTimer = null;
let isSyncing = false;

const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

function displayValue(v) {
    return String(num(v));
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = displayValue(value);
}

function renderSummary(s) {
    if (!s) return;

    const teachers = num(s.totalTeachers || s.totalUsers);
    const courses = num(s.totalCourses);
    const students = num(s.totalStudents);

    setText('stat-landing-teachers', teachers);
    setText('stat-landing-courses', courses);
    setText('stat-landing-students', students);

    setText('stat-auth-teachers', teachers);
    setText('stat-auth-courses', courses);
    setText('stat-auth-students', students);

    setText('admin-stat-teachers', teachers);
    setText('admin-stat-courses', courses);
    setText('admin-stat-students', students);
    setText('admin-stat-attendance', s.totalAttendanceRecords);
    setText('admin-stat-assignments', s.totalAssignments);
    setText('admin-stat-scores', s.totalScoreItems);

    const updated = document.getElementById('admin-stat-updated');
    if (updated) updated.textContent = 'อัปเดตล่าสุด: ' + new Date().toLocaleString('th-TH');

    // Store latest summary values for landing stat slide
    window._latestGlobalSummary = s;
    cacheLandingSummary(s);
    applyLandingStatSlide(s);
}

// เก็บค่าล่าสุดที่ดึงได้จริงไว้ใน localStorage เพื่อให้เปิดหน้าใหม่ครั้งถัดไป
// วาดค่าล่าสุดได้ทันทีระหว่างรอข้อมูลสดจาก Firestore แทนที่จะโชว์ "—" ว่าง ๆ
const LANDING_STAT_CACHE_KEY = 'schoolhub_landing_stat_last_summary';

function cacheLandingSummary(s) {
    try { localStorage.setItem(LANDING_STAT_CACHE_KEY, JSON.stringify(s)); } catch (e) {}
}

function loadCachedLandingSummary() {
    try {
        const raw = localStorage.getItem(LANDING_STAT_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

// ============================================================
// Landing Stat Selector & Auto-slide
// ============================================================
const LANDING_STAT_KEY = 'schoolhub_landing_stat_config';

const LANDING_STAT_META = {
    teachers:    { label: 'คุณครู',         getValue: s => num(s.totalTeachers || s.totalUsers) },
    courses:     { label: 'วิชา',            getValue: s => num(s.totalCourses) },
    students:    { label: 'นักเรียน',        getValue: s => num(s.totalStudents) },
    attendance:  { label: 'เช็คชื่อ',        getValue: s => num(s.totalAttendanceRecords) },
    assignments: { label: 'งาน/การสอบ',     getValue: s => num(s.totalAssignments) },
    scores:      { label: 'รายการคะแนน',    getValue: s => num(s.totalScoreItems) },
};

const LANDING_STAT_DOC_REF = doc(db, 'system_settings', 'landing_stats');

function loadLandingStatConfig() {
    try {
        const raw = localStorage.getItem(LANDING_STAT_KEY);
        if (raw) return JSON.parse(raw);
    } catch(e) {}
    return { selected: ['teachers','courses','students'], interval: 3 };
}

// อ่านค่าตั้งค่าล่าสุดจาก Firestore (ที่แอดมินบันทึกไว้) เพื่อให้ผู้เข้าชมทุกคน/ทุกเครื่อง
// เห็นการ์ด "ภาพรวมวันนี้" ตรงกับที่แอดมินตั้งจริง ๆ ไม่ใช่แค่เครื่องของแอดมินเอง
// หมายเหตุ: เก็บไว้ที่ system_settings/landing_stats — collection เดียวกับที่ฟีเจอร์ "ประกาศ"
// ของแอดมิน (system_settings/announcements) ใช้อยู่แล้วและพิสูจน์แล้วว่าอ่าน/เขียนได้จริง
// (อ่านได้แม้ยังไม่ล็อกอิน, แอดมินเขียนได้). ไม่ใช้ global_stats/summary เพราะเอกสารนั้นเก็บ
// แต่ตัวเลขสรุปล้วน ๆ คาดว่ามี rule ตรวจสคีมาเข้มงวดกว่า ทำให้ใส่ฟิลด์ใหม่ไม่ผ่าน
async function fetchLandingStatConfigRemote() {
    try {
        const snap = await getDoc(LANDING_STAT_DOC_REF);
        if (snap.exists()) {
            const data = snap.data() || {};
            if (Array.isArray(data.selected) && data.selected.length) {
                const cfg = { selected: data.selected, interval: Math.max(1, Number(data.interval) || 3) };
                try { localStorage.setItem(LANDING_STAT_KEY, JSON.stringify(cfg)); } catch(e) {}
                return cfg;
            }
        }
    } catch (error) {
        console.warn('อ่านการตั้งค่าการ์ดภาพรวมจาก Firestore ไม่สำเร็จ:', error);
    }
    return null;
}

async function saveLandingStatConfig() {
    const checks = document.querySelectorAll('input[name="landing-stat"]:checked');
    const selected = Array.from(checks).map(c => c.value);
    if (selected.length === 0) return showCustomAlert('กรุณาเลือกอย่างน้อย 1 รายการ', 'ต้องเลือกข้อมูลที่จะแสดงอย่างน้อย 1 รายการ', true);
    const interval = Math.max(1, parseInt(document.getElementById('landing-stat-interval')?.value) || 3);
    const cfg = { selected, interval };
    try { localStorage.setItem(LANDING_STAT_KEY, JSON.stringify(cfg)); } catch(e) {}
    applyLandingStatSlide(window._latestGlobalSummary || null);
    try {
        await setDoc(LANDING_STAT_DOC_REF, { selected, interval, updatedAt: Date.now() }, { merge: true });
        showCustomAlert('บันทึกสำเร็จ', 'อัปเดตการ์ดภาพรวมบน Landing Page และหน้า Login แล้ว (มีผลกับผู้เข้าชมทุกคน)');
    } catch (error) {
        console.error('บันทึกการตั้งค่าการ์ดภาพรวมไป Firestore ไม่สำเร็จ:', error);
        const detail = (error && (error.code || error.message)) ? ` (${error.code || error.message})` : '';
        showCustomAlert('บันทึกไม่สมบูรณ์', 'บันทึกในเครื่องนี้แล้ว แต่ซิงก์ไปเซิร์ฟเวอร์ไม่สำเร็จ' + detail + ' ผู้เข้าชมคนอื่นอาจยังไม่เห็นการเปลี่ยนแปลง ลองบันทึกอีกครั้ง', true);
    }
}
window.saveLandingStatConfig = saveLandingStatConfig;

// ---- rendering logic ----
let _landingSlideTimer = null;
let _landingSlideGroups = [];
let _landingSlideIdx = 0;
const _landingSwapToken = { landing: 0, auth: 0 };
const _landingLastSignature = { landing: '', auth: '' };

function _chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function _renderLandingSlot(slots, opts) {
    // slots: array of {label, value} up to 3
    const instant = !!(opts && opts.instant);
    const landingGrid = document.getElementById('stat-landing-grid');
    const authGrid = document.getElementById('stat-auth-grid');

    const signature = JSON.stringify(slots);

    const landingHtml = slots.map(slot => `
            <div class="bg-white/10 rounded-2xl p-3">
                <div class="text-xl font-black">${slot.value}</div>
                <div class="text-[11px] text-slate-300">${slot.label}</div>
            </div>
        `).join('');

    const authHtml = slots.map(slot => `
            <div class="auth-stat-card">
                <b>${slot.value}</b>
                <span>${slot.label}</span>
            </div>
        `).join('');

    function swapGrid(grid, html, cacheKey) {
        if (!grid) return;
        if (_landingLastSignature[cacheKey] === signature) return; // เนื้อหาเหมือนเดิม ไม่ต้อง fade ซ้ำ (กันกระพริบโดยไม่จำเป็น)
        _landingLastSignature[cacheKey] = signature;

        // วาดทันทีแบบไม่มีเอฟเฟกต์ (ใช้ตอนโหลดหน้าครั้งแรก/มีค่า cache ให้แสดงทันที)
        if (instant || !grid.childElementCount) {
            grid.style.transition = 'none';
            grid.style.opacity = '1';
            grid.style.transform = 'none';
            grid.innerHTML = html;
            return;
        }

        const myToken = ++_landingSwapToken[cacheKey];
        grid.style.willChange = 'opacity, transform';
        grid.style.transition = 'opacity 180ms cubic-bezier(0.4,0,0.2,1), transform 180ms cubic-bezier(0.4,0,0.2,1)';
        grid.style.opacity = '0';
        grid.style.transform = 'translateY(-4px)';

        setTimeout(() => {
            if (myToken !== _landingSwapToken[cacheKey]) return; // มีการอัปเดตใหม่แซงคิวมาแล้ว ยกเลิกอันเก่าเพื่อไม่ให้ค้าง/กระพริบซ้อน
            grid.innerHTML = html;
            grid.style.transform = 'translateY(4px)';
            void grid.offsetHeight; // บังคับ reflow ก่อนเล่น transition เข้า เพื่อให้ได้เอฟเฟกต์ slide ที่ลื่นไหลจริง
            grid.style.transition = 'opacity 240ms cubic-bezier(0.4,0,0.2,1), transform 240ms cubic-bezier(0.4,0,0.2,1)';
            grid.style.opacity = '1';
            grid.style.transform = 'translateY(0)';
        }, 170);
    }

    // ใช้ชุดข้อมูลเดียวกันทั้ง Landing Page และหน้าล็อกอิน เพื่อให้ "ภาพรวมวันนี้" แสดงเหมือนหน้าหลัก
    swapGrid(landingGrid, landingHtml, 'landing');
    swapGrid(authGrid, authHtml, 'auth');
}

function applyLandingStatSlide(s, opts) {
    const cfg = loadLandingStatConfig();
    const selected = cfg.selected || ['teachers','courses','students'];
    const intervalMs = Math.max(1, cfg.interval || 3) * 1000;

    // Build slot data
    const allSlots = selected.map(key => {
        const meta = LANDING_STAT_META[key];
        if (!meta) return null;
        return { label: meta.label, value: s ? String(meta.getValue(s)) : '—' };
    }).filter(Boolean);

    if (allSlots.length === 0) return;

    // If ≤ 3: show all at once, no timer
    if (allSlots.length <= 3) {
        if (_landingSlideTimer) { clearInterval(_landingSlideTimer); _landingSlideTimer = null; }
        _landingSlideGroups = [allSlots];
        _landingSlideIdx = 0;
        _renderLandingSlot(allSlots, opts);
        return;
    }

    // > 3: split into groups of 3 and cycle
    _landingSlideGroups = _chunkArray(allSlots, 3);
    _landingSlideIdx = 0;
    _renderLandingSlot(_landingSlideGroups[0], opts);

    if (_landingSlideTimer) clearInterval(_landingSlideTimer);
    _landingSlideTimer = setInterval(() => {
        _landingSlideIdx = (_landingSlideIdx + 1) % _landingSlideGroups.length;
        _renderLandingSlot(_landingSlideGroups[_landingSlideIdx]);
    }, intervalMs);
}

// Init UI checkboxes from saved config on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const cfg = loadLandingStatConfig();
    // Apply checkboxes
    document.querySelectorAll('input[name="landing-stat"]').forEach(cb => {
        cb.checked = cfg.selected.includes(cb.value);
    });
    const intervalInput = document.getElementById('landing-stat-interval');
    if (intervalInput) intervalInput.value = cfg.interval || 3;

    // แสดงค่าล่าสุดที่เคยแคชไว้ทันที (ไม่มีการ fade/กระพริบ) เพื่อไม่ให้การ์ดว่างเปล่าระหว่างรอข้อมูลสดจาก Firestore
    // ถ้ายังไม่เคยมี cache เลย ให้ปล่อยการ์ด "—" ที่ render มากับ HTML ไว้ตามเดิม (ไม่ต้องยิง fade เปล่า ๆ)
    const cached = loadCachedLandingSummary();
    if (cached) {
        window._latestGlobalSummary = cached;
        applyLandingStatSlide(cached, { instant: true });
    }

    // แล้วดึงค่าจริงจาก Firestore มาทับ เพื่อให้ตรงกับที่แอดมินตั้งไว้ล่าสุดเสมอ
    // (ไม่งั้นเครื่อง/เบราว์เซอร์อื่นที่ไม่ใช่ของแอดมินจะเห็นค่า default เท่านั้น)
    fetchLandingStatConfigRemote().then(remoteCfg => {
        if (!remoteCfg) return;
        document.querySelectorAll('input[name="landing-stat"]').forEach(cb => {
            cb.checked = remoteCfg.selected.includes(cb.value);
        });
        if (intervalInput) intervalInput.value = remoteCfg.interval || 3;
        applyLandingStatSlide(window._latestGlobalSummary || null);
    });
});

async function loadGlobalSummary() {
    try {
        const snap = await getDoc(doc(db, 'global_stats', 'summary'));
        if (snap.exists()) {
            const summary = snap.data() || {};
            renderSummary(summary);
            return summary;
        }
        console.warn('ยังไม่พบ global_stats/summary');
    } catch (error) {
        console.error('อ่าน global_stats/summary ไม่สำเร็จ:', error);
    }
    return null;
}

function countAny(v) {
    if (!v) return 0;
    if (Array.isArray(v)) return v.length;
    if (typeof v === 'object') return Object.keys(v).length;
    return 0;
}

function values(v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.values(v);
    return [];
}

function countState(state) {
    const courses = values(state?.courses || state?.courseList || state?.coursesMap);
    const students = values(state?.students || state?.studentList || state?.masterStudents || state?.studentsMap);

    let attendanceRecords = 0;
    let assignments = 0;
    let scoreItems = 0;

    for (const key of ['attendanceRecords','attendances','attendance','checkIns','checkins']) attendanceRecords += countAny(state?.[key]);
    for (const key of ['assignments','works','tasks','scoreItems']) assignments += countAny(state?.[key]);
    for (const key of ['scores','scoreRecords','scoreList','studentScores']) scoreItems += countAny(state?.[key]);

    for (const c of courses) {
        for (const key of ['assignments','works','tasks','scoreItems']) assignments += countAny(c?.[key]);
        for (const key of ['scores','scoreRecords','scoreList','studentScores']) scoreItems += countAny(c?.[key]);
        for (const key of ['attendanceRecords','attendances','attendance','checkIns','checkins']) attendanceRecords += countAny(c?.[key]);

        for (const w of values(c?.weeks)) {
            for (const key of ['assignments','works','tasks']) assignments += countAny(w?.[key]);
            for (const key of ['scores','scoreRecords','scoreList']) scoreItems += countAny(w?.[key]);
            for (const key of ['attendanceRecords','attendances','attendance','checkIns','checkins']) attendanceRecords += countAny(w?.[key]);
        }
    }

    return {
        courses: courses.length,
        students: students.length,
        attendanceRecords,
        assignments,
        scoreItems
    };
}

function getCandidateKeys() {
    const u = currentUser || auth.currentUser || window.currentUser || {};
    return Array.from(new Set([
        window.currentUserEmail,
        window.userEmail,
        u.email,
        u.uid
    ].filter(Boolean).map(String)));
}

async function readStateByKey(key) {
    if (!key) return null;
    try {
        const snap = await getDoc(doc(db, 'users', String(key), 'school_data', 'state'));
        return snap.exists() ? (snap.data() || {}) : null;
    } catch (error) {
        console.warn('อ่าน state ไม่สำเร็จ:', key, error);
        return null;
    }
}

async function findCurrentState() {
    for (const key of getCandidateKeys()) {
        const state = await readStateByKey(key);
        if (state) return { key, state };
    }
    return { key: getCandidateKeys()[0] || '', state: null };
}

function isActiveUser(data) {
    const status = String(data?.status || '').toLowerCase();
    return status !== 'blocked' && status !== 'deleted' && data?.blocked !== true;
}

function isAdminUser(data) {
    const role = String(data?.role || '').toLowerCase();
    return role === 'admin' || data?.isAdmin === true;
}

async function syncCurrentUserStats() {
    const found = await findCurrentState();
    if (!found.state || !found.key) return null;

    const u = currentUser || auth.currentUser || window.currentUser || {};
    const statKey = (u.email || window.currentUserEmail || found.key);
    const counts = countState(found.state);

    const payload = {
        uid: u.uid || '',
        email: u.email || window.currentUserEmail || (String(found.key).includes('@') ? found.key : ''),
        displayName: u.displayName || window.currentUserName || '',
        role: window.currentUserRole || window.userRole || 'teacher',
        status: window.currentUserStatus || 'active',
        stateUserKey: found.key,
        courses: counts.courses,
        students: counts.students,
        attendanceRecords: counts.attendanceRecords,
        assignments: counts.assignments,
        scoreItems: counts.scoreItems,
        updatedAt: serverTimestamp()
    };

    if(String(statKey).includes('@')) await setDoc(doc(db, 'user_stats', String(statKey).toLowerCase()), payload, { merge: true });
    return payload;
}

async function rebuildGlobalSummaryFromUserStats() {
    let totalTeachers = 0;
    let totalUsers = 0;
    let totalCourses = 0;
    let totalStudents = 0;
    let totalAttendanceRecords = 0;
    let totalAssignments = 0;
    let totalScoreItems = 0;
    let countedDocs = 0;

    try {
        const snap = await getDocs(collection(db, 'user_stats'));

        snap.forEach(docSnap => {
            if(!String(docSnap.id).includes('@')) return;
            const d = docSnap.data() || {};
            if (!isActiveUser(d)) return;

            countedDocs += 1;
            totalUsers += 1;
            if (!isAdminUser(d)) totalTeachers += 1;

            totalCourses += num(d.courses ?? d.courseCount ?? d.totalCourses);
            totalStudents += num(d.students ?? d.studentCount ?? d.totalStudents);
            totalAttendanceRecords += num(d.attendanceRecords ?? d.attendanceCount ?? d.totalAttendanceRecords);
            totalAssignments += num(d.assignments ?? d.assignmentCount ?? d.totalAssignments);
            totalScoreItems += num(d.scoreItems ?? d.scoreCount ?? d.totalScoreItems);
        });
    } catch (error) {
        console.error('อ่าน user_stats เพื่อรวมยอดไม่สำเร็จ:', error);
        return loadGlobalSummary();
    }

    if (!countedDocs) {
        console.warn('ยังไม่มี user_stats ให้รวมยอด');
        return loadGlobalSummary();
    }

    const summary = {
        totalTeachers,
        totalUsers,
        totalCourses,
        totalStudents,
        totalAttendanceRecords,
        totalAssignments,
        totalScoreItems,
        countedUserStats: countedDocs,
        updatedAt: serverTimestamp()
    };

    try {
        await setDoc(doc(db, 'global_stats', 'summary'), summary, { merge: true });
        renderSummary(summary);
        return summary;
    } catch (error) {
        console.error('เขียน global_stats/summary ไม่สำเร็จ:', error);
        return loadGlobalSummary();
    }
}

async function syncAndRebuildStats() {
    if (isSyncing) return;
    isSyncing = true;
    try {
        await 
        await rebuildGlobalSummaryFromUserStats();
    } catch (error) {
        console.error('syncAndRebuildStats error:', error);
        await loadGlobalSummary();
    } finally {
        isSyncing = false;
    }
}

function scheduleStatsSync(delay = 1200) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncAndRebuildStats, delay);
}

function hookAfterFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__statsHooked) return;

    const wrapped = async function(...args) {
        const result = original.apply(this, args);
        try {
            if (result && typeof result.then === 'function') {
                const awaited = await result;
                scheduleStatsSync();
                return awaited;
            }
            scheduleStatsSync();
            return result;
        } catch (error) {
            scheduleStatsSync();
            throw error;
        }
    };

    wrapped.__statsHooked = true;
    window[name] = wrapped;
}

function hookSaveFunctions() {
    [
        'saveState',
        'saveData',
        'saveAppState',
        'saveStudent',
        'saveStudentData',
        'addStudent',
        'addStudentToMaster',
        'saveCourse',
        'saveCourseData',
        'addCourse',
        'deleteStudent',
        'deleteCourse',
        'saveAttendance',
        'saveScores',
        'saveScore',
        'saveAssignment'
    ].forEach(hookAfterFunction);
}

window.loadGlobalSiteStats = loadGlobalSummary;
window.__schoolhubCentralStatsRefresh = loadGlobalSummary;
window.__schoolhubCentralStatsRebuild = syncAndRebuildStats;
window.__schoolhubRebuildGlobalSummary = syncAndRebuildStats;
window.__schoolhubSyncAndRebuildStats = syncAndRebuildStats;
window.__schoolhubCentralStatsSyncMine = syncCurrentUserStats;
window.__schoolhubScheduleStatsSync = scheduleStatsSync;

document.addEventListener('click', (event) => {
    const target = event.target;
    if (!target) return;
    const text = (target.innerText || target.textContent || '').toString();
    if (/บันทึก|เพิ่ม|ลบ|เช็คชื่อ|คะแนน|นักเรียน|วิชา|งาน|ตกลง|ยืนยัน/.test(text)) {
        scheduleStatsSync(1600);
    }
}, true);

document.addEventListener('submit', () => scheduleStatsSync(1600), true);

document.addEventListener('DOMContentLoaded', () => {
    loadGlobalSummary();
    setTimeout(loadGlobalSummary, 700);
    setTimeout(hookSaveFunctions, 1500);
    setTimeout(syncAndRebuildStats, 6500);
    setInterval(hookSaveFunctions, 5000);
});

onAuthStateChanged(auth, user => {
    currentUser = user;
    loadGlobalSummary();
    if (user) {
        setTimeout(hookSaveFunctions, 800);
        setTimeout(syncAndRebuildStats, 4500);
    }
});
