
/* SchoolHub Admin Plans Popup Patch */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const plansPopupConfig = {
    apiKey: "AIzaSyB6u1U_8jNWHd8fUWu6sZ9BAup_u4u-EGg",
    authDomain: "schoolhub-5677d.firebaseapp.com",
    projectId: "schoolhub-5677d",
    storageBucket: "schoolhub-5677d.firebasestorage.app",
    messagingSenderId: "803574136389",
    appId: "1:803574136389:web:e0e5eecfc36dec69d4ed2c",
    measurementId: "G-ME7E38XNX6"
};

const plansPopupApp = getApps().length ? getApp() : initializeApp(plansPopupConfig);
const plansPopupDb = getFirestore(plansPopupApp);
const plansDocRef = doc(plansPopupDb, 'system_settings', 'subscription_plans');
let patchPlans = [];
let plansLiveUnsubscribe = null;

function refreshAllPlanViews() {
    syncGlobalPlans();
    renderPlanCards();
    if (typeof window.renderLandingPlans === 'function') window.renderLandingPlans();
    if (typeof window.renderUserPlans === 'function') window.renderUserPlans();
    if (typeof window.renderAdminPlans === 'function' && window.renderAdminPlans !== refreshAllPlanViews) {
        // ไม่เรียกซ้ำในกรณีที่ renderAdminPlans ถูกชี้กลับมาที่ patch นี้
    }
}

function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
window.escapeHTML = window.escapeHTML || esc;

function jsArg(v) {
    return JSON.stringify(String(v ?? ''));
}

function planDisplay(p) {
    if (!p) return 'ฟรี';
    if (p.freeForever || p.billingCycle === 'forever') return p.price || 'ฟรีตลอด';
    if (p.price) return p.price;
    if (Number(p.monthlyPrice || 0) > 0) return Number(p.monthlyPrice || 0).toLocaleString('th-TH') + ' บาท/เดือน';
    if (Number(p.yearlyPrice || 0) > 0) return Number(p.yearlyPrice || 0).toLocaleString('th-TH') + ' บาท/ปี';
    return 'ฟรี';
}
window.planDisplayPrice = window.planDisplayPrice || planDisplay;

function localDefaultPlans() {
    const now = Date.now();
    return [
        {
            id:'standard', name:'มาตรฐาน', price:'99 บาทต่อเดือน', monthlyPrice:99, yearlyPrice:990,
            billingCycle:'monthly', freeFirstMonth:true, freeForever:false,
            courseLimit:3, studentLimit:120, weekLimit:20,
            allowAttendance:true, allowExport:false, allowTeam:false, teamMemberLimit:1,
            desc:'เหมาะสำหรับครูเริ่มใช้งานรายบุคคล ใช้เช็คชื่อและบันทึกคะแนนได้ครบ',
            features:['เพิ่มรายวิชาได้ 3 วิชา','นักเรียนสูงสุด 120 คน','ใช้งาน 20 สัปดาห์','เช็คชื่อและบันทึกคะแนน','ดูภาพรวมคะแนน','ไม่รองรับ Export Excel'],
            order:1, featured:true, active:true, updatedAt:now
        },
        {
            id:'pro', name:'โปร', price:'199 บาทต่อเดือน', monthlyPrice:199, yearlyPrice:1990,
            billingCycle:'monthly', freeFirstMonth:false, freeForever:false,
            courseLimit:10, studentLimit:0, weekLimit:30,
            allowAttendance:true, allowExport:true, allowTeam:false, teamMemberLimit:1,
            desc:'เหมาะสำหรับครูที่มีหลายรายวิชา ต้องการส่งออก Excel และจัดการข้อมูลมากขึ้น',
            features:['เพิ่มรายวิชาได้ 10 วิชา','นักเรียนไม่จำกัด','ใช้งาน 30 สัปดาห์','เช็คชื่อและบันทึกคะแนน','Export Excel ได้','จัดการแผนคะแนนและเกณฑ์เกรด'],
            order:2, featured:false, active:true, updatedAt:now
        },
        {
            id:'team', name:'ทีม', price:'499 บาทต่อเดือน', monthlyPrice:499, yearlyPrice:4990,
            billingCycle:'monthly', freeFirstMonth:false, freeForever:false,
            courseLimit:0, studentLimit:0, weekLimit:52,
            allowAttendance:true, allowExport:true, allowTeam:true, teamMemberLimit:5,
            desc:'เหมาะสำหรับใช้งานร่วมกันในแผนกหรือทีมครู แชร์สิทธิ์ให้สมาชิกได้',
            features:['เพิ่มรายวิชาไม่จำกัด','นักเรียนไม่จำกัด','ใช้งาน 52 สัปดาห์','ใช้งานแบบทีมได้ 5 คน','เช็คชื่อและ Export ได้ครบ','เหมาะสำหรับแผนก/ทีมครู'],
            order:3, featured:false, active:true, updatedAt:now
        }
    ];
}

