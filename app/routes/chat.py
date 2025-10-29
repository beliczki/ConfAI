"""Chat routes - placeholder for implementation."""
from flask import Blueprint, render_template, request, jsonify, session, Response
from app.utils.helpers import login_required, sanitize_input
from app.models import ChatThread, ChatMessage
import json

chat_bp = Blueprint('chat', __name__)


@chat_bp.route('/chat')
@login_required
def chat_page():
    """Main chat interface."""
    return render_template('chat.html')


@chat_bp.route('/api/threads', methods=['GET'])
@login_required
def get_threads():
    """Get user's chat threads."""
    user_id = session['user_id']
    threads = ChatThread.get_by_user(user_id)

    return jsonify({
        'threads': [
            {
                'id': t['id'],
                'title': t['title'],
                'created_at': t['created_at'],
                'updated_at': t['updated_at']
            } for t in threads
        ]
    })


@chat_bp.route('/api/threads', methods=['POST'])
@login_required
def create_thread():
    """Create a new chat thread."""
    user_id = session['user_id']
    title = request.json.get('title', 'New Chat')

    thread_id = ChatThread.create(user_id, title)

    return jsonify({
        'success': True,
        'thread_id': thread_id
    })


@chat_bp.route('/api/threads/<int:thread_id>', methods=['DELETE'])
@login_required
def delete_thread(thread_id):
    """Delete a chat thread."""
    # Verify ownership
    thread = ChatThread.get_by_id(thread_id)
    if not thread or thread['user_id'] != session['user_id']:
        return jsonify({'error': 'Thread not found'}), 404

    ChatThread.delete(thread_id)

    return jsonify({'success': True})


@chat_bp.route('/api/threads/<int:thread_id>/messages', methods=['GET'])
@login_required
def get_messages(thread_id):
    """Get messages for a thread."""
    # Verify ownership
    thread = ChatThread.get_by_id(thread_id)
    if not thread or thread['user_id'] != session['user_id']:
        return jsonify({'error': 'Thread not found'}), 404

    messages = ChatMessage.get_by_thread(thread_id)

    return jsonify({
        'messages': [
            {
                'id': m['id'],
                'role': m['role'],
                'content': m['content'],
                'created_at': m['created_at']
            } for m in messages
        ]
    })


@chat_bp.route('/api/chat', methods=['POST'])
@login_required
def send_message():
    """Send a message and get streaming response."""
    data = request.json
    thread_id = data.get('thread_id')
    message = data.get('message', '')

    if not thread_id or not message:
        return jsonify({'error': 'Thread ID and message are required'}), 400

    # Verify ownership
    thread = ChatThread.get_by_id(thread_id)
    if not thread or thread['user_id'] != session['user_id']:
        return jsonify({'error': 'Thread not found'}), 404

    # Sanitize input
    message = sanitize_input(message)

    # Store user message
    ChatMessage.create(thread_id, 'user', message)

    # TODO: Call LLM service for response (placeholder)
    # For now, return a simple response
    ai_response = "Hello! I'm your AI assistant. Full LLM integration coming soon!"

    # Store AI response
    ChatMessage.create(thread_id, 'assistant', ai_response)

    return jsonify({
        'success': True,
        'response': ai_response
    })


# TODO: Implement SSE streaming endpoint
@chat_bp.route('/api/chat/stream', methods=['POST'])
@login_required
def stream_message():
    """Stream AI response using Server-Sent Events."""
    def generate():
        # TODO: Implement streaming from LLM
        yield f"data: {json.dumps({'content': 'Streaming coming soon!', 'done': True})}\n\n"

    return Response(generate(), mimetype='text/event-stream')
