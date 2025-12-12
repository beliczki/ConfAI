"""Admin routes for document management."""
from flask import Blueprint, request, jsonify, render_template, session, send_file, current_app, Response
from app.utils.helpers import admin_required, login_required, generate_gradient, extract_name_from_email, is_valid_email
from app.models import Settings, Insight, User, Invite, get_db
from app.services.email_service import email_service
from werkzeug.utils import secure_filename
import os
import json
import secrets
from datetime import datetime, timedelta

admin_bp = Blueprint('admin', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'txt', 'md'}
UPLOAD_FOLDER = 'documents'
CONTEXT_FOLDER = os.path.join('documents', 'context')
SYSTEM_PROMPT_FILE = os.path.join('data', 'system_prompt.txt')
CONTEXT_CONFIG_FILE = os.path.join('data', 'context_config.json')

# Default system prompt
DEFAULT_SYSTEM_PROMPT = """You are a helpful AI assistant specialized in conference insights and book knowledge.
You have access to conference transcripts and related books.
Respond concisely and insightfully, drawing from the provided context when relevant.
Be professional, engaging, and help users derive meaningful insights."""


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def allowed_context_file(filename):
    """Check if file extension is allowed for context files."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'txt', 'md'}


def load_context_config():
    """Load context configuration from JSON file."""
    try:
        if os.path.exists(CONTEXT_CONFIG_FILE):
            with open(CONTEXT_CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading context config: {e}")
    return {}


def save_context_config(config):
    """Save context configuration to JSON file."""
    try:
        os.makedirs(os.path.dirname(CONTEXT_CONFIG_FILE), exist_ok=True)
        with open(CONTEXT_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving context config: {e}")
        return False


@admin_bp.route('/api/update-transcript', methods=['POST'])
@admin_required
def update_transcript():
    """Upload or update conference transcript."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    doc_type = request.form.get('type', 'transcript')  # 'transcript' or 'book'

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Only PDF and TXT allowed'}), 400

    # Save file
    filename = secure_filename(file.filename)
    folder = os.path.join(UPLOAD_FOLDER, doc_type + 's')
    os.makedirs(folder, exist_ok=True)

    filepath = os.path.join(folder, filename)
    file.save(filepath)

    # TODO: Process document for embeddings
    # This will be implemented in embedding_service.py

    print(f"Document uploaded: {filepath}")

    return jsonify({
        'success': True,
        'message': f'Document uploaded: {filename}',
        'filename': filename,
        'type': doc_type
    })


@admin_bp.route('/api/documents', methods=['GET'])
@admin_required
def list_documents():
    """List all uploaded documents."""
    documents = {
        'transcripts': [],
        'books': []
    }

    for doc_type in ['transcripts', 'books']:
        folder = os.path.join(UPLOAD_FOLDER, doc_type)
        if os.path.exists(folder):
            documents[doc_type] = [
                f for f in os.listdir(folder)
                if os.path.isfile(os.path.join(folder, f))
            ]

    return jsonify(documents)


@admin_bp.route('/api/documents/<doc_type>/<filename>', methods=['DELETE'])
@admin_required
def delete_document(doc_type, filename):
    """Delete a document."""
    if doc_type not in ['transcripts', 'books']:
        return jsonify({'error': 'Invalid document type'}), 400

    filepath = os.path.join(UPLOAD_FOLDER, doc_type, secure_filename(filename))

    if not os.path.exists(filepath):
        return jsonify({'error': 'Document not found'}), 404

    os.remove(filepath)

    return jsonify({
        'success': True,
        'message': f'Document deleted: {filename}'
    })


# ============================
# ADMIN DASHBOARD ROUTES
# ============================

@admin_bp.route('/admin')
@login_required
@admin_required
def admin_dashboard():
    """Admin dashboard page."""
    return render_template('admin.html')


