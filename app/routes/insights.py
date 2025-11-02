"""Insights wall routes."""
from flask import Blueprint, render_template, request, jsonify, session
from app.utils.helpers import login_required, sanitize_input
from app.models import Insight, get_db
import os
import google.generativeai as genai

insights_bp = Blueprint('insights', __name__)

VOTES_PER_USER = int(os.getenv('VOTES_PER_USER', 3))

# Configure Gemini
gemini_key = os.getenv('GEMINI_API_KEY')
if gemini_key:
    genai.configure(api_key=gemini_key)


def generate_insight_title(content):
    """Generate a 5-7 word title for an insight using Gemini."""
    if not gemini_key:
        return None

    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        prompt = f"""Generate a concise, catchy title for this insight. The title must be exactly 5-7 words.
Do not use quotation marks. Just provide the title.

Insight content:
{content[:500]}"""

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=30,
                temperature=0.7,
            )
        )
        title = response.text.strip().strip('"\'')
        # Ensure title is not too long
        if len(title) > 60:
            title = title[:57] + '...'
        return title
    except Exception as e:
        print(f"Error generating insight title: {e}")
        return None


@insights_bp.route('/insights')
@login_required
def insights_page():
    """Insights wall page."""
    return render_template('insights.html')


@insights_bp.route('/api/insights', methods=['GET'])
@login_required
def get_insights():
    """Get all insights."""
    insights = Insight.get_all()
    user_id = session['user_id']
    user_votes_used = Insight.get_user_vote_count(user_id)
    shares_used = Insight.get_user_share_count(user_id)

    # Get user's votes to show which insights they voted on
    user_votes = {}
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT insight_id, vote_type FROM votes WHERE user_id = ?', (user_id,))
        for row in cursor.fetchall():
            user_votes[row['insight_id']] = row['vote_type']

    # Only show vote counts if user has used all 3 votes
    show_counts = user_votes_used >= VOTES_PER_USER

    return jsonify({
        'insights': [
            {
                'id': i['id'],
                'title': i['title'] if 'title' in i.keys() else None,
                'content': i['content'],
                'user_name': i['user_name'],
                'avatar_gradient': i['avatar_gradient'],
                'upvotes': i['upvotes'] if show_counts else None,
                'downvotes': i['downvotes'] if show_counts else None,
                'net_votes': i['net_votes'] if show_counts else None,
                'created_at': i['created_at'],
                'user_vote': user_votes.get(i['id']),
                'is_owner': i['user_id'] == user_id
            } for i in insights
        ],
        'votes_used': user_votes_used,
        'votes_remaining': VOTES_PER_USER - user_votes_used,
        'shares_used': shares_used,
        'show_counts': show_counts
    })


@insights_bp.route('/api/insights', methods=['POST'])
@login_required
def create_insight():
    """Share a new insight."""
    content = request.json.get('content', '')
    message_id = request.json.get('message_id')

    if not content:
        return jsonify({'error': 'Content is required'}), 400

    user_id = session['user_id']

    # Check if user has reached the share limit (max 3)
    share_count = Insight.get_user_share_count(user_id)
    if share_count >= 3:
        return jsonify({'error': 'You have reached the maximum of 3 shared insights. Please unshare one to share another.'}), 400

    # Check if this message is already shared by this user
    if message_id:
        existing = Insight.get_by_message_id(message_id, user_id)
        if existing:
            return jsonify({'error': 'You have already shared this message'}), 400

    content = sanitize_input(content, max_length=10000)

    # Generate title using Gemini
    title = generate_insight_title(content)

    insight_id = Insight.create(user_id, content, message_id, title)

    return jsonify({
        'success': True,
        'insight_id': insight_id,
        'title': title,
        'shares_remaining': 2 - share_count
    })


@insights_bp.route('/api/insights/<int:insight_id>/vote', methods=['POST'])
@login_required
def vote_insight(insight_id):
    """Vote on an insight (up or down)."""
    vote_type = request.json.get('vote_type')  # 'up' or 'down'

    if vote_type not in ['up', 'down']:
        return jsonify({'error': 'Invalid vote type'}), 400

    user_id = session['user_id']

    # Check vote limit
    user_votes_used = Insight.get_user_vote_count(user_id)
    if user_votes_used >= VOTES_PER_USER:
        return jsonify({'error': 'You have used all your votes'}), 400

    success, message = Insight.vote(insight_id, user_id, vote_type)

    if not success:
        return jsonify({'error': message}), 400

    return jsonify({
        'success': True,
        'message': message,
        'votes_remaining': VOTES_PER_USER - (user_votes_used + 1)
    })


@insights_bp.route('/api/insights/<int:insight_id>/vote', methods=['DELETE'])
@login_required
def remove_vote(insight_id):
    """Remove a vote from an insight."""
    user_id = session['user_id']

    with get_db() as conn:
        cursor = conn.cursor()

        # Check if user has voted on this insight
        cursor.execute(
            'SELECT vote_type FROM votes WHERE user_id = ? AND insight_id = ?',
            (user_id, insight_id)
        )
        existing_vote = cursor.fetchone()

        if not existing_vote:
            return jsonify({'error': 'You have not voted on this insight'}), 400

        vote_type = existing_vote['vote_type']

        # Remove vote from votes table
        cursor.execute(
            'DELETE FROM votes WHERE user_id = ? AND insight_id = ?',
            (user_id, insight_id)
        )

        # Update insight vote counts
        if vote_type == 'up':
            cursor.execute(
                'UPDATE insights SET upvotes = upvotes - 1 WHERE id = ?',
                (insight_id,)
            )
        else:
            cursor.execute(
                'UPDATE insights SET downvotes = downvotes - 1 WHERE id = ?',
                (insight_id,)
            )

        # Update user vote count
        cursor.execute(
            'UPDATE user_vote_counts SET votes_used = votes_used - 1 WHERE user_id = ?',
            (user_id,)
        )

        conn.commit()

    user_votes_used = Insight.get_user_vote_count(user_id)

    return jsonify({
        'success': True,
        'message': 'Vote removed',
        'votes_remaining': VOTES_PER_USER - user_votes_used
    })


@insights_bp.route('/api/insights/<int:insight_id>/unshare', methods=['DELETE'])
@login_required
def unshare_insight(insight_id):
    """Unshare/revoke an insight (user can only unshare their own)."""
    user_id = session['user_id']

    success = Insight.delete_by_user(insight_id, user_id)
    if success:
        share_count = Insight.get_user_share_count(user_id)
        return jsonify({
            'success': True,
            'message': 'Insight unshared successfully',
            'shares_remaining': 3 - share_count
        })
    else:
        return jsonify({'error': 'Insight not found or you do not have permission to unshare it'}), 404


@insights_bp.route('/api/insights/check', methods=['POST'])
@login_required
def check_shared_messages():
    """Check which messages in a thread are shared by the current user."""
    message_ids = request.json.get('message_ids', [])
    user_id = session['user_id']

    if not message_ids:
        return jsonify({'shared_messages': {}, 'share_count': 0})

    shared_messages = {}
    with get_db() as conn:
        cursor = conn.cursor()
        placeholders = ','.join('?' * len(message_ids))
        cursor.execute(
            f'SELECT id, message_id FROM insights WHERE user_id = ? AND message_id IN ({placeholders})',
            [user_id] + message_ids
        )
        for row in cursor.fetchall():
            shared_messages[row['message_id']] = row['id']

    share_count = Insight.get_user_share_count(user_id)

    return jsonify({
        'shared_messages': shared_messages,
        'share_count': share_count,
        'shares_remaining': 3 - share_count
    })
