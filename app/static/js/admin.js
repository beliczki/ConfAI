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
let selectedFile = null;

/**
 * Initialize the admin dashboard on page load
 */
document.addEventListener('DOMContentLoaded', function() {
    // Load initial data
    loadSystemPrompt();
    loadContextFiles();
    loadStatistics();
    loadWelcomeMessage();
    loadLLMProviderSetting();
    loadContextModeSetting();

    // Setup event listeners
    setupFileUpload();
    setupCharacterCounter();
    setupWelcomeMessageCounter();
    setupLLMProviderChange();
    setupContextModeChange();

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

    // Activate the clicked button - find the button by matching onclick attribute
    tabButtons.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${tabName}'`)) {
            btn.classList.add('active');
        }
    });

    // Load data for specific tabs when switched to
    if (tabName === 'context-files') {
        loadContextFiles();
        updateContextModeBanner();
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
async function resetSystemPrompt() {
    if (!await showConfirm('Are you sure you want to reset the system prompt to default? This will discard any custom changes.', {
        confirmText: 'Reset',
        confirmStyle: 'danger'
    })) {
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
    showDialog('System Prompt Preview:\n\n' + prompt + '\n\n(Testing functionality will be implemented in a future update)', 'info');
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
            showDialog(`File "${file.name}" has an invalid extension. Only .txt and .md files are allowed.`, 'error');
            return;
        }

        if (file.size > maxSize) {
            showDialog(`File "${file.name}" is too large. Maximum size is 500KB.`, 'error');
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
        showDialog('Failed to upload files. Please try again.', 'error');
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
        updateStatistics(); // Use updateStatistics() to only count enabled files

    } catch (error) {
        console.error('Error loading context files:', error);
    }
}

/**
 * Display the list of context files in new simple layout
 */
function displayFilesList(files) {
    const filesContainer = document.getElementById('files-list-container');
    const emptyState = document.getElementById('files-empty-state');
    const fileCount = document.getElementById('file-count');
    const fileCountStat = document.getElementById('file-count-stat');

    if (!filesContainer) return;

    // Update file counts
    if (fileCount) fileCount.textContent = files.length;
    if (fileCountStat) fileCountStat.textContent = files.length;

    if (files.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        // Clear any existing file items
        const existingItems = filesContainer.querySelectorAll('.file-list-item');
        existingItems.forEach(item => item.remove());
        return;
    }

    // Hide empty state
    if (emptyState) emptyState.style.display = 'none';

    // Create file list items
    const filesHTML = files.map((file, index) => {
        const fileNameEscaped = escapeHtml(file.name).replace(/'/g, "\\'");
        const isEnabled = file.enabled !== false; // Default to enabled if not specified
        return `
        <div class="file-list-item" data-file-index="${index}" onclick="viewFileContent(${index})">
            <div class="file-item-name-row">
                <i data-lucide="file-text"></i>
                <span class="file-item-name-text">${escapeHtml(file.name)}</span>
            </div>
            <div class="file-item-stats">
                <button class="file-checkbox-btn ${isEnabled ? 'checked' : ''}" onclick="event.stopPropagation(); toggleFileEnabled(${index})" title="${isEnabled ? 'Enabled in context' : 'Disabled from context'}">
                    <i data-lucide="${isEnabled ? 'check-square' : 'square'}"></i>
                </button>
                <span>${formatFileSize(file.size)}</span>
                <span>•</span>
                <span>${file.chars.toLocaleString()} chars</span>
                <span>•</span>
                <span>${Math.ceil(file.chars / 4).toLocaleString()} tokens</span>
                <button class="btn-file-delete" onclick="event.stopPropagation(); deleteFileByIndex(${index})">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');

    // Insert after empty state or replace existing items
    const existingItems = filesContainer.querySelectorAll('.file-list-item');
    if (existingItems.length > 0) {
        existingItems.forEach(item => item.remove());
    }
    filesContainer.insertAdjacentHTML('beforeend', filesHTML);

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 10);
    }

    // Update statistics
    updateStatistics();

    // Automatically select the first file
    if (files.length > 0) {
        viewFileContent(0);
    }
}

/**
 * Select a file to view details
 */
function selectFile(index) {
    selectedFile = currentFiles[index];

    // Update UI - remove selected class from all items
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Add selected class to clicked item
    const selectedItem = document.querySelector(`[data-file-index="${index}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }

    // Update selected panel
    updateSelectedPanel();

    // Update preview panel
    updatePreviewPanel();

    // Enable delete button
    const deleteBtn = document.getElementById('delete-file-btn');
    if (deleteBtn) {
        deleteBtn.disabled = false;
    }
}

/**
 * Update the selected file info panel
 */
function updateSelectedPanel() {
    const selectedInfoEl = document.getElementById('selected-file-info');

    if (!selectedInfoEl || !selectedFile) return;

    selectedInfoEl.innerHTML = `
        <div class="selected-file-details">
            <div class="detail-row">
                <div class="detail-label">Filename</div>
                <div class="detail-value">${escapeHtml(selectedFile.name)}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">File Size</div>
                <div class="detail-value">${formatFileSize(selectedFile.size)}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Characters</div>
                <div class="detail-value">${selectedFile.chars.toLocaleString()}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Estimated Tokens</div>
                <div class="detail-value">${Math.ceil(selectedFile.chars / 4).toLocaleString()}</div>
            </div>
        </div>
    `;
}

/**
 * Update the content preview panel
 */
function updatePreviewPanel() {
    const previewEl = document.getElementById('context-preview');

    if (!previewEl || !selectedFile) return;

    previewEl.textContent = selectedFile.content || selectedFile.preview || 'No content available';
}

/**
 * Clear file selection
 */
function clearFileSelection() {
    selectedFile = null;

    // Remove selected class from all items
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Reset selected panel
    const selectedInfoEl = document.getElementById('selected-file-info');
    if (selectedInfoEl) {
        selectedInfoEl.innerHTML = '<p class="empty-state">Select a file to view details</p>';
    }

    // Reset preview panel
    const previewEl = document.getElementById('context-preview');
    if (previewEl) {
        previewEl.innerHTML = '<p class="empty-state">Select a file to preview its content</p>';
    }

    // Disable delete button
    const deleteBtn = document.getElementById('delete-file-btn');
    if (deleteBtn) {
        deleteBtn.disabled = true;
    }
}

/**
 * Delete the currently selected file
 */
async function deleteSelectedFile() {
    if (!selectedFile) return;

    await deleteContextFile(selectedFile.name);
    clearFileSelection();
}

/**
 * Delete a context file
 */
async function deleteContextFile(filename) {
    if (!await showConfirm(`Are you sure you want to delete "${filename}"?`, {
        confirmText: 'Delete',
        confirmStyle: 'danger'
    })) {
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
        showDialog('Failed to delete file. Please try again.', 'error');
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
        updateStatCard('stat-tokens-sent', data.tokens_sent || 0);
        updateStatCard('stat-tokens-received', data.tokens_received || 0);

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
            <div class="activity-left">
                <i data-lucide="${getActivityIcon(activity.type)}" class="activity-icon"></i>
                <span class="activity-text">${escapeHtml(activity.text)}</span>
            </div>
            <span class="activity-time">${activity.time}</span>
        </div>
    `).join('');

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Get Lucide icon name for activity type
 */
function getActivityIcon(type) {
    const icons = {
        'user_joined': 'user-plus',
        'thread_created': 'message-circle',
        'insight_shared': 'lightbulb',
        'vote_cast': 'thumbs-up',
        'file_uploaded': 'folder-up',
        'prompt_updated': 'edit'
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
 * Load current LLM provider setting
 */
async function loadLLMProviderSetting() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error('Failed to load config');
        }

        const data = await response.json();
        const providerSelect = document.getElementById('llm-provider');

        if (providerSelect && data.provider) {
            providerSelect.value = data.provider;
            console.log('Loaded LLM provider setting:', data.provider);
        }
    } catch (error) {
        console.error('Error loading LLM provider setting:', error);
    }
}

/**
 * Load current context mode setting
 */
async function loadContextModeSetting() {
    try {
        const response = await fetch('/api/admin/context-mode');
        if (!response.ok) {
            console.log('Context mode setting not found, using default');
            return;
        }

        const data = await response.json();
        const toggle = document.getElementById('context-mode-toggle');

        if (toggle && data.mode) {
            // Set toggle state: checked = vector_embeddings, unchecked = context_window
            toggle.checked = (data.mode === 'vector_embeddings');

            // Update UI to show active state
            updateModeOptionsUI(data.mode);

            console.log('Loaded context mode setting:', data.mode);
        }
    } catch (error) {
        console.error('Error loading context mode setting:', error);
    }
}

/**
 * Setup LLM provider change handler (just for UI feedback, not saving)
 */
function setupLLMProviderChange() {
    // This function is now just a placeholder
    // Settings are only saved when the Save Settings button is clicked
    console.log('LLM provider dropdown initialized');
}

/**
 * Setup context mode change handler
 */
function setupContextModeChange() {
    const toggle = document.getElementById('context-mode-toggle');
    const windowOption = document.getElementById('mode-context-window');
    const embeddingsOption = document.getElementById('mode-vector-embeddings');

    if (toggle) {
        // Handle toggle change
        toggle.addEventListener('change', async function() {
            const newMode = this.checked ? 'vector_embeddings' : 'context_window';
            await saveContextMode(newMode);
            updateModeOptionsUI(newMode);
        });

        // Handle clicking on mode options
        if (windowOption) {
            windowOption.addEventListener('click', function() {
                toggle.checked = false;
                saveContextMode('context_window');
                updateModeOptionsUI('context_window');
            });
        }

        if (embeddingsOption) {
            embeddingsOption.addEventListener('click', function() {
                toggle.checked = true;
                saveContextMode('vector_embeddings');
                updateModeOptionsUI('vector_embeddings');
            });
        }

        console.log('Context mode toggle initialized');
    }
}

/**
 * Save context mode to server
 */
async function saveContextMode(newMode) {
    console.log('Context mode changed to:', newMode);

    try {
        const response = await fetch('/api/admin/context-mode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mode: newMode })
        });

        if (!response.ok) {
            throw new Error('Failed to save context mode');
        }

        const data = await response.json();
        console.log('Context mode saved:', data);

        // Update the UI to reflect the new mode
        updateContextModeBanner();

        // Show brief success feedback
        const modeName = newMode === 'context_window' ? 'Context Window' : 'Vector Embeddings';
        console.log(`Context mode switched to: ${modeName}`);

    } catch (error) {
        console.error('Error saving context mode:', error);
        alert('Failed to save context mode. Please try again.');
        // Revert to previous state
        loadContextModeSetting();
    }
}

/**
 * Update mode options UI to show active state
 */
function updateModeOptionsUI(mode) {
    const windowOption = document.getElementById('mode-context-window');
    const embeddingsOption = document.getElementById('mode-vector-embeddings');

    if (windowOption && embeddingsOption) {
        if (mode === 'context_window') {
            windowOption.classList.add('active');
            embeddingsOption.classList.remove('active');
        } else {
            windowOption.classList.remove('active');
            embeddingsOption.classList.add('active');
        }
    }
}

/**
 * Save application settings
 */
async function saveSettings() {
    const provider = document.getElementById('llm-provider')?.value;
    const welcomeMessage = document.getElementById('welcome-message')?.value?.trim();
    const contextMode = document.getElementById('context-mode')?.value;

    if (!provider) {
        showSettingsError('Please select a provider');
        return;
    }

    if (!welcomeMessage) {
        showSettingsError('Welcome message cannot be empty');
        return;
    }

    if (!contextMode) {
        showSettingsError('Please select a context mode');
        return;
    }

    try {
        // Save LLM provider, welcome message, and context mode
        const [providerResponse, welcomeResponse, contextModeResponse] = await Promise.all([
            fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ provider: provider })
            }),
            fetch('/api/admin/welcome-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: welcomeMessage })
            }),
            fetch('/api/admin/context-mode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mode: contextMode })
            })
        ]);

        if (!providerResponse.ok || !welcomeResponse.ok || !contextModeResponse.ok) {
            throw new Error('Failed to save settings');
        }

        const providerData = await providerResponse.json();
        const contextModeData = await contextModeResponse.json();
        console.log('Settings saved:', providerData, contextModeData);

        // Show success message ABOVE the save button
        const modeName = contextMode === 'context_window' ? 'Context Window' : 'Vector Embeddings';
        showSettingsSuccess(`Settings saved! LLM: ${providerData.provider_name}, Context: ${modeName}`);

    } catch (error) {
        console.error('Error saving settings:', error);
        showSettingsError('Failed to save settings. Please try again.');
    }
}

/**
 * Show success message above save button
 */
function showSettingsSuccess(message) {
    const settingsTab = document.getElementById('settings');
    if (!settingsTab) return;

    // Remove any existing messages
    const existingMsg = settingsTab.querySelector('.setting-message');
    if (existingMsg) existingMsg.remove();

    // Create success message
    const successMsg = document.createElement('div');
    successMsg.className = 'setting-message';
    successMsg.style.cssText = 'background: #00A651; color: white; padding: 12px; border-radius: 4px; margin-bottom: 15px;';
    successMsg.textContent = `✓ ${message}`;

    // Insert before the save button
    const saveButton = settingsTab.querySelector('.btn-primary');
    if (saveButton) {
        saveButton.parentNode.insertBefore(successMsg, saveButton);
        setTimeout(() => successMsg.remove(), 4000);
    }
}

/**
 * Show error message above save button
 */
function showSettingsError(message) {
    const settingsTab = document.getElementById('settings');
    if (!settingsTab) return;

    // Remove any existing messages
    const existingMsg = settingsTab.querySelector('.setting-message');
    if (existingMsg) existingMsg.remove();

    // Create error message
    const errorMsg = document.createElement('div');
    errorMsg.className = 'setting-message';
    errorMsg.style.cssText = 'background: #E20074; color: white; padding: 12px; border-radius: 4px; margin-bottom: 15px;';
    errorMsg.textContent = `✗ ${message}`;

    // Insert before the save button
    const saveButton = settingsTab.querySelector('.btn-primary');
    if (saveButton) {
        saveButton.parentNode.insertBefore(errorMsg, saveButton);
        setTimeout(() => errorMsg.remove(), 4000);
    }
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
    if (!await showConfirm('Are you sure you want to delete this insight? This action cannot be undone.', {
        confirmText: 'Delete',
        confirmStyle: 'danger'
    })) {
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

            showDialog('Insight deleted successfully', 'success');
        } else {
            showDialog(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting insight:', error);
        showDialog('Failed to delete insight', 'error');
    }
}

/**
 * View file content in preview panel
 */
function viewFileContent(index) {
    const file = currentFiles[index];
    if (!file) return;

    const previewContent = document.getElementById('main-preview-content');
    const previewHeader = document.querySelector('.preview-panel-header h3');
    if (!previewContent) return;

    // Remove active class from all items
    document.querySelectorAll('.file-list-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active class to selected item
    const selectedItem = document.querySelector(`[data-file-index="${index}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }

    // Update header with filename
    if (previewHeader) {
        previewHeader.innerHTML = `<i data-lucide="eye"></i> File Preview - ${escapeHtml(file.name)}`;
        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // Display file content without filename
    previewContent.innerHTML = `<pre style="margin: 0; font-family: 'Courier New', monospace; white-space: pre-wrap; word-wrap: break-word; color: #000;">${escapeHtml(file.content || file.preview || 'No content available')}</pre>`;
}

/**
 * Delete file by index
 */
async function deleteFileByIndex(index) {
    const file = currentFiles[index];
    if (!file) return;

    if (!await showConfirm('Delete ' + file.name + '?', {
        confirmText: 'Delete',
        confirmStyle: 'danger'
    })) return;

    await deleteContextFile(file.name);

    // Clear preview if this file was being viewed
    const selectedItem = document.querySelector('.file-list-item.active');
    if (selectedItem && selectedItem.dataset.fileIndex == index) {
        const previewContent = document.getElementById('main-preview-content');
        if (previewContent) {
            previewContent.innerHTML = `
                <div class="empty-state-preview">
                    <i data-lucide="file-text"></i>
                    <p>Select a file to preview its content</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }
}

/**
 * Toggle file enabled/disabled status
 */
async function toggleFileEnabled(index) {
    const file = currentFiles[index];
    if (!file) return;

    try {
        const newEnabledState = file.enabled === false ? true : false;

        const response = await fetch(`/api/admin/context-files/${encodeURIComponent(file.name)}/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ enabled: newEnabledState })
        });

        if (!response.ok) {
            throw new Error('Failed to toggle file status');
        }

        // Update local state
        file.enabled = newEnabledState;

        // Re-render the list
        displayFilesList(currentFiles);

    } catch (error) {
        console.error('Error toggling file:', error);
        showDialog('Failed to toggle file status', 'error');
    }
}

/**
 * Update statistics display
 */
function updateStatistics() {
    const breakdownEl = document.getElementById('files-breakdown');
    const usageBar = document.getElementById('context-usage-bar');
    const totalCharsEl = document.getElementById('context-total-chars');
    const totalTokensEl = document.getElementById('context-total-tokens');

    // Only count ENABLED files
    const enabledFiles = currentFiles.filter(file => file.enabled !== false);
    const totalChars = enabledFiles.reduce((sum, file) => sum + file.chars, 0);
    const totalTokens = Math.ceil(totalChars / 4);
    const maxChars = 200000;
    const percentage = Math.min((totalChars / maxChars) * 100, 100);

    // Update usage bar
    if (usageBar) {
        usageBar.style.width = percentage + '%';
    }

    // Update totals
    if (totalCharsEl) {
        totalCharsEl.textContent = totalChars.toLocaleString();
    }

    if (totalTokensEl) {
        totalTokensEl.textContent = totalTokens.toLocaleString();
    }

    // Display files breakdown (only enabled files)
    if (!breakdownEl) return;

    if (enabledFiles.length === 0) {
        breakdownEl.innerHTML = '<p class="empty-state">No enabled files</p>';
        return;
    }

    breakdownEl.innerHTML = enabledFiles.map(file => `
        <div class="file-stat-row">
            <div class="file-stat-name">
                <i data-lucide="file-text"></i>
                ${escapeHtml(file.name)}
            </div>
            <div class="file-stat-value">
                ${file.chars.toLocaleString()} chars (${Math.ceil(file.chars / 4).toLocaleString()} tokens)
            </div>
        </div>
    `).join('');

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 10);
    }
}

// ============================
// EMBEDDINGS MANAGEMENT
// ============================

/**
 * Update embeddings section visibility based on current mode
 */
async function updateContextModeBanner() {
    try {
        const response = await fetch('/api/admin/context-mode');
        if (!response.ok) {
            console.log('Context mode setting not found, using default');
            return;
        }

        const data = await response.json();
        const mode = data.mode || 'context_window';

        const embeddingsSection = document.getElementById('embeddings-section');

        if (mode === 'vector_embeddings') {
            // Show embeddings section in vector mode
            if (embeddingsSection) {
                embeddingsSection.style.display = 'block';
                loadEmbeddingStats();
            }
        } else {
            // Hide embeddings section in context window mode
            if (embeddingsSection) embeddingsSection.style.display = 'none';
        }

    } catch (error) {
        console.error('Error updating context mode UI:', error);
    }
}

/**
 * Load embedding statistics
 */
async function loadEmbeddingStats() {
    try {
        const response = await fetch('/api/admin/embeddings/stats');
        const stats = await response.json();

        const docCount = document.getElementById('embeddings-doc-count');
        const chunkCount = document.getElementById('embeddings-chunk-count');

        if (docCount) docCount.textContent = stats.document_count || 0;
        if (chunkCount) chunkCount.textContent = stats.chunk_count || 0;

    } catch (error) {
        console.error('Error loading embedding stats:', error);
    }
}

/**
 * Process embeddings
 */
async function processEmbeddings() {
    const statusEl = document.getElementById('embeddings-status');
    const button = event.target.closest('button');

    if (button) button.disabled = true;
    if (statusEl) {
        statusEl.textContent = 'Processing embeddings... This may take a minute.';
        statusEl.className = 'status-message info';
        statusEl.style.display = 'block';
    }

    try {
        const response = await fetch('/api/admin/embeddings/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            if (statusEl) {
                statusEl.textContent = '✓ ' + data.message;
                statusEl.className = 'status-message success';
            }

            // Update stats
            loadEmbeddingStats();
        } else {
            throw new Error(data.error || 'Failed to process embeddings');
        }

    } catch (error) {
        console.error('Error processing embeddings:', error);
        if (statusEl) {
            statusEl.textContent = '✗ Error: ' + error.message;
            statusEl.className = 'status-message error';
        }
    } finally {
        if (button) button.disabled = false;
        if (statusEl) {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    }
}