function normalizePlan(p) {
    const id = String(p.id || ('plan_' + Date.now()));
    const cycle = p.billingCycle || (p.freeForever ? 'forever' : 'monthly');
    const item = {
        id,
        name: String(p.name || '').trim(),
        price: String(p.price || '').trim(),
        desc: String(p.desc || '').trim(),
        features: Array.isArray(p.features) ? p.features.map(x => String(x).trim()).filter(Boolean) : [],
        monthlyPrice: Number(p.monthlyPrice || 0),
        yearlyPrice: Number(p.yearlyPrice || 0),
        billingCycle: cycle,
        freeForever: cycle === 'forever' || p.freeForever === true,
        freeFirstMonth: !!p.freeFirstMonth,
        courseLimit: Number(p.courseLimit || 0),
        studentLimit: Number(p.studentLimit || 0),
        weekLimit: Math.max(1, Number(p.weekLimit || p.maxWeeks || 20)),
        teamMemberLimit: Math.max(1, Number(p.teamMemberLimit || p.teamLimit || p.maxTeamMembers || 1)),
        allowCourses: p.allowCourses !== false,
        allowStudents: p.allowStudents !== false,
        allowAttendance: p.allowAttendance !== false,
        allowScores: p.allowScores !== false,
        allowPlanScores: p.allowPlanScores !== false,
        allowGradeCriteria: p.allowGradeCriteria !== false,
        allowStudentShare: p.allowStudentShare !== false,
        allowExport: p.allowExport !== false,
        allowTeam: p.allowTeam === true,
        allowEdit: p.allowEdit !== false,
        allowDelete: p.allowDelete !== false,
        allowReports: p.allowReports !== false,
        promptpay: String(p.promptpay || '').trim(),
        order: Number(p.order || 1),
        featured: !!p.featured,
        active: p.active !== false,
        updatedAt: p.updatedAt || Date.now()
    };
    if (!item.price) item.price = planDisplay(item);
    return item;
}

function syncGlobalPlans() {
    patchPlans = patchPlans.map(normalizePlan);
    window.subscriptionPlans = patchPlans;
    try {
        localStorage.setItem('schoolhub_subscription_plans', JSON.stringify(patchPlans));
        localStorage.setItem('schoolhub_public_plans', JSON.stringify(patchPlans));
    } catch(e) {}
}

async function loadPlansFromFirebase() {
    let loaded = [];
    try {
        const snap = await getDoc(plansDocRef);
        if (snap.exists() && Array.isArray((snap.data() || {}).items)) loaded = snap.data().items;
    } catch(e) {
        console.warn('โหลดแผนจาก Firebase ไม่สำเร็จ:', e);
    }

    if (!loaded.length) {
        try {
            const cached1 = JSON.parse(localStorage.getItem('schoolhub_subscription_plans') || '[]');
            const cached2 = JSON.parse(localStorage.getItem('schoolhub_public_plans') || '[]');
            loaded = cached1.length ? cached1 : cached2;
        } catch(e) {}
    }

    patchPlans = loaded.length ? loaded.map(normalizePlan) : localDefaultPlans().map(normalizePlan);
    refreshAllPlanViews();
    return patchPlans;
}

