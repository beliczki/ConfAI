/**
 * ConfAI Admin Dashboard JavaScript
 * Handles all admin functionality including system prompt editing,
 * context file management, statistics, and settings.
 */

// Guard against duplicate initialization
if (window.adminDashboardInitialized) {
    console.warn('Admin dashboard already initialized, skipping duplicate initialization');
} else {
    window.adminDashboardInitialized = true;

// Template definitions for quick system prompt templates
const PROMPT_TEMPLATES = {
    current: null, // Will be loaded from database

    conference: {
        base: `You are a helpful AI assistant specialized in conference insights and book knowledge.
You have access to conference transcripts and related books.
Respond concisely and insightfully, drawing from the provided context when relevant.
Be professional, engaging, and help users derive meaningful insights.`,
        safety: `Always provide accurate information. If you're unsure, say so. Do not make up facts or provide misleading information. Respect user privacy and maintain professional boundaries.`
    },

    helpful: {
        base: `You are a friendly and helpful AI assistant.
Your goal is to provide accurate, thoughtful, and useful responses.
Be conversational, empathetic, and always aim to understand the user's needs.
Draw from the provided context when it's relevant to the conversation.`,
        safety: `Always provide accurate information. If you're unsure, say so. Do not make up facts or provide misleading information. Respect user privacy and maintain professional boundaries.`
    },

    concise: {
        base: `You are a concise AI assistant that provides clear, direct answers.
Keep responses brief and to the point.
Use the provided context to give accurate information.
Avoid unnecessary elaboration unless specifically requested.`,
        safety: `Always provide accurate information. If you're unsure, say so. Do not make up facts or provide misleading information. Respect user privacy and maintain professional boundaries.`
    },

    creative: {
        base: `You are a creative and innovative AI assistant.
Think outside the box and provide unique perspectives.
Use the provided context as inspiration for creative insights.
Be engaging, thought-provoking, and encourage exploration of ideas.`,
        safety: `Always provide accurate information. If you're unsure, say so. Do not make up facts or provide misleading information. Respect user privacy and maintain professional boundaries.`
    }
};

// Global state
let currentFiles = [];
let currentSystemPrompt = '';
let selectedFile = null;
let currentPreviewedFile = null; // Track the file currently being previewed
let fileWatchEventSource = null; // SSE connection for live file watching

/**
 * Initialize the admin dashboard on page load
 */
document.addEventListener('DOMContentLoaded', function() {
    // Load initial data
    loadSystemPrompt();
    loadContextFiles();
    loadStatistics();
    loadWelcomeMessage();
    loadNewChatText();
    loadLLMProviderSetting();
    loadContextModeSetting();
    loadEmbeddingSettings();
    loadInsightsLimits();
    loadConversationStarters();
    loadModelNames();
    loadSummarizePrompt();
    loadSynthesisPrompt();
    loadInsightsHeaderMessage();

    // Setup event listeners
    setupFileUpload();
    setupCharacterCounter();
    setupWelcomeMessageCounter();
    setupNewChatTextCounter();
    setupSummarizePromptCounter();
    setupSynthesisPromptCounter();
    setupInsightsHeaderCounter();
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
    } else if (tabName === 'users') {
        loadRegistrationMode();
        loadUsers();
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

        // Split prompt into base and safety (split at first safety instruction marker)
        const safetyMarker = '\n\nSafety Instructions:\n';
        let baseInstructions = currentSystemPrompt;
        let safetyInstructions = 'Always provide accurate information. If you\'re unsure, say so. Do not make up facts or provide misleading information. Respect user privacy and maintain professional boundaries.';

        if (currentSystemPrompt.includes(safetyMarker)) {
            const parts = currentSystemPrompt.split(safetyMarker);
            baseInstructions = parts[0];
            safetyInstructions = parts[1] || safetyInstructions;
        }

        // Store current as template for 'Current' button
        PROMPT_TEMPLATES.current = {
            base: baseInstructions,
            safety: safetyInstructions
        };

        const baseTextarea = document.getElementById('base-instructions');
        const safetyTextarea = document.getElementById('safety-instructions');

        if (baseTextarea) {
            baseTextarea.value = baseInstructions;
            updateCharCount('base-instructions', 'base-chars');
        }

        if (safetyTextarea) {
            safetyTextarea.value = safetyInstructions;
            updateCharCount('safety-instructions', 'safety-chars');
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
    const baseTextarea = document.getElementById('base-instructions');
    const safetyTextarea = document.getElementById('safety-instructions');

    const baseInstructions = baseTextarea.value.trim();
    const safetyInstructions = safetyTextarea.value.trim();

    if (!baseInstructions) {
        showStatus('prompt-status', 'Base instructions cannot be empty', 'error');
        return;
    }

    if (!safetyInstructions) {
        showStatus('prompt-status', 'Safety instructions cannot be empty', 'error');
        return;
    }

    // Combine the instructions with a marker
    const combinedPrompt = `${baseInstructions}\n\nSafety Instructions:\n${safetyInstructions}`;

    try {
        const response = await fetch('/api/admin/system-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ prompt: combinedPrompt })
        });

        if (!response.ok) {
            throw new Error('Failed to save system prompt');
        }

        const data = await response.json();
        currentSystemPrompt = combinedPrompt;

        // Update current template
        PROMPT_TEMPLATES.current = {
            base: baseInstructions,
            safety: safetyInstructions
        };

        showStatus('prompt-status', 'Instructions saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving system prompt:', error);
        showStatus('prompt-status', 'Failed to save instructions', 'error');
    }
}

/**
 * Reset system prompt to default
 */
async function resetSystemPrompt() {
    if (!await showConfirm('Are you sure you want to reset the instructions to default? This will discard any custom changes.', {
        confirmText: 'Reset',
        confirmStyle: 'danger'
    })) {
        return;
    }

    const defaultTemplate = PROMPT_TEMPLATES.conference;
    const baseTextarea = document.getElementById('base-instructions');
    const safetyTextarea = document.getElementById('safety-instructions');

    if (baseTextarea) {
        baseTextarea.value = defaultTemplate.base;
        updateCharCount('base-instructions', 'base-chars');
    }

    if (safetyTextarea) {
        safetyTextarea.value = defaultTemplate.safety;
        updateCharCount('safety-instructions', 'safety-chars');
    }

    showStatus('prompt-status', 'Instructions reset to default. Click "Save Changes" to apply.', 'info');
}

/**
 * Test the system prompt (placeholder for future implementation)
 */
function testSystemPrompt() {
    const basePrompt = document.getElementById('base-instructions').value.trim();
    const safetyPrompt = document.getElementById('safety-instructions').value.trim();

    if (!basePrompt || !safetyPrompt) {
        showStatus('prompt-status', 'Cannot test empty instructions', 'error');
        return;
    }

    const combinedPrompt = `${basePrompt}\n\nSafety Instructions:\n${safetyPrompt}`;

    // For now, just show a preview
    showDialog('System Instructions Preview:\n\n' + combinedPrompt + '\n\n(Testing functionality will be implemented in a future update)', 'info');
}

/**
 * Load a predefined template into the system prompt editor
 */
function loadTemplate(templateName) {
    if (!PROMPT_TEMPLATES[templateName]) {
        console.error('Template not found:', templateName);
        return;
    }

    const template = PROMPT_TEMPLATES[templateName];
    const baseTextarea = document.getElementById('base-instructions');
    const safetyTextarea = document.getElementById('safety-instructions');

    if (baseTextarea && template.base) {
        baseTextarea.value = template.base;
        updateCharCount('base-instructions', 'base-chars');
    }

    if (safetyTextarea && template.safety) {
        safetyTextarea.value = template.safety;
        updateCharCount('safety-instructions', 'safety-chars');
    }

    const displayName = templateName === 'current' ? 'Current (from database)' : templateName.charAt(0).toUpperCase() + templateName.slice(1);
    showStatus('prompt-status', `Template "${displayName}" loaded. Click "Save Changes" to apply.`, 'info');
}

// ============================
// CONTEXT FILES FUNCTIONALITY
// ============================

/**
 * Setup file upload handlers (drag & drop + click on file columns)
 */
function setupFileUpload() {
    const fileInput = document.getElementById('context-file-input');
    if (!fileInput) return;

    // File input change - uses target from hidden input
    fileInput.addEventListener('change', (e) => {
        const target = document.getElementById('upload-target')?.value || 'vectorized:background_info';
        handleFileSelect(e.target.files, target);
    });

    // Setup drag and drop for both columns
    const dropZones = [
        { el: document.getElementById('base-context-list'), target: 'base_context' },
        { el: document.getElementById('vectorized-files-list'), target: 'vectorized:background_info' }
    ].filter(item => item.el);

    dropZones.forEach(({ el: dropZone, target }) => {
        // Click to upload (only on empty state)
        dropZone.addEventListener('click', (e) => {
            if (e.target === dropZone || e.target.closest('.empty-state-small')) {
                document.getElementById('upload-target').value = target;
                fileInput.click();
            }
        });

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            if (!dropZone.contains(e.relatedTarget)) {
                dropZone.classList.remove('drag-over');
            }
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            handleFileSelect(e.dataTransfer.files, target);
        });
    });
}

/**
 * Upload to a specific target (called from buttons)
 */
function uploadToTarget(target) {
    document.getElementById('upload-target').value = target;
    document.getElementById('context-file-input').click();
}

/**
 * Handle file selection and upload
 */
async function handleFileSelect(files, target = 'vectorized:background_info') {
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

    // Upload files with target
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }
    formData.append('target', target);

    try {
        const response = await fetch('/api/admin/context-files', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to upload files');
        }

        const data = await response.json();
        const targetDisplay = target === 'base_context' ? 'Base Context' : target.replace('vectorized:', '');
        showStatus('prompt-status', `Successfully uploaded ${files.length} file(s) to ${targetDisplay}`, 'success');

        // Reload file list
        await loadContextFiles();

    } catch (error) {
        console.error('Error uploading files:', error);
        showDialog(`Failed to upload files: ${error.message}`, 'error');
    }
}

