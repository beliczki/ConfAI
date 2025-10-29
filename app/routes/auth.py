"""Authentication routes."""
from datetime import datetime, timedelta
from flask import Blueprint, request, session, redirect, url_for, render_template, jsonify
from app.models import User, get_db
from app.services.email_service import email_service
from app.utils.helpers import (
    generate_pin, generate_gradient, extract_name_from_email,
    is_valid_email
)
from app import limiter

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/')
def index():
    """Landing page - redirect to login or chat."""
    if 'user_id' in session:
        return redirect(url_for('chat.chat_page'))
    return redirect(url_for('auth.login'))


@auth_bp.route('/login', methods=['GET', 'POST'])
@limiter.limit("5 per minute")
def login():
    """Login page and PIN request."""
    if request.method == 'GET':
        # Render login page
        return render_template('login.html')

    # Handle PIN request
    email = request.json.get('email', '').strip().lower()

    if not email or not is_valid_email(email):
        return jsonify({'error': 'Invalid email address'}), 400

    # Check if email is allowed (invite-only)
    user = User.get_by_email(email)
    if not user:
        # For MVP, auto-create user if email looks valid
        # In production, check against whitelist
        name = extract_name_from_email(email)
        gradient = generate_gradient()
        user_id = User.create(email, name, gradient)
        print(f"New user created: {email}")
    else:
        if not user['is_allowed']:
            return jsonify({'error': 'Access denied. This email is not on the invite list.'}), 403

    # Generate PIN
    pin = generate_pin()
    expires_at = datetime.now() + timedelta(minutes=15)

    # Store PIN in database
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO login_tokens (email, token, expires_at) VALUES (?, ?, ?)',
            (email, pin, expires_at)
        )

    # Send PIN email
    success = email_service.send_pin_email(email, pin)

    if not success:
        # For development, return PIN in response
        print(f"DEV MODE: PIN for {email}: {pin}")
        return jsonify({
            'success': True,
            'message': 'PIN generated (check console in dev mode)',
            'dev_pin': pin  # Remove in production
        })

    return jsonify({
        'success': True,
        'message': 'PIN sent to your email. Please check your inbox.'
    })


@auth_bp.route('/verify', methods=['POST'])
@limiter.limit("10 per minute")
def verify():
    """Verify PIN and log in user."""
    email = request.json.get('email', '').strip().lower()
    pin = request.json.get('pin', '').strip()

    if not email or not pin:
        return jsonify({'error': 'Email and PIN are required'}), 400

    # Check PIN
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM login_tokens
            WHERE email = ? AND token = ? AND used = 0 AND expires_at > ?
            ORDER BY created_at DESC
            LIMIT 1
        ''', (email, pin, datetime.now()))

        token = cursor.fetchone()

        if not token:
            return jsonify({'error': 'Invalid or expired PIN'}), 401

        # Mark token as used
        cursor.execute(
            'UPDATE login_tokens SET used = 1 WHERE id = ?',
            (token['id'],)
        )

    # Get or create user
    user = User.get_by_email(email)
    if not user:
        name = extract_name_from_email(email)
        gradient = generate_gradient()
        user_id = User.create(email, name, gradient)
        user = User.get_by_id(user_id)

    # Create session
    session['user_id'] = user['id']
    session['email'] = user['email']
    session['name'] = user['name']
    session.permanent = True

    print(f"User logged in: {email}")

    return jsonify({
        'success': True,
        'message': 'Login successful',
        'user': {
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'avatar_gradient': user['avatar_gradient']
        }
    })


@auth_bp.route('/logout')
def logout():
    """Logout user."""
    session.clear()
    return redirect(url_for('auth.login'))


@auth_bp.route('/me')
def me():
    """Get current user info."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    user = User.get_by_id(session['user_id'])
    if not user:
        session.clear()
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'id': user['id'],
        'email': user['email'],
        'name': user['name'],
        'avatar_gradient': user['avatar_gradient']
    })