async function saveItemsToFirebase() {
    syncGlobalPlans();
    await setDoc(plansDocRef, { items: patchPlans, updatedAt: Date.now() }, { merge: true });
}

function limitText(p) {
    const courseLimit = Number(p.courseLimit || 0);
    const studentLimit = Number(p.studentLimit || 0);
    const weekLimit = Number(p.weekLimit || p.maxWeeks || 20);
    const teamLimit = Number(p.teamMemberLimit || p.maxTeamMembers || 1);
    return [
        'รายวิชา: ' + (courseLimit === 0 ? 'ไม่จำกัด' : courseLimit + ' วิชา'),
        'นักเรียน: ' + (studentLimit === 0 ? 'ไม่จำกัด' : studentLimit + ' คน'),
        'สัปดาห์: ' + (weekLimit === 0 ? 'ไม่จำกัด' : weekLimit + ' สัปดาห์'),
        'ทีม: ' + teamLimit + ' คน'
    ];
}

function patchTitles() {
    const view = document.getElementById('view-admin-plans');
    if (!view) return;
    const listCard = view.querySelector(':scope > .bg-white.rounded-3xl');
    if (listCard) {
        const h = listCard.querySelector('h3');
        const p = listCard.querySelector('p');
        if (h) h.innerHTML = '<i class="fas fa-layer-group text-emerald-600 mr-2"></i>แผนที่ตั้งไว้';
        if (p) p.textContent = 'แสดงแผนทั้งหมดที่บันทึกไว้ใน /system_settings/subscription_plans > items';
    }
}

function renderPlanCards() {
    const box = document.getElementById('admin-plan-cards');
    const tbody = document.getElementById('admin-plan-list');
    const items = patchPlans.slice().sort((a,b)=>Number(a.order||0)-Number(b.order||0));

    if (box) {
        if (!items.length) {
            box.className = 'p-5';
            box.innerHTML = '<div class="text-center p-10 text-slate-400 border border-dashed rounded-3xl bg-slate-50"><i class="fas fa-layer-group text-4xl mb-3 text-slate-300"></i><div class="font-bold text-slate-500">ยังไม่มีแผนการใช้งาน</div><div class="text-xs mt-1">กดเพิ่มแผนใหม่เพื่อสร้างแผน</div></div>';
        } else {
            box.className = 'p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';
            box.innerHTML = items.map(p => {
                const active = p.active !== false;
                const features = Array.isArray(p.features) ? p.features : [];
                return `
                <div class="schoolhub-plan-card rounded-3xl border ${p.featured ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-100 bg-white'} p-5 shadow-sm relative z-[1]">
                    <div class="flex items-start justify-between gap-3 mb-3">
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h4 class="text-xl font-black text-slate-900">${esc(p.name || '-')}</h4>
                                ${p.featured ? '<span class="text-[10px] font-black bg-primary text-white px-2 py-1 rounded-full">แนะนำ</span>' : ''}
                            </div>
                            <p class="text-xs text-slate-400 mt-1">ID: ${esc(p.id || '')}</p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-bold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${active ? 'แสดง' : 'ซ่อน'}</span>
                    </div>
                    <div class="text-3xl font-black text-primary mb-2">${esc(planDisplay(p))}</div>
                    <p class="text-sm text-slate-500 min-h-[38px]">${esc(p.desc || '')}</p>
                    <div class="grid grid-cols-2 gap-2 my-4">${limitText(p).map(t => `<div class="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 text-xs font-bold text-slate-600">${esc(t)}</div>`).join('')}</div>
                    <div class="space-y-2 mb-5">${features.length ? features.slice(0, 6).map(f => `<div class="flex gap-2 text-sm text-slate-600"><i class="fas fa-check text-emerald-500 mt-1"></i><span>${esc(f)}</span></div>`).join('') : '<div class="text-sm text-slate-400">ยังไม่มีรายการสิทธิ์</div>'}</div>
                    <div class="flex gap-2 relative z-[5]">
                        <button type="button" data-plan-edit="${esc(p.id)}" class="plan-edit-btn flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-100 px-4 py-2.5 rounded-2xl text-sm font-black"><i class="fas fa-pen mr-1"></i> แก้ไข</button>
                        <button type="button" data-plan-delete="${esc(p.id)}" class="plan-delete-btn flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 px-4 py-2.5 rounded-2xl text-sm font-black"><i class="fas fa-trash mr-1"></i> ลบ</button>
                    </div>
                </div>`;
            }).join('');
        }
    }

    if (tbody) tbody.innerHTML = items.length ? items.map(p => `<tr><td>${esc(p.name || '')}</td><td>${esc(planDisplay(p))}</td><td>${limitText(p).map(esc).join('<br>')}</td><td>${p.active !== false ? 'แสดง' : 'ซ่อน'}</td><td><button type="button" data-plan-edit="${esc(p.id)}">แก้ไข</button><button type="button" data-plan-delete="${esc(p.id)}">ลบ</button></td></tr>`).join('') : '<tr><td colspan="5" class="text-center p-8 text-slate-400">ยังไม่มีแผนการใช้งาน</td></tr>';
}