/**
 * Load and display context files (new schema with base_context, vectorized, streaming)
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

        // Display files in their respective sections
        displayBaseContextFiles(data.base_context || []);
        displayVectorizedFiles(data.vectorized || {});

        // Update stats
        updateBaseContextStats(data.total_base_chars || 0, data.total_base_tokens || 0);

        // Load embedding stats
        loadEmbeddingStats();

    } catch (error) {
        console.error('Error loading context files:', error);
    }
}

/**
 * Display base context files
 */
function displayBaseContextFiles(files) {
    const container = document.getElementById('base-context-list');
    if (!container) return;

    if (files.length === 0) {
        container.innerHTML = `
            <div class="empty-state-small">
                <i data-lucide="file-plus"></i>
                <p>No base context files</p>
                <small>Drag files here or use the upload button</small>
            </div>
        `;
    } else {
        container.innerHTML = files.map(file => createFileItemHTML(file, 'base_context')).join('');
    }

    // Add event delegation for type selectors
    container.querySelectorAll('.base-type-select').forEach(select => {
        select.addEventListener('change', function() {
            const filename = this.dataset.filename;
            const newType = this.value;
            const currentType = this.dataset.currentType;
            if (newType !== currentType) {
                changeBaseContextFileType(filename, newType);
            }
        });
    });

    // Add event delegation for buttons
    setupFileItemEventListeners(container);

    if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 10);
    }
}

/**
 * Display vectorized files in a single list with type selector
 */
function displayVectorizedFiles(vectorized) {
    const container = document.getElementById('vectorized-files-list');
    if (!container) return;

    // Flatten all files with their categories
    const allFiles = [];
    for (const [category, files] of Object.entries(vectorized)) {
        for (const file of files) {
            allFiles.push({ ...file, category });
        }
    }

    // Update vector doc count
    const docCountEl = document.getElementById('vector-doc-count');
    if (docCountEl) docCountEl.textContent = allFiles.length;

    if (allFiles.length === 0) {
        container.innerHTML = `
            <div class="empty-state-small">
                <i data-lucide="database"></i>
                <p>No vectorized files</p>
                <small>Drag files here or upload</small>
            </div>
        `;
    } else {
        container.innerHTML = allFiles.map(file => createVectorizedFileItemHTML(file)).join('');
    }

    // Add event delegation for type selectors
    container.querySelectorAll('.type-select').forEach(select => {
        select.addEventListener('change', function() {
            const filename = this.dataset.filename;
            const newType = this.value;
            const currentCategory = this.dataset.currentCategory;
            if (newType !== currentCategory) {
                changeFileType(filename, newType);
            }
        });
    });

    // Add event delegation for buttons
    setupFileItemEventListeners(container);

    if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 10);
    }
}

/**
 * Setup event listeners for file item buttons
 */
function setupFileItemEventListeners(container) {
    // Handle preview button clicks
    container.querySelectorAll('button[data-action="preview"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const fileItem = this.closest('.file-column-item');
            const filename = fileItem?.dataset.filename;
            const isStreaming = fileItem?.classList.contains('streaming-item');
            if (filename) {
                openFilePreviewByName(filename, isStreaming);
            }
        });
    });

    // Handle move button clicks
    container.querySelectorAll('button[data-action="move"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const fileItem = this.closest('.file-column-item');
            const filename = fileItem?.dataset.filename;
            const target = this.dataset.target;
            if (filename && target) {
                moveFile(filename, target);
            }
        });
    });

    // Handle delete button clicks
    container.querySelectorAll('button[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const fileItem = this.closest('.file-column-item');
            const filename = fileItem?.dataset.filename;
            if (filename) {
                deleteFile(filename);
            }
        });
    });

    // Handle finalize button clicks (for streaming files in base context)
    container.querySelectorAll('button[data-action="finalize"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const sessionId = this.dataset.sessionId;
            if (sessionId) {
                finalizeStream(sessionId);
            }
        });
    });

    // Handle abort button clicks (for streaming files in base context)
    container.querySelectorAll('button[data-action="abort"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const sessionId = this.dataset.sessionId;
            if (sessionId) {
                abortStream(sessionId);
            }
        });
    });
}

/**
 * Get icon name for file type
 */
function getTypeIcon(category) {
    switch (category) {
        case 'transcript': return 'mic';
        case 'books': return 'book-open';
        case 'background_info': return 'file-text';
        default: return 'file';
    }
}

/**
 * Create HTML for a vectorized file item with type selector
 */
function createVectorizedFileItemHTML(file) {
    const filename = file.filename;
    const category = file.category || 'background_info';
    const icon = getTypeIcon(category);

    return `
        <div class="file-column-item" data-filename="${escapeHtml(filename)}">
            <div class="file-column-item-header">
                <div class="file-column-item-name" title="${escapeHtml(filename)}">
                    <i data-lucide="${icon}" class="type-icon type-${category}"></i>
                    ${escapeHtml(truncateFilename(filename))}
                </div>
                <div class="file-column-item-actions">
                    <button class="btn-preview" data-action="preview" title="Preview file">
                        <i data-lucide="eye"></i>
                    </button>
                    <button class="btn-move" data-action="move" data-target="base_context" title="Move to Base Context">
                        <i data-lucide="arrow-left"></i>
                    </button>
                    <button class="btn-delete" data-action="delete" title="Delete file">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
            <div class="file-column-item-info">
                <span>${formatDateTimeShort(file.modified)}</span>
                <span>${formatFileSize(file.size)}</span>
                <span>${file.chars?.toLocaleString() || 0} chars</span>
                <select class="type-select" data-filename="${escapeHtml(filename)}" data-current-category="${category}">
                    <option value="transcript"${category === 'transcript' ? ' selected' : ''}>Transcript</option>
                    <option value="books"${category === 'books' ? ' selected' : ''}>Book</option>
                    <option value="background_info"${category === 'background_info' ? ' selected' : ''}>Background</option>
                </select>
            </div>
        </div>
    `;
}

/**
 * Create HTML for a base context file item
 */
function createFileItemHTML(file, location) {
    const filename = file.filename;
    const isStreaming = file.is_streaming;
    const sessionId = file.session_id || '';
    const fileType = file.file_type || 'background_info';

    // For streaming files, show radio icon with pulse; otherwise use type icon
    const icon = isStreaming ? 'radio' : getTypeIcon(fileType);
    const iconClass = isStreaming ? 'streaming-icon pulse' : `type-icon type-${fileType}`;

    // Different actions for streaming vs regular files
    const actions = isStreaming ? `
        <button class="btn-preview" data-action="preview" title="Preview file">
            <i data-lucide="eye"></i>
        </button>
        <button class="btn-finalize" data-action="finalize" data-session-id="${escapeHtml(sessionId)}" title="Finalize stream">
            <i data-lucide="check-circle"></i>
        </button>
        <button class="btn-abort" data-action="abort" data-session-id="${escapeHtml(sessionId)}" title="Abort stream">
            <i data-lucide="x-circle"></i>
        </button>
    ` : `
        <button class="btn-preview" data-action="preview" title="Preview file">
            <i data-lucide="eye"></i>
        </button>
        <button class="btn-move" data-action="move" data-target="vectorized:background_info" title="Move to Vectorized">
            <i data-lucide="arrow-right"></i>
        </button>
        <button class="btn-delete" data-action="delete" title="Delete file">
            <i data-lucide="trash-2"></i>
        </button>
    `;

    const streamingBadge = isStreaming ? '<span class="streaming-badge">LIVE</span>' : '';

    // Type selector for non-streaming files
    const typeSelector = isStreaming ? '' : `
        <select class="type-select base-type-select" data-filename="${escapeHtml(filename)}" data-current-type="${fileType}">
            <option value="transcript"${fileType === 'transcript' ? ' selected' : ''}>Transcript</option>
            <option value="books"${fileType === 'books' ? ' selected' : ''}>Book</option>
            <option value="background_info"${fileType === 'background_info' ? ' selected' : ''}>Background</option>
        </select>
    `;

    return `
        <div class="file-column-item${isStreaming ? ' streaming-item' : ''}" data-filename="${escapeHtml(filename)}"${isStreaming ? ` data-session-id="${escapeHtml(sessionId)}"` : ''}>
            <div class="file-column-item-header">
                <div class="file-column-item-name" title="${escapeHtml(filename)}">
                    <i data-lucide="${icon}" class="${iconClass}"></i>
                    ${escapeHtml(truncateFilename(filename))}
                    ${streamingBadge}
                </div>
                <div class="file-column-item-actions">
                    ${actions}
                </div>
            </div>
            <div class="file-column-item-info">
                <span>${formatDateTimeShort(file.modified)}</span>
                <span>${formatFileSize(file.size)}</span>
                <span>${file.chars?.toLocaleString() || 0} chars</span>
                ${typeSelector}
            </div>
        </div>
    `;
}

/**
 * Format datetime to short format (e.g., "Nov 30, 14:25")
 */
function formatDateTimeShort(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const day = date.getDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const mins = date.getMinutes().toString().padStart(2, '0');
        return `${month} ${day}, ${hours}:${mins}`;
    } catch {
        return '';
    }
}

/**
 * Change file type within vectorized files
 */
async function changeFileType(filename, newType) {
    try {
        const response = await fetch(`/api/admin/context-files/${encodeURIComponent(filename)}/move`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ target: `vectorized:${newType}` })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to change file type');
        }

        // Reload to update icons
        await loadContextFiles();

    } catch (error) {
        console.error('Error changing file type:', error);
        showDialog(`Failed to change file type: ${error.message}`, 'error');
        // Reload to reset select
        await loadContextFiles();
    }
}

