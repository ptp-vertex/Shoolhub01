
(function(){
'use strict';

/* ── รอ Firebase + Auth พร้อมจากโมดูลหลัก ── */
function waitReady(cb){
    if(window.__shDB && window.__shDoc && window.__shGetCurrentUser &&
       window.__shGetCurrentUser() !== undefined)
        return cb();
    setTimeout(()=>waitReady(cb), 300);
}

/* ── Firestore helpers ── */
function db(){ return window.__shDB; }
function fsDoc(...a){ return window.__shDoc(db(),...a); }
function fsSetDoc(ref,data,opts){ return opts ? window.__shSetDoc(ref,data,opts) : window.__shSetDoc(ref,data); }
function fsGetDoc(ref){ return window.__shGetDoc(ref); }
function fsGetDocs(ref){ return window.__shGetDocs(ref); }
function fsCol(...a){ return window.__shCollection(db(),...a); }
function getIsAdmin(){ return !!(window.isAdmin || window.__shGetIsAdmin?.()); }
function getCurrentUser(){ return window.__shGetCurrentUser?.() || null; }
function getUK(){
    const u=getCurrentUser();
    if(!u) return '';
    if(window.getUserKey) return window.getUserKey(u);
    return (u.email||u.uid||'').toLowerCase();
}

const CTRL_REF  = ()=>fsDoc('admin_settings','import_excel_control');
const LOG_COL   = ()=>fsCol('admin_import_usage_log');
const LOG_DOC   = id=>fsDoc('admin_import_usage_log',id);

/* ══════════════════════════════════════════
   ACCESS CHECK (รองรับ global + per-user + schedule + per-user schedule)
   ══════════════════════════════════════════ */
async function checkImportAccess(){
    try{
        if(getIsAdmin()) return false; /* แอดมินไม่แสดงเมนู Import ใน sidebar */
        const snap = await fsGetDoc(CTRL_REF());
        if(!snap.exists()) return false;
        const d = snap.data()||{};
        const uk = getUK();
        const now = Date.now();

        /* per-user override (with optional schedule) */
        const ug = d.userGrants||{};
        if(uk && uk in ug){
            const grant = ug[uk];
            if(typeof grant === 'boolean') return grant;
            if(typeof grant === 'object' && grant !== null){
                /* per-user schedule */
                const uOpen  = grant.scheduleOpen  ? new Date(grant.scheduleOpen).getTime()  : null;
                const uClose = grant.scheduleClose ? new Date(grant.scheduleClose).getTime() : null;
                if(uOpen  && now < uOpen)  return false;
                if(uClose && now > uClose) return false;
                return grant.enabled !== false;
            }
        }

        /* global schedule */
        const openAt  = d.scheduleOpen  ? new Date(d.scheduleOpen).getTime()  : null;
        const closeAt = d.scheduleClose ? new Date(d.scheduleClose).getTime() : null;
        if(openAt  && now < openAt)  return false;
        if(closeAt && now > closeAt) return false;

        return !!d.globalEnabled;
    }catch(e){ console.warn('checkImportAccess error',e); return false; }
}

async function refreshImportNavBtn(){
    const allowed = await checkImportAccess();
    ['nav-import-excel','mobile-nav-import-excel'].forEach(id=>{
        const el=document.getElementById(id);
        if(el) el.classList.toggle('hidden',!allowed);
    });
    updateCountdownBanner();
}
window.refreshImportNavBtn = refreshImportNavBtn;

/* ══════════════════════════════════════════
   COUNTDOWN (global + per-user)
   ══════════════════════════════════════════ */
let _cdTimer=null;
async function updateCountdownBanner(){
    if(_cdTimer){ clearInterval(_cdTimer); _cdTimer=null; }
    try{
        const snap=await fsGetDoc(CTRL_REF());
        if(!snap.exists()) return;
        const d=snap.data()||{};
        const uk=getUK();

        /* หา schedule ที่ใช้ (per-user ก่อน ถ้าไม่มีใช้ global) */
        let openAt=null, closeAt=null, sourceLabel='';
        const ug=d.userGrants||{};
        if(uk && uk in ug && typeof ug[uk]==='object' && ug[uk]!==null){
            const g=ug[uk];
            openAt  = g.scheduleOpen  ? new Date(g.scheduleOpen).getTime()  : null;
            closeAt = g.scheduleClose ? new Date(g.scheduleClose).getTime() : null;
            sourceLabel='(รายบุคคล)';
        } else {
            openAt  = d.scheduleOpen  ? new Date(d.scheduleOpen).getTime()  : null;
            closeAt = d.scheduleClose ? new Date(d.scheduleClose).getTime() : null;
        }
        if(!openAt && !closeAt) return;

        function pad(n){return String(n).padStart(2,'0');}
        function fmt(ms){
            if(ms<=0) return '00:00:00';
            const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60),dy=Math.floor(h/24);
            if(dy>0) return dy+'วัน '+pad(h%24)+':'+pad(m%60)+':'+pad(s%60);
            return pad(h)+':'+pad(m%60)+':'+pad(s%60);
        }

        function tick(){
            const n=Date.now(); let msg='',amsg='';
            if(openAt && n<openAt){
                msg ='⏳ จะเปิดในอีก '+fmt(openAt-n)+' '+sourceLabel;
                amsg='🟡 จะเปิดอัตโนมัติในอีก '+fmt(openAt-n)+' '+sourceLabel;
            } else if(closeAt && n<closeAt){
                msg ='⏰ จะปิดในอีก '+fmt(closeAt-n)+' '+sourceLabel;
                amsg='🟢 เปิดอยู่ — จะปิดอัตโนมัติในอีก '+fmt(closeAt-n)+' '+sourceLabel;
            } else if(closeAt && n>closeAt){
                amsg='🔴 ปิดแล้ว (เลยกำหนดเวลา) '+sourceLabel;
                /* auto-flip toggle ถ้ายังเปิดอยู่ */
                if(_ctrl.globalEnabled){ _ctrl.globalEnabled=false; renderAdminCtrl(); }
                refreshImportNavBtn();
            }
            ['import-countdown-banner'].forEach(id=>{ const el=document.getElementById(id); if(el){ if(msg){el.textContent=msg;el.classList.remove('hidden');}else el.classList.add('hidden'); } });
            ['admin-import-countdown'].forEach(id=>{ const el=document.getElementById(id); if(el){ if(amsg){el.textContent=amsg;el.classList.remove('hidden');}else el.classList.add('hidden'); } });
        }
        tick(); _cdTimer=setInterval(tick,1000);
    }catch(e){}
}

/* ══════════════════════════════════════════
   OPEN IMPORT VIEW
   ══════════════════════════════════════════ */
window.openImportExcel=function(){
    if(typeof window.switchView==='function') window.switchView('import-excel');
    try{ document.getElementById('page-title').textContent='นำเข้าข้อมูล Excel'; }catch(e){}
    try{ document.getElementById('page-subtitle').textContent='อัพโหลดไฟล์เช็คชื่อ / ภาพรวม เพื่อเพิ่มข้อมูลอัตโนมัติ'; }catch(e){}
    try{ document.getElementById('header-actions').innerHTML=''; }catch(e){}
    renderImportLog();
    updateCountdownBanner();
};

/* ══════════════════════════════════════════
   FILE QUEUE
   ══════════════════════════════════════════ */
let importQueue=[];

window.handleImportDrop=function(e){
    e.preventDefault();
    document.getElementById('import-dropzone')?.classList.remove('bg-emerald-50');
    handleImportFiles(e.dataTransfer.files);
};
window.handleImportFiles=function(files){
    Array.from(files).forEach(f=>{
        if(!f.name.endsWith('.xlsx')) return;
        if(importQueue.find(q=>q.name===f.name)) return;
        importQueue.push({file:f,name:f.name,status:'pending'});
    });
    renderQueue();
};
window.removeImportItem=function(i){ importQueue.splice(i,1); renderQueue(); };
window.clearImportQueue=function(){
    importQueue=[];
    renderQueue();
    const rb=document.getElementById('import-result-box');
    if(rb){rb.classList.add('hidden');rb.innerHTML='';}
};

const SL={pending:'รอ',loading:'กำลังนำเข้า…',done:'สำเร็จ',error:'ผิดพลาด'};
const SC={pending:'bg-slate-200 text-slate-500',loading:'bg-amber-100 text-amber-700',done:'bg-emerald-100 text-emerald-700',error:'bg-rose-100 text-rose-700'};

function renderQueue(){
    const box=document.getElementById('import-file-list');
    const startBtn=document.getElementById('import-start-btn');
    const clearBtn=document.getElementById('import-clear-btn');
    if(!box) return;
    if(!importQueue.length){ box.classList.add('hidden'); startBtn?.classList.add('hidden'); clearBtn?.classList.add('hidden'); return; }
    box.classList.remove('hidden'); startBtn?.classList.remove('hidden'); clearBtn?.classList.remove('hidden');
    box.innerHTML=importQueue.map((q,i)=>`
        <div class="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
            <div class="flex items-center gap-3 min-w-0"><i class="fas fa-file-excel text-emerald-500 flex-shrink-0"></i>
                <span class="text-sm font-medium text-slate-700 truncate">${q.name}</span></div>
            <div class="flex items-center gap-2 flex-shrink-0 ml-3">
                <span class="text-xs font-bold px-2 py-0.5 rounded-full ${SC[q.status]||''}">${SL[q.status]||q.status}</span>
                ${q.status==='pending'?`<button onclick="removeImportItem(${i})" class="text-slate-400 hover:text-rose-500"><i class="fas fa-times"></i></button>`:''}
            </div>
        </div>
        ${q.msg?`<p class="text-xs pl-4 font-medium ${q.status==='error'?'text-rose-500':'text-emerald-600'}">${q.msg}</p>`:''}
    `).join('');
}

/* ══════════════════════════════════════════
   PARSE & IMPORT
   ══════════════════════════════════════════ */
async function loadXLSX(){
    if(window.XLSX) return;
    await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
        s.onload=res; s.onerror=rej; document.head.appendChild(s);
    });
}

