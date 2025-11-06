let currentThreadId = null;
let currentThreadTitle = null; // Track current thread title
let currentUser = null;
let welcomeMessage = null;
let sharedMessages = {}; // Track which messages are shared {message_id: insight_id}
let shareCount = 0; // Track how many shares user has used
let messageContents = {}; // Store original markdown content by message ID
let messageCount = 0; // Track number of messages in thread
let conversationHistory = []; // Store first two exchanges for auto-rename
let currentModel = null; // Track current thread's model
let debugContextBypass = false; // Flag to bypass debug context dialog when sending from dialog
let storedDebugMessage = null; // Store message when showing debug dialog

// Helper function to parse markdown safely
function parseMarkdown(text) {
    if (typeof marked !== 'undefined' && marked.parse) {
        return marked.parse(text);
    }
    // Fallback to plain text if marked is not loaded
    return escapeHtml(text);
}

// Helper function to get AI avatar gradient based on model
function getAIGradient(model) {
    const gradients = {
        'gemini': 'linear-gradient(135deg, #001E50, #00A0E9)', // Blue gradient
        'claude': 'linear-gradient(135deg, #FF491E, #C2891E)', // Orange gradient
        'grok': 'linear-gradient(135deg, #4A5568, #718096)', // Grey gradient
        'perplexity': 'linear-gradient(135deg, #0D9488, #14B8A6)' // Teal gradient
    };
    return gradients[model] || gradients['gemini']; // Default to gemini blue
}

// Load user info and threads on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check session first
    const isAuthenticated = await checkSession();
    if (!isAuthenticated) {
        // Redirect to login if not authenticated
        window.location.replace('/login');
        return;
    }

    await loadUserInfo();
    await loadModelInfo(); // Always load model info for avatar dropdown

    // Check if we're on an insights page - if so, skip chat-specific initialization
    if (typeof initialView !== 'undefined' && initialView === 'insights') {
        await loadThreads(); // Load threads for sidebar
        return; // Skip chat-specific initialization
    }

    // Chat-specific initialization
    await loadWelcomeMessage();
    await loadConversationStarters();
    await loadNewChatText();
    await loadThreads();

    // Check URL for thread ID and auto-select if present
    checkAndLoadThreadFromURL();
});

// Check if user session is valid
async function checkSession() {
    try {
        const response = await fetch('/me');
        if (response.status === 401 || !response.ok) {
            return false;
        }
        return true;
    } catch (error) {
        console.error('Session check failed:', error);
        return false;
    }
}

// Helper function to safely handle API responses
async function handleApiResponse(response) {
    // Check for authentication errors
    if (response.status === 401 || response.status === 403) {
        console.warn('Authentication failed, redirecting to login');
        window.location.replace('/login');
        throw new Error('Authentication required');
    }

    // Check if response is actually JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        console.error('Expected JSON but got:', contentType);
        throw new Error('Invalid response format');
    }

    // Parse JSON
    const data = await response.json();

    // Check if response is OK
    if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
    }

    return data;
}

// Handle browser back/forward navigation
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.threadId) {
        // Find the thread title from the sidebar and select it
        const threadElement = document.querySelector(`.thread-item[onclick*="${event.state.threadId}"]`);
        if (threadElement) {
            const titleElement = threadElement.querySelector('.thread-title');
            const title = titleElement ? titleElement.textContent : 'Chat';
            const hashId = event.state.hashId || null;
            selectThread(event.state.threadId, title, hashId);
        }
    }
});

// Check URL for thread parameter and load it
async function checkAndLoadThreadFromURL() {
    // Use initialHashId from template if available
    if (typeof initialHashId !== 'undefined' && initialHashId) {
        // Look up thread by hash_id
        try {
            const response = await fetch('/api/threads');
            if (response.ok) {
                const data = await response.json();
                const thread = data.threads.find(t => t.hash_id === initialHashId);
                if (thread) {
                    setTimeout(() => {
                        selectThread(thread.id, thread.title, thread.hash_id);
                    }, 100);
                }
            }
        } catch (error) {
            console.error('Failed to load thread by hash_id:', error);
        }
    }
}

async function loadUserInfo() {
    try {
        const response = await fetch('/me');
        if (response.ok) {
            currentUser = await response.json();
            document.getElementById('user-name').textContent = currentUser.name;
            const avatar = document.getElementById('user-avatar');
            avatar.style.background = currentUser.avatar_gradient;
            avatar.innerHTML = `<span>${currentUser.name.substring(0, 2).toUpperCase()}</span>`;
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
}

async function loadWelcomeMessage() {
    try {
        const response = await fetch('/api/welcome');
        if (response.ok) {
            const data = await response.json();
            welcomeMessage = data.welcome_message;
        }
    } catch (error) {
        console.error('Failed to load welcome message:', error);
        welcomeMessage = '# Welcome to ConfAI!\n\nStart a new chat to begin.';
    }
}

let conversationStarters = [];
let newChatText = '';

async function loadConversationStarters() {
    try {
        const response = await fetch('/api/conversation-starters');
        if (response.ok) {
            const data = await response.json();
            conversationStarters = data.starters || [];
        }
    } catch (error) {
        console.error('Failed to load conversation starters:', error);
        conversationStarters = [];
    }
}

async function loadNewChatText() {
    try {
        const response = await fetch('/api/new-chat-text');
        if (response.ok) {
            const data = await response.json();
            newChatText = data.text || '';
        }
    } catch (error) {
        console.error('Failed to load new chat text:', error);
        newChatText = '';
    }
}

function showConversationStarters() {
    const container = document.getElementById('conversation-starters');
    if (!container || conversationStarters.length === 0) return;

    container.innerHTML = '';

    // Add conversation starter buttons
    conversationStarters.forEach((starter, index) => {
        const btn = document.createElement('button');
        btn.className = 'starter-btn';
        btn.textContent = starter;
        btn.onclick = () => useConversationStarter(starter);
        container.appendChild(btn);
    });

    container.style.display = 'grid';
}

function hideConversationStarters() {
    const container = document.getElementById('conversation-starters');
    if (container) {
        container.style.display = 'none';
    }
}

function useConversationStarter(text) {
    const input = document.getElementById('chat-input');
    if (input) {
        input.value = text;
        autoResizeTextarea(input);
        input.focus();
    }
}

async function loadModelInfo() {
    try {
        // Check localStorage for persisted preference
        const savedProvider = localStorage.getItem('preferred_model');

        // If localStorage has a preference, sync it to backend session first
        if (savedProvider) {
            await fetch('/api/config', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({provider: savedProvider})
            });
        }

        // Fetch current config from backend
        const response = await fetch('/api/config');
        if (response.ok) {
            const data = await response.json();

            // Set current model for gradient on new chats
            currentModel = data.provider;

            // Ensure localStorage is synced
            localStorage.setItem('preferred_model', data.provider);

            // Update model name in header dropdown
            const modelNameHeaderEl = document.getElementById('current-model-name-header');
            if (modelNameHeaderEl) {
                modelNameHeaderEl.textContent = data.provider_name;
            }

            // Build model dropdown based on availability
            if (data.available_providers) {
                buildModelDropdown(data.available_providers, data.provider);
            }

            // Re-initialize Lucide icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    } catch (error) {
        console.error('Failed to load model info:', error);
    }
}

function buildModelDropdown(availableProviders, currentProvider) {
    const dropdown = document.getElementById('model-dropdown');
    if (!dropdown) return;

    const models = [
        { id: 'claude', name: 'Claude', icon: 'brain' },
        { id: 'gemini', name: 'Gemini', icon: 'sparkles' },
        { id: 'grok', name: 'Grok', icon: 'zap' },
        { id: 'perplexity', name: 'Perplexity', icon: 'search' }
    ];

    dropdown.innerHTML = models.map(model => {
        const isAvailable = availableProviders[model.id];
        const isActive = model.id === currentProvider;
        const disabledClass = !isAvailable ? ' model-unavailable' : '';
        const activeClass = isActive ? ' active' : '';
        const onClick = isAvailable ? `onclick="selectModel('${model.id}')"` : '';

        return `
            <div class="model-option${disabledClass}${activeClass}" ${onClick}>
                <i data-lucide="${model.icon}"></i>
                <span>${model.name}</span>
                ${isAvailable ? '<span class="model-ready-badge">ready</span>' : ''}
            </div>
        `;
    }).join('');

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function toggleAvatarDropdown(event) {
    // Stop event from bubbling to document click listener
    if (event) {
        event.stopPropagation();
    }

    console.log('toggleAvatarDropdown called');
    const dropdown = document.getElementById('avatar-dropdown');
    if (!dropdown) {
        console.error('Avatar dropdown element not found in DOM');
        return;
    }

    const isVisible = dropdown.style.display === 'block';
    console.log('Current visibility:', isVisible, '-> Setting to:', !isVisible);
    dropdown.style.display = isVisible ? 'none' : 'block';

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function toggleModelDropdown(event) {
    // Stop event from bubbling to document click listener
    if (event) {
        event.stopPropagation();
    }

    const dropdown = document.getElementById('model-dropdown');
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

async function selectModel(provider) {
    try {
        // Close only the model dropdown, keep avatar dropdown open
        document.getElementById('model-dropdown').style.display = 'none';

        // Show loading state
        const modelNameHeaderEl = document.getElementById('current-model-name-header');
        const originalText = modelNameHeaderEl.textContent;
        modelNameHeaderEl.textContent = 'Switching...';

        // Send update request
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({provider: provider})
        });

        if (response.ok) {
            const data = await response.json();
            modelNameHeaderEl.textContent = data.provider_name;

            // Update current model for gradient
            currentModel = provider;

            // Save to localStorage for persistence across sessions
            localStorage.setItem('preferred_model', provider);

            // Show success message
            console.log(data.message);

            // Re-initialize Lucide icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        } else {
            // Revert on error
            modelNameHeaderEl.textContent = originalText;
            const error = await response.json();
            showDialog('Failed to switch model: ' + (error.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Failed to switch model:', error);
        showDialog('Failed to switch model', 'error');
    }
}

// Close dropdowns when clicking outside (wrapped in DOMContentLoaded to ensure elements exist)
document.addEventListener('DOMContentLoaded', () => {
    console.log('Setting up click-outside listener for avatar dropdown');

    document.addEventListener('click', function(event) {
        const avatarDropdown = document.getElementById('avatar-dropdown');
        const avatarContainer = document.querySelector('.avatar-dropdown-container');

        // Close avatar dropdown only if clicking completely outside the avatar container
        if (avatarDropdown && avatarContainer &&
            !avatarContainer.contains(event.target)) {
            avatarDropdown.style.display = 'none';
            // Also close model dropdown when avatar dropdown closes
            const modelDropdown = document.getElementById('model-dropdown');
            if (modelDropdown) {
                modelDropdown.style.display = 'none';
            }
        }
    });
});

async function loadThreads() {
    try {
        const response = await fetch('/api/threads');
        const data = await handleApiResponse(response);
        renderThreads(data.threads);

        // Don't auto-select threads on insights pages
        if (typeof initialView !== 'undefined' && initialView === 'insights') {
            return; // Skip auto-selection on insights pages
        }

        // Auto-select first thread if exists, otherwise show welcome screen
        if (data.threads.length > 0 && !currentThreadId) {
            selectThread(data.threads[0].id, data.threads[0].title, data.threads[0].hash_id);
        } else if (data.threads.length === 0) {
            showWelcomeScreen();
        }
    } catch (error) {
        console.error('Failed to load threads:', error);
        // Don't show error dialog here, as this is called frequently
    }
}

function renderThreads(threads) {
    const list = document.getElementById('threads-list');
    if (threads.length === 0) {
        list.innerHTML = '<div class="threads-empty-state" style="padding: 20px; text-align: center; opacity: 0.7; font-size: 14px;">No chats yet</div>';
        return;
    }

    list.innerHTML = threads.map(t => `
        <div class="thread-item ${t.id === currentThreadId ? 'active' : ''}"
             onclick="selectThread(${t.id}, '${t.title}', '${t.hash_id || ''}')">
            <i class="thread-icon" data-lucide="message-square"></i>
            <span class="thread-title">${t.title}</span>
            <button class="thread-delete" onclick="event.stopPropagation(); deleteThread(${t.id})">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
    `).join('');

    // Reinitialize icons after updating thread list
    lucide.createIcons();
}

async function createNewThread() {
    try {
        // Generate title with current date and time (without year)
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const title = `Chat ${month}-${day} ${hours}:${minutes}`;

        const response = await fetch('/api/threads', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title: title})
        });

        const data = await handleApiResponse(response);
        await loadThreads();
        selectThread(data.thread_id, title, data.hash_id);
    } catch (error) {
        console.error('Failed to create thread:', error);
        showDialog('Failed to create new chat. Please try again.', 'error');
    }
}

async function selectThread(threadId, title, hashId = null) {
    currentThreadId = threadId;
    currentThreadTitle = title;
    document.getElementById('main-title').textContent = title;

    // Show input area when selecting a thread
    const inputArea = document.querySelector('.chat-input-area');
    if (inputArea) {
        inputArea.style.display = 'block';
    }
    document.getElementById('chat-input').disabled = false;
    document.getElementById('send-btn').disabled = false;

    // Update URL with hash_id if available, otherwise use numeric ID
    if (hashId) {
        const url = `/chat/${hashId}`;
        window.history.pushState({threadId: threadId, hashId: hashId}, '', url);
    } else {
        // Fallback for threads without hash_id (shouldn't happen after migration)
        const url = new URL(window.location);
        url.searchParams.set('thread', threadId);
        window.history.pushState({threadId: threadId}, '', url);
    }

    // Show chat view (thread selection should always show chat)
    await showChat();

    // Update active thread in sidebar
    await loadThreads();

    // Load messages
    await loadMessages(threadId);
}

async function loadMessages(threadId) {
    try {
        const response = await fetch(`/api/threads/${threadId}/messages`);
        const data = await handleApiResponse(response);

        // Count user messages to track prompt count
        const userMessages = data.messages.filter(m => m.role === 'user');
        messageCount = userMessages.length;

        // Store first two user prompts for auto-rename
        conversationHistory = userMessages.slice(0, 2).map(m => m.content);

        // Store current model from first assistant message
        const assistantMsg = data.messages.find(m => m.role === 'assistant');
        if (assistantMsg && assistantMsg.model) {
            currentModel = assistantMsg.model;
        }

        // Check which messages are shared
        await checkSharedStatus(data.messages);

        renderMessages(data.messages);
    } catch (error) {
        console.error('Failed to load messages:', error);
        showDialog('Failed to load messages. Please try again.', 'error');
    }
}

async function checkSharedStatus(messages) {
    try {
        const messageIds = messages
            .filter(m => m.role === 'assistant' && m.id)
            .map(m => m.id);

        if (messageIds.length === 0) return;

        const response = await fetch('/api/insights/check', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ message_ids: messageIds })
        });

        if (response.ok) {
            const data = await response.json();
            sharedMessages = data.shared_messages || {};
            shareCount = data.share_count || 0;
            updateShareCountDisplay();
        }
    } catch (error) {
        console.error('Failed to check shared status:', error);
    }
}

function updateShareCountDisplay() {
    const sharesHeader = document.getElementById('shares-header');
    const sharesCount = document.getElementById('shares-count-header');

    if (sharesHeader && sharesCount) {
        sharesHeader.style.display = 'flex';
        sharesCount.textContent = `${shareCount}/3`;
    }
}

function renderMessages(messages) {
    const container = document.getElementById('chat-messages');

    if (messages.length === 0) {
        // Use editable new chat text if available, otherwise use default
        const emptyStateText = newChatText || 'Start the conversation!\n\nAsk me anything about the conference materials.';
        const parsedText = parseMarkdown(emptyStateText);

        // Create empty state with new chat instructions
        const emptyStateDiv = document.createElement('div');
        emptyStateDiv.className = 'empty-state';
        emptyStateDiv.innerHTML = parsedText;

        // Add conversation starters as tiles if available
        if (conversationStarters && conversationStarters.length > 0) {
            const startersGrid = document.createElement('div');
            startersGrid.className = 'empty-state-starters';

            conversationStarters.forEach((starter) => {
                const starterTile = document.createElement('button');
                starterTile.className = 'empty-state-starter-tile';
                starterTile.textContent = starter;
                starterTile.onclick = () => useConversationStarter(starter);
                startersGrid.appendChild(starterTile);
            });

            emptyStateDiv.appendChild(startersGrid);
        }

        container.innerHTML = '';
        container.appendChild(emptyStateDiv);
        return;
    }

    container.innerHTML = messages.map(m => {
        const isUser = m.role === 'user';
        const avatar = isUser ? currentUser.name.substring(0, 2).toUpperCase() : 'AI';
        const gradient = isUser ? currentUser.avatar_gradient : getAIGradient(m.model);
        const content = isUser ? escapeHtml(m.content) : parseMarkdown(m.content);

        // Store original markdown content in JavaScript object for assistant messages
        if (m.role === 'assistant' && m.id) {
            messageContents[m.id] = m.content;
        }

        // Check if this message is shared
        const isShared = m.role === 'assistant' && sharedMessages[m.id];
        const insightId = isShared ? sharedMessages[m.id] : null;
        const shareLimitReached = shareCount >= 3;

        return `
            <div class="message ${m.role}" data-message-id="${m.id || ''}" ${m.role === 'assistant' ? `data-model="${m.model || 'gemini'}"` : ''}>
                <div class="message-avatar" style="background: ${gradient}"><span>${avatar}</span></div>
                <div>
                    <div class="message-content">${content}</div>
                    ${m.role === 'assistant' ? `
                        <div class="message-actions">
                            ${isShared ? `
                                <span class="shared-tag">
                                    <i data-lucide="check-circle"></i>
                                    <span>Shared</span>
                                </span>
                                <button class="unshare-btn" onclick="unshareInsight(this, ${insightId})">
                                    <i data-lucide="x-circle"></i>
                                    <span>Unshare</span>
                                </button>
                            ` : shareLimitReached ? `
                                <div class="share-limit-message">
                                    Share limit reached. Try unsharing your least favourites on <a href="#" onclick="showMyShares(); return false;">your shares page</a>
                                </div>
                            ` : `
                                <button class="share-btn" onclick="shareInsightFromElement(this)">
                                    <i data-lucide="share-2"></i>
                                    <span>Share to Insights Wall</span>
                                </button>
                            `}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Initialize Lucide icons for share buttons
    setTimeout(() => lucide.createIcons(), 0);

    scrollToBottom();
}

async function sendMessage() {
    console.log('sendMessage called');
    if (!currentThreadId) {
        console.log('No currentThreadId, returning');
        return;
    }

    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    console.log('Message:', message);

    if (!message) {
        console.log('Empty message, returning');
        return;
    }

    // Check if debug context mode is enabled
    const debugToggle = document.getElementById('debug-context-toggle');
    console.log('Debug toggle:', debugToggle, 'Checked:', debugToggle?.checked, 'Bypass:', debugContextBypass);
    if (debugToggle && debugToggle.checked && !debugContextBypass) {
        console.log('Debug mode enabled, showing dialog');
        // Store message for later use and show debug context dialog
        storedDebugMessage = message;
        await showDebugContextDialog(message);
        return;
    }

    // Reset bypass flag and stored message for next message
    debugContextBypass = false;
    storedDebugMessage = null;

    // Store user prompt in conversation history
    conversationHistory.push(message);
    messageCount++;

    // Auto-rename based on prompt(s)
    // After 1st prompt: rename based on first prompt only
    // After 2nd prompt: rename based on both prompts
    if (messageCount === 1 || messageCount === 2) {
        // Trigger rename immediately after sending prompt
        setTimeout(async () => {
            const prompts = conversationHistory.slice(0, messageCount);
            await autoRenameThreadByPrompts(prompts);
        }, 100);
    }

    // Clear input and reset height
    input.value = '';
    input.style.height = '50px';

    // Add user message to UI immediately
    addMessageToUI('user', message);

    // Show typing indicator
    showTypingIndicator();

    // Disable input while processing
    input.disabled = true;
    document.getElementById('send-btn').disabled = true;

    try {
        // Use SSE for streaming
        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                thread_id: currentThreadId,
                message: message
            })
        });

        // Check for authentication errors before reading stream
        if (response.status === 401 || response.status === 403) {
            console.warn('Authentication failed, redirecting to login');
            window.location.replace('/login');
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';
        let messageElement = null;

        while (true) {
            const {done, value} = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.slice(6));

                    if (data.error) {
                        hideTypingIndicator();
                        addMessageToUI('assistant', data.error);
                        break;
                    }

                    if (!data.done) {
                        assistantMessage += data.content;

                        // Create or update message element
                        if (!messageElement) {
                            hideTypingIndicator();
                            messageElement = addStreamingMessage();
                        }
                        updateStreamingMessage(messageElement, assistantMessage, false);
                    } else if (data.done && messageElement && assistantMessage) {
                        // Mark streaming as complete and show share button
                        const messageId = data.message_id;
                        updateStreamingMessage(messageElement, assistantMessage, true, messageId);

                        // Store the original markdown content
                        if (messageId) {
                            messageContents[messageId] = assistantMessage;
                            messageElement.setAttribute('data-message-id', messageId);
                        }
                    }
                }
            }
        }

    } catch (error) {
        console.error('Error sending message:', error);
        hideTypingIndicator();
        addMessageToUI('assistant', 'Sorry, something went wrong. Please try again.');
    }

    // Re-enable input
    input.disabled = false;
    document.getElementById('send-btn').disabled = false;
    input.focus();
}