/**
 * Change file type for base context files (display type only)
 */
async function changeBaseContextFileType(filename, newType) {
    try {
        const response = await fetch(`/api/admin/context-files/${encodeURIComponent(filename)}/type`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ type: newType })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to change file type');
        }

        // Reload to update icons
        await loadContextFiles();

    } catch (error) {
        console.error('Error changing base context file type:', error);
        showDialog(`Failed to change file type: ${error.message}`, 'error');
        // Reload to reset select
        await loadContextFiles();
    }
}

/**
 * Update base context stats display
 */
function updateBaseContextStats(chars, tokens) {
    const charsEl = document.getElementById('base-context-chars');
    const tokensEl = document.getElementById('base-context-tokens');

    if (charsEl) charsEl.textContent = chars.toLocaleString();
    if (tokensEl) tokensEl.textContent = tokens.toLocaleString();
}

/**
 * Format datetime string for display
 */
function formatDateTime(isoString) {
    if (!isoString) return 'Unknown';
    try {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return 'Unknown';
    }
}

/**
 * Move file to a different location
 */
async function moveFile(filename, target) {
    if (!target) return;

    try {
        const response = await fetch(`/api/admin/context-files/${encodeURIComponent(filename)}/move`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ target })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to move file');
        }

        const targetDisplay = target === 'base_context' ? 'Base Context' : target.replace('vectorized:', '');
        showStatus('prompt-status', `Moved ${filename} to ${targetDisplay}`, 'success');

        await loadContextFiles();

    } catch (error) {
        console.error('Error moving file:', error);
        showDialog(`Failed to move file: ${error.message}`, 'error');
    }
}

/**
 * Delete file by filename
 */
async function deleteFile(filename) {
    if (!await showConfirm(`Delete "${filename}"? This cannot be undone.`, {
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
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete file');
        }

        showStatus('prompt-status', `Deleted ${filename}`, 'success');
        await loadContextFiles();

    } catch (error) {
        console.error('Error deleting file:', error);
        showDialog(`Failed to delete file: ${error.message}`, 'error');
    }
}

/**
 * Finalize a streaming session
 */
async function finalizeStream(sessionId) {
    try {
        const response = await fetch('/api/transcription/finalize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                session_id: sessionId
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to finalize stream');
        }

        const data = await response.json();
        showToast(data.message || `Stream finalized: ${data.filename}`, 'success');
        await loadContextFiles();

    } catch (error) {
        console.error('Error finalizing stream:', error);
        showToast(`Failed to finalize stream: ${error.message}`, 'error');
    }
}

/**
 * Abort a streaming session
 */
async function abortStream(sessionId) {
    if (!await showConfirm('Abort this streaming session? Content will be preserved in base context.', {
        confirmText: 'Abort',
        confirmStyle: 'danger'
    })) {
        return;
    }

    try {
        const response = await fetch(`/api/transcription/abort/${encodeURIComponent(sessionId)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to abort stream');
        }

        showStatus('prompt-status', 'Stream aborted', 'success');
        await loadContextFiles();

    } catch (error) {
        console.error('Error aborting stream:', error);
        showDialog(`Failed to abort stream: ${error.message}`, 'error');
    }
}

/**
 * Simple prompt select dialog (fallback to browser prompt if not implemented)
 */
async function showPromptSelect(message, options, defaultValue) {
    // Simple fallback using prompt
    const optionsText = options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
    const result = prompt(`${message}\n\n${optionsText}\n\nEnter number (1-${options.length}):`);

    if (!result) return null;

    const index = parseInt(result) - 1;
    if (index >= 0 && index < options.length) {
        return options[index].value;
    }
    return defaultValue;
}

/**
 * Open file preview by filename
 * @param {string} filename - The file to preview
 * @param {boolean} isStreaming - Whether this is a live streaming file
 */
async function openFilePreviewByName(filename, isStreaming = false) {
    // Close any existing SSE connection
    if (fileWatchEventSource) {
        fileWatchEventSource.close();
        fileWatchEventSource = null;
    }

    currentPreviewedFile = filename;

    const filenameEl = document.getElementById('preview-dialog-filename');
    const contentEl = document.getElementById('preview-dialog-content');
    const sizeEl = document.getElementById('preview-dialog-size');
    const charsEl = document.getElementById('preview-dialog-chars');
    const tokensEl = document.getElementById('preview-dialog-tokens');
    const dialog = document.getElementById('file-preview-dialog');

    // Add/remove live indicator based on streaming status
    if (isStreaming) {
        filenameEl.innerHTML = `${escapeHtml(filename)} <span class="live-badge">LIVE</span>`;
    } else {
        filenameEl.textContent = filename;
    }

    if (isStreaming) {
        // Use SSE for live streaming files
        contentEl.textContent = 'Connecting to live stream...';
        dialog.classList.add('active');

        try {
            const token = localStorage.getItem('admin_token');
            const url = `/api/transcription/watch/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}`;

            fileWatchEventSource = new EventSource(url);

            fileWatchEventSource.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'full') {
                        // Full content update
                        contentEl.textContent = data.content || '(Empty file)';
                        sizeEl.textContent = formatFileSize(data.size || 0);
                        charsEl.textContent = (data.chars || 0).toLocaleString();
                        tokensEl.textContent = Math.ceil((data.chars || 0) / 4).toLocaleString();
                    } else if (data.type === 'append') {
                        // Append new content
                        contentEl.textContent += data.content;
                        sizeEl.textContent = formatFileSize(data.size || 0);
                        charsEl.textContent = (data.chars || 0).toLocaleString();
                        tokensEl.textContent = Math.ceil((data.chars || 0) / 4).toLocaleString();
                        // Auto-scroll to bottom
                        contentEl.scrollTop = contentEl.scrollHeight;
                    } else if (data.type === 'deleted') {
                        contentEl.textContent = '(File was deleted)';
                        fileWatchEventSource.close();
                        fileWatchEventSource = null;
                    } else if (data.type === 'error') {
                        console.error('Stream error:', data.message);
                    }
                } catch (e) {
                    console.error('Error parsing SSE data:', e);
                }
            };

            fileWatchEventSource.onerror = function(error) {
                console.error('SSE connection error:', error);
                if (fileWatchEventSource) {
                    fileWatchEventSource.close();
                    fileWatchEventSource = null;
                }
            };

        } catch (error) {
            console.error('Error setting up live stream:', error);
            contentEl.textContent = 'Failed to connect to live stream';
        }

    } else {
        // Regular fetch for non-streaming files
        try {
            const response = await fetch(`/api/admin/context-files/${encodeURIComponent(filename)}/content`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to load file content');
            }

            const data = await response.json();

            contentEl.textContent = data.content || '(Empty file)';
            sizeEl.textContent = formatFileSize(data.size || 0);
            charsEl.textContent = (data.chars || 0).toLocaleString();
            tokensEl.textContent = Math.ceil((data.chars || 0) / 4).toLocaleString();

            dialog.classList.add('active');

        } catch (error) {
            console.error('Error loading file content:', error);
            showDialog('Failed to load file content', 'error');
        }
    }
}

/**
 * Truncate filename to max length, preserving extension
 */
function truncateFilename(filename, maxLength = 32) {
    if (filename.length <= maxLength) {
        return filename;
    }

    // Get file extension
    const lastDot = filename.lastIndexOf('.');
    const ext = lastDot > 0 ? filename.substring(lastDot) : '';
    const nameWithoutExt = lastDot > 0 ? filename.substring(0, lastDot) : filename;

    // Calculate how many chars we can keep from the name
    const availableChars = maxLength - ext.length - 3; // 3 for "..."

    if (availableChars <= 0) {
        return filename.substring(0, maxLength - 3) + '...';
    }

    return nameWithoutExt.substring(0, availableChars) + '...' + ext;
}

/**
 * Display the list of context files in two-column layout
 */
function displayFilesList(files) {
    const windowFilesContainer = document.getElementById('window-files-list');
    const vectorFilesContainer = document.getElementById('vector-files-list');

    if (!windowFilesContainer || !vectorFilesContainer) return;

    // Separate files by mode (default to window mode if not specified)
    const windowFiles = files.filter(f => f.mode !== 'vector');
    const vectorFiles = files.filter(f => f.mode === 'vector');

    // Display window mode files
    displayFileColumn(windowFilesContainer, windowFiles, 'window');

    // Display vector mode files
    displayFileColumn(vectorFilesContainer, vectorFiles, 'vector');

    // Update statistics
    updateStatistics();
}

/**
 * Display files in a specific column
 */
function displayFileColumn(container, files, mode) {
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    if (files.length === 0) {
        container.innerHTML = `
            <div class="empty-state-small">
                <i data-lucide="inbox"></i>
                <p>No files in ${mode} mode</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') {
            setTimeout(() => lucide.createIcons(), 10);
        }
        return;
    }

    // Create file items
    const filesHTML = files.map((file, index) => {
        const fileIndex = currentFiles.indexOf(file);
        const isEnabled = file.enabled !== false;
        const otherMode = mode === 'window' ? 'vector' : 'window';

        return `
        <div class="file-column-item" data-file-index="${fileIndex}">
            <div class="file-column-item-header">
                <div class="file-column-item-name" title="${escapeHtml(file.name)}">
                    <i data-lucide="file-text"></i>
                    ${escapeHtml(truncateFilename(file.name))}
                </div>
                <div class="file-column-item-actions">
                    <button class="btn-delete" onclick="deleteFileByIndex(${fileIndex})" title="Delete file">
                        <i data-lucide="trash-2"></i>
                    </button>
                    <button onclick="openFilePreview(${fileIndex})" title="Preview file">
                        <i data-lucide="eye"></i>
                    </button>
                    <button onclick="moveFileToMode(${fileIndex}, '${otherMode}')" title="Move to ${otherMode} mode">
                        <i data-lucide="arrow-${mode === 'window' ? 'right' : 'left'}"></i>
                    </button>
                </div>
            </div>
            <div class="file-column-item-info">
                <span>${formatFileSize(file.size)}</span>
                <span>${file.chars.toLocaleString()} chars</span>
                <span>${Math.ceil(file.chars / 4).toLocaleString()} tokens</span>
            </div>
            <div class="file-column-item-checkbox">
                <input type="checkbox" id="enable-${fileIndex}" ${isEnabled ? 'checked' : ''}
                       onchange="toggleFileEnabled(${fileIndex})"
                       title="Always include in context (even in vector mode)">
                <label for="enable-${fileIndex}" title="Always include in context (even in vector mode)">Always include in context</label>
            </div>
        </div>
        `;
    }).join('');

    container.innerHTML = filesHTML;

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 10);
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
 * Note: Confirmation should be handled by the caller (e.g., deleteFileByIndex)
 */
