# ConfAI File Reference

## Core Application Files

### `/run.py` - Application Entry Point
**Purpose:** Main entry point that creates and runs the Flask application
**Key Functions:**
- Creates Flask app using app factory
- Runs development server on port 5000
- Loads DEBUG setting from environment

---

### `/app/__init__.py` - Flask App Factory
**Purpose:** Creates and configures the Flask application
**Key Components:**
- `create_app(config_name='development')`: App factory function
- Registers all blueprints (auth, chat, insights, admin)
- Initializes extensions (Flask-Session, Flask-Limiter)
- Initializes database on startup

**Extension Instances:**
```python
from flask_session import Session
from flask_limiter import Limiter

session = Session()
limiter = Limiter(key_func=get_remote_address)
```

---

## Database Layer

### `/app/models/__init__.py` - Database Models
**Purpose:** Database models and helpers using raw SQL with SQLite
**Key Components:**

**Context Manager:**
- `get_db()`: Returns database connection with auto-commit/rollback

**Model Classes (all use @staticmethod):**
- `User`: create(), get_by_email(), get_by_id()
- `LoginToken`: create(), get_valid_token(), mark_used(), cleanup_expired()
- `ChatThread`: create(), get_by_id(), get_by_user(), delete(), update_timestamp()
- `ChatMessage`: create(), get_by_thread()
- `Insight`: create(), get_all(), get_by_id(), delete(), increment_vote(), decrement_vote()
- `Vote`: create(), get_user_votes(), get_vote_count(), delete(), has_voted()

**Database Initialization:**
- `init_db()`: Creates all tables with proper schema and indexes

**Schema Tables:**
1. `users`: id, email, name, avatar_gradient, created_at
2. `login_tokens`: id, email, token, expires_at, used, created_at
3. `chat_threads`: id, user_id, title, created_at, updated_at
4. `chat_messages`: id, thread_id, role, content, created_at
5. `insights`: id, user_id, content, vote_count, created_at
6. `votes`: id, user_id, insight_id, vote_type, created_at

---

## Route Blueprints

### `/app/routes/auth.py` - Authentication Routes
**Purpose:** Email/PIN authentication system
**Endpoints:**
- `GET /`: Login page
- `POST /login`: Request PIN (rate limited: 5/min)
- `POST /verify`: Verify PIN and create session (rate limited: 10/min)
- `POST /logout`: Clear session
- `GET /me`: Get current user info

**Key Functions:**
- Generates 6-digit PIN codes
- Sends PIN via email (or prints to console in dev)
- Creates user on first login
- Manages Flask session

---

### `/app/routes/chat.py` - Chat Routes
**Purpose:** Chat thread and message management with LLM streaming
**Endpoints:**
- `GET /chat`: Chat page
- `GET /api/threads`: Get user's threads
- `POST /api/threads`: Create new thread
- `DELETE /api/threads/<id>`: Delete thread
- `GET /api/threads/<id>/messages`: Get thread messages
- `POST /api/chat`: Send message (non-streaming)
- `POST /api/chat/stream`: Send message with SSE streaming

**Key Features:**
- Ownership verification on all operations
- Conversation context (last 10 messages)
- Embedding context integration
- Full error handling in streaming
- Stores complete response after streaming

**SSE Response Format:**
```json
data: {"content": "chunk", "done": false}
data: {"content": "", "done": true}
```

---

### `/app/routes/insights.py` - Insights Wall Routes
**Purpose:** Shared insights with voting system
**Endpoints:**
- `GET /insights`: Insights wall page
- `GET /api/insights`: Get all insights with vote status
- `POST /api/insights`: Create new insight
- `POST /api/insights/<id>/vote`: Vote on insight (upvote/downvote)
- `DELETE /api/insights/<id>/vote`: Remove vote

**Voting Logic:**
- 3 votes per user maximum
- Can't vote twice on same insight
- Vote counts hidden until all votes used
- Can change vote by deleting and re-voting

---

### `/app/routes/admin.py` - Admin Routes
**Purpose:** Document upload and management
**Endpoints:**
- `POST /api/update-transcript`: Upload document (requires admin key)

**Security:**
- Requires `X-Admin-Key` header
- Validates against `ADMIN_API_KEY` env variable

**File Handling:**
- Accepts PDF and TXT files
- Saves to `documents/transcripts/` or `documents/books/`
- Triggers embedding processing (placeholder)

---

## Service Layer

