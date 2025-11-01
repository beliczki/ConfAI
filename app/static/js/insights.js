let votesRemaining = 3;
let insights = [];
let currentFilter = 'all';
let votesUsed = 0;
let sharesUsed = 0;

async function loadInsights() {
    try {
        const response = await fetch('/api/insights');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load insights');
        }

        insights = data.insights;
        votesRemaining = data.votes_remaining || 0;
        votesUsed = data.votes_used || 0;
        sharesUsed = data.shares_used || 0;

        console.log('Loaded insights:', insights.length);
        console.log('Votes used:', votesUsed, 'Votes remaining:', votesRemaining, 'Shares:', sharesUsed);
        console.log('User owns:', insights.filter(i => i.is_owner).length, 'insights');
        console.log('User voted on:', insights.filter(i => i.user_vote).length, 'insights');

        // Update vote counter in filter button (insights page)
        const totalVotes = 3;
        const voteCountElem = document.getElementById('votes-count');
        if (voteCountElem) {
            voteCountElem.textContent = `${votesUsed}/3`;
        }

        // Update share counter in filter button (insights page)
        const shareCountElem = document.getElementById('shares-count');
        if (shareCountElem) {
            shareCountElem.textContent = `${sharesUsed}/3`;
        }

        // Update counters in chat header
        const voteCountHeader = document.getElementById('votes-count-header');
        if (voteCountHeader) {
            voteCountHeader.textContent = `${votesUsed}/3`;
        }

        const shareCountHeader = document.getElementById('shares-count-header');
        if (shareCountHeader) {
            shareCountHeader.textContent = `${sharesUsed}/3`;
        }

        const loadingEl = document.getElementById('insights-loading');
        if (loadingEl) loadingEl.style.display = 'none';

        const emptyStateEl = document.getElementById('insights-empty-state');
        const gridEl = document.getElementById('insights-grid');

        if (insights.length === 0) {
            if (emptyStateEl) emptyStateEl.style.display = 'block';
            if (gridEl) gridEl.style.display = 'none';
        } else {
            if (emptyStateEl) emptyStateEl.style.display = 'none';
            if (gridEl) gridEl.style.display = 'grid';
            renderInsights();
        }
    } catch (error) {
        console.error('Error loading insights:', error);
        const loadingEl = document.getElementById('insights-loading');
        if (loadingEl) {
            loadingEl.innerHTML = `<p style="color: #ff6b6b;">Error loading insights: ${error.message}</p>`;
        }
    }
}

function renderInsights() {
    const grid = document.getElementById('insights-grid');
    grid.innerHTML = '';

    // Filter insights based on current filter
    console.log('renderInsights called with filter:', currentFilter);
    let filteredInsights = insights;
    if (currentFilter === 'votes') {
        // Show only insights the user has voted on
        filteredInsights = insights.filter(i => i.user_vote !== null && i.user_vote !== undefined);
        console.log('Votes filter:', `Total insights: ${insights.length}, Filtered: ${filteredInsights.length}`);
        console.log('All insights user_vote values:', insights.map(i => ({id: i.id, user_vote: i.user_vote})));
    } else if (currentFilter === 'shares') {
        // Show only insights the user owns
        filteredInsights = insights.filter(i => i.is_owner === true);
        console.log('Shares filter:', `Total insights: ${insights.length}, Filtered: ${filteredInsights.length}`);
        console.log('All insights is_owner values:', insights.map(i => ({id: i.id, is_owner: i.is_owner})));
    } else {
        console.log('All filter: showing all', insights.length, 'insights');
    }

    filteredInsights.forEach(insight => {
        const card = createInsightCard(insight);
        grid.appendChild(card);
    });

    // Initialize Lucide icons after rendering - use multiple attempts to ensure they load
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
        setTimeout(() => lucide.createIcons(), 10);
        setTimeout(() => lucide.createIcons(), 100);
    }
}

