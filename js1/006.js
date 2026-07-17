
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
            }
            window.addEventListener('error', function (event) {
                console.error('SchoolHub runtime error:', event && (event.message || event.error));
                setTimeout(releaseLoaderIfStuck, 200);
            });
            window.addEventListener('unhandledrejection', function (event) {
                console.error('SchoolHub promise error:', event && event.reason);
                setTimeout(releaseLoaderIfStuck, 200);
            });
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
    