function addMessageToUI(role, content) {
    const container = document.getElementById('chat-messages');
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const isUser = role === 'user';
    const avatar = isUser ? currentUser.name.substring(0, 2).toUpperCase() : 'AI';
    const gradient = isUser ? currentUser.avatar_gradient : 'linear-gradient(135deg, #001E50, #00A0E9)';
    const displayContent = parseMarkdown(content);
    // Store original markdown content in data attribute for sharing
    const originalContent = content.replace(/"/g, '&quot;');

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    // Check if share limit is reached
    const shareLimitReached = shareCount >= 3;

    messageDiv.innerHTML = `
        <div class="message-avatar" style="background: ${gradient}"><span>${avatar}</span></div>
        <div>
            <div class="message-content" data-original-content="${originalContent}">${displayContent}</div>
            ${role === 'assistant' ? `
                <div class="message-actions">
                    ${shareLimitReached ? `
                        <div class="share-limit-message">
                            Share limit reached. Try unsharing your least favourites on <a href="#" onclick="showMyShares(); return false;">your shares page</a>
                        </div>
                    ` : `
                        <button class="share-btn" onclick="shareInsightFromElement(this)">
                            <i data-lucide="share-2"></i>
                            <span>Share to Insights Wall</span>
                        </button>
                    `}
                </div>
            ` : ''}
        </div>
    `;

    // Initialize Lucide icons in this message
    if (role === 'assistant') {
        setTimeout(() => lucide.createIcons(), 0);
    }

    container.appendChild(messageDiv);
    scrollToBottom();
}

function addStreamingMessage() {
    const container = document.getElementById('chat-messages');
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    // Check if share limit is reached
    const shareLimitReached = shareCount >= 3;

    // Use current model's gradient
    const gradient = getAIGradient(currentModel);

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.setAttribute('data-model', currentModel || 'gemini');
    messageDiv.innerHTML = `
        <div class="message-avatar" style="background: ${gradient}"><span>AI</span></div>
        <div>
            <div class="message-content"></div>
            <div class="message-actions" style="display: none;">
                ${shareLimitReached ? `
                    <div class="share-limit-message">
                        Share limit reached. Try unsharing your least favourites on <a href="#" onclick="showMyShares(); return false;">your shares page</a>
                    </div>
                ` : `
                    <button class="share-btn" onclick="shareInsightFromElement(this)">
                        <i data-lucide="share-2"></i>
                        <span>Share to Insights Wall</span>
                    </button>
                `}
            </div>
        </div>
    `;

    container.appendChild(messageDiv);
    return messageDiv;
}

function updateStreamingMessage(element, content, done = false, messageId = null) {
    const contentDiv = element.querySelector('.message-content');

    // Parse markdown during streaming AND when complete
    contentDiv.innerHTML = parseMarkdown(content);

    // Show share button when streaming is complete
    if (done) {
        const actionsDiv = element.querySelector('.message-actions');
        if (actionsDiv && content) {
            actionsDiv.style.display = 'flex';
            // Initialize Lucide icons for the share button
            setTimeout(() => lucide.createIcons(), 0);
        }
    }

    scrollToBottom();
}

function showTypingIndicator() {
    const container = document.getElementById('chat-messages');

    // Use current model's gradient
    const gradient = getAIGradient(currentModel);

    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'message assistant';
    indicator.innerHTML = `
        <div class="message-avatar" style="background: ${gradient}"><span>AI</span></div>
        <div>
            <div class="typing-indicator show">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    container.appendChild(indicator);
    scrollToBottom();
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

async function deleteThread(threadId) {
    if (!await showConfirm('Delete this chat?', {
        confirmText: 'Delete',
        confirmStyle: 'danger'
    })) return;

    try {
        const response = await fetch(`/api/threads/${threadId}`, {
            method: 'DELETE'
        });

        await handleApiResponse(response);

        if (currentThreadId === threadId) {
            currentThreadId = null;
            document.getElementById('chat-messages').innerHTML = '<div class="empty-state"><h3>Chat deleted</h3><p>Create a new chat to continue.</p></div>';
            document.getElementById('main-title').textContent = 'Select or create a chat';
            document.getElementById('chat-input').disabled = true;
            document.getElementById('send-btn').disabled = true;
        }
        await loadThreads();
    } catch (error) {
        console.error('Failed to delete thread:', error);
        showDialog('Failed to delete chat. Please try again.', 'error');
    }
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
}

function showWelcomeScreen() {
    const container = document.getElementById('chat-messages');
    const parsedWelcome = welcomeMessage ? parseMarkdown(welcomeMessage) : '<h1>Welcome to ConfAI!</h1><p>Start a new chat to begin.</p>';

    container.innerHTML = `
        <div class="welcome-screen">
            <div class="welcome-content">${parsedWelcome}</div>
            <button class="new-chat-centered-btn" onclick="createNewThread()">
                <i data-lucide="plus"></i>
                <span>New Chat</span>
            </button>
        </div>
    `;

    // Initialize Lucide icons in the welcome screen
    setTimeout(() => lucide.createIcons(), 0);

    // Hide input area when showing welcome screen
    const inputArea = document.querySelector('.chat-input-area');
    if (inputArea) {
        inputArea.style.display = 'none';
    }
    document.getElementById('chat-input').disabled = true;
    document.getElementById('send-btn').disabled = true;
    const threadTitle = document.getElementById('thread-title');
    if (threadTitle) {
        threadTitle.textContent = 'Welcome';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-resize textarea
function autoResizeTextarea(textarea) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Calculate new height (min 50px, max 354px)
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 50), 354);
    textarea.style.height = newHeight + 'px';
}

document.getElementById('chat-input').addEventListener('input', function() {
    autoResizeTextarea(this);
});

// Send on Enter (Shift+Enter for new line)
document.getElementById('chat-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Share insight functions
async function shareInsight(button, content, messageId) {
    console.log('shareInsight called with content:', content?.substring(0, 50));

    if (!content || content.length < 10) {
        showDialog('Insight is too short to share', 'warning');
        return;
    }

    button.disabled = true;
    button.innerHTML = '<i data-lucide="loader"></i><span>Sharing...</span>';
    lucide.createIcons();

    try {
        const response = await fetch('/api/insights', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: content,
                message_id: messageId
            })
        });

        const data = await response.json();
        console.log('Share response:', data);

        if (!response.ok) {
            throw new Error(data.error || 'Failed to share insight');
        }

        // Update share count and shared messages tracking
        shareCount = data.shares_remaining !== undefined ? 3 - data.shares_remaining : shareCount + 1;
        if (messageId && data.insight_id) {
            sharedMessages[messageId] = data.insight_id;
        }
        updateShareCountDisplay();

        // Replace button with shared tag and unshare button
        const messageDiv = button.closest('.message');
        const actionsDiv = messageDiv.querySelector('.message-actions');
        actionsDiv.innerHTML = `
            <span class="shared-tag">
                <i data-lucide="check-circle"></i>
                <span>Shared</span>
            </span>
            <button class="unshare-btn" onclick="unshareInsight(this, ${data.insight_id})">
                <i data-lucide="x-circle"></i>
                <span>Unshare</span>
            </button>
        `;
        lucide.createIcons();

    } catch (error) {
        console.error('Error sharing insight:', error);
        showDialog(`Error sharing insight: ${error.message}`, 'error');
        button.innerHTML = '<i data-lucide="share-2"></i><span>Share to Insights Wall</span>';
        button.disabled = false;
        lucide.createIcons();
    }
}

async function unshareInsight(button, insightId) {
    if (!await showConfirm('Remove this insight from the Insights Wall?', {
        confirmText: 'Remove',
        confirmStyle: 'danger'
    })) return;

    button.disabled = true;
    button.innerHTML = '<i data-lucide="loader"></i><span>Removing...</span>';
    lucide.createIcons();

    try {
        const response = await fetch(`/api/insights/${insightId}/unshare`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to unshare insight');
        }

        // Update share count and shared messages tracking
        shareCount = data.shares_remaining !== undefined ? 3 - data.shares_remaining : shareCount - 1;

        // Remove from sharedMessages tracking
        const messageDiv = button.closest('.message');
        const messageId = messageDiv.getAttribute('data-message-id');
        if (messageId && sharedMessages[messageId]) {
            delete sharedMessages[messageId];
        }
        updateShareCountDisplay();

        // Replace with share button
        const actionsDiv = messageDiv.querySelector('.message-actions');
        actionsDiv.innerHTML = `
            <button class="share-btn" onclick="shareInsightFromElement(this)">
                <i data-lucide="share-2"></i>
                <span>Share to Insights Wall</span>
            </button>
        `;
        lucide.createIcons();

    } catch (error) {
        console.error('Error unsharing insight:', error);
        showDialog(`Error unsharing insight: ${error.message}`, 'error');
        button.disabled = false;
        button.innerHTML = '<i data-lucide="x-circle"></i><span>Unshare</span>';
        lucide.createIcons();
    }
}

function shareInsightFromElement(button) {
    const messageDiv = button.closest('.message');
    const messageId = messageDiv.getAttribute('data-message-id');

    // Get the original markdown content from our JavaScript object
    const content = messageContents[messageId];

    if (!content) {
        showDialog('Unable to share this message. Please try again.', 'error');
        console.error('No content found for message ID:', messageId);
        return;
    }

    console.log('shareInsightFromElement - original markdown content length:', content.length, 'messageId:', messageId);
    shareInsight(button, content, messageId);
}

async function autoRenameThreadByPrompts(prompts) {
    try {
        console.log(`Auto-renaming thread based on ${prompts.length} prompt(s)...`);

        const renameResponse = await fetch(`/api/threads/${currentThreadId}/rename`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                prompts: prompts
            })
        });

        if (renameResponse.ok) {
            const data = await renameResponse.json();
            console.log('Thread renamed to:', data.new_title);

            // Update the title in the UI and global variable
            currentThreadTitle = data.new_title;
            document.getElementById('main-title').textContent = data.new_title;

            // Reload threads to show new title in sidebar
            await loadThreads();
        } else {
            console.error('Failed to auto-rename thread');
        }
    } catch (error) {
        console.error('Error auto-renaming thread:', error);
    }
}

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
    // Show dialog immediately with loading message
    const dialog = document.getElementById('debug-context-dialog');
    const overlay = document.getElementById('debug-context-overlay');
    const contentEl = document.getElementById('debug-context-content');

    // Show loading message
    contentEl.textContent = 'Loading context...\n\nPlease wait while we gather:\n- System prompt\n- Always-in-context files\n- Semantic search results\n- Conversation history';

    // Show dialog
    overlay.classList.add('active');
    dialog.classList.add('active');

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

        // Update dialog content with actual data
        contentEl.textContent = JSON.stringify(data, null, 2);

    } catch (error) {
        console.error('Error showing debug context:', error);
        contentEl.textContent = 'Error loading debug context:\n\n' + error.message;
    }
}

/**
 * Close debug context dialog
 * @param {boolean} clearInput - Whether to clear the input field (true for cancel, false for send)
 */
function closeDebugContextDialog(clearInput = true) {
    const dialog = document.getElementById('debug-context-dialog');
    const overlay = document.getElementById('debug-context-overlay');

    overlay.classList.remove('active');
    dialog.classList.remove('active');

    // Clear the input field only when canceling
    if (clearInput) {
        const input = document.getElementById('chat-input');
        if (input) {
            input.value = '';
            input.style.height = '50px';
        }
        // Clear stored message
        storedDebugMessage = null;
    }
}

/**
 * Send message from debug context dialog
 */
function sendFromDebugDialog() {
    // Restore the stored message to the input field
    if (storedDebugMessage) {
        const input = document.getElementById('chat-input');
        input.value = storedDebugMessage;
        autoResizeTextarea(input);
    }

    // Set bypass flag
    debugContextBypass = true;

    // Close dialog WITHOUT clearing the input
    closeDebugContextDialog(false);

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
