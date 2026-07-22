/* =====================================================================
   PATCH 139: แก้ปุ่ม "ไปหน้ากรอกคะแนนสัปดาห์นี้" ไม่เด้งไปหน้าคะแนน
   -----------------------------------------------------------------------
   ปัญหาเดิม: jumpToScoreEntry() ใน js1/007.js รอแค่ setTimeout(60ms)
   ก่อนไปหา element #score-week และ #course-tab-scores แต่สคริปต์แพตช์
   อื่นๆ ที่ครอบ window.switchCourseTab ไว้หลายชั้น (เช่นไฟล์ 118, 120,
   121, 122) หน่วงเวลาการ render แท็บไว้นานกว่านั้น (~260ms) ทำให้ 60ms
   ไม่พอ -> ป็อปอัพปิดไปแล้ว แต่หน้าจอไม่เด้งไปหาสัปดาห์ที่เลือกไว้

   วิธีแก้: เขียนทับ window.jumpToScoreEntry ให้ "รอจนกว่า element จะ
   พร้อมจริง" ด้วยการ poll (เช็คซ้ำทุก 50ms สูงสุด ~3 วินาที) แทนการรอ
   เวลาคงที่ครั้งเดียว

   วิธีติดตั้ง: เพิ่ม
     <script src="js2/139_schoolhub-jump-to-score-entry-reliable-fix.js"></script>
   ต่อท้ายบรรทัดสุดท้ายของกลุ่ม <script src="js2/..."> ใน index.html
   (ให้โหลดหลังสคริปต์อื่นทั้งหมด ไม่ต้องแก้ไฟล์เดิมไฟล์ใด)
   ===================================================================== */
(function () {
    'use strict';
    if (window.__schoolhubJumpToScoreEntryReliableFix) return;
    window.__schoolhubJumpToScoreEntryReliableFix = true;

    function waitFor(checkFn, onReady, attempt) {
        attempt = attempt || 0;
        var el = null;
        try { el = checkFn(); } catch (e) { el = null; }
        if (el) { onReady(el); return; }
        if (attempt >= 60) { // ~3 วินาที (60 * 50ms)
            onReady(null); // หมดเวลารอ ยังลองทำต่อแบบ best-effort
            return;
        }
        setTimeout(function () { waitFor(checkFn, onReady, attempt + 1); }, 50);
    }

    window.jumpToScoreEntry = function (courseId, week, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();

        function afterCourseReady() {
            if (typeof window.switchCourseTab === 'function') {
                window.switchCourseTab('scores');
            }

            // รอจนกว่าแท็บ "คะแนน" และช่อง #score-week จะพร้อมใช้งานจริง
            waitFor(
                function () {
                    var tab = document.getElementById('course-tab-scores');
                    var scoreWeek = document.getElementById('score-week');
                    var tabVisible = tab && tab.offsetParent !== null && !tab.classList.contains('hidden');
                    var hasOption = scoreWeek && Array.prototype.some.call(scoreWeek.options || [], function (o) {
                        return o.value === String(week);
                    });
                    return (tabVisible && hasOption) ? { tab: tab, scoreWeek: scoreWeek } : null;
                },
                function (result) {
                    var scoreWeek = (result && result.scoreWeek) || document.getElementById('score-week');
                    var tab = (result && result.tab) || document.getElementById('course-tab-scores');

                    if (scoreWeek) {
                        scoreWeek.value = String(week);
                        if (typeof window.handleScoreWeekChange === 'function') {
                            try { window.handleScoreWeekChange(); } catch (e) { }
                        }
                        // trigger change event เผื่อมีสคริปต์อื่นดัก event 'change' ไว้ (เช่นไฟล์ 031/032/034/035)
                        try { scoreWeek.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { }
                    }

                    if (tab && typeof tab.scrollIntoView === 'function') {
                        tab.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            );
        }

        // ถ้ายังไม่ได้อยู่ในวิชานี้ ให้เปิดวิชาก่อน แล้วรอให้ currentActiveCourseId อัปเดตจริงๆ
        if (courseId && courseId !== window.currentActiveCourseId) {
            if (typeof window.openCourseDetail === 'function') { window.openCourseDetail(courseId); }
            else if (typeof window.selectCourse === 'function') { window.selectCourse(courseId); }

            waitFor(
                function () { return window.currentActiveCourseId === courseId ? true : null; },
                function () { afterCourseReady(); }
            );
        } else {
            afterCourseReady();
        }
    };
})();
