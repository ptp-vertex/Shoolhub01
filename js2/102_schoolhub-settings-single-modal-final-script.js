
/* =========================================================
   SchoolHub Settings Single Modal Final Patch
   - รวมเมนูทั่วไปให้เหลืออันเดียว
   - โปรไฟล์/แผน/ติดต่อผู้ดูแลระบบทำงานใน settings modal เดิม
   - ไม่แตะระบบคะแนน เกรด Export X ลาออก สิทธิ์ หรือ login
   ========================================================= */
import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function(){
  if (window.__schoolhubSettingsSingleModalFinal) return;
  window.__schoolhubSettingsSingleModalFinal = true;

  const firebaseConfig = {
    apiKey: "AIzaSyADAbTJEWivV1Nn-au7tXofStx4ADYTCM8",
    authDomain: "shoolhub-5677e.firebaseapp.com",
    projectId: "shoolhub-5677e",
    storageBucket: "shoolhub-5677e.firebasestorage.app",
    messagingSenderId: "630487358153",
    appId: "1:630487358153:web:1866add5d4a29b74abcb18",
    measurementId: "G-2Q6R46DC38"
  };
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const __schoolhubSettingsOriginalOpenUserPlanSelector = window.openUserPlanSelector;
  const __schoolhubSettingsOriginalRenderUserPlans = window.renderUserPlans;
  const __schoolhubProfilePopupOpenUserProfileSettings = window.openUserProfileSettings;
  const __schoolhubProfilePopupSaveUserProfileChanges = window.saveUserProfileChanges;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const norm = (v) => String(v || '').trim();
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());


  const LANGUAGE_OPTIONS = [
    ['th','ไทย'], ['en','English'], ['zh','中文'], ['ja','日本語'], ['ko','한국어'], ['fr','Français'], ['de','Deutsch'], ['es','Español'], ['ar','العربية'], ['lo','ລາວ'], ['my','မြန်မာ'], ['km','ខ្មែរ'], ['vi','Tiếng Việt']
  ];
  const LOCALE_BY_LANG = { th:'th-TH', en:'en-US', zh:'zh-CN', ja:'ja-JP', ko:'ko-KR', fr:'fr-FR', de:'de-DE', es:'es-ES', ar:'ar-SA', lo:'lo-LA', my:'my-MM', km:'km-KH', vi:'vi-VN' };

  const I18N_BASE = {
    th: {
      settings:'ตั้งค่า', general:'ทั่วไป', plans:'แผนการใช้งาน', language:'ภาษา', contactAdmin:'ติดต่อผู้ดูแลระบบ', userMessages:'ข้อความจากผู้ใช้', systemSettings:'ตั้งค่าระบบ', saveLanguage:'บันทึกภาษา', currentPlan:'แผนปัจจุบัน', backHome:'กลับหน้าหลัก',
      settingsDescription:'ศูนย์รวมโปรไฟล์ แผนการใช้งาน ภาษา และช่องทางติดต่อผู้ดูแลระบบ', generalDescription:'รวมข้อมูลโปรไฟล์ บัญชี และตัวเลือกพื้นฐานไว้ในหน้าเดียว แก้ไขได้จากด้านขวาของหน้าต่างนี้โดยไม่เปิดหน้าต่างซ้อน', userProfile:'โปรไฟล์ผู้ใช้งาน', profileDescription:'แก้ไขข้อมูลแสดงผลของบัญชีได้ตรงนี้', accountInfo:'ข้อมูลบัญชี', loadingAccount:'กำลังโหลดข้อมูลบัญชี...', displayTheme:'ธีม / รูปแบบการแสดงผล', displayThemeDescription:'ใช้ธีมและรูปแบบการแสดงผลเดิมของระบบ เพื่อไม่กระทบหน้าคะแนน เกรด และ Export', languageCardDescription:'เลือกภาษาได้จากเมนูภาษาในแถบตั้งค่า', notifications:'การแจ้งเตือน', notificationsDescription:'ใช้การแจ้งเตือนเดิมของระบบและแสดงผลในหน้าต่างเดียวกัน', plansDescription:'ดูเฉพาะแผนปัจจุบันและประวัติการใช้งาน ส่วนการเลือกหรือเปลี่ยนแผนให้เปิดจากเมนูหลักเดิม', chooseLanguageDescription:'เลือกภาษาที่ต้องการใช้ในระบบ', selectLanguageLabel:'เลือกภาษา', languagePersistHint:'ระบบจะจำภาษาที่เลือกไว้ และใช้อีกครั้งเมื่อเปิดเว็บใหม่', contactAdminDescription:'หากพบปัญหาการใช้งาน สามารถติดต่อผู้ดูแลระบบได้ ระบบจะบันทึกข้อความไว้ให้แอดมินตรวจสอบ', planHistory:'ประวัติการใช้งาน / ประวัติแผน', planHistoryDescription:'แสดงเฉพาะประวัติคำขอแผนและการชำระเงิน ไม่แสดงรายการเลือกแผนเต็มใน popup', refresh:'รีเฟรช', loadingHistory:'กำลังโหลดประวัติ...', admin:'แอดมิน', regularUser:'ผู้ใช้งานทั่วไป', name:'ชื่อ', email:'อีเมล', status:'สถานะ', settingsMode:'โหมดการตั้งค่า', editInSinglePopup:'แก้ไขใน popup เดียว', nextBillingStart:'เริ่มเดือนถัดไป', courseLimit:'เพิ่มรายวิชาได้', courseUnit:'วิชา', unlimited:'ไม่จำกัด', saveSuccess:'สำเร็จ', saveLanguageDone:'บันทึกภาษาเรียบร้อยแล้ว', saveLocalSuccess:'บันทึกในเครื่องแล้ว', firebaseLanguageSaveFailed:'แต่ยังบันทึกภาษาขึ้น Firebase ไม่ได้', dashboard:'แดชบอร์ด', subscriptionPlan:'แผนการใช้งาน', contactTitle:'หัวข้อ', contactMessage:'รายละเอียดปัญหา', contactEmail:'อีเมลติดต่อกลับ', saveProfile:'บันทึกโปรไฟล์'
    },
    en: {
      settings:'Settings', general:'General', plans:'Subscription Plan', language:'Language', contactAdmin:'Contact Admin', userMessages:'User messages', systemSettings:'System settings', saveLanguage:'Save language', currentPlan:'Current plan', backHome:'Back to home',
      settingsDescription:'Profile, plan, language, and contact settings in one place', generalDescription:'Manage profile, account, and basic options here without opening another popup.', userProfile:'User profile', profileDescription:'Edit your display information here.', accountInfo:'Account information', loadingAccount:'Loading account information...', displayTheme:'Theme / Display', displayThemeDescription:'Keeps the existing display style so scores, grades, and exports are not affected.', languageCardDescription:'Choose the language from the Language menu in settings.', notifications:'Notifications', notificationsDescription:'Uses the existing notification system in the same window.', plansDescription:'Shows only the current plan and usage history. Choose or change plans from the original main menu.', chooseLanguageDescription:'Choose the language you want to use in the system', selectLanguageLabel:'Select language', languagePersistHint:'The system remembers your language and applies it when you reopen the website.', contactAdminDescription:'Contact the administrator if you have a problem. The system records your message for admin review.', planHistory:'Usage / plan history', planHistoryDescription:'Shows only plan requests and payment history, not the full plan selector inside the popup.', refresh:'Refresh', loadingHistory:'Loading history...', admin:'Admin', regularUser:'Regular user', name:'Name', email:'Email', status:'Status', settingsMode:'Settings mode', editInSinglePopup:'Edit in one popup', nextBillingStart:'Next billing start', courseLimit:'Courses allowed', courseUnit:'courses', unlimited:'Unlimited', saveSuccess:'Success', saveLanguageDone:'Language saved successfully', saveLocalSuccess:'Saved locally', firebaseLanguageSaveFailed:'but Firebase language sync failed', dashboard:'Dashboard', subscriptionPlan:'Subscription Plan', contactTitle:'Title', contactMessage:'Problem details', contactEmail:'Contact email', saveProfile:'Save profile'
    }
  };
  const EXTRA_I18N = {
    zh: { settings:'设置', general:'常规', plans:'订阅方案', language:'语言', contactAdmin:'联系管理员', userMessages:'用户消息', systemSettings:'系统设置', saveLanguage:'保存语言', currentPlan:'当前方案', backHome:'返回首页', chooseLanguageDescription:'选择你想在系统中使用的语言', selectLanguageLabel:'选择语言', saveSuccess:'成功', saveLanguageDone:'语言已保存', planHistory:'使用 / 方案历史', refresh:'刷新', admin:'管理员', regularUser:'普通用户', nextBillingStart:'下个计费周期开始', courseLimit:'可添加课程', courseUnit:'门课程', unlimited:'无限' },
    ja: { settings:'設定', general:'一般', plans:'サブスクリプション', language:'言語', contactAdmin:'管理者に連絡', userMessages:'ユーザーメッセージ', systemSettings:'システム設定', saveLanguage:'言語を保存', currentPlan:'現在のプラン', backHome:'ホームへ戻る', chooseLanguageDescription:'システムで使用する言語を選択してください', selectLanguageLabel:'言語を選択', saveSuccess:'完了', saveLanguageDone:'言語を保存しました', planHistory:'利用 / プラン履歴', refresh:'更新', admin:'管理者', regularUser:'一般ユーザー', nextBillingStart:'次回開始日', courseLimit:'追加できる科目', courseUnit:'科目', unlimited:'無制限' },
    ko: { settings:'설정', general:'일반', plans:'구독 플랜', language:'언어', contactAdmin:'관리자 문의', userMessages:'사용자 메시지', systemSettings:'시스템 설정', saveLanguage:'언어 저장', currentPlan:'현재 플랜', backHome:'홈으로 돌아가기', chooseLanguageDescription:'시스템에서 사용할 언어를 선택하세요', selectLanguageLabel:'언어 선택', saveSuccess:'성공', saveLanguageDone:'언어가 저장되었습니다', planHistory:'사용 / 플랜 기록', refresh:'새로고침', admin:'관리자', regularUser:'일반 사용자', nextBillingStart:'다음 시작일', courseLimit:'추가 가능한 과목', courseUnit:'과목', unlimited:'무제한' },
    fr: { settings:'Paramètres', general:'Général', plans:'Abonnement', language:'Langue', contactAdmin:'Contacter l’admin', userMessages:'Messages des utilisateurs', systemSettings:'Paramètres système', saveLanguage:'Enregistrer la langue', currentPlan:'Offre actuelle', backHome:'Retour à l’accueil', chooseLanguageDescription:'Choisissez la langue à utiliser dans le système', selectLanguageLabel:'Choisir la langue', saveSuccess:'Succès', saveLanguageDone:'Langue enregistrée', planHistory:'Historique d’utilisation / d’offre', refresh:'Actualiser', admin:'Admin', regularUser:'Utilisateur', nextBillingStart:'Prochain début', courseLimit:'Cours autorisés', courseUnit:'cours', unlimited:'Illimité' },
    de: { settings:'Einstellungen', general:'Allgemein', plans:'Abo-Plan', language:'Sprache', contactAdmin:'Admin kontaktieren', userMessages:'Benutzernachrichten', systemSettings:'Systemeinstellungen', saveLanguage:'Sprache speichern', currentPlan:'Aktueller Plan', backHome:'Zur Startseite', chooseLanguageDescription:'Wählen Sie die Sprache für das System', selectLanguageLabel:'Sprache auswählen', saveSuccess:'Erfolgreich', saveLanguageDone:'Sprache gespeichert', planHistory:'Nutzungs- / Planverlauf', refresh:'Aktualisieren', admin:'Admin', regularUser:'Benutzer', nextBillingStart:'Nächster Start', courseLimit:'Erlaubte Kurse', courseUnit:'Kurse', unlimited:'Unbegrenzt' },
    es: { settings:'Configuración', general:'General', plans:'Plan de suscripción', language:'Idioma', contactAdmin:'Contactar admin', userMessages:'Mensajes de usuarios', systemSettings:'Configuración del sistema', saveLanguage:'Guardar idioma', currentPlan:'Plan actual', backHome:'Volver al inicio', chooseLanguageDescription:'Elige el idioma que quieres usar en el sistema', selectLanguageLabel:'Seleccionar idioma', saveSuccess:'Éxito', saveLanguageDone:'Idioma guardado', planHistory:'Historial de uso / plan', refresh:'Actualizar', admin:'Admin', regularUser:'Usuario', nextBillingStart:'Próximo inicio', courseLimit:'Cursos permitidos', courseUnit:'cursos', unlimited:'Ilimitado' },
    ar: { settings:'الإعدادات', general:'عام', plans:'خطة الاشتراك', language:'اللغة', contactAdmin:'التواصل مع المسؤول', userMessages:'رسائل المستخدمين', systemSettings:'إعدادات النظام', saveLanguage:'حفظ اللغة', currentPlan:'الخطة الحالية', backHome:'العودة للرئيسية', chooseLanguageDescription:'اختر اللغة التي تريد استخدامها في النظام', selectLanguageLabel:'اختر اللغة', saveSuccess:'تم بنجاح', saveLanguageDone:'تم حفظ اللغة', planHistory:'سجل الاستخدام / الخطة', refresh:'تحديث', admin:'مسؤول', regularUser:'مستخدم عادي', nextBillingStart:'بداية الفترة التالية', courseLimit:'عدد المقررات المسموح', courseUnit:'مقررات', unlimited:'غير محدود' },
    lo: { settings:'ຕັ້ງຄ່າ', general:'ທົ່ວໄປ', plans:'ແຜນການໃຊ້ງານ', language:'ພາສາ', contactAdmin:'ຕິດຕໍ່ຜູ້ດູແລ', userMessages:'ຂໍ້ຄວາມຈາກຜູ້ໃຊ້', systemSettings:'ຕັ້ງຄ່າລະບົບ', saveLanguage:'ບັນທຶກພາສາ', currentPlan:'ແຜນປັດຈຸບັນ', backHome:'ກັບໜ້າຫຼັກ', chooseLanguageDescription:'ເລືອກພາສາທີ່ຕ້ອງການໃຊ້ໃນລະບົບ', selectLanguageLabel:'ເລືອກພາສາ', saveSuccess:'ສຳເລັດ', saveLanguageDone:'ບັນທຶກພາສາແລ້ວ', planHistory:'ປະຫວັດແຜນ', refresh:'ໂຫຼດໃໝ່', admin:'ແອດມິນ', regularUser:'ຜູ້ໃຊ້ທົ່ວໄປ', nextBillingStart:'ເລີ່ມເດືອນຕໍ່ໄປ', courseLimit:'ເພີ່ມວິຊາໄດ້', courseUnit:'ວິຊາ', unlimited:'ບໍ່ຈຳກັດ' },
    my: { settings:'ဆက်တင်များ', general:'အထွေထွေ', plans:'အသုံးပြုမှုအစီအစဉ်', language:'ဘာသာစကား', contactAdmin:'အက်ဒမင်ကို ဆက်သွယ်ရန်', userMessages:'အသုံးပြုသူ မက်ဆေ့ချ်များ', systemSettings:'စနစ်ဆက်တင်များ', saveLanguage:'ဘာသာစကား သိမ်းမည်', currentPlan:'လက်ရှိအစီအစဉ်', backHome:'မူလစာမျက်နှာသို့', chooseLanguageDescription:'စနစ်တွင် အသုံးပြုလိုသော ဘာသာစကားကို ရွေးပါ', selectLanguageLabel:'ဘာသာစကားရွေးပါ', saveSuccess:'အောင်မြင်သည်', saveLanguageDone:'ဘာသာစကား သိမ်းပြီးပါပြီ', planHistory:'အသုံးပြုမှု / အစီအစဉ် မှတ်တမ်း', refresh:'ပြန်လည်တင်ရန်', admin:'အက်ဒမင်', regularUser:'ပုံမှန်အသုံးပြုသူ', nextBillingStart:'နောက်လ စတင်ချိန်', courseLimit:'ထည့်နိုင်သောဘာသာရပ်', courseUnit:'ဘာသာရပ်', unlimited:'အကန့်အသတ်မရှိ' },
    km: { settings:'ការកំណត់', general:'ទូទៅ', plans:'គម្រោងប្រើប្រាស់', language:'ភាសា', contactAdmin:'ទាក់ទងអ្នកគ្រប់គ្រង', userMessages:'សារពីអ្នកប្រើ', systemSettings:'ការកំណត់ប្រព័ន្ធ', saveLanguage:'រក្សាទុកភាសា', currentPlan:'គម្រោងបច្ចុប្បន្ន', backHome:'ត្រឡប់ទៅទំព័រដើម', chooseLanguageDescription:'ជ្រើសរើសភាសាដែលចង់ប្រើក្នុងប្រព័ន្ធ', selectLanguageLabel:'ជ្រើសរើសភាសា', saveSuccess:'ជោគជ័យ', saveLanguageDone:'បានរក្សាទុកភាសា', planHistory:'ប្រវត្តិប្រើប្រាស់ / គម្រោង', refresh:'ផ្ទុកឡើងវិញ', admin:'អ្នកគ្រប់គ្រង', regularUser:'អ្នកប្រើធម្មតា', nextBillingStart:'ចាប់ផ្តើមខែក្រោយ', courseLimit:'បន្ថែមមុខវិជ្ជាបាន', courseUnit:'មុខវិជ្ជា', unlimited:'មិនកំណត់' },
    vi: { settings:'Cài đặt', general:'Chung', plans:'Gói đăng ký', language:'Ngôn ngữ', contactAdmin:'Liên hệ quản trị', userMessages:'Tin nhắn người dùng', systemSettings:'Cài đặt hệ thống', saveLanguage:'Lưu ngôn ngữ', currentPlan:'Gói hiện tại', backHome:'Về trang chủ', chooseLanguageDescription:'Chọn ngôn ngữ bạn muốn dùng trong hệ thống', selectLanguageLabel:'Chọn ngôn ngữ', saveSuccess:'Thành công', saveLanguageDone:'Đã lưu ngôn ngữ', planHistory:'Lịch sử sử dụng / gói', refresh:'Làm mới', admin:'Quản trị', regularUser:'Người dùng thường', nextBillingStart:'Bắt đầu kỳ tới', courseLimit:'Số môn được thêm', courseUnit:'môn', unlimited:'Không giới hạn' }
  };
  window.SCHOOLHUB_I18N = Object.assign({}, I18N_BASE, Object.fromEntries(Object.entries(EXTRA_I18N).map(([lang, value]) => [lang, Object.assign({}, I18N_BASE.en, value)])));
  Object.assign(window.SCHOOLHUB_I18N.th, { saveProfile:'บันทึกโปรไฟล์' });
  Object.assign(window.SCHOOLHUB_I18N.en, { saveProfile:'Save profile' });
  Object.keys(window.SCHOOLHUB_I18N).forEach(lang => { if (!window.SCHOOLHUB_I18N[lang].saveProfile) window.SCHOOLHUB_I18N[lang].saveProfile = window.SCHOOLHUB_I18N.en.saveProfile; });

  function currentLang(){
    const raw = localStorage.getItem('schoolhub_language') || 'th';
    return window.SCHOOLHUB_I18N?.[raw] ? raw : 'th';
  }
  function languageLocale(){ return LOCALE_BY_LANG[currentLang()] || 'th-TH'; }
  function t(key){
    const lang = currentLang();
    return window.SCHOOLHUB_I18N?.[lang]?.[key] || window.SCHOOLHUB_I18N?.th?.[key] || key;
  }
  window.t = t;

  function setDocumentLanguage(){
    const lang = currentLang();
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }

  function bindButtonLabel(id, key){
    const btn = $(id);
    if (!btn || btn.dataset.schoolhubI18nBound === key) return;
    const icon = btn.querySelector('i')?.outerHTML || '';
    btn.innerHTML = `${icon ? icon + ' ' : ''}<span data-i18n="${key}">${esc(t(key))}</span>`;
    btn.dataset.schoolhubI18nBound = key;
  }

  function bindImportantI18nElements(){
    bindButtonLabel('nav-admin-settings', 'settings');
    bindButtonLabel('mobile-nav-settings', 'settings');
    bindButtonLabel('mobile-nav-admin-settings', 'settings');
    bindButtonLabel('nav-admin-plans', 'plans');
    const pageTitle = $('page-title');
    if (pageTitle && pageTitle.children.length === 0) {
      const pageMap = {'ตั้งค่า':'settings','Settings':'settings','แผนการใช้งาน':'plans','Subscription Plan':'plans'};
      const key = pageMap[norm(pageTitle.textContent)];
      pageTitle.removeAttribute('data-i18n');
      if (key) pageTitle.textContent = t(key);
    }
    document.querySelectorAll('a,button,span,h1,h2,h3,h4,h5,label,p,div').forEach(el => {
      if (el.id === 'page-title' || el.children.length > 0 || el.dataset.i18n) return;
      const exact = norm(el.textContent);
      const autoMap = {
        'ตั้งค่า':'settings', 'ทั่วไป':'general', 'แผนการใช้งาน':'plans', 'ภาษา':'language', 'ติดต่อผู้ดูแลระบบ':'contactAdmin', 'ข้อความจากผู้ใช้':'userMessages', 'กลับหน้าหลัก':'backHome',
        'Settings':'settings', 'General':'general', 'Subscription Plan':'plans', 'Language':'language', 'Contact Admin':'contactAdmin', 'User messages':'userMessages', 'Back to home':'backHome'
      };
      if (autoMap[exact]) el.setAttribute('data-i18n', autoMap[exact]);
    });
  }

  function applyLanguage(){
    setDocumentLanguage();
    bindImportantI18nElements();
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      el.setAttribute('placeholder', t(key));
    });
    const select = $('settings-language-select');
    if (select) select.value = currentLang();
    try { refreshAdminMessageBadges(); } catch(e) {}
    try {
      const langNow = currentLang();
      const scope = $('settings-modal') || document.getElementById('schoolhub-settings-modal') || null;
      if (langNow !== 'th' && scope && typeof window.schoolhubQueueRuntimeTranslation === 'function') window.schoolhubQueueRuntimeTranslation(scope);
    } catch(e) {}
  }
  window.applyLanguage = applyLanguage;

  function buildLanguageOptions(){
    const lang = currentLang();
    return LANGUAGE_OPTIONS.map(([code, label]) => `<option value="${esc(code)}" ${code === lang ? 'selected' : ''}>${esc(label)} (${esc(code)})</option>`).join('');
  }

  function renderLanguagePanel(){
    try {
      const panel = ensureSettingsPanel('language');
      if (!panel) throw new Error('settings-panel-language not found');
      panel.className = 'schoolhub-settings-panel space-y-5';
      panel.innerHTML = createLanguagePanelHTML();
      bindLanguagePanelEvents();
      const select = $('settings-language-select');
      if (select) {
        select.innerHTML = buildLanguageOptions();
        select.value = currentLang();
      }
      applyLanguage();
      forceSettingsContentVisible();
      unlockSettingsControls();
      return panel;
    } catch(e) {
      console.error('Language panel render failed', e);
      const panel = ensureSettingsPanel('language');
      if (panel) panel.innerHTML = `<div class=\"rounded-3xl border border-rose-100 bg-rose-50 p-5 text-rose-700 font-bold\">โหลดหน้า ภาษา ไม่สำเร็จ: ${esc(e?.message || String(e))}</div>`;
      return panel || null;
    }
  }

  async function saveUserLanguageToFirebase(lang){
    const authUser = auth.currentUser || window.currentUser || null;
    const email = norm(authUser?.email || $('user-display-email')?.textContent || localStorage.getItem('schoolhub_admin_email')).toLowerCase();
    const payload = { language: lang, preferredLanguage: lang, settings: { language: lang }, updatedAt: serverTimestamp() };
    if (isAdminSession()) {
      try { await setDoc(doc(db, 'admin_settings', 'credentials'), payload, { merge:true }); } catch(e) { console.warn('admin language sync skipped:', e); }
    }
    if (!email && !authUser?.uid) return;
    const key = email || authUser.uid;
    await setDoc(doc(db, 'public_users_directory', key), Object.assign({}, payload, { uid: authUser?.uid || '', email: email || authUser?.email || '' }), { merge:true });
  }
  window.saveUserLanguageToFirebase = saveUserLanguageToFirebase;

  window.saveLanguageSetting = async function(){
    const lang = $('settings-language-select')?.value || 'th';
    localStorage.setItem('schoolhub_language', lang);
    setDocumentLanguage();
    try { if (typeof window.applyLanguageFullOnce === 'function') window.applyLanguageFullOnce(); } catch(e) {}
    try {
      await saveUserLanguageToFirebase(lang);
      applyLanguage();
      try { renderCurrentPlanCard('schoolhub-settings-current-plan-card'); renderCurrentPlanCard('user-current-plan-box'); } catch(e){}
      try { if (typeof window.renderSchoolHubSettings === 'function') window.renderSchoolHubSettings(); } catch(e){}
      applyLanguage();
      alertBox(t('saveSuccess'), t('saveLanguageDone'));
    } catch(e) {
      applyLanguage();
      try { if (typeof window.renderSchoolHubSettings === 'function') window.renderSchoolHubSettings(); } catch(err){}
      alertBox(t('saveLocalSuccess'), `${t('firebaseLanguageSaveFailed')}: ${e?.message || String(e)}`, true);
    }
  };

  function alertBox(title, message, danger){
    if (typeof window.showCustomAlert === 'function') return window.showCustomAlert(title, message, !!danger);
    window.alert(`${title}\n${message || ''}`);
  }
  function loader(show){ try { if (typeof window.toggleLoader === 'function') window.toggleLoader(!!show); } catch(e){} }

  function isAdminSession(){
    const nameText = norm($('user-display-name')?.textContent).toLowerCase();
    const emailText = norm($('user-display-email')?.textContent).toLowerCase();
    return window.isAdmin === true
      || window.isAdminUser === true
      || localStorage.getItem('schoolhub_admin_active') === 'true'
      || localStorage.getItem('schoolhub_admin_logged_in') === 'true'
      || localStorage.getItem('schoolhub_admin_bypass') === 'true'
      || nameText.includes('admin')
      || emailText === 'admin';
  }

  function normalizeTab(tab){
    tab = norm(tab || 'general') || 'general';
    const map = {
      'general-settings': 'general',
      'profile': 'general',
      'account': 'general',
      'plan': 'plans',
      'user-plans': 'plans',
      'subscription': 'plans',
      'lang': 'language',
      'languages': 'language',
      'locale': 'language',
      'admin-contact': 'contact-admin',
      'admin-messages': 'contact-messages',
      'messages': 'contact-messages',
      'system': 'admin-system'
    };
    return map[tab] || tab;
  }

  function unlockSettingsControls(){
    const modal = $('settings-modal');
    if (!modal) return;
    modal.querySelectorAll('button,input,textarea,select,a').forEach(el => {
      el.setAttribute('data-schoolhub-always-allowed', '1');
      el.disabled = false;
      el.removeAttribute('disabled');
      el.removeAttribute('aria-disabled');
      el.style.pointerEvents = 'auto';
      el.classList.remove('pointer-events-none','opacity-50','opacity-40','cursor-not-allowed','schoolhub-locked-action-stable','sh-permission-disabled');
    });
  }

  function settingsPanelId(tab){
    return `schoolhub-settings-panel-${normalizeTab(tab)}`;
  }

  function ensureSettingsContent(){
    const modal = $('settings-modal');
    if (!modal) return null;

    const dialog = modal.querySelector('.settings-dialog') || modal;
    let content = null;
    try {
      content = dialog.querySelector(':scope > .settings-content');
    } catch(e) {
      content = Array.from(dialog.children || []).find(el => el.classList && el.classList.contains('settings-content')) || null;
    }

    if (!content) {
      content = document.createElement('div');
      content.className = 'settings-content';
      content.setAttribute('data-schoolhub-settings-content', '1');
      content.setAttribute('data-schoolhub-always-allowed', '1');
      dialog.appendChild(content);
      console.warn('Settings content container was missing; recreated .settings-content inside #settings-modal .settings-dialog');
    }

    content.hidden = false;
    content.classList.remove('hidden');
    content.setAttribute('data-schoolhub-settings-content', '1');
    content.setAttribute('data-schoolhub-always-allowed', '1');
    content.style.display = 'block';
    content.style.visibility = 'visible';
    content.style.opacity = '1';
    content.style.pointerEvents = 'auto';
    content.style.overflowY = 'auto';
    content.style.overflowX = 'hidden';
    content.style.minHeight = '0';

    return content;
  }

  function ensureSettingsPanel(tab){
    tab = normalizeTab(tab || 'general');
    const content = ensureSettingsContent();
    if (!content) return null;

    const id = settingsPanelId(tab);
    let panel = $(id);

    if (!panel && tab === 'general') {
      const legacyGeneralId = ['settings', 'panel', 'general'].join('-');
      const legacyPanel = document.getElementById(legacyGeneralId);
      if (legacyPanel) {
        legacyPanel.id = id;
        panel = legacyPanel;
      }
    }

    if (!panel) {
      panel = document.createElement('section');
      panel.id = id;
      panel.className = 'schoolhub-settings-panel hidden space-y-5';
      console.warn(`Settings panel ${id} was missing; recreated before render`);
    }

    if (panel.parentElement !== content) {
      content.appendChild(panel);
    }

    panel.classList.add('schoolhub-settings-panel');
    panel.setAttribute('data-schoolhub-settings-panel', tab);
    panel.setAttribute('data-schoolhub-always-allowed', '1');
    if (tab === 'general') panel.setAttribute('data-settings-panel-id', 'schoolhub-settings-panel-general');
    return panel;
  }

  function ensureCoreSettingsPanels(){
    ['general','plans','language','contact-admin','admin-system','contact-messages'].forEach(ensureSettingsPanel);
  }

  function forceSettingsContentVisible(){
    const modal = $('settings-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    const content = ensureSettingsContent();
    if (!content) return;

    content.hidden = false;
    content.classList.remove('hidden');
    content.style.display = 'block';
    content.style.visibility = 'visible';
    content.style.opacity = '1';
    content.style.pointerEvents = 'auto';
    content.style.overflowY = 'auto';
    content.style.overflowX = 'hidden';
    content.style.minHeight = '0';

    const tab = normalizeTab(window.__schoolhubSettingsActiveTab || 'general');
    const activePanel = ensureSettingsPanel(tab);
    if (activePanel) {
      activePanel.hidden = false;
      activePanel.classList.remove('hidden');
      activePanel.style.display = 'block';
      activePanel.style.visibility = 'visible';
      activePanel.style.opacity = '1';
      activePanel.style.pointerEvents = 'auto';
    }
  }

  function createGeneralPanelHTML(){
    return `
      <div class="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-5">
        <h4 class="text-lg font-black text-slate-900"><i class="fas fa-circle-info text-primary mr-2"></i><span data-i18n="general">${esc(t('general'))}</span></h4>
        <p class="text-sm text-slate-600 leading-7 mt-2" data-i18n="generalDescription">${esc(t('generalDescription'))}</p>
      </div>
      <div class="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
        <div class="xl:col-span-3 bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
          <div class="flex items-center justify-between gap-3 mb-4"><div>
            <h5 class="text-lg font-black text-slate-900"><i class="fas fa-user-circle text-primary mr-2"></i><span data-i18n="userProfile">${esc(t('userProfile'))}</span></h5>
            <p class="text-sm text-slate-500 mt-1" data-i18n="profileDescription">${esc(t('profileDescription'))}</p>
          </div></div>
          <div id="schoolhub-settings-profile-host" class="schoolhub-settings-inline-profile" data-schoolhub-always-allowed="1"></div>
        </div>
        <div class="xl:col-span-2 space-y-4">
          <div class="rounded-3xl border border-slate-100 bg-slate-50 p-5"><h5 class="font-black text-slate-900"><i class="fas fa-id-card text-slate-500 mr-2"></i><span data-i18n="accountInfo">${esc(t('accountInfo'))}</span></h5><div id="schoolhub-settings-account-summary" class="text-sm text-slate-600 leading-7 mt-3"><span data-i18n="loadingAccount">${esc(t('loadingAccount'))}</span></div></div>
          <div class="rounded-3xl border border-slate-100 bg-white p-5"><h5 class="font-black text-slate-900"><i class="fas fa-palette text-indigo-500 mr-2"></i><span data-i18n="displayTheme">${esc(t('displayTheme'))}</span></h5><p class="text-sm text-slate-500 leading-7 mt-2" data-i18n="displayThemeDescription">${esc(t('displayThemeDescription'))}</p></div>
          <div class="rounded-3xl border border-slate-100 bg-white p-5"><h5 class="font-black text-slate-900"><i class="fas fa-language text-sky-600 mr-2"></i><span data-i18n="language">${esc(t('language'))}</span></h5><p class="text-sm text-slate-500 leading-7 mt-2" data-i18n="languageCardDescription">${esc(t('languageCardDescription'))}</p><button type="button" data-open-language-panel data-schoolhub-always-allowed="1" class="mt-3 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-100 px-4 py-2 rounded-xl text-sm font-black"><i class="fas fa-language mr-1"></i> <span data-i18n="language">${esc(t('language'))}</span></button></div>
          <div class="rounded-3xl border border-slate-100 bg-white p-5"><h5 class="font-black text-slate-900"><i class="fas fa-bell text-amber-500 mr-2"></i><span data-i18n="notifications">${esc(t('notifications'))}</span></h5><p class="text-sm text-slate-500 leading-7 mt-2" data-i18n="notificationsDescription">${esc(t('notificationsDescription'))}</p></div>
        </div>
      </div>
      <div id="schoolhub-tour-settings-host" data-schoolhub-always-allowed="1"></div>`;
  }

  function bindGeneralPanelEvents(){
    const panel = ensureSettingsPanel('general');
    if (!panel) return;
    const saveBtn = panel.querySelector('[data-settings-save-profile]');
    if (saveBtn && saveBtn.dataset.schoolhubBound !== '1') {
      saveBtn.dataset.schoolhubBound = '1';
      saveBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); window.saveSettingsProfileChanges?.(); });
    }
    const resetBtn = panel.querySelector('[data-settings-reset-password]');
    if (resetBtn && resetBtn.dataset.schoolhubBound !== '1') {
      resetBtn.dataset.schoolhubBound = '1';
      resetBtn.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        if (typeof window.openResetPasswordPage === 'function') return window.openResetPasswordPage(e);
        window.open('reset-password.html', '_blank');
        return false;
      });
    }
    panel.querySelectorAll('[data-open-language-panel]').forEach(btn => {
      if (btn.dataset.schoolhubBound === '1') return;
      btn.dataset.schoolhubBound = '1';
      btn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); setActiveTab('language'); });
    });
  }

  function renderGeneralPanel(){
    // Settings final source of truth: general panel must render directly into #schoolhub-settings-panel-general.
    return renderSettingsPanel('general');
  }

  function createPlansPanelHTML(){
    return `<div class="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5"><h4 class="text-lg font-black text-slate-900"><i class="fas fa-layer-group text-emerald-600 mr-2"></i><span data-i18n="plans">${esc(t('plans'))}</span></h4><p class="text-sm text-slate-600 leading-7 mt-2" data-i18n="plansDescription">${esc(t('plansDescription'))}</p></div><div id="schoolhub-settings-user-plan-host" class="space-y-5" data-schoolhub-always-allowed="1"></div>`;
  }

  function createLanguagePanelHTML(){
    return `<div class="rounded-3xl border border-sky-100 bg-sky-50/60 p-5"><h4 class="text-xl font-black text-slate-900"><i class="fas fa-language text-sky-600 mr-2"></i><span data-i18n="language">${esc(t('language'))}</span></h4><p class="text-sm text-slate-600 leading-7 mt-2" data-i18n="chooseLanguageDescription">${esc(t('chooseLanguageDescription'))}</p></div><div class="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4"><div><label for="settings-language-select" class="block text-sm font-black text-slate-700 mb-2" data-i18n="selectLanguageLabel">${esc(t('selectLanguageLabel'))}</label><select id="settings-language-select" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500" data-schoolhub-always-allowed="1"></select><p class="text-xs text-slate-500 mt-2" data-i18n="languagePersistHint">${esc(t('languagePersistHint'))}</p></div><button type="button" data-save-language-setting data-schoolhub-always-allowed="1" class="bg-sky-600 hover:bg-sky-700 text-white px-5 py-3 rounded-2xl font-black shadow-sm inline-flex items-center gap-2"><i class="fas fa-save"></i><span data-i18n="saveLanguage">${esc(t('saveLanguage'))}</span></button></div>`;
  }

  function bindLanguagePanelEvents(){
    const panel = ensureSettingsPanel('language');
    const saveBtn = panel?.querySelector('[data-save-language-setting]');
    if (saveBtn && saveBtn.dataset.schoolhubBound !== '1') {
      saveBtn.dataset.schoolhubBound = '1';
      saveBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); window.saveLanguageSetting?.(); });
    }
  }

  function createContactAdminPanelHTML(){
    return `<div class="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start"><div class="xl:col-span-2 rounded-3xl bg-indigo-50 border border-indigo-100 p-5"><h4 class="text-xl font-black text-slate-900"><i class="fas fa-headset text-primary mr-2"></i><span data-i18n="contactAdmin">${esc(t('contactAdmin'))}</span></h4><p class="text-sm text-slate-600 leading-7 mt-3" data-i18n="contactAdminDescription">${esc(t('contactAdminDescription'))}</p><div class="mt-4 rounded-2xl bg-white/80 border border-indigo-100 p-4 text-sm text-slate-600 leading-7"><b>คำแนะนำ:</b> ระบุเมนูที่พบปัญหา อุปกรณ์ที่ใช้ และขั้นตอนก่อนเกิดปัญหา เพื่อให้ผู้ดูแลตรวจสอบได้เร็วขึ้น</div></div><form id="schoolhub-admin-contact-form" class="xl:col-span-3 bg-white border border-slate-100 rounded-3xl p-5 space-y-4 shadow-sm"><div><label class="block text-sm font-black text-slate-700 mb-1.5">หัวข้อ</label><input id="schoolhub-contact-title" type="text" required maxlength="120" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-primary" placeholder="เช่น Export ไม่ปิด / คะแนนไม่แสดง / ขอความช่วยเหลือ" data-schoolhub-always-allowed="1"></div><div><label class="block text-sm font-black text-slate-700 mb-1.5">รายละเอียดปัญหา</label><textarea id="schoolhub-contact-message" required rows="7" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-primary resize-y min-h-[180px]" placeholder="พิมพ์รายละเอียดปัญหาหรือข้อความที่ต้องการแจ้งผู้ดูแลระบบ" data-schoolhub-always-allowed="1"></textarea></div><div><label class="block text-sm font-black text-slate-700 mb-1.5">อีเมลติดต่อกลับ</label><input id="schoolhub-contact-email" type="email" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-primary" placeholder="อีเมลสำหรับให้ผู้ดูแลติดต่อกลับ" data-schoolhub-always-allowed="1"></div><button id="schoolhub-contact-submit-btn" type="submit" data-schoolhub-always-allowed="1" class="w-full bg-primary hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 text-base"><i class="fas fa-paper-plane"></i> ส่งข้อความถึงผู้ดูแลระบบ</button></form><div class="xl:col-span-5 bg-white border border-slate-100 rounded-3xl p-5 shadow-sm"><div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4"><div><h5 class="text-lg font-black text-slate-900"><i class="fas fa-clock-rotate-left text-indigo-500 mr-2"></i>ประวัติการแจ้ง</h5><p class="text-sm text-slate-500 mt-1">แสดงข้อความที่คุณเคยส่งถึงผู้ดูแลระบบ พร้อมสถานะล่าสุดจากแอดมิน</p></div><button type="button" data-refresh-user-contact-history data-schoolhub-always-allowed="1" class="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-black"><i class="fas fa-sync-alt mr-1"></i> รีเฟรช</button></div><div id="schoolhub-user-contact-history-list" class="space-y-3"><div class="text-center text-slate-400 py-8 border border-dashed border-slate-200 rounded-2xl"><i class="fas fa-spinner fa-spin mr-1"></i> กำลังโหลดประวัติการแจ้ง...</div></div></div></div>`;
  }

  function bindContactAdminPanelEvents(){
    const panel = ensureSettingsPanel('contact-admin');
    const form = panel?.querySelector('#schoolhub-admin-contact-form');
    if (form && form.dataset.schoolhubBound !== '1') {
      form.dataset.schoolhubBound = '1';
      form.addEventListener('submit', function(e){ e.preventDefault(); e.stopPropagation(); window.submitSchoolHubAdminContactMessage?.(e); });
    }
    const refreshBtn = panel?.querySelector('[data-refresh-user-contact-history]');
    if (refreshBtn && refreshBtn.dataset.schoolhubBound !== '1') {
      refreshBtn.dataset.schoolhubBound = '1';
      refreshBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); window.loadUserContactMessageHistory?.(true); });
    }
  }

  function renderContactAdminPanel(){
    const panel = ensureSettingsPanel('contact-admin');
    try {
      if (!panel) throw new Error('settings-panel-contact-admin not found');
      panel.className = 'schoolhub-settings-panel';
      panel.innerHTML = createContactAdminPanelHTML();
      bindContactAdminPanelEvents();
      prefillContactEmail();
      try { startUserContactHistoryRealtime(false, true); } catch(e) { console.error('Contact admin panel render failed', e); }
      applyLanguage();
      forceSettingsContentVisible();
      unlockSettingsControls();
      return panel;
    } catch(e) {
      console.error('Contact admin panel render failed', e);
      if (panel) panel.innerHTML = `<div class="rounded-3xl border border-rose-100 bg-rose-50 p-5 text-rose-700 font-bold">โหลดหน้า ติดต่อผู้ดูแลระบบ ไม่สำเร็จ: ${esc(e?.message || String(e))}</div>`;
      return panel || null;
    }
  }

  function createAdminSystemPanelHTML(){
    return `<div class="rounded-3xl border border-rose-100 bg-rose-50/50 p-5"><h4 class="text-xl font-black text-slate-900"><i class="fas fa-sliders text-rose-500 mr-2"></i>ตั้งค่าระบบ</h4><p class="text-sm text-slate-500 mt-1">เมนูแอดมินที่เกี่ยวข้องกับการตั้งค่า แสดงในหน้าต่างตั้งค่านี้โดยไม่เปิดหน้าต่างซ้อน</p></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><button type="button" data-open-admin-messages data-schoolhub-always-allowed="1" class="rounded-3xl border border-sky-100 bg-white p-5 text-left hover:shadow-md transition"><i class="fas fa-inbox text-sky-600 text-2xl mb-3 block"></i><b class="text-slate-900">ข้อความจากผู้ใช้ <span class="admin-message-badge hidden" data-admin-message-badge="admin-system-card">0</span></b><p class="text-sm text-slate-500 mt-1">ดูรายการที่ผู้ใช้ส่งถึงผู้ดูแลระบบ</p></button><button type="button" data-open-plans-panel data-schoolhub-always-allowed="1" class="rounded-3xl border border-emerald-100 bg-white p-5 text-left hover:shadow-md transition"><i class="fas fa-layer-group text-emerald-600 text-2xl mb-3 block"></i><b class="text-slate-900">จัดการแผน</b><p class="text-sm text-slate-500 mt-1">ดูแผนและรายการแผนในพื้นที่ด้านขวา</p></button></div>`;
  }

  function bindAdminSystemPanelEvents(){
    const panel = ensureSettingsPanel('admin-system');
    panel?.querySelector('[data-open-admin-messages]')?.addEventListener('click', function(e){ e.preventDefault(); setActiveTab('contact-messages'); });
    panel?.querySelector('[data-open-plans-panel]')?.addEventListener('click', function(e){ e.preventDefault(); setActiveTab('plans'); });
  }

  function renderAdminSystemPanel(){
    const panel = ensureSettingsPanel('admin-system');
    try {
      if (!panel) throw new Error('settings-panel-admin-system not found');
      panel.className = 'schoolhub-settings-panel space-y-4';
      panel.innerHTML = createAdminSystemPanelHTML();
      bindAdminSystemPanelEvents();
      refreshAdminMessageBadges();
      applyLanguage();
      forceSettingsContentVisible();
      unlockSettingsControls();
      return panel;
    } catch(e) {
      console.error('Admin system panel render failed', e);
      if (panel) panel.innerHTML = `<div class="rounded-3xl border border-rose-100 bg-rose-50 p-5 text-rose-700 font-bold">โหลดหน้า ตั้งค่าระบบ ไม่สำเร็จ: ${esc(e?.message || String(e))}</div>`;
      return panel || null;
    }
  }

  function createAdminMessagesPanelHTML(){
    return `<div class="rounded-3xl border border-rose-100 bg-rose-50/50 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><h4 class="text-xl font-black text-slate-900"><i class="fas fa-inbox text-rose-500 mr-2"></i>ข้อความจากผู้ใช้</h4><p class="text-sm text-slate-500 mt-1">รายการข้อความที่ผู้ใช้ส่งถึงผู้ดูแลระบบ</p></div><button type="button" data-refresh-admin-messages data-schoolhub-always-allowed="1" class="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl font-black"><i class="fas fa-sync-alt mr-1"></i> รีเฟรช</button></div><div id="schoolhub-admin-contact-message-list" class="grid grid-cols-1 gap-4"><div class="text-center text-slate-400 py-10 bg-white rounded-3xl border border-dashed border-slate-200"><i class="fas fa-spinner fa-spin mr-1"></i> กำลังโหลดข้อความ...</div></div>`;
  }

  function bindAdminMessagesPanelEvents(){
    const panel = ensureSettingsPanel('contact-messages');
    const refreshBtn = panel?.querySelector('[data-refresh-admin-messages]');
    if (refreshBtn && refreshBtn.dataset.schoolhubBound !== '1') {
      refreshBtn.dataset.schoolhubBound = '1';
      refreshBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); window.loadAdminContactMessages?.(); });
    }
  }

  function renderAdminMessagesPanel(){
    const panel = ensureSettingsPanel('contact-messages');
    try {
      if (!panel) throw new Error('settings-panel-contact-messages not found');
      panel.className = 'schoolhub-settings-panel space-y-4';
      panel.innerHTML = createAdminMessagesPanelHTML();
      bindAdminMessagesPanelEvents();
      window.loadAdminContactMessages?.();
      refreshAdminMessageBadges();
      applyLanguage();
      forceSettingsContentVisible();
      unlockSettingsControls();
      return panel;
    } catch(e) {
      console.error('Admin messages panel render failed', e);
      if (panel) panel.innerHTML = `<div class="rounded-3xl border border-rose-100 bg-rose-50 p-5 text-rose-700 font-bold">โหลดหน้า ข้อความจากผู้ใช้ ไม่สำเร็จ: ${esc(e?.message || String(e))}</div>`;
      return panel || null;
    }
  }

  function renderProfilePanel(force = false){
    const host = $('schoolhub-settings-profile-host');
    if (!host) return;
    if (!force && host.dataset.schoolhubProfilePanelRendered === '1' && host.querySelector('#settings-profile-display-name-input')) return;
    host.innerHTML = `
      <div class="space-y-4 settings-profile-form" data-schoolhub-always-allowed="1">
        <div class="flex items-center gap-4 pb-2">
          <div class="relative w-20 h-20 shrink-0">
            <div id="settings-profile-avatar-initial" class="w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-purple-500 text-white flex items-center justify-center text-2xl font-bold shadow-md">U</div>
            <img id="settings-profile-avatar-img" class="hidden absolute inset-0 w-20 h-20 rounded-full object-cover border-2 border-white shadow-md" alt="รูปโปรไฟล์">
            <button type="button" id="settings-profile-avatar-pick-btn" data-schoolhub-always-allowed="1" class="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg border-2 border-white transition"><i class="fas fa-camera text-xs"></i></button>
            <input type="file" id="settings-profile-avatar-input" accept="image/*" class="hidden" data-schoolhub-always-allowed="1">
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-bold text-slate-700">รูปโปรไฟล์</div>
            <div class="text-xs text-slate-400 mt-0.5 leading-5">อัปโหลดรูป JPG/PNG ระบบจะบีบอัดให้อัตโนมัติก่อนบันทึก</div>
            <button type="button" id="settings-profile-avatar-remove-btn" data-schoolhub-always-allowed="1" class="hidden mt-2 text-xs font-bold text-rose-500 hover:text-rose-700"><i class="fas fa-trash mr-1"></i>ลบรูปโปรไฟล์</button>
          </div>
        </div>
        <div id="settings-profile-admin-username-wrap" class="hidden">
          <label class="block text-sm font-bold text-slate-700 mb-1.5">ชื่อผู้ใช้ Admin</label>
          <input id="settings-profile-admin-username-input" type="text" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-primary" placeholder="เช่น Admin" data-schoolhub-always-allowed="1">
        </div>
        <div>
          <label class="block text-sm font-bold text-slate-700 mb-1.5">ชื่อที่แสดง</label>
          <input id="settings-profile-display-name-input" type="text" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-primary" placeholder="ชื่อ - นามสกุล" data-schoolhub-always-allowed="1">
        </div>
        <div>
          <label class="block text-sm font-bold text-slate-700 mb-1.5">อีเมล</label>
          <input id="settings-profile-email-input" type="text" class="w-full bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 text-slate-500" readonly data-schoolhub-always-allowed="1">
        </div>
        <div id="settings-admin-profile-password-wrap" class="hidden bg-rose-50 border border-rose-100 rounded-2xl p-4">
          <label class="block text-sm font-bold text-rose-700 mb-1.5">รหัสผ่าน Admin ใหม่</label>
          <input id="settings-admin-profile-password-input" type="password" class="w-full bg-white border border-rose-200 rounded-2xl px-4 py-3 outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-400" placeholder="เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน" data-schoolhub-always-allowed="1">
          <p class="text-xs text-rose-500 mt-2">บัญชี Admin สามารถแก้ชื่อผู้ใช้ อีเมล และรหัสผ่านได้จาก Settings โดยตรง</p>
        </div>
        <div class="grid grid-cols-1 gap-3 pt-2">
          <button type="button" data-settings-save-profile data-schoolhub-always-allowed="1" class="w-full bg-primary hover:bg-indigo-700 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-indigo-100 transition"><i class="fas fa-save mr-1"></i> <span data-i18n="saveProfile">บันทึกโปรไฟล์</span></button>
          <button type="button" data-settings-reset-password class="forgot-password-link w-full bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold py-3.5 rounded-2xl border border-amber-200 transition" data-schoolhub-always-allowed="1"><i class="fas fa-key mr-1"></i> ขอรีเซ็ตรหัสผ่าน</button>
        </div>
      </div>
    `;
    host.dataset.schoolhubProfilePanelRendered = '1';
  }

  function ensureAdminProfileFields(){
    renderProfilePanel();
    const saveBtn = document.querySelector('#schoolhub-settings-profile-host button[onclick*="saveSettingsProfileChanges"] span[data-i18n="saveProfile"]');
    if (saveBtn) saveBtn.textContent = 'บันทึกโปรไฟล์';
  }

  function moveProfileIntoSettings(){
    // Do not move the original #user-profile-modal DOM. Settings uses its own inline form.
    renderProfilePanel();
    ensureAdminProfileFields();
  }

  function movePlansIntoSettings(){
    const host = $('schoolhub-settings-user-plan-host');
    if (!host) return;
    if (!host.querySelector('#schoolhub-settings-current-plan-card')) {
      host.innerHTML = `
        <div id="schoolhub-settings-current-plan-card"></div>
        <div id="schoolhub-settings-payment-history-box" class="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div class="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/60">
            <div>
              <h3 class="text-lg font-black text-slate-900"><i class="fas fa-receipt text-primary mr-2"></i><span data-i18n="planHistory">${esc(t('planHistory'))}</span></h3>
              <p class="text-sm text-slate-500 mt-1" data-i18n="planHistoryDescription">${esc(t('planHistoryDescription'))}</p>
            </div>
            <button type="button" onclick="schoolhubLoadSettingsPlanHistory(true)" data-schoolhub-always-allowed="1" class="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold"><i class="fas fa-sync-alt mr-1"></i> <span data-i18n="refresh">${esc(t('refresh'))}</span></button>
          </div>
          <div id="schoolhub-settings-payment-history-list" class="p-5 space-y-3">
            <div class="text-center text-slate-400 py-6"><i class="fas fa-spinner fa-spin mr-1"></i> <span data-i18n="loadingHistory">${esc(t('loadingHistory'))}</span></div>
          </div>
        </div>
      `;
    }
  }

  async function readAdminCred(){
    try{
      const snap = await getDoc(doc(db, 'admin_settings', 'credentials'));
      return snap.exists() ? (snap.data() || {}) : {};
    }catch(e){ return {}; }
  }

  async function fillProfilePanel(){
    moveProfileIntoSettings();
    ensureAdminProfileFields();
    const admin = isAdminSession();
    const authUser = auth.currentUser;
    const displayInput = $('settings-profile-display-name-input');
    const emailInput = $('settings-profile-email-input');
    const usernameWrap = $('settings-profile-admin-username-wrap');
    const usernameInput = $('settings-profile-admin-username-input');
    const passWrap = $('settings-admin-profile-password-wrap');
    const passInput = $('settings-admin-profile-password-input');
    const resetBtn = document.querySelector('#schoolhub-settings-profile-host [data-settings-reset-password]');

    if (admin) {
      const d = await readAdminCred();
      const username = norm(d.username || localStorage.getItem('schoolhub_admin_username') || 'Admin');
      const displayName = norm(d.displayName || d.name || localStorage.getItem('schoolhub_admin_name') || $('user-display-name')?.textContent || 'Administrator');
      const email = norm(d.email || localStorage.getItem('schoolhub_admin_email') || $('user-display-email')?.textContent || username);
      if (displayInput) displayInput.value = displayName;
      if (usernameInput) usernameInput.value = username;
      if (emailInput) {
        emailInput.value = email === 'Admin' ? '' : email;
        emailInput.removeAttribute('readonly');
        emailInput.classList.remove('bg-slate-100','text-slate-500');
        emailInput.classList.add('bg-slate-50');
      }
      usernameWrap?.classList.remove('hidden');
      passWrap?.classList.remove('hidden');
      if (passInput) passInput.value = '';
      resetBtn?.classList.add('hidden');
      localStorage.setItem('schoolhub_admin_active', 'true');
      localStorage.setItem('schoolhub_admin_username', username);
      localStorage.setItem('schoolhub_admin_name', displayName);
      localStorage.setItem('schoolhub_admin_email', email || username);
    } else {
      usernameWrap?.classList.add('hidden');
      passWrap?.classList.add('hidden');
      if (displayInput) displayInput.value = authUser?.displayName || norm($('user-display-name')?.textContent) || '';
      if (emailInput) {
        emailInput.value = authUser?.email || norm($('user-display-email')?.textContent) || '';
        emailInput.setAttribute('readonly','readonly');
        emailInput.classList.add('bg-slate-100','text-slate-500');
      }
      resetBtn?.classList.remove('hidden');
    }
    renderAccountSummary();
  }

  function setHeader(name, email){
    if ($('user-display-name')) $('user-display-name').textContent = name || 'ผู้ใช้งาน';
    if ($('user-display-email')) $('user-display-email').textContent = email || '';
    if ($('user-avatar-initial')) $('user-avatar-initial').textContent = (name || 'U').trim().charAt(0).toUpperCase();
  }

  async function saveInlineProfile(){
    moveProfileIntoSettings();
    ensureAdminProfileFields();
    const displayName = norm($('settings-profile-display-name-input')?.value);
    if (!displayName) return alertBox('กรอกข้อมูลไม่ครบ', 'กรุณากรอกชื่อที่แสดง', true);
    const admin = isAdminSession();
    loader(true);
    try{
      if (admin) {
        const old = await readAdminCred();
        const username = norm($('settings-profile-admin-username-input')?.value || old.username || 'Admin') || 'Admin';
        const email = norm($('settings-profile-email-input')?.value || old.email || '');
        const newPass = norm($('settings-admin-profile-password-input')?.value);
        const password = newPass || old.password || localStorage.getItem('schoolhub_admin_password') || 'Admin123';
        if (password.length < 6) throw new Error('รหัสผ่าน Admin ต้องมีอย่างน้อย 6 ตัวอักษร');
        if (email && !isEmail(email)) throw new Error('กรุณากรอกอีเมลให้ถูกต้อง หรือเว้นว่างไว้');
        await setDoc(doc(db, 'admin_settings', 'credentials'), {
          username, email, displayName, password,
          name: displayName,
          updatedAt: serverTimestamp(),
          updatedBy: 'admin'
        }, { merge: true });
        await setDoc(doc(db, 'admin_settings', 'security'), {
          requirePasswordChange: false,
          updatedAt: serverTimestamp(),
          lastPasswordChange: newPass ? serverTimestamp() : (old.lastPasswordChange || serverTimestamp())
        }, { merge: true });
        localStorage.setItem('schoolhub_admin_active', 'true');
        localStorage.setItem('schoolhub_admin_username', username);
        localStorage.setItem('schoolhub_admin_name', displayName);
        localStorage.setItem('schoolhub_admin_email', email || username);
        if (newPass) localStorage.setItem('schoolhub_admin_password', newPass);
        setHeader(displayName, email || username);
        if ($('settings-admin-profile-password-input')) $('settings-admin-profile-password-input').value = '';
        renderAccountSummary();
        alertBox('บันทึกสำเร็จ', 'บันทึกโปรไฟล์ Admin ลง Firebase แล้ว');
      } else {
        const user = auth.currentUser;
        if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้ที่เข้าสู่ระบบ');
        await updateProfile(user, { displayName });
        try {
          if (typeof window.addUserToDirectory === 'function') await window.addUserToDirectory(user, displayName, 'user');
          else await setDoc(doc(db, 'public_users_directory', String(user.email || user.uid).toLowerCase()), { uid:user.uid, email:user.email || '', name:displayName, displayName, role:'user', updatedAt:serverTimestamp() }, { merge:true });
        } catch(e) { console.warn('directory profile sync skipped:', e); }
        setHeader(displayName, user.email || norm($('settings-profile-email-input')?.value));
        renderAccountSummary();
        alertBox('บันทึกสำเร็จ', 'แก้ไขข้อมูลแสดงผลของบัญชีเรียบร้อยแล้ว');
      }
    }catch(e){
      alertBox('บันทึกไม่สำเร็จ', e?.message || String(e), true);
    }finally{ loader(false); }
  }

  function renderAccountSummary(){
    const box = $('schoolhub-settings-account-summary');
    if (!box) return;
    box.removeAttribute('data-i18n');
    const admin = isAdminSession();
    const name = norm($('settings-profile-display-name-input')?.value || $('user-display-name')?.textContent || (admin ? 'Administrator' : 'ผู้ใช้งาน'));
    const email = norm($('settings-profile-email-input')?.value || $('user-display-email')?.textContent || (admin ? localStorage.getItem('schoolhub_admin_email') : auth.currentUser?.email) || '');
    const role = admin ? t('admin') : t('regularUser');
    box.innerHTML = `
      <div><b>${esc(t('name'))}:</b> ${esc(name || '-')}</div>
      <div><b>${esc(t('email'))}:</b> ${esc(email || '-')}</div>
      <div><b>${esc(t('status'))}:</b> ${esc(role)}</div>
      <div><b>${esc(t('settingsMode'))}:</b> ${esc(t('editInSinglePopup'))}</div>
    `;
  }

  function prefillContactEmail(){
    const input = $('schoolhub-contact-email');
    if (!input || input.value) return;
    input.value = norm(auth.currentUser?.email || $('user-display-email')?.textContent || localStorage.getItem('schoolhub_admin_email') || '');
  }

  function getPlanDir(){
    const fromWindow = window.__currentUserDir || {};
    if (fromWindow && Object.keys(fromWindow).length) return fromWindow;
    const email = norm(auth.currentUser?.email || window.currentUser?.email || $('user-display-email')?.textContent).toLowerCase();
    if (email) {
      try {
        const cached = JSON.parse(localStorage.getItem('schoolhub_current_user_dir_cache_' + email) || '{}');
        if (cached && Object.keys(cached).length) return cached;
      } catch(e) {}
    }
    return {};
  }

  function getPlanList(){
    if (Array.isArray(window.subscriptionPlans) && window.subscriptionPlans.length) return window.subscriptionPlans;
    for (const key of ['schoolhub_subscription_plans_cache','schoolhub_subscription_plans','schoolhub_public_plans']) {
      try {
        const items = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(items) && items.length) return items;
      } catch(e) {}
    }
    return [];
  }

  function findPlanById(id){
    return getPlanList().find(p => String(p?.id || '') === String(id || '')) || null;
  }

  function planDisplayText(plan, dir){
    if (dir?.planPrice) return dir.planPrice;
    if (!plan) return '';
    if (typeof window.planDisplayPrice === 'function') {
      try { return window.planDisplayPrice(plan); } catch(e) {}
    }
    return plan.price || (Number(plan.monthlyPrice || 0) ? Number(plan.monthlyPrice).toLocaleString('th-TH') + ' บาท/เดือน' : '');
  }

  function planDateText(value){
    if (!value) return '-';
    try {
      const ms = typeof value?.toMillis === 'function' ? value.toMillis() : (typeof value?.toDate === 'function' ? value.toDate().getTime() : Number(value));
      if (!Number.isFinite(ms) || !ms) return '-';
      return new Date(ms).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });
    } catch(e) { return '-'; }
  }

  function courseLimitText(plan, dir){
    const raw = dir?.courseLimit ?? plan?.courseLimit;
    const n = Number(raw || 0);
    return n === 0 ? 'ไม่จำกัด' : (Number.isFinite(n) && n > 0 ? n + ' วิชา' : '-');
  }

  function renderCurrentPlanCard(target, options = {}){
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    const dir = getPlanDir();
    const planId = dir.teamPlanId || dir.planId || dir.requestedPlanId || '';
    const plan = findPlanById(planId) || {
      id: planId || 'none',
      name: dir.requestedPlanName || dir.teamPlanName || dir.planName || (planId ? planId : 'ไม่มีแผน'),
      price: dir.requestedPlanName || dir.requestedPlanId ? 'คำขออยู่ระหว่างรอตรวจสอบ' : (dir.planPrice || ''),
      monthlyPrice: dir.monthlyPrice || 0,
      freeFirstMonth: dir.freeFirstMonth,
      courseLimit: dir.courseLimit
    };
    el.innerHTML = window.renderCurrentPlanCardHTML ? window.renderCurrentPlanCardHTML(plan, dir) : '';
    el.classList.remove('schoolhub-no-plan-state','schoolhub-ultimate-no-plan');
  }

  window.renderCurrentPlanCard = renderCurrentPlanCard;

  function formatPlanHistoryDate(v){
    if (!v) return '-';
    try {
      const ms = typeof v?.toMillis === 'function' ? v.toMillis() : (typeof v?.toDate === 'function' ? v.toDate().getTime() : Number(v));
      return Number.isFinite(ms) && ms ? new Date(ms).toLocaleString(languageLocale(), { dateStyle:'medium', timeStyle:'short' }) : '-';
    } catch(e) { return '-'; }
  }

  function currentUserForHistory(){
    try { return auth.currentUser || window.currentUser || JSON.parse(localStorage.getItem('schoolhub_web_session_v1') || '{}'); }
    catch(e) { return auth.currentUser || window.currentUser || null; }
  }

  async function loadSettingsPlanHistory(showToast = false){
    const box = $('schoolhub-settings-payment-history-list');
    if (!box) return;
    const u = currentUserForHistory();
    const email = norm(u?.email || $('user-display-email')?.textContent).toLowerCase();
    const uid = norm(u?.uid || '');
    if (!email && !uid) {
      box.innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fas fa-user-lock text-2xl mb-2 block"></i>กรุณาเข้าสู่ระบบผู้ใช้ก่อนดูประวัติ</div>';
      return;
    }
    box.innerHTML = '<div class="text-center text-slate-400 py-6"><i class="fas fa-spinner fa-spin mr-1"></i> กำลังโหลดประวัติ...</div>';
    try {
      const snap = await getDocs(collection(db, 'subscription_requests'));
      const rows = [];
      snap.forEach(d => rows.push(Object.assign({ id:d.id }, d.data() || {})));
      const filtered = rows.filter(r => {
        const keys = [r.userKey, r.email, r.uid].map(x => norm(x).toLowerCase());
        return (email && keys.includes(email)) || (uid && keys.includes(uid));
      }).sort((a,b) => Number(b.createdAt || b.updatedAt || b.approvedAt || 0) - Number(a.createdAt || a.updatedAt || a.approvedAt || 0));
      if (!filtered.length) {
        box.innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fas fa-receipt text-4xl text-slate-200 mb-3 block"></i>ยังไม่มีประวัติการใช้งานหรือคำขอแผน</div>';
        return;
      }
      box.innerHTML = filtered.slice(0, 30).map(r => {
        const status = norm(r.status || 'pending');
        const label = status === 'approved' ? 'อนุมัติแล้ว' : (status === 'rejected' || status === 'denied' ? 'ไม่อนุมัติ' : (status === 'cancelled' || status === 'canceled' ? 'ยกเลิกแล้ว' : 'รอตรวจสอบ'));
        return `<div class="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div class="min-w-0">
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-white border border-slate-200 text-slate-700"><i class="fas fa-circle-info"></i> ${esc(label)}</span>
              <div class="mt-2 text-lg font-black text-slate-900">${esc(r.planName || '-')}</div>
              <div class="mt-1 text-sm text-slate-600 leading-7">ราคา/ยอดชำระ: <b>${esc(r.planPrice || (r.planAmount ? Number(r.planAmount).toLocaleString('th-TH') + ' บาท' : '-'))}</b><br>ผู้ชำระ: <b>${esc(r.payerName || r.name || '-')}</b></div>
            </div>
            <div class="text-xs text-slate-500 md:text-right shrink-0 leading-6">ส่งคำขอ: <b>${esc(formatPlanHistoryDate(r.createdAt))}</b><br>อัปเดตล่าสุด: <b>${esc(formatPlanHistoryDate(r.updatedAt || r.approvedAt || r.rejectedAt))}</b></div>
          </div>
        </div>`;
      }).join('');
      if (showToast) alertBox('โหลดประวัติแล้ว', 'อัปเดตประวัติการใช้งานล่าสุดเรียบร้อย');
    } catch(e) {
      box.innerHTML = `<div class="text-center text-rose-500 py-6"><i class="fas fa-triangle-exclamation mr-1"></i> โหลดประวัติไม่ได้: ${esc(e?.message || String(e))}</div>`;
    }
  }

  window.schoolhubLoadSettingsPlanHistory = loadSettingsPlanHistory;

  async function renderPlansPanel(){
    const panel = ensureSettingsPanel('plans');
    try {
      if (!panel) throw new Error('settings-panel-plans not found');
      panel.className = 'schoolhub-settings-panel space-y-5';
      panel.innerHTML = createPlansPanelHTML();
      movePlansIntoSettings();
      renderCurrentPlanCard('schoolhub-settings-current-plan-card');
      if (typeof window.loadLatestPlanDataInBackground === 'function') {
        window.loadLatestPlanDataInBackground().then(() => {
          try { renderCurrentPlanCard('schoolhub-settings-current-plan-card'); } catch(e){}
        }).catch(err => console.error('Plans panel render failed', err));
      }
      try { loadSettingsPlanHistory(false); } catch(e){ console.error('Plans panel render failed', e); }
      applyLanguage();
      forceSettingsContentVisible();
      unlockSettingsControls();
      return panel;
    } catch(e) {
      console.error('Plans panel render failed', e);
      if (panel) panel.innerHTML = `<div class="rounded-3xl border border-rose-100 bg-rose-50 p-5 text-rose-700 font-bold">โหลดหน้า แผนการใช้งาน ไม่สำเร็จ: ${esc(e?.message || String(e))}</div>`;
      return panel || null;
    }
  }

  function renderCurrentSettingsPanel(tab){
    tab = normalizeTab(tab);
    const renderers = {
      general: renderGeneralPanel,
      plans: renderPlansPanel,
      language: renderLanguagePanel,
      'contact-admin': renderContactAdminPanel,
      'admin-system': renderAdminSystemPanel,
      'contact-messages': renderAdminMessagesPanel
    };
    const renderer = renderers[tab] || renderGeneralPanel;
    return renderer();
  }

  window.renderCurrentSettingsPanel = renderCurrentSettingsPanel;

  function fillSettingsProfileData(){
    const filled = fillProfilePanel();
    if (filled && typeof filled.catch === 'function') filled.catch(e => console.error('Settings profile fill failed', e));
    return filled;
  }

  function renderSettingsPanel(tab){
    tab = normalizeTab(tab || 'general');
    if ((tab === 'contact-messages' || tab === 'admin-system') && !isAdminSession()) tab = 'contact-admin';

    if (tab === 'general') {
      const panel = ensureSettingsPanel('general');
      if (!panel) return null;
      panel.className = 'schoolhub-settings-panel space-y-5';
      panel.setAttribute('data-schoolhub-settings-panel', 'general');
      panel.setAttribute('data-schoolhub-always-allowed', '1');

      if (typeof createGeneralPanelHTML === 'function') {
        panel.innerHTML = createGeneralPanelHTML();
      } else {
        panel.innerHTML = '<div class="rounded-3xl border border-indigo-100 bg-indigo-50 p-5"><h3 class="text-xl font-black">โปรไฟล์ผู้ใช้งาน</h3><p class="text-slate-500 mt-1">แก้ไขข้อมูลแสดงผลของบัญชีได้ตรงนี้</p></div><div id="schoolhub-settings-profile-host" class="schoolhub-settings-inline-profile" data-schoolhub-always-allowed="1"></div><div class="bg-white rounded-3xl border border-slate-100 p-5"><h3 class="font-black">ข้อมูลบัญชี</h3><div id="schoolhub-settings-account-summary" class="text-slate-600 mt-3"></div></div><div id="schoolhub-tour-settings-host" data-schoolhub-always-allowed="1"></div>';
      }

      if (typeof bindGeneralPanelEvents === 'function') bindGeneralPanelEvents();
      if (typeof fillSettingsProfileData === 'function') fillSettingsProfileData();
      if (typeof unlockSettingsControls === 'function') unlockSettingsControls();
      if (typeof forceSettingsContentVisible === 'function') forceSettingsContentVisible();
      if (window.schoolhubTour && typeof window.schoolhubTour.renderSettingsCard === 'function') {
        try { window.schoolhubTour.renderSettingsCard(); } catch (e) { console.warn('SchoolHub tour: renderSettingsCard failed', e); }
      }
      return panel;
    }

    const renderers = {
      plans: renderPlansPanel,
      language: renderLanguagePanel,
      'contact-admin': renderContactAdminPanel,
      'admin-system': renderAdminSystemPanel,
      'contact-messages': renderAdminMessagesPanel
    };
    const renderer = renderers[tab];
    let panel = renderer ? renderer() : ensureSettingsPanel(tab);
    if (panel && typeof panel.then === 'function') {
      // Renderer is async (e.g. renderPlansPanel) - it already applies classes/attrs to the
      // panel element synchronously before its first await, so just track errors and fall
      // back to the panel element itself instead of the Promise.
      panel.catch(e => console.error('Settings panel render failed', e));
      panel = ensureSettingsPanel(tab);
    }
    if (panel && panel.classList) {
      panel.classList.add('schoolhub-settings-panel');
      panel.setAttribute('data-schoolhub-settings-panel', tab);
      panel.setAttribute('data-schoolhub-always-allowed', '1');
    }
    return panel;
  }

  function ensureSettingsPanels(){
    return ensureCoreSettingsPanels();
  }

  function switchSettingsTab(tab = 'general') {
    tab = normalizeTab(tab || 'general');
    if ((tab === 'contact-messages' || tab === 'admin-system') && !isAdminSession()) tab = 'contact-admin';
    window.__schoolhubSettingsActiveTab = tab;

    const content = ensureSettingsContent();
    if (!content) return tab;

    if (typeof ensureCoreSettingsPanels === 'function') ensureCoreSettingsPanels();

    document.querySelectorAll('#settings-modal [data-settings-tab]').forEach(btn => {
      const btnTab = normalizeTab(btn.dataset.settingsTab || 'general');
      const active = btnTab === tab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    if (typeof renderSettingsPanel === 'function') renderSettingsPanel(tab);

    let panels = [];
    try {
      panels = Array.from(content.querySelectorAll(':scope > .schoolhub-settings-panel'));
    } catch(e) {
      panels = Array.from(content.children || []).filter(el => el.classList && el.classList.contains('schoolhub-settings-panel'));
    }
    panels.forEach(panel => {
      panel.classList.add('hidden');
      panel.hidden = true;
      panel.style.display = 'none';
      panel.style.visibility = 'hidden';
      panel.style.opacity = '0';
      panel.style.pointerEvents = 'none';
    });

    const activePanel = ensureSettingsPanel(tab);
    if (activePanel) {
      activePanel.classList.remove('hidden');
      activePanel.hidden = false;
      activePanel.style.display = 'block';
      activePanel.style.visibility = 'visible';
      activePanel.style.opacity = '1';
      activePanel.style.pointerEvents = 'auto';
    }

    if (typeof forceSettingsContentVisible === 'function') forceSettingsContentVisible();
    if (typeof unlockSettingsControls === 'function') unlockSettingsControls();
    if (typeof applyLanguage === 'function') applyLanguage();
    if (tab === 'contact-messages' && typeof loadAdminContactMessages === 'function') loadAdminContactMessages();
    if (tab === 'contact-admin' && typeof schoolhubPrefillContactEmail === 'function') schoolhubPrefillContactEmail();
    if (tab === 'contact-admin' && typeof prefillContactEmail === 'function') prefillContactEmail();
    if (tab === 'contact-messages' || tab === 'admin-system') refreshAdminMessageBadges();
    return tab;
  }

  function setActiveTab(tab){
    return switchSettingsTab(tab || 'general');
  }

  function renderSettings(tab = 'general'){
    try {
      ensureSettingsPanels();
      const admin = isAdminSession();
      const badge = $('schoolhub-settings-role-badge');
      if (badge) {
        badge.textContent = admin ? t('admin') : t('regularUser');
        badge.className = admin
          ? 'settings-role-badge bg-rose-50 text-rose-600 border-rose-100'
          : 'settings-role-badge bg-indigo-50 text-primary border-indigo-100';
      }
      $('schoolhub-settings-admin-messages-tab')?.classList.toggle('hidden', !admin);
      $('schoolhub-settings-admin-system-tab')?.classList.toggle('hidden', !admin);
      if (admin) startAdminContactRealtime(false); else updateAdminMessageBadges(0);
      unlockSettingsControls();
      renderSettingsPanel(normalizeTab(tab || window.__schoolhubSettingsActiveTab || 'general'));
      switchSettingsTab(normalizeTab(tab || window.__schoolhubSettingsActiveTab || 'general'));
      applyLanguage();
      refreshAdminMessageBadges();
      forceSettingsContentVisible();
    } catch(e) {
      console.error('Settings render failed', e);
      const panel = ensureSettingsPanel('general');
      if (panel) panel.innerHTML = `<div class="rounded-3xl border border-rose-100 bg-rose-50 p-5 text-rose-700 font-bold">โหลด Settings ไม่สำเร็จ: ${esc(e?.message || String(e))}</div>`;
    }
  }

  window.ensureSettingsPanels = ensureSettingsPanels;
  window.renderSettingsPanel = renderSettingsPanel;
  window.fillSettingsProfileData = fillSettingsProfileData;
  window.schoolhubOpenSettingsTab = function(tab='general'){
    return switchSettingsTab(tab || 'general');
  };
  window.switchSettingsTab = function(tab='general'){
    return switchSettingsTab(tab || 'general');
  };
  window.renderSchoolHubSettings = function(tab='general'){
    return renderSettings(tab || window.__schoolhubSettingsActiveTab || 'general');
  };

  window.openSettingsModal = function(tab='general'){
    const modal = $('settings-modal');
    if (!modal) return;
    try { document.body.appendChild(modal); } catch(e) {}

    modal.classList.remove('hidden');
    modal.hidden = false;
    modal.setAttribute('aria-hidden','false');
    modal.setAttribute('data-schoolhub-always-allowed', '1');
    if (!document.body.classList.contains('overflow-hidden')) document.body.dataset.schoolhubSettingsAddedOverflowHidden = '1';
    document.body.classList.add('schoolhub-settings-modal-open', 'overflow-hidden');

    tab = normalizeTab(tab || window.__schoolhubSettingsActiveTab || 'general');
    window.__schoolhubSettingsActiveTab = tab;

    try {
      const admin = isAdminSession();
      const badge = $('schoolhub-settings-role-badge');
      if (badge) {
        badge.textContent = admin ? t('admin') : t('regularUser');
        badge.className = admin
          ? 'settings-role-badge bg-rose-50 text-rose-600 border-rose-100'
          : 'settings-role-badge bg-indigo-50 text-primary border-indigo-100';
      }
      $('schoolhub-settings-admin-messages-tab')?.classList.toggle('hidden', !admin);
      $('schoolhub-settings-admin-system-tab')?.classList.toggle('hidden', !admin);
      if (admin) startAdminContactRealtime(false); else updateAdminMessageBadges(0);
    } catch(e) { console.warn('Settings chrome refresh skipped:', e); }

    ensureSettingsContent();
    if (typeof ensureCoreSettingsPanels === 'function') ensureCoreSettingsPanels();
    if (typeof renderSchoolHubSettings === 'function') renderSchoolHubSettings(tab);
    switchSettingsTab(tab);
    unlockSettingsControls();
    forceSettingsContentVisible();

    requestAnimationFrame(function(){
      switchSettingsTab(window.__schoolhubSettingsActiveTab || 'general');
      unlockSettingsControls();
      forceSettingsContentVisible();
    });
    setTimeout(function(){ document.querySelector('#settings-modal .settings-close')?.focus?.(); }, 0);
  };
  window.openSchoolHubSettings = function(tab='general'){
    return window.openSettingsModal(tab || 'general');
  };
  window.closeSettingsModal = function(){
    const modal = $('settings-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.hidden = true;
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('schoolhub-settings-modal-open');
    if (document.body.dataset.schoolhubSettingsAddedOverflowHidden === '1') {
      document.body.classList.remove('overflow-hidden');
      delete document.body.dataset.schoolhubSettingsAddedOverflowHidden;
    }
  };

  window.renderProfilePanel = function(){
    renderProfilePanel();
    fillProfilePanel();
    return false;
  };
  window.openUserProfileSettingsFromSettings = function(){
    switchSettingsTab('general');
    return false;
  };
  window.openUserProfileSettings = function(){
    if (typeof __schoolhubProfilePopupOpenUserProfileSettings === 'function') {
      return __schoolhubProfilePopupOpenUserProfileSettings.apply(this, arguments);
    }
    if (typeof window.openModal === 'function') return window.openModal('user-profile-modal');
    $('user-profile-modal')?.classList.remove('hidden');
    return false;
  };
  window.saveUserProfileChanges = function(){
    if (typeof __schoolhubProfilePopupSaveUserProfileChanges === 'function') {
      return __schoolhubProfilePopupSaveUserProfileChanges.apply(this, arguments);
    }
    return saveInlineProfile.apply(this, arguments);
  };
  window.saveSettingsProfileChanges = saveInlineProfile;
  window.renderUserPlans = function(){
    const result = typeof __schoolhubSettingsOriginalRenderUserPlans === 'function'
      ? __schoolhubSettingsOriginalRenderUserPlans.apply(this, arguments)
      : undefined;
    try { renderCurrentPlanCard('user-current-plan-box'); } catch(e){}
    return result;
  };
  window.openUserPlanSelector = function(){
    try { window.closeSettingsModal?.(); } catch(e){}
    let result;
    if (typeof __schoolhubSettingsOriginalOpenUserPlanSelector === 'function') {
      result = __schoolhubSettingsOriginalOpenUserPlanSelector.apply(this, arguments);
    } else if (typeof window.switchView === 'function') {
      window.switchView('user-plans');
    }
    try { if (typeof window.renderUserPlans === 'function') window.renderUserPlans(); } catch(e){}
    try { renderCurrentPlanCard('user-current-plan-box'); } catch(e){}
    try { if (typeof window.loadUserPaymentHistory === 'function') setTimeout(() => window.loadUserPaymentHistory(false), 150); } catch(e){}
    return result === undefined ? false : result;
  };
  window.openAdminContactModal = function(){
    window.openSettingsModal('contact-admin');
    prefillContactEmail();
    return false;
  };
  window.openGeneralSettings = function(){
    window.openSettingsModal('general');
    return false;
  };

  const __schoolhubSettingsOldOpenModal = window.openModal;
  window.openModal = function(id){
    return typeof __schoolhubSettingsOldOpenModal === 'function'
      ? __schoolhubSettingsOldOpenModal.apply(this, arguments)
      : (id ? $(''+id)?.classList.remove('hidden') : undefined);
  };

  const ADMIN_CONTACT_OPEN_STATUSES = new Set(['new','pending','รอดำเนินการ','กำลังตรวจสอบ','ตรวจสอบอยู่']);
  const ADMIN_CONTACT_CLOSED_STATUSES = new Set(['แก้ไขแล้ว','รับทราบแล้ว','ปฏิเสธ','เสร็จสิ้น','done','resolved','rejected','closed','acknowledged']);
  const ADMIN_CONTACT_DEFAULT_STATUSES = ['รอดำเนินการ','รับทราบแล้ว','แก้ไขแล้ว','ปฏิเสธ','กำลังตรวจสอบ','อื่นๆ'];
  let adminContactUnsubscribes = [];
  let adminContactSnapshotsBySource = new Map();
  let adminContactItems = [];
  let adminContactCurrentSource = null;
  let adminContactLastError = null;
  let userContactUnsubscribes = [];
  let userContactSnapshotsByQuery = new Map();
  let userContactLastError = null;

  function isPermissionError(e){
    const msg = String(e?.message || e || '');
    return e?.code === 'permission-denied' || /Missing or insufficient permissions|permission/i.test(msg);
  }

  function nowIso(){ return new Date().toISOString(); }
  function itemDateMs(item){
    const raw = item?.createdAt || item?.createdAtMs || item?.updatedAt || 0;
    try {
      if (typeof raw?.toMillis === 'function') return raw.toMillis();
      if (typeof raw?.toDate === 'function') return raw.toDate().getTime();
      const n = Number(raw);
      if (Number.isFinite(n) && n) return n;
      const d = Date.parse(String(raw || ''));
      return Number.isFinite(d) ? d : 0;
    } catch(e) { return 0; }
  }
  function formatMessageDate(value, fallbackMs){
    try {
      let date = null;
      if (value?.toDate) date = value.toDate();
      else if (value?.toMillis) date = new Date(value.toMillis());
      else if (Number(value)) date = new Date(Number(value));
      else if (value) date = new Date(value);
      else if (fallbackMs) date = new Date(Number(fallbackMs));
      if (!date || Number.isNaN(date.getTime())) return '-';
      return date.toLocaleString('th-TH', { dateStyle:'medium', timeStyle:'short' });
    } catch(e) { return '-'; }
  }
  function normalizedContactStatus(status){
    const raw = norm(status || 'รอดำเนินการ');
    if (!raw) return 'รอดำเนินการ';
    const lower = raw.toLowerCase();
    if (lower === 'new' || lower === 'pending') return 'รอดำเนินการ';
    return raw;
  }
  function shouldCountAsPending(status){
    const raw = norm(status || 'รอดำเนินการ');
    const lower = raw.toLowerCase();
    if (ADMIN_CONTACT_CLOSED_STATUSES.has(raw) || ADMIN_CONTACT_CLOSED_STATUSES.has(lower)) return false;
    return ADMIN_CONTACT_OPEN_STATUSES.has(raw) || ADMIN_CONTACT_OPEN_STATUSES.has(lower);
  }
  function statusBadgeClass(status){
    const st = normalizedContactStatus(status);
    if (['แก้ไขแล้ว','เสร็จสิ้น'].includes(st)) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (st === 'รับทราบแล้ว') return 'bg-sky-50 text-sky-700 border-sky-100';
    if (st === 'ปฏิเสธ') return 'bg-rose-50 text-rose-700 border-rose-100';
    if (st === 'กำลังตรวจสอบ') return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-orange-50 text-orange-700 border-orange-100';
  }
  function sourceDocRef(source, messageId){
    const path = Array.isArray(source?.path) ? source.path : ['admin_contact_messages'];
    return doc(db, ...path, messageId);
  }
  function adminMessagePathCandidates(){
    const adminEmail = norm(localStorage.getItem('schoolhub_admin_email') || auth.currentUser?.email || $('user-display-email')?.textContent || 'admin').toLowerCase();
    const paths = [
      { label:'admin_contact_messages', path:['admin_contact_messages'], ref: collection(db, 'admin_contact_messages') }
    ];
    if (adminEmail) paths.push({ label:`users/${adminEmail}/admin_contact_messages`, path:['users', adminEmail, 'admin_contact_messages'], ref: collection(db, 'users', adminEmail, 'admin_contact_messages') });
    if (adminEmail !== 'admin') paths.push({ label:'users/admin/admin_contact_messages', path:['users', 'admin', 'admin_contact_messages'], ref: collection(db, 'users', 'admin', 'admin_contact_messages') });
    return paths;
  }
  function currentContactUser(){
    const session = (() => { try { return JSON.parse(localStorage.getItem('schoolhub_web_session_v1') || '{}'); } catch(e) { return {}; } })();
    const user = auth.currentUser || window.currentUser || session || {};
    const email = norm(user?.email || $('user-display-email')?.textContent || localStorage.getItem('schoolhub_admin_email')).toLowerCase();
    const uid = norm(user?.uid || user?.userUid || '');
    return { user, email, uid };
  }
  function userMessageQueryCandidates(){
    const { email, uid } = currentContactUser();
    const adminEmail = norm(localStorage.getItem('schoolhub_admin_email') || 'admin').toLowerCase() || 'admin';
    const bases = [
      { label:'admin_contact_messages', path:['admin_contact_messages'], ref: collection(db, 'admin_contact_messages') },
      { label:`users/${adminEmail}/admin_contact_messages`, path:['users', adminEmail, 'admin_contact_messages'], ref: collection(db, 'users', adminEmail, 'admin_contact_messages') }
    ];
    if (adminEmail !== 'admin') bases.push({ label:'users/admin/admin_contact_messages', path:['users', 'admin', 'admin_contact_messages'], ref: collection(db, 'users', 'admin', 'admin_contact_messages') });
    const candidates = [];
    bases.forEach(base => {
      if (email) candidates.push(Object.assign({}, base, { filter:'userEmail', q: query(base.ref, where('userEmail', '==', email)) }));
      if (uid) candidates.push(Object.assign({}, base, { filter:'userUid', q: query(base.ref, where('userUid', '==', uid)) }));
      if (uid) candidates.push(Object.assign({}, base, { filter:'uid', q: query(base.ref, where('uid', '==', uid)) }));
    });
    return candidates;
  }
  function ensureBadgeInButton(btn, key){
    if (!btn) return null;
    let badge = btn.querySelector('[data-admin-message-badge]');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'admin-message-badge hidden';
      badge.setAttribute('data-admin-message-badge', key || 'settings-main');
      badge.textContent = '0';
      btn.appendChild(badge);
    }
    return badge;
  }
  function ensureAdminMessageBadges(){
    if (!isAdminSession()) return;
    ensureBadgeInButton($('nav-admin-settings'), 'nav-admin-settings');
    ensureBadgeInButton($('mobile-nav-admin-settings'), 'mobile-nav-admin-settings');
    ensureBadgeInButton($('nav-settings'), 'nav-settings');
    ensureBadgeInButton($('mobile-nav-settings'), 'mobile-nav-settings');
    ensureBadgeInButton($('schoolhub-settings-admin-messages-tab'), 'settings-tab');
  }
  function refreshAdminMessageBadges(){
    ensureAdminMessageBadges();
    const count = adminContactItems.filter(item => shouldCountAsPending(item.status)).length;
    updateAdminMessageBadges(count);
  }
  window.schoolhubRefreshAdminMessageBadges = refreshAdminMessageBadges;
  function updateAdminMessageBadges(count){
    const admin = isAdminSession();
    document.querySelectorAll('[data-admin-message-badge]').forEach(badge => {
      const show = admin && Number(count) > 0;
      badge.textContent = String(Number(count) || 0);
      badge.classList.toggle('hidden', !show);
      badge.setAttribute('aria-label', show ? `มีข้อความค้าง ${Number(count) || 0} ข้อความ` : 'ไม่มีข้อความค้าง');
    });
  }
  function renderAdminMessages(box, items, sourceLabel){
    items.sort((a,b) => itemDateMs(b) - itemDateMs(a));
    if (!items.length) {
      box.innerHTML = '<div class="text-center text-slate-400 py-10 bg-white rounded-3xl border border-dashed border-slate-200"><i class="fas fa-inbox mr-1"></i> ยังไม่มีข้อความจากผู้ใช้</div>';
      return;
    }
    box.innerHTML = items.slice(0, 100).map(item => {
      const status = normalizedContactStatus(item.status);
      const dateText = formatMessageDate(item.createdAt, item.createdAtMs);
      const updatedText = formatMessageDate(item.handledAt || item.updatedAt, item.updatedAtMs);
      const isCustom = status && !ADMIN_CONTACT_DEFAULT_STATUSES.includes(status) && !['new','pending'].includes(String(item.status || '').toLowerCase());
      const options = ADMIN_CONTACT_DEFAULT_STATUSES.map(st => `<option value="${esc(st)}" ${((!isCustom && status === st) || (isCustom && st === 'อื่นๆ')) ? 'selected' : ''}>${esc(st)}</option>`).join('');
      return `<article class="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm" data-admin-message-card="1" data-message-id="${esc(item.id || '')}" data-source-label="${esc(item.__sourceLabel || sourceLabel || '')}">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div class="min-w-0">
            <h5 class="font-black text-slate-900 text-lg break-words">${esc(item.title || 'ไม่มีหัวข้อ')}</h5>
            <p class="text-xs text-slate-400 mt-1"><i class="fas fa-clock mr-1"></i>วันที่แจ้ง: ${esc(dateText)}</p>
          </div>
          <span class="px-3 py-1 rounded-full border text-xs font-black self-start ${statusBadgeClass(status)}">${esc(status)}</span>
        </div>
        <div class="text-sm text-slate-600 leading-7 mt-4 whitespace-pre-line break-words">${esc(item.message || '')}</div>
        <div class="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500 leading-6">
          <b>ผู้แจ้ง:</b> ${esc(item.userName || '-')}<br>
          <b>อีเมลผู้แจ้ง:</b> ${esc(item.userEmail || item.contactEmail || '-')}<br>
          <b>อีเมลติดต่อกลับ:</b> ${esc(item.contactEmail || item.userEmail || '-')}<br>
          <b>อัปเดตล่าสุด:</b> ${esc(updatedText)}${item.handledBy ? `<br><b>ผู้ดำเนินการ:</b> ${esc(item.handledBy)}` : ''}
        </div>
        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-black text-slate-500 mb-1">เลือกสถานะ</label>
            <select class="schoolhub-admin-message-status-select w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-3 outline-none focus:ring-4 focus:ring-rose-100" data-schoolhub-always-allowed="1">
              ${options}
            </select>
          </div>
          <div>
            <label class="block text-xs font-black text-slate-500 mb-1">สถานะอื่นๆ</label>
            <input type="text" class="schoolhub-admin-message-custom-status ${isCustom ? '' : 'hidden'} w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-3 outline-none focus:ring-4 focus:ring-rose-100" value="${isCustom ? esc(status) : ''}" placeholder="พิมพ์สถานะเอง" data-schoolhub-always-allowed="1">
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-black text-slate-500 mb-1">หมายเหตุถึงผู้ใช้</label>
            <textarea rows="2" class="schoolhub-admin-message-note w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-3 outline-none focus:ring-4 focus:ring-rose-100 resize-y" placeholder="พิมพ์หมายเหตุเพิ่มเติม (ถ้ามี)" data-schoolhub-always-allowed="1">${esc(item.adminStatusNote || '')}</textarea>
          </div>
        </div>
        <div class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div class="text-[11px] text-slate-400">แหล่งข้อมูล: ${esc(item.__sourceLabel || sourceLabel || 'admin_contact_messages')}</div>
          <button type="button" class="schoolhub-admin-message-save-btn bg-rose-600 hover:bg-rose-700 text-white px-5 py-3 rounded-2xl font-black shadow-sm" data-schoolhub-always-allowed="1"><i class="fas fa-save mr-1"></i> บันทึกสถานะ</button>
        </div>
      </article>`;
    }).join('');
  }
  function renderUserContactHistory(box, items){
    items.sort((a,b) => itemDateMs(b) - itemDateMs(a));
    if (!items.length) {
      box.innerHTML = '<div class="text-center text-slate-400 py-8 border border-dashed border-slate-200 rounded-2xl"><i class="fas fa-comment-slash text-3xl text-slate-200 mb-2 block"></i>ยังไม่มีประวัติการแจ้ง</div>';
      return;
    }
    box.innerHTML = items.slice(0, 50).map(item => {
      const status = normalizedContactStatus(item.status);
      const dateText = formatMessageDate(item.createdAt, item.createdAtMs);
      return `<article class="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
          <div class="min-w-0">
            <h6 class="font-black text-slate-900 break-words">${esc(item.title || 'ไม่มีหัวข้อ')}</h6>
            <p class="text-xs text-slate-400 mt-1"><i class="fas fa-clock mr-1"></i>วันที่ส่ง: ${esc(dateText)}</p>
          </div>
          <span class="px-3 py-1 rounded-full border text-xs font-black self-start ${statusBadgeClass(status)}">${esc(status)}</span>
        </div>
        <div class="mt-3 text-sm text-slate-600 leading-7 whitespace-pre-line break-words">${esc(item.message || '')}</div>
        ${item.adminStatusNote ? `<div class="mt-3 rounded-xl bg-white border border-indigo-100 p-3 text-sm text-slate-600 leading-7"><b>หมายเหตุจากแอดมิน:</b><br>${esc(item.adminStatusNote)}</div>` : ''}
      </article>`;
    }).join('');
  }
  function stopAdminContactRealtime(){
    if (Array.isArray(adminContactUnsubscribes)) {
      adminContactUnsubscribes.forEach(unsub => { try { if (typeof unsub === 'function') unsub(); } catch(e) {} });
    }
    adminContactUnsubscribes = [];
    adminContactSnapshotsBySource = new Map();
    adminContactCurrentSource = null;
  }
  function rebuildAdminContactItems(showList = false){
    adminContactItems = [];
    adminContactSnapshotsBySource.forEach(items => { adminContactItems.push(...items); });
    refreshAdminMessageBadges();
    const activeBox = $('schoolhub-admin-contact-message-list');
    if (activeBox && (showList || window.__schoolhubSettingsActiveTab === 'contact-messages')) {
      renderAdminMessages(activeBox, adminContactItems, adminContactCurrentSource?.label || 'admin_contact_messages');
    }
  }
  function showAdminContactLoadError(box, err){
    if (!box) return;
    box.innerHTML = isPermissionError(err)
      ? '<div class="text-center text-rose-600 py-10 bg-white rounded-3xl border border-rose-100"><i class="fas fa-shield-halved mr-1"></i> ไม่สามารถโหลดข้อความได้ กรุณาตรวจสอบสิทธิ์ Firestore</div>'
      : `<div class="text-center text-rose-600 py-10 bg-white rounded-3xl border border-rose-100"><i class="fas fa-triangle-exclamation mr-1"></i> โหลดข้อความไม่สำเร็จ: ${esc(err?.message || String(err || 'ไม่ทราบสาเหตุ'))}</div>`;
  }
  function startAdminContactRealtime(showList = false){
    const box = $('schoolhub-admin-contact-message-list');
    if (!isAdminSession()) {
      stopAdminContactRealtime();
      adminContactItems = [];
      updateAdminMessageBadges(0);
      if (showList && box) box.innerHTML = '<div class="text-center text-rose-500 py-10 bg-white rounded-3xl border border-rose-100">เมนูนี้เปิดได้เฉพาะแอดมิน</div>';
      return;
    }
    ensureAdminMessageBadges();
    if (showList && box && !adminContactItems.length) box.innerHTML = '<div class="text-center text-slate-400 py-10 bg-white rounded-3xl border border-dashed border-slate-200"><i class="fas fa-spinner fa-spin mr-1"></i> กำลังโหลดข้อความ...</div>';
    if (adminContactUnsubscribes.length) {
      rebuildAdminContactItems(showList);
      return;
    }
    const sources = adminMessagePathCandidates();
    let settledCount = 0;
    let successCount = 0;
    const errors = [];
    const maybeFinishWithError = () => {
      settledCount += 1;
      if (settledCount >= sources.length && successCount === 0) {
        const err = errors[0] || adminContactLastError;
        updateAdminMessageBadges(0);
        if (box && (showList || window.__schoolhubSettingsActiveTab === 'contact-messages')) showAdminContactLoadError(box, err);
      }
    };
    sources.forEach(source => {
      try {
        const unsub = onSnapshot(source.ref, snap => {
          if (!adminContactSnapshotsBySource.has(source.label)) successCount += 1;
          adminContactCurrentSource = source;
          adminContactLastError = null;
          const items = [];
          snap.forEach(d => items.push(Object.assign({ id:d.id, __sourceLabel:source.label, __sourcePath:source.path }, d.data() || {})));
          adminContactSnapshotsBySource.set(source.label, items);
          rebuildAdminContactItems(showList);
        }, err => {
          adminContactLastError = err;
          errors.push(err);
          console.warn('admin contact messages realtime failed at', source.label, err);
          maybeFinishWithError();
        });
        adminContactUnsubscribes.push(unsub);
      } catch(e) {
        adminContactLastError = e;
        errors.push(e);
        console.warn('admin contact messages listener setup failed at', source.label, e);
        maybeFinishWithError();
      }
    });
  }

  function stopUserContactHistoryRealtime(){
    if (Array.isArray(userContactUnsubscribes)) {
      userContactUnsubscribes.forEach(unsub => { try { if (typeof unsub === 'function') unsub(); } catch(e) {} });
    }
    userContactUnsubscribes = [];
    userContactSnapshotsByQuery = new Map();
  }
  function rebuildUserContactHistory(box){
    const merged = new Map();
    userContactSnapshotsByQuery.forEach(items => {
      items.forEach(item => merged.set(`${item.__sourceLabel || 'source'}/${item.id}`, item));
    });
    renderUserContactHistory(box, Array.from(merged.values()));
  }
  function startUserContactHistoryRealtime(forceReload = false, showLoading = false){
    const box = $('schoolhub-user-contact-history-list');
    if (!box) return;
    const { email, uid } = currentContactUser();
    if (!email && !uid) {
      box.innerHTML = '<div class="text-center text-slate-400 py-8 border border-dashed border-slate-200 rounded-2xl"><i class="fas fa-user-lock mr-1"></i> กรุณาเข้าสู่ระบบก่อนดูประวัติการแจ้ง</div>';
      return;
    }
    if (forceReload) stopUserContactHistoryRealtime();
    if (showLoading) box.innerHTML = '<div class="text-center text-slate-400 py-8 border border-dashed border-slate-200 rounded-2xl"><i class="fas fa-spinner fa-spin mr-1"></i> กำลังโหลดประวัติการแจ้ง...</div>';
    if (userContactUnsubscribes.length) {
      rebuildUserContactHistory(box);
      return;
    }
    const candidates = userMessageQueryCandidates();
    if (!candidates.length) {
      box.innerHTML = '<div class="text-center text-slate-400 py-8 border border-dashed border-slate-200 rounded-2xl"><i class="fas fa-user-lock mr-1"></i> ไม่พบข้อมูลบัญชีสำหรับโหลดประวัติการแจ้ง</div>';
      return;
    }
    let settledCount = 0;
    let successCount = 0;
    const errors = [];
    const maybeFinishWithError = () => {
      settledCount += 1;
      if (settledCount >= candidates.length && successCount === 0) {
        const err = errors[0] || userContactLastError;
        console.warn('user contact history load failed', err);
        box.innerHTML = isPermissionError(err)
          ? '<div class="text-center text-slate-500 py-8 border border-dashed border-slate-200 rounded-2xl"><i class="fas fa-shield-halved mr-1"></i> ยังโหลดประวัติการแจ้งไม่ได้ เนื่องจากสิทธิ์ Firestore ไม่อนุญาต แต่หน้าตั้งค่ายังใช้งานได้ตามปกติ</div>'
          : `<div class="text-center text-rose-500 py-8 border border-rose-100 rounded-2xl"><i class="fas fa-triangle-exclamation mr-1"></i> โหลดประวัติการแจ้งไม่สำเร็จ: ${esc(err?.message || String(err || 'ไม่ทราบสาเหตุ'))}</div>`;
      }
    };
    candidates.forEach(source => {
      try {
        const key = `${source.label}/${source.filter}`;
        const unsub = onSnapshot(source.q, snap => {
          if (!userContactSnapshotsByQuery.has(key)) successCount += 1;
          userContactLastError = null;
          const items = [];
          snap.forEach(d => items.push(Object.assign({ id:d.id, __sourceLabel:source.label, __sourcePath:source.path }, d.data() || {})));
          userContactSnapshotsByQuery.set(key, items);
          rebuildUserContactHistory(box);
        }, err => {
          userContactLastError = err;
          errors.push(err);
          console.warn('user contact history realtime failed at', `${source.label} / ${source.filter}`, err);
          maybeFinishWithError();
        });
        userContactUnsubscribes.push(unsub);
      } catch(e) {
        userContactLastError = e;
        errors.push(e);
        console.warn('user contact history listener setup failed at', `${source.label} / ${source.filter}`, e);
        maybeFinishWithError();
      }
    });
  }
  window.loadUserContactMessageHistory = function(forceReload = false){
    startUserContactHistoryRealtime(!!forceReload, true);
  };

  window.submitSchoolHubAdminContactMessage = async function(event){
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const title = norm($('schoolhub-contact-title')?.value);
    const message = norm($('schoolhub-contact-message')?.value);
    const { email, uid } = currentContactUser();
    const contactEmail = norm($('schoolhub-contact-email')?.value || email || auth.currentUser?.email || $('user-display-email')?.textContent);
    if (!title || !message) return alertBox('กรอกข้อมูลไม่ครบ', 'กรุณากรอกหัวข้อและรายละเอียด', true);
    if (contactEmail && !isEmail(contactEmail) && !isAdminSession()) return alertBox('อีเมลไม่ถูกต้อง', 'กรุณากรอกอีเมลติดต่อกลับให้ถูกต้อง', true);
    const btn = $('schoolhub-contact-submit-btn');
    const oldHtml = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังส่งข้อความ...'; }
    try{
      const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const payload = {
        id,
        title,
        message,
        contactEmail,
        userEmail: email || contactEmail || norm(auth.currentUser?.email || $('user-display-email')?.textContent || localStorage.getItem('schoolhub_admin_email')),
        userUid: uid || auth.currentUser?.uid || (isAdminSession() ? 'admin-bypass' : ''),
        uid: uid || auth.currentUser?.uid || (isAdminSession() ? 'admin-bypass' : ''),
        userName: norm($('user-display-name')?.textContent || auth.currentUser?.displayName || localStorage.getItem('schoolhub_admin_name')),
        role: isAdminSession() ? 'admin' : 'user',
        status: 'รอดำเนินการ',
        adminStatusNote: '',
        createdAt: serverTimestamp(),
        updatedAt: nowIso(),
        createdAtMs: Date.now(),
        source: 'settings-modal'
      };
      try {
        await setDoc(doc(db, 'admin_contact_messages', id), payload, { merge: true });
      } catch(writeError) {
        console.warn('write admin_contact_messages failed, trying legacy user path', writeError);
        const adminKey = norm(localStorage.getItem('schoolhub_admin_email') || 'admin').toLowerCase() || 'admin';
        await setDoc(doc(db, 'users', adminKey, 'admin_contact_messages', id), payload, { merge: true });
      }
      if ($('schoolhub-contact-title')) $('schoolhub-contact-title').value = '';
      if ($('schoolhub-contact-message')) $('schoolhub-contact-message').value = '';
      startUserContactHistoryRealtime(true, false);
      alertBox('ส่งข้อความแล้ว', 'บันทึกข้อความถึงผู้ดูแลระบบเรียบร้อยแล้ว สถานะเริ่มต้นคือ รอดำเนินการ');
    }catch(e){
      console.error('submit admin contact message failed', e);
      alertBox('ส่งข้อความไม่สำเร็จ', e?.message || String(e), true);
    }finally{
      if (btn) { btn.disabled = false; btn.innerHTML = oldHtml || '<i class="fas fa-paper-plane"></i> ส่งข้อความถึงผู้ดูแลระบบ'; }
    }
  };

  window.loadAdminContactMessages = async function(){
    startAdminContactRealtime(true);
  };
  window.saveAdminContactMessageStatus = async function(card){
    card = card?.closest ? card.closest('[data-admin-message-card]') : card;
    if (!card) return;
    if (!isAdminSession()) return alertBox('ไม่มีสิทธิ์', 'เมนูนี้เปิดได้เฉพาะแอดมิน', true);
    const messageId = norm(card.dataset.messageId);
    const sourceLabel = norm(card.dataset.sourceLabel);
    const select = card.querySelector('.schoolhub-admin-message-status-select');
    const custom = card.querySelector('.schoolhub-admin-message-custom-status');
    const noteBox = card.querySelector('.schoolhub-admin-message-note');
    const selected = norm(select?.value || 'รอดำเนินการ');
    const finalStatus = selected === 'อื่นๆ' ? norm(custom?.value) : selected;
    const note = norm(noteBox?.value);
    if (!messageId) return alertBox('ไม่พบข้อความ', 'ไม่พบรหัสข้อความที่ต้องอัปเดต', true);
    if (!finalStatus) return alertBox('กรอกสถานะไม่ครบ', 'กรุณาเลือกสถานะ หรือพิมพ์สถานะเองเมื่อเลือกอื่นๆ', true);
    const source = adminMessagePathCandidates().find(x => x.label === sourceLabel) || adminContactCurrentSource || adminMessagePathCandidates()[0];
    const btn = card.querySelector('.schoolhub-admin-message-save-btn');
    const oldHtml = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> กำลังบันทึก...'; }
    try {
      await updateDoc(sourceDocRef(source, messageId), {
        status: finalStatus,
        adminStatusNote: note,
        handledBy: norm(auth.currentUser?.email || localStorage.getItem('schoolhub_admin_email') || $('user-display-email')?.textContent || 'admin'),
        handledAt: nowIso(),
        updatedAt: nowIso()
      });
      alertBox('บันทึกสถานะแล้ว', `อัปเดตสถานะเป็น “${finalStatus}” เรียบร้อยแล้ว`);
    } catch(e) {
      console.error('update admin contact message status failed', e);
      alertBox('บันทึกสถานะไม่สำเร็จ', e?.message || String(e), true);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = oldHtml || '<i class="fas fa-save mr-1"></i> บันทึกสถานะ'; }
    }
  };

  document.addEventListener('click', function(e){
    const openBtn = e.target.closest?.('[data-open-settings], .settings-menu-btn');
    if (openBtn) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      window.openSettingsModal(openBtn.dataset.settingsTab || 'general');
      return false;
    }
    const inSettings = e.target.closest?.('#settings-modal');
    if (!inSettings) return;
    const tabBtn = e.target.closest?.('#settings-modal .settings-tab[data-settings-tab]');
    if (tabBtn) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      setActiveTab(tabBtn.dataset.settingsTab);
      return false;
    }
    const saveStatusBtn = e.target.closest?.('#settings-modal .schoolhub-admin-message-save-btn');
    if (saveStatusBtn) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
      window.saveAdminContactMessageStatus(saveStatusBtn);
      return false;
    }
    const onclickBtn = e.target.closest?.('#settings-modal [onclick]');
    if (!onclickBtn) return;
    const action = onclickBtn.getAttribute('onclick') || '';
    if (/openUserProfileSettings|openProfileModal/.test(action)) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
      window.openUserProfileSettingsFromSettings?.();
      return false;
    }
    if (/openUserPlanSelector|user-plans/.test(action)) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
      setActiveTab('plans');
      return false;
    }
    if (/openAdminContactModal/.test(action)) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
      setActiveTab('contact-admin');
      return false;
    }
  }, true);

  document.addEventListener('change', function(e){
    const select = e.target.closest?.('#settings-modal .schoolhub-admin-message-status-select');
    if (!select) return;
    const card = select.closest('[data-admin-message-card]');
    const input = card?.querySelector('.schoolhub-admin-message-custom-status');
    if (input) {
      const isCustom = select.value === 'อื่นๆ';
      input.classList.toggle('hidden', !isCustom);
      if (isCustom) setTimeout(() => input.focus(), 0);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){
    setDocumentLanguage();
    ensureSettingsPanels();
    renderSettings('general');
    applyLanguage();
    try { if (typeof window.schoolhubQueueRuntimeTranslation === 'function') window.schoolhubQueueRuntimeTranslation(document.body); } catch(e) {}
  });
  if (document.readyState !== 'loading') {
    setDocumentLanguage();
    ensureSettingsPanels();
    renderSettings('general');
    applyLanguage();
    try { if (typeof window.schoolhubQueueRuntimeTranslation === 'function') window.schoolhubQueueRuntimeTranslation(document.body); } catch(e) {}
  }
})();
