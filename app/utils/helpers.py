"""Helper functions for ConfAI application."""
import random
import string
from datetime import datetime, timedelta
from functools import wraps
from flask import session, redirect, url_for, request, make_response


def generate_pin(length=4):
    """Generate a random PIN code."""
    return ''.join(random.choices(string.digits, k=length))


def generate_magic_token():
    """Generate a secure magic login token."""
    import secrets
    return secrets.token_urlsafe(32)


def generate_gradient():
    """Generate a random gradient for user avatar."""
    gradients = [
        "linear-gradient(135deg, #E20074, #FF66B3)",
        "linear-gradient(135deg, #001E50, #00A0E9)",
        "linear-gradient(135deg, #E20074, #001E50)",
        "linear-gradient(135deg, #FF66B3, #00A0E9)",
        "linear-gradient(135deg, #00A651, #00A0E9)",
        "linear-gradient(135deg, #E20074, #00A651)",
    ]
    return random.choice(gradients)


def extract_name_from_email(email):
    """Extract name from email address (part before @)."""
    return email.split('@')[0].capitalize()


def generate_avatar_initials(name):
    """Generate initials from name (first 2 letters)."""
    return name[:2].upper()


def sanitize_input(text, max_length=5000):
    """Sanitize user input to prevent prompt injection."""
    if not text:
        return ""

    # Remove potentially dangerous characters
    text = text.strip()

    # Limit length
    if len(text) > max_length:
        text = text[:max_length]

    # Remove only dangerous control characters (NULL, etc.)
    # but preserve all printable characters including Unicode emoji
    import unicodedata
    text = ''.join(c for c in text if unicodedata.category(c)[0] != 'C' or c in '\n\r\t')

    return text


def login_required(f):
    """Decorator to require login for routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth.login'))

        # Execute the route function
        response = make_response(f(*args, **kwargs))

        # Add cache-control headers to prevent caching of authenticated pages
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'

        return response
    return decorated_function


def api_login_required(f):
    """Decorator to require login for API routes - returns JSON on failure."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from flask import jsonify

        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401

        # Execute the route function
        result = f(*args, **kwargs)

        # If result is already a Response object, add cache headers
        if hasattr(result, 'headers'):
            result.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            result.headers['Pragma'] = 'no-cache'
            result.headers['Expires'] = '0'
            return result

        # If result is a tuple (response, status_code), convert and add headers
        if isinstance(result, tuple):
            response = make_response(result)
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response

        # Otherwise, make response and add headers
        response = make_response(result)
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response

    return decorated_function


def admin_required(f):
    """Decorator to require admin access via session or API key."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        import os

        # Check if user is admin via session
        if session.get('is_admin'):
            return f(*args, **kwargs)

        # Check if admin key is provided in header
        api_key = request.headers.get('X-Admin-Key')
        if api_key and api_key == os.getenv('ADMIN_API_KEY'):
            return f(*args, **kwargs)

        # If neither, return unauthorized
        return {'error': 'Unauthorized - Admin access required'}, 401

    return decorated_function


def format_timestamp(dt):
    """Format datetime for display."""
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)

    now = datetime.now()
    diff = now - dt

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
        return dt.strftime("%b %d, %Y")


def chunk_text(text, chunk_size=500, overlap=50):
    """Split text into overlapping chunks for embeddings."""
    chunks = []
    start = 0
    text_length = len(text)

    while start < text_length:
        end = start + chunk_size
        chunk = text[start:end]

        # Try to break at sentence boundary
        if end < text_length:
            last_period = chunk.rfind('.')
            last_newline = chunk.rfind('\n')
            break_point = max(last_period, last_newline)

            if break_point > chunk_size * 0.5:  # Only break if not too early
                chunk = chunk[:break_point + 1]
                end = start + break_point + 1

        chunks.append(chunk.strip())
        start = end - overlap

    return chunks


def is_valid_email(email):
    """Simple email validation."""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None
