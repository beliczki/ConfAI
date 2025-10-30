"""Chat routes with LLM integration."""
from flask import Blueprint, render_template, request, jsonify, session, Response
from app.utils.helpers import login_required, sanitize_input
from app.models import ChatThread, ChatMessage, Settings, ActivityLog, TokenUsage
from app.services.llm_service import llm_service
from app.services.embedding_service import embedding_service
import json
import os

chat_bp = Blueprint('chat', __name__)


@chat_bp.route('/chat')
@login_required
def chat_page():
    """Main chat interface."""
    return render_template('chat.html')


@chat_bp.route('/api/welcome', methods=['GET'])
@login_required
def get_welcome_message():
    """Get the welcome message."""
    welcome_message = Settings.get('welcome_message', '# Welcome to ConfAI!\n\nStart a new chat to begin.')
    return jsonify({
        'welcome_message': welcome_message
    })


@chat_bp.route('/api/config', methods=['GET'])
@login_required
def get_config():
    """Get application configuration including LLM provider."""
    # Get provider from database settings (persistent across all processes)
    provider = Settings.get('llm_provider', os.getenv('LLM_PROVIDER', 'gemini')).lower()

    # Map provider names to display names
    provider_names = {
        'claude': 'Claude',
        'gemini': 'Gemini',
        'grok': 'Grok',
        'perplexity': 'Perplexity'
    }

    return jsonify({
        'provider': provider,
        'provider_name': provider_names.get(provider, provider.title())
    })


@chat_bp.route('/api/config', methods=['POST'])
@login_required
def update_config():
    """Update application configuration (LLM provider)."""
    data = request.json
    provider = data.get('provider', '').lower()

    # Validate provider
    valid_providers = ['claude', 'gemini', 'grok', 'perplexity']
    if provider not in valid_providers:
        return jsonify({'error': 'Invalid provider'}), 400

    try:
        # Store provider in database (persistent across all Flask processes)
        Settings.set('llm_provider', provider)

        print(f"Model switched to: {provider} (stored in database)")

        # Map provider names to display names
        provider_names = {
            'claude': 'Claude',
            'gemini': 'Gemini',
            'grok': 'Grok',
            'perplexity': 'Perplexity'
        }

        return jsonify({
            'success': True,
            'provider': provider,
            'provider_name': provider_names.get(provider, provider.title()),
            'message': f'Switched to {provider_names[provider]}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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

    # Get current model from settings
    current_model = Settings.get('llm_provider', os.getenv('LLM_PROVIDER', 'gemini')).lower()

    # Map model names
    model_names = {
        'claude': 'Claude',
        'gemini': 'Gemini',
        'grok': 'Grok',
        'perplexity': 'Perplexity'
    }
    model_display_name = model_names.get(current_model, current_model.title())

    thread_id = ChatThread.create(user_id, title, current_model)

    # Log activity (user name will be added by the display logic)
    ActivityLog.log(
        user_id,
        'thread_created',
        f'started a {model_display_name} conversation',
        json.dumps({'model': current_model, 'thread_id': thread_id})
    )

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


@chat_bp.route('/api/chat/stream', methods=['POST'])
@login_required
def stream_message():
    """Stream AI response using Server-Sent Events."""
    data = request.json
    thread_id = data.get('thread_id')
    message = data.get('message', '')

    if not thread_id or not message:
        def error_gen():
            yield f"data: {json.dumps({'error': 'Thread ID and message are required', 'done': True})}\n\n"
        return Response(error_gen(), mimetype='text/event-stream')

    # Verify ownership
    thread = ChatThread.get_by_id(thread_id)
    if not thread or thread['user_id'] != session['user_id']:
        def error_gen():
            yield f"data: {json.dumps({'error': 'Thread not found', 'done': True})}\n\n"
        return Response(error_gen(), mimetype='text/event-stream')

    # Sanitize input
    message = sanitize_input(message)

    # Store user message
    ChatMessage.create(thread_id, 'user', message)

    # Get conversation history for context
    messages_history = ChatMessage.get_by_thread(thread_id)
    conversation = [
        {'role': m['role'], 'content': m['content']}
        for m in messages_history[-10:]  # Last 10 messages for context
    ]

    # Get relevant context from embeddings (if available)
    context = embedding_service.search_context(message)

    def generate():
        """Generator for streaming response."""
        try:
            # Get current model
            current_model = Settings.get('llm_provider', os.getenv('LLM_PROVIDER', 'gemini')).lower()

            # Get streaming response from LLM
            # The provider will be read from database each time
            full_response = ""
            result = llm_service.generate_response(
                messages=conversation,
                context=context,
                stream=True
            )

            # Check if we got a string (error) or iterator
            if isinstance(result, str):
                # Error message, send as single chunk
                yield f"data: {json.dumps({'content': result, 'done': True})}\n\n"
                ChatMessage.create(thread_id, 'assistant', result)
            elif isinstance(result, tuple):
                # Tuple of (stream, usage_callback)
                stream, get_usage = result

                # Stream the response
                for chunk in stream:
                    full_response += chunk
                    yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"

                # Store complete AI response and get message ID
                message_id = None
                if full_response:
                    message_id = ChatMessage.create(thread_id, 'assistant', full_response)

                    # Get usage stats and log tokens
                    try:
                        usage = get_usage()
                        if usage:
                            TokenUsage.log(
                                thread_id=thread_id,
                                message_id=message_id,
                                model_used=current_model,
                                input_tokens=usage.get('input_tokens', 0),
                                output_tokens=usage.get('output_tokens', 0),
                                cache_creation_tokens=usage.get('cache_creation_tokens', 0),
                                cache_read_tokens=usage.get('cache_read_tokens', 0)
                            )
                    except Exception as token_err:
                        print(f"Error logging tokens: {token_err}")

                # Send completion signal with message ID
                yield f"data: {json.dumps({'content': '', 'done': True, 'message_id': message_id})}\n\n"
            else:
                # Old format - just an iterator
                for chunk in result:
                    full_response += chunk
                    yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"

                # Store complete AI response and get message ID
                message_id = None
                if full_response:
                    message_id = ChatMessage.create(thread_id, 'assistant', full_response)

                # Send completion signal with message ID
                yield f"data: {json.dumps({'content': '', 'done': True, 'message_id': message_id})}\n\n"

        except Exception as e:
            error_msg = f"Sorry, I encountered an error: {str(e)}"
            yield f"data: {json.dumps({'content': error_msg, 'done': True})}\n\n"
            ChatMessage.create(thread_id, 'assistant', error_msg)

    return Response(generate(), mimetype='text/event-stream')