async function deleteContextFile(filename) {
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

        // Display token usage by model
        displayTokenByModel(data.token_by_model || []);

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
 * Display token usage by model
 */
function displayTokenByModel(tokenByModel) {
    const container = document.getElementById('token-by-model');

    if (!container) return;

    if (tokenByModel.length === 0) {
        container.innerHTML = '<p class="empty-state">No token usage data available</p>';
        return;
    }

    const modelNames = {
        'claude': 'Claude',
        'gemini': 'Gemini',
        'grok': 'Grok',
        'perplexity': 'Perplexity'
    };

    container.innerHTML = tokenByModel.map(model => {
        const modelName = modelNames[model.model] || model.model;
        const totalTokens = model.input_tokens + model.output_tokens;

        return `
            <div class="token-model-card">
                <div class="token-model-header">
                    <i data-lucide="cpu"></i>
                    <span>${modelName}</span>
                </div>
                <div class="token-model-stats">
                    <div class="token-model-stat">
                        <span class="token-model-stat-label">Messages:</span>
                        <span class="token-model-stat-value">${model.message_count.toLocaleString()}</span>
                    </div>
                    <div class="token-model-stat">
                        <span class="token-model-stat-label">Input:</span>
                        <span class="token-model-stat-value">${model.input_tokens.toLocaleString()}</span>
                    </div>
                    <div class="token-model-stat">
                        <span class="token-model-stat-label">Output:</span>
                        <span class="token-model-stat-value">${model.output_tokens.toLocaleString()}</span>
                    </div>
                    ${model.cache_read > 0 ? `
                    <div class="token-model-stat">
                        <span class="token-model-stat-label">Cached:</span>
                        <span class="token-model-stat-value">${model.cache_read.toLocaleString()}</span>
                    </div>
                    ` : ''}
                    <div class="token-model-stat" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border);">
                        <span class="token-model-stat-label"><strong>Total:</strong></span>
                        <span class="token-model-stat-value"><strong>${totalTokens.toLocaleString()}</strong></span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Display recent activity log
 */
let allActivities = []; // Store all activities for filtering

function displayRecentActivity(activities) {
    const activityEl = document.getElementById('recent-activity');

    if (!activityEl) return;

    // Store activities for filtering
    allActivities = activities;

    if (activities.length === 0) {
        activityEl.innerHTML = '<p class="empty-state">No recent activity</p>';
        return;
    }

    activityEl.innerHTML = activities.map(activity => `
        <div class="activity-item" data-activity-type="${activity.type}">
            <div class="activity-left">
                <i data-lucide="${getActivityIcon(activity.type)}" class="activity-icon"></i>
                <span class="activity-text"><strong>${escapeHtml(activity.user)}:</strong> ${escapeHtml(activity.text)}</span>
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
 * Filter activities by type
 */
function filterActivity(filter) {
    const activityEl = document.getElementById('recent-activity');

    if (!activityEl) return;

    // Update filter button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Filter activities
    const filtered = filter === 'all'
        ? allActivities
        : allActivities.filter(activity => activity.type === filter);

    if (filtered.length === 0) {
        activityEl.innerHTML = '<p class="empty-state">No activities of this type</p>';
        return;
    }

    activityEl.innerHTML = filtered.map(activity => `
        <div class="activity-item" data-activity-type="${activity.type}">
            <div class="activity-left">
                <i data-lucide="${getActivityIcon(activity.type)}" class="activity-icon"></i>
                <span class="activity-text"><strong>${escapeHtml(activity.user)}:</strong> ${escapeHtml(activity.text)}</span>
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
 * Load the new chat text from the server
 */
async function loadNewChatText() {
    try {
        const response = await fetch('/api/admin/new-chat-text', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load new chat text');
        }

        const data = await response.json();

        const textarea = document.getElementById('new-chat-text');
        if (textarea) {
            textarea.value = data.text || '';
            updateCharCount('new-chat-text', 'new-chat-chars');
        }

        console.log('New chat text loaded successfully');
    } catch (error) {
        console.error('Error loading new chat text:', error);
    }
}

/**
 * Load conversation starters
 */
async function loadConversationStarters() {
    try {
        const response = await fetch('/api/admin/conversation-starters', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load conversation starters');
        }

        const data = await response.json();

        for (let i = 0; i < 4; i++) {
            const input = document.getElementById(`starter-${i + 1}`);
            if (input && data.starters[i]) {
                input.value = data.starters[i];
            }
        }

        console.log('Conversation starters loaded successfully');
    } catch (error) {
        console.error('Error loading conversation starters:', error);
    }
}

/**
 * Load model names
 */
async function loadModelNames() {
    try {
        const response = await fetch('/api/admin/model-names', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load model names');
        }

        const data = await response.json();

        // Set default values if not configured
        const claudeInput = document.getElementById('claude-model');
        const geminiInput = document.getElementById('gemini-model');
        const grokInput = document.getElementById('grok-model');
        const perplexityInput = document.getElementById('perplexity-model');

        if (claudeInput) claudeInput.value = data.claude_model || 'claude-sonnet-4-5-20250929';
        if (geminiInput) geminiInput.value = data.gemini_model || 'gemini-2.5-flash-lite';
        if (grokInput) grokInput.value = data.grok_model || 'grok-4-fast-reasoning';
        if (perplexityInput) perplexityInput.value = data.perplexity_model || 'sonar';

        console.log('Model names loaded successfully');
    } catch (error) {
        console.error('Error loading model names:', error);
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

/**
 * Setup character counter for new chat text textarea
 */
function setupNewChatTextCounter() {
    const textarea = document.getElementById('new-chat-text');
    if (textarea) {
        textarea.addEventListener('input', () => {
            updateCharCount('new-chat-text', 'new-chat-chars');
        });
    }
}

/**
 * Setup character counter for summarize prompt textarea
 */
function setupSummarizePromptCounter() {
    const textarea = document.getElementById('summarize-prompt');
    if (textarea) {
        textarea.addEventListener('input', () => {
            updateCharCount('summarize-prompt', 'summarize-prompt-chars');
        });
    }
}

/**
 * Load the summarize prompt from the server
 */
async function loadSummarizePrompt() {
    try {
        const response = await fetch('/api/admin/summarize-prompt', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            console.log('No summarize prompt found, using default');
            return;
        }

        const data = await response.json();

        const textarea = document.getElementById('summarize-prompt');
        if (textarea && data.prompt) {
            textarea.value = data.prompt;
            updateCharCount('summarize-prompt', 'summarize-prompt-chars');
        }

        console.log('Summarize prompt loaded successfully');
    } catch (error) {
        console.error('Error loading summarize prompt:', error);
    }
}

/**
 * Setup character counter for synthesis prompt textarea
 */
function setupSynthesisPromptCounter() {
    const textarea = document.getElementById('synthesis-prompt');
    if (textarea) {
        textarea.addEventListener('input', () => {
            updateCharCount('synthesis-prompt', 'synthesis-prompt-chars');
        });
    }
}

/**
 * Load the synthesis prompt from the server
 */
async function loadSynthesisPrompt() {
    try {
        const response = await fetch('/api/admin/synthesis-prompt', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            console.log('No synthesis prompt found, using default');
            return;
        }

        const data = await response.json();

        const textarea = document.getElementById('synthesis-prompt');
        if (textarea && data.prompt) {
            textarea.value = data.prompt;
            updateCharCount('synthesis-prompt', 'synthesis-prompt-chars');
        }

        console.log('Synthesis prompt loaded successfully');
    } catch (error) {
        console.error('Error loading synthesis prompt:', error);
    }
}

/**
 * Load insights header message from settings
 */
async function loadInsightsHeaderMessage() {
    try {
        const response = await fetch('/api/admin/insights-header-message', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            console.log('No insights header message found');
            return;
        }

        const data = await response.json();

        const textarea = document.getElementById('insights-header-message');
        if (textarea) {
            textarea.value = data.message || '';
            updateCharCount('insights-header-message', 'insights-header-chars');
        }

        console.log('Insights header message loaded successfully');
    } catch (error) {
        console.error('Error loading insights header message:', error);
    }
}

/**
 * Setup character counter for insights header message
 */
function setupInsightsHeaderCounter() {
    const textarea = document.getElementById('insights-header-message');
    if (textarea) {
        textarea.addEventListener('input', () => {
            updateCharCount('insights-header-message', 'insights-header-chars');
        });
        updateCharCount('insights-header-message', 'insights-header-chars');
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

            // Auto-load embedding stats if in vector mode
            if (data.mode === 'vector_embeddings') {
                loadEmbeddingStats();
            }
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

            // Auto-load stats when switching to vector mode
            if (newMode === 'vector_embeddings') {
                loadEmbeddingStats();
            }
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

                // Auto-load stats when switching to vector mode
                loadEmbeddingStats();
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
    const newChatText = document.getElementById('new-chat-text')?.value?.trim();
    const insightsHeaderMessage = document.getElementById('insights-header-message')?.value?.trim() || '';
    const chunkSize = document.getElementById('chunk-size')?.value;
    const chunkOverlap = document.getElementById('chunk-overlap')?.value;
    const chunksToRetrieve = document.getElementById('chunks-to-retrieve')?.value;
    const votesPerUser = document.getElementById('votes-per-user')?.value;
    const sharesPerUser = document.getElementById('shares-per-user')?.value;
    const summarizePrompt = document.getElementById('summarize-prompt')?.value?.trim();
    const synthesisPrompt = document.getElementById('synthesis-prompt')?.value?.trim();

    // Embedding provider is now hardcoded to Gemini (no longer configurable)

    // Get model names
    const claudeModel = document.getElementById('claude-model')?.value?.trim();
    const geminiModel = document.getElementById('gemini-model')?.value?.trim();
    const grokModel = document.getElementById('grok-model')?.value?.trim();
    const perplexityModel = document.getElementById('perplexity-model')?.value?.trim();

    // Get conversation starters
    const starters = [];
    for (let i = 1; i <= 4; i++) {
        const starter = document.getElementById(`starter-${i}`)?.value?.trim();
        if (!starter) {
            showSettingsError(`Conversation starter ${i} cannot be empty`);
            return;
        }
        starters.push(starter);
    }

    if (!provider) {
        showSettingsError('Please select a provider');
        return;
    }

    if (!welcomeMessage) {
        showSettingsError('Welcome message cannot be empty');
        return;
    }

    if (!summarizePrompt) {
        showSettingsError('Individual model prompt cannot be empty');
        return;
    }

    if (!synthesisPrompt) {
        showSettingsError('Synthesis prompt cannot be empty');
        return;
    }

    // Validate model names
    if (!claudeModel || !geminiModel || !grokModel || !perplexityModel) {
        showSettingsError('All model names must be specified');
        return;
    }

    try {
        // Save all settings in parallel
        const [providerResponse, welcomeResponse, newChatResponse, insightsHeaderResponse, embeddingsResponse, insightsLimitsResponse, modelNamesResponse, startersResponse, summarizePromptResponse, synthesisPromptResponse] = await Promise.all([
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
            fetch('/api/admin/new-chat-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: newChatText || '' })
            }),
            fetch('/api/admin/insights-header-message', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: insightsHeaderMessage })
            }),
            fetch('/api/admin/embedding-settings', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chunk_size: parseInt(chunkSize),
                    chunk_overlap: parseInt(chunkOverlap),
                    chunks_to_retrieve: parseInt(chunksToRetrieve)
                })
            }),
            fetch('/api/admin/insights-limits', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    votes_per_user: parseInt(votesPerUser),
                    shares_per_user: parseInt(sharesPerUser)
                })
            }),
            fetch('/api/admin/model-names', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    claude_model: claudeModel,
                    gemini_model: geminiModel,
                    grok_model: grokModel,
                    perplexity_model: perplexityModel
                })
            }),
            fetch('/api/admin/conversation-starters', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ starters: starters })
            }),
            fetch('/api/admin/summarize-prompt', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: summarizePrompt })
            }),
            fetch('/api/admin/synthesis-prompt', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: synthesisPrompt })
            })
        ]);

        if (!providerResponse.ok || !welcomeResponse.ok || !insightsHeaderResponse.ok || !embeddingsResponse.ok || !insightsLimitsResponse.ok || !modelNamesResponse.ok || !startersResponse.ok || !summarizePromptResponse.ok || !synthesisPromptResponse.ok) {
            throw new Error('Failed to save settings');
        }

        const providerData = await providerResponse.json();
        console.log('Settings saved:', providerData);

        // Show success message ABOVE the save button
        showSettingsSuccess(`Settings saved! LLM: ${providerData.provider_name}`);

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
    const baseTextarea = document.getElementById('base-instructions');
    if (baseTextarea) {
        baseTextarea.addEventListener('input', () => {
            updateCharCount('base-instructions', 'base-chars');
        });
    }

    const safetyTextarea = document.getElementById('safety-instructions');
    if (safetyTextarea) {
        safetyTextarea.addEventListener('input', () => {
            updateCharCount('safety-instructions', 'safety-chars');
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
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Remove existing toast
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-hide after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
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
        const response = await fetch('/api/admin/insights', {
            headers: getAuthHeaders(),
            credentials: 'same-origin'  // Ensure cookies are sent
        });

        // Check if response is OK before parsing
        if (!response.ok) {
            const text = await response.text();
            console.error('API Error Response:', text);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Check content type
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Expected JSON response but got ' + contentType);
        }

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
        loadingEl.innerHTML = '<p style="color: #ff6b6b;">Error loading insights: ' + error.message + '</p>';
    }
}

/**
 * Render insights list for admin
 */
function renderAdminInsights(insights) {
    const listEl = document.getElementById('admin-insights-list');

    listEl.innerHTML = insights.map(insight => {
        const date = new Date(insight.created_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Check if content should be truncated (same as insights wall: 400 chars)
        const shouldTruncate = insight.content.length > 400;
        const displayContent = shouldTruncate ? insight.content.substring(0, 400) : insight.content;

        // Parse markdown for display
        let contentHTML = '';
        if (typeof marked !== 'undefined' && marked.parse) {
            contentHTML = marked.parse(displayContent);
        } else {
            contentHTML = escapeHtml(displayContent).replace(/\n/g, '<br>');
        }

        return `
            <div class="admin-insight-item" data-insight-id="${insight.id}" data-full-content="${escapeHtml(insight.content)}">
                <div class="insight-header">
                    <div class="insight-user">
                        <div class="user-avatar-small" style="background: ${insight.avatar_gradient}">
                            ${insight.user_email.substring(0, 2).toUpperCase()}
                        </div>
                        <span class="insight-user-email">${escapeHtml(insight.user_email || 'N/A')}</span>
                    </div>
                    <div class="insight-stats">
                        <span class="vote-stat">👍 ${insight.upvotes}</span>
                        <span class="vote-stat">👎 ${insight.downvotes}</span>
                        <span class="vote-stat net">Net: ${insight.net_votes}</span>
                    </div>
                </div>
                ${insight.title ? `<h3 class="insight-title">${escapeHtml(insight.title)}</h3>` : ''}
                <div class="insight-content-preview">
                    ${contentHTML}
                    ${shouldTruncate ? `<a href="#" class="more-link" onclick="toggleAdminInsightContent(${insight.id}); return false;">... more</a>` : ''}
                </div>
                <div class="insight-footer">
                    <span class="insight-date">${date}</span>
                    <button class="btn btn-danger btn-sm" onclick="deleteInsight(${insight.id})">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Reinitialize Lucide icons if available
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

/**
 * Toggle admin insight content between truncated and full view
 */
function toggleAdminInsightContent(insightId) {
    const card = document.querySelector(`.admin-insight-item[data-insight-id="${insightId}"]`);
    if (!card) return;

    const contentDiv = card.querySelector('.insight-content-preview');
    const moreLink = contentDiv.querySelector('.more-link');
    const fullContent = card.dataset.fullContent;
    const isExpanded = card.classList.contains('expanded');

    if (isExpanded) {
        // Collapse: show truncated content
        const truncatedContent = fullContent.substring(0, 400);
        let contentHTML = '';
        if (typeof marked !== 'undefined' && marked.parse) {
            contentHTML = marked.parse(truncatedContent);
        } else {
            contentHTML = escapeHtml(truncatedContent).replace(/\n/g, '<br>');
        }
        contentDiv.innerHTML = contentHTML + `<a href="#" class="more-link" onclick="toggleAdminInsightContent(${insightId}); return false;">... more</a>`;
        card.classList.remove('expanded');
    } else {
        // Expand: show full content
        let contentHTML = '';
        if (typeof marked !== 'undefined' && marked.parse) {
            contentHTML = marked.parse(fullContent);
        } else {
            contentHTML = escapeHtml(fullContent).replace(/\n/g, '<br>');
        }
        contentDiv.innerHTML = contentHTML + `<a href="#" class="more-link" onclick="toggleAdminInsightContent(${insightId}); return false;">... less</a>`;
        card.classList.add('expanded');
    }

    // Reinitialize Lucide icons if available
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
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
 * Export all insights to markdown file
 */
async function exportInsights() {
    try {
        // Trigger download
        window.location.href = '/api/admin/insights/export';
    } catch (error) {
        console.error('Error exporting insights:', error);
        showDialog('Failed to export insights', 'error');
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

        // Load stats if in vector embeddings mode
        if (mode === 'vector_embeddings') {
            loadEmbeddingStats();
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

        // Update vector column header stats
        const vectorDocCount = document.getElementById('vector-doc-count');
        const vectorChunkCount = document.getElementById('vector-chunk-count');

        if (vectorDocCount) vectorDocCount.textContent = stats.document_count || 0;
        if (vectorChunkCount) vectorChunkCount.textContent = stats.chunk_count || 0;

    } catch (error) {
        console.error('Error loading embedding stats:', error);
    }
}

/**
 * Process embeddings
 */
async function processEmbeddings() {
    const statusEl = document.getElementById('embeddings-status');
    const button = document.getElementById('process-embeddings-btn');
    const icon = document.getElementById('process-embeddings-icon');
    const buttonText = document.getElementById('process-embeddings-text');

    // Disable button and show loading state
    if (button) button.disabled = true;

    // Change icon to spinner
    if (icon) {
        icon.setAttribute('data-lucide', 'loader-2');
        icon.classList.add('spinning');
        lucide.createIcons();
    }

    // Update button text
    if (buttonText) buttonText.textContent = 'Processing...';

    // Show initial status
    if (statusEl) {
        statusEl.innerHTML = '<i data-lucide="loader-2" class="spinning"></i> Initializing...';
        statusEl.className = 'status-message info';
        statusEl.style.display = 'block';
        lucide.createIcons();
    }

    try {
        // Use streaming endpoint to avoid timeout issues
        const response = await fetch('/api/admin/embeddings/process/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let finalResult = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'error') {
                            throw new Error(data.message);
                        }

                        if (data.type === 'progress') {
                            if (statusEl) {
                                statusEl.innerHTML = `<i data-lucide="loader-2" class="spinning"></i> Step ${data.step}/${data.total_steps}: ${data.message}`;
                                lucide.createIcons();
                            }
                        }

                        if (data.type === 'file_progress') {
                            if (statusEl) {
                                statusEl.innerHTML = `<i data-lucide="loader-2" class="spinning"></i> [${data.current}/${data.total}] ${data.message}`;
                                lucide.createIcons();
                            }
                        }

                        if (data.type === 'file_complete') {
                            if (statusEl) {
                                statusEl.innerHTML = `<i data-lucide="check"></i> [${data.current}/${data.total}] ${data.filename}: ${data.chunks} chunks`;
                                lucide.createIcons();
                            }
                        }

                        if (data.type === 'complete') {
                            finalResult = data;
                        }
                    } catch (parseError) {
                        console.warn('Failed to parse SSE data:', parseError);
                    }
                }
            }
        }

        // Update stats
        await loadEmbeddingStats();

        // Display success message
        if (statusEl && finalResult) {
            statusEl.innerHTML = `<i data-lucide="check-circle"></i> ${finalResult.message}`;
            statusEl.className = 'status-message success';
            lucide.createIcons();
        }

    } catch (error) {
        console.error('Error processing embeddings:', error);
        if (statusEl) {
            statusEl.innerHTML = '<i data-lucide="x-circle"></i> Error: ' + error.message;
            statusEl.className = 'status-message error';
            lucide.createIcons();
        }
    } finally {
        // Re-enable button and restore icon
        if (button) button.disabled = false;

        // Re-query the icon element to get fresh reference after lucide transformation
        const iconElement = document.getElementById('process-embeddings-icon');
        if (iconElement) {
            iconElement.setAttribute('data-lucide', 'play');
            iconElement.classList.remove('spinning');
            lucide.createIcons();
        }

        if (buttonText) buttonText.textContent = 'Process Embeddings';

        // Auto-hide success message after 10 seconds (longer for success to let user read)
        if (statusEl && statusEl.classList.contains('success')) {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 10000);
        }
    }
}

// ============================
// FILE MODE MANAGEMENT
// ============================

/**
 * Open file preview dialog
 */
async function openFilePreview(fileIndex) {
    const file = currentFiles[fileIndex];
    if (!file) return;

    const dialog = document.getElementById('file-preview-dialog');
    const filename = document.getElementById('preview-dialog-filename');
    const content = document.getElementById('preview-dialog-content');
    const size = document.getElementById('preview-dialog-size');
    const chars = document.getElementById('preview-dialog-chars');
    const tokens = document.getElementById('preview-dialog-tokens');

    if (!dialog) return;

    // Store the current file for download/summarize functions
    currentPreviewedFile = file;

    // Set dialog content
    if (filename) filename.textContent = file.name;
    if (size) size.textContent = formatFileSize(file.size);
    if (chars) chars.textContent = file.chars.toLocaleString();
    if (tokens) tokens.textContent = Math.ceil(file.chars / 4).toLocaleString();

    // Show dialog with loading state
    dialog.classList.add('active');
    if (content) {
        content.textContent = 'Loading...';
    }

    // Reinitialize icons
    if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 10);
    }

    // Fetch file content if not already cached
    if (!file.content) {
        try {
            const response = await fetch(`/api/admin/context-files/${encodeURIComponent(file.name)}/content`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to load file content');
            }

            const data = await response.json();
            file.content = data.content;
        } catch (error) {
            console.error('Error loading file content:', error);
            if (content) {
                content.textContent = 'Error loading file content. Please try again.';
            }
            return;
        }
    }

    // Display file content
    if (content) {
        const maxPreviewChars = 50000;
        const fileContent = file.content || 'No content available';

        if (fileContent.length > maxPreviewChars) {
            content.textContent = fileContent.substring(0, maxPreviewChars) +
                '\n\n... (content truncated - showing first ' + maxPreviewChars.toLocaleString() + ' characters)';
        } else {
            content.textContent = fileContent;
        }
    }
}

/**
 * Close file preview dialog
 */
function closeFilePreview() {
    // Close SSE connection if active
    if (fileWatchEventSource) {
        fileWatchEventSource.close();
        fileWatchEventSource = null;
    }

    const dialog = document.getElementById('file-preview-dialog');
    if (dialog) {
        dialog.classList.remove('active');
    }
    currentPreviewedFile = null;
}

/**
 * Download the currently previewed file (full content, not truncated)
 */
async function downloadPreviewFile() {
    if (!currentPreviewedFile) {
        alert('No file is currently being previewed');
        return;
    }

    const filename = currentPreviewedFile;

    try {
        // Use the download endpoint to get the complete file with auth headers
        const downloadUrl = `/api/admin/context-files/${encodeURIComponent(filename)}/download`;

        const response = await fetch(downloadUrl, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(`Download failed: ${response.statusText}`);
        }

        // Get the file content as a blob
        const blob = await response.blob();

        // Create a temporary URL for the blob
        const blobUrl = URL.createObjectURL(blob);

        // Create a temporary link and trigger download
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);

        console.log(`Downloaded: ${filename}`);
    } catch (error) {
        console.error('Download error:', error);
        alert(`Failed to download file: ${error.message}`);
    }
}

