

// =============================================================================
// Debug Context Functions
// =============================================================================

/**
 * Toggle debug context mode
 */
function toggleDebugContext(event) {
    event.stopPropagation();
    const checkbox = document.getElementById('debug-context-toggle');
    const isEnabled = checkbox.checked;
    
    // Save state to localStorage
    localStorage.setItem('debugContextEnabled', isEnabled);
    
    console.log('Debug context mode:', isEnabled ? 'enabled' : 'disabled');
}

/**
 * Show debug context dialog with full LLM input
 */
async function showDebugContextDialog(userMessage) {
    try {
        // Fetch the debug context from backend
        const response = await fetch('/api/chat/debug-context', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                thread_id: currentThreadId,
                message: userMessage
            })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch debug context');
        }

        const data = await response.json();

        // Create and show the dialog
        const dialog = document.getElementById('debug-context-dialog');
        const overlay = document.getElementById('debug-context-overlay');
        
        // Populate dialog content
        document.getElementById('debug-context-content').textContent = JSON.stringify(data, null, 2);
        
        // Show dialog
        overlay.classList.add('active');
        dialog.classList.add('active');
        
    } catch (error) {
        console.error('Error showing debug context:', error);
        showDialog('Failed to load debug context. Check console for details.', 'error');
    }
}

/**
 * Close debug context dialog without sending
 */
function closeDebugContextDialog() {
    const dialog = document.getElementById('debug-context-dialog');
    const overlay = document.getElementById('debug-context-overlay');
    
    overlay.classList.remove('active');
    dialog.classList.remove('active');
}

/**
 * Send message from debug context dialog
 */
function sendFromDebugDialog() {
    // Set bypass flag
    debugContextBypass = true;
    
    // Close dialog
    closeDebugContextDialog();
    
    // Trigger send
    sendMessage();
}

// Initialize debug context toggle state on page load
document.addEventListener('DOMContentLoaded', function() {
    const debugToggle = document.getElementById('debug-context-toggle');
    if (debugToggle) {
        const savedState = localStorage.getItem('debugContextEnabled') === 'true';
        debugToggle.checked = savedState;
    }
});
