
        // กันหน้าโหลดค้างแบบไม่พึ่ง Firebase Module: ถ้า module/import/error ทำงานไม่สำเร็จ จะปล่อยหน้าแรกออกมาเอง
        (function () {
            window.__schoolhubHardLoaderFallback = true;
            function releaseLoaderIfStuck() {
                var loader = document.getElementById('global-loader');
                var landing = document.getElementById('landing-view');
                var authView = document.getElementById('auth-view');
                var appView = document.getElementById('main-app');
                if (!loader) return;
                var loaderVisible = loader.style.display !== 'none' && !loader.classList.contains('hidden');
                var noMainScreen = (!landing || landing.classList.contains('hidden')) && (!authView || authView.classList.contains('hidden')) && (!appView || appView.classList.contains('hidden'));
                if (loaderVisible && noMainScreen) {
                    if (landing) landing.classList.remove('hidden');
                    loader.style.display = 'none';
                    console.warn('SchoolHub: hard loader fallback released the screen.');
                }
                if (typeof renderCachedAnnouncementTopbarFallback === 'function') renderCachedAnnouncementTopbarFallback();
            }
            window.addEventListener('error', function (event) {
                console.error('SchoolHub runtime error:', event && (event.message || event.error));
                setTimeout(releaseLoaderIfStuck, 200);
            });
            window.addEventListener('unhandledrejection', function (event) {
                console.error('SchoolHub promise error:', event && event.reason);
                setTimeout(releaseLoaderIfStuck, 200);
            });

            // ถ้าหน้าโหลดค้างเกิน 10 วินาที ให้ค่อยๆ แสดงปุ่ม "ปิดหน้านี้" ให้ผู้ใช้กดปิดเองได้
            // (กันกรณีค้างแบบที่ไม่เข้าเงื่อนไข error/unhandledrejection ด้านบน)
            (function () {
                var STUCK_MS = 10000;
                var shownAt = null; // เวลาที่ loader เริ่มแสดงในรอบปัจจุบัน
                var btnShown = false;

                function getEls() {
                    return {
                        loader: document.getElementById('global-loader'),
                        btn: document.getElementById('sh-loader-stuck-close-btn')
                    };
                }

                function isVisible(loader) {
                    return !!loader && loader.style.display !== 'none' && !loader.classList.contains('hidden');
                }

                function tick() {
                    var els = getEls();
                    if (!els.loader) return;
                    var visible = isVisible(els.loader);

                    if (!visible) {
                        shownAt = null;
                        if (btnShown && els.btn) {
                            els.btn.classList.add('opacity-0');
                            els.btn.classList.remove('pointer-events-auto');
                            els.btn.classList.add('pointer-events-none');
                            btnShown = false;
                        }
                        return;
                    }

                    if (shownAt === null) shownAt = Date.now();
                    if (!btnShown && Date.now() - shownAt >= STUCK_MS && els.btn) {
                        els.btn.classList.remove('opacity-0');
                        els.btn.classList.remove('pointer-events-none');
                        els.btn.classList.add('pointer-events-auto');
                        btnShown = true;
                    }
                }

                document.addEventListener('click', function (e) {
                    var btn = e.target && e.target.closest ? e.target.closest('#sh-loader-stuck-close-btn') : null;
                    if (!btn) return;
                    e.preventDefault();
                    e.stopPropagation();
                    releaseLoaderIfStuck();
                    var els = getEls();
                    if (els.loader) els.loader.style.display = 'none';
                    if (els.btn) {
                        els.btn.classList.add('opacity-0');
                        els.btn.classList.remove('pointer-events-auto');
                        els.btn.classList.add('pointer-events-none');
                    }
                    shownAt = null;
                    btnShown = false;
                }, true);

                setInterval(tick, 500);
            })();

            // FIX: แถบประกาศด้านบนไม่ขึ้นให้ผู้ใช้ทั่วไปสม่ำเสมอ (แต่แอดมินเห็นทุกครั้ง)
            // สาเหตุตัวจริง: การแสดงประกาศทำงานอยู่ใน js1/007.js ซึ่งเป็น Firebase ES module
            // (type="module") — ถ้าเครือข่ายของผู้เข้าชม (มือถือ/บริษัท/ตัวบล็อกโฆษณา)
            // โหลดสคริปต์จาก gstatic/googleapis ช้าหรือถูกบล็อก โมดูลนี้จะไม่ทำงานทันเวลา
            // (หรือไม่ทำงานเลย) ทำให้ไม่มีใครเรียก renderPublicAnnouncements() ผู้ใช้จึงไม่เห็น
            // แถบประกาศในรอบนั้น แอดมินมักเปิดจากเครื่อง/เน็ตที่เสถียรกว่า โมดูลจึงโหลดสำเร็จทุกครั้ง
            //
            // การแก้ครั้งก่อน (อ่านแคชจาก localStorage) ยังไม่พอ เพราะแคชจะถูกเขียนก็ต่อเมื่อ
            // 007.js เคยโหลดสำเร็จมาก่อนอย่างน้อย 1 ครั้งเท่านั้น ถ้าเน็ตแย่ตั้งแต่ครั้งแรก
            // ที่เข้าเว็บ (หรือเปิดจากเครื่อง/เบราว์เซอร์ใหม่) จะไม่มีแคชให้ใช้เลย ปัญหาจึงยังไม่หาย
            //
            // วิธีแก้จริง: ดึงประกาศตรงจาก Firestore REST API ด้วย fetch() ธรรมดา (ไม่ใช้ Firebase
            // SDK/module เลย) จาก script ปกติตัวนี้ซึ่งโหลดเร็วและไม่ต้องรอ import จาก gstatic
            // ทำให้แถบประกาศขึ้นได้แม้ 007.js จะยังโหลดไม่เสร็จหรือโหลดไม่สำเร็จเลยก็ตาม
            // ถ้า 007.js โหลดสำเร็จภายหลัง มันจะ render ทับด้วยข้อมูลสด (real-time) อีกที ไม่กระทบกัน
            var SH_ANNOUNCEMENT_CACHE_KEY = 'schoolhub_public_announcements_cache';
            var SH_FIRESTORE_PROJECT_ID = 'shoolhub-5677e';
            var SH_FIRESTORE_API_KEY = 'AIzaSyADAbTJEWivV1Nn-au7tXofStx4ADYTCM8';

            function escAnnouncementFallback(v) {
                return String(v || '').replace(/[&<>'"]/g, function (ch) {
                    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch];
                });
            }

            // แปลงค่า field แบบ Firestore REST (typed value) ให้เป็นค่า JS ปกติ
            function firestoreRestValueToJS(v) {
                if (!v || typeof v !== 'object') return null;
                if ('stringValue' in v) return v.stringValue;
                if ('booleanValue' in v) return v.booleanValue;
                if ('integerValue' in v) return Number(v.integerValue);
                if ('doubleValue' in v) return Number(v.doubleValue);
                if ('nullValue' in v) return null;
                if ('timestampValue' in v) return v.timestampValue;
                if ('arrayValue' in v) {
                    var arr = (v.arrayValue && v.arrayValue.values) || [];
                    return arr.map(firestoreRestValueToJS);
                }
                if ('mapValue' in v) {
                    var fields = (v.mapValue && v.mapValue.fields) || {};
                    var obj = {};
                    Object.keys(fields).forEach(function (k) { obj[k] = firestoreRestValueToJS(fields[k]); });
                    return obj;
                }
                return null;
            }

            // เดาว่าผู้ใช้ "น่าจะติดเซสชันล็อกอิน" อยู่หรือไม่ (จะถูก auto-login เข้าหน้าแอปหลัง 007.js โหลดเสร็จ)
            // ใช้ตรรกะเดียวกับที่ 007.js ใช้ตัดสินใจ restore session (schoolhub_session_active / admin_bypass)
            // โดยไม่นับกรณีเพิ่งกดออกจากระบบเอง (schoolhub_logout_intent ภายใน 10 นาทีล่าสุด)
            function schoolhubHasLikelyLoginSession() {
                try {
                    var logoutIntentAt = Number(localStorage.getItem('schoolhub_logout_intent') || 0);
                    var isManualLogout = logoutIntentAt && (Date.now() - logoutIntentAt < 10 * 60 * 1000);
                    if (isManualLogout) return false;
                    if (localStorage.getItem('schoolhub_admin_bypass') === 'true') return true;
                    if (localStorage.getItem('schoolhub_session_active') === 'true') return true;
                    return false;
                } catch (e) { return false; }
            }

            function renderAnnouncementTopbarFromItems(items) {
                try {
                    if (typeof window.renderPublicAnnouncements === 'function') return; // 007.js โหลดสำเร็จแล้ว ปล่อยให้มันทำงานเอง (ข้อมูล real-time แม่นกว่า)
                    if (!Array.isArray(items) || !items.length) return;

                    // ประกาศที่ตั้ง scope="app" หรือ "both" ต้องไปแสดงหลังเข้าสู่ระบบ (app-announcement-topbar)
                    // ถ้าตอนนี้ผู้ใช้ติดเซสชันล็อกอินอยู่ (กำลังจะถูกพาเข้าหน้าแอปหลัง auth เสร็จ)
                    // ถ้ายังไม่ติดเซสชัน (อยู่หน้า landing จริง ๆ) ให้ scope="both" แสดงที่หน้าหลักไปเลย
                    // ส่วน scope="landing" แสดงที่หน้าหลักเสมอตามปกติ
                    var hasSession = schoolhubHasLikelyLoginSession();
                    var containerId = hasSession ? 'app-announcement-topbar' : 'public-announcement-topbar';
                    var allowedScopes = hasSession ? ['app', 'both'] : ['landing', 'both'];

                    var topbar = document.getElementById(containerId);
                    if (!topbar || !topbar.classList.contains('hidden')) return; // มีอะไรแสดงอยู่แล้ว หรือหา element ไม่เจอ ไม่ต้องทำอะไร
                    var now = Date.now();
                    var active = items.filter(function (a) {
                        if (!a || a.active === false) return false;
                        var start = a.startAt ? new Date(a.startAt).getTime() : null;
                        var end = a.endAt ? new Date(a.endAt).getTime() : null;
                        if (start && now < start) return false;
                        if (end && now > end) return false;
                        return true;
                    }).filter(function (a) {
                        var scope = a.scope || 'both';
                        return allowedScopes.indexOf(scope) !== -1;
                    }).filter(function (a) {
                        return a.type === 'topbar' || a.type === 'both';
                    });
                    if (!active.length) return;
                    var top = active[0];
                    topbar.classList.remove('hidden');
                    topbar.innerHTML = '<div class="bg-indigo-600 text-white px-4 py-3 shadow-lg"><div class="max-w-7xl mx-auto flex items-start gap-3"><i class="fas fa-bullhorn mt-1"></i><div class="flex-1 min-w-0"><b>ประกาศ</b><span class="mx-2 hidden sm:inline">•</span><span class="font-bold break-words">' + escAnnouncementFallback(top.title) + '</span><span class="mx-2 hidden sm:inline">•</span><span class="block sm:inline break-words">' + escAnnouncementFallback(top.message) + '</span></div></div></div>';
                } catch (e) { console.warn('SchoolHub: announcement fallback render failed:', e); }
            }

            function renderCachedAnnouncementTopbarFallback() {
                try {
                    var raw = localStorage.getItem(SH_ANNOUNCEMENT_CACHE_KEY);
                    var items = raw ? JSON.parse(raw) : [];
                    renderAnnouncementTopbarFromItems(items);
                } catch (e) { console.warn('SchoolHub: cached announcement fallback failed:', e); }
            }

            // เก็บผลลัพธ์ล่าสุดที่ดึงมาได้ไว้ในตัวแปร เพื่อใช้ตอนถึงเวลาแสดงจริง (หน่วง 3 วิ)
            var schoolhubLatestFetchedAnnouncementItems = null;
            function fetchAnnouncementsViaRestInBackground() {
                try {
                    if (typeof fetch !== 'function') return;
                    var url = 'https://firestore.googleapis.com/v1/projects/' + SH_FIRESTORE_PROJECT_ID +
                        '/databases/(default)/documents/system_settings/announcements?key=' + SH_FIRESTORE_API_KEY;
                    var controller = (typeof AbortController === 'function') ? new AbortController() : null;
                    var timer = controller ? setTimeout(function () { controller.abort(); }, 6000) : null;
                    fetch(url, { method: 'GET', signal: controller ? controller.signal : undefined })
                        .then(function (res) { return res.ok ? res.json() : null; })
                        .then(function (data) {
                            if (timer) clearTimeout(timer);
                            if (!data || !data.fields || !data.fields.items) return;
                            var items = firestoreRestValueToJS(data.fields.items) || [];
                            if (!Array.isArray(items)) return;
                            schoolhubLatestFetchedAnnouncementItems = items;
                            try { localStorage.setItem(SH_ANNOUNCEMENT_CACHE_KEY, JSON.stringify(items)); } catch (e) {}
                        })
                        .catch(function (e) { if (timer) clearTimeout(timer); console.warn('SchoolHub: REST announcement fetch failed:', e); });
                } catch (e) { console.warn('SchoolHub: REST announcement fetch setup failed:', e); }
            }

            // แสดงประกาศจริงโดยใช้ข้อมูลล่าสุดที่มี ณ ตอนนั้น (REST ถ้าถึงแล้ว ไม่งั้นใช้แคชเดิม)
            function showAnnouncementFallbackNow() {
                var items = schoolhubLatestFetchedAnnouncementItems;
                if (!items) {
                    try {
                        var raw = localStorage.getItem(SH_ANNOUNCEMENT_CACHE_KEY);
                        items = raw ? JSON.parse(raw) : [];
                    } catch (e) { items = []; }
                }
                renderAnnouncementTopbarFromItems(items);
            }

            document.addEventListener('DOMContentLoaded', function () {
                fetchAnnouncementsViaRestInBackground(); // เริ่มดึงข้อมูลล่วงหน้าแบบเงียบ ๆ ให้พร้อมทันตอนถึงเวลาแสดง
            });

            // ตามที่ต้องการ: ให้หน่วงเวลา 3 วินาที หลังจากหน้าเว็บโหลดเสร็จ (window 'load') ก่อนค่อยแสดงแถบประกาศ
            function scheduleAnnouncementFallbackDisplay() {
                setTimeout(showAnnouncementFallbackNow, 3000);
            }
            if (document.readyState === 'complete') {
                scheduleAnnouncementFallbackDisplay();
            } else {
                window.addEventListener('load', scheduleAnnouncementFallbackDisplay);
            }
            function simpleToggleAuth(mode){
                var login = document.getElementById('login-form');
                var reg = document.getElementById('register-form');
                var sub = document.getElementById('auth-subtitle');
                var isLogin = mode === 'login';
                if (login) login.classList.toggle('hidden', !isLogin);
                if (reg) reg.classList.toggle('hidden', isLogin);
                if (sub) sub.textContent = isLogin ? 'ระบบจัดการห้องเรียนอัจฉริยะ' : 'สร้างบัญชีใหม่เพื่อเริ่มต้นใช้งาน';
            }
            window.toggleAuthMode = window.toggleAuthMode || simpleToggleAuth;
            window.openLoginFromLanding = window.openLoginFromLanding || function(){
                var landing = document.getElementById('landing-view');
                var auth = document.getElementById('auth-view');
                var loader = document.getElementById('global-loader');
                if (loader) loader.style.display = 'none';
                if (landing) landing.classList.add('hidden');
                if (auth) auth.classList.remove('hidden');
                simpleToggleAuth('login');
            };
            window.openRegisterFromLanding = window.openRegisterFromLanding || function(){
                window.openLoginFromLanding();
                simpleToggleAuth('register');
            };
            window.backToLanding = window.backToLanding || function(){
                var landing = document.getElementById('landing-view');
                var auth = document.getElementById('auth-view');
                var loader = document.getElementById('global-loader');
                if (loader) loader.style.display = 'none';
                if (auth) auth.classList.add('hidden');
                if (landing) landing.classList.remove('hidden');
            };
            window.scrollToLandingPlans = window.scrollToLandingPlans || function(){
                var el = document.getElementById('landing-plans-section');
                if (el) el.scrollIntoView({behavior:'smooth', block:'start'});
            };
            window.requestSubscriptionPlan = window.requestSubscriptionPlan || function(planId){
                try { localStorage.setItem('schoolhub_pending_plan_request_id', planId || ''); } catch(e) {}
                window.openRegisterFromLanding();
            };
            document.addEventListener('DOMContentLoaded', function () {
                setTimeout(releaseLoaderIfStuck, 4500);
                setTimeout(releaseLoaderIfStuck, 9000);
            });
        })();
    