function parseAttendance(wb){
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
    return{type:'attendance',
        courseName:String(rows[0]?.[0]||'').replace('รายงานเช็คชื่อ: ','').trim(),
        roomName:  String(rows[1]?.[0]||'').replace('ห้อง: ','').trim(),
        dateCols:  (rows[4]||[]).slice(4),
        dataRows:  rows.slice(5).filter(r=>r&&r[1])};
}
function parseOverview(wb){
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
    return{type:'overview',
        courseName:String(rows[0]?.[0]||'').replace('สรุปภาพรวมวิชา: ','').trim(),
        roomName:  String(rows[1]?.[0]||'').replace('ห้อง: ','').trim(),
        headerRow: rows[3]||[],
        dataRows:  rows.slice(4).filter(r=>r&&r[1])};
}

function ensureCourse(name,room){
    if(!window.state.courses) window.state.courses=[];
    let c=window.state.courses.find(x=>x.name===name);
    if(!c){ c={id:'ci_'+Date.now()+'_'+Math.random().toString(36).slice(2),name,studentGrades:[room]}; window.state.courses.push(c); }
    return String(c.id);
}
function ensureStudent(code,name,room){
    if(!window.state.students) window.state.students=[];
    if(window.state.students.find(s=>s.code===code)) return false;
    window.state.students.push({id:'si_'+Date.now()+'_'+Math.random().toString(36).slice(2),code,name,className:room});
    return true;
}

