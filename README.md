# ConfAI - AI-Powered Conference Insights Platform

> A sophisticated chat application for conference attendees with multi-model AI support, vector embeddings, and collaborative insights sharing.

![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-3.1-green.svg)
![Claude](https://img.shields.io/badge/Claude-Sonnet_4.5-purple.svg)
![Gemini](https://img.shields.io/badge/Gemini-2.0_Flash-blue.svg)
![Status](https://img.shields.io/badge/Status-Production_Ready-green.svg)

---

## 🎯 Overview

ConfAI is a production-ready AI chat platform designed for conference attendees, featuring:

- ✅ **Multi-Model AI** - Support for Claude, Gemini, Grok, and Perplexity
- ✅ **Hybrid Context System** - Choose between Context Window or Vector Embeddings
- ✅ **Email/PIN Authentication** - Secure, passwordless login
- ✅ **Real-time Streaming** - Word-by-word AI responses via SSE
- ✅ **Insights Wall** - Share and vote on AI-generated insights
- ✅ **Admin Dashboard** - Manage settings, context files, and embeddings
- ✅ **Token Tracking** - Monitor usage across models with cache optimization

**Access**: Run locally or deploy to your server

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+ installed
- At least one AI API key (Claude, Gemini, Grok, or Perplexity)
- 2GB RAM minimum (4GB recommended for vector embeddings)

### Installation

```bash
# Clone or navigate to project directory
cd /path/to/ConfAI

# Create virtual environment (if not exists)
python -m venv venv

# Activate virtual environment
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

### Configuration

1. **Create `.env` file** (or update existing):

```bash
# Flask Configuration
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
DEBUG=True

# Database
DATABASE_URL=sqlite:///data/confai.db

# AI Models (at least one required)
ANTHROPIC_API_KEY=sk-ant-...          # For Claude
GEMINI_API_KEY=...                     # For Gemini
GROK_API_KEY=...                       # For Grok (optional)
PERPLEXITY_API_KEY=...                 # For Perplexity (optional)

# Default Settings
LLM_PROVIDER=gemini                    # claude | gemini | grok | perplexity

# Email (Optional - PINs print to console in dev mode)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Security
ADMIN_API_KEY=change-this-in-production
```

2. **Create required directories**:

```bash
mkdir -p data documents/context
```

### Run the Application

```bash
python run.py
```

The application will start on **port 5000**

### First Login

1. Visit the application URL
2. Enter any email address
3. Check the console output for the 6-digit PIN (in development mode)
4. Enter the PIN to log in
5. Start chatting with AI!

---

## 📦 Technology Stack

### Backend
- **Flask 3.1** - Modern Python web framework
- **SQLite** - Lightweight database with raw SQL
- **ChromaDB** - Vector database for embeddings
- **sentence-transformers** - ML models for semantic search

### AI Integration
- **Claude Sonnet 4.5** - Anthropic's latest model with prompt caching
- **Gemini 2.0 Flash** - Google's fast, cost-effective model
- **Grok** - xAI's conversational model
- **Perplexity** - Web-connected reasoning

### Frontend
- **Vanilla JavaScript** - No frameworks, fast loading
- **Server-Sent Events** - Real-time streaming
- **Responsive CSS** - Telekom-inspired design

---

## ✨ Key Features

### 🤖 Multi-Model AI Support

Switch between AI models instantly:
- **Claude Sonnet 4.5** - Best quality, prompt caching for cost optimization
- **Gemini 2.0 Flash** - Fastest, most cost-effective
- **Grok** - Alternative conversational model
- **Perplexity** - Web-connected for current information

Model switching persists across all users and processes.

### 🧠 Hybrid Context System

#### **Context Window Mode** (Simple & Fast)
- Loads all enabled context files directly into AI prompt
- Best for: Small datasets, holistic understanding
- Pros: See everything, no preprocessing
- Cons: Limited by token limits, higher costs

#### **Vector Embeddings Mode** (Smart & Scalable)
- Uses semantic search to find relevant chunks
- Powered by ChromaDB + sentence-transformers
- Best for: Large datasets, specific questions
- Pros: Scalable, cost-effective, semantic understanding
- Cons: Requires preprocessing, may miss context

**Easy switching** in Admin > Settings > Context Mode

### 💬 Advanced Chat Features

- **Multi-threaded conversations** - Unlimited chat threads per user
- **Real-time streaming** - AI responses appear word-by-word
- **Context-aware** - Includes last 10 messages for continuity
- **Token tracking** - Monitor input, output, and cache usage per model
- **Activity logging** - Track conversation starts and model usage

### 📊 Admin Dashboard

Comprehensive admin interface at `/admin`:

1. **System Prompt** - Customize AI behavior
2. **Context Files** - Upload and manage .txt/.md files
   - Enable/disable individual files
   - Preview file contents
   - Track token usage
3. **Insights Management** - Moderate user-shared insights
4. **Statistics** - View usage metrics:
   - Total users, threads, insights
   - Token usage by model
   - Cache efficiency (Claude)
   - Recent activity log
5. **Settings**
   - Default LLM provider
   - Context mode (window vs embeddings)
   - Welcome message
   - Rate limits
   - Votes/shares per user

### 🎯 Insights Wall

Collaborative knowledge sharing:
- **Share insights** from AI conversations
- **Vote system** - 👍 Upvote / 👎 Downvote
- **Limited votes** - 3 votes per user
- **Vote reveal** - Counts hidden until all votes cast
- **User attribution** - Gradient avatars with names

### 🔒 Security

- **Email/PIN authentication** - Passwordless, secure login
- **Rate limiting** - Prevent abuse (200/min, 2000/hour)
- **Session management** - Secure filesystem sessions
- **Input sanitization** - 5000 character limit
- **Ownership verification** - All operations check user ownership
- **Admin key protection** - Admin endpoints require API key

---

## 📁 Project Structure

```
ConfAI/
├── app/
│   ├── __init__.py              # Flask app factory
│   ├── models/__init__.py       # Database models (8 tables)
│   ├── routes/
│   │   ├── auth.py              # Email/PIN authentication
│   │   ├── chat.py              # Streaming chat with multi-model support
│   │   ├── insights.py          # Insights wall with voting
│   │   └── admin.py             # Admin dashboard and management
│   ├── services/
│   │   ├── llm_service.py       # Multi-model LLM integration
│   │   ├── embedding_service.py # ChromaDB vector embeddings
│   │   └── email_service.py     # PIN email delivery
│   ├── utils/helpers.py         # Utility functions & decorators
│   ├── static/
│   │   ├── css/
│   │   │   ├── chat.css         # Chat interface styles
│   │   │   ├── admin.css        # Admin dashboard styles
│   │   │   └── insights.css     # Insights wall styles
│   │   └── js/
│   │       ├── chat.js          # Chat functionality
│   │       ├── admin.js         # Admin functionality
│   │       └── insights.js      # Insights functionality
│   └── templates/
│       ├── base.html            # Base template
│       ├── login.html           # Login interface
│       ├── chat.html            # Chat interface
│       ├── admin.html           # Admin dashboard
│       └── insights.html        # Insights wall
├── documents/
│   └── context/                 # Context files (.txt, .md)
├── data/
│   ├── confai.db                # SQLite database
│   ├── chromadb/                # Vector embeddings storage
│   ├── system_prompt.txt        # Customizable system prompt
│   └── context_config.json      # File enable/disable config
├── venv/                        # Virtual environment
├── .env                         # Environment configuration
├── requirements.txt             # Python dependencies
├── run.py                       # Application entry point
├── README.md                    # This file
└── GETTING_STARTED.md           # Detailed installation guide
```

---

## 🔧 Configuration

### Database Tables

The application automatically creates 8 tables:

1. **users** - User accounts with email and metadata
2. **auth_codes** - Temporary PINs with expiration
3. **chat_threads** - Conversation threads with model tracking
4. **chat_messages** - Individual messages
5. **insights** - Shared AI insights
6. **votes** - User votes on insights
7. **activity_log** - User actions and model usage
8. **token_usage** - Token consumption tracking by model
9. **settings** - Application settings (key-value store)

### Context Modes

#### Switching Modes

1. Go to Admin > Settings
2. Change "Context Mode" dropdown
3. Click "Save Settings"

**Context Window Mode:**
- All enabled files loaded into prompt
- No preprocessing required
- Files appear in Context Files tab

**Vector Embeddings Mode:**
- Files must be processed first
- Go to Context Files tab
- Click "Process Embeddings"
- Wait for completion (shows document/chunk count)

### Model Selection

Change default model in Admin > Settings:
- **Claude** - Best quality, prompt caching
- **Gemini** - Fastest, cheapest
- **Grok** - Alternative model
- **Perplexity** - Web-connected

Users can also switch models per conversation using the dropdown in chat UI.

---

## 🚀 Deployment

### Development

```bash
python run.py
# Runs on port 5000
# Debug mode enabled
# PINs print to console
```

### Production with Gunicorn

```bash
# Install Gunicorn
pip install gunicorn

# Run with 4 workers
gunicorn --bind 0.0.0.0:5000 --workers 4 run:app

# Configure production settings in .env
FLASK_ENV=production
DEBUG=False
SECRET_KEY=<strong-random-key-64-chars>
```

### Production Checklist

- [ ] Change `SECRET_KEY` to random 64-character string
- [ ] Set `DEBUG=False`
- [ ] Configure SMTP for email PINs
- [ ] Use strong `ADMIN_API_KEY`
- [ ] Consider PostgreSQL instead of SQLite
- [ ] Set up HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up monitoring/logging
- [ ] Regular database backups

---

## 📊 Usage Statistics

### Token Tracking

View token usage in Admin > Statistics:
- **Tokens Sent** - Input + cache creation tokens
- **Tokens Received** - Output tokens
- **Cache Tokens Read** - Cached prompt tokens (Claude only)
- **By Model** - Breakdown per model

### Activity Logging

Track user actions:
- New conversation starts
- Model switches
- Insight sharing
- Timestamp and user attribution

---

## 🐛 Troubleshooting

### Embeddings Processing Fails

**Solution**: Check that:
1. Files are uploaded to `documents/context/`
2. Files are .txt or .md format
3. At least 2GB RAM available
4. No errors in console

### Model Not Responding

**Solution**: Verify:
1. API key is correct in `.env`
2. API key has credits/quota
3. Check console for error messages
4. Try switching to different model

### Context Window Too Large

**Solution**:
1. Switch to Vector Embeddings mode
2. Or disable some context files
3. Check token count in Admin > Context Files

### Database Locked

**Solution**: SQLite is single-threaded
1. For production, migrate to PostgreSQL
2. Or reduce concurrent users
3. Or use connection pooling

---

## 📚 API Reference

### Authentication
- `POST /login` - Request PIN (rate limited: 5/min)
- `POST /verify` - Verify PIN and login (rate limited: 10/min)
- `POST /logout` - End session

### Chat
- `GET /api/threads` - List user's threads
- `POST /api/threads` - Create new thread
- `DELETE /api/threads/<id>` - Delete thread
- `POST /api/chat/stream` - Send message with SSE streaming

### Insights
- `GET /api/insights` - Get all insights with vote status
- `POST /api/insights` - Share new insight
- `POST /api/insights/<id>/vote` - Vote (upvote/downvote)

### Admin (requires `X-Admin-Key` header)
- `GET /api/admin/stats` - Get usage statistics
- `GET /api/admin/context-files` - List context files
- `POST /api/admin/context-files` - Upload context files
- `POST /api/admin/embeddings/process` - Process embeddings
- `GET /api/admin/embeddings/stats` - Get embedding stats

---

## 🎓 Advanced Features

### Prompt Caching (Claude)

Claude automatically caches system prompts:
- **Cache Creation** - First request pays full cost
- **Cache Read** - Subsequent requests save 90% on cached content
- **24-hour TTL** - Cache expires after 24 hours
- **Stats Tracked** - View in Admin > Statistics

### Semantic Search (Vector Embeddings)

When in Vector Embeddings mode:
1. Documents chunked into 512-char segments (128-char overlap)
2. Each chunk converted to vector embedding
3. User query converted to embedding
4. Top 5 most similar chunks retrieved
5. Only relevant chunks sent to AI

**Benefits:**
- Handles large document collections
- Finds semantic matches (not just keywords)
- Cost-effective (only send relevant content)
- Scalable to millions of documents

---

## 📖 Documentation

- **README.md** - This file (overview and quick start)
- **GETTING_STARTED.md** - Detailed installation guide
- **requirements.txt** - Python dependencies with versions

---

## 🤝 Support

For issues or questions:
1. Check this README
2. Check GETTING_STARTED.md
3. Review console output for errors
4. Contact administrator

---

## 📄 License

Proprietary - For internal conference use only

---

## ✨ Credits

**Built with:**
- Claude Sonnet 4.5 (Anthropic)
- Gemini 2.0 Flash (Google)
- Flask Web Framework
- ChromaDB Vector Database
- Sentence Transformers

**Created for:** Conference attendees and knowledge sharing

---

**🎉 Production Ready - Start leveraging AI for conference insights today!**
