let currentThreadId = null;
let currentUser = null;
let welcomeMessage = null;
let sharedMessages = {}; // Track which messages are shared {message_id: insight_id}
let shareCount = 0; // Track how many shares user has used
let messageContents = {}; // Store original markdown content by message ID

// Helper function to parse markdown safely
function parseMarkdown(text) {
    if (typeof marked !== 'undefined' && marked.parse) {
        return marked.parse(text);
    }
    // Fallback to plain text if marked is not loaded
    return escapeHtml(text);
}

// Load user info and threads on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserInfo();
    await loadWelcomeMessage();
    await loadThreads();
});

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

async function loadThreads() {
    try {
        const response = await fetch('/api/threads');
        if (response.ok) {
            const data = await response.json();
            renderThreads(data.threads);

            // Auto-select first thread if exists, otherwise show welcome screen
            if (data.threads.length > 0 && !currentThreadId) {
                selectThread(data.threads[0].id, data.threads[0].title);
            } else if (data.threads.length === 0) {
                showWelcomeScreen();
            }
        }
    } catch (error) {
        console.error('Failed to load threads:', error);
    }
}

function renderThreads(threads) {
    const list = document.getElementById('threads-list');
    if (threads.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.7; font-size: 14px;">No chats yet</div>';
        return;
    }

    list.innerHTML = threads.map(t => `
        <div class="thread-item ${t.id === currentThreadId ? 'active' : ''}"
             onclick="selectThread(${t.id}, '${t.title}')">
            <span>${t.title}</span>
            <button class="thread-delete" onclick="event.stopPropagation(); deleteThread(${t.id})">×</button>
        </div>
    `).join('');
}

async function createNewThread() {
    try {
        const response = await fetch('/api/threads', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title: 'New Chat'})
        });

        if (response.ok) {
            const data = await response.json();
            await loadThreads();
            selectThread(data.thread_id, 'New Chat');
        }
    } catch (error) {
        console.error('Failed to create thread:', error);
    }
}

async function selectThread(threadId, title) {
    currentThreadId = threadId;
    document.getElementById('main-title').textContent = title;
    document.getElementById('chat-input').disabled = false;
    document.getElementById('send-btn').disabled = false;

    // Show chat view
    showChat();

    // Update active thread in sidebar
    await loadThreads();

    // Load messages
    await loadMessages(threadId);
}

async function loadMessages(threadId) {
    try {
        const response = await fetch(`/api/threads/${threadId}/messages`);
        if (response.ok) {
            const data = await response.json();

            // Check which messages are shared
            await checkSharedStatus(data.messages);

            renderMessages(data.messages);
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
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
        container.innerHTML = '<div class="empty-state"><h3>Start the conversation!</h3><p>Ask me anything about the conference materials.</p></div>';
        return;
    }

    container.innerHTML = messages.map(m => {
        const isUser = m.role === 'user';
        const avatar = isUser ? currentUser.name.substring(0, 2).toUpperCase() : 'AI';
        const gradient = isUser ? currentUser.avatar_gradient : 'linear-gradient(135deg, #001E50, #00A0E9)';
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
            <div class="message ${m.role}" data-message-id="${m.id || ''}">
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
    if (!currentThreadId) return;

    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    // Clear input
    input.value = '';
    input.rows = 1;

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
    const displayContent = isUser ? escapeHtml(content) : parseMarkdown(content);
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

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-avatar" style="background: linear-gradient(135deg, #001E50, #00A0E9)"><span>AI</span></div>
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
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'message assistant';
    indicator.innerHTML = `
        <div class="message-avatar" style="background: linear-gradient(135deg, #001E50, #00A0E9)"><span>AI</span></div>
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
    if (!confirm('Delete this chat?')) return;

    try {
        const response = await fetch(`/api/threads/${threadId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            if (currentThreadId === threadId) {
                currentThreadId = null;
                document.getElementById('chat-messages').innerHTML = '<div class="empty-state"><h3>Chat deleted</h3><p>Create a new chat to continue.</p></div>';
                document.getElementById('main-title').textContent = 'Select or create a chat';
                document.getElementById('chat-input').disabled = true;
                document.getElementById('send-btn').disabled = true;
            }
            await loadThreads();
        }
    } catch (error) {
        console.error('Failed to delete thread:', error);
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
    document.getElementById('chat-input').disabled = true;
    document.getElementById('send-btn').disabled = true;
    document.getElementById('thread-title').textContent = 'Welcome';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-resize textarea
document.getElementById('chat-input').addEventListener('input', function() {
    this.style.height = '50px';
    const newHeight = Math.min(Math.max(this.scrollHeight, 50), 354);
    this.style.height = newHeight + 'px';

    // Enable scrolling when content exceeds 15 lines
    if (this.scrollHeight > 354) {
        this.style.overflowY = 'auto';
    } else {
        this.style.overflowY = 'hidden';
    }
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
        alert('Insight is too short to share');
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
        alert(`Error sharing insight: ${error.message}`);
        button.innerHTML = '<i data-lucide="share-2"></i><span>Share to Insights Wall</span>';
        button.disabled = false;
        lucide.createIcons();
    }
}

async function unshareInsight(button, insightId) {
    if (!confirm('Remove this insight from the Insights Wall?')) return;

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
        alert(`Error unsharing insight: ${error.message}`);
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
        alert('Unable to share this message. Please try again.');
        console.error('No content found for message ID:', messageId);
        return;
    }

    console.log('shareInsightFromElement - original markdown content length:', content.length, 'messageId:', messageId);
    shareInsight(button, content, messageId);
}
