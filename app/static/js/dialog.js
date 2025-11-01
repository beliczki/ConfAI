/**
 * Custom Dialog System for ConfAI
 * Replaces native alert() and confirm() with polished modal dialogs
 */

const Dialog = {
    /**
     * Show an informational or error dialog
     * @param {string} message - The message to display
     * @param {string} type - Type of dialog: 'info', 'success', 'error', 'warning'
     * @returns {Promise<void>}
     */
    show: function(message, type = 'info') {
        return new Promise((resolve) => {
            // Remove any existing dialogs
            this._removeExisting();

            // Create dialog elements
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = `dialog-box dialog-${type}`;

            // Icon based on type
            const icons = {
                info: '<i data-lucide="info"></i>',
                success: '<i data-lucide="check-circle"></i>',
                error: '<i data-lucide="alert-circle"></i>',
                warning: '<i data-lucide="alert-triangle"></i>'
            };

            dialog.innerHTML = `
                <div class="dialog-header">
                    <div class="dialog-icon">${icons[type] || icons.info}</div>
                </div>
                <div class="dialog-content">
                    <p class="dialog-message">${this._escapeHtml(message)}</p>
                </div>
                <div class="dialog-footer">
                    <button class="dialog-btn dialog-btn-primary" id="dialog-ok">OK</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Initialize Lucide icons
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }

            // Animate in
            requestAnimationFrame(() => {
                overlay.classList.add('active');
                dialog.classList.add('active');
            });

            // Handle OK button
            const okBtn = dialog.querySelector('#dialog-ok');
            const closeDialog = () => {
                overlay.classList.remove('active');
                dialog.classList.remove('active');
                setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 200);
            };

            okBtn.addEventListener('click', closeDialog);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeDialog();
            });

            // ESC key to close
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    closeDialog();
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);

            // Focus OK button
            okBtn.focus();
        });
    },

    /**
     * Show a confirmation dialog with Yes/No buttons
     * @param {string} message - The confirmation message
     * @param {object} options - Optional configuration
     * @returns {Promise<boolean>} - true if confirmed, false if cancelled
     */
    confirm: function(message, options = {}) {
        return new Promise((resolve) => {
            // Remove any existing dialogs
            this._removeExisting();

            // Default options
            const config = {
                confirmText: options.confirmText || 'Confirm',
                cancelText: options.cancelText || 'Cancel',
                type: options.type || 'warning',
                confirmStyle: options.confirmStyle || 'danger' // 'danger' or 'primary'
            };

            // Create dialog elements
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = `dialog-box dialog-${config.type}`;

            // Icon
            const icon = '<i data-lucide="alert-triangle"></i>';

            dialog.innerHTML = `
                <div class="dialog-header">
                    <div class="dialog-icon">${icon}</div>
                </div>
                <div class="dialog-content">
                    <p class="dialog-message">${this._escapeHtml(message)}</p>
                </div>
                <div class="dialog-footer">
                    <button class="dialog-btn dialog-btn-secondary" id="dialog-cancel">${config.cancelText}</button>
                    <button class="dialog-btn dialog-btn-${config.confirmStyle}" id="dialog-confirm">
                        ${config.confirmStyle === 'danger' ? '<i data-lucide="trash-2"></i>' : ''}
                        <span>${config.confirmText}</span>
                    </button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Initialize Lucide icons
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }

            // Animate in
            requestAnimationFrame(() => {
                overlay.classList.add('active');
                dialog.classList.add('active');
            });

            // Handle buttons
            const confirmBtn = dialog.querySelector('#dialog-confirm');
            const cancelBtn = dialog.querySelector('#dialog-cancel');

            const closeDialog = (result) => {
                overlay.classList.remove('active');
                dialog.classList.remove('active');
                setTimeout(() => {
                    overlay.remove();
                    resolve(result);
                }, 200);
            };

            confirmBtn.addEventListener('click', () => closeDialog(true));
            cancelBtn.addEventListener('click', () => closeDialog(false));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeDialog(false);
            });

            // ESC key to cancel
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    closeDialog(false);
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);

            // Focus confirm button
            confirmBtn.focus();
        });
    },

    /**
     * Remove any existing dialogs
     * @private
     */
    _removeExisting: function() {
        const existing = document.querySelectorAll('.dialog-overlay');
        existing.forEach(el => el.remove());
    },

    /**
     * Escape HTML to prevent XSS
     * @private
     */
    _escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Convenience functions for global use
function showDialog(message, type = 'info') {
    return Dialog.show(message, type);
}

function showConfirm(message, options = {}) {
    return Dialog.confirm(message, options);
}

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Dialog, showDialog, showConfirm };
}
