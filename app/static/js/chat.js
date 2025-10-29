let currentThreadId = null;
let currentUser = null;

// Load user info and threads on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserInfo();
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
            avatar.textContent = currentUser.name.substring(0, 2).toUpperCase();
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
}

async function loadThreads() {
    try {
        const response = await fetch('/api/threads');
        if (response.ok) {
            const data = await response.json();
            renderThreads(data.threads);

            // Auto-select first thread if exists
            if (data.threads.length > 0 && !currentThreadId) {
                selectThread(data.threads[0].id, data.threads[0].title);
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
    document.getElementById('thread-title').textContent = title;
    document.getElementById('chat-input').disabled = false;
    document.getElementById('send-btn').disabled = false;

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
            renderMessages(data.messages);
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
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

        return `
            <div class="message ${m.role}">
                <div class="message-avatar" style="background: ${gradient}">${avatar}</div>
                <div>
                    <div class="message-content">${escapeHtml(m.content)}</div>
                </div>
            </div>
        `;
    }).join('');

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
                        updateStreamingMessage(messageElement, assistantMessage, true);
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

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = `
        <div class="message-avatar" style="background: ${gradient}">${avatar}</div>
        <div>
            <div class="message-content">${escapeHtml(content)}</div>
            ${role === 'assistant' ? `
                <div class="message-actions">
                    <button class="share-btn" onclick="shareInsight(this, '${escapeHtml(content).replace(/'/g, "\\'")}')">
                        📌 Share to Insights
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    container.appendChild(messageDiv);
    scrollToBottom();
}

function addStreamingMessage() {
    const container = document.getElementById('chat-messages');
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-avatar" style="background: linear-gradient(135deg, #001E50, #00A0E9)">AI</div>
        <div>
            <div class="message-content"></div>
            <div class="message-actions" style="display: none;">
                <button class="share-btn" onclick="shareInsightFromElement(this)">
                    📌 Share to Insights
                </button>
            </div>
        </div>
    `;

    container.appendChild(messageDiv);
    return messageDiv;
}

function updateStreamingMessage(element, content, done = false) {
    const contentDiv = element.querySelector('.message-content');
    contentDiv.textContent = content;

    // Show share button when streaming is complete
    if (done && content) {
        const actionsDiv = element.querySelector('.message-actions');
        if (actionsDiv) {
            actionsDiv.style.display = 'flex';
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
        <div class="message-avatar" style="background: linear-gradient(135deg, #001E50, #00A0E9)">AI</div>
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
                document.getElementById('thread-title').textContent = 'Select or create a chat';
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-resize textarea
document.getElementById('chat-input').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Send on Enter (Shift+Enter for new line)
document.getElementById('chat-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Share insight functions
async function shareInsight(button, content) {
    if (!content || content.length < 10) {
        alert('Insight is too short to share');
        return;
    }

    button.disabled = true;
    button.textContent = 'Sharing...';

    try {
        const response = await fetch('/api/insights', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to share insight');
        }

        button.textContent = '✓ Shared!';
        button.style.background = 'var(--success)';
        button.style.borderColor = 'var(--success)';
        button.style.color = 'white';

        setTimeout(() => {
            button.textContent = '📌 Share to Insights';
            button.style.background = '';
            button.style.borderColor = '';
            button.style.color = '';
            button.disabled = false;
        }, 2000);

    } catch (error) {
        alert(`Error sharing insight: ${error.message}`);
        button.textContent = '📌 Share to Insights';
        button.disabled = false;
    }
}

function shareInsightFromElement(button) {
    const messageDiv = button.closest('.message');
    const content = messageDiv.querySelector('.message-content').textContent;
    shareInsight(button, content);
}
