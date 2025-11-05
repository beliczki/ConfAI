/**
 * Insights Wall - Client-side logic
 * Handles filtering, sorting, voting, and display of shared insights
 */

// Global state
let insights = [];
let votesUsed = 0;
let votesRemaining = 3;
let votesLimit = 3;  // Will be loaded from settings
let sharesUsed = 0;
let sharesLimit = 3;  // Will be loaded from settings
let showCounts = false;
let currentInsightsMode = 'all';  // 'all', 'myshares', or 'myvotes'

// Filter and sort state (persisted in sessionStorage)
let currentOwnershipFilter = 'all';
let currentVoteStatusFilter = 'all';
let currentSort = 'newest';
let autoSortEnabled = false;

// Session storage keys
const STORAGE_KEYS = {
    ownership: 'insights_filter_ownership',
    voteStatus: 'insights_filter_votes',
    sort: 'insights_sort',
    autoSort: 'insights_auto_sort_enabled'
};

/**
 * Load filters/sort from sessionStorage on page load
 */
function loadSessionState() {
    currentOwnershipFilter = sessionStorage.getItem(STORAGE_KEYS.ownership) || 'all';
    currentVoteStatusFilter = sessionStorage.getItem(STORAGE_KEYS.voteStatus) || 'all';
    currentSort = sessionStorage.getItem(STORAGE_KEYS.sort) || 'newest';
    autoSortEnabled = sessionStorage.getItem(STORAGE_KEYS.autoSort) === 'true';

    console.log('Loaded session state:', {
        ownership: currentOwnershipFilter,
        voteStatus: currentVoteStatusFilter,
        sort: currentSort,
        autoSort: autoSortEnabled
    });
}

/**
 * Save filter/sort state to sessionStorage
 */
function saveSessionState() {
    sessionStorage.setItem(STORAGE_KEYS.ownership, currentOwnershipFilter);
    sessionStorage.setItem(STORAGE_KEYS.voteStatus, currentVoteStatusFilter);
    sessionStorage.setItem(STORAGE_KEYS.sort, currentSort);
    sessionStorage.setItem(STORAGE_KEYS.autoSort, String(autoSortEnabled));
}

/**
 * Load insights from server with current filters
 */
