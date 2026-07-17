
/* SchoolHub Email Only UserStats Strict Final
   สำคัญ:
   - user_stats จะเขียนเฉพาะ document id ที่เป็นอีเมลเท่านั้น
   - ไม่เขียน user_stats/{uid} หรือ user_stats/{ชื่อสุ่ม} อีก
   - global_stats/summary จะรวมเฉพาะ user_stats ที่ doc.id มี @ เท่านั้น
   - ข้อมูล state ต้องอ่านจาก users/{email}/school_data/state เท่านั้น
*/
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const emailOnlyConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
};

const emailOnlyApp = getApps().length ? getApp() : initializeApp(emailOnlyConfig);
const emailOnlyDb = getFirestore(emailOnlyApp);
const emailOnlyAuth = getAuth(emailOnlyApp);
let emailOnlyCurrentUser = null;

function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}
function cleanEmail(v) {
    const s = String(v || '').trim().toLowerCase();
    return isEmail(s) ? s : '';
}
function toNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
function values(v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.values(v);
    return [];
}
function countAny(v) {
    if (!v) return 0;
    if (Array.isArray(v)) return v.length;
    if (v && typeof v === 'object') return Object.keys(v).length;
    return 0;
}
function countAttendance(attendance) {
    if (!attendance || typeof attendance !== 'object') return 0;
    let total = 0;
    Object.values(attendance).forEach(group => {
        if (!group) return;
        if (typeof group === 'object' && !Array.isArray(group)) {
            total += Object.keys(group).length;
        }
    });
    return total;
}
function countCoursePlans(coursePlans) {
    if (!coursePlans) return 0;
    if (Array.isArray(coursePlans)) return coursePlans.length;
    if (typeof coursePlans !== 'object') return 0;
    let total = 0;
    Object.values(coursePlans).forEach(group => {
        if (!group) return;
        if (Array.isArray(group)) total += group.length;
        else if (typeof group === 'object') {
            if (Array.isArray(group.items)) total += group.items.length;
            else {
                let sub = 0;
                ['assignments','tasks','works','plans','scoreItems'].forEach(k => {
                    if (Array.isArray(group[k])) sub += group[k].length;
                    else if (group[k] && typeof group[k] === 'object') sub += Object.keys(group[k]).length;
                });
                total += sub || Object.keys(group).length;
            }
        }
    });
    return total;
}
function countState(state) {
    const courses = values(state?.courses || state?.courseList || state?.coursesMap);
    const students = values(state?.students || state?.studentList || state?.masterStudents || state?.studentsMap);

    const attendanceRecords =
        countAttendance(state?.attendance) ||
        countAttendance(state?.attendanceRecords) ||
        countAttendance(state?.attendances) ||
        countAttendance(state?.checkIns) ||
        countAttendance(state?.checkins);

    let assignments = countCoursePlans(state?.coursePlans);
    if (!assignments) {
        assignments += countAny(state?.assignments) + countAny(state?.tasks) + countAny(state?.works);
        courses.forEach(c => {
            assignments += countAny(c?.assignments) + countAny(c?.tasks) + countAny(c?.works);
        });
    }

    let scoreItems = 0;
    scoreItems += countAny(state?.scores);
    scoreItems += countAny(state?.scoreRecords);
    scoreItems += countAny(state?.scoreList);
    scoreItems += countAny(state?.studentScores);

    return {
        courses: courses.length,
        students: students.length,
        attendanceRecords,
        assignments,
        scoreItems
    };
}
function isBlocked(d) {
    const status = String(d?.status || '').toLowerCase();
    return status === 'blocked' || status === 'deleted' || d?.blocked === true;
}
function isAdmin(d) {
    const role = String(d?.role || '').toLowerCase();
    return role === 'admin' || d?.isAdmin === true;
}
async function readStateByEmail(email) {
    email = cleanEmail(email);
    if (!email) return null;
    try {
        const snap = await getDoc(doc(emailOnlyDb, 'users', email, 'school_data', 'state'));
        return snap.exists() ? (snap.data() || {}) : null;
    } catch (e) {
        console.warn('อ่าน users/{email}/school_data/state ไม่สำเร็จ:', email, e);
        return null;
    }
}
async function collectRealEmailsOnly() {
    const emails = new Map();

    function add(email, data = {}) {
        const e = cleanEmail(email);
        if (!e) return;
        if (!emails.has(e)) emails.set(e, {});
        emails.set(e, { ...emails.get(e), ...data, email: e });
    }

    // 1) users collection: เอาเฉพาะ doc.id ที่เป็นอีเมลเท่านั้น
    try {
        const snap = await getDocs(collection(emailOnlyDb, 'users'));
        snap.forEach(d => {
            if (isEmail(d.id)) add(d.id, d.data() || {});
        });
    } catch (e) {
        console.warn('อ่าน users ไม่สำเร็จ:', e);
    }

    // 2) users_status/public_users_directory: เอาเฉพาะ field email หรือ doc.id ที่เป็นอีเมล
    for (const col of ['users_status', 'public_users_directory']) {
        try {
            const snap = await getDocs(collection(emailOnlyDb, col));
            snap.forEach(d => {
                const data = d.data() || {};
                add(data.email || d.id, data);
            });
        } catch (e) {
            console.warn('อ่าน ' + col + ' ไม่สำเร็จ:', e);
        }
    }

    // 3) current user
    const u = emailOnlyCurrentUser || emailOnlyAuth.currentUser || window.currentUser || {};
    add(window.currentUserEmail || window.userEmail || u.email, {
        uid: u.uid || '',
        displayName: u.displayName || window.currentUserName || '',
        role: window.currentUserRole || window.userRole || 'teacher',
        status: window.currentUserStatus || 'active'
    });

    return Array.from(emails.values()).filter(r => isEmail(r.email));
}
async function syncEmailOnlyUserStats() {
    const records = await collectRealEmailsOnly();

    let updatedCount = 0;
    let skippedNoState = 0;

    for (const r of records) {
        const email = cleanEmail(r.email);
        if (!email || isBlocked(r)) continue;

        const state = await readStateByEmail(email);
        if (!state) {
            skippedNoState++;
            console.warn('ข้าม เพราะไม่มี state ที่ users/{email}/school_data/state:', email);
            continue;
        }

        const counts = countState(state);

        const payload = {
            uid: r.uid || '',
            email,
            displayName: r.displayName || r.name || r.fullName || '',
            role: isAdmin(r) ? 'admin' : (r.role || 'teacher'),
            status: r.status || 'active',
            stateUserKey: email,
            courses: counts.courses,
            students: counts.students,
            attendanceRecords: counts.attendanceRecords,
            assignments: counts.assignments,
            scoreItems: counts.scoreItems,
            updatedAt: serverTimestamp()
        };

        // จุดสำคัญ: ใช้อีเมลเป็น document id เท่านั้น
        await setDoc(doc(emailOnlyDb, 'user_stats', email), payload, { merge: true });
        updatedCount++;
    }

    console.log('Email-only user_stats synced:', { updatedCount, skippedNoState, totalEmailRecords: records.length });
    return { updatedCount, skippedNoState, totalEmailRecords: records.length };
}
async function rebuildGlobalFromEmailOnlyStats() {
    const snap = await getDocs(collection(emailOnlyDb, 'user_stats'));

    let totalUsers = 0;
    let totalTeachers = 0;
    let totalCourses = 0;
    let totalStudents = 0;
    let totalAttendanceRecords = 0;
    let totalAssignments = 0;
    let totalScoreItems = 0;

    snap.forEach(d => {
        // จุดสำคัญ: รวมเฉพาะ doc.id ที่เป็นอีเมล
        if (!isEmail(d.id)) return;

        const data = d.data() || {};
        if (isBlocked(data)) return;

        totalUsers++;
        if (!isAdmin(data)) totalTeachers++;

        totalCourses += toNum(data.courses);
        totalStudents += toNum(data.students);
        totalAttendanceRecords += toNum(data.attendanceRecords);
        totalAssignments += toNum(data.assignments);
        totalScoreItems += toNum(data.scoreItems);
    });

    const summary = {
        totalUsers,
        totalTeachers,
        totalCourses,
        totalStudents,
        totalAttendanceRecords,
        totalAssignments,
        totalScoreItems,
        countedUserStats: totalUsers,
        updatedAt: serverTimestamp()
    };

    await setDoc(doc(emailOnlyDb, 'global_stats', 'summary'), summary, { merge: true });

    if (typeof window.loadAdminGlobalDashboard === 'function') window.loadAdminGlobalDashboard();
    if (typeof window.loadGlobalSiteStats === 'function') window.loadGlobalSiteStats();

    return summary;
}
async function syncEmailOnlyThenGlobal() {
    try {
        if (typeof window.toggleLoader === 'function') window.toggleLoader(true);
        await syncEmailOnlyUserStats();
        await rebuildGlobalFromEmailOnlyStats();
    } catch(e) {
        console.error(e);
        alert('อัปเดตสถิติแบบอีเมลไม่สำเร็จ: ' + (e.message || e));
    } finally {
        if (typeof window.toggleLoader === 'function') window.toggleLoader(false);
    }
}

