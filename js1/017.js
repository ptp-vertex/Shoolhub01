
/* SchoolHub Admin Plans Single Popup Form Fix
   แก้ปัญหาแก้ไขแล้วข้อมูลไม่มา เพราะมี input id ซ้ำในฟอร์มเก่า
   ตอนนี้ Popup เป็นฟอร์มเดียวที่ใช้จริง
*/
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const planFixConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
};

const planFixApp = getApps().length ? getApp() : initializeApp(planFixConfig);
const planFixDb = getFirestore(planFixApp);
const plansRef = doc(planFixDb, 'system_settings', 'subscription_plans');

function $(id) {
    return document.getElementById(id);
}

function setVal(id, value) {
    const el = $(id);
    if (el) el.value = value ?? '';
}

function setCheck(id, value) {
    const el = $(id);
    if (el) el.checked = !!value;
}

function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
window.escapeHTML = window.escapeHTML || esc;

function priceOf(p) {
    if (!p) return 'ฟรี';
    if (p.freeForever || p.billingCycle === 'forever') return p.price || 'ฟรีตลอด';
    if (p.price) return p.price;
    if (Number(p.monthlyPrice || 0) > 0) return Number(p.monthlyPrice || 0).toLocaleString('th-TH') + ' บาท/เดือน';
    if (Number(p.yearlyPrice || 0) > 0) return Number(p.yearlyPrice || 0).toLocaleString('th-TH') + ' บาท/ปี';
    return 'ฟรี';
}
window.planDisplayPrice = window.planDisplayPrice || priceOf;

async function loadPlans() {
    let items = [];
    try {
        const snap = await getDoc(plansRef);
        if (snap.exists() && Array.isArray((snap.data() || {}).items)) {
            items = snap.data().items;
        }
    } catch (e) {
        console.warn('โหลด /system_settings/subscription_plans ไม่สำเร็จ:', e);
    }

    if (!items.length && Array.isArray(window.subscriptionPlans)) items = window.subscriptionPlans;

    try {
        if (!items.length) {
            const cached = JSON.parse(localStorage.getItem('schoolhub_subscription_plans') || '[]');
            if (Array.isArray(cached)) items = cached;
        }
    } catch(e) {}

    window.subscriptionPlans = Array.isArray(items) ? items : [];
    try {
        localStorage.setItem('schoolhub_subscription_plans', JSON.stringify(window.subscriptionPlans));
        localStorage.setItem('schoolhub_public_plans', JSON.stringify(window.subscriptionPlans));
    } catch(e) {}
    return window.subscriptionPlans;
}

function normalizePlan(item) {
    const cycle = item.billingCycle || (item.freeForever ? 'forever' : 'monthly');
    const normalized = {
        id: String(item.id || ('plan_' + Date.now())),
        name: String(item.name || '').trim(),
        price: String(item.price || '').trim(),
        desc: String(item.desc || '').trim(),
        features: Array.isArray(item.features) ? item.features.map(x => String(x).trim()).filter(Boolean) : [],
        monthlyPrice: Number(item.monthlyPrice || 0),
        yearlyPrice: Number(item.yearlyPrice || 0),
        billingCycle: cycle,
        freeForever: cycle === 'forever' || item.freeForever === true,
        freeFirstMonth: !!item.freeFirstMonth,
        courseLimit: Number(item.courseLimit || 0),
        studentLimit: Number(item.studentLimit || 0),
        weekLimit: Math.max(1, Number(item.weekLimit || item.maxWeeks || 20)),
        teamMemberLimit: Math.max(1, Number(item.teamMemberLimit || item.maxTeamMembers || 1)),
        allowCourses: item.allowCourses !== false,
        allowStudents: item.allowStudents !== false,
        allowAttendance: item.allowAttendance !== false,
        allowScores: item.allowScores !== false,
        allowPlanScores: item.allowPlanScores !== false,
        allowGradeCriteria: item.allowGradeCriteria !== false,
        allowStudentShare: item.allowStudentShare !== false,
        allowExport: item.allowExport !== false,
        allowTeam: item.allowTeam === true,
        allowEdit: item.allowEdit !== false,
        allowDelete: item.allowDelete !== false,
        allowReports: item.allowReports !== false,
        allowBonus: item.allowBonus !== false,
        allowStars: item.allowStars !== false,
        promptpay: String(item.promptpay || '').trim(),
        order: Number(item.order || 1),
        featured: !!item.featured,
        active: item.active !== false,
        updatedAt: Date.now()
    };
    if (!normalized.price) normalized.price = priceOf(normalized);
    return normalized;
}

