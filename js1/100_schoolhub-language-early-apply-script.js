
(function(){
  try {
    var lang = localStorage.getItem('schoolhub_language') || 'th';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  } catch(e) {}
})();
