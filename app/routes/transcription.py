"""Streaming transcription API for real-time content updates."""
from flask import Blueprint, request, jsonify
from app.utils.helpers import admin_required
from werkzeug.utils import secure_filename
import os
import json
import secrets
from datetime import datetime
import threading

transcription_bp = Blueprint('transcription', __name__)

CONTEXT_FOLDER = os.path.join('documents', 'context')
CONTEXT_CONFIG_FILE = os.path.join('data', 'context_config.json')

# File lock for concurrent writes
_file_locks = {}
_lock_manager = threading.Lock()


def get_file_lock(filename):
    """Get or create a lock for a specific file."""
    with _lock_manager:
        if filename not in _file_locks:
            _file_locks[filename] = threading.Lock()
        return _file_locks[filename]


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


def allowed_context_file(filename):
    """Check if file extension is allowed for context files."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'txt', 'md'}


@transcription_bp.route('/api/transcription/start', methods=['POST'])
@admin_required
def start_stream():
    """Start a new streaming transcription session.

    Request body:
    {
        "filename": "live_transcript.txt",
        "source_identifier": "my-transcription-service"
    }
    """
    try:
        data = request.get_json()
        filename = data.get('filename', '')
        source_identifier = data.get('source_identifier', 'unknown')

        if not filename:
            return jsonify({'error': 'Filename is required'}), 400

        # Sanitize filename
        filename = secure_filename(filename)

        if not allowed_context_file(filename):
            return jsonify({'error': 'Invalid filename. Only .txt and .md allowed'}), 400

        filepath = os.path.join(CONTEXT_FOLDER, filename)

        # Load config
        config = load_context_config()
        if 'streaming_sessions' not in config:
            config['streaming_sessions'] = {}

        # Check if file exists and is not already streaming
        if os.path.exists(filepath):
            if filename in config.get('streaming_sessions', {}):
                # File exists and is already streaming - can resume
                existing_session = config['streaming_sessions'][filename]
                return jsonify({
                    'success': True,
                    'session_id': existing_session['session_id'],
                    'filename': filename,
                    'message': 'Resumed existing streaming session',
                    'resumed': True
                })
            else:
                # File exists but not in streaming mode
                return jsonify({
                    'error': 'File exists and is not in streaming mode. Delete it first or choose a different name.'
                }), 409

        # Ensure context folder exists
        os.makedirs(CONTEXT_FOLDER, exist_ok=True)

        # Create empty file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('')

        # Generate session ID
        session_id = f"sess_{secrets.token_urlsafe(16)}"

        # Add to streaming_sessions
        config['streaming_sessions'][filename] = {
            'session_id': session_id,
            'started_at': datetime.utcnow().isoformat() + 'Z',
            'last_updated': datetime.utcnow().isoformat() + 'Z',
            'source_identifier': source_identifier
        }

        save_context_config(config)

        print(f"Streaming session started: {filename} (session: {session_id})")

        return jsonify({
            'success': True,
            'session_id': session_id,
            'filename': filename,
            'message': 'Streaming session started'
        }), 201

    except Exception as e:
        print(f"Error starting stream: {e}")
        return jsonify({'error': str(e)}), 500


@transcription_bp.route('/api/transcription/append', methods=['POST'])
@admin_required
def append_content():
    """Append content to an active streaming session.

    Request body:
    {
        "session_id": "sess_abc123",
        "content": "New transcribed text..."
    }
    """
    try:
        data = request.get_json()
        session_id = data.get('session_id', '')
        content = data.get('content', '')

        if not session_id:
            return jsonify({'error': 'session_id is required'}), 400

        if not content:
            return jsonify({'error': 'content is required'}), 400

        # Limit content size per append (100KB)
        if len(content) > 100 * 1024:
            return jsonify({'error': 'Content exceeds maximum size (100KB)'}), 413

        # Load config and find session
        config = load_context_config()
        streaming_sessions = config.get('streaming_sessions', {})

        # Find filename for this session
        filename = None
        for fname, session_data in streaming_sessions.items():
            if session_data.get('session_id') == session_id:
                filename = fname
                break

        if not filename:
            return jsonify({'error': 'Session not found or expired'}), 404

        filepath = os.path.join(CONTEXT_FOLDER, filename)

        # Check file size limit (10MB)
        if os.path.exists(filepath):
            current_size = os.path.getsize(filepath)
            if current_size + len(content.encode('utf-8')) > 10 * 1024 * 1024:
                return jsonify({'error': 'File size limit exceeded (10MB)'}), 413

        # Append content with file lock
        file_lock = get_file_lock(filename)
        with file_lock:
            with open(filepath, 'a', encoding='utf-8') as f:
                f.write(content)

        # Update last_updated timestamp
        config['streaming_sessions'][filename]['last_updated'] = datetime.utcnow().isoformat() + 'Z'
        save_context_config(config)

        # Get total chars
        with open(filepath, 'r', encoding='utf-8') as f:
            total_chars = len(f.read())

        return jsonify({
            'success': True,
            'session_id': session_id,
            'total_chars': total_chars,
            'last_updated': config['streaming_sessions'][filename]['last_updated']
        })

    except Exception as e:
        print(f"Error appending content: {e}")
        return jsonify({'error': str(e)}), 500


@transcription_bp.route('/api/transcription/status/<session_id>', methods=['GET'])
@admin_required
def get_stream_status(session_id):
    """Get status of a streaming session."""
    try:
        # Load config and find session
        config = load_context_config()
        streaming_sessions = config.get('streaming_sessions', {})

        # Find filename for this session
        filename = None
        session_data = None
        for fname, sdata in streaming_sessions.items():
            if sdata.get('session_id') == session_id:
                filename = fname
                session_data = sdata
                break

        if not filename:
            return jsonify({'error': 'Session not found or expired'}), 404

        filepath = os.path.join(CONTEXT_FOLDER, filename)

        # Get file stats
        total_chars = 0
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                total_chars = len(f.read())

        return jsonify({
            'session_id': session_id,
            'filename': filename,
            'status': 'active',
            'started_at': session_data.get('started_at', ''),
            'last_updated': session_data.get('last_updated', ''),
            'source_identifier': session_data.get('source_identifier', ''),
            'total_chars': total_chars,
            'estimated_tokens': total_chars // 4
        })

    except Exception as e:
        print(f"Error getting stream status: {e}")
        return jsonify({'error': str(e)}), 500


@transcription_bp.route('/api/transcription/finalize', methods=['POST'])
@admin_required
def finalize_stream():
    """End streaming session and move to base context.

    Request body:
    {
        "session_id": "sess_abc123"
    }
    """
    try:
        data = request.get_json()
        session_id = data.get('session_id', '')

        if not session_id:
            return jsonify({'error': 'session_id is required'}), 400

        # Load config and find session
        config = load_context_config()
        streaming_sessions = config.get('streaming_sessions', {})

        # Find filename for this session
        filename = None
        for fname, session_data in streaming_sessions.items():
            if session_data.get('session_id') == session_id:
                filename = fname
                break

        if not filename:
            return jsonify({'error': 'Session not found or expired'}), 404

        filepath = os.path.join(CONTEXT_FOLDER, filename)

        # Get file stats before finalizing
        total_chars = 0
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                total_chars = len(f.read())

        # Remove from streaming_sessions
        del config['streaming_sessions'][filename]

        # Add to base_context (file stays in base context, just no longer streaming)
        if 'base_context' not in config:
            config['base_context'] = []
        if filename not in config['base_context']:
            config['base_context'].append(filename)

        # Set file type to transcript
        if 'base_context_types' not in config:
            config['base_context_types'] = {}
        config['base_context_types'][filename] = 'transcript'

        save_context_config(config)

        print(f"Streaming session finalized: {filename} -> base_context ({total_chars} chars)")

        return jsonify({
            'success': True,
            'filename': filename,
            'target': 'base_context',
            'total_chars': total_chars,
            'message': f'Stream finalized: {filename} ({total_chars:,} chars) saved to Base Context'
        })

    except Exception as e:
        print(f"Error finalizing stream: {e}")
        return jsonify({'error': str(e)}), 500


@transcription_bp.route('/api/transcription/abort/<session_id>', methods=['DELETE'])
@admin_required
def abort_stream(session_id):
    """Cancel a streaming session and optionally delete the partial file.

    Query params:
    - delete_file: true/false (default: false)
    """
    try:
        delete_file = request.args.get('delete_file', 'false').lower() == 'true'

        # Load config and find session
        config = load_context_config()
        streaming_sessions = config.get('streaming_sessions', {})

        # Find filename for this session
        filename = None
        for fname, session_data in streaming_sessions.items():
            if session_data.get('session_id') == session_id:
                filename = fname
                break

        if not filename:
            return jsonify({'error': 'Session not found or expired'}), 404

        filepath = os.path.join(CONTEXT_FOLDER, filename)

        # Remove from streaming_sessions
        del config['streaming_sessions'][filename]

        file_deleted = False
        if delete_file:
            # Delete the file
            if os.path.exists(filepath):
                os.remove(filepath)
                file_deleted = True
        else:
            # Move to base_context so content is preserved
            if 'base_context' not in config:
                config['base_context'] = []
            if filename not in config['base_context']:
                config['base_context'].append(filename)

        save_context_config(config)

        print(f"Streaming session aborted: {filename} (file_deleted: {file_deleted})")

        return jsonify({
            'success': True,
            'session_id': session_id,
            'filename': filename,
            'file_deleted': file_deleted,
            'message': 'Stream aborted' + (' and file deleted' if file_deleted else ' (file preserved in base context)')
        })

    except Exception as e:
        print(f"Error aborting stream: {e}")
        return jsonify({'error': str(e)}), 500


@transcription_bp.route('/api/transcription/sessions', methods=['GET'])
@admin_required
def list_sessions():
    """List all active streaming sessions."""
    try:
        config = load_context_config()
        streaming_sessions = config.get('streaming_sessions', {})

        sessions = []
        for filename, session_data in streaming_sessions.items():
            filepath = os.path.join(CONTEXT_FOLDER, filename)
            total_chars = 0
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    total_chars = len(f.read())

            sessions.append({
                'filename': filename,
                'session_id': session_data.get('session_id', ''),
                'started_at': session_data.get('started_at', ''),
                'last_updated': session_data.get('last_updated', ''),
                'source_identifier': session_data.get('source_identifier', ''),
                'total_chars': total_chars
            })

        return jsonify({
            'success': True,
            'sessions': sessions,
            'count': len(sessions)
        })

    except Exception as e:
        print(f"Error listing sessions: {e}")
        return jsonify({'error': str(e)}), 500