### `/app/services/email_service.py` - Email Service
**Purpose:** Send PIN codes via email
**Key Components:**
- `send_pin_email(email, pin)`: Main function
- Beautiful HTML email template with Telekom branding
- SMTP configuration via environment variables
- Falls back to console output in development

**Email Template:**
- Telekom magenta header
- PIN code prominently displayed
- 15-minute expiration notice
- Responsive HTML design

---

### `/app/services/llm_service.py` - LLM Integration
**Purpose:** Multi-provider LLM integration with streaming
**Supported Providers:**
- Claude (Anthropic) - Primary
- Grok (xAI)
- Perplexity

**Key Components:**
- `LLMService` class (singleton instance: `llm_service`)
- `generate_response(messages, context, stream)`: Main method
- Provider-specific methods:
  - `_generate_claude()`: Streaming and non-streaming
  - `_generate_grok()`: Via OpenAI-compatible API
  - `_generate_perplexity()`: Via REST API

**System Prompt:**
```
You are a helpful AI assistant specialized in conference insights.
You have access to conference materials and can help attendees...
```

**Streaming Implementation:**
- Uses generator functions
- Returns iterator for streaming, string for non-streaming
- Handles errors gracefully

**Models Used:**
- Claude: `claude-3-5-sonnet-20241022`
- Grok: `grok-2-latest`
- Perplexity: `llama-3.1-sonar-large-128k-online`

---

### `/app/services/embedding_service.py` - Embedding Service (Placeholder)
**Purpose:** Document embedding and semantic search
**Status:** Placeholder implementation

**Planned Features:**
- BAAI/bge-large-en-v1.5 model
- PDF/TXT parsing
- Text chunking (512 chars, 50 overlap)
- FAISS or Pinecone vector storage
- Semantic search

**Current Implementation:**
```python
class EmbeddingService:
    def search_context(self, query, top_k=5):
        return ""  # Placeholder
```

---

## Utility Layer

### `/app/utils/helpers.py` - Helper Functions
**Purpose:** Common utility functions and decorators

**Functions:**
- `generate_pin()`: Creates 6-digit PIN
- `sanitize_input(text)`: Sanitizes user input
- `generate_avatar_gradient(email)`: Creates gradient from email hash

**Decorators:**
- `@login_required`: Requires authenticated session
- `@admin_required`: Requires admin API key (if implemented)

**Avatar Gradients:**
```python
colors = [
    ['#E20074', '#FF6B9D'],  # Magenta
    ['#001E50', '#0066B3'],  # Blue
    ['#00AB84', '#00D9A5'],  # Green
    ['#FF5733', '#FFC300'],  # Orange
    ['#8E44AD', '#C39BD3']   # Purple
]
```

---

## Templates

### `/app/templates/base.html` - Base Template
**Purpose:** Base template with Telekom design system
**Features:**
- CSS variables for Telekom colors
- Responsive meta tags
- Common styles
- Block structure: title, styles, content, scripts

**Color Scheme:**
```css
--primary: #E20074        (Telekom Magenta)
--secondary: #001E50      (Telekom Dark Blue)
--background: #F5F5F5
--surface: #FFFFFF
--text-primary: #1A1A1A
--text-secondary: #666666
```

---

### `/app/templates/login.html` - Login Page
**Purpose:** Email/PIN authentication interface
**Features:**
- Two-step login (email → PIN)
- Animated transitions between steps
- Error message display
- Rate limit handling
- Responsive design

**JavaScript Functions:**
- `requestPin()`: POST /login
- `verifyPin()`: POST /verify
- `showError(message)`: Display errors

---

### `/app/templates/chat.html` - Chat Interface
**Purpose:** Main chat interface with streaming
**Features:**
- Thread list sidebar
- Message display (user right, AI left)
- Gradient avatars
- Typing indicator animation
- SSE streaming integration
- Auto-resize textarea
- Thread management (create, delete)

**JavaScript Functions:**
- `loadUserInfo()`: Fetch /me
- `loadThreads()`: Fetch /api/threads
- `createNewThread()`: POST /api/threads
- `selectThread(id)`: Load thread and messages
- `loadMessages(threadId)`: GET /api/threads/:id/messages
- `sendMessage()`: POST /api/chat/stream (SSE)
- `addMessageToUI(role, content)`: Render message
- `addStreamingMessage()`: Create AI message element
- `updateStreamingMessage(element, content)`: Update during stream
- `showTypingIndicator()` / `hideTypingIndicator()`: Typing animation
- `deleteThread(id)`: DELETE /api/threads/:id
- `autoResize()`: Auto-resize textarea

