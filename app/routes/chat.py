"""Chat routes with LLM integration."""
from flask import Blueprint, render_template, request, jsonify, session, Response
from app.utils.helpers import login_required, api_login_required, sanitize_input
from app.models import ChatThread, ChatMessage, Settings, ActivityLog, TokenUsage
from app.services.llm_service import llm_service
from app.services.embedding_service import embedding_service
import json
import os
from datetime import datetime

chat_bp = Blueprint('chat', __name__)


@chat_bp.route('/chat')
@chat_bp.route('/chat/<hash_id>')
@login_required
def chat_page(hash_id=None):
    """Main chat interface."""
    return render_template('chat.html', hash_id=hash_id)


@chat_bp.route('/api/welcome', methods=['GET'])
@api_login_required
def get_welcome_message():
    """Get the welcome message."""
    welcome_message = Settings.get('welcome_message', '# Welcome to ConfAI!\n\nStart a new chat to begin.')
    return jsonify({
        'welcome_message': welcome_message
    })


@chat_bp.route('/api/conversation-starters', methods=['GET'])
@api_login_required
def get_conversation_starters():
    """Get conversation starters for empty chats."""
    starters = [
        Settings.get('starter_1', 'Ask 3 questions about me so you can personalize the conference content to me...'),
        Settings.get('starter_2', 'Tell me what 3 thoughts should I remember from this conference? Think of 12 candidates and then boil it down to 3 for me.'),
        Settings.get('starter_3', 'How can my marketing team be future proof? How the conference helps me to answer?'),
        Settings.get('starter_4', 'I have a hypothesis based on what I heard at the conference, can you help me validating?')
    ]
    return jsonify({
        'starters': starters
    })


@chat_bp.route('/api/new-chat-text', methods=['GET'])
@api_login_required
def get_new_chat_text():
    """Get the new chat instructions text."""
    new_chat_text = Settings.get('new_chat_text', 'Start the conversation!\n\nAsk me anything about the conference materials.')
    return jsonify({
        'text': new_chat_text
    })


@chat_bp.route('/api/config', methods=['GET'])
@api_login_required
def get_config():
    """Get application configuration including LLM provider."""
    # Get provider from session first (per-user), then fall back to env default
    provider = session.get('preferred_model', os.getenv('LLM_PROVIDER', 'gemini')).lower()

    # Map provider names to display names
    provider_names = {
        'claude': 'Claude',
        'gemini': 'Gemini',
        'grok': 'Grok',
        'perplexity': 'Perplexity'
    }

    # Check which providers are configured (have API keys)
    available_providers = {
        'claude': bool(os.getenv('ANTHROPIC_API_KEY')),
        'gemini': bool(os.getenv('GEMINI_API_KEY')),
        'grok': bool(os.getenv('GROK_API_KEY')),
        'perplexity': bool(os.getenv('PERPLEXITY_API_KEY'))
    }

    return jsonify({
        'provider': provider,
        'provider_name': provider_names.get(provider, provider.title()),
        'available_providers': available_providers
    })


@chat_bp.route('/api/config', methods=['POST'])
@api_login_required
def update_config():
    """Update application configuration (LLM provider)."""
    data = request.json
    provider = data.get('provider', '').lower()

    # Validate provider
    valid_providers = ['claude', 'gemini', 'grok', 'perplexity']
    if provider not in valid_providers:
        return jsonify({'error': 'Invalid provider'}), 400

    try:
        # Store provider in user's session (per-user preference)
        session['preferred_model'] = provider

        print(f"Model switched to: {provider} for user {session.get('email')} (stored in session)")

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
@api_login_required
def get_threads():
    """Get user's chat threads."""
    user_id = session['user_id']
    threads = ChatThread.get_by_user(user_id)

    return jsonify({
        'threads': [
            {
                'id': t['id'],
                'hash_id': t['hash_id'] if 'hash_id' in t.keys() else None,
                'title': t['title'],
                'created_at': t['created_at'],
                'updated_at': t['updated_at']
            } for t in threads
        ]
    })