/**
 * Create multi-model summary of the currently previewed file
 */
async function summarizePreviewFile() {
    if (!currentPreviewedFile) {
        alert('No file is currently being previewed');
        return;
    }

    // Save filename before closing the dialog (closeFilePreview clears currentPreviewedFile)
    const filename = currentPreviewedFile;

    // Confirm before proceeding
    if (!await showConfirm(`Create multi-model summary of "${filename}"?\n\nThis will use all 4 models (Claude, Gemini, Grok, Perplexity) and synthesize their outputs.`, {
        confirmText: 'Create Summary',
        confirmStyle: 'primary'
    })) {
        return;
    }

    // Close the preview dialog
    closeFilePreview();

    // Open the progress dialog
    const progressDialog = document.getElementById('summarization-progress-dialog');
    const statusIndicator = document.getElementById('summary-status-indicator');
    const statusText = document.getElementById('summary-status-text');
    const progressLog = document.getElementById('summarization-progress-log');

    if (!progressDialog) {
        console.error('Progress dialog not found');
        return;
    }

    // Reset and show the progress dialog
    statusIndicator.classList.remove('finished');
    statusText.textContent = 'Initializing...';
    progressLog.value = '';
    progressDialog.classList.add('active');

    try {
        // Update status
        statusText.textContent = 'Starting summarization...';
        progressLog.value += `=== Multi-Model Summarization ===\n`;
        progressLog.value += `File: ${filename}\n`;
        progressLog.value += `Started at: ${new Date().toLocaleTimeString()}\n`;
        progressLog.value += `\n`;

        // Use EventSource for streaming updates
        const authHeaders = getAuthHeaders();
        const authToken = authHeaders['X-User-ID'];

        // Create EventSource URL with auth token as query param
        const streamUrl = `/api/admin/summarize-file-stream?filename=${encodeURIComponent(filename)}&auth=${encodeURIComponent(authToken)}`;

        // We need to use fetch with streaming instead of EventSource because EventSource doesn't support POST or custom headers
        statusText.textContent = 'Connecting...';

        const response = await fetch('/api/admin/summarize-file-stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                filename: filename
            })
        });

        if (!response.ok) {
            throw new Error('Failed to start summarization stream');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE messages
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); // Keep incomplete message in buffer

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonData = line.substring(6);
                    try {
                        const event = JSON.parse(jsonData);

                        switch (event.type) {
                            case 'start':
                                progressLog.value += `Processing with models: ${event.models.join(', ')}\n\n`;
                                statusText.textContent = 'Processing models...';
                                break;

                            case 'model_start':
                                progressLog.value += `--- ${event.model.toUpperCase()} ---\n`;
                                progressLog.value += `Starting ${event.model}...\n`;
                                statusText.textContent = `Processing ${event.model}...`;
                                progressLog.scrollTop = progressLog.scrollHeight;
                                break;

                            case 'model_complete':
                                progressLog.value += `${event.model.toUpperCase()} completed (${event.length} characters)\n\n`;
                                progressLog.value += `${event.summary}\n\n`;
                                progressLog.scrollTop = progressLog.scrollHeight;
                                break;

                            case 'model_warning':
                                progressLog.value += `⚠️ Warning: ${event.model} - ${event.message}\n\n`;
                                progressLog.scrollTop = progressLog.scrollHeight;
                                break;

                            case 'model_error':
                                progressLog.value += `❌ Error in ${event.model}: ${event.error}\n\n`;
                                progressLog.scrollTop = progressLog.scrollHeight;
                                break;

                            case 'synthesis_start':
                                progressLog.value += `\n=== SYNTHESIZING WITH CLAUDE ===\n`;
                                statusText.textContent = 'Synthesizing all summaries...';
                                progressLog.scrollTop = progressLog.scrollHeight;
                                break;

                            case 'synthesis_complete':
                                progressLog.value += `Synthesis completed (${event.length} characters)\n\n`;
                                progressLog.value += `${event.summary}\n\n`;
                                progressLog.scrollTop = progressLog.scrollHeight;
                                break;

                            case 'complete':
                                progressLog.value += `\n=== COMPLETED ===\n`;
                                progressLog.value += `Summary saved to: ${event.filename}\n`;
                                progressLog.value += `Total size: ${event.size} characters\n`;
                                progressLog.value += `Finished at: ${new Date().toLocaleTimeString()}\n`;
                                progressLog.scrollTop = progressLog.scrollHeight;

                                // Mark as finished
                                statusIndicator.classList.add('finished');
                                statusText.textContent = 'Finished';

                                // Reload the file list
                                await loadContextFiles();
                                break;

                            case 'error':
                                throw new Error(event.message);
                        }
                    } catch (e) {
                        console.error('Error parsing SSE event:', e);
                    }
                }
            }
        }

    } catch (error) {
        console.error('Error creating summary:', error);

        // Show error in progress log
        progressLog.value += `\n\n!!! ERROR !!!\n`;
        progressLog.value += `${error.message}\n`;
        progressLog.scrollTop = progressLog.scrollHeight;

        // Update status
        statusIndicator.classList.add('finished');
        statusText.textContent = 'Error occurred';

        alert(`Failed to create summary: ${error.message}`);
    }
}

