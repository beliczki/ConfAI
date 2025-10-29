# ConfAI Project Overview

## Project Purpose
ConfAI is an LLM-based chat application designed for conference attendees. It provides:
- AI-powered conversations using Claude/Grok/Perplexity
- Document embeddings from conference materials (books, transcripts)
- Insights wall where users can share and vote on AI-generated insights
- Beautiful Telekom-inspired UI design

## Tech Stack
- **Backend**: Python Flask 3.1.2
- **Database**: SQLite with raw SQL (no ORM)
- **LLM Integration**: Anthropic Claude API (primary), Grok, Perplexity
- **Authentication**: Email + PIN code (15-minute expiration)
- **Sessions**: Flask-Session with filesystem storage
- **Rate Limiting**: Flask-Limiter
- **Frontend**: Vanilla JavaScript, Jinja2 templates, CSS
- **Design**: Telekom-inspired (#E20074 magenta, #001E50 blue)

## Key Features Implemented
✅ Email/PIN authentication system
✅ Multi-threaded chat with streaming AI responses
✅ Thread management (create, select, delete)
✅ Server-Sent Events (SSE) for real-time streaming
✅ User avatars with gradient backgrounds
✅ Rate limiting on authentication endpoints
✅ Session management
✅ Database with 6 tables (Users, LoginTokens, ChatThreads, ChatMessages, Insights, Votes)

## Features TODO
- Insights wall UI with voting functionality
- Document embedding system (BAAI/bge-large-en-v1.5 + FAISS/Pinecone)
- PDF/TXT parsing and chunking
- Context search integration with chat
- Docker deployment configuration
- Admin dashboard for document management

## Directory Structure
```
ConfAI/
├── app/
│   ├── __init__.py           # Flask app factory
│   ├── models/
│   │   └── __init__.py       # Database models (6 tables)
│   ├── routes/
│   │   ├── auth.py           # Authentication (login, verify, logout)
│   │   ├── chat.py           # Chat & streaming
│   │   ├── insights.py       # Insights wall with voting
│   │   └── admin.py          # Document upload
│   ├── services/
│   │   ├── email_service.py  # PIN email delivery
│   │   ├── llm_service.py    # LLM integration (Claude/Grok/Perplexity)
│   │   └── embedding_service.py  # Document embeddings (placeholder)
│   ├── utils/
│   │   └── helpers.py        # Utility functions
│   ├── static/               # CSS/JS (currently empty, using inline)
│   └── templates/
│       ├── base.html         # Base template with Telekom design
│       ├── login.html        # Email/PIN login
│       ├── chat.html         # Chat interface with SSE streaming
│       └── insights.html     # Insights wall (placeholder)
├── documents/
│   ├── books/                # PDF/TXT books
│   └── transcripts/          # Conference transcripts
├── data/                     # SQLite database (confai.db)
├── venv/                     # Virtual environment
├── .env                      # Environment variables (API keys)
├── requirements.txt          # Python dependencies
├── run.py                    # Application entry point
└── README.md                 # Project documentation
```

## Database Schema
- **users**: id, email, name, avatar_gradient, created_at
- **login_tokens**: id, email, token (6-digit PIN), expires_at, used, created_at
- **chat_threads**: id, user_id, title, created_at, updated_at
- **chat_messages**: id, thread_id, role (user/assistant), content, created_at
- **insights**: id, user_id, content, vote_count, created_at
- **votes**: id, user_id, insight_id, vote_type (upvote/downvote), created_at

## Environment Variables (.env)
- `ANTHROPIC_API_KEY`: Claude API key (configured)
- `GROK_API_KEY`: Optional Grok API key
- `PERPLEXITY_API_KEY`: Optional Perplexity API key
- `LLM_PROVIDER`: claude|grok|perplexity (default: claude)
- `SECRET_KEY`: Flask secret key
- `DEBUG`: True|False
- `SMTP_*`: Email configuration (optional in dev)
- `ADMIN_API_KEY`: Admin endpoint authentication
- `MAX_USERS`: 150
- `VOTES_PER_USER`: 3

## Running the Application
```bash
# Activate virtual environment
cd "C:\Users\belic\Claude\confAI\ConfAI"
venv/Scripts/activate

# Install dependencies (already done)
pip install -r requirements.txt

# Run application
python run.py

# Access at: http://localhost:5000
```

## Development Status
**Overall**: ~65% Complete

- ✅ Backend Structure: 100%
- ✅ Authentication: 100%
- ✅ Database Models: 100%
- ✅ API Routes: 100%
- ✅ LLM Integration: 100%
- ✅ Chat UI: 100%
- ⚠️ Insights Wall: 30% (structure ready, needs UI)
- ❌ Embedding System: 20% (placeholder only)
- ❌ Docker: 0% (not started)