@chat_bp.route('/api/threads', methods=['POST'])
@api_login_required
def create_thread():
    """Create a new chat thread."""
    user_id = session['user_id']
    title = request.json.get('title', 'New Chat')

    # Get current model from user's session
    current_model = session.get('preferred_model', os.getenv('LLM_PROVIDER', 'gemini')).lower()

    # Map model names
    model_names = {
        'claude': 'Claude',
        'gemini': 'Gemini',
        'grok': 'Grok',
        'perplexity': 'Perplexity'
    }
    model_display_name = model_names.get(current_model, current_model.title())

    thread_id, hash_id = ChatThread.create(user_id, title, current_model)

    # Log activity (user name will be added by the display logic)
    ActivityLog.log(
        user_id,
        'thread_created',
        f'started a {model_display_name} conversation',
        json.dumps({'model': current_model, 'thread_id': thread_id})
    )

    return jsonify({
        'success': True,
        'thread_id': thread_id,
        'hash_id': hash_id
    })


@chat_bp.route('/api/threads/<int:thread_id>', methods=['DELETE'])
@api_login_required
def delete_thread(thread_id):
    """Delete a chat thread."""
    # Verify ownership
    thread = ChatThread.get_by_id(thread_id)
    if not thread or thread['user_id'] != session['user_id']:
        return jsonify({'error': 'Thread not found'}), 404

    ChatThread.delete(thread_id)

    return jsonify({'success': True})


@chat_bp.route('/api/threads/<int:thread_id>/rename', methods=['POST'])
@api_login_required
def auto_rename_thread(thread_id):
    """Auto-rename thread using Gemini based on user prompts."""
    # Verify ownership
    thread = ChatThread.get_by_id(thread_id)
    if not thread or thread['user_id'] != session['user_id']:
        return jsonify({'error': 'Thread not found'}), 404

    data = request.json
    prompts = data.get('prompts', [])

    if not prompts or len(prompts) == 0:
        return jsonify({'error': 'At least one prompt is required'}), 400

    try:
        # Use Gemini to generate a concise 2-3 word title
        import google.generativeai as genai
        import os

        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        model = genai.GenerativeModel('gemini-2.0-flash-exp')

        # Build prompt based on number of user prompts
        if len(prompts) == 1:
            gemini_prompt = f"""Based on this user question, generate a very concise 2-3 word title.
Return ONLY the title, no quotes, no extra text.

User question: {prompts[0][:300]}

Title:"""
        else:
            gemini_prompt = f"""Based on these user questions, generate a very concise 2-3 word title that captures the main topic.
Return ONLY the title, no quotes, no extra text.

First question: {prompts[0][:200]}
Second question: {prompts[1][:200]}

Title:"""

        response = model.generate_content(gemini_prompt)
        new_title = response.text.strip().replace('"', '').replace("'", "")

        # Limit to 3 words max
        words = new_title.split()
        if len(words) > 3:
            new_title = ' '.join(words[:3])

        # Update thread title
        ChatThread.update_title(thread_id, new_title)

        print(f"Auto-renamed thread {thread_id} to: {new_title} (based on {len(prompts)} prompt(s))")

        return jsonify({
            'success': True,
            'new_title': new_title
        })

    except Exception as e:
        print(f"Error auto-renaming thread: {e}")
        return jsonify({'error': str(e)}), 500


@chat_bp.route('/api/threads/<int:thread_id>/messages', methods=['GET'])
@api_login_required
def get_messages(thread_id):
    """Get messages for a thread."""
    # Verify ownership
    thread = ChatThread.get_by_id(thread_id)
    if not thread or thread['user_id'] != session['user_id']:
        return jsonify({'error': 'Thread not found'}), 404

    messages = ChatMessage.get_by_thread(thread_id)
    model_used = thread['model_used']  # Get the model used for this thread

    return jsonify({
        'messages': [
            {
                'id': m['id'],
                'role': m['role'],
                'content': m['content'],
                'created_at': m['created_at'],
                'model': model_used if m['role'] == 'assistant' else None  # Add model for assistant messages
            } for m in messages
        ]
    })


