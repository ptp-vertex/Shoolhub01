
        (function(){
            function setAuthTitle(mode){
                var title=document.getElementById('auth-title');
                var sub=document.getElementById('auth-subtitle');
                if(title) title.textContent = mode === 'register' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
                if(sub) sub.textContent = mode === 'register' ? 'สร้างบัญชีใหม่เพื่อเริ่มต้นใช้งาน' : 'ระบบจัดการห้องเรียนอัจฉริยะ';
            }
            var originalToggle = window.toggleAuthMode;
            window.toggleAuthMode = function(mode){
                if(typeof originalToggle === 'function') originalToggle(mode);
                else {
                    var isLogin = mode === 'login';
                    document.getElementById('login-form')?.classList.toggle('hidden', !isLogin);
                    document.getElementById('register-form')?.classList.toggle('hidden', isLogin);
                }
                setAuthTitle(mode);
                setTimeout(function(){ document.getElementById('auth-view')?.scrollTo({top:0, behavior:'smooth'}); }, 20);
            };
            function animateSubmit(btn){
                if(!btn) return function(){};
                btn.classList.add('auth-btn-loading');
                return function(success){
                    btn.classList.remove('auth-btn-loading');
                    if(success){
                        btn.classList.add('auth-btn-success');
                        setTimeout(function(){ btn.classList.remove('auth-btn-success'); }, 900);
                    }
                };
            }
            window.handleLoginAnimated = async function(e){
                var btn = e?.target?.querySelector('button[type="submit"]');
                var done = animateSubmit(btn);
                try { await window.handleLogin(e); done(false); }
                catch(err){ done(false); throw err; }
            };
            window.handleRegisterAnimated = async function(e){
                var btn = e?.target?.querySelector('button[type="submit"]');
                var done = animateSubmit(btn);
                try { await window.handleRegister(e); done(false); }
                catch(err){ done(false); throw err; }
            };
        })();
    

        /* =========================================================
           Patch 2026-05-31: scroll + detailed subscription limits
           ========================================================= */
        function getPlanLimitValue_(plan, key, fallback){
            const v = plan && plan[key];
            if(v === undefined || v === null || v === '') return fallback;
            const n = Number(v);
            return Number.isFinite(n) ? n : fallback;
        }
        function getCurrentPlanObject(){
            const dir = window.__currentUserDir || {};
            return getPlanById(dir.planId) || {};
        }
        function getCurrentPlanWeekLimit(){
            const plan = getCurrentPlanObject();
            return Math.max(1, getPlanLimitValue_(plan, 'weekLimit', getPlanLimitValue_(plan, 'maxWeeks', 20)) || 20);
        }
        function getCurrentPlanStudentLimit(){
            const plan = getCurrentPlanObject();
            return Math.max(0, getPlanLimitValue_(plan, 'studentLimit', 0) || 0);
        }
        function currentPlanAllows(key){
            if(isAdmin) return true;
            const plan = getCurrentPlanObject();
            if(!plan || !plan.id) return false;
            if(key === 'attendance') return plan.allowAttendance !== false;
            if(key === 'export') return plan.allowExport !== false;
            return true;
        }
        function describePlanLimits(p){
            const course = Number(p.courseLimit||0)===0 ? 'รายวิชาไม่จำกัด' : `รายวิชา ${Number(p.courseLimit||0)} วิชา`;
            const weeks = `${Number(p.weekLimit||p.maxWeeks||20)} สัปดาห์`;
            const students = Number(p.studentLimit||0)===0 ? 'นักเรียนไม่จำกัด' : `นักเรียน ${Number(p.studentLimit||0)} คน`;
            const att = p.allowAttendance===false ? 'ไม่รวมเช็คชื่อ' : 'เช็คชื่อได้';
            const exp = p.allowExport===false ? 'Export ไม่ได้' : 'Export ได้';
            const team = p.allowTeam ? `ทีม ${Math.max(1, Number(p.teamMemberLimit||p.maxTeamMembers||1))} คน` : 'ใช้คนเดียว';
            return `${course} • ${weeks} • ${students} • ${att} • ${exp} • ${team}`;
        }
        const __schoolhubOldInitStaticDropdowns = window.initStaticDropdowns;
        window.initStaticDropdowns = () => {
            const maxWeeks = getCurrentPlanWeekLimit ? getCurrentPlanWeekLimit() : 20;
            const planWeek = document.getElementById('plan-week');
            if (planWeek) {
                const oldVal = planWeek.value || '1';
                planWeek.innerHTML = '';
                for(let i=1; i<=maxWeeks; i++) planWeek.innerHTML += `<option value="${i}">สัปดาห์ที่ ${i}</option>`;
                if(Number(oldVal) <= maxWeeks) planWeek.value = oldVal;
            }
            const scoreWeek = document.getElementById('score-week');
            if (scoreWeek) {
                const oldVal = scoreWeek.value || '';
                scoreWeek.innerHTML = '<option value="">-- เลือกสัปดาห์ --</option>';
                for(let i=1; i<=maxWeeks; i++) scoreWeek.innerHTML += `<option value="${i}">สัปดาห์ที่ ${i}</option>`;
                if(oldVal && Number(oldVal) <= maxWeeks) scoreWeek.value = oldVal;
            }
        };
        function getDefaultPlans(){
            const now=Date.now();
            return [
                {id:'standard',name:'มาตรฐาน',monthlyPrice:99,yearlyPrice:990,price:'ฟรีเดือนแรก / ต่อไป 99 บาทต่อเดือน',billingCycle:'monthly',freeFirstMonth:true,courseLimit:3,weekLimit:20,studentLimit:0,allowAttendance:true,allowExport:false,promptpay:'',desc:'เหมาะสำหรับเริ่มใช้งาน ฟรีเดือนแรก เดือนถัดไปชำระตามราคาที่ตั้ง',features:['เพิ่มรายวิชาได้ 3 วิชา','ใช้งาน 20 สัปดาห์','เช็คชื่อและบันทึกคะแนน'],order:1,featured:true,active:true,updatedAt:now},
                {id:'pro',name:'มืออาชีพ',monthlyPrice:199,yearlyPrice:1990,price:'199 บาทต่อเดือน / 1,990 บาทต่อปี',billingCycle:'monthly',freeFirstMonth:false,courseLimit:10,weekLimit:30,studentLimit:0,allowAttendance:true,allowExport:true,promptpay:'',desc:'เหมาะสำหรับครูที่ใช้หลายรายวิชาและต้องการ Export ไฟล์',features:['เพิ่มรายวิชาได้ 10 วิชา','ใช้งาน 30 สัปดาห์','เช็คชื่อและ Export Excel ได้'],order:2,featured:false,active:true,updatedAt:now},
                {id:'unlimited',name:'ฟรีตลอด',monthlyPrice:0,yearlyPrice:0,price:'ฟรีตลอด',billingCycle:'forever',freeForever:true,courseLimit:1,weekLimit:20,studentLimit:50,allowAttendance:true,allowExport:false,promptpay:'',desc:'ใช้ได้ตลอดโดยไม่หมดอายุ เหมาะสำหรับทดลองระยะยาว',features:['เพิ่มรายวิชาได้ 1 วิชา','นักเรียนสูงสุด 50 คน','ใช้งานพื้นฐานได้ตลอด'],order:3,featured:false,active:true,updatedAt:now},
                {id:'school',name:'สถานศึกษา',monthlyPrice:499,yearlyPrice:4990,price:'499 บาทต่อเดือน / 4,990 บาทต่อปี',billingCycle:'monthly',courseLimit:0,weekLimit:52,studentLimit:0,allowAttendance:true,allowExport:true,promptpay:'',desc:'เหมาะสำหรับใช้ทั้งแผนก เพิ่มผู้ใช้และรายวิชาได้มาก',features:['เพิ่มรายวิชาไม่จำกัด','ใช้งานได้ 52 สัปดาห์','เช็คชื่อและ Export ได้ครบ'],order:4,featured:false,active:false,updatedAt:now}
            ];
        }
        window.renderLandingPlans=function(){
            const box=document.getElementById('landing-plan-list');if(!box)return;
            const items=(subscriptionPlans||getDefaultPlans()).filter(p=>p.active!==false).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
            box.innerHTML=items.map(p=>`<div class="pricing-card ${p.featured?'featured':''} rounded-[2rem] p-6 relative overflow-hidden">${p.featured?'<div class="absolute top-4 right-4 bg-primary text-white text-xs font-black px-3 py-1 rounded-full">แนะนำ</div>':''}<h3 class="text-2xl font-black text-slate-900 mb-1">${escapeHTML(p.name||'')}</h3><p class="text-sm text-slate-500 min-h-[42px]">${escapeHTML(p.desc||'')}</p><div class="my-5"><span class="text-3xl font-black text-primary">${escapeHTML(planDisplayPrice(p))}</span></div><div class="mb-4 text-xs font-bold text-slate-500 bg-slate-50 rounded-2xl p-3 leading-6"><i class="fas fa-sliders text-primary mr-1"></i>${escapeHTML(describePlanLimits(p))}</div><ul class="space-y-3 mb-6">${(p.features||[]).map(f=>`<li class="flex gap-2 text-sm text-slate-600"><i class="fas fa-check text-emerald-500 mt-1"></i><span>${escapeHTML(f)}</span></li>`).join('')}</ul><button onclick="requestSubscriptionPlan('${p.id}')" class="w-full ${p.featured?'bg-primary text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200':'bg-slate-100 text-slate-700 hover:bg-slate-200'} rounded-2xl py-3 font-bold transition"><i class="fas fa-paper-plane mr-1"></i> สมัครแผนนี้</button></div>`).join('');
        };
        window.renderAdminPlans=function(){
            const tbody=document.getElementById('admin-plan-list');if(!tbody)return;
            const items=(subscriptionPlans||[]).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
            if(!items.length){tbody.innerHTML='<tr><td colspan="5" class="text-center p-8 text-slate-400">ยังไม่มีแผนการใช้งาน</td></tr>';return;}
            tbody.innerHTML=items.map(p=>`<tr><td class="font-bold text-slate-700">${escapeHTML(p.name||'')}${p.featured?'<div class="text-xs text-primary mt-1"><i class="fas fa-star"></i> แนะนำ</div>':''}<div class="text-[11px] text-slate-400 mt-1">ID: ${escapeHTML(p.id||'')}</div></td><td class="font-black text-primary">${escapeHTML(planDisplayPrice(p))}<div class="text-xs font-normal text-slate-400">${escapeHTML(p.desc||'')}</div><div class="text-xs text-slate-500 mt-1">รอบ: ${p.billingCycle==='yearly'?'รายปี':(p.billingCycle==='forever'?'ฟรีตลอด':'รายเดือน')}</div></td><td class="text-sm text-slate-500"><div class="font-bold text-slate-700">${escapeHTML(describePlanLimits(p))}</div>${(p.features||[]).slice(0,5).map(f=>`<div>• ${escapeHTML(f)}</div>`).join('')}</td><td class="text-center"><span class="px-3 py-1 rounded-full text-xs font-bold ${p.active!==false?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}">${p.active!==false?'แสดง':'ซ่อน'}</span></td><td class="text-right whitespace-nowrap"><button onclick="editAdminPlan('${p.id}')" class="bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1.5 rounded-lg text-sm font-bold"><i class="fas fa-pen"></i></button><button onclick="deleteAdminPlan('${p.id}')" class="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1.5 rounded-lg text-sm font-bold ml-1"><i class="fas fa-trash"></i></button></td></tr>`).join('');
        };
        window.resetAdminPlanForm=function(){
            ['plan-sub-edit-id','plan-sub-name','plan-sub-price','plan-sub-promptpay','plan-sub-desc','plan-sub-features','plan-sub-monthly-price','plan-sub-yearly-price'].forEach(id=>{const el=document.getElementById(id); if(el)el.value='';});
            const set=(id,v)=>{const e=document.getElementById(id); if(e)e.value=v};
            set('plan-sub-order','1'); set('plan-sub-course-limit','1'); set('plan-sub-week-limit','20'); set('plan-sub-student-limit','0'); set('plan-sub-team-limit','1'); set('plan-sub-billing-cycle','monthly');
            ['plan-sub-featured','plan-sub-active','plan-sub-free-first-month','plan-sub-allow-attendance','plan-sub-allow-export','plan-sub-allow-team'].forEach(id=>{const el=document.getElementById(id); if(el)el.checked=!['plan-sub-featured','plan-sub-free-first-month','plan-sub-allow-team'].includes(id);});
        };
        window.editAdminPlan=function(id){
            const p=(subscriptionPlans||[]).find(x=>x.id===id);if(!p)return; const set=(id,v)=>{const e=document.getElementById(id); if(e)e.value=v??''};
            set('plan-sub-edit-id',p.id);set('plan-sub-name',p.name||'');set('plan-sub-price',p.price||planDisplayPrice(p));set('plan-sub-promptpay',p.promptpay||'');set('plan-sub-desc',p.desc||'');set('plan-sub-features',(p.features||[]).join('\n'));set('plan-sub-order',Number(p.order||1));set('plan-sub-course-limit',Number(p.courseLimit||0));set('plan-sub-week-limit',Number(p.weekLimit||p.maxWeeks||20));set('plan-sub-student-limit',Number(p.studentLimit||0));set('plan-sub-team-limit',Math.max(1,Number(p.teamMemberLimit||p.maxTeamMembers||1)));set('plan-sub-monthly-price',Number(p.monthlyPrice||0));set('plan-sub-yearly-price',Number(p.yearlyPrice||0));set('plan-sub-billing-cycle',p.freeForever?'forever':(p.billingCycle||'monthly'));
            const chk=(id,v)=>{const e=document.getElementById(id); if(e)e.checked=!!v}; chk('plan-sub-featured',p.featured);chk('plan-sub-active',p.active!==false);chk('plan-sub-free-first-month',p.freeFirstMonth);chk('plan-sub-allow-attendance',p.allowAttendance!==false);chk('plan-sub-allow-export',p.allowExport!==false);chk('plan-sub-allow-team',!!p.allowTeam);
        };
        window.saveAdminPlanForm=async()=>{
            if(!isAdmin)return showCustomAlert('ไม่มีสิทธิ์','เฉพาะแอดมินเท่านั้น',true);
            const editId=document.getElementById('plan-sub-edit-id').value; const monthly=Number(document.getElementById('plan-sub-monthly-price')?.value||0); const yearly=Number(document.getElementById('plan-sub-yearly-price')?.value||0); const cycle=document.getElementById('plan-sub-billing-cycle')?.value||'monthly';
            const item={id:editId||`plan_${Date.now()}`,name:document.getElementById('plan-sub-name').value.trim(),monthlyPrice:monthly,yearlyPrice:yearly,billingCycle:cycle,freeForever:cycle==='forever',freeFirstMonth:document.getElementById('plan-sub-free-first-month')?.checked||false,courseLimit:Number(document.getElementById('plan-sub-course-limit')?.value||0),weekLimit:Math.max(1,Number(document.getElementById('plan-sub-week-limit')?.value||20)),studentLimit:Number(document.getElementById('plan-sub-student-limit')?.value||0),allowTeam:document.getElementById('plan-sub-allow-team')?.checked||false,teamMemberLimit:Math.max(1,Number(document.getElementById('plan-sub-team-limit')?.value||1)),allowAttendance:document.getElementById('plan-sub-allow-attendance')?.checked!==false,allowExport:document.getElementById('plan-sub-allow-export')?.checked!==false,price:document.getElementById('plan-sub-price').value.trim(),promptpay:document.getElementById('plan-sub-promptpay').value.trim(),desc:document.getElementById('plan-sub-desc').value.trim(),features:document.getElementById('plan-sub-features').value.split('\n').map(x=>x.trim()).filter(Boolean),order:Number(document.getElementById('plan-sub-order').value||1),featured:document.getElementById('plan-sub-featured').checked,active:document.getElementById('plan-sub-active').checked,updatedAt:Date.now()};
            if(!item.price)item.price=planDisplayPrice(item); if(!item.name)return showCustomAlert('ข้อมูลไม่ครบ','กรุณากรอกชื่อระดับ',true);
            subscriptionPlans=(subscriptionPlans||[]).filter(p=>p.id!==item.id); subscriptionPlans.push(item); writeLocalJSON(PLANS_CACHE_KEY,subscriptionPlans); toggleLoader(true);
            try{await setDoc(getPlansDocRef(),{items:subscriptionPlans,updatedAt:Date.now()},{merge:true}); resetAdminPlanForm(); renderAdminPlans(); renderLandingPlans(); showCustomAlert('บันทึกแล้ว','บันทึกแผนการใช้งานขึ้น Firebase เรียบร้อย');}catch(e){resetAdminPlanForm();renderAdminPlans();renderLandingPlans();showCustomAlert('บันทึกในเครื่องแล้ว','แต่ยังบันทึกขึ้น Firebase ไม่ได้: '+getFirebaseErrorText(e),true);} toggleLoader(false);
        };
        window.seedDefaultPlans=async()=>{subscriptionPlans=getDefaultPlans();writeLocalJSON(PLANS_CACHE_KEY,subscriptionPlans);toggleLoader(true);try{await setDoc(getPlansDocRef(),{items:subscriptionPlans,updatedAt:Date.now()},{merge:true});renderAdminPlans();renderLandingPlans();showCustomAlert('สำเร็จ','สร้างแผนตัวอย่าง 3 ระดับ (มาตรฐาน / โปร / ทีม) ขึ้น Firebase แล้ว');}catch(e){renderAdminPlans();renderLandingPlans();showCustomAlert('สร้างในเครื่องแล้ว','แต่ยังบันทึกขึ้น Firebase ไม่ได้: '+getFirebaseErrorText(e),true);}toggleLoader(false);};
        const __oldSwitchCourseTabPlanLimit = window.switchCourseTab;
        window.switchCourseTab = (tabId) => {
            if(tabId === 'attendance' && !currentPlanAllows('attendance')) return showCustomAlert('แผนนี้ไม่รองรับเช็คชื่อ','กรุณาอัปเกรดแผนเพื่อใช้งานเช็คชื่อ',true);
            return __oldSwitchCourseTabPlanLimit(tabId);
        };
        const __oldExportStudentsPlanLimit = window.exportStudentsToExcel;
        window.exportStudentsToExcel = () => { if(!currentPlanAllows('export')) return showCustomAlert('แผนนี้ไม่รองรับ Export','กรุณาอัปเกรดแผนเพื่อส่งออกไฟล์',true); return __oldExportStudentsPlanLimit(); };
        const __oldExportScoresPlanLimit = window.exportScoresToExcel;
        window.exportScoresToExcel = () => { if(!currentPlanAllows('export')) return showCustomAlert('แผนนี้ไม่รองรับ Export','กรุณาอัปเกรดแผนเพื่อส่งออกไฟล์',true); return __oldExportScoresPlanLimit(); };
        const __oldRenderUserPlansDetailed = window.renderUserPlans;
        window.renderUserPlans = function(){
            __oldRenderUserPlansDetailed && __oldRenderUserPlansDetailed();
            const box=document.getElementById('user-current-plan-box'); const dir=window.__currentUserDir||{}; const plan=getPlanById(dir.planId);
        };
        try{ window.initStaticDropdowns(); }catch(e){}
