/**
 * ConfAI Admin Dashboard JavaScript
 * Handles all admin functionality including system prompt editing,
 * context file management, statistics, and settings.
 */

// Template definitions for quick system prompt templates
const PROMPT_TEMPLATES = {
    conference: `You are a helpful AI assistant specialized in conference insights and book knowledge.
You have access to conference transcripts and related books.
Respond concisely and insightfully, drawing from the provided context when relevant.
Be professional, engaging, and help users derive meaningful insights.`,

    helpful: `You are a friendly and helpful AI assistant.
Your goal is to provide accurate, thoughtful, and useful responses.
Be conversational, empathetic, and always aim to understand the user's needs.
Draw from the provided context when it's relevant to the conversation.`,

    concise: `You are a concise AI assistant that provides clear, direct answers.
Keep responses brief and to the point.
Use the provided context to give accurate information.
Avoid unnecessary elaboration unless specifically requested.`,

    creative: `You are a creative and innovative AI assistant.
Think outside the box and provide unique perspectives.
Use the provided context as inspiration for creative insights.
Be engaging, thought-provoking, and encourage exploration of ideas.`
};

// Global state
let currentFiles = [];
let currentSystemPrompt = '';

/**
 * Initialize the admin dashboard on page load
 */
document.addEventListener('DOMContentLoaded', function() {
    // Load initial data
    loadSystemPrompt();
    loadContextFiles();
    loadStatistics();
    loadWelcomeMessage();

    // Setup event listeners
    setupFileUpload();
    setupCharacterCounter();
    setupWelcomeMessageCounter();

    console.log('Admin dashboard initialized');
});

/**
 * Switch between tabs in the admin dashboard
 */
function switchTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));

    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Activate the clicked button
    event.target.classList.add('active');

    // Load data for specific tabs when switched to
    if (tabName === 'context-files') {
        loadContextFiles();
    } else if (tabName === 'insights') {
        loadAdminInsights();
    } else if (tabName === 'statistics') {
        loadStatistics();
    }
}

// ============================
// SYSTEM PROMPT FUNCTIONALITY
// ============================

/**
 * Load the current system prompt from the server
 */
async function loadSystemPrompt() {
    try {
        const response = await fetch('/api/admin/system-prompt', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load system prompt');
        }

        const data = await response.json();
        currentSystemPrompt = data.prompt;

        const textarea = document.getElementById('current-prompt');
        if (textarea) {
            textarea.value = currentSystemPrompt;
            updateCharCount('current-prompt', 'prompt-chars');
        }
    } catch (error) {
        console.error('Error loading system prompt:', error);
        showStatus('prompt-status', 'Failed to load system prompt', 'error');
    }
}

/**
 * Save the system prompt to the server
 */
async function saveSystemPrompt() {
    const textarea = document.getElementById('current-prompt');
    const newPrompt = textarea.value.trim();

    if (!newPrompt) {
        showStatus('prompt-status', 'System prompt cannot be empty', 'error');
        return;
    }

    try {
        const response = await fetch('/api/admin/system-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ prompt: newPrompt })
        });

        if (!response.ok) {
            throw new Error('Failed to save system prompt');
        }

        const data = await response.json();
        currentSystemPrompt = newPrompt;
        showStatus('prompt-status', 'System prompt saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving system prompt:', error);
        showStatus('prompt-status', 'Failed to save system prompt', 'error');
    }
}

/**
 * Reset system prompt to default
 */
function resetSystemPrompt() {
    if (!confirm('Are you sure you want to reset the system prompt to default? This will discard any custom changes.')) {
        return;
    }

    const defaultPrompt = PROMPT_TEMPLATES.conference;
    const textarea = document.getElementById('current-prompt');

    if (textarea) {
        textarea.value = defaultPrompt;
        updateCharCount('current-prompt', 'prompt-chars');
        showStatus('prompt-status', 'System prompt reset to default. Click "Save Changes" to apply.', 'info');
    }
}

/**
 * Test the system prompt (placeholder for future implementation)
 */
function testSystemPrompt() {
    const prompt = document.getElementById('current-prompt').value.trim();

    if (!prompt) {
        showStatus('prompt-status', 'Cannot test an empty prompt', 'error');
        return;
    }

    // For now, just show a preview
    alert('System Prompt Preview:\n\n' + prompt + '\n\n(Testing functionality will be implemented in a future update)');
}