/**
 * Close the summarization progress dialog
 */
function closeSummarizationProgress() {
    const progressDialog = document.getElementById('summarization-progress-dialog');
    if (progressDialog) {
        progressDialog.classList.remove('active');
    }
}

/**
 * Move file to different mode (window <-> vector)
 */
async function moveFileToMode(fileIndex, newMode) {
    const file = currentFiles[fileIndex];
    if (!file) return;

    try {
        const response = await fetch(`/api/admin/context-files/${encodeURIComponent(file.name)}/mode`, {
            method: 'PUT',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mode: newMode })
        });

        if (!response.ok) {
            throw new Error('Failed to update file mode');
        }

        // Update local file object
        file.mode = newMode;

        // Refresh display
        displayFilesList(currentFiles);

        console.log(`Moved ${file.name} to ${newMode} mode`);

    } catch (error) {
        console.error('Error moving file:', error);
        alert('Failed to move file. Please try again.');
    }
}

/**
 * Save embedding settings (chunk size and retrieval count)
 */
async function saveEmbeddingSettings() {
    const chunkSize = document.getElementById('chunk-size')?.value;
    const chunkOverlap = document.getElementById('chunk-overlap')?.value;
    const chunksToRetrieve = document.getElementById('chunks-to-retrieve')?.value;

    if (!chunkSize || !chunkOverlap || !chunksToRetrieve) {
        alert('Please fill in all embedding settings');
        return;
    }

    try {
        const response = await fetch('/api/admin/embedding-settings', {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chunk_size: parseInt(chunkSize),
                chunk_overlap: parseInt(chunkOverlap),
                chunks_to_retrieve: parseInt(chunksToRetrieve)
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save embedding settings');
        }

        const data = await response.json();
        console.log('Embedding settings saved:', data);

        // Show success message
        const statusEl = document.getElementById('embeddings-status');
        if (statusEl) {
            statusEl.textContent = '✓ Settings saved successfully';
            statusEl.className = 'status-message success';
            statusEl.style.display = 'block';
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }

    } catch (error) {
        console.error('Error saving embedding settings:', error);
        alert('Failed to save settings. Please try again.');
    }
}

/**
 * Toggle embedding provider options visibility
 * (Deprecated - Gemini is now the only provider)
 */
function toggleEmbeddingProvider() {
    // No longer needed - Gemini is the only embedding provider
}

/**
 * Load embedding settings
 */
async function loadEmbeddingSettings() {
    try {
        // Load chunk settings
        const response = await fetch('/api/admin/embedding-settings', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            console.log('No embedding settings found, using defaults');
        } else {
            const data = await response.json();

            const chunkSize = document.getElementById('chunk-size');
            const chunkOverlap = document.getElementById('chunk-overlap');
            const chunksToRetrieve = document.getElementById('chunks-to-retrieve');

            if (chunkSize && data.chunk_size) {
                chunkSize.value = data.chunk_size;
            }

            if (chunkOverlap && data.chunk_overlap !== undefined) {
                chunkOverlap.value = data.chunk_overlap;
            }

            if (chunksToRetrieve && data.chunks_to_retrieve) {
                chunksToRetrieve.value = data.chunks_to_retrieve;
            }

            console.log('Loaded embedding chunk settings:', data);
        }

        // Embedding provider is now hardcoded to Gemini (no longer configurable)

    } catch (error) {
        console.error('Error loading embedding settings:', error);
    }
}

/**
 * Load insights limits (votes per user, shares per user)
 */
async function loadInsightsLimits() {
    try {
        const response = await fetch('/api/admin/insights-limits', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            console.log('No insights limits found, using defaults');
        } else {
            const data = await response.json();

            const votesPerUser = document.getElementById('votes-per-user');
            const sharesPerUser = document.getElementById('shares-per-user');

            if (votesPerUser && data.votes_per_user) {
                votesPerUser.value = data.votes_per_user;
            }

            if (sharesPerUser && data.shares_per_user) {
                sharesPerUser.value = data.shares_per_user;
            }

            console.log('Loaded insights limits:', data);
        }

    } catch (error) {
        console.error('Error loading insights limits:', error);
    }
}

// Close preview dialog when clicking outside or pressing Escape
// Wrap in IIFE to prevent duplicate event listeners on hot reload
(function() {
    let eventListenersAdded = false;

    function setupDialogEventListeners() {
        if (eventListenersAdded) return;

        // Close preview dialog when clicking on overlay
        document.addEventListener('click', function(e) {
            const dialog = document.getElementById('file-preview-dialog');
            if (dialog && dialog.classList.contains('active') && e.target === dialog) {
                closeFilePreview();
            }
        });

        // Close preview dialog with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const dialog = document.getElementById('file-preview-dialog');
                if (dialog && dialog.classList.contains('active')) {
                    closeFilePreview();
                }
            }
        });

        eventListenersAdded = true;
    }

    // Setup on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupDialogEventListeners);
    } else {
        setupDialogEventListeners();
    }
})();