function doImportAttendance(p){
    const cid=ensureCourse(p.courseName,p.roomName);
    if(!window.state.attendance) window.state.attendance={};
    if(!window.state.attendance[cid]) window.state.attendance[cid]={};
    let added=0,updated=0;
    p.dataRows.forEach(row=>{
        const code=String(row[1]||'').trim(),name=String(row[2]||'').trim(),room=String(row[3]||'').trim();
        if(!code) return;
        if(ensureStudent(code,name,room)) added++;
        p.dateCols.forEach((dk,di)=>{
            if(!dk) return;
            const val=String(row[4+di]||'').trim(); if(!val) return;
            const k=String(dk).trim();
            if(!window.state.attendance[cid][k]) window.state.attendance[cid][k]={};
            window.state.attendance[cid][k][code]=val; updated++;
        });
    });
    return{added,updated};
}
function doImportOverview(p){
    const cid=ensureCourse(p.courseName,p.roomName);
    if(!window.state.coursePlans) window.state.coursePlans={};
    if(!window.state.coursePlans[cid]) window.state.coursePlans[cid]=[];
    if(!window.state.scores) window.state.scores=[];
    const scoreCols=p.headerRow.slice(7,p.headerRow.length-2);
    scoreCols.forEach(h=>{
        if(!h) return;
        const hs=String(h).trim();
        if(!hs||hs==='รวมคะแนน(เต็ม 100)'||hs==='เกรด') return;
        if(!window.state.coursePlans[cid].find(x=>x.name===hs)){
            const m=hs.match(/เต็ม\s*([\d.]+)/);
            window.state.coursePlans[cid].push({id:'pi_'+Date.now()+'_'+Math.random().toString(36).slice(2),name:hs,maxScore:m?parseFloat(m[1]):10});
        }
    });
    let added=0,updated=0;
    p.dataRows.forEach(row=>{
        const code=String(row[1]||'').trim(),name=String(row[2]||'').trim(),room=String(row[3]||'').trim();
        if(!code) return;
        if(ensureStudent(code,name,room)) added++;
        scoreCols.forEach((h,di)=>{
            if(!h) return; const hs=String(h).trim(); if(!hs) return;
            const plan=window.state.coursePlans[cid].find(x=>x.name===hs); if(!plan) return;
            const raw=row[7+di];
            if(raw===null||raw===undefined||raw==='') return;
            const vs=String(raw).trim();
            if(vs==='-'||vs.includes('ขาดส่ง')) return;
            const num=parseFloat(vs); if(isNaN(num)) return;
            const ex=window.state.scores.find(s=>s.courseId===cid&&s.planId===plan.id&&s.studentCode===code);
            if(ex) ex.score=num; else window.state.scores.push({id:'sci_'+Date.now()+'_'+Math.random().toString(36).slice(2),courseId:cid,planId:plan.id,studentCode:code,score:num});
            updated++;
        });
    });
    return{added,updated};
}

