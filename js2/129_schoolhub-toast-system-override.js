
(function() {
    // Create container for toasts if not exists
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    window.showToast = function(title, message, type = 'success', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;
        
        let iconClass = 'fa-check-circle';
        if (type === 'error') iconClass = 'fa-times-circle';
        if (type === 'info') iconClass = 'fa-info-circle';

        toast.innerHTML = `
            <div class="toast-icon"><i class="fas ${iconClass}"></i></div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message || ''}</div>
            </div>
        `;

        container.appendChild(toast);

        const removeToast = () => {
            toast.classList.add('hiding');
            setTimeout(() => {
                if (toast.parentNode) {
                    container.removeChild(toast);
                }
            }, 300);
        };

        if (duration > 0) {
            setTimeout(removeToast, duration);
        }

        toast.onclick = removeToast;
    };

    // Override existing showCustomAlert to use Toast instead
    window.showCustomAlert = function(title, message, isError = false) {
        window.showToast(title, message, isError ? 'error' : 'success');
        // Close existing modal if it's open
        if (typeof window.closeCustomAlert === 'function') window.closeCustomAlert();
    };

    // Override window.alert
    window.alert = function(message) {
        if (!message) return;
        window.showToast('แจ้งเตือน', message, 'info');
    };

    // Handle showCustomConfirm: Use Toast for "Success" or "Info" messages that don't need a choice
    const originalShowCustomConfirm = window.showCustomConfirm;
    window.showCustomConfirm = function(title, message, confirmCallback, cancelCallback = null) {
        const msg = String(message || '');
        if (msg.includes('สำเร็จ') || msg.includes('เรียบร้อย') || msg.includes('บันทึกแล้ว')) {
            window.showToast(title, message, 'success');
            if (confirmCallback) confirmCallback();
        } else {
            if (originalShowCustomConfirm) {
                originalShowCustomConfirm(title, message, confirmCallback, cancelCallback);
            } else {
                if (confirm(title + '\n' + message)) {
                    if (confirmCallback) confirmCallback();
                } else if (cancelCallback) {
                    cancelCallback();
                }
            }
        }
    };
})();