function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v ?? '';
}
function setCheck(id, v) {
    const el = document.getElementById(id);
    if (el) el.checked = !!v;
}

window.resetAdminPlanForm = function(){
    ['plan-sub-edit-id','plan-sub-name','plan-sub-price','plan-sub-promptpay','plan-sub-desc','plan-sub-features','plan-sub-monthly-price','plan-sub-yearly-price'].forEach(id => setVal(id, ''));
    setVal('plan-sub-order','1'); setVal('plan-sub-course-limit','1'); setVal('plan-sub-week-limit','20'); setVal('plan-sub-student-limit','0'); setVal('plan-sub-team-limit','1'); setVal('plan-sub-billing-cycle','monthly');
    setCheck('plan-sub-featured', false); setCheck('plan-sub-active', true); setCheck('plan-sub-free-first-month', false); setCheck('plan-sub-allow-attendance', true); setCheck('plan-sub-allow-export', true); setCheck('plan-sub-allow-team', false);
};

window.openAdminPlanPopup = function(mode = 'add') {
    const modal = document.getElementById('admin-plan-popup-backdrop');
    const popup = document.getElementById('admin-plan-popup');
    const title = document.getElementById('admin-plan-popup-title');
    const saveBtn = document.getElementById('admin-plan-popup-save-btn');

    if (popup) {
        popup.classList.remove('popup-add', 'popup-edit');
        popup.classList.add(mode === 'edit' ? 'popup-edit' : 'popup-add');
    }

    if (title) title.innerHTML = mode === 'edit'
        ? '<i class="fas fa-pen text-yellow-500 mr-2"></i>แก้ไขแผนการใช้งาน'
        : '<i class="fas fa-plus text-emerald-500 mr-2"></i>เพิ่มแผนการใช้งาน';

    if (saveBtn) {
        saveBtn.className = mode === 'edit'
            ? 'flex-1 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black py-3 rounded-xl text-sm shadow-lg shadow-yellow-100'
            : 'flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-sm shadow-lg shadow-emerald-100';
    }

    if (modal) modal.classList.remove('hidden');
};

window.closeAdminPlanPopup = function() {
    document.getElementById('admin-plan-popup-backdrop')?.classList.add('hidden');
};

window.openAddPlanPanel = function(){
    window.resetAdminPlanForm();
    window.openAdminPlanPopup('add');
    setTimeout(() => document.getElementById('plan-sub-name')?.focus(), 100);
};

window.closePlanEditPanel = function(){
    window.closeAdminPlanPopup();
    window.resetAdminPlanForm();
};