async function logUsage(summary){
    try{
        const uk=getUK();
        const id=uk.replace(/[^a-z0-9]/gi,'_')+'_'+Date.now();
        await fsSetDoc(LOG_DOC(id),{userKey:uk,email:getCurrentUser()?.email||uk,timestamp:Date.now(),files:importQueue.filter(q=>q.status==='done').map(q=>q.name),results:summary});
    }catch(e){console.warn('import log write failed',e);}
}

window.startImportExcel=async function(){
    const pending=importQueue.filter(q=>q.status==='pending');
    if(!pending.length) return;
    await loadXLSX();
    const rb=document.getElementById('import-result-box');
    if(rb) rb.classList.add('hidden');
    const summary=[];
    for(let i=0;i<importQueue.length;i++){
        const item=importQueue[i];
        if(item.status!=='pending') continue;
        item.status='loading'; renderQueue();
        try{
            const buf=await item.file.arrayBuffer();
            const wb=window.XLSX.read(buf,{type:'array'});
            const rows=window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:null});
            const first=String(rows[0]?.[0]||'').trim();
            let res;
            if(first.startsWith('รายงานเช็คชื่อ')){ res=doImportAttendance(parseAttendance(wb)); item.msg=`เช็คชื่อ: นักเรียนใหม่ ${res.added} คน, เช็คชื่อ ${res.updated} รายการ`; }
            else if(first.startsWith('สรุปภาพรวมวิชา')){ res=doImportOverview(parseOverview(wb)); item.msg=`ภาพรวม: นักเรียนใหม่ ${res.added} คน, คะแนน ${res.updated} รายการ`; }
            else throw new Error('ไม่รู้จักรูปแบบ: "'+first.slice(0,40)+'"');
            item.status='done';
            summary.push({file:item.name,...res,ok:true,msg:item.msg});
        }catch(e){
            item.status='error'; item.msg='Error: '+(e.message||e);
            summary.push({file:item.name,ok:false,msg:item.msg});
        }
        renderQueue();
    }
    try{
        if(typeof window.saveStateToDB==='function') await window.saveStateToDB();
        if(typeof window.updateGlobalViews==='function') window.updateGlobalViews();
        if(typeof window.renderStudentsMaster==='function') window.renderStudentsMaster();
    }catch(e){console.warn('save after import failed',e);}
    await logUsage(summary);
    try{
        const lk='shi_log_'+getUK();
        const ex=JSON.parse(localStorage.getItem(lk)||'[]');
        ex.unshift({ts:Date.now(),files:summary.map(s=>s.file),summary});
        localStorage.setItem(lk,JSON.stringify(ex.slice(0,50)));
    }catch(e){}
    if(rb){
        const ok=summary.filter(s=>s.ok).length,fail=summary.filter(s=>!s.ok).length;
        rb.innerHTML=`<div class="rounded-2xl p-4 border ${ok?'bg-emerald-50 border-emerald-200':'bg-rose-50 border-rose-200'}">
            <p class="font-black text-lg ${ok?'text-emerald-700':'text-rose-700'} mb-2"><i class="fas ${ok?'fa-check-circle':'fa-times-circle'} mr-2"></i>นำเข้าเสร็จสิ้น</p>
            <ul class="space-y-1">${summary.map(s=>`<li class="text-sm ${s.ok?'text-emerald-700':'text-rose-600'}"><i class="fas ${s.ok?'fa-check':'fa-times'} mr-1"></i>${s.file}: ${s.msg}</li>`).join('')}</ul>
        </div>`;
        rb.classList.remove('hidden');
    }
    renderImportLog();
};

