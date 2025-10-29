"""Admin routes for document management."""
from flask import Blueprint, request, jsonify
from app.utils.helpers import admin_required
from werkzeug.utils import secure_filename
import os

admin_bp = Blueprint('admin', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'txt'}
UPLOAD_FOLDER = 'documents'


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


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
