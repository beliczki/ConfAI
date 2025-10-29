"""Insights wall routes."""
from flask import Blueprint, render_template, request, jsonify, session
from app.utils.helpers import login_required, sanitize_input
from app.models import Insight
import os

insights_bp = Blueprint('insights', __name__)

VOTES_PER_USER = int(os.getenv('VOTES_PER_USER', 3))


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

    # Only show vote counts if user has used all 3 votes
    show_counts = user_votes_used >= VOTES_PER_USER

    return jsonify({
        'insights': [
            {
                'id': i['id'],
                'content': i['content'],
                'user_name': i['user_name'],
                'avatar_gradient': i['avatar_gradient'],
                'upvotes': i['upvotes'] if show_counts else None,
                'downvotes': i['downvotes'] if show_counts else None,
                'net_votes': i['net_votes'] if show_counts else None,
                'created_at': i['created_at']
            } for i in insights
        ],
        'votes_used': user_votes_used,
        'votes_remaining': VOTES_PER_USER - user_votes_used,
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

    content = sanitize_input(content, max_length=1000)

    user_id = session['user_id']
    insight_id = Insight.create(user_id, content, message_id)

    return jsonify({
        'success': True,
        'insight_id': insight_id
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