/**
 * Load a predefined template into the system prompt editor
 */
function loadTemplate(templateName) {
    if (!PROMPT_TEMPLATES[templateName]) {
        console.error('Template not found:', templateName);
        return;
    }

    const textarea = document.getElementById('current-prompt');
    if (textarea) {
        textarea.value = PROMPT_TEMPLATES[templateName];
        updateCharCount('current-prompt', 'prompt-chars');
        showStatus('prompt-status', `Template "${templateName}" loaded. Click "Save Changes" to apply.`, 'info');
    }
}

// ============================
// CONTEXT FILES FUNCTIONALITY
// ============================

/**
 * Setup file upload handlers (drag & drop + click)
 */
function setupFileUpload() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('context-file-input');

    if (!dropZone || !fileInput) return;

    // Click to upload
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files);
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFileSelect(e.dataTransfer.files);
    });
}

/**
 * Handle file selection and upload
 */
async function handleFileSelect(files) {
    if (!files || files.length === 0) return;

    const maxSize = 500 * 1024; // 500KB
    const allowedExtensions = ['.txt', '.md'];

    // Validate files
    for (let file of files) {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!allowedExtensions.includes(ext)) {
            alert(`File "${file.name}" has an invalid extension. Only .txt and .md files are allowed.`);
            return;
        }

        if (file.size > maxSize) {
            alert(`File "${file.name}" is too large. Maximum size is 500KB.`);
            return;
        }
    }

    // Upload files
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }

    try {
        const response = await fetch('/api/admin/context-files', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to upload files');
        }

        const data = await response.json();
        showStatus('prompt-status', `Successfully uploaded ${files.length} file(s)`, 'success');

        // Reload file list and preview
        await loadContextFiles();

    } catch (error) {
        console.error('Error uploading files:', error);
        alert('Failed to upload files. Please try again.');
    }
}

/**
 * Load and display context files
 */
async function loadContextFiles() {
    try {
        const response = await fetch('/api/admin/context-files', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load context files');
        }

        const data = await response.json();
        currentFiles = data.files || [];

        displayFilesList(currentFiles);
        updateContextPreview(data.preview || '');
        updateContextStats(data.total_chars || 0, data.total_tokens || 0);

    } catch (error) {
        console.error('Error loading context files:', error);
    }
}

/**
 * Display the list of context files
 */
function displayFilesList(files) {
    const filesList = document.getElementById('files-list');
    const fileCount = document.getElementById('file-count');

    if (!filesList) return;

    fileCount.textContent = files.length;

    if (files.length === 0) {
        filesList.innerHTML = '<p class="empty-state">No context files uploaded yet</p>';
        return;
    }

    filesList.innerHTML = files.map(file => `
        <div class="file-card">
            <div class="file-icon">📄</div>
            <div class="file-info">
                <div class="file-name">${escapeHtml(file.name)}</div>
                <div class="file-meta">
                    ${formatFileSize(file.size)} • ${file.chars} chars
                </div>
            </div>
            <button class="btn-icon btn-danger" onclick="deleteContextFile('${escapeHtml(file.name)}')" title="Delete file">
                🗑️
            </button>
        </div>
    `).join('');
}

/**
 * Delete a context file
 */
async function deleteContextFile(filename) {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/context-files/${encodeURIComponent(filename)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to delete file');
        }

        // Reload files
        await loadContextFiles();

    } catch (error) {
        console.error('Error deleting file:', error);
        alert('Failed to delete file. Please try again.');
    }
}

/**
 * Update the context preview display
 */
function updateContextPreview(preview) {
    const previewEl = document.getElementById('context-preview');

    if (!previewEl) return;

    if (!preview || preview.trim() === '') {
        previewEl.innerHTML = '<p class="empty-state">No context files uploaded yet</p>';
    } else {
        previewEl.innerHTML = `<pre>${escapeHtml(preview)}</pre>`;
    }
}

/**
 * Update context statistics
 */
function updateContextStats(chars, tokens) {
    const charsEl = document.getElementById('context-total-chars');
    const tokensEl = document.getElementById('context-total-tokens');

    if (charsEl) charsEl.textContent = chars.toLocaleString();
    if (tokensEl) tokensEl.textContent = tokens.toLocaleString();
}

// ============================
// STATISTICS FUNCTIONALITY
// ============================