function createInsightCard(insight) {
    const card = document.createElement('div');
    card.className = 'insight-card';
    card.dataset.insightId = insight.id;

    // Create date badge for top right
    const dateBadge = document.createElement('div');
    dateBadge.className = 'insight-date-badge';
    const createdDate = new Date(insight.created_at);
    dateBadge.textContent = createdDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const content = document.createElement('div');
    content.className = 'insight-content';

    // Check if content is longer than 800 characters
    const shouldTruncate = insight.content.length > 800;
    const displayContent = shouldTruncate ? insight.content.substring(0, 800) : insight.content;

    // Parse markdown the same way as in chat messages
    if (typeof marked !== 'undefined' && marked.parse) {
        content.innerHTML = marked.parse(displayContent);
    } else {
        content.textContent = displayContent;
    }

    // Add "... more" link if truncated
    if (shouldTruncate) {
        const moreLink = document.createElement('a');
        moreLink.href = '#';
        moreLink.className = 'more-link';
        moreLink.textContent = '... more';
        moreLink.onclick = (e) => {
            e.preventDefault();
            toggleInsightContent(card, insight.content);
        };
        content.appendChild(moreLink);
    }

    const footer = document.createElement('div');
    footer.className = 'insight-footer';

    // Create "Remix this idea" button
    const remixBtn = document.createElement('button');
    remixBtn.className = 'remix-btn';
    remixBtn.innerHTML = '<i data-lucide="sparkles"></i><span>Remix this idea</span>';
    remixBtn.onclick = () => remixIdea(insight.content);

    const voteControls = document.createElement('div');
    voteControls.className = 'vote-controls';

    // Show revoke buttons when in filtered views
    if (currentFilter === 'votes' && insight.user_vote) {
        // User is viewing their votes - show revoke button
        const revokeVoteBtn = document.createElement('button');
        revokeVoteBtn.className = 'revoke-btn';
        revokeVoteBtn.textContent = 'Revoke Vote';
        revokeVoteBtn.onclick = () => handleVote(insight.id, insight.user_vote); // Clicking same vote removes it
        voteControls.appendChild(revokeVoteBtn);
    } else if (currentFilter === 'shares' && insight.is_owner) {
        // User is viewing their shares - show unshare button
        const unshareBtn = document.createElement('button');
        unshareBtn.className = 'revoke-btn';
        unshareBtn.textContent = 'Unshare';
        unshareBtn.onclick = () => handleUnshare(insight.id);
        voteControls.appendChild(unshareBtn);
    } else {
        // Normal view - show vote buttons
        // Upvote button
        const upvoteBtn = document.createElement('button');
        upvoteBtn.className = 'vote-btn upvote';
        if (insight.user_vote === 'up') {
            upvoteBtn.classList.add('voted');
        }
        upvoteBtn.innerHTML = '👍';
        upvoteBtn.disabled = votesRemaining === 0 && !insight.user_vote;
        upvoteBtn.onclick = () => handleVote(insight.id, 'up');

        // Vote count
        const voteCount = document.createElement('span');
        voteCount.className = 'vote-count';
        if (insight.net_votes !== null && insight.net_votes !== undefined) {
            voteCount.textContent = insight.net_votes;
        } else {
            voteCount.textContent = '?';
            voteCount.classList.add('hidden');
        }

        // Downvote button
        const downvoteBtn = document.createElement('button');
        downvoteBtn.className = 'vote-btn downvote';
        if (insight.user_vote === 'down') {
            downvoteBtn.classList.add('voted');
        }
        downvoteBtn.innerHTML = '👎';
        downvoteBtn.disabled = votesRemaining === 0 && !insight.user_vote;
        downvoteBtn.onclick = () => handleVote(insight.id, 'down');

        voteControls.appendChild(upvoteBtn);
        voteControls.appendChild(voteCount);
        voteControls.appendChild(downvoteBtn);
    }

    footer.appendChild(remixBtn);
    footer.appendChild(voteControls);

    card.appendChild(dateBadge);
    card.appendChild(content);
    card.appendChild(footer);

    return card;
}