**Message Layout:**
- User messages: Right-aligned, gradient avatar on right
- AI messages: Left-aligned, robot emoji on left
- Timestamps: Below each message
- Markdown-like styling for content

---

### `/app/templates/insights.html` - Insights Wall (Placeholder)
**Purpose:** Display and vote on insights
**Status:** Placeholder UI, needs implementation

**Planned Features:**
- Card-based layout
- Upvote/downvote buttons
- Vote count display (conditional)
- Share button
- Filter/sort options
- Remaining votes indicator

---

## Configuration Files

### `/.env` - Environment Variables
**Purpose:** Configuration and API keys

**Key Variables:**
```bash
# Flask
FLASK_ENV=development
SECRET_KEY=dev-secret-key-change-in-production
DEBUG=True

# Database
DATABASE_URL=sqlite:///data/confai.db

# LLM
ANTHROPIC_API_KEY=sk-ant-...
GROK_API_KEY=
PERPLEXITY_API_KEY=
LLM_PROVIDER=claude

# Email (optional in dev)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
EMAIL_FROM=noreply@confai.com

# Security
ADMIN_API_KEY=admin-secret-key-change-this
RATE_LIMIT_PER_MINUTE=5

# Settings
MAX_USERS=150
VOTES_PER_USER=3
```

---

### `/requirements.txt` - Python Dependencies
**Purpose:** Python package dependencies

**Core Dependencies:**
- Flask>=3.0.0
- Flask-Session>=0.6.0
- Flask-Limiter>=3.5.0
- SQLAlchemy>=2.0.23
- anthropic>=0.40.0
- httpx>=0.25.2
- requests>=2.31.0
- python-dotenv>=1.0.0
- PyJWT>=2.8.0
- bcrypt>=4.1.2
- gunicorn>=21.2.0

**Optional (Commented Out):**
- transformers, torch, sentence-transformers (for embeddings)
- PyPDF2, pdfplumber (for PDF processing)
- faiss-cpu, pinecone-client (for vector storage)

---

### `/.gitignore` - Git Ignore Rules
**Key Exclusions:**
- `venv/` - Virtual environment
- `__pycache__/`, `*.pyc` - Python cache
- `data/` - SQLite database
- `.env` - Environment variables
- `flask_session/` - Session files
- `documents/` - Uploaded documents
- `.DS_Store`, `Thumbs.db` - OS files

---

## Documentation Files

### `/README.md` - Project Documentation
**Contents:**
- Project overview
- Features list
- Tech stack
- Quick start guide
- Screenshots (placeholders)
- License

---

### `/SETUP.md` - Setup Guide
**Contents:**
- What's been completed checklist
- Quick start instructions
- Project structure diagram
- Current features list
- Next steps (TODO)
- Testing instructions
- Troubleshooting guide
- Development status

---

## Static Assets

### `/app/static/` - Static Files
**Current Status:** Empty (using inline CSS/JS)

**Planned Structure:**
```
static/
├── css/
│   ├── base.css
│   ├── login.css
│   ├── chat.css
│   └── insights.css
├── js/
│   ├── common.js
│   ├── chat.js
│   └── insights.js
└── images/
    └── logo.png
```

---

## Document Storage

### `/documents/` - Uploaded Documents
**Structure:**
```
documents/
├── books/          # PDF/TXT books
└── transcripts/    # Conference transcripts
```

**Status:** Empty, ready for uploads

---

## Data Storage

### `/data/` - Database Storage
**Contents:**
- `confai.db` - SQLite database file
- Created automatically on first run

---

## Virtual Environment

### `/venv/` - Python Virtual Environment
**Purpose:** Isolated Python environment
**Status:** Created and configured
**Packages:** See requirements.txt

---

## File Count Summary

**Python Files:** 10
- 1 entry point (run.py)
- 1 app factory (app/__init__.py)
- 1 models file (app/models/__init__.py)
- 4 route blueprints (auth, chat, insights, admin)
- 3 services (email, llm, embedding)
- 1 utilities (helpers)

**Templates:** 4
- base.html, login.html, chat.html, insights.html

**Configuration:** 4
- .env, .env.example, requirements.txt, .gitignore

**Documentation:** 2
- README.md, SETUP.md

**Context Files:** 5
- .claude/project_overview.md
- .claude/code_patterns.md
- .claude/api_reference.md
- .claude/next_steps.md
- .claude/file_reference.md (this file)

**Total Core Files:** ~25