window.editAdminPlan = function(id){
    const p = patchPlans.find(x => String(x.id) === String(id));
    if (!p) return alert('ไม่พบแผนที่ต้องการแก้ไข');

    setVal('plan-sub-edit-id', p.id); setVal('plan-sub-name', p.name || ''); setVal('plan-sub-price', p.price || planDisplay(p)); setVal('plan-sub-promptpay', p.promptpay || ''); setVal('plan-sub-desc', p.desc || ''); setVal('plan-sub-features', (p.features || []).join('\n'));
    setVal('plan-sub-order', Number(p.order || 1)); setVal('plan-sub-course-limit', Number(p.courseLimit || 0)); setVal('plan-sub-week-limit', Number(p.weekLimit || p.maxWeeks || 20)); setVal('plan-sub-student-limit', Number(p.studentLimit || 0)); setVal('plan-sub-team-limit', Math.max(1, Number(p.teamMemberLimit || p.maxTeamMembers || 1)));
    setVal('plan-sub-monthly-price', Number(p.monthlyPrice || 0)); setVal('plan-sub-yearly-price', Number(p.yearlyPrice || 0)); setVal('plan-sub-billing-cycle', p.freeForever ? 'forever' : (p.billingCycle || 'monthly'));
    setCheck('plan-sub-featured', p.featured); setCheck('plan-sub-active', p.active !== false); setCheck('plan-sub-free-first-month', p.freeFirstMonth); setCheck('plan-sub-allow-attendance', p.allowAttendance !== false); setCheck('plan-sub-allow-export', p.allowExport !== false); setCheck('plan-sub-allow-team', !!p.allowTeam);

    window.openAdminPlanPopup('edit');
};

window.saveAdminPlanForm = async function(){
    const name = document.getElementById('plan-sub-name')?.value.trim() || '';
    if (!name) return alert('กรุณากรอกชื่อแผน');

    const editId = document.getElementById('plan-sub-edit-id')?.value || '';
    const cycle = document.getElementById('plan-sub-billing-cycle')?.value || 'monthly';

    const item = normalizePlan({
        id: editId || `plan_${Date.now()}`,
        name,
        monthlyPrice: Number(document.getElementById('plan-sub-monthly-price')?.value || 0),
        yearlyPrice: Number(document.getElementById('plan-sub-yearly-price')?.value || 0),
        billingCycle: cycle, freeForever: cycle === 'forever',
        freeFirstMonth: document.getElementById('plan-sub-free-first-month')?.checked || false,
        courseLimit: Number(document.getElementById('plan-sub-course-limit')?.value || 0),
        weekLimit: Math.max(1, Number(document.getElementById('plan-sub-week-limit')?.value || 20)),
        studentLimit: Number(document.getElementById('plan-sub-student-limit')?.value || 0),
        allowTeam: document.getElementById('plan-sub-allow-team')?.checked || false,
        teamMemberLimit: Math.max(1, Number(document.getElementById('plan-sub-team-limit')?.value || 1)),
        allowCourses: document.getElementById('plan-sub-allowCourses')?.checked !== false,
        allowStudents: document.getElementById('plan-sub-allowStudents')?.checked !== false,
        allowAttendance: document.getElementById('plan-sub-allowAttendance')?.checked ?? (document.getElementById('plan-sub-allow-attendance')?.checked !== false),
        allowScores: document.getElementById('plan-sub-allowScores')?.checked !== false,
        allowPlanScores: document.getElementById('plan-sub-allowPlanScores')?.checked !== false,
        allowGradeCriteria: document.getElementById('plan-sub-allowGradeCriteria')?.checked !== false,
        allowStudentShare: document.getElementById('plan-sub-allowStudentShare')?.checked !== false,
        allowExport: document.getElementById('plan-sub-allowExport')?.checked ?? (document.getElementById('plan-sub-allow-export')?.checked !== false),
        allowEdit: document.getElementById('plan-sub-allowEdit')?.checked !== false,
        allowDelete: document.getElementById('plan-sub-allowDelete')?.checked !== false,
        allowReports: document.getElementById('plan-sub-allowReports')?.checked !== false,
        price: document.getElementById('plan-sub-price')?.value.trim() || '',
        promptpay: document.getElementById('plan-sub-promptpay')?.value.trim() || '',
        desc: document.getElementById('plan-sub-desc')?.value.trim() || '',
        features: (document.getElementById('plan-sub-features')?.value || '').split('\n').map(x=>x.trim()).filter(Boolean),
        order: Number(document.getElementById('plan-sub-order')?.value || 1),
        featured: document.getElementById('plan-sub-featured')?.checked || false,
        active: document.getElementById('plan-sub-active')?.checked !== false,
        updatedAt: Date.now()
    });

    patchPlans = patchPlans.filter(p => String(p.id) !== String(item.id));
    patchPlans.push(item);
    syncGlobalPlans();
    renderPlanCards();

    try {
        if (typeof window.toggleLoader === 'function') window.toggleLoader(true);
        await saveItemsToFirebase();
        await loadPlansFromFirebase();
        refreshAllPlanViews();
        window.closeAdminPlanPopup();
        window.resetAdminPlanForm();
        if (typeof showCustomAlert === 'function') showCustomAlert('บันทึกแล้ว', 'บันทึกแผนลง /system_settings/subscription_plans > items เรียบร้อย');
    } catch(e) {
        console.error(e);
        alert('บันทึกขึ้น Firebase ไม่สำเร็จ: ' + (e.message || e));
    } finally {
        if (typeof window.toggleLoader === 'function') window.toggleLoader(false);
    }
};