async function loadInsights() {
    try {
        // Build query parameters
        const params = new URLSearchParams({
            filter_ownership: currentOwnershipFilter,
            filter_votes: currentVoteStatusFilter,
            sort_by: currentSort
        });

        const response = await fetch(`/api/insights?${params}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load insights');
        }

        insights = data.insights;
        votesRemaining = data.votes_remaining || 0;
        votesUsed = data.votes_used || 0;
        votesLimit = data.votes_limit || 3;
        sharesUsed = data.shares_used || 0;
        sharesLimit = data.shares_limit || 3;
        showCounts = data.show_counts || false;

        console.log('Loaded insights:', {
            count: insights.length,
            votesUsed,
            votesRemaining,
            sharesUsed,
            showCounts
        });

        // Update header message if present
        displayHeaderMessage(data.header_message);

        // Update UI counters
        updateCounters();

        // Show/hide vote-related controls
        updateVoteRelatedControls();

        // Render insights
        displayInsights();

    } catch (error) {
        console.error('Error loading insights:', error);
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.innerHTML = `<p style="color: #ff6b6b;">Error loading insights: ${error.message}</p>`;
        }
    }
}

/**
 * Display admin-configured header message (styled like welcome message)
 * Only shows on the main /insights page, not on /myshares or /myvotes
 */
function displayHeaderMessage(message) {
    const container = document.getElementById('header-message-container');
    if (!container) {
        console.error('header-message-container not found');
        return;
    }

    // Only show header message on the main insights page (mode 'all')
    if (currentInsightsMode !== 'all') {
        container.style.display = 'none';
        return;
    }

    if (message && message.trim()) {
        console.log('Header message received:', message.substring(0, 100));
        console.log('marked available:', typeof marked !== 'undefined');

        // Parse markdown and display - CSS handles all styling
        if (typeof marked !== 'undefined') {
            try {
                const parseFunction = marked.parse || marked;
                const parsed = parseFunction(message);
                console.log('Parsed HTML:', parsed.substring(0, 100));
                container.innerHTML = parsed;
            } catch (error) {
                console.error('Error parsing markdown:', error);
                container.textContent = message;
            }
        } else {
            console.warn('marked not available, using plain text');
            container.textContent = message;
        }
        container.style.display = 'block';
    } else {
        console.log('No header message to display');
        container.style.display = 'none';
    }
}

/**
 * Update vote and share counters
 */
function updateCounters() {
    // Insights page counters
    const voteCountEl = document.getElementById('votes-count');
    if (voteCountEl) {
        voteCountEl.textContent = `${votesUsed}/${votesLimit}`;
    }

    const shareCountEl = document.getElementById('shares-count');
    if (shareCountEl) {
        shareCountEl.textContent = `${sharesUsed}/${sharesLimit}`;
    }

    // Chat header counters (if present)
    const voteCountHeader = document.getElementById('votes-count-header');
    if (voteCountHeader) {
        voteCountHeader.textContent = `${votesUsed}/${votesLimit}`;
    }

    const shareCountHeader = document.getElementById('shares-count-header');
    if (shareCountHeader) {
        shareCountHeader.textContent = `${sharesUsed}/${sharesLimit}`;
    }
}

/**
 * Show/hide vote-related controls based on votes cast
 */
function updateVoteRelatedControls() {
    const hasVotedAll = votesUsed >= votesLimit;

    // Show/hide vote-based sort options in dropdown
    const dropdown = document.getElementById('sort-dropdown-menu');
    if (dropdown) {
        const voteBasedSorts = ['votes_desc', 'votes_asc', 'upvotes', 'controversial'];
        voteBasedSorts.forEach(sortType => {
            const item = dropdown.querySelector(`.sort-dropdown-item[data-sort="${sortType}"]`);
            if (item) {
                item.style.display = hasVotedAll ? 'block' : 'none';
            }
        });
    }

    // Update active button states and dropdown
    updateActiveButtons();
}

/**
 * Update active state for filter buttons and dropdown
 */
function updateActiveButtons() {
    // Ownership filter buttons
    document.querySelectorAll('button[data-ownership]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ownership === currentOwnershipFilter);
    });

    // Update sort dropdown
    const dropdown = document.getElementById('sort-dropdown');
    if (dropdown) {
        dropdown.value = currentSort;
    }
}

/**
 * Display insights grid
 */
function displayInsights() {
    const loadingEl = document.getElementById('loading');
    const emptyStateEl = document.getElementById('empty-state');
    const gridEl = document.getElementById('insights-grid');

    if (loadingEl) loadingEl.style.display = 'none';

    if (insights.length === 0) {
        if (emptyStateEl) emptyStateEl.style.display = 'block';
        if (gridEl) gridEl.style.display = 'none';
    } else {
        if (emptyStateEl) emptyStateEl.style.display = 'none';
        if (gridEl) {
            gridEl.style.display = 'grid';
            renderInsights();
        }
    }
}

/**
 * Filter insights based on text search
 * Searches through user name, date, title, and content
 */
function filterInsights(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        // No search term - show all insights
        displayInsights();
        return;
    }

    const term = searchTerm.toLowerCase().trim();

    // Filter insights based on search term
    const filteredInsights = insights.filter(insight => {
        // Search in user name
        if (insight.user_name && insight.user_name.toLowerCase().includes(term)) {
            return true;
        }

        // Search in formatted date
        const createdDate = new Date(insight.created_at);
        const formattedDate = createdDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).toLowerCase();
        if (formattedDate.includes(term)) {
            return true;
        }

        // Search in title
        if (insight.title && insight.title.toLowerCase().includes(term)) {
            return true;
        }

        // Search in content
        if (insight.content && insight.content.toLowerCase().includes(term)) {
            return true;
        }

        return false;
    });

    // Update grid with filtered results
    const loadingEl = document.getElementById('loading');
    const emptyStateEl = document.getElementById('empty-state');
    const gridEl = document.getElementById('insights-grid');

    if (loadingEl) loadingEl.style.display = 'none';

    if (filteredInsights.length === 0) {
        if (emptyStateEl) {
            emptyStateEl.innerHTML = '<h2>No matching insights found</h2><p>Try a different search term</p>';
            emptyStateEl.style.display = 'block';
        }
        if (gridEl) gridEl.style.display = 'none';
    } else {
        if (emptyStateEl) emptyStateEl.style.display = 'none';
        if (gridEl) {
            gridEl.style.display = 'grid';
            renderFilteredInsights(filteredInsights);
        }
    }
}

/**
 * Render filtered insights to grid
 */
function renderFilteredInsights(filteredInsights) {
    const grid = document.getElementById('insights-grid');
    if (!grid) return;

    grid.innerHTML = '';

    filteredInsights.forEach(insight => {
        const card = createInsightCard(insight);
        grid.appendChild(card);
    });

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
        setTimeout(() => lucide.createIcons(), 10);
        setTimeout(() => lucide.createIcons(), 100);
    }
}

/**
 * Render insights to grid
 */
function renderInsights() {
    const grid = document.getElementById('insights-grid');
    if (!grid) return;

    grid.innerHTML = '';

    insights.forEach(insight => {
        const card = createInsightCard(insight);
        grid.appendChild(card);
    });

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
        setTimeout(() => lucide.createIcons(), 10);
        setTimeout(() => lucide.createIcons(), 100);
    }
}

/**
 * Create insight card element
 */
function createInsightCard(insight) {
    const card = document.createElement('div');
    card.className = 'insight-card';
    card.dataset.insightId = insight.id;

    // Score header (if votes are visible)
    if (showCounts && insight.net_votes !== null && insight.net_votes !== undefined) {
        const scoreHeader = document.createElement('div');
        scoreHeader.className = 'insight-score-header';

        const scoreTitle = document.createElement('h2');
        scoreTitle.className = 'insight-score-title';
        scoreTitle.textContent = `Score: ${insight.net_votes > 0 ? '+' : ''}${insight.net_votes}`;

        scoreHeader.appendChild(scoreTitle);
        card.appendChild(scoreHeader);
    }

    // Header with user name (when votes visible) and date
    const header = document.createElement('div');
    header.className = 'insight-header';

    // Show user name badge when votes are visible (replacing old score badge position)
    if (showCounts && insight.user_name) {
        const userNameBadge = document.createElement('span');
        userNameBadge.className = 'insight-user-badge';
        userNameBadge.textContent = insight.user_name;
        header.appendChild(userNameBadge);
    }

    const dateBadge = document.createElement('div');
    dateBadge.className = 'insight-date-badge-header';
    const createdDate = new Date(insight.created_at);
    dateBadge.textContent = createdDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    header.appendChild(dateBadge);

    card.appendChild(header);

    // Title (if available)
    if (insight.title) {
        const titleElement = document.createElement('h3');
        titleElement.className = 'insight-title';
        titleElement.textContent = insight.title;
        card.appendChild(titleElement);
    }

    // Content
    const content = document.createElement('div');
    content.className = 'insight-content';

    const shouldTruncate = insight.content.length > 400;
    const displayContent = shouldTruncate ? insight.content.substring(0, 400) : insight.content;

    if (typeof marked !== 'undefined' && marked.parse) {
        content.innerHTML = marked.parse(displayContent);
    } else {
        content.textContent = displayContent;
    }

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

    // Footer with controls
    const footer = document.createElement('div');
    footer.className = 'insight-footer';

    const voteControls = document.createElement('div');
    voteControls.className = 'vote-controls';

    // Show different buttons based on insights mode
    if (currentInsightsMode === 'myshares') {
        // My Shares page - show unshare button
        const unshareBtn = document.createElement('button');
        unshareBtn.className = 'revoke-btn';
        unshareBtn.innerHTML = '<i data-lucide="x-circle"></i><span>Unshare</span>';
        unshareBtn.onclick = async () => {
            const confirmed = await showConfirm('Are you sure you want to unshare this insight?', {
                confirmText: 'Unshare',
                confirmStyle: 'danger'
            });
            if (confirmed) {
                await handleUnshare(insight.id);
            }
        };
        voteControls.appendChild(unshareBtn);
    } else if (currentInsightsMode === 'myvotes') {
        // My Votes page - show revoke button based on vote type
        const revokeBtn = document.createElement('button');
        revokeBtn.className = 'revoke-btn';

        if (insight.user_vote === 'up') {
            revokeBtn.innerHTML = '<i data-lucide="thumbs-up"></i><span>Revoke Like</span>';
        } else if (insight.user_vote === 'down') {
            revokeBtn.innerHTML = '<i data-lucide="thumbs-down"></i><span>Revoke Dislike</span>';
        }

        revokeBtn.onclick = async () => {
            const voteLabel = insight.user_vote === 'up' ? 'like' : 'dislike';
            const confirmed = await showConfirm(`Remove your ${voteLabel} from this insight?`, {
                confirmText: `Revoke ${voteLabel.charAt(0).toUpperCase() + voteLabel.slice(1)}`,
                confirmStyle: 'danger'
            });
            if (confirmed) {
                await handleRevokeVote(insight.id);
            }
        };

        voteControls.appendChild(revokeBtn);
    } else {
        // General insights wall - always show vote controls (no unshare button here)
        const upvoteBtn = document.createElement('button');
        upvoteBtn.className = 'vote-btn upvote';
        upvoteBtn.innerHTML = '👍';
        upvoteBtn.disabled = votesRemaining === 0 || insight.user_vote !== null;
        if (insight.user_vote === 'up') {
            upvoteBtn.classList.add('voted');
        }
        upvoteBtn.onclick = () => handleVote(insight.id, 'up');

        const downvoteBtn = document.createElement('button');
        downvoteBtn.className = 'vote-btn downvote';
        downvoteBtn.innerHTML = '👎';
        downvoteBtn.disabled = votesRemaining === 0 || insight.user_vote !== null;
        if (insight.user_vote === 'down') {
            downvoteBtn.classList.add('voted');
        }
        downvoteBtn.onclick = () => handleVote(insight.id, 'down');

        voteControls.appendChild(upvoteBtn);
        voteControls.appendChild(downvoteBtn);
    }

    // Only show remix button on general insights wall
    if (currentInsightsMode === 'all') {
        const remixBtn = document.createElement('button');
        remixBtn.className = 'remix-btn';
        remixBtn.innerHTML = '<i data-lucide="sparkles"></i><span>Remix this idea</span>';
        remixBtn.onclick = () => remixIdea(insight.content, insight.title);
        footer.appendChild(remixBtn);
    }

    footer.appendChild(voteControls);

    card.appendChild(content);
    card.appendChild(footer);

    return card;
}

/**
 * Toggle expand/collapse of insight content
 */
function toggleInsightContent(card, fullContent) {
    const contentDiv = card.querySelector('.insight-content');
    const isExpanded = card.classList.contains('expanded');

    if (isExpanded) {
        const truncatedContent = fullContent.substring(0, 400);
        if (typeof marked !== 'undefined' && marked.parse) {
            contentDiv.innerHTML = marked.parse(truncatedContent);
        } else {
            contentDiv.textContent = truncatedContent;
        }

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
        if (typeof marked !== 'undefined' && marked.parse) {
            contentDiv.innerHTML = marked.parse(fullContent);
        } else {
            contentDiv.textContent = fullContent;
        }

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

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

/**
 * Handle voting on an insight
 */
async function handleVote(insightId, voteType) {
    const insight = insights.find(i => i.id === insightId);
    if (!insight) return;

    try {
        const previousVotesUsed = votesUsed;
        let data;

        // If already voted the same way, unvote
        if (insight.user_vote === voteType) {
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
        }

        votesRemaining = data.votes_remaining;
        votesUsed = votesLimit - votesRemaining;

        // Check if user just reached vote limit
        const justReachedLimit = previousVotesUsed < votesLimit && votesUsed === votesLimit;

        // Reload insights first
        await loadInsights();

        // Show dialog if user just reached vote limit, then auto-sort on close
        if (justReachedLimit) {
            await showDialog('You have cast all your votes! Now you can see which insights have the most votes.', 'success');
            // After dialog is closed, auto-sort by most voted
            currentSort = 'votes_desc';
            saveSessionState();
            await loadInsights();
        }

    } catch (error) {
        showDialog(`Error: ${error.message}`, 'error');
    }
}

/**
 * Handle unsharing an insight
 */
async function handleUnshare(insightId) {
    try {
        const response = await fetch(`/api/insights/${insightId}/unshare`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to unshare insight');
        }

        sharesUsed = 3 - data.shares_remaining;
        updateCounters();

        // Reload insights to reflect changes
        await loadInsights();

        showDialog('Insight unshared successfully', 'success');

    } catch (error) {
        showDialog(`Error: ${error.message}`, 'error');
    }
}

/**
 * Handle revoking a vote on an insight (for /myvotes page)
 */
async function handleRevokeVote(insightId) {
    try {
        const response = await fetch(`/api/insights/${insightId}/vote`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to remove vote');
        }

        votesRemaining = data.votes_remaining;
        votesUsed = votesLimit - votesRemaining;
        updateCounters();

        // Reload insights to reflect changes
        await loadInsights();

        showDialog('Vote removed successfully', 'success');

    } catch (error) {
        showDialog(`Error: ${error.message}`, 'error');
    }
}

/**
 * Update ownership filter
 */
function updateOwnershipFilter(filter) {
    currentOwnershipFilter = filter;
    saveSessionState();
    loadInsights();
}

/**
 * Update vote status filter
 */
function updateVoteStatusFilter(filter) {
    currentVoteStatusFilter = filter;
    saveSessionState();
    loadInsights();
}

/**
 * Update sort order
 */
function updateSort(sort) {
    currentSort = sort;
    saveSessionState();
    loadInsights();
}

/**
 * Toggle sort dropdown menu
 */
function toggleSortDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('sort-dropdown-menu');
    const isOpen = dropdown.classList.contains('show');

    // Close all dropdowns first
    document.querySelectorAll('.sort-dropdown-menu.show').forEach(d => d.classList.remove('show'));

    if (!isOpen) {
        dropdown.classList.add('show');

        // Close dropdown when clicking outside
        setTimeout(() => {
            document.addEventListener('click', closeSortDropdown, { once: true });
        }, 0);
    }
}

function closeSortDropdown() {
    document.querySelectorAll('.sort-dropdown-menu.show').forEach(d => d.classList.remove('show'));
}

/**
 * Select a sort option
 */
function selectSort(sortValue, sortLabel) {
    // Update the displayed sort name
    const currentSortName = document.getElementById('current-sort-name');
    if (currentSortName) {
        currentSortName.textContent = sortLabel;
    }

    // Update active state in dropdown
    document.querySelectorAll('.sort-dropdown-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-sort="${sortValue}"]`)?.classList.add('active');

    // Close dropdown
    closeSortDropdown();

    // Update sort
    updateSort(sortValue);

    // Reinitialize icons
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// toggleAutoSort function removed - auto-sort happens automatically on dialog close

/**
 * Remix an insight into a new chat
 */
async function remixIdea(content, title = null) {
    // Switch to chat view
    if (typeof showChat === 'function') {
        await showChat();
    } else {
        // If we're on insights.html (not chat page), navigate to chat
        window.location.href = '/chat';
        return;
    }

    // Always create a new thread for remixing
    if (typeof createNewThread === 'function') {
        await createNewThread();
    }

    // Format the remix text with title if available
    let remixText = content;
    if (title) {
        remixText = `# ${title}\n\n${content}`;
    }

    // Set the content in the input box
    const input = document.getElementById('chat-input');
    if (input) {
        input.value = remixText;
        input.focus();

        // Auto-resize textarea up to max-height (354px)
        input.style.height = 'auto';
        const newHeight = Math.min(input.scrollHeight, 354);
        input.style.height = newHeight + 'px';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on an insights page
    if (typeof initialView !== 'undefined' && initialView === 'insights') {
        console.log('Insights page detected, mode:', insightsMode);

        // Set insights mode from backend
        if (typeof insightsMode !== 'undefined' && insightsMode) {
            currentInsightsMode = insightsMode;

            // Set appropriate filter based on mode
            if (insightsMode === 'myshares') {
                currentOwnershipFilter = 'mine';
                const titleEl = document.getElementById('main-title');
                if (titleEl) titleEl.textContent = 'My Shared Insights';
                // Hide elements on dedicated page
                const filterControls = document.querySelector('.filter-sort-controls');
                if (filterControls) filterControls.style.display = 'none';
                const headerMessage = document.getElementById('header-message-container');
                if (headerMessage) headerMessage.style.display = 'none';
                const votesInfo = document.querySelector('.header-controls');
                if (votesInfo) votesInfo.style.display = 'none';
            } else if (insightsMode === 'myvotes') {
                currentOwnershipFilter = 'voted';
                const titleEl = document.getElementById('main-title');
                if (titleEl) titleEl.textContent = 'My Voted Insights';
                // Hide elements on dedicated page
                const filterControls = document.querySelector('.filter-sort-controls');
                if (filterControls) filterControls.style.display = 'none';
                const headerMessage = document.getElementById('header-message-container');
                if (headerMessage) headerMessage.style.display = 'none';
                const votesInfo = document.querySelector('.header-controls');
                if (votesInfo) votesInfo.style.display = 'none';
            } else {
                currentOwnershipFilter = 'all';
                const titleEl = document.getElementById('main-title');
                if (titleEl) titleEl.textContent = 'Insights Wall';
                // Hide votes info, show header message and filters on general wall
                const filterControls = document.querySelector('.filter-sort-controls');
                if (filterControls) filterControls.style.display = 'flex';
                const votesInfo = document.querySelector('.header-controls');
                if (votesInfo) votesInfo.style.display = 'none';
            }

            // FORCE show insights view immediately
            const chatContent = document.getElementById('chat-content');
            const insightsContent = document.getElementById('insights-content');
            if (chatContent) chatContent.style.display = 'none';
            if (insightsContent) insightsContent.style.display = 'block';

            console.log('Insights view should now be visible');
        }

        // Load session state ONLY if on main insights page (not dedicated pages)
        // Dedicated pages (myshares/myvotes) have fixed filters that shouldn't be overridden
        if (insightsMode === 'all' || !insightsMode) {
            loadSessionState();
        }

        // Load insights
        loadInsights();
    } else {
        // Only load insights if explicitly requested (not on insights page)
        console.log('Not an insights page, skipping insights load');
    }
});
