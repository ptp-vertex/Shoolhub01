
/* SchoolHub Google login safe-wait patch
   ปิดแพตช์เก่าที่เคยบังคับเปิด main-app หลังคลิก Google เพราะทำให้หลุดเข้าหน้าหลักก่อนโหลดจริง
   ใช้ปุ่ม Google แบบ spinner และรอ onAuthStateChanged โหลดข้อมูลสำเร็จก่อนค่อยเปิดหน้าเข้าใช้งานแทน
*/