function renderImportLog(){
    const box=document.getElementById('import-log-list'); if(!box) return;
    let logs=[];
    try{logs=JSON.parse(localStorage.getItem('shi_log_'+getUK())||'[]');}catch(e){}
    if(!logs.length){box.innerHTML='<p class="text-slate-400 text-sm text-center py-4">ยังไม่มีประวัติ</p>';return;}
    box.innerHTML=logs.map(l=>{
        const d=new Date(l.ts);
        return `<div class="bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
            <div class="flex items-center justify-between"><span class="text-xs text-slate-400">${d.toLocaleDateString('th-TH')} ${d.toLocaleTimeString('th-TH')}</span><span class="text-xs font-bold text-slate-500">${l.files?.length||0} ไฟล์</span></div>
            <ul class="mt-1">${(l.summary||[]).map(s=>`<li class="text-xs ${s.ok?'text-emerald-600':'text-rose-500'}"><i class="fas ${s.ok?'fa-check':'fa-times'} mr-1"></i>${s.file}</li>`).join('')}</ul>
        </div>`;
    }).join('');
}
window.clearImportLog=function(){localStorage.removeItem('shi_log_'+getUK());renderImportLog();};

/* ══════════════════════════════════════════
   ADMIN CONTROL
   ══════════════════════════════════════════ */
let _ctrl={};

window.adminLoadImportControl=async function(){
    try{
        const snap=await fsGetDoc(CTRL_REF());
        _ctrl=snap.exists()?(snap.data()||{}):{};
    }catch(e){_ctrl={};}
    renderAdminCtrl();
    adminRefreshImportUsageLog();
    updateCountdownBanner();
    /* preload user list */
    _emailsLoaded=false;
    loadAllUserEmails().catch(()=>{});
};

function renderAdminCtrl(){
    const btn=document.getElementById('import-global-toggle-btn');
    const dot=document.getElementById('import-global-toggle-dot');
    const on=!!_ctrl.globalEnabled;
    if(btn) btn.style.background=on?'#0d9488':'#cbd5e1';
    if(dot) dot.style.transform=on?'translateX(24px)':'translateX(0)';
    const inO=document.getElementById('import-schedule-open');
    const inC=document.getElementById('import-schedule-close');
    if(inO) inO.value=_ctrl.scheduleOpen||'';
    if(inC) inC.value=_ctrl.scheduleClose||'';
    renderGrants();
}

async function saveCtrl(){
    try{
        await fsSetDoc(CTRL_REF(),Object.assign({},_ctrl,{updatedAt:Date.now()}),{merge:true});
    }catch(e){
        window.showCustomAlert?.('บันทึกไม่ได้',e.message||String(e),true);
    }
}

window.adminToggleImportGlobal=async function(){
    _ctrl.globalEnabled=!_ctrl.globalEnabled;
    /* ถ้าปิด ให้ล้าง schedule ด้วย */
    renderAdminCtrl();
    await saveCtrl();
    refreshImportNavBtn();
};