@admin_bp.route('/api/admin/system-prompt', methods=['GET'])
@admin_required
def get_system_prompt():
    """Get current system prompt."""
    try:
        # Try to read from file
        if os.path.exists(SYSTEM_PROMPT_FILE):
            with open(SYSTEM_PROMPT_FILE, 'r', encoding='utf-8') as f:
                prompt = f.read()
        else:
            prompt = DEFAULT_SYSTEM_PROMPT

        return jsonify({
            'success': True,
            'prompt': prompt
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/system-prompt', methods=['POST'])
@admin_required
def update_system_prompt():
    """Update system prompt."""
    try:
        data = request.get_json()
        prompt = data.get('prompt', '').strip()

        if not prompt:
            return jsonify({'error': 'Prompt cannot be empty'}), 400

        # Ensure data directory exists
        os.makedirs('data', exist_ok=True)

        # Save to file
        with open(SYSTEM_PROMPT_FILE, 'w', encoding='utf-8') as f:
            f.write(prompt)

        print(f"System prompt updated at {datetime.now()}")

        return jsonify({
            'success': True,
            'message': 'System prompt updated successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/welcome-message', methods=['GET'])
@admin_required
def get_welcome_message_admin():
    """Get current welcome message for admin editing."""
    try:
        welcome_message = Settings.get('welcome_message', '# Welcome to ConfAI!\n\nStart a new chat to begin.')
        return jsonify({
            'success': True,
            'message': welcome_message
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/welcome-message', methods=['POST'])
@admin_required
def update_welcome_message():
    """Update welcome message."""
    try:
        data = request.get_json()
        message = data.get('message', '').strip()

        if not message:
            return jsonify({'error': 'Welcome message cannot be empty'}), 400

        Settings.set('welcome_message', message)

        print(f"Welcome message updated at {datetime.now()}")

        return jsonify({
            'success': True,
            'message': 'Welcome message updated successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/new-chat-text', methods=['GET'])
@admin_required
def get_new_chat_text_admin():
    """Get current new chat instructions text for admin editing."""
    try:
        new_chat_text = Settings.get('new_chat_text', 'Start the conversation!\n\nAsk me anything about the conference materials.')
        return jsonify({
            'success': True,
            'text': new_chat_text
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/new-chat-text', methods=['POST'])
@admin_required
def update_new_chat_text():
    """Update new chat instructions text."""
    try:
        data = request.get_json()
        text = data.get('text', '').strip()

        Settings.set('new_chat_text', text)

        print(f"New chat text updated at {datetime.now()}")

        return jsonify({
            'success': True,
            'message': 'New chat text updated successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/insights-header-message', methods=['GET'])
@admin_required
def get_insights_header_message():
    """Get current insights header message for admin editing."""
    try:
        header_message = Settings.get('insights_header_message', '')
        return jsonify({
            'success': True,
            'message': header_message
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/insights-header-message', methods=['POST'])
@admin_required
def update_insights_header_message():
    """Update insights header message."""
    try:
        data = request.get_json()
        message = data.get('message', '').strip()

        Settings.set('insights_header_message', message)

        print(f"Insights header message updated at {datetime.now()}")

        return jsonify({
            'success': True,
            'message': 'Insights header message updated successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/conversation-starters', methods=['GET'])
@admin_required
def get_conversation_starters():
    """Get conversation starters."""
    try:
        starters = [
            Settings.get('starter_1', 'Ask 3 questions about me so you can personalize the conference content to me...'),
            Settings.get('starter_2', 'Tell me what 3 thoughts should I remember from this conference? Think of 12 candidates and then boil it down to 3 for me.'),
            Settings.get('starter_3', 'How can my marketing team be future proof? How the conference helps me to answer?'),
            Settings.get('starter_4', 'I have a hypothesis based on what I heard at the conference, can you help me validating?')
        ]
        return jsonify({
            'success': True,
            'starters': starters
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/conversation-starters', methods=['POST'])
@admin_required
def update_conversation_starters():
    """Update conversation starters."""
    try:
        data = request.get_json()
        starters = data.get('starters', [])

        if not isinstance(starters, list) or len(starters) != 4:
            return jsonify({'error': 'Must provide exactly 4 conversation starters'}), 400

        for i, starter in enumerate(starters, 1):
            if not starter or not starter.strip():
                return jsonify({'error': f'Starter {i} cannot be empty'}), 400
            Settings.set(f'starter_{i}', starter.strip())

        print(f"Conversation starters updated at {datetime.now()}")

        return jsonify({
            'success': True,
            'message': 'Conversation starters updated successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/model-names', methods=['GET'])
@admin_required
def get_model_names():
    """Get configured model names for each LLM provider."""
    try:
        model_names = {
            'claude_model': Settings.get('claude_model', 'claude-sonnet-4-5-20250929'),
            'gemini_model': Settings.get('gemini_model', 'gemini-2.5-flash-lite'),
            'grok_model': Settings.get('grok_model', 'grok-4-fast-reasoning'),
            'perplexity_model': Settings.get('perplexity_model', 'sonar')
        }
        return jsonify({
            'success': True,
            **model_names
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/model-names', methods=['POST'])
@admin_required
def update_model_names():
    """Update configured model names for each LLM provider."""
    try:
        data = request.get_json()

        claude_model = data.get('claude_model', '').strip()
        gemini_model = data.get('gemini_model', '').strip()
        grok_model = data.get('grok_model', '').strip()
        perplexity_model = data.get('perplexity_model', '').strip()

        if not claude_model or not gemini_model or not grok_model or not perplexity_model:
            return jsonify({'error': 'All model names must be specified'}), 400

        Settings.set('claude_model', claude_model)
        Settings.set('gemini_model', gemini_model)
        Settings.set('grok_model', grok_model)
        Settings.set('perplexity_model', perplexity_model)

        print(f"Model names updated at {datetime.now()}")

        return jsonify({
            'success': True,
            'message': 'Model names updated successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/summarize-prompt', methods=['GET'])
@admin_required
def get_summarize_prompt():
    """Get the summarization prompt setting."""
    try:
        prompt = Settings.get('summarize_prompt', 'Please provide a concise summary of the following document, highlighting the key points and main takeaways:\n\n')
        return jsonify({
            'success': True,
            'prompt': prompt
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/summarize-prompt', methods=['POST'])
@admin_required
def update_summarize_prompt():
    """Update the summarization prompt setting."""
    try:
        data = request.get_json()
        prompt = data.get('prompt', '').strip()

        if not prompt:
            return jsonify({'error': 'Summarization prompt cannot be empty'}), 400

        Settings.set('summarize_prompt', prompt)
        print(f"Summarize prompt updated at {datetime.now()}")

        return jsonify({
            'success': True,
            'message': 'Summarization prompt updated successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/synthesis-prompt', methods=['GET'])
@admin_required
def get_synthesis_prompt():
    """Get the synthesis prompt setting."""
    try:
        default_prompt = """Below are 4 summaries of the same conference transcript from different AI models.

Your task: Create the definitive summary that:
- Preserves ALL unique insights from any model
- Highlights points where all models agree (these are critical)
- Maintains technical accuracy while being accessible
- Optimizes for being used as context in future conversations

The four summaries from Claude, Gemini, Grok, and Perplexity are below:

"""
        prompt = Settings.get('synthesis_prompt', default_prompt)
        return jsonify({
            'success': True,
            'prompt': prompt
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/synthesis-prompt', methods=['POST'])
@admin_required
def update_synthesis_prompt():
    """Update the synthesis prompt setting."""
    try:
        data = request.get_json()
        prompt = data.get('prompt', '').strip()

        if not prompt:
            return jsonify({'error': 'Synthesis prompt cannot be empty'}), 400

        Settings.set('synthesis_prompt', prompt)
        print(f"Synthesis prompt updated at {datetime.now()}")

        return jsonify({
            'success': True,
            'message': 'Synthesis prompt updated successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/summarize-file-stream', methods=['POST'])
@admin_required
def summarize_file_stream():
    """Create multi-model summary with streaming progress updates."""
    import json
    from flask import Response, stream_with_context

    data = request.get_json()
    filename = data.get('filename')

    if not filename:
        return jsonify({'error': 'Filename is required'}), 400

    # Read the file content
    file_path = os.path.join(CONTEXT_FOLDER, filename)
    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404

    def generate():
        """Generator function that yields progress updates as SSE."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                file_content = f.read()

            # Get the prompts from settings
            summarize_prompt = Settings.get('summarize_prompt', 'Please provide a concise summary of the following document, highlighting the key points and main takeaways:\n\n')
            synthesis_prompt = Settings.get('synthesis_prompt', 'Below are 4 summaries of the same document from different AI models.\n\nYour task: Create the definitive summary that:\n- Preserves ALL unique insights from any model\n- Highlights points where all models agree (these are critical)\n- Maintains technical accuracy while being accessible\n- Optimizes for being used as context in future conversations\n\nThe four summaries are below:\n\n')

            # Import the LLM service
            from app.services.llm_service import llm_service

            # List of models to use
            models = ['claude', 'gemini', 'grok', 'perplexity']
            model_summaries = {}

            # Send start event
            yield f"data: {json.dumps({'type': 'start', 'filename': filename, 'models': models})}\n\n"

            # Generate summary from each model
            for model in models:
                try:
                    # Send progress update
                    yield f"data: {json.dumps({'type': 'model_start', 'model': model})}\n\n"

                    full_prompt = summarize_prompt + file_content

                    summary_response = llm_service.generate_simple_response(
                        messages=[{"role": "user", "content": full_prompt}],
                        model=model
                    )

                    summary_content = summary_response.get('content', '')

                    if summary_content:
                        model_summaries[model] = summary_content
                        # Send model completion event with summary
                        yield f"data: {json.dumps({'type': 'model_complete', 'model': model, 'summary': summary_content, 'length': len(summary_content)})}\n\n"
                    else:
                        # Send warning event
                        yield f"data: {json.dumps({'type': 'model_warning', 'model': model, 'message': 'Returned empty summary'})}\n\n"

                except Exception as e:
                    # Send error event
                    error_msg = str(e)
                    yield f"data: {json.dumps({'type': 'model_error', 'model': model, 'error': error_msg})}\n\n"

            # Check if we got at least some summaries
            if not model_summaries:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Failed to generate summaries from any model'})}\n\n"
                return

            # Prepare synthesis prompt with all model summaries
            yield f"data: {json.dumps({'type': 'synthesis_start'})}\n\n"

            synthesis_input = synthesis_prompt
            for model, summary in model_summaries.items():
                synthesis_input += f"\n\n=== {model.upper()} SUMMARY ===\n{summary}\n"

            # Use Claude to synthesize all summaries (with higher token limit for long synthesis)
            synthesis_response = llm_service.generate_simple_response(
                messages=[{"role": "user", "content": synthesis_input}],
                model='claude',
                max_tokens=8192  # Higher limit for comprehensive synthesis
            )

            final_summary = synthesis_response.get('content', '')

            if not final_summary:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Failed to synthesize summaries'})}\n\n"
                return

            # Send synthesis complete event
            yield f"data: {json.dumps({'type': 'synthesis_complete', 'summary': final_summary, 'length': len(final_summary)})}\n\n"

            # Find next available version number for summary file
            # Use original filename with MMS_ prefix
            original_name = os.path.splitext(filename)[0]
            base_filename = f"MMS_{original_name}"
            extension = ".txt"
            version = 1
            summary_filename = f"{base_filename}{extension}"

            while os.path.exists(os.path.join(CONTEXT_FOLDER, summary_filename)):
                version += 1
                summary_filename = f"{base_filename}_v{version}{extension}"

            # Save the final summary to a new file
            summary_path = os.path.join(CONTEXT_FOLDER, summary_filename)
            with open(summary_path, 'w', encoding='utf-8') as f:
                f.write(final_summary)

            # Load context config and add to base_context (summary is always-in)
            config = load_context_config()
            if 'base_context' not in config:
                config['base_context'] = []
            if summary_filename not in config['base_context']:
                config['base_context'].append(summary_filename)
            save_context_config(config)

            # Send completion event
            yield f"data: {json.dumps({'type': 'complete', 'filename': summary_filename, 'size': len(final_summary), 'version': version if version > 1 else None})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')


@admin_bp.route('/api/admin/summarize-file', methods=['POST'])
@admin_required
def summarize_file():
    """Create multi-model summary of a context file using all available models (legacy non-streaming endpoint)."""
    try:
        data = request.get_json()
        filename = data.get('filename')

        if not filename:
            return jsonify({'error': 'Filename is required'}), 400

        # Read the file content
        file_path = os.path.join(CONTEXT_FOLDER, filename)
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        with open(file_path, 'r', encoding='utf-8') as f:
            file_content = f.read()

        # Get the prompts from settings
        summarize_prompt = Settings.get('summarize_prompt', 'Please provide a concise summary of the following document, highlighting the key points and main takeaways:\n\n')
        synthesis_prompt = Settings.get('synthesis_prompt', 'Below are 4 summaries of the same document from different AI models.\n\nYour task: Create the definitive summary that:\n- Preserves ALL unique insights from any model\n- Highlights points where all models agree (these are critical)\n- Maintains technical accuracy while being accessible\n- Optimizes for being used as context in future conversations\n\nThe four summaries are below:\n\n')

        # Import the LLM service
        from app.services.llm_service import llm_service

        # List of models to use
        models = ['claude', 'gemini', 'grok', 'perplexity']
        model_summaries = {}

        print(f"Starting multi-model summarization of {filename}")

        # Generate summary from each model
        for model in models:
            try:
                print(f"Generating summary with {model}...")
                full_prompt = summarize_prompt + file_content

                summary_response = llm_service.generate_simple_response(
                    messages=[{"role": "user", "content": full_prompt}],
                    model=model
                )

                summary_content = summary_response.get('content', '')

                if summary_content:
                    model_summaries[model] = summary_content
                    print(f"{model.capitalize()} summary generated ({len(summary_content)} chars)")
                else:
                    print(f"Warning: {model} returned empty summary")

            except Exception as e:
                print(f"Error generating summary with {model}: {str(e)}")
                # Continue with other models even if one fails

        # Check if we got at least some summaries
        if not model_summaries:
            return jsonify({'error': 'Failed to generate summaries from any model'}), 500

        # Prepare synthesis prompt with all model summaries
        synthesis_input = synthesis_prompt
        for model, summary in model_summaries.items():
            synthesis_input += f"\n\n=== {model.upper()} SUMMARY ===\n{summary}\n"

        # Use Claude to synthesize all summaries (with higher token limit for long synthesis)
        print("Synthesizing summaries with Claude...")
        synthesis_response = llm_service.generate_simple_response(
            messages=[{"role": "user", "content": synthesis_input}],
            model='claude',
            max_tokens=8192  # Higher limit for comprehensive synthesis
        )

        final_summary = synthesis_response.get('content', '')

        if not final_summary:
            return jsonify({'error': 'Failed to synthesize summaries'}), 500

        # Find next available version number for summary file
        # Use original filename with MMS_ prefix
        original_name = os.path.splitext(filename)[0]
        base_filename = f"MMS_{original_name}"
        extension = ".txt"
        version = 1
        summary_filename = f"{base_filename}{extension}"

        while os.path.exists(os.path.join(CONTEXT_FOLDER, summary_filename)):
            version += 1
            summary_filename = f"{base_filename}_v{version}{extension}"

        # Save the final summary to a new file
        summary_path = os.path.join(CONTEXT_FOLDER, summary_filename)
        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write(final_summary)

        # Load context config and add to base_context (summary is always-in)
        config = load_context_config()
        if 'base_context' not in config:
            config['base_context'] = []
        if summary_filename not in config['base_context']:
            config['base_context'].append(summary_filename)
        save_context_config(config)

        print(f"Multi-model summary created: {summary_filename} ({len(final_summary)} chars)")

        return jsonify({
            'success': True,
            'summary_filename': summary_filename,
            'size': len(final_summary),
            'models_used': list(model_summaries.keys()),
            'version': version if version > 1 else None,
            'model_summaries': model_summaries,  # Include individual model summaries
            'final_summary': final_summary  # Include the final synthesized summary
        })

    except Exception as e:
        print(f"Error creating multi-model summary: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/context-mode', methods=['GET'])
@admin_required
def get_context_mode():
    """Get current context mode setting."""
    try:
        context_mode = Settings.get('context_mode', 'context_window')
        return jsonify({
            'success': True,
            'mode': context_mode
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/context-mode', methods=['POST'])
@admin_required
def update_context_mode():
    """Update context mode setting."""
    try:
        data = request.get_json()
        mode = data.get('mode', '').strip()

        # Validate mode
        valid_modes = ['context_window', 'vector_embeddings']
        if mode not in valid_modes:
            return jsonify({'error': 'Invalid context mode. Must be "context_window" or "vector_embeddings"'}), 400

        Settings.set('context_mode', mode)

        print(f"Context mode updated to {mode} at {datetime.now()}")

        return jsonify({
            'success': True,
            'message': f'Context mode updated to {mode}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/context-files', methods=['GET'])
@admin_required
def get_context_files():
    """List all context files organized by type (base, vectorized categories, streaming)."""
    try:
        # Ensure context folder exists
        os.makedirs(CONTEXT_FOLDER, exist_ok=True)

        # Load configuration with new schema
        config = load_context_config()
        base_context = config.get('base_context', [])
        vectorized_files = config.get('vectorized_files', {
            'transcript': [],
            'books': [],
            'background_info': []
        })
        streaming_sessions = config.get('streaming_sessions', {})

        def get_file_info(filename):
            """Get file size, char count, and modified time for a file."""
            filepath = os.path.join(CONTEXT_FOLDER, filename)
            if os.path.isfile(filepath):
                file_size = os.path.getsize(filepath)
                modified_time = datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat() + 'Z'
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    char_count = len(content)
                except:
                    char_count = 0
                return {'filename': filename, 'modified': modified_time, 'size': file_size, 'chars': char_count}
            return None

        # Build response structure
        result = {
            'base_context': [],
            'vectorized': {
                'transcript': [],
                'books': [],
                'background_info': []
            },
            'streaming': []
        }

        total_base_chars = 0

        # Get file types for base context
        base_context_types = config.get('base_context_types', {})

        # Get base context files info
        for filename in base_context:
            info = get_file_info(filename)
            if info:
                info['file_type'] = base_context_types.get(filename, 'background_info')
                result['base_context'].append(info)
                total_base_chars += info['chars']

        # Get streaming files info - also add to base_context with streaming flag
        for filename, session_data in streaming_sessions.items():
            info = get_file_info(filename)
            if info:
                info['is_streaming'] = True
                info['session_id'] = session_data.get('session_id', '')
                info['started_at'] = session_data.get('started_at', '')
                info['last_updated'] = session_data.get('last_updated', '')
                info['file_type'] = 'transcript'  # Streaming files default to transcript
                # Add to both streaming section AND base_context
                result['streaming'].append(info)
                result['base_context'].append(info)
                total_base_chars += info['chars']

        # Get vectorized files info by category
        for category, files in vectorized_files.items():
            if category not in result['vectorized']:
                result['vectorized'][category] = []
            for filename in files:
                info = get_file_info(filename)
                if info:
                    result['vectorized'][category].append(info)

        # Calculate totals
        total_vectorized_chars = sum(
            sum(f['chars'] for f in files)
            for files in result['vectorized'].values()
        )

        return jsonify({
            'success': True,
            **result,
            'total_base_chars': total_base_chars,
            'total_base_tokens': total_base_chars // 4,
            'total_vectorized_chars': total_vectorized_chars
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/context-files', methods=['POST'])
@admin_required
def upload_context_files():
    """Upload new context file(s) to a specific target location.

    Form data:
    - files: The file(s) to upload
    - target: Where to place the file (base_context, vectorized:transcript, vectorized:books, vectorized:background_info)
    """
    try:
        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400

        files = request.files.getlist('files')
        target = request.form.get('target', 'base_context')

        if not files or len(files) == 0:
            return jsonify({'error': 'No files selected'}), 400

        # Validate target
        valid_targets = ['base_context', 'vectorized:transcript', 'vectorized:books', 'vectorized:background_info']
        if target not in valid_targets:
            return jsonify({'error': f'Invalid target. Must be one of: {", ".join(valid_targets)}'}), 400

        # Ensure context folder exists
        os.makedirs(CONTEXT_FOLDER, exist_ok=True)

        max_size = 500 * 1024  # 500KB
        uploaded_files = []

        for file in files:
            if file.filename == '':
                continue

            if not allowed_context_file(file.filename):
                return jsonify({'error': f'Invalid file type for {file.filename}. Only .txt and .md allowed'}), 400

            # Check file size
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            file.seek(0)

            if file_size > max_size:
                return jsonify({'error': f'File {file.filename} exceeds 500KB limit'}), 400

            # Save file with backup versioning if exists
            filename = secure_filename(file.filename)
            base_name, extension = os.path.splitext(filename)
            filepath = os.path.join(CONTEXT_FOLDER, filename)

            # If file exists, backup the old one
            if os.path.exists(filepath):
                backup_version = 1
                while os.path.exists(os.path.join(CONTEXT_FOLDER, f"{base_name}_bak{backup_version}{extension}")):
                    backup_version += 1
                backup_filename = f"{base_name}_bak{backup_version}{extension}"
                backup_filepath = os.path.join(CONTEXT_FOLDER, backup_filename)
                os.rename(filepath, backup_filepath)
                print(f"Backed up existing file: {filename} -> {backup_filename}")

            file.save(filepath)
            uploaded_files.append(filename)

        # Update config with new files
        config = load_context_config()

        # Ensure structure exists
        if 'base_context' not in config:
            config['base_context'] = []
        if 'vectorized_files' not in config:
            config['vectorized_files'] = {'transcript': [], 'books': [], 'background_info': []}

        for filename in uploaded_files:
            if target == 'base_context':
                if filename not in config['base_context']:
                    config['base_context'].append(filename)
            else:
                # target is vectorized:category
                category = target.split(':')[1]
                if category not in config['vectorized_files']:
                    config['vectorized_files'][category] = []
                if filename not in config['vectorized_files'][category]:
                    config['vectorized_files'][category].append(filename)

        save_context_config(config)

        print(f"Uploaded context files to {target}: {uploaded_files}")

        return jsonify({
            'success': True,
            'message': f'Successfully uploaded {len(uploaded_files)} file(s) to {target}',
            'files': uploaded_files,
            'target': target
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/context-files/<filename>', methods=['DELETE'])
@admin_required
def delete_context_file(filename):
    """Delete a context file."""
    try:
        filename = secure_filename(filename)
        filepath = os.path.join(CONTEXT_FOLDER, filename)

        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404

        # Load config and check if file is in streaming mode
        config = load_context_config()
        streaming_sessions = config.get('streaming_sessions', {})

        if filename in streaming_sessions:
            return jsonify({
                'error': 'Cannot delete file in streaming mode. Abort the stream first.'
            }), 409

        # Delete the file
        os.remove(filepath)

        # Remove from config (check all locations)
        modified = False

        # Remove from base_context
        if 'base_context' in config and filename in config['base_context']:
            config['base_context'].remove(filename)
            modified = True

        # Remove from vectorized_files categories
        if 'vectorized_files' in config:
            for category in config['vectorized_files']:
                if filename in config['vectorized_files'][category]:
                    config['vectorized_files'][category].remove(filename)
                    modified = True

        if modified:
            save_context_config(config)

        print(f"Deleted context file: {filename}")

        return jsonify({
            'success': True,
            'message': f'File deleted: {filename}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/context-files/<filename>/move', methods=['PUT'])
@admin_required
def move_context_file(filename):
    """Move a context file to a different location (base_context or vectorized category)."""
    try:
        filename = secure_filename(filename)
        filepath = os.path.join(CONTEXT_FOLDER, filename)

        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404

        data = request.get_json()
        target = data.get('target', '')

        # Validate target
        valid_targets = ['base_context', 'vectorized:transcript', 'vectorized:books', 'vectorized:background_info']
        if target not in valid_targets:
            return jsonify({'error': f'Invalid target. Must be one of: {", ".join(valid_targets)}'}), 400

        # Load config
        config = load_context_config()

        # Check if file is in streaming mode
        streaming_sessions = config.get('streaming_sessions', {})
        if filename in streaming_sessions:
            return jsonify({
                'error': 'Cannot move file in streaming mode. Finalize or abort first.'
            }), 409

        # Ensure structure exists
        if 'base_context' not in config:
            config['base_context'] = []
        if 'vectorized_files' not in config:
            config['vectorized_files'] = {'transcript': [], 'books': [], 'background_info': []}

        # Remove from current location
        if filename in config['base_context']:
            config['base_context'].remove(filename)
        for category in config['vectorized_files']:
            if filename in config['vectorized_files'][category]:
                config['vectorized_files'][category].remove(filename)

        # Add to new location
        if target == 'base_context':
            config['base_context'].append(filename)
        else:
            category = target.split(':')[1]
            if category not in config['vectorized_files']:
                config['vectorized_files'][category] = []
            config['vectorized_files'][category].append(filename)

        # Save config
        if not save_context_config(config):
            return jsonify({'error': 'Failed to save configuration'}), 500

        print(f"Moved context file {filename} to {target}")

        return jsonify({
            'success': True,
            'target': target,
            'message': f'File moved to {target}: {filename}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/context-files/<filename>/type', methods=['PUT'])
@admin_required
def set_base_context_file_type(filename):
    """Set the type/category for a base context file (for display purposes)."""
    try:
        filename = secure_filename(filename)
        filepath = os.path.join(CONTEXT_FOLDER, filename)

        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404

        data = request.get_json()
        file_type = data.get('type', '')

        # Validate type
        valid_types = ['transcript', 'books', 'background_info']
        if file_type not in valid_types:
            return jsonify({'error': f'Invalid type. Must be one of: {", ".join(valid_types)}'}), 400

        # Load config
        config = load_context_config()

        # Check if file is in base_context
        base_context = config.get('base_context', [])
        if filename not in base_context:
            return jsonify({'error': 'File is not in base context'}), 400

        # Update base_context_types
        if 'base_context_types' not in config:
            config['base_context_types'] = {}
        config['base_context_types'][filename] = file_type

        # Save config
        if not save_context_config(config):
            return jsonify({'error': 'Failed to save configuration'}), 500

        print(f"Set base context file type: {filename} -> {file_type}")

        return jsonify({
            'success': True,
            'filename': filename,
            'type': file_type
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/context-files/<filename>/content', methods=['GET'])
@admin_required
def get_context_file_content(filename):
    """Get the content of a specific context file for preview."""
    try:
        filename = secure_filename(filename)
        filepath = os.path.join(CONTEXT_FOLDER, filename)

        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404

        # Read file content (limit to 100KB for preview)
        max_size = 100 * 1024  # 100KB
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read(max_size)

        return jsonify({
            'success': True,
            'filename': filename,
            'content': content
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/context-files/<filename>/download', methods=['GET'])
@admin_required
def download_context_file(filename):
    """Download the complete context file without truncation."""
    try:
        filename = secure_filename(filename)
        # Construct absolute path relative to app root
        filepath = os.path.join(current_app.root_path, '..', CONTEXT_FOLDER, filename)
        filepath = os.path.abspath(filepath)

        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404

        # Send the complete file
        return send_file(
            filepath,
            as_attachment=True,
            download_name=filename,
            mimetype='text/plain'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/context-files/<filename>/mode', methods=['PUT'])
@admin_required
def update_context_file_mode(filename):
    """Update the mode (window/vector) of a context file."""
    try:
        filename = secure_filename(filename)
        filepath = os.path.join(CONTEXT_FOLDER, filename)

        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404

        data = request.get_json()
        mode = data.get('mode', 'window')

        if mode not in ['window', 'vector']:
            return jsonify({'error': 'Invalid mode. Must be "window" or "vector"'}), 400

        # Load config
        config = load_context_config()
        file_modes = config.get('file_modes', {})

        # Update mode
        file_modes[filename] = mode
        config['file_modes'] = file_modes

        # Save config
        if not save_context_config(config):
            return jsonify({'error': 'Failed to save configuration'}), 500

        print(f"Updated context file {filename} mode to: {mode}")

        return jsonify({
            'success': True,
            'mode': mode,
            'message': f'File mode updated to {mode}: {filename}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/embedding-settings', methods=['GET'])
@admin_required
def get_embedding_settings():
    """Get embedding settings (chunk size, chunk overlap, retrieval count)."""
    try:
        embedding_settings = {
            'chunk_size': int(Settings.get('chunk_size', 1000)),
            'chunk_overlap': int(Settings.get('chunk_overlap', 200)),
            'chunks_to_retrieve': int(Settings.get('chunks_to_retrieve', 5))
        }

        return jsonify(embedding_settings)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/embedding-settings', methods=['POST'])
@admin_required
def save_embedding_settings():
    """Save embedding settings (chunk size, chunk overlap, retrieval count)."""
    try:
        data = request.get_json()
        chunk_size = data.get('chunk_size', 1000)
        chunk_overlap = data.get('chunk_overlap', 200)
        chunks_to_retrieve = data.get('chunks_to_retrieve', 5)

        # Validate settings
        if not isinstance(chunk_size, int) or chunk_size < 200 or chunk_size > 4000:
            return jsonify({'error': 'Invalid chunk_size. Must be between 200 and 4000'}), 400

        if not isinstance(chunk_overlap, int) or chunk_overlap < 0 or chunk_overlap > 500:
            return jsonify({'error': 'Invalid chunk_overlap. Must be between 0 and 500'}), 400

        if not isinstance(chunks_to_retrieve, int) or chunks_to_retrieve < 1 or chunks_to_retrieve > 20:
            return jsonify({'error': 'Invalid chunks_to_retrieve. Must be between 1 and 20'}), 400

        # Save to database
        Settings.set('chunk_size', chunk_size)
        Settings.set('chunk_overlap', chunk_overlap)
        Settings.set('chunks_to_retrieve', chunks_to_retrieve)

        print(f"Updated embedding settings: chunk_size={chunk_size}, chunk_overlap={chunk_overlap}, chunks_to_retrieve={chunks_to_retrieve}")

        return jsonify({
            'success': True,
            'chunk_size': chunk_size,
            'chunk_overlap': chunk_overlap,
            'chunks_to_retrieve': chunks_to_retrieve,
            'message': 'Embedding settings saved successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/insights-limits', methods=['GET'])
@admin_required
def get_insights_limits():
    """Get insights limits (votes per user, shares per user)."""
    try:
        insights_limits = {
            'votes_per_user': int(Settings.get('votes_per_user', 3)),
            'shares_per_user': int(Settings.get('shares_per_user', 3))
        }

        return jsonify(insights_limits)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/insights-limits', methods=['POST'])
@admin_required
def save_insights_limits():
    """Save insights limits (votes per user, shares per user)."""
    try:
        data = request.get_json()
        votes_per_user = data.get('votes_per_user', 3)
        shares_per_user = data.get('shares_per_user', 3)

        # Validate settings
        if not isinstance(votes_per_user, int) or votes_per_user < 1 or votes_per_user > 10:
            return jsonify({'error': 'Invalid votes_per_user. Must be between 1 and 10'}), 400

        if not isinstance(shares_per_user, int) or shares_per_user < 1 or shares_per_user > 10:
            return jsonify({'error': 'Invalid shares_per_user. Must be between 1 and 10'}), 400

        # Save to database
        Settings.set('votes_per_user', votes_per_user)
        Settings.set('shares_per_user', shares_per_user)

        print(f"Updated insights limits: votes_per_user={votes_per_user}, shares_per_user={shares_per_user}")

        return jsonify({
            'success': True,
            'votes_per_user': votes_per_user,
            'shares_per_user': shares_per_user,
            'message': 'Insights limits saved successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/stats', methods=['GET'])
@admin_required
def get_stats():
    """Get application statistics."""
    try:
        from app.models import get_db, ActivityLog, TokenUsage

        with get_db() as conn:
            cursor = conn.cursor()

            # Get database statistics
            stats = {
                'total_users': cursor.execute('SELECT COUNT(*) FROM users').fetchone()[0],
                'total_threads': cursor.execute('SELECT COUNT(*) FROM chat_threads').fetchone()[0],
                'total_insights': cursor.execute('SELECT COUNT(*) FROM insights').fetchone()[0],
                'total_votes': cursor.execute('SELECT COUNT(*) FROM votes').fetchone()[0],
            }

            # Get token usage statistics
            token_totals = TokenUsage.get_totals()
            if token_totals:
                stats['tokens_sent'] = (token_totals['total_input'] or 0) + (token_totals['total_cache_creation'] or 0)
                stats['tokens_received'] = token_totals['total_output'] or 0
                stats['cache_tokens_read'] = token_totals['total_cache_read'] or 0
            else:
                stats['tokens_sent'] = 0
                stats['tokens_received'] = 0
                stats['cache_tokens_read'] = 0

            # Get token usage by model
            token_by_model = TokenUsage.get_by_model()
            stats['token_by_model'] = [
                {
                    'model': row['model_used'],
                    'message_count': row['message_count'],
                    'input_tokens': row['total_input'] or 0,
                    'output_tokens': row['total_output'] or 0,
                    'cache_read': row['total_cache_read'] or 0
                } for row in token_by_model
            ]

            # Get context usage
            context_chars = 0
            if os.path.exists(CONTEXT_FOLDER):
                for filename in os.listdir(CONTEXT_FOLDER):
                    filepath = os.path.join(CONTEXT_FOLDER, filename)
                    if os.path.isfile(filepath):
                        try:
                            with open(filepath, 'r', encoding='utf-8') as f:
                                context_chars += len(f.read())
                        except:
                            pass  # Skip files that can't be read

            stats['context_used'] = context_chars
            stats['context_max'] = 200000  # Claude's context window

            # Get recent activity from activity_log table
            recent_activity = []
            activities = ActivityLog.get_recent(limit=15)

            for activity in activities:
                recent_activity.append({
                    'type': activity['activity_type'],
                    'text': activity['description'],
                    'user': activity['user_name'] if activity['user_name'] else 'System',
                    'time': format_time_ago(activity['created_at'])
                })

            stats['recent_activity'] = recent_activity

            return jsonify(stats)
    except Exception as e:
        print(f"Error getting stats: {e}")
        import traceback
        traceback.print_exc()
        # Return empty stats on error
        return jsonify({
            'total_users': 0,
            'total_threads': 0,
            'total_insights': 0,
            'total_votes': 0,
            'tokens_sent': 0,
            'tokens_received': 0,
            'cache_tokens_read': 0,
            'context_used': 0,
            'context_max': 200000,
            'recent_activity': [],
            'token_by_model': []
        })


def format_time_ago(timestamp_str):
    """Format timestamp as relative time."""
    try:
        if isinstance(timestamp_str, str):
            timestamp = datetime.fromisoformat(timestamp_str)
        else:
            timestamp = timestamp_str

        now = datetime.now()
        diff = now - timestamp

        if diff.days == 0:
            if diff.seconds < 60:
                return "just now"
            elif diff.seconds < 3600:
                return f"{diff.seconds // 60}m ago"
            else:
                return f"{diff.seconds // 3600}h ago"
        elif diff.days == 1:
            return "yesterday"
        elif diff.days < 7:
            return f"{diff.days}d ago"
        else:
            return timestamp.strftime("%b %d")
    except:
        return "recently"


@admin_bp.route('/api/admin/insights', methods=['GET'])
@admin_required
def get_all_insights():
    """Get all insights for admin management."""
    insights = Insight.get_all()
    return jsonify({
        'insights': [
            {
                'id': i['id'],
                'content': i['content'],
                'title': i['title'] if 'title' in i.keys() else '',
                'user_name': i['user_name'],
                'user_email': i['email'] if 'email' in i.keys() else 'N/A',
                'avatar_gradient': i['avatar_gradient'],
                'upvotes': i['upvotes'],
                'downvotes': i['downvotes'],
                'net_votes': i['net_votes'],
                'created_at': i['created_at']
            } for i in insights
        ]
    })


@admin_bp.route('/api/admin/insights/<int:insight_id>', methods=['DELETE'])
@admin_required
def delete_insight(insight_id):
    """Delete an insight (admin only)."""
    success = Insight.delete(insight_id)
    if success:
        return jsonify({'success': True, 'message': 'Insight deleted successfully'})
    else:
        return jsonify({'error': 'Insight not found'}), 404


@admin_bp.route('/api/admin/insights/export', methods=['GET'])
@admin_required
def export_insights():
    """Export all insights to a markdown file."""
    from datetime import datetime
    from flask import Response

    insights = Insight.get_all()

    # Build markdown content
    lines = []
    lines.append("# ConfAI Insights Export")
    lines.append(f"\nExported: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"\nTotal Insights: {len(insights)}\n")
    lines.append("---\n")

    for i, insight in enumerate(insights, 1):
        # Header with user info and date
        date_str = datetime.fromisoformat(insight['created_at'].replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M:%S')
        title = insight['title'] if 'title' in insight.keys() else 'Untitled Insight'
        lines.append(f"## {i}. {title}")
        lines.append(f"\n**Author:** {insight['user_name']} ({insight['email']})")
        lines.append(f"\n**Date:** {date_str}")
        lines.append(f"\n**Score:** {insight['net_votes']} (👍 {insight['upvotes']} | 👎 {insight['downvotes']})")
        lines.append("\n### Content\n")
        lines.append(insight['content'])
        lines.append("\n\n---\n")

    # Create response with markdown file
    markdown_content = "\n".join(lines)
    filename = f"insights_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"

    return Response(
        markdown_content,
        mimetype='text/markdown',
        headers={
            'Content-Disposition': f'attachment; filename={filename}'
        }
    )


@admin_bp.route('/api/admin/embeddings/process', methods=['POST'])
@admin_required
def process_embeddings():
    """Process context files and generate embeddings."""
    try:
        # Import inside try block to catch import errors
        try:
            from app.services.embedding_service import embedding_service
        except ImportError as import_error:
            print(f"Error importing embedding_service: {import_error}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'error': f'Failed to import embedding service. Make sure all dependencies are installed: {str(import_error)}'
            }), 500

        # Process all context files
        success = embedding_service.process_context_files()

        if success:
            stats = embedding_service.get_stats()
            return jsonify({
                'success': True,
                'message': f'Successfully processed {stats["document_count"]} documents into {stats["chunk_count"]} chunks',
                'stats': stats
            })
        else:
            return jsonify({
                'error': 'Failed to process embeddings. Check server logs for details.'
            }), 500

    except Exception as e:
        error_msg = str(e)
        print(f"Error processing embeddings: {error_msg}")
        import traceback
        traceback.print_exc()

        # Return more user-friendly error messages
        if 'chromadb' in error_msg.lower():
            error_msg = f'ChromaDB error: {error_msg}. Make sure chromadb is properly installed.'
        elif 'sentence' in error_msg.lower() or 'transformer' in error_msg.lower():
            error_msg = f'Model loading error: {error_msg}. The embedding model may need to download on first use.'

        return jsonify({'error': error_msg}), 500


@admin_bp.route('/api/admin/embeddings/process/stream', methods=['POST'])
@admin_required
def process_embeddings_stream():
    """Process embeddings with streaming progress updates."""
    def generate():
        try:
            from app.services.embedding_service import embedding_service

            for update in embedding_service.process_context_files_streaming():
                yield f"data: {json.dumps(update)}\n\n"

        except ImportError as import_error:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to import embedding service: {str(import_error)}'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )


@admin_bp.route('/api/admin/embeddings/stats', methods=['GET'])
@admin_required
def get_embedding_stats():
    """Get embedding statistics."""
    try:
        from app.services.embedding_service import embedding_service

        stats = embedding_service.get_stats()
        return jsonify(stats)

    except Exception as e:
        print(f"Error getting embedding stats: {e}")
        return jsonify({
            'initialized': False,
            'document_count': 0,
            'chunk_count': 0,
            'error': str(e)
        }), 500


@admin_bp.route('/api/admin/embeddings/provider', methods=['GET'])
@admin_required
def get_embedding_provider():
    """Get current embedding provider settings."""
    try:
        provider = Settings.get('embedding_provider', 'sentence-transformers')
        st_model = Settings.get('st_model_name', 'all-MiniLM-L6-v2')

        return jsonify({
            'success': True,
            'provider': provider,
            'st_model_name': st_model
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/embeddings/provider', methods=['POST'])
@admin_required
def update_embedding_provider():
    """Update embedding provider settings."""
    try:
        data = request.get_json()

        provider = data.get('provider', '').strip()
        st_model = data.get('st_model_name', 'all-MiniLM-L6-v2').strip()

        # Validate provider
        if provider not in ['sentence-transformers', 'gemini']:
            return jsonify({'error': 'Invalid provider. Must be sentence-transformers or gemini'}), 400

        # Save settings
        Settings.set('embedding_provider', provider)
        if provider == 'sentence-transformers':
            Settings.set('st_model_name', st_model)

        print(f"Embedding provider updated to: {provider}")
        if provider == 'sentence-transformers':
            print(f"Sentence transformer model: {st_model}")

        return jsonify({
            'success': True,
            'message': f'Embedding provider updated to {provider}',
            'provider': provider,
            'st_model_name': st_model if provider == 'sentence-transformers' else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================
# USER MANAGEMENT ROUTES
# ============================

@admin_bp.route('/api/admin/users', methods=['GET'])
@admin_required
def get_users():
    """Get all users with invite status."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT
                    u.*,
                    i.invite_code,
                    i.status as invite_status,
                    i.sent_at,
                    i.accepted_at
                FROM users u
                LEFT JOIN invites i ON u.id = i.user_id
                ORDER BY u.created_at DESC
            ''')
            users = cursor.fetchall()

        return jsonify({
            'success': True,
            'users': [
                {
                    'id': user['id'],
                    'email': user['email'],
                    'name': user['name'],
                    'avatar_gradient': user['avatar_gradient'],
                    'is_allowed': user['is_allowed'],
                    'created_at': user['created_at'],
                    'invite_code': user['invite_code'],
                    'invite_status': user['invite_status'],
                    'sent_at': user['sent_at'],
                    'accepted_at': user['accepted_at']
                } for user in users
            ]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/users/upload-csv', methods=['POST'])
@admin_required
def upload_users_csv():
    """Upload CSV file with user emails and names."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not file.filename.endswith('.csv'):
            return jsonify({'error': 'Invalid file type. Only CSV files allowed'}), 400

        # Read CSV content
        content = file.read().decode('utf-8')

        # Parse CSV - expect single column with email addresses (with or without header)
        lines = [line.strip() for line in content.strip().split('\n') if line.strip()]

        created_users = []
        errors = []
        skipped = []

        for row_num, line in enumerate(lines, start=1):
            try:
                # Skip header row if it looks like "email" or "Email"
                if row_num == 1 and line.lower() in ['email', 'emails', 'e-mail']:
                    continue

                email = line.strip().lower()

                if not email:
                    continue  # Skip empty lines

                if not is_valid_email(email):
                    errors.append(f"Row {row_num}: Invalid email format - {email}")
                    continue

                # Check if user already exists
                existing_user = User.get_by_email(email)
                if existing_user:
                    skipped.append(f"{email} (already exists)")
                    continue

                # Generate name from email
                name = extract_name_from_email(email)

                # Create user
                gradient = generate_gradient()
                user_id = User.create(email, name, gradient)

                # Generate invite code (16 chars, URL-safe)
                invite_code = secrets.token_urlsafe(16)
                expires_at = datetime.now() + timedelta(days=7)

                # Create invite
                Invite.create(email, user_id, invite_code, expires_at)

                created_users.append({
                    'email': email,
                    'name': name,
                    'user_id': user_id
                })

                print(f"Created user: {email} ({name})")

            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")

        return jsonify({
            'success': True,
            'created': len(created_users),
            'skipped': len(skipped),
            'errors': len(errors),
            'users': created_users,
            'skipped_list': skipped,
            'error_list': errors
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/users/<int:user_id>/send-invite', methods=['POST'])
@admin_required
def send_user_invite(user_id):
    """Send invite email to a user."""
    try:
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get or create invite
        invite = Invite.get_by_email(user['email'])
        if not invite:
            # Create new invite
            invite_code = secrets.token_urlsafe(16)
            expires_at = datetime.now() + timedelta(days=7)
            invite_id = Invite.create(user['email'], user_id, invite_code, expires_at)
            invite = Invite.get_by_email(user['email'])

        # Check if already accepted
        if invite['status'] == 'accepted':
            return jsonify({'error': 'Invite already accepted'}), 400

        # Generate invite link
        # Get base URL from request
        base_url = request.host_url.rstrip('/')
        invite_link = f"{base_url}/login?invite={invite['invite_code']}"

        # Send email
        success = email_service.send_invite_email(
            user['email'],
            user['name'],
            invite_link
        )

        if success:
            # Mark as sent
            Invite.mark_sent(invite['id'])

            return jsonify({
                'success': True,
                'message': f'Invite sent to {user["email"]}'
            })
        else:
            # Return invite link even if email fails (for dev mode)
            return jsonify({
                'success': False,
                'message': 'Failed to send email (check SMTP configuration)',
                'invite_link': invite_link
            }), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/users/send-bulk-invites', methods=['POST'])
@admin_required
def send_bulk_invites():
    """Send invites to all users who haven't been sent invites yet."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # Get all users with pending invites
            cursor.execute('''
                SELECT u.*, i.id as invite_id, i.invite_code
                FROM users u
                JOIN invites i ON u.id = i.user_id
                WHERE i.status = 'pending' AND i.sent_at IS NULL
            ''')
            pending_users = cursor.fetchall()

        if not pending_users:
            return jsonify({
                'success': True,
                'message': 'No pending invites to send',
                'sent': 0
            })

        # Get base URL from request
        base_url = request.host_url.rstrip('/')

        sent_count = 0
        failed = []

        for user in pending_users:
            try:
                invite_link = f"{base_url}/login?invite={user['invite_code']}"

                success = email_service.send_invite_email(
                    user['email'],
                    user['name'],
                    invite_link
                )

                if success:
                    Invite.mark_sent(user['invite_id'])
                    sent_count += 1
                else:
                    failed.append(user['email'])

            except Exception as e:
                print(f"Error sending invite to {user['email']}: {e}")
                failed.append(user['email'])

        return jsonify({
            'success': True,
            'sent': sent_count,
            'failed': len(failed),
            'failed_list': failed
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete a user and their invite."""
    try:
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Delete user (will cascade delete invite due to foreign key)
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))

        return jsonify({
            'success': True,
            'message': f'User deleted: {user["email"]}'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/users/<int:user_id>/toggle-access', methods=['POST'])
@admin_required
def toggle_user_access(user_id):
    """Toggle user's is_allowed status."""
    try:
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        new_status = not user['is_allowed']

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE users SET is_allowed = ? WHERE id = ?', (new_status, user_id))

        return jsonify({
            'success': True,
            'is_allowed': new_status,
            'message': f'User access {"enabled" if new_status else "disabled"}'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/registration-mode', methods=['GET'])
@admin_required
def get_registration_mode():
    """Get current registration mode setting."""
    try:
        mode = Settings.get('registration_mode', 'invite_only')
        return jsonify({
            'success': True,
            'mode': mode
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/registration-mode', methods=['POST'])
@admin_required
def update_registration_mode():
    """Update registration mode setting."""
    try:
        data = request.get_json()
        mode = data.get('mode', '').strip()

        # Validate mode
        valid_modes = ['invite_only', 'open']
        if mode not in valid_modes:
            return jsonify({'error': 'Invalid registration mode. Must be "invite_only" or "open"'}), 400

        Settings.set('registration_mode', mode)

        print(f"Registration mode updated to {mode} at {datetime.now()}")

        return jsonify({
            'success': True,
            'message': f'Registration mode updated to {mode}',
            'mode': mode
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================
# PUBLIC API ROUTES
# ============================

@admin_bp.route('/api/upload-context', methods=['POST'])
def public_upload_context():
    """Public API endpoint to upload context files (no authentication required)."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_context_file(file.filename):
            return jsonify({'error': 'Invalid file type. Only .txt and .md files are allowed'}), 400

        # Ensure context folder exists
        os.makedirs(CONTEXT_FOLDER, exist_ok=True)

        # Get the original filename
        original_filename = secure_filename(file.filename)
        base_name, extension = os.path.splitext(original_filename)

        # Check if file exists - if so, backup the old file instead of versioning the new one
        filepath = os.path.join(CONTEXT_FOLDER, original_filename)
        backup_version = None
        if os.path.exists(filepath):
            # Find next available backup version number
            backup_version = 1
            while os.path.exists(os.path.join(CONTEXT_FOLDER, f"{base_name}_bak{backup_version}{extension}")):
                backup_version += 1
            backup_filename = f"{base_name}_bak{backup_version}{extension}"
            backup_filepath = os.path.join(CONTEXT_FOLDER, backup_filename)
            # Rename old file to backup
            os.rename(filepath, backup_filepath)
            print(f"Backed up existing file: {original_filename} -> {backup_filename}")

        # Save the new file with original filename
        file.save(filepath)
        final_filename = original_filename

        # Load context config and add to base_context
        config = load_context_config()
        if 'base_context' not in config:
            config['base_context'] = []
        if final_filename not in config['base_context']:
            config['base_context'].append(final_filename)
        save_context_config(config)

        # Get file size and char count
        file_size = os.path.getsize(filepath)
        with open(filepath, 'r', encoding='utf-8') as f:
            char_count = len(f.read())

        backup_info = f" (previous version backed up as _bak{backup_version})" if backup_version else ""
        print(f"Public API: Context file uploaded - {final_filename} ({char_count} chars, base_context){backup_info}")

        return jsonify({
            'success': True,
            'message': f'File uploaded successfully' + (f' (previous version backed up)' if backup_version else ''),
            'filename': final_filename,
            'original_filename': original_filename,
            'backup_version': backup_version,
            'mode': 'base_context',
            'size': file_size,
            'chars': char_count
        })

    except Exception as e:
        print(f"Error in public upload: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
