# ConfAI Code Patterns & Conventions

## Database Access Pattern

### Context Manager for Connections
```python
from contextlib import contextmanager
import sqlite3

@contextmanager
def get_db():
    """Get database connection context manager."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Return dict-like rows
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()
```

### Model Class Pattern
All models use static methods with raw SQL:
```python
class ChatThread:
    @staticmethod
    def create(user_id, title):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO chat_threads (user_id, title) VALUES (?, ?)',
                (user_id, title)
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_id(thread_id):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM chat_threads WHERE id = ?', (thread_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_by_user(user_id):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM chat_threads WHERE user_id = ? ORDER BY updated_at DESC',
                (user_id,)
            )
            return [dict(row) for row in cursor.fetchall()]
```

## Authentication Pattern

### Login Required Decorator
```python
from functools import wraps
from flask import session, redirect, url_for, jsonify

def login_required(f):
    """Decorator to require login."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json:
                return jsonify({'error': 'Authentication required'}), 401
            return redirect(url_for('auth.login_page'))
        return f(*args, **kwargs)
    return decorated_function
```

### Usage in Routes
```python
@chat_bp.route('/api/threads', methods=['GET'])
@login_required
def get_threads():
    user_id = session['user_id']
    threads = ChatThread.get_by_user(user_id)
    return jsonify({'threads': threads})
```

## LLM Service Pattern

### Provider Abstraction
```python
class LLMService:
    def __init__(self):
        self.provider = os.getenv('LLM_PROVIDER', 'claude').lower()
        self.anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        self.system_prompt = """You are a helpful AI assistant..."""

    def generate_response(self, messages: list, context: str = "", stream: bool = False):
        """Generate response from LLM."""
        system_prompt = self.system_prompt
        if context:
            system_prompt += f"\n\nRelevant context:\n{context}"

        if self.provider == 'claude':
            return self._generate_claude(messages, system_prompt, stream)
        elif self.provider == 'grok':
            return self._generate_grok(messages, system_prompt, stream)
        # ... other providers
```

### Streaming with Generator Functions
```python
def _generate_claude(self, messages, system_prompt, stream):
    """Generate response using Claude API."""
    if not self.anthropic_key:
        return "Error: ANTHROPIC_API_KEY not configured"

    try:
        client = anthropic.Anthropic(api_key=self.anthropic_key)

        if stream:
            def generate_stream():
                with client.messages.stream(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=2048,
                    system=system_prompt,
                    messages=messages
                ) as stream:
                    for text in stream.text_stream:
                        yield text
            return generate_stream()
        else:
            # Non-streaming response
            response = client.messages.create(...)
            return response.content[0].text
    except Exception as e:
        return f"Error: {str(e)}"
```

## SSE Streaming Pattern

### Route Handler
```python
from flask import Response
import json

@chat_bp.route('/api/chat/stream', methods=['POST'])
@login_required
def stream_message():
    """Stream AI response using Server-Sent Events."""
    # ... validation and setup ...

    def generate():
        """Generator for streaming response."""
        try:
            full_response = ""
            stream = llm_service.generate_response(
                messages=conversation,
                context=context,
                stream=True
            )

            # Check if we got a string (error) or iterator
            if isinstance(stream, str):
                yield f"data: {json.dumps({'content': stream, 'done': True})}\n\n"
            else:
                # Stream the response
                for chunk in stream:
                    full_response += chunk
                    yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"

                # Send completion signal
                yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"

                # Store complete response
                if full_response:
                    ChatMessage.create(thread_id, 'assistant', full_response)

        except Exception as e:
            error_msg = f"Sorry, I encountered an error: {str(e)}"
            yield f"data: {json.dumps({'content': error_msg, 'done': True})}\n\n"

    return Response(generate(), mimetype='text/event-stream')
```

### JavaScript Client (Frontend)
```javascript
async function sendMessage() {
    const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            thread_id: currentThreadId,
            message: message
        })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = '';
    let messageElement = null;

    while (true) {
        const {done, value} = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6));

                if (!data.done) {
                    assistantMessage += data.content;
                    if (!messageElement) {
                        messageElement = addStreamingMessage();
                    }
                    updateStreamingMessage(messageElement, assistantMessage);
                }
            }
        }
    }
}
```

## Blueprint Registration Pattern

### App Factory
```python
def create_app(config_name='development'):
    app = Flask(__name__)

    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key')
    app.config['SESSION_TYPE'] = 'filesystem'

    # Initialize extensions
    session.init_app(app)
    limiter.init_app(app)

    # Initialize database
    from app.models import init_db
    with app.app_context():
        init_db()

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.chat import chat_bp
    from app.routes.insights import insights_bp
    from app.routes.admin import admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(insights_bp)
    app.register_blueprint(admin_bp)

    return app
```

## Error Handling Patterns

### API Errors
```python
@chat_bp.route('/api/threads', methods=['POST'])
@login_required
def create_thread():
    try:
        user_id = session['user_id']
        title = request.json.get('title', 'New Chat')
        thread_id = ChatThread.create(user_id, title)
        return jsonify({'success': True, 'thread_id': thread_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### Ownership Verification
```python
# Verify ownership
thread = ChatThread.get_by_id(thread_id)
if not thread or thread['user_id'] != session['user_id']:
    return jsonify({'error': 'Thread not found'}), 404
```

## Telekom Design System

### Color Variables
```css
:root {
    --primary: #E20074;        /* Telekom Magenta */
    --secondary: #001E50;      /* Telekom Dark Blue */
    --background: #F5F5F5;
    --surface: #FFFFFF;
    --text-primary: #1A1A1A;
    --text-secondary: #666666;
    --border: #E0E0E0;
    --success: #00AB84;
    --error: #E63946;
}
```

### Gradient Avatar Pattern
```javascript
function generateGradient(email) {
    const colors = [
        ['#E20074', '#FF6B9D'],  // Magenta
        ['#001E50', '#0066B3'],  // Blue
        ['#00AB84', '#00D9A5'],  // Green
        // ... more gradients
    ];

    const hash = email.split('').reduce((acc, char) =>
        acc + char.charCodeAt(0), 0);
    const index = hash % colors.length;

    return `linear-gradient(135deg, ${colors[index][0]}, ${colors[index][1]})`;
}
```

## Security Patterns

### Input Sanitization
```python
def sanitize_input(text):
    """Sanitize user input."""
    if not text:
        return ""
    # Remove excessive whitespace
    text = ' '.join(text.split())
    # Limit length
    return text[:5000]
```

### Rate Limiting
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["1000 per day", "100 per hour"]
)

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    # Login logic
```

### Admin Endpoint Protection
```python
def admin_required(f):
    """Decorator to require admin key."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        admin_key = request.headers.get('X-Admin-Key')
        if admin_key != os.getenv('ADMIN_API_KEY'):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function
```
