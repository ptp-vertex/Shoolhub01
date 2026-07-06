
    (function(){
      if (window.__schoolhubDropdownPerformanceHelper) return;
      window.__schoolhubDropdownPerformanceHelper = true;
      window.isDropdownRelatedElement = function(el) {
        return !!(
          el &&
          el.closest &&
          el.closest(
            'select, option, datalist, .dropdown, .dropdown-menu, .dropdown-content, .custom-select, .select-menu, .choices, .choices__list, .select2, .flatpickr-calendar, [role="listbox"], [role="option"], [data-dropdown], [data-menu]'
          )
        );
      };
    })();
    