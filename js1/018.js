
/* SchoolHub Admin Global Dashboard Loader */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const globalDashboardConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
};

const globalDashboardApp = getApps().length ? getApp() : initializeApp(globalDashboardConfig);
const globalDashboardDb = getFirestore(globalDashboardApp);

function gdNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function gdSet(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(gdNum(value));
}

function gdDate(v) {
    try {
        if (v && typeof v.toDate === 'function') return v.toDate().toLocaleString('th-TH');
        if (v && typeof v.seconds === 'number') return new Date(v.seconds * 1000).toLocaleString('th-TH');
        if (typeof v === 'number') return new Date(v).toLocaleString('th-TH');
        return v ? String(v) : '—';
    } catch(e) {
        return '—';
    }
}

window.loadAdminGlobalDashboard = async function() {
    const pre = document.getElementById('gd-summary-json');
    if (pre) pre.textContent = 'กำลังโหลด...';

    try {
        const snap = await getDoc(doc(globalDashboardDb, 'global_stats', 'summary'));
        if (!snap.exists()) {
            if (pre) pre.textContent = 'ยังไม่พบ global_stats/summary';
            return;
        }

        const d = snap.data() || {};

        gdSet('gd-total-users', d.totalTeachers || d.totalUsers || d.users || d.teachers);
        gdSet('gd-total-courses', d.totalCourses || d.courses);
        gdSet('gd-total-students', d.totalStudents || d.students);
        gdSet('gd-total-attendance', d.totalAttendanceRecords || d.totalAttendance || d.attendanceRecords || d.attendance);
        gdSet('gd-total-assignments', d.totalAssignments || d.assignments || d.works || d.tasks);
        gdSet('gd-total-scores', d.totalScoreItems || d.totalScores || d.scores || d.scoreItems);

        const updated = document.getElementById('gd-updated-at');
        if (updated) updated.textContent = 'อัปเดตล่าสุด: ' + gdDate(d.updatedAt);

        if (pre) {
            const clean = {};
            Object.keys(d).forEach(k => {
                clean[k] = k === 'updatedAt' ? gdDate(d[k]) : d[k];
            });
            pre.textContent = JSON.stringify(clean, null, 2);
        }
    } catch (error) {
        console.error('โหลดแดชบอร์ดรวมไม่สำเร็จ:', error);
        if (pre) pre.textContent = 'โหลดข้อมูลไม่สำเร็จ: ' + (error.message || error);
    }
};