function toggleInsightContent(card, fullContent) {
    const contentDiv = card.querySelector('.insight-content');
    const moreLink = contentDiv.querySelector('.more-link');

    // Check if currently expanded
    const isExpanded = card.classList.contains('expanded');

    if (isExpanded) {
        // Collapse: show truncated content
        const truncatedContent = fullContent.substring(0, 800);
        if (typeof marked !== 'undefined' && marked.parse) {
            contentDiv.innerHTML = marked.parse(truncatedContent);
        } else {
            contentDiv.textContent = truncatedContent;
        }

        // Re-add "... more" link
        const newMoreLink = document.createElement('a');
        newMoreLink.href = '#';
        newMoreLink.className = 'more-link';
        newMoreLink.textContent = '... more';
        newMoreLink.onclick = (e) => {
            e.preventDefault();
            toggleInsightContent(card, fullContent);
        };
        contentDiv.appendChild(newMoreLink);

        card.classList.remove('expanded');
    } else {
        // Expand: show full content
        if (typeof marked !== 'undefined' && marked.parse) {
            contentDiv.innerHTML = marked.parse(fullContent);
        } else {
            contentDiv.textContent = fullContent;
        }

        // Add "... less" link
        const lessLink = document.createElement('a');
        lessLink.href = '#';
        lessLink.className = 'more-link';
        lessLink.textContent = '... less';
        lessLink.onclick = (e) => {
            e.preventDefault();
            toggleInsightContent(card, fullContent);
        };
        contentDiv.appendChild(lessLink);

        card.classList.add('expanded');
    }

    // Reinitialize icons if needed
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

async function handleVote(insightId, voteType) {
    const insight = insights.find(i => i.id === insightId);
    if (!insight) return;

    try {
        let data;

        // If already voted the same way, unvote
        if (insight.user_vote === voteType) {
            // Confirm before revoking vote
            const confirmed = await showConfirm('Remove your vote from this insight?', {
                confirmText: 'Remove Vote',
                confirmStyle: 'danger'
            });

            if (!confirmed) return;

            const response = await fetch(`/api/insights/${insightId}/vote`, {
                method: 'DELETE'
            });

            data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to remove vote');
            }

            votesRemaining = data.votes_remaining;
            insight.user_vote = null;
        } else {
            // Vote (or change vote)
            const response = await fetch(`/api/insights/${insightId}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ vote_type: voteType })
            });

            data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to vote');
            }

            votesRemaining = data.votes_remaining;
            insight.user_vote = voteType;
        }

        // Update UI
        const totalVotes = 3;
        votesUsed = totalVotes - votesRemaining;

        // Update vote counter in header
        const voteCountHeader = document.getElementById('votes-count-header');
        if (voteCountHeader) {
            voteCountHeader.textContent = `${votesUsed}/${totalVotes}`;
        }

        // Update vote counter in filter button (if on insights page)
        const voteCountElem = document.getElementById('votes-count');
        if (voteCountElem) {
            voteCountElem.textContent = `${votesUsed}/3`;
        }

        renderInsights();

    } catch (error) {
        showDialog(`Error: ${error.message}`, 'error');
    }
}

async function handleUnshare(insightId) {
    if (!await showConfirm('Remove this insight from the Insights Wall?', {
        confirmText: 'Remove',
        confirmStyle: 'danger'
    })) return;

    try {
        const response = await fetch(`/api/insights/${insightId}/unshare`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to unshare insight');
        }

        // Reload insights to update the list
        await loadInsights();

        // showDialog('Insight unshared successfully', 'success');
    } catch (error) {
        console.error('Error unsharing insight:', error);
        showDialog(`Error: ${error.message}`, 'error');
    }
}

function filterInsights(filter) {
    currentFilter = filter;
    console.log('Filtering insights by:', filter);

    // Update active button (only if filter buttons exist - they're on insights page, not chat)
    const filterButtons = document.querySelectorAll('.filter-btn');
    if (filterButtons.length > 0) {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`filter-${filter}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    // Re-render with filter
    renderInsights();
}

async function remixIdea(content) {
    // Switch to chat view
    if (typeof showChat === 'function') {
        showChat();
    } else {
        // If we're on insights.html (not chat page), navigate to chat
        window.location.href = '/chat';
        return;
    }

    // Always create a new thread for remixing
    if (typeof createNewThread === 'function') {
        await createNewThread();
    }

    // Set the content in the input box
    const input = document.getElementById('chat-input');
    if (input) {
        input.value = content;
        input.focus();

        // Auto-resize textarea
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
    }
}

// Load insights on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check for filter parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get('filter');

    if (filterParam && ['votes', 'shares'].includes(filterParam)) {
        currentFilter = filterParam;
        // Update active button
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`filter-${filterParam}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    loadInsights();
});