// Expose functions to global scope for HTML onclick handlers
window.deleteFileByIndex = deleteFileByIndex;
window.openFilePreview = openFilePreview;
// ===================================
// USER MANAGEMENT FUNCTIONS
// ===================================

async function loadRegistrationMode() {
    try {
        const response = await fetch('/api/admin/registration-mode');
        const data = await response.json();

        if (data.success) {
            const toggle = document.getElementById('registration-mode-toggle');
            if (toggle) {
                // 'open' = checked, 'invite_only' = unchecked
                toggle.checked = (data.mode === 'open');
                updateRegistrationModeUI(data.mode);
            }
        }
    } catch (error) {
        console.error('Error loading registration mode:', error);
    }
}

async function toggleRegistrationMode() {
    const toggle = document.getElementById('registration-mode-toggle');
    const newMode = toggle.checked ? 'open' : 'invite_only';

    try {
        const response = await fetch('/api/admin/registration-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: newMode })
        });

        const data = await response.json();

        if (data.success) {
            updateRegistrationModeUI(newMode);
            console.log(`Registration mode updated to: ${newMode}`);
        } else {
            // Revert toggle on error
            toggle.checked = !toggle.checked;
            alert(data.error || 'Failed to update registration mode');
        }
    } catch (error) {
        console.error('Error updating registration mode:', error);
        // Revert toggle on error
        toggle.checked = !toggle.checked;
        alert('Failed to update registration mode');
    }
}

function updateRegistrationModeUI(mode) {
    const inviteOnlyOption = document.getElementById('mode-invite-only');
    const openOption = document.getElementById('mode-open-registration');

    if (mode === 'open') {
        inviteOnlyOption?.classList.remove('active');
        openOption?.classList.add('active');
    } else {
        inviteOnlyOption?.classList.add('active');
        openOption?.classList.remove('active');
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();

        if (data.success) {
            renderUsersList(data.users);
        } else {
            throw new Error(data.error || 'Failed to load users');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('users-list').innerHTML = `
            <div class="error-state">
                <i data-lucide="alert-circle"></i>
                <p>Error loading users: ${error.message}</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// Available tags (hardcoded)
const AVAILABLE_TAGS = ['Test', 'HiFest', 'HypeWise'];

// Current tag filter
let currentTagFilter = '';

// Store all users for filtering
let allUsersData = [];

function renderUsersList(users) {
    const listEl = document.getElementById('users-list');

    // Store users for filtering
    allUsersData = users;

    // Update user count
    const countEl = document.getElementById('filtered-user-count');
    if (countEl) {
        countEl.textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;
    }

    if (!users || users.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <i data-lucide="users"></i>
                <p>No users yet</p>
                <small>Upload a CSV file to add users</small>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    listEl.innerHTML = users.map(user => {
        const statusBadge = getInviteStatusBadge(user.invite_status, user.sent_at, user.accepted_at);
        const canSendInvite = (!user.invite_status || user.invite_status === 'pending') && user.invite_status !== 'accepted';

        // Format created_at date
        const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        }) : '';

        // Render tags
        const userTags = user.tags || [];
        const tagsHtml = userTags.map(tag =>
            `<span class="tag-badge tag-${tag}" onclick="removeTag(${user.id}, '${tag}')" title="Click to remove">${tag}</span>`
        ).join('');

        // Available tags to add (not already assigned)
        const availableTags = AVAILABLE_TAGS.filter(t => !userTags.includes(t));
        const addTagDropdown = availableTags.length > 0 ? `
            <div class="tag-dropdown">
                <button class="add-tag-btn" onclick="toggleTagDropdown(event, ${user.id})">+ Tag</button>
                <div class="tag-dropdown-menu" id="tag-dropdown-${user.id}">
                    ${availableTags.map(tag =>
                        `<button class="tag-dropdown-item" onclick="addTag(${user.id}, '${tag}')">${tag}</button>`
                    ).join('')}
                </div>
            </div>
        ` : '';

        return `
            <div class="user-item">
                <div class="user-info">
                    <div class="user-avatar" style="background: ${user.avatar_gradient}">
                        ${user.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div class="user-details">
                        <div class="user-name">${escapeHtml(user.name)}</div>
                        <div class="user-email">${escapeHtml(user.email)}</div>
                    </div>
                </div>
                <div class="user-tags">
                    ${tagsHtml}
                    ${addTagDropdown}
                </div>
                <div class="user-created-at">${createdDate}</div>
                <div class="user-status">
                    ${statusBadge}
                </div>
                <div class="user-actions">
                    ${canSendInvite ? `
                        <button class="btn btn-sm btn-primary" onclick="sendInvite(${user.id})">
                            <i data-lucide="mail"></i>
                            <span>Send Invite</span>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm ${user.is_allowed ? 'btn-warning' : 'btn-success'}" onclick="toggleUserAccess(${user.id})">
                        <i data-lucide="${user.is_allowed ? 'lock' : 'unlock'}"></i>
                        <span>${user.is_allowed ? 'Disable' : 'Enable'}</span>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUserConfirm(${user.id}, '${escapeHtml(user.email)}')">
                        <i data-lucide="trash-2"></i>
                        <span>Delete</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Toggle tag dropdown menu
function toggleTagDropdown(event, userId) {
    event.stopPropagation();
    // Close all other dropdowns
    document.querySelectorAll('.tag-dropdown-menu.show').forEach(el => el.classList.remove('show'));
    // Toggle this one
    const dropdown = document.getElementById(`tag-dropdown-${userId}`);
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.tag-dropdown-menu.show').forEach(el => el.classList.remove('show'));
});

// Add tag to user
async function addTag(userId, tag) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/tags`, {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tag })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to add tag');
        }

        // Reload users to reflect changes
        await loadUsers();
    } catch (error) {
        console.error('Error adding tag:', error);
        alert('Failed to add tag: ' + error.message);
    }
}

// Remove tag from user
async function removeTag(userId, tag) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/tags/${encodeURIComponent(tag)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to remove tag');
        }

        // Reload users to reflect changes
        await loadUsers();
    } catch (error) {
        console.error('Error removing tag:', error);
        alert('Failed to remove tag: ' + error.message);
    }
}

