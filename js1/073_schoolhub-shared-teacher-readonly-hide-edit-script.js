
(function(){
  if(window.__schoolhubSharedTeacherReadonlyHideEdit) return;
  window.__schoolhubSharedTeacherReadonlyHideEdit = true;

  function currentEmail(){
    try{
      return String((window.currentUser && window.currentUser.email) || (auth && auth.currentUser && auth.currentUser.email) || '').trim().toLowerCase();
    }catch(e){return '';}
  }

  function isReadonlyShare(course){
    if(!course) return false;
    var email=currentEmail();
    var uid='';
    try{ uid=String((window.currentUser && window.currentUser.uid) || (auth && auth.currentUser && auth.currentUser.uid) || ''); }catch(e){}

    // owner ไม่ใช่ readonly
    var owner = String(course.ownerEmail || course.teacherEmail || course.createdByEmail || course.userEmail || '').trim().toLowerCase();
    var ownerUid = String(course.ownerUid || course.createdByUid || course.userId || '').trim();
    if((email && owner && email===owner) || (uid && ownerUid && uid===ownerUid)) return false;

    var list = []
      .concat(Array.isArray(course.sharedTeachers) ? course.sharedTeachers : [])
      .concat(Array.isArray(course.teachers) ? course.teachers : [])
      .concat(Array.isArray(course.courseTeachers) ? course.courseTeachers : [])
      .concat(Array.isArray(course.sharedWith) ? course.sharedWith : []);

    var me=list.find(function(x){
      x=x||{};
      var em=String(x.email||x.userEmail||x.teacherEmail||'').trim().toLowerCase();
      var id=String(x.uid||x.userId||'').trim();
      return (email && em===email) || (uid && id===uid);
    });

    if(!me) {
      // บางระบบใส่ field ง่าย ๆ
      if(course.shareMode === 'readonly' || course.permission === 'readonly' || course.role === 'viewer') return true;
      return false;
    }

    var role=String(me.role||me.permission||me.access||me.mode||'').toLowerCase();
    var canEdit = me.canEdit === true || me.edit === true || me.allowEdit === true || role==='editor' || role==='co_teacher' || role==='teacher';
    var readonly = me.readOnly === true || me.readonly === true || me.canEdit === false || role==='viewer' || role==='view' || role==='readonly' || role==='read_only' || role==='ดูอย่างเดียว';

    return readonly && !canEdit;
  }

  window.schoolhubIsReadonlySharedCourse = isReadonlyShare;

  function getCourseIdFromCard(card){
    if(!card) return '';
    var s = (card.getAttribute('onclick')||'') + ' ' + card.innerHTML;
    var m = s.match(/openCourseDetail\(['"]([^'"]+)['"]\)/) || s.match(/editCourse\(['"]([^'"]+)['"]\)/) || s.match(/deleteCourse\(['"]([^'"]+)['"]\)/);
    if(m) return m[1];
    return card.dataset.courseId || card.getAttribute('data-course-id') || '';
  }

  function courseById(id){
    try{return (window.state && Array.isArray(state.courses) ? state.courses : []).find(function(c){return String(c.id)===String(id);});}catch(e){return null;}
  }

  function markReadonlyCourseCards(){
    var courses = [];
    try{courses = (window.state && Array.isArray(state.courses)) ? state.courses : [];}catch(e){}
    if(!courses.length) return;

    document.querySelectorAll('#course-grid > div, #course-grid .course-card, [data-course-id]').forEach(function(card){
      var id=getCourseIdFromCard(card);
      var c=courseById(id);
      if(!c){
        var txt=card.textContent||'';
        c=courses.find(function(x){return txt.indexOf(x.name||'__')!==-1 || txt.indexOf(x.code||'__')!==-1;});
      }
      if(!c) return;
      var ro=isReadonlyShare(c);
      card.classList.toggle('schoolhub-readonly-shared-course', ro);
      card.setAttribute('data-readonly-share', ro ? 'true' : 'false');

      if(ro && !card.querySelector('.readonly-badge')){
        var h=card.querySelector('h3, .font-bold, .font-black') || card.firstElementChild;
        if(h) h.insertAdjacentHTML('afterend','<span class="readonly-badge"><i class="fas fa-eye"></i>ดูอย่างเดียว</span>');
      }

      if(ro){
        card.querySelectorAll('button,a').forEach(function(btn){
          var s=(btn.getAttribute('onclick')||'')+' '+(btn.textContent||'')+' '+(btn.id||'')+' '+(btn.className||'');
          if(/editCourse|deleteCourse|แก้ไข|ลบ|จัดการครู|เกณฑ์เกรด|แผนคะแนน|เพิ่ม/i.test(s)){
            btn.classList.add('schoolhub-edit-action');
            btn.setAttribute('data-edit-action','true');
            btn.style.display='none';
          }
        });
      }
    });
  }

  function hideReadonlyDetailActions(){
    var cid = window.currentActiveCourseId || '';
    var c=courseById(cid);
    if(!isReadonlyShare(c)) return;

    document.querySelectorAll('#view-course-detail button,#view-course-detail a,#header-actions button,#header-actions a').forEach(function(btn){
      var s=(btn.getAttribute('onclick')||'')+' '+(btn.textContent||'')+' '+(btn.id||'')+' '+(btn.className||'');
      if(/editCourse|deleteCourse|openPlanModalForCurrentCourse|openGradeCriteria|CourseTeachers|จัดการครู|จัดการแผน|เกณฑ์เกรด|แก้ไข|ลบ|เพิ่ม/i.test(s)){
        // ปุ่มกลับไม่ซ่อน
        if(/course-back-btn|กลับ/.test(s)) return;
        btn.classList.add('schoolhub-edit-action');
        btn.setAttribute('data-edit-action','true');
        btn.style.display='none';
      }
    });
  }

  function patchRender(){
    if(typeof window.renderCourses === 'function' && !window.renderCourses.__readonlyShareWrapped){
      var old=window.renderCourses;
      window.renderCourses=function(){
        var r=old.apply(this,arguments);
        setTimeout(markReadonlyCourseCards,40);
        setTimeout(markReadonlyCourseCards,250);
        return r;
      };
      window.renderCourses.__readonlyShareWrapped=true;
    }
    if(typeof window.renderCourseGrid === 'function' && !window.renderCourseGrid.__readonlyShareWrapped){
      var old2=window.renderCourseGrid;
      window.renderCourseGrid=function(){
        var r=old2.apply(this,arguments);
        setTimeout(markReadonlyCourseCards,40);
        setTimeout(markReadonlyCourseCards,250);
        return r;
      };
      window.renderCourseGrid.__readonlyShareWrapped=true;
    }
    if(typeof window.openCourseDetail === 'function' && !window.openCourseDetail.__readonlyShareWrapped){
      var oldOpen=window.openCourseDetail;
      window.openCourseDetail=function(){
        var r=oldOpen.apply(this,arguments);
        setTimeout(function(){markReadonlyCourseCards(); hideReadonlyDetailActions();},60);
        setTimeout(hideReadonlyDetailActions,300);
        return r;
      };
      window.openCourseDetail.__readonlyShareWrapped=true;
    }
  }

  function blockReadonlyEdit(action){
    var cid = window.currentActiveCourseId || '';
    var c=courseById(cid);
    if(!isReadonlyShare(c)) return false;
    if(typeof window.showCustomAlert === 'function') window.showCustomAlert('ดูได้อย่างเดียว','คุณมีสิทธิ์ดูรายวิชานี้เท่านั้น ไม่สามารถ'+(action||'แก้ไขข้อมูล')+'ได้',true);
    else alert('คุณมีสิทธิ์ดูรายวิชานี้เท่านั้น');
    return true;
  }

  function wrapEditFn(name, label){
    var old=window[name];
    if(typeof old !== 'function' || old.__readonlyShareWrapped) return;
    window[name]=function(){
      if(blockReadonlyEdit(label)) return false;
      return old.apply(this,arguments);
    };
    window[name].__readonlyShareWrapped=true;
  }

  function init(){
    patchRender();
    ['editCourse','deleteCourse','openPlanModalForCurrentCourse','openGradeCriteriaModalForCurrentCourse','openCourseTeachers','openCourseTeachersModal','addCourseTeacher','saveCourseTeachers','saveCourse','handleAddPlan','editPlan','deletePlan','saveGradeCriteria'].forEach(function(n){wrapEditFn(n,'แก้ไขข้อมูล');});
    markReadonlyCourseCards();
    hideReadonlyDetailActions();
  }

  document.addEventListener('DOMContentLoaded',function(){
    init();
    setTimeout(init,500);
    setTimeout(init,1500);
  });
  document.addEventListener('click',function(e){
    var btn=e.target && e.target.closest ? e.target.closest('button,a') : null;
    if(btn){
      var card=btn.closest('[data-readonly-share="true"],.schoolhub-readonly-shared-course');
      var s=(btn.getAttribute('onclick')||'')+' '+(btn.textContent||'')+' '+(btn.id||'')+' '+(btn.className||'');
      if(card && /editCourse|deleteCourse|แก้ไข|ลบ|จัดการครู|เกณฑ์เกรด|แผนคะแนน|เพิ่ม/i.test(s)){
        e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation();
        return false;
      }
    }
    setTimeout(init,120);
  },true);
  setInterval(init,2000);
})();