window.deleteAdminPlan = async function(id){
    if (!confirm('ต้องการลบแผนนี้ใช่หรือไม่')) return;
    patchPlans = patchPlans.filter(p => String(p.id) !== String(id));
    syncGlobalPlans();
    renderPlanCards();
    try {
        await saveItemsToFirebase();
        await loadPlansFromFirebase();
        refreshAllPlanViews();
    } catch(e) {
        alert('ลบในหน้านี้แล้ว แต่บันทึกขึ้น Firebase ไม่สำเร็จ: ' + (e.message || e));
    }
};

window.seedDefaultPlans = async function(){
    patchPlans = localDefaultPlans().map(normalizePlan);
    syncGlobalPlans();
    renderPlanCards();
    try {
        await saveItemsToFirebase();
        if (typeof window.renderLandingPlans === 'function') window.renderLandingPlans();
        if (typeof showCustomAlert === 'function') showCustomAlert('สำเร็จ', 'สร้างแผนตัวอย่าง 3 แบบ (มาตรฐาน / โปร / ทีม) ลง /system_settings/subscription_plans แล้ว');
    } catch(e) {
        alert('สร้างตัวอย่างแล้ว แต่บันทึกขึ้น Firebase ไม่สำเร็จ: ' + (e.message || e));
    }
};

window.renderAdminPlans = function(){ patchTitles(); renderPlanCards(); };
window.__schoolhubAdminPlansReload = async function(){ patchTitles(); await loadPlansFromFirebase(); };

function startPlansLiveUpdate() {
    if (plansLiveUnsubscribe) return;
    try {
        plansLiveUnsubscribe = onSnapshot(plansDocRef, (snap) => {
            if (snap.exists() && Array.isArray((snap.data() || {}).items)) {
                patchPlans = snap.data().items.map(normalizePlan);
                refreshAllPlanViews();
            }
        }, (err) => console.warn('plans live update failed:', err));
    } catch (e) {
        console.warn('cannot start plans live update:', e);
    }
}

document.addEventListener('click', function(e){
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

const oldSwitchView = window.switchView;
if (typeof oldSwitchView === 'function' && !oldSwitchView.__plansPopupWrapped) {
    const wrapped = function(viewId) {
        const result = oldSwitchView.apply(this, arguments);
        if (viewId === 'admin-plans') setTimeout(() => { patchTitles(); startPlansLiveUpdate(); loadPlansFromFirebase(); }, 80);
        return result;
    };
    wrapped.__plansPopupWrapped = true;
    window.switchView = wrapped;
}

document.addEventListener('DOMContentLoaded', () => {
    startPlansLiveUpdate();
    setTimeout(() => { patchTitles(); loadPlansFromFirebase(); }, 300);
    setTimeout(() => { patchTitles(); loadPlansFromFirebase(); }, 1500);
});
