
(function(){
  function removeGlobalStatsPanel(){
    try{
      var panel = document.getElementById('admin-global-stats-panel');
      if(panel) panel.remove();
    }catch(e){}
  }
  removeGlobalStatsPanel();
  document.addEventListener('DOMContentLoaded', removeGlobalStatsPanel);
  setInterval(removeGlobalStatsPanel, 800);
})();
