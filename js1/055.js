
/* SchoolHub Email Required Firebase Guard - final file-only patch */
(function(){
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const norm = (v) => String(v || '').trim().toLowerCase();
  const isEmail = (v) => emailRe.test(norm(v));
  window.schoolhubIsValidUserEmail = isEmail;
  window.schoolhubNormalizeEmailKey = function(v){
    const email = norm(v);
    if(!isEmail(email)) throw new Error('Blocked invalid user creation: email required');
    return email;
  };
  window.schoolhubIsAbnormalUserRow = function(u, docId){
    u = u || {};
    const email = norm(u.email);
    const key = norm(u.userKey);
    const id = norm(docId || u.docId || u.uid);
    return !isEmail(email) || !isEmail(key || email) || (!!id && id === key && !isEmail(id));
  };

  function markInvalidAdminRows(){
    try{
      const map = window.__adminUsersByUid || {};
      document.querySelectorAll('#admin-user-list tr').forEach(tr => {
        const btn = tr.querySelector('button[onclick^="updateUserStatus"], button.schoolhub-delete-user-btn');
        if(!btn) return;
        const onclick = btn.getAttribute('onclick') || '';
        const m = onclick.match(/\('([^']*)'/);
        const uid = m ? m[1] : '';
        const u = map[uid] || {};
        if(!window.schoolhubIsAbnormalUserRow(u, uid)) return;
        if(!tr.querySelector('.schoolhub-invalid-user-badge')){
          const firstTd = tr.querySelector('td');
          if(firstTd){
            firstTd.insertAdjacentHTML('beforeend', '<div class="schoolhub-invalid-user-badge inline-flex items-center gap-1 mt-2 bg-red-100 text-red-700 border border-red-200 px-2 py-1 rounded-full text-[11px] font-black"><i class="fas fa-triangle-exclamation"></i> ข้อมูลผิดปกติ</div>');
          }
        }
      });
    }catch(e){ console.warn('mark invalid users failed:', e); }
  }

  const oldLoad = window.loadAdminData;
  if(typeof oldLoad === 'function' && !oldLoad.__emailGuardInvalidBadge){
    const wrapped = async function(){
      const r = await oldLoad.apply(this, arguments);
      setTimeout(markInvalidAdminRows, 120);
      return r;
    };
    wrapped.__emailGuardInvalidBadge = true;
    window.loadAdminData = wrapped;
  }

  const oldAdd = window.addUserToDirectory;
  if(typeof oldAdd === 'function' && !oldAdd.__emailRequiredGuard){
    const wrappedAdd = async function(user, name, role){
      const email = norm(user && user.email);
      if(!isEmail(email)){
        console.error('Blocked invalid user creation: email required', user);
        try { if(window.auth && window.auth.signOut) await window.auth.signOut(); } catch(e){}
        throw new Error('Blocked invalid user creation: email required');
      }
      user.email = email;
      return oldAdd.call(this, user, name || user.displayName || email, role);
    };
    wrappedAdd.__emailRequiredGuard = true;
    window.addUserToDirectory = wrappedAdd;
  }

  const oldLogin = window.handleLogin;
  if(typeof oldLogin === 'function' && !oldLogin.__emailRequiredGuard){
    const wrappedLogin = async function(e){
      const raw = document.getElementById('login-email')?.value || '';
      const v = norm(raw);
      if(v && v !== 'admin') document.getElementById('login-email').value = v;
      return oldLogin.call(this, e);
    };
    wrappedLogin.__emailRequiredGuard = true;
    window.handleLogin = wrappedLogin;
  }

  const oldRegister = window.handleRegister;
  if(typeof oldRegister === 'function' && !oldRegister.__emailRequiredGuard){
    const wrappedRegister = async function(e){
      const inp = document.getElementById('reg-email');
      const email = norm(inp && inp.value);
      if(inp) inp.value = email;
      if(!isEmail(email)){
        if(e && e.preventDefault) e.preventDefault();
        return (window.showCustomAlert || alert)('ไม่พบอีเมลผู้ใช้ กรุณาเข้าสู่ระบบด้วยอีเมล', 'กรุณากรอกอีเมลให้ถูกต้องก่อนสมัครสมาชิก', true);
      }
      return oldRegister.call(this, e);
    };
    wrappedRegister.__emailRequiredGuard = true;
    window.handleRegister = wrappedRegister;
  }
})();