window.adminSaveImportSchedule=async function(){
    const ov=document.getElementById('import-schedule-open')?.value||'';
    const cv=document.getElementById('import-schedule-close')?.value||'';
    if(ov&&cv&&new Date(ov)>=new Date(cv)){
        window.showCustomAlert?.('ผิดพลาด','เวลาเปิดต้องก่อนเวลาปิด',true); return;
    }
    _ctrl.scheduleOpen=ov||null;
    _ctrl.scheduleClose=cv||null;
    /* ถ้าตั้ง schedule ให้ sync สถานะ global ตามเวลาปัจจุบัน */
    if(ov||cv){
        const now=Date.now();
        const openAt=ov?new Date(ov).getTime():null;
        const closeAt=cv?new Date(cv).getTime():null;
        if(openAt && now<openAt) _ctrl.globalEnabled=false;
        else if(closeAt && now>closeAt) _ctrl.globalEnabled=false;
        else if(openAt && now>=openAt) _ctrl.globalEnabled=true;
    }
    renderAdminCtrl();
    await saveCtrl();
    updateCountdownBanner();
    refreshImportNavBtn();
    window.showCustomAlert?.('บันทึกแล้ว','ตารางเวลาบันทึกเรียบร้อย');
};

window.adminClearImportSchedule=async function(){
    _ctrl.scheduleOpen=null; _ctrl.scheduleClose=null;
    const inO=document.getElementById('import-schedule-open'); if(inO) inO.value='';
    const inC=document.getElementById('import-schedule-close'); if(inC) inC.value='';
    if(_cdTimer){clearInterval(_cdTimer);_cdTimer=null;}
    ['import-countdown-banner','admin-import-countdown'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.add('hidden');});
    await saveCtrl();
    window.showCustomAlert?.('ล้างแล้ว','ล้างตารางเวลาเรียบร้อย');
};

/* ── Per-user with schedule ── */
let _cachedEmails=[],_emailsLoaded=false;

async function loadAllUserEmails(){
    if(_emailsLoaded) return _cachedEmails;
    try{
        const snap=await fsGetDocs(fsCol('public_users_directory'));
        const emails=new Set();
        snap.forEach(d=>{
            const data=d.data()||{};
            if(d.id.includes('@')) emails.add(d.id.toLowerCase());
            if(data.email?.includes('@')) emails.add(data.email.toLowerCase());
        });
        /* กรอง admin ออก */
        const adminEmail=(getCurrentUser()?.email||'').toLowerCase();
        emails.delete(adminEmail);
        emails.delete('admin');
        _cachedEmails=[...emails].sort();
        _emailsLoaded=true;
    }catch(e){console.warn('loadAllUserEmails failed',e);_cachedEmails=[];}
    return _cachedEmails;
}

window.adminShowEmailDropdown=async function(){
    const input=document.getElementById('import-user-email-input');
    const dd=document.getElementById('import-email-dropdown');
    if(!dd) return;
    dd.innerHTML='<p class="text-xs text-slate-400 text-center py-3"><i class="fas fa-spinner fa-spin mr-1"></i>กำลังโหลด…</p>';
    dd.classList.remove('hidden');
    await loadAllUserEmails();
    filterEmailDropdown(input?.value||'');
};

window.adminHideEmailDropdown=function(){
    setTimeout(()=>{
        const dd=document.getElementById('import-email-dropdown');
        if(dd) dd.classList.add('hidden');
    },200);
};

window.adminFilterEmailDropdown=async function(){
    if(!_emailsLoaded) await loadAllUserEmails();
    const input=document.getElementById('import-user-email-input');
    filterEmailDropdown(input?.value||'');
};

function filterEmailDropdown(q){
    const dd=document.getElementById('import-email-dropdown');
    if(!dd) return;
    const term=q.toLowerCase().trim();
    const filtered=term?_cachedEmails.filter(e=>e.includes(term)):_cachedEmails;
    if(!filtered.length){dd.classList.add('hidden');return;}
    dd.innerHTML=filtered.slice(0,8).map(e=>`
        <button type="button" onclick="adminSelectEmail('${e}')"
            class="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors">
            <i class="fas fa-user-circle text-slate-300 flex-shrink-0 text-base"></i>
            <span class="truncate">${e}</span>
        </button>`).join('');
    dd.classList.remove('hidden');
}

window.adminSelectEmail=function(email){
    const input=document.getElementById('import-user-email-input');
    if(input) input.value=email;
    const dd=document.getElementById('import-email-dropdown');
    if(dd) dd.classList.add('hidden');
};

/* ── Per-user grant panel ── */
let _editingUserEmail=null;

window.adminGrantImportUser=async function(grant){
    const email=(document.getElementById('import-user-email-input')?.value||'').trim().toLowerCase();
    if(!email){window.showCustomAlert?.('ระบุอีเมล','กรุณาระบุอีเมลผู้ใช้',true);return;}
    if(!_ctrl.userGrants) _ctrl.userGrants={};
    /* ถ้า grant เป็น object (มี schedule) ให้คง schedule ไว้ แค่เปลี่ยน enabled */
    const existing=_ctrl.userGrants[email];
    if(existing && typeof existing==='object'){
        _ctrl.userGrants[email]={...existing,enabled:grant};
    } else {
        _ctrl.userGrants[email]=grant;
    }
    document.getElementById('import-user-email-input').value='';
    document.getElementById('import-email-dropdown')?.classList.add('hidden');
    renderGrants();
    await saveCtrl();
    window.showCustomAlert?.('บันทึกแล้ว',`${grant?'เปิด':'ปิด'} Import สำหรับ ${email} แล้ว`);
};

window.adminRemoveImportGrant=async function(email){
    if(_ctrl.userGrants) delete _ctrl.userGrants[email];
    renderGrants();
    await saveCtrl();
};

/* ตั้ง schedule รายบุคคล */
window.adminOpenUserSchedule=function(email){
    _editingUserEmail=email;
    const g=_ctrl.userGrants?.[email];
    const gObj=(g && typeof g==='object') ? g : {enabled:typeof g==='boolean'?g:true};
    const inO=document.getElementById('import-user-sched-open');
    const inC=document.getElementById('import-user-sched-close');
    if(inO) inO.value=gObj.scheduleOpen||'';
    if(inC) inC.value=gObj.scheduleClose||'';
    const panel=document.getElementById('import-user-sched-panel');
    if(panel){
        document.getElementById('import-user-sched-label').textContent=email;
        panel.classList.remove('hidden');
    }
};
window.adminCloseUserSchedule=function(){
    _editingUserEmail=null;
    document.getElementById('import-user-sched-panel')?.classList.add('hidden');
};
window.adminSaveUserSchedule=async function(){
    const email=_editingUserEmail; if(!email) return;
    const ov=document.getElementById('import-user-sched-open')?.value||'';
    const cv=document.getElementById('import-user-sched-close')?.value||'';
    if(ov&&cv&&new Date(ov)>=new Date(cv)){
        window.showCustomAlert?.('ผิดพลาด','เวลาเปิดต้องก่อนเวลาปิด',true); return;
    }
    if(!_ctrl.userGrants) _ctrl.userGrants={};
    const existing=_ctrl.userGrants[email];
    const base=(existing && typeof existing==='object') ? existing : {enabled:typeof existing==='boolean'?existing:true};
    _ctrl.userGrants[email]={...base,scheduleOpen:ov||null,scheduleClose:cv||null};
    renderGrants();
    await saveCtrl();
    adminCloseUserSchedule();
    updateCountdownBanner();
    window.showCustomAlert?.('บันทึกแล้ว',`ตั้งเวลารายบุคคลสำหรับ ${email} เรียบร้อย`);
};
window.adminClearUserSchedule=async function(){
    const email=_editingUserEmail; if(!email) return;
    if(_ctrl.userGrants?.[email] && typeof _ctrl.userGrants[email]==='object'){
        const {scheduleOpen,scheduleClose,...rest}=_ctrl.userGrants[email];
        _ctrl.userGrants[email]=Object.keys(rest).length>0?rest:rest.enabled;
    }
    renderGrants();
    await saveCtrl();
    adminCloseUserSchedule();
};

