let votesRemaining = 3;
let insights = [];

async function loadInsights() {
    try {
        const response = await fetch('/api/insights');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load insights');
        }

        insights = data.insights;
        votesRemaining = data.user_votes_remaining;

        // Update UI
        document.getElementById('votes-count').textContent = votesRemaining;
        document.getElementById('loading').style.display = 'none';

        if (insights.length === 0) {
            document.getElementById('empty-state').style.display = 'block';
        } else {
            document.getElementById('insights-grid').style.display = 'grid';
            renderInsights();
        }
    } catch (error) {
        console.error('Error loading insights:', error);
        document.getElementById('loading').innerHTML =
            `<p style="color: var(--error);">Error loading insights: ${error.message}</p>`;
    }
}

function renderInsights() {
    const grid = document.getElementById('insights-grid');
    grid.innerHTML = '';

    insights.forEach(insight => {
        const card = createInsightCard(insight);
        grid.appendChild(card);
    });
}

function createInsightCard(insight) {
    const card = document.createElement('div');
    card.className = 'insight-card';
    card.dataset.insightId = insight.id;

    const content = document.createElement('div');
    content.className = 'insight-content';
    content.textContent = insight.content;

    const footer = document.createElement('div');
    footer.className = 'insight-footer';

    const date = document.createElement('div');
    date.className = 'insight-date';
    const createdDate = new Date(insight.created_at);
    date.textContent = createdDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const voteControls = document.createElement('div');
    voteControls.className = 'vote-controls';

    // Upvote button
    const upvoteBtn = document.createElement('button');
    upvoteBtn.className = 'vote-btn upvote';
    if (insight.user_vote === 'upvote') {
        upvoteBtn.classList.add('voted');
    }
    upvoteBtn.innerHTML = '👍';
    upvoteBtn.disabled = votesRemaining === 0 && !insight.user_vote;
    upvoteBtn.onclick = () => handleVote(insight.id, 'upvote');

    // Vote count
    const voteCount = document.createElement('span');
    voteCount.className = 'vote-count';
    if (insight.show_count) {
        voteCount.textContent = insight.vote_count;
    } else {
        voteCount.textContent = '?';
        voteCount.classList.add('hidden');
    }

    // Downvote button
    const downvoteBtn = document.createElement('button');
    downvoteBtn.className = 'vote-btn downvote';
    if (insight.user_vote === 'downvote') {
        downvoteBtn.classList.add('voted');
    }
    downvoteBtn.innerHTML = '👎';
    downvoteBtn.disabled = votesRemaining === 0 && !insight.user_vote;
    downvoteBtn.onclick = () => handleVote(insight.id, 'downvote');

    voteControls.appendChild(upvoteBtn);
    voteControls.appendChild(voteCount);
    voteControls.appendChild(downvoteBtn);

    footer.appendChild(date);
    footer.appendChild(voteControls);

    card.appendChild(content);
    card.appendChild(footer);

    return card;
}

async function handleVote(insightId, voteType) {
    const insight = insights.find(i => i.id === insightId);
    if (!insight) return;

    try {
        // If already voted the same way, unvote
        if (insight.user_vote === voteType) {
            const response = await fetch(`/api/insights/${insightId}/vote`, {
                method: 'DELETE'
            });

            const data = await response.json();
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

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to vote');
            }

            votesRemaining = data.votes_remaining;
            insight.user_vote = voteType;
        }

        // Update UI
        document.getElementById('votes-count').textContent = votesRemaining;
        renderInsights();

    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Load insights on page load
document.addEventListener('DOMContentLoaded', () => {
    loadInsights();
});
