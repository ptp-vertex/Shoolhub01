
(function(){
    function moveCalendarPopupToBody(){
        var popup = document.getElementById('attendance-calendar-popup');
        if(popup && popup.parentElement !== document.body){
            document.body.appendChild(popup);
        }
    }
    document.addEventListener('DOMContentLoaded', function(){
        setTimeout(moveCalendarPopupToBody, 200);
    });
    document.addEventListener('click', function(e){
        var btn = e.target && (e.target.id === 'attendance-calendar-open-btn' || e.target.closest && e.target.closest('#attendance-calendar-open-btn'));
        if(btn) setTimeout(moveCalendarPopupToBody, 0);
    }, true);
    setInterval(function(){
        var popup = document.getElementById('attendance-calendar-popup');
        if(popup && !popup.classList.contains('hidden') && popup.parentElement !== document.body){
            document.body.appendChild(popup);
        }
    }, 300);
})();