function fillPopupFromPlan(p) {
    setVal('plan-sub-edit-id', p.id);
    setVal('plan-sub-name', p.name || '');
    setVal('plan-sub-desc', p.desc || '');
    setVal('plan-sub-price', p.price || priceOf(p));
    setVal('plan-sub-monthly-price', Number(p.monthlyPrice || 0));
    setVal('plan-sub-yearly-price', Number(p.yearlyPrice || 0));
    setVal('plan-sub-billing-cycle', p.freeForever ? 'forever' : (p.billingCycle || 'monthly'));
    setVal('plan-sub-promptpay', p.promptpay || '');
    setVal('plan-sub-course-limit', Number(p.courseLimit || 0));
    setVal('plan-sub-student-limit', Number(p.studentLimit || 0));
    setVal('plan-sub-week-limit', Number(p.weekLimit || p.maxWeeks || 20));
    setVal('plan-sub-team-limit', Math.max(1, Number(p.teamMemberLimit || p.maxTeamMembers || 1)));
    setVal('plan-sub-features', Array.isArray(p.features) ? p.features.join('\n') : '');
    setVal('plan-sub-order', Number(p.order || 1));

    setCheck('plan-sub-free-first-month', p.freeFirstMonth);
    setCheck('plan-sub-allow-attendance', p.allowAttendance !== false);
    setCheck('plan-sub-allow-export', p.allowExport !== false);
    setCheck('plan-sub-allow-team', !!p.allowTeam);
    setCheck('plan-sub-featured', !!p.featured);
    setCheck('plan-sub-active', p.active !== false);
    setCheck('plan-sub-allowBonus', p.allowBonus !== false);
    setCheck('plan-sub-allowStars', p.allowStars !== false);
}

function resetPopupForm() {
    ['plan-sub-edit-id','plan-sub-name','plan-sub-desc','plan-sub-price','plan-sub-monthly-price','plan-sub-yearly-price','plan-sub-promptpay','plan-sub-features'].forEach(id => setVal(id, ''));
    setVal('plan-sub-billing-cycle', 'monthly');
    setVal('plan-sub-course-limit', 1);
    setVal('plan-sub-student-limit', 0);
    setVal('plan-sub-week-limit', 20);
    setVal('plan-sub-team-limit', 1);
    setVal('plan-sub-order', 1);
    setCheck('plan-sub-free-first-month', false);
    setCheck('plan-sub-allow-attendance', true);
    setCheck('plan-sub-allow-export', true);
    setCheck('plan-sub-allow-team', false);
    setCheck('plan-sub-featured', false);
    setCheck('plan-sub-active', true);
}

window.resetAdminPlanForm = resetPopupForm;

window.openAdminPlanPopup = function(mode = 'add') {
    const modal = $('admin-plan-popup-backdrop');
    const popup = $('admin-plan-popup');
    const title = $('admin-plan-popup-title');
    const saveBtn = $('admin-plan-popup-save-btn');

    if (popup) {
        popup.classList.remove('popup-add', 'popup-edit');
        popup.classList.add(mode === 'edit' ? 'popup-edit' : 'popup-add');
    }

    if (title) {
        title.innerHTML = mode === 'edit'
            ? '<i class="fas fa-pen text-yellow-500 mr-2"></i>แก้ไขแผนการใช้งาน'
            : '<i class="fas fa-plus text-emerald-500 mr-2"></i>เพิ่มแผนการใช้งาน';
    }

    if (saveBtn) {
        saveBtn.className = mode === 'edit'
            ? 'flex-1 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black py-3 rounded-xl text-sm shadow-lg shadow-yellow-100'
            : 'flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-sm shadow-lg shadow-emerald-100';
    }

    if (modal) modal.classList.remove('hidden');
};

window.closeAdminPlanPopup = function() {
    $('admin-plan-popup-backdrop')?.classList.add('hidden');
};

window.openAddPlanPanel = function() {
    resetPopupForm();
    window.openAdminPlanPopup('add');
    setTimeout(() => $('plan-sub-name')?.focus(), 80);
};

window.editAdminPlan = async function(id) {
    const plans = await loadPlans();
    const p = plans.find(x => String(x.id) === String(id));
    if (!p) {
        alert('ไม่พบแผนที่ต้องการแก้ไข');
        return;
    }

    fillPopupFromPlan(p);
    window.openAdminPlanPopup('edit');
    setTimeout(() => $('plan-sub-name')?.focus(), 80);
};

