
(function(){
    function fmt2(ts){
        try{
            const d=new Date(Number(ts));
            if(isNaN(d)) return ts;
            return d.toLocaleString('th-TH',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
        }catch(e){return ts;}
    }
    function summaryText2(data){
        const courses=(data.courses||[]).length;
        const students=(data.students||[]).length;
        const scores=(data.scores||[]).length;
        const bonusWeeks=Object.keys((data.bonusScores||{})).reduce(function(acc,cid){ return acc+Object.keys(data.bonusScores[cid]||{}).length; },0);
        const starGroupCount=Object.keys((data.starGroups||{})).reduce(function(acc,cid){ return acc+((data.starGroups[cid]&&data.starGroups[cid].groups)||[]).length; },0);
        return courses+' วิชา • '+students+' นักเรียน • '+scores+' คะแนน • โบนัส '+bonusWeeks+' สัปดาห์ • กลุ่มดาว '+starGroupCount;
    }

    window.schoolhubConfirmRestore = async function(backupId){
        const ok=confirm('กู้คืนข้อมูล Backup นี้?\n\nข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่ด้วย Backup นี้ (รวมคะแนนโบนัสและดาว)\nดำเนินการต่อ?');
        if(!ok) return;
        const list=document.getElementById('schoolhub-backup-list');
        const btns=document.querySelectorAll('.sh-backup-restore-btn');
        btns.forEach(function(b){b.disabled=true;});
        if(list) list.style.opacity='.4';
        try{
            await window.schoolhubRestoreFromBackup(backupId);
            if(typeof window.showCustomAlert==='function') window.showCustomAlert('กู้คืนสำเร็จ','กู้คืนข้อมูลเรียบร้อยแล้ว กำลังรีเฟรชหน้า...');
            setTimeout(function(){ location.reload(); },1200);
        }catch(err){
            if(list) list.style.opacity='1';
            btns.forEach(function(b){b.disabled=false;});
            const msg='กู้คืนไม่ได้: '+(err&&err.message||String(err));
            if(typeof window.showCustomAlert==='function') window.showCustomAlert('ผิดพลาด',msg,true); else alert(msg);
        }
    };

    // กู้คืน Backup ล่าสุดทั้งหมดด้วยคลิกเดียว (ปุ่มในหน้าตั้งค่า)
    window.schoolhubRestoreLatestBackup = async function(){
        const list=document.getElementById('schoolhub-backup-list');
        try{
            const backups=await window.schoolhubListBackups();
            if(!backups||!backups.length){
                if(typeof window.showCustomAlert==='function') window.showCustomAlert('ไม่พบ Backup','ยังไม่มีข้อมูล Backup ให้กู้คืน',true); else alert('ยังไม่มีข้อมูล Backup ให้กู้คืน');
                return;
            }
            const latest=backups[0];
            const ok=confirm('กู้คืน Backup ล่าสุดทั้งหมด ('+fmt2(latest.id)+')?\n\nข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่ (รวมคะแนนโบนัสและดาว)\nดำเนินการต่อ?');
            if(!ok) return;
            if(list){ list.style.opacity='.4'; }
            await window.schoolhubRestoreFromBackup(latest.id);
            if(typeof window.showCustomAlert==='function') window.showCustomAlert('กู้คืนสำเร็จ','กู้คืนข้อมูลทั้งหมดจาก Backup ล่าสุดเรียบร้อยแล้ว กำลังรีเฟรชหน้า...');
            setTimeout(function(){ location.reload(); },1200);
        }catch(err){
            if(list) list.style.opacity='1';
            const msg='กู้คืนไม่ได้: '+(err&&err.message||String(err));
            if(typeof window.showCustomAlert==='function') window.showCustomAlert('ผิดพลาด',msg,true); else alert(msg);
        }
    };

    // schoolhubLoadBackupList = สำหรับ settings panel (แหล่งเดียวที่แสดงปุ่มกู้คืน)
    window.schoolhubLoadBackupList = async function(){
        const list=document.getElementById('schoolhub-backup-list');
        if(!list) return;
        list.innerHTML='<div class="text-center text-slate-400 py-6"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลด...</div>';
        try{
            const backups=await window.schoolhubListBackups();
            if(!backups||!backups.length){
                list.innerHTML='<div class="text-center text-slate-400 py-6"><i class="fas fa-inbox mr-2"></i>ไม่พบข้อมูล Backup</div>';
                return;
            }
            list.innerHTML=backups.map(function(b){
                return '<div class="sh-backup-item">'
                    +'<div class="sh-backup-item-info">'
                    +'<div class="sh-backup-item-time"><i class="fas fa-database text-amber-400 mr-1"></i>'+fmt2(b.id)+'</div>'
                    +'<div class="sh-backup-item-detail">'+summaryText2(b.data)+'</div>'
                    +'</div>'
                    +'<button class="sh-backup-restore-btn" onclick="schoolhubConfirmRestore(\''+b.id+'\')">'
                    +'<i class="fas fa-rotate-left"></i> กู้คืนรายการนี้'
                    +'</button>'
                    +'</div>';
            }).join('');
        }catch(err){
            list.innerHTML='<div class="text-center text-rose-500 py-4"><i class="fas fa-exclamation-triangle mr-2"></i>'+((err&&err.message)||String(err))+'</div>';
        }
    };
})();