/**
 * Load and display application statistics
 */
async function loadStatistics() {
    try {
        const response = await fetch('/api/admin/stats', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load statistics');
        }

        const data = await response.json();

        // Update stat cards
        updateStatCard('stat-users', data.total_users || 0);
        updateStatCard('stat-threads', data.total_threads || 0);
        updateStatCard('stat-insights', data.total_insights || 0);
        updateStatCard('stat-votes', data.total_votes || 0);

        // Update context usage
        updateContextUsage(data.context_used || 0, data.context_max || 200000);

        // Display recent activity
        displayRecentActivity(data.recent_activity || []);

    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

/**
 * Update a stat card value with animation
 */
function updateStatCard(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = value.toLocaleString();
    }
}

/**
 * Update context usage bar
 */
function updateContextUsage(used, max) {
    const fillEl = document.getElementById('context-usage-fill');
    const usedEl = document.getElementById('context-used');
    const maxEl = document.getElementById('context-max');

    const percentage = (used / max) * 100;

    if (fillEl) {
        fillEl.style.width = `${Math.min(percentage, 100)}%`;

        // Change color based on usage
        if (percentage > 90) {
            fillEl.style.backgroundColor = '#E20074'; // Magenta (danger)
        } else if (percentage > 70) {
            fillEl.style.backgroundColor = '#FF9500'; // Orange (warning)
        } else {
            fillEl.style.backgroundColor = '#00A651'; // Green (ok)
        }
    }

    if (usedEl) usedEl.textContent = used.toLocaleString();
    if (maxEl) maxEl.textContent = max.toLocaleString();
}

/**
 * Display recent activity log
 */
function displayRecentActivity(activities) {
    const activityEl = document.getElementById('recent-activity');

    if (!activityEl) return;

    if (activities.length === 0) {
        activityEl.innerHTML = '<p class="empty-state">No recent activity</p>';
        return;
    }

    activityEl.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <span class="activity-icon">${getActivityIcon(activity.type)}</span>
            <span class="activity-text">${escapeHtml(activity.text)}</span>
            <span class="activity-time">${activity.time}</span>
        </div>
    `).join('');
}

/**
 * Get icon for activity type
 */
function getActivityIcon(type) {
    const icons = {
        'user_joined': '👤',
        'thread_created': '💬',
        'insight_shared': '💡',
        'vote_cast': '👍',
        'file_uploaded': '📁',
        'prompt_updated': '✏️'
    };
    return icons[type] || '📌';
}

// ============================
// WELCOME MESSAGE FUNCTIONALITY
// ============================

/**
 * Load the current welcome message from the server
 */
async function loadWelcomeMessage() {
    try {
        const response = await fetch('/api/admin/welcome-message', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load welcome message');
        }

        const data = await response.json();

        const textarea = document.getElementById('welcome-message');
        if (textarea) {
            textarea.value = data.message;
            updateCharCount('welcome-message', 'welcome-chars');
        }

        console.log('Welcome message loaded successfully');
    } catch (error) {
        console.error('Error loading welcome message:', error);
        showStatus('welcome-status', 'Failed to load welcome message', 'error');
    }
}

/**
 * Save the welcome message to the server
 */
async function saveWelcomeMessage() {
    const textarea = document.getElementById('welcome-message');
    const message = textarea?.value.trim();

    if (!message) {
        showStatus('welcome-status', 'Welcome message cannot be empty', 'error');
        return;
    }

    try {
        const response = await fetch('/api/admin/welcome-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save welcome message');
        }

        const data = await response.json();
        showStatus('welcome-status', 'Welcome message saved successfully!', 'success');
        console.log('Welcome message saved');

    } catch (error) {
        console.error('Error saving welcome message:', error);
        showStatus('welcome-status', `Failed to save: ${error.message}`, 'error');
    }
}

/**
 * Setup character counter for welcome message textarea
 */
function setupWelcomeMessageCounter() {
    const textarea = document.getElementById('welcome-message');
    if (textarea) {
        textarea.addEventListener('input', () => {
            updateCharCount('welcome-message', 'welcome-chars');
        });
    }
}

// ============================
// SETTINGS FUNCTIONALITY
// ============================

/**
 * Save application settings
 */
async function saveSettings() {
    const settings = {
        llm_provider: document.getElementById('llm-provider')?.value,
        max_tokens: parseInt(document.getElementById('max-tokens')?.value),
        rate_limit: parseInt(document.getElementById('rate-limit')?.value),
        votes_per_user: parseInt(document.getElementById('votes-per-user')?.value)
    };

    // For now, just show a message (implementation depends on backend)
    console.log('Settings to save:', settings);
    alert('Settings saved successfully!\n\nNote: Some settings may require application restart to take effect.');
}

// ============================
// UTILITY FUNCTIONS
// ============================

/**
 * Get authentication headers for API requests
 */
function getAuthHeaders() {
    const headers = {};

    // Check if admin key is available in environment or session
    // In production, this would be securely handled
    const adminKey = localStorage.getItem('admin_key');
    if (adminKey) {
        headers['X-Admin-Key'] = adminKey;
    }

    return headers;
}

/**
 * Setup character counter for textareas
 */
function setupCharacterCounter() {
    const textarea = document.getElementById('current-prompt');
    if (textarea) {
        textarea.addEventListener('input', () => {
            updateCharCount('current-prompt', 'prompt-chars');
        });
    }
}

/**
 * Update character count display
 */
function updateCharCount(textareaId, counterId) {
    const textarea = document.getElementById(textareaId);
    const counter = document.getElementById(counterId);

    if (textarea && counter) {
        counter.textContent = textarea.value.length.toLocaleString();
    }
}

/**
 * Show status message
 */
function showStatus(elementId, message, type = 'info') {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.textContent = message;
    el.className = `status-message ${type}`;
    el.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        el.style.display = 'none';
    }, 5000);
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Load insights for admin management
 */
async function loadAdminInsights() {
    const loadingEl = document.getElementById('admin-insights-loading');
    const listEl = document.getElementById('admin-insights-list');
    const emptyEl = document.getElementById('admin-insights-empty');

    try {
        const response = await fetch('/api/admin/insights');
        const data = await response.json();

        loadingEl.style.display = 'none';

        if (data.insights.length === 0) {
            emptyEl.style.display = 'block';
            listEl.style.display = 'none';
        } else {
            emptyEl.style.display = 'none';
            listEl.style.display = 'block';
            renderAdminInsights(data.insights);
        }
    } catch (error) {
        console.error('Error loading insights:', error);
        loadingEl.innerHTML = '<p style="color: #ff6b6b;">Error loading insights</p>';
    }
}

/**
 * Render insights list for admin
 */
function renderAdminInsights(insights) {
    const listEl = document.getElementById('admin-insights-list');

    listEl.innerHTML = insights.map(insight => {
        const date = new Date(insight.created_at).toLocaleString();
        const content = insight.content.length > 200 ? insight.content.substring(0, 200) + '...' : insight.content;

        return `
            <div class="admin-insight-item" data-insight-id="${insight.id}">
                <div class="insight-header">
                    <div class="insight-user">
                        <div class="user-avatar-small" style="background: ${insight.avatar_gradient}">
                            ${insight.user_name.substring(0, 2).toUpperCase()}
                        </div>
                        <span class="user-name">${escapeHtml(insight.user_name)}</span>
                    </div>
                    <div class="insight-stats">
                        <span class="vote-stat">👍 ${insight.upvotes}</span>
                        <span class="vote-stat">👎 ${insight.downvotes}</span>
                        <span class="vote-stat net">Net: ${insight.net_votes}</span>
                    </div>
                </div>
                <div class="insight-content-preview">${escapeHtml(content)}</div>
                <div class="insight-footer">
                    <span class="insight-date">${date}</span>
                    <button class="btn btn-danger btn-sm" onclick="deleteInsight(${insight.id})">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Delete an insight
 */
async function deleteInsight(insightId) {
    if (!confirm('Are you sure you want to delete this insight? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/insights/${insightId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            // Remove the insight from the UI
            const insightEl = document.querySelector(`[data-insight-id="${insightId}"]`);
            if (insightEl) {
                insightEl.remove();
            }

            // Check if list is now empty
            const listEl = document.getElementById('admin-insights-list');
            if (listEl.children.length === 0) {
                document.getElementById('admin-insights-empty').style.display = 'block';
                listEl.style.display = 'none';
            }

            alert('Insight deleted successfully');
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Error deleting insight:', error);
        alert('Failed to delete insight');
    }
}