window.__schoolhubSyncEmailOnlyUserStats = syncEmailOnlyUserStats;
window.__schoolhubSyncUserStatsOnly = syncEmailOnlyUserStats;
window.__schoolhubSyncUserStatsThenGlobal = syncEmailOnlyThenGlobal;
window.__schoolhubSyncAndRebuildStats = syncEmailOnlyThenGlobal;
window.__schoolhubCentralStatsRebuild = syncEmailOnlyThenGlobal;
window.__schoolhubRebuildAllStatsFromUsersState = syncEmailOnlyThenGlobal;

function cleanDashboardRawBox() {
    const pre = document.getElementById('gd-summary-json');
    if (pre) {
        const box = pre.closest('.mt-6') || pre.parentElement;
        if (box) box.remove();
    }
}

document.addEventListener('click', function(e) {
    const text = (e.target?.innerText || e.target?.textContent || '').toString();
    if (/อัปเดตสถิติ|รีเฟรช/.test(text)) {
        setTimeout(syncEmailOnlyThenGlobal, 250);
    }
}, true);

document.addEventListener('DOMContentLoaded', () => {
    cleanDashboardRawBox();
    setTimeout(cleanDashboardRawBox, 800);
    setTimeout(syncEmailOnlyThenGlobal, 2200);
});