function renderGrants(){
    const box=document.getElementById('import-user-grants-list'); if(!box) return;
    const g=_ctrl.userGrants||{};
    const keys=Object.keys(g);
    if(!keys.length){box.innerHTML='<p class="text-xs text-slate-400 text-center py-2">ยังไม่มีการตั้งค่ารายบุคคล</p>';return;}
    box.innerHTML=keys.map(email=>{
        const gr=g[email];
        const enabled=(typeof gr==='boolean')?gr:(typeof gr==='object'&&gr!==null?gr.enabled!==false:true);
        const hasSchedule=(typeof gr==='object'&&gr!==null&&(gr.scheduleOpen||gr.scheduleClose));
        let schedInfo='';
        if(hasSchedule){
            const now=Date.now();
            const openAt=gr.scheduleOpen?new Date(gr.scheduleOpen).getTime():null;
            const closeAt=gr.scheduleClose?new Date(gr.scheduleClose).getTime():null;
            if(openAt&&now<openAt) schedInfo=`<span class="text-xs text-amber-600 ml-1">⏳ ${new Date(gr.scheduleOpen).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}</span>`;
            else if(closeAt&&now<closeAt) schedInfo=`<span class="text-xs text-teal-600 ml-1">⏰ ปิด ${new Date(gr.scheduleClose).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}</span>`;
            else schedInfo=`<span class="text-xs text-rose-400 ml-1">🔴 หมดเวลา</span>`;
        }
        return `<div class="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                    <i class="fas fa-user-circle text-slate-300 flex-shrink-0"></i>
                    <span class="text-xs font-medium text-slate-700 truncate">${email}</span>
                    ${schedInfo}
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full ${enabled?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}">${enabled?'เปิด':'ปิด'}</span>
                    <button onclick="adminOpenUserSchedule('${email}')" title="ตั้งเวลา" class="text-indigo-400 hover:text-indigo-600 text-xs px-1.5 py-1 rounded-lg hover:bg-indigo-50"><i class="fas fa-clock"></i></button>
                    <button onclick="adminRemoveImportGrant('${email}')" title="ลบ" class="text-slate-400 hover:text-rose-500 text-xs px-1.5 py-1 rounded-lg hover:bg-rose-50"><i class="fas fa-times"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ── Usage log ── */
window.adminRefreshImportUsageLog=async function(){
    const box=document.getElementById('admin-import-usage-log'); if(!box) return;
    box.innerHTML='<p class="text-slate-400 text-sm text-center py-4"><i class="fas fa-spinner fa-spin mr-1"></i>กำลังโหลด…</p>';
    try{
        const snap=await fsGetDocs(LOG_COL());
        const logs=[];
        snap.forEach(d=>logs.push(d.data()));
        logs.sort((a,b)=>b.timestamp-a.timestamp);
        if(!logs.length){box.innerHTML='<p class="text-slate-400 text-sm text-center py-4">ยังไม่มีข้อมูล</p>';return;}
        box.innerHTML=logs.map(l=>{
            const d=new Date(l.timestamp);
            const ok=(l.results||[]).filter(r=>r.ok).length;
            const fail=(l.results||[]).filter(r=>!r.ok).length;
            return `<div class="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-sm font-black text-slate-700">${l.email||l.userKey||'ไม่ระบุ'}</span>
                    <span class="text-xs text-slate-400">${d.toLocaleDateString('th-TH')} ${d.toLocaleTimeString('th-TH')}</span>
                </div>
                <div class="text-xs text-slate-500 truncate mb-1">${(l.files||[]).join(', ')}</div>
                <div class="flex gap-2">
                    ${ok?`<span class="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">${ok} สำเร็จ</span>`:''}
                    ${fail?`<span class="text-xs bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">${fail} ผิดพลาด</span>`:''}
                </div>
            </div>`;
        }).join('');
    }catch(e){box.innerHTML=`<p class="text-rose-400 text-sm text-center py-4">โหลดไม่ได้: ${e.message}</p>`;}
};

/* ── Init ── */
waitReady(()=>{
    refreshImportNavBtn();
    /* ติดตาม auth change */
    if(window.auth?.onAuthStateChanged){
        window.auth.onAuthStateChanged(u=>{
            setTimeout(refreshImportNavBtn,600);
        });
    }
});

})();