@chat_bp.route('/api/chat', methods=['POST'])
@api_login_required
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
@api_login_required
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

    # Get relevant context based on context mode
    context_mode = Settings.get('context_mode', 'context_window').lower()
    context = ""

    if context_mode == 'vector_embeddings':
        # Vector embeddings mode: combine always-in-context files + semantic search
        always_in_context = llm_service.get_context_files()
        semantic_results = embedding_service.search_context(message)

        # Combine both contexts
        context_parts = []
        if always_in_context:
            context_parts.append("=== ALWAYS IN CONTEXT FILES ===\n" + always_in_context)
        if semantic_results:
            context_parts.append("=== SEMANTIC SEARCH RESULTS ===\n" + semantic_results)

        context = "\n\n".join(context_parts)
        print(f"Vector embeddings: always-in-context={len(always_in_context)} chars, semantic={len(semantic_results)} chars, total={len(context)} chars")
    # In context_window mode, context is loaded directly in llm_service

    # Get current model from user's session BEFORE the generator (avoid request context issues)
    current_model = session.get('preferred_model', os.getenv('LLM_PROVIDER', 'gemini')).lower()

    def generate():
        """Generator for streaming response."""
        try:

            # Update thread's model to current model
            ChatThread.update_model(thread_id, current_model)

            # Get streaming response from LLM
            full_response = ""
            result = llm_service.generate_response(
                messages=conversation,
                context=context,
                stream=True,
                provider=current_model
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


@chat_bp.route('/api/chat/debug-context', methods=['POST'])
@api_login_required
def get_debug_context():
    """Get debug context showing all LLM input before sending."""
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

    try:
        # Get current datetime
        current_datetime = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Get current model from user's session
        current_model = session.get('preferred_model', os.getenv('LLM_PROVIDER', 'gemini')).lower()
        model_names = {
            'claude': 'Claude',
            'gemini': 'Gemini',
            'grok': 'Grok',
            'perplexity': 'Perplexity'
        }
        model_display = model_names.get(current_model, current_model.title())

        # Load system prompt
        system_prompt = llm_service._load_system_prompt()

        # Get conversation history for context
        messages_history = ChatMessage.get_by_thread(thread_id)
        conversation_history = [
            {'role': m['role'], 'content': m['content']}
            for m in messages_history[-10:]  # Last 10 messages for context
        ]

        # Get relevant context based on context mode
        context_mode = Settings.get('context_mode', 'context_window').lower()

        if context_mode == 'vector_embeddings':
            # Vector embeddings mode: use semantic search + always-in-context files
            semantic_results = embedding_service.search_context(message)
            always_in_context = llm_service.get_context_files()

            # Build the debug context object
            debug_context = {
                'metadata': {
                    'datetime': current_datetime,
                    'model': model_display,
                    'context_mode': 'Vector Embeddings (Semantic Search)'
                },
                'system_prompt': system_prompt,
                'always_in_context_files': always_in_context if always_in_context else "(No always-in-context files)",
                'semantic_search_results': semantic_results if semantic_results else "(No semantic search results)",
                'conversation_history': conversation_history,
                'user_message': message
            }
        else:
            # Context window mode: load full context files
            context_files = llm_service.get_context_files()

            # Build the debug context object
            debug_context = {
                'metadata': {
                    'datetime': current_datetime,
                    'model': model_display,
                    'context_mode': 'Context Window (Full Files)'
                },
                'system_prompt': system_prompt,
                'context_files': context_files if context_files else "(No context files)",
                'conversation_history': conversation_history,
                'user_message': message
            }

        return jsonify(debug_context)

    except Exception as e:
        print(f"Error generating debug context: {e}")
        return jsonify({'error': str(e)}), 500
