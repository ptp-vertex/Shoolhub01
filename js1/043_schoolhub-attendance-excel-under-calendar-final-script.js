
(function(){
  if(window.__schoolhubAttendanceExcelUnderCalendarFinal) return;
  window.__schoolhubAttendanceExcelUnderCalendarFinal=true;

  function placeAttendanceExcelButtonUnderCalendar(){
    var tab=document.getElementById('course-tab-attendance');
    if(!tab) return;
    var grid=tab.querySelector('.grid.grid-cols-1.lg\\:grid-cols-3, .grid');
    if(!grid) return;
    var calendarCard=document.getElementById('attendance-calendar-open-btn') && document.getElementById('attendance-calendar-open-btn').closest('.bg-white.rounded-2xl');
    if(!calendarCard) return;

    var column=document.getElementById('schoolhub-attendance-calendar-column');
    if(!column){
      column=document.createElement('div');
      column.id='schoolhub-attendance-calendar-column';
      calendarCard.parentNode.insertBefore(column, calendarCard);
      column.appendChild(calendarCard);
    }else if(calendarCard.parentElement!==column){
      column.insertBefore(calendarCard, column.firstChild);
    }

    var wrap=document.getElementById('schoolhub-attendance-excel-under-calendar-wrap');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.id='schoolhub-attendance-excel-under-calendar-wrap';
      column.appendChild(wrap);
    }else if(wrap.parentElement!==column){
      column.appendChild(wrap);
    }

    var btn=document.getElementById('btn-export-attendance-excel');
    if(!btn){
      btn=document.createElement('button');
      btn.id='btn-export-attendance-excel';
      btn.type='button';
      btn.innerHTML='<i class="fas fa-file-excel"></i> โหลด Excel';
    }
    btn.className='bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl font-bold flex items-center gap-2 transition shadow-sm w-full justify-center text-sm border border-emerald-200';
    btn.onclick=window.exportAttendanceToExcel;
    if(btn.parentElement!==wrap) wrap.appendChild(btn);
  }

  var oldRenderAttendanceList=window.renderAttendanceList;
  if(typeof oldRenderAttendanceList==='function' && !oldRenderAttendanceList.__excelUnderCalendarWrapped){
    var wrapped=function(){
      var r=oldRenderAttendanceList.apply(this,arguments);
      setTimeout(placeAttendanceExcelButtonUnderCalendar,0);
      return r;
    };
    wrapped.__excelUnderCalendarWrapped=true;
    window.renderAttendanceList=wrapped;
  }

  var oldSwitchCourseTab=window.switchCourseTab;
  if(typeof oldSwitchCourseTab==='function' && !oldSwitchCourseTab.__excelUnderCalendarWrapped){
    var switchWrapped=function(){
      var r=oldSwitchCourseTab.apply(this,arguments);
      setTimeout(placeAttendanceExcelButtonUnderCalendar,0);
      setTimeout(placeAttendanceExcelButtonUnderCalendar,250);
      return r;
    };
    switchWrapped.__excelUnderCalendarWrapped=true;
    window.switchCourseTab=switchWrapped;
  }

  document.addEventListener('DOMContentLoaded',function(){
    placeAttendanceExcelButtonUnderCalendar();
    setTimeout(placeAttendanceExcelButtonUnderCalendar,300);
    setTimeout(placeAttendanceExcelButtonUnderCalendar,900);
    var tab=document.getElementById('course-tab-attendance');
    if(tab && window.MutationObserver){
      new MutationObserver(function(){placeAttendanceExcelButtonUnderCalendar();}).observe(tab,{childList:true,subtree:true});
    }
  });
})();