onAuthStateChanged(emailOnlyAuth, user => {
    emailOnlyCurrentUser = user;
    if (user) setTimeout(syncEmailOnlyThenGlobal, 1600);
});

/* Mini calendar popup */
(function initMiniCalendar(){
    let targetInput = null;
    let viewDate = new Date();
    function pad(n){ return String(n).padStart(2,'0'); }
    function toInputDate(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
    function parseDate(v){
        if (!v) return new Date();
        const d = new Date(v);
        return isNaN(d.getTime()) ? new Date() : d;
    }
    function render(){
        const title = document.getElementById('mini-cal-title');
        const grid = document.getElementById('mini-cal-grid');
        if (!title || !grid) return;
        title.textContent = viewDate.toLocaleDateString('th-TH', { month:'long', year:'numeric' });
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const first = new Date(year, month, 1);
        const start = first.getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const todayStr = toInputDate(new Date());
        let html = '';
        for (let i=0; i<start; i++) html += '<div></div>';
        for (let day=1; day<=lastDate; day++) {
            const d = new Date(year, month, day);
            const dateStr = toInputDate(d);
            const isSelected = targetInput && targetInput.value === dateStr;
            const isToday = dateStr === todayStr;
            html += `<button type="button" data-mini-date="${dateStr}" class="schoolhub-mini-cal-day rounded-xl text-sm font-bold hover:bg-indigo-50 ${isSelected?'is-selected':''} ${isToday?'is-today':''}">${day}</button>`;
        }
        grid.innerHTML = html;
    }
    function openCalendar(input){
        targetInput = input;
        viewDate = parseDate(input.value);
        document.getElementById('schoolhub-mini-calendar-backdrop')?.classList.remove('hidden');
        render();
    }
    function closeCalendar(){
        document.getElementById('schoolhub-mini-calendar-backdrop')?.classList.add('hidden');
    }

    document.addEventListener('click', function(e){
        const btn = e.target.closest('[data-mini-date]');
        if (btn && targetInput) {
            targetInput.value = btn.getAttribute('data-mini-date');
            targetInput.dispatchEvent(new Event('input', { bubbles:true }));
            targetInput.dispatchEvent(new Event('change', { bubbles:true }));
            closeCalendar();
            return;
        }
        const input = e.target.closest('input[type="date"]');
        if (input) {
            e.preventDefault();
            try { input.blur(); } catch(e) {}
            openCalendar(input);
        }
    }, true);

    document.addEventListener('DOMContentLoaded', function(){
        document.getElementById('mini-cal-close')?.addEventListener('click', closeCalendar);
        document.getElementById('mini-cal-prev')?.addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth()-1); render(); });
        document.getElementById('mini-cal-next')?.addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth()+1); render(); });
        document.getElementById('mini-cal-today')?.addEventListener('click', () => {
            if (!targetInput) return;
            targetInput.value = toInputDate(new Date());
            targetInput.dispatchEvent(new Event('input', { bubbles:true }));
            targetInput.dispatchEvent(new Event('change', { bubbles:true }));
            closeCalendar();
        });
        document.getElementById('schoolhub-mini-calendar-backdrop')?.addEventListener('click', e => {
            if (e.target.id === 'schoolhub-mini-calendar-backdrop') closeCalendar();
        });
    });
})();