// Filter users by tag
async function filterUsersByTag(tag) {
    currentTagFilter = tag;

    // Update active button
    document.querySelectorAll('.tag-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tag === tag);
    });

    // Reload users with filter
    await loadUsers();
}

// Override loadUsers to support tag filter
const originalLoadUsers = loadUsers;
loadUsers = async function() {
    const listEl = document.getElementById('users-list');
    listEl.innerHTML = `
        <div class="loading-state">
            <i data-lucide="loader"></i>
            <p>Loading users...</p>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        let url = '/api/admin/users';
        if (currentTagFilter) {
            url += `?tag=${encodeURIComponent(currentTagFilter)}`;
        }

        const response = await fetch(url, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load users');
        }

        const data = await response.json();
        renderUsersList(data.users);
    } catch (error) {
        console.error('Error loading users:', error);
        listEl.innerHTML = `
            <div class="error-state">
                <i data-lucide="alert-circle"></i>
                <p>Error loading users: ${error.message}</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

// Reminder email modal functions
function openReminderModal() {
    document.getElementById('reminder-modal').style.display = 'flex';
    // Reset form
    document.getElementById('reminder-subject').value = '';
    document.getElementById('reminder-message').value = '';
    document.querySelectorAll('.tag-checkboxes input').forEach(cb => cb.checked = false);
    updateRecipientCount();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeReminderModal() {
    document.getElementById('reminder-modal').style.display = 'none';
}

// Update recipient count based on selected tags
function updateRecipientCount() {
    const selectedTags = Array.from(document.querySelectorAll('.tag-checkboxes input:checked')).map(cb => cb.value);
    const countEl = document.getElementById('reminder-recipient-count');

    if (selectedTags.length === 0) {
        countEl.textContent = 'No tags selected - will send to all allowed users';
    } else {
        countEl.textContent = `Will send to users with tags: ${selectedTags.join(', ')}`;
    }
}

// Add event listeners to tag checkboxes
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tag-checkboxes input').forEach(cb => {
        cb.addEventListener('change', updateRecipientCount);
    });
});

// Send reminder emails
async function sendReminderEmails() {
    const subject = document.getElementById('reminder-subject').value.trim();
    const message = document.getElementById('reminder-message').value.trim();
    const selectedTags = Array.from(document.querySelectorAll('.tag-checkboxes input:checked')).map(cb => cb.value);

    if (!subject) {
        alert('Please enter a subject');
        return;
    }

    if (!message) {
        alert('Please enter a message');
        return;
    }

    if (!confirm(`Are you sure you want to send this reminder email${selectedTags.length > 0 ? ' to users with tags: ' + selectedTags.join(', ') : ' to all users'}?`)) {
        return;
    }

    try {
        const response = await fetch('/api/admin/send-reminder', {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subject,
                message,
                tags: selectedTags
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to send reminders');
        }

        closeReminderModal();
        alert(data.message);
    } catch (error) {
        console.error('Error sending reminders:', error);
        alert('Failed to send reminders: ' + error.message);
    }
}

// Export new functions to window
window.filterUsersByTag = filterUsersByTag;
window.addTag = addTag;
window.removeTag = removeTag;
window.toggleTagDropdown = toggleTagDropdown;
window.openReminderModal = openReminderModal;
window.closeReminderModal = closeReminderModal;
window.sendReminderEmails = sendReminderEmails;

function getInviteStatusBadge(status, sentAt, acceptedAt) {
    if (acceptedAt) {
        return '<span class="status-badge status-accepted">Accepted</span>';
    } else if (sentAt) {
        return '<span class="status-badge status-sent">Invite Sent</span>';
    } else if (status === 'pending') {
        return '<span class="status-badge status-pending">Pending</span>';
    } else {
        return '<span class="status-badge status-pending">Not Sent</span>';
    }
}

async function uploadCSV() {
    const input = document.getElementById('user-csv-input');
    const file = input.files[0];

    if (!file) {
        alert('Please select a CSV file');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/admin/users/upload-csv', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            let message = `Successfully created ${data.created} user(s)`;
            if (data.skipped > 0) {
                message += `\n${data.skipped} user(s) skipped (already exist)`;
            }
            if (data.errors > 0) {
                message += `\n${data.errors} error(s) occurred`;
            }
            alert(message);

            // Reload users list
            await loadUsers();

            // Clear input
            input.value = '';
        } else {
            throw new Error(data.error || 'Failed to upload CSV');
        }
    } catch (error) {
        console.error('Error uploading CSV:', error);
        alert(`Error uploading CSV: ${error.message}`);
    }
}

async function sendInvite(userId) {
    if (!confirm('Send invite email to this user?')) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}/send-invite`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            await loadUsers();
        } else {
            alert(data.message || 'Failed to send invite');
        }
    } catch (error) {
        console.error('Error sending invite:', error);
        alert(`Error sending invite: ${error.message}`);
    }
}

async function sendBulkInvites() {
    if (!confirm('Send invites to all pending users?')) return;

    try {
        const response = await fetch('/api/admin/users/send-bulk-invites', {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            let message = `Sent ${data.sent} invite(s)`;
            if (data.failed > 0) {
                message += `\n${data.failed} invite(s) failed to send`;
            }
            alert(message);
            await loadUsers();
        } else {
            throw new Error(data.error || 'Failed to send bulk invites');
        }
    } catch (error) {
        console.error('Error sending bulk invites:', error);
        alert(`Error sending bulk invites: ${error.message}`);
    }
}

async function toggleUserAccess(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/toggle-access`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            await loadUsers();
        } else {
            throw new Error(data.error || 'Failed to toggle user access');
        }
    } catch (error) {
        console.error('Error toggling user access:', error);
        alert(`Error toggling user access: ${error.message}`);
    }
}

async function deleteUserConfirm(userId, email) {
    if (!confirm(`Are you sure you want to delete user ${email}? This action cannot be undone.`)) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            await loadUsers();
        } else {
            throw new Error(data.error || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert(`Error deleting user: ${error.message}`);
    }
}

// Set up user management event listeners
document.addEventListener('DOMContentLoaded', () => {
    const csvInput = document.getElementById('user-csv-input');
    if (csvInput) {
        csvInput.addEventListener('change', uploadCSV);
    }

    const registrationToggle = document.getElementById('registration-mode-toggle');
    if (registrationToggle) {
        registrationToggle.addEventListener('change', toggleRegistrationMode);
    }
});

window.moveFileToMode = moveFileToMode;
window.deleteInsight = deleteInsight;
window.exportInsights = exportInsights;
window.toggleFileEnabled = toggleFileEnabled;
window.switchTab = switchTab;
window.saveEmbeddingSettings = saveEmbeddingSettings;
window.processEmbeddings = processEmbeddings;
window.closeFilePreview = closeFilePreview;
window.downloadPreviewFile = downloadPreviewFile;
window.summarizePreviewFile = summarizePreviewFile;
window.saveSystemPrompt = saveSystemPrompt;
window.resetSystemPrompt = resetSystemPrompt;
window.testSystemPrompt = testSystemPrompt;
window.loadTemplate = loadTemplate;
window.saveSettings = saveSettings;
window.filterActivity = filterActivity;
window.loadRegistrationMode = loadRegistrationMode;
window.loadUsers = loadUsers;
window.sendInvite = sendInvite;
window.sendBulkInvites = sendBulkInvites;
window.toggleUserAccess = toggleUserAccess;
window.deleteUserConfirm = deleteUserConfirm;

} // End of adminDashboardInitialized guard