function getItemFromForm() {
    const editId = $('plan-sub-edit-id')?.value || '';
    const cycle = $('plan-sub-billing-cycle')?.value || 'monthly';
    return normalizePlan({
        id: editId || `plan_${Date.now()}`,
        name: $('plan-sub-name')?.value || '',
        desc: $('plan-sub-desc')?.value || '',
        price: $('plan-sub-price')?.value || '',
        monthlyPrice: $('plan-sub-monthly-price')?.value || 0,
        yearlyPrice: $('plan-sub-yearly-price')?.value || 0,
        billingCycle: cycle,
        freeForever: cycle === 'forever',
        freeFirstMonth: $('plan-sub-free-first-month')?.checked || false,
        promptpay: $('plan-sub-promptpay')?.value || '',
        courseLimit: $('plan-sub-course-limit')?.value || 0,
        studentLimit: $('plan-sub-student-limit')?.value || 0,
        weekLimit: $('plan-sub-week-limit')?.value || 20,
        teamMemberLimit: $('plan-sub-team-limit')?.value || 1,
        allowTeam: $('plan-sub-allow-team')?.checked || false,
        allowAttendance: $('plan-sub-allow-attendance')?.checked !== false,
        allowExport: $('plan-sub-allow-export')?.checked !== false,
        allowBonus: $('plan-sub-allowBonus') ? $('plan-sub-allowBonus').checked === true : (editId ? undefined : true),
        allowStars: $('plan-sub-allowStars') ? $('plan-sub-allowStars').checked === true : (editId ? undefined : true),
        features: ($('plan-sub-features')?.value || '').split('\n').map(x => x.trim()).filter(Boolean),
        order: $('plan-sub-order')?.value || 1,
        featured: $('plan-sub-featured')?.checked || false,
        active: $('plan-sub-active')?.checked !== false
    });
}

window.saveAdminPlanForm = async function() {
    const name = $('plan-sub-name')?.value.trim() || '';
    if (!name) return alert('กรุณากรอกชื่อแผน');

    const item = getItemFromForm();
    const plans = await loadPlans();
    const nextPlans = plans.filter(p => String(p.id) !== String(item.id));
    nextPlans.push(item);
    nextPlans.sort((a,b) => Number(a.order || 0) - Number(b.order || 0));

    window.subscriptionPlans = nextPlans;

    try {
        if (typeof window.toggleLoader === 'function') window.toggleLoader(true);

        await setDoc(plansRef, { items: nextPlans, updatedAt: Date.now() }, { merge: true });

        localStorage.setItem('schoolhub_subscription_plans', JSON.stringify(nextPlans));
        localStorage.setItem('schoolhub_public_plans', JSON.stringify(nextPlans));

        if (typeof window.renderAdminPlans === 'function') window.renderAdminPlans();
        if (typeof window.renderLandingPlans === 'function') window.renderLandingPlans();

        window.closeAdminPlanPopup();
        resetPopupForm();

        if (typeof showCustomAlert === 'function') {
            showCustomAlert(item.id ? 'อัปเดตแล้ว' : 'บันทึกแล้ว', 'บันทึกแผนเรียบร้อย');
        }
    } catch(e) {
        console.error(e);
        alert('บันทึกขึ้น Firebase ไม่สำเร็จ: ' + (e.message || e));
    } finally {
        if (typeof window.toggleLoader === 'function') window.toggleLoader(false);
    }
};

window.deleteAdminPlan = async function(id) {
    if (!confirm('ต้องการลบแผนนี้ใช่หรือไม่')) return;
    const plans = await loadPlans();
    const nextPlans = plans.filter(p => String(p.id) !== String(id));
    window.subscriptionPlans = nextPlans;

    try {
        await setDoc(plansRef, { items: nextPlans, updatedAt: Date.now() }, { merge: true });
        localStorage.setItem('schoolhub_subscription_plans', JSON.stringify(nextPlans));
        localStorage.setItem('schoolhub_public_plans', JSON.stringify(nextPlans));
        if (typeof window.renderAdminPlans === 'function') window.renderAdminPlans();
        if (typeof window.renderLandingPlans === 'function') window.renderLandingPlans();
    } catch(e) {
        alert('ลบไม่สำเร็จ: ' + (e.message || e));
    }
};

document.addEventListener('click', function(e) {
    const editBtn = e.target.closest('[data-plan-edit]');
    if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        window.editAdminPlan(editBtn.getAttribute('data-plan-edit'));
        return;
    }
    const delBtn = e.target.closest('[data-plan-delete]');
    if (delBtn) {
        e.preventDefault();
        e.stopPropagation();
        window.deleteAdminPlan(delBtn.getAttribute('data-plan-delete'));
        return;
    }
}, true);
