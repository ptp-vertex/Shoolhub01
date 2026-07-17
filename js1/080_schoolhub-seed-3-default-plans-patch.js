
(function(){
  function make3DefaultPlans(){
    var now = Date.now();
    return [
      {id:'standard',name:'มาตรฐาน',price:'99 บาทต่อเดือน',monthlyPrice:99,yearlyPrice:990,billingCycle:'monthly',freeFirstMonth:true,freeForever:false,courseLimit:3,studentLimit:120,weekLimit:20,allowAttendance:true,allowExport:false,allowTeam:false,teamMemberLimit:1,desc:'เหมาะสำหรับครูเริ่มใช้งานรายบุคคล ใช้เช็คชื่อและบันทึกคะแนนได้ครบ',features:['เพิ่มรายวิชาได้ 3 วิชา','นักเรียนสูงสุด 120 คน','ใช้งาน 20 สัปดาห์','เช็คชื่อและบันทึกคะแนน','ดูภาพรวมคะแนน','ไม่รองรับ Export Excel'],order:1,featured:true,active:true,updatedAt:now},
      {id:'pro',name:'โปร',price:'199 บาทต่อเดือน',monthlyPrice:199,yearlyPrice:1990,billingCycle:'monthly',freeFirstMonth:false,freeForever:false,courseLimit:10,studentLimit:0,weekLimit:30,allowAttendance:true,allowExport:true,allowTeam:false,teamMemberLimit:1,desc:'เหมาะสำหรับครูที่มีหลายรายวิชา ต้องการส่งออก Excel และจัดการข้อมูลมากขึ้น',features:['เพิ่มรายวิชาได้ 10 วิชา','นักเรียนไม่จำกัด','ใช้งาน 30 สัปดาห์','เช็คชื่อและบันทึกคะแนน','Export Excel ได้','จัดการแผนคะแนนและเกณฑ์เกรด'],order:2,featured:false,active:true,updatedAt:now},
      {id:'team',name:'ทีม',price:'499 บาทต่อเดือน',monthlyPrice:499,yearlyPrice:4990,billingCycle:'monthly',freeFirstMonth:false,freeForever:false,courseLimit:0,studentLimit:0,weekLimit:52,allowAttendance:true,allowExport:true,allowTeam:true,teamMemberLimit:5,desc:'เหมาะสำหรับใช้งานร่วมกันในแผนกหรือทีมครู แชร์สิทธิ์ให้สมาชิกได้',features:['เพิ่มรายวิชาไม่จำกัด','นักเรียนไม่จำกัด','ใช้งาน 52 สัปดาห์','ใช้งานแบบทีมได้ 5 คน','เช็คชื่อและ Export ได้ครบ','เหมาะสำหรับแผนก/ทีมครู'],order:3,featured:false,active:true,updatedAt:now}
    ];
  }
  window.getDefaultPlans = make3DefaultPlans;
  window.schoolhubGet3DefaultPlans = make3DefaultPlans;
  window.seedDefaultPlans = async function(){
    var plans = make3DefaultPlans();
    window.subscriptionPlans = plans;
    try { if (typeof localStorage !== 'undefined') { localStorage.setItem('schoolhub_subscription_plans', JSON.stringify(plans)); localStorage.setItem('schoolhub_public_plans', JSON.stringify(plans)); } } catch(e) {}
    if (Array.isArray(window.patchPlans)) window.patchPlans = plans;
    try { if (typeof syncGlobalPlans === 'function') syncGlobalPlans(); } catch(e) {}
    try { if (typeof renderAdminPlans === 'function') renderAdminPlans(); } catch(e) {}
    try { if (typeof renderLandingPlans === 'function') renderLandingPlans(); } catch(e) {}
    try { if (typeof renderUserPlans === 'function') renderUserPlans(); } catch(e) {}
    try { if (typeof window.toggleLoader === 'function') window.toggleLoader(true); } catch(e) {}
    try {
      if (typeof saveItemsToFirebase === 'function') await saveItemsToFirebase();
      else if (typeof setDoc === 'function' && typeof getPlansDocRef === 'function') await setDoc(getPlansDocRef(), {items:plans, updatedAt:Date.now()}, {merge:true});
      if (typeof showCustomAlert === 'function') showCustomAlert('สำเร็จ','สร้างแผนตัวอย่าง 3 แบบ: มาตรฐาน, โปร, ทีม เรียบร้อยแล้ว');
      else alert('สร้างแผนตัวอย่าง 3 แบบเรียบร้อยแล้ว');
    } catch(e) {
      if (typeof showCustomAlert === 'function') showCustomAlert('สร้างในเครื่องแล้ว','แต่ยังบันทึกขึ้น Firebase ไม่ได้: '+(e.message||e),true);
      else alert('สร้างในเครื่องแล้ว แต่ยังบันทึกขึ้น Firebase ไม่ได้: '+(e.message||e));
    } finally {
      try { if (typeof window.toggleLoader === 'function') window.toggleLoader(false); } catch(e) {}
    }
  };
})();
