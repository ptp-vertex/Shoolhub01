
(function() {
    'use strict';

    var scrollTimer = null;
    var body = document.body;
    var isScrolling = false;

    // ใช้ requestAnimationFrame เพื่อให้การจัดการ class 'scrolling' ทำงานได้ตรงตามจังหวะหน้าจอ (60fps/120fps)
    function handleScroll() {
        if (!isScrolling) {
            isScrolling = true;
            body.classList.add('scrolling');
        }
        
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function() {
            isScrolling = false;
            body.classList.remove('scrolling');
            scrollTimer = null;
        }, 100); // ลดเวลาลงเพื่อให้กลับมาสวยงามได้เร็วขึ้นหลังหยุดสโครล
    }

    // capture:true สำคัญมาก: ปกติ scroll event ของ div ย่อยๆ (เช่น รายการใน modal ที่ scroll ข้างในตัวเอง)
    // จะไม่ bubble ขึ้นมาถึง window เลย ถ้าไม่ใส่ capture:true ปุ่ม/สไตล์ "กำลังสโครล" ของระบบนี้
    // จะไม่ทำงานเลยเวลาผู้ใช้สโครลลิสต์ข้างใน popup (เช่น หน้าต่างแก้ไขข้อมูลรายวิชา) ทำให้ยังกระตุกเหมือนเดิม
    window.addEventListener('scroll', function() {
        window.requestAnimationFrame(handleScroll);
    }, { passive: true, capture: true });

    // ปรับปรุงประสิทธิภาพของ dropdown (shdd)
    // ใช้เทคนิค Throttle เพื่อลดภาระการคำนวณตำแหน่ง
    if (window.onScrollResize) {
        var ticking = false;
        var originalFunc = window.onScrollResize;
        
        // สำคัญ: ตอน addEventListener ของ onScrollResize เดิม (js2/106) ใส่ capture:true ไว้
        // ตอน removeEventListener ต้องระบุ capture:true ให้ตรงกันเป๊ะ ไม่งั้นจะลบไม่ออกจริง (เงียบๆ ไม่ error)
        // แล้วจะกลายเป็นมี listener เดิม (ไม่มี throttle) ทำงานซ้ำกับตัวใหม่ที่ throttle ไว้แล้ว
        // ทำให้ onScrollResize ถูกเรียกซ้ำสองชุดทุกครั้งที่ scroll โดยไม่จำเป็น
        window.removeEventListener('scroll', window.onScrollResize, true);
        window.addEventListener('scroll', function() {
            if (!ticking) {
                window.requestAnimationFrame(function() {
                    originalFunc();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true, capture: true });
    }

    // เทคนิคพิเศษ: ปิดการทำงานของ CSS Filters ชั่วคราวเฉพาะบนมือถือที่สเปคต่ำ
    // แต่บน Desktop หรือเครื่องที่แรงพอ จะยังคงความสวยงามไว้ตลอด
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        // เพิ่มความลื่นไหลพิเศษสำหรับมือถือ
        var style = document.createElement('style');
        style.textContent = 'body.scrolling .glass-card, body.scrolling .pricing-card { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; background: rgba(255,255,255,0.98) !important; }';
        document.head.appendChild(style);
    }

    console.log('SchoolHub Beauty & Performance Handler Initialized');
})();
