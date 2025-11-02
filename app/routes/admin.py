"""Admin routes for document management."""
from flask import Blueprint, request, jsonify, render_template, session
from app.utils.helpers import admin_required, login_required
from app.models import Settings, Insight
from werkzeug.utils import secure_filename
import os
import json
from datetime import datetime

admin_bp = Blueprint('admin', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'txt', 'md'}
UPLOAD_FOLDER = 'documents'
CONTEXT_FOLDER = 'documents/context'
SYSTEM_PROMPT_FILE = 'data/system_prompt.txt'
CONTEXT_CONFIG_FILE = 'data/context_config.json'

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
    """List all context files with preview."""
    try:
        # Ensure context folder exists
        os.makedirs(CONTEXT_FOLDER, exist_ok=True)

        # Load enabled/disabled state and file modes
        config = load_context_config()
        enabled_files = config.get('enabled_files', {})
        file_modes = config.get('file_modes', {})

        files_info = []
        total_chars = 0
        preview_parts = []

        # Get all files in context folder
        for filename in os.listdir(CONTEXT_FOLDER):
            filepath = os.path.join(CONTEXT_FOLDER, filename)

            if os.path.isfile(filepath) and allowed_context_file(filename):
                file_size = os.path.getsize(filepath)

                # Read file content for char count only
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                char_count = len(content)
                total_chars += char_count

                # Check if file is enabled (default to True if not specified)
                is_enabled = enabled_files.get(filename, True)

                # Get file mode (default to 'window' if not specified)
                file_mode = file_modes.get(filename, 'window')

                files_info.append({
                    'name': filename,
                    'size': file_size,
                    'chars': char_count,
                    # Don't send full content in list - load on-demand for preview
                    'enabled': is_enabled,
                    'mode': file_mode
                })

                # Add to preview (with separator) - limit preview size
                preview_sample = content[:1000] + ('...' if len(content) > 1000 else '')
                preview_parts.append(f"--- {filename} ---\n{preview_sample}\n")

        # Create preview (limit to first 2000 chars for display)
        full_preview = '\n'.join(preview_parts)
        preview = full_preview[:2000] + ('...' if len(full_preview) > 2000 else '')

        # Estimate tokens (rough estimate: chars / 4)
        total_tokens = total_chars // 4

        return jsonify({
            'success': True,
            'files': files_info,
            'preview': preview,
            'total_chars': total_chars,
            'total_tokens': total_tokens
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/context-files', methods=['POST'])
@admin_required
def upload_context_files():
    """Upload new context file(s)."""
    try:
        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400

        files = request.files.getlist('files')

        if not files or len(files) == 0:
            return jsonify({'error': 'No files selected'}), 400

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

            # Save file
            filename = secure_filename(file.filename)
            filepath = os.path.join(CONTEXT_FOLDER, filename)
            file.save(filepath)

            uploaded_files.append(filename)

        print(f"Uploaded context files: {uploaded_files}")

        return jsonify({
            'success': True,
            'message': f'Successfully uploaded {len(uploaded_files)} file(s)',
            'files': uploaded_files
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

        os.remove(filepath)

        # Also remove from config
        config = load_context_config()
        enabled_files = config.get('enabled_files', {})
        if filename in enabled_files:
            del enabled_files[filename]
            config['enabled_files'] = enabled_files
            save_context_config(config)

        print(f"Deleted context file: {filename}")

        return jsonify({
            'success': True,
            'message': f'File deleted: {filename}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/context-files/<filename>/toggle', methods=['POST'])
@admin_required
def toggle_context_file(filename):
    """Toggle whether a context file is enabled."""
    try:
        filename = secure_filename(filename)
        filepath = os.path.join(CONTEXT_FOLDER, filename)

        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404

        data = request.get_json()
        enabled = data.get('enabled', True)

        # Load config
        config = load_context_config()
        enabled_files = config.get('enabled_files', {})

        # Update enabled state
        enabled_files[filename] = enabled
        config['enabled_files'] = enabled_files

        # Save config
        if not save_context_config(config):
            return jsonify({'error': 'Failed to save configuration'}), 500

        print(f"Toggled context file {filename}: enabled={enabled}")

        return jsonify({
            'success': True,
            'enabled': enabled,
            'message': f'File {"enabled" if enabled else "disabled"}: {filename}'
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
                'user_name': i['user_name'],
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
