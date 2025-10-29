# ConfAI - LLM-Based Chat Application

> A Telekom-inspired chat application for conference attendees with AI-powered responses, embeddings from conference materials, and collaborative insights sharing.

![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-3.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## 🎯 Overview

ConfAI is an invite-only chat platform for up to 150 high-level conference attendees. It features:

- **Email-based Authentication** with PIN codes
- **Multi-threaded Chat** with streaming LLM responses
- **Embeddings** from conference books and transcripts
- **Insights Wall** with voting (3 votes per user)
- **Telekom-inspired UI** with modern, professional design

---

## 🏗️ Project Structure

```
ConfAI/
├── app/
│   ├── __init__.py           # Flask app factory
│   ├── models/               # Database models
│   │   └── __init__.py       # User, ChatThread, ChatMessage, Insight models
│   ├── routes/               # API endpoints (to be created)
│   │   ├── auth.py           # Authentication routes
│   │   ├── chat.py           # Chat functionality
│   │   ├── insights.py       # Insights wall
│   │   └── admin.py          # Admin endpoints
│   ├── services/             # Business logic (to be created)
│   │   ├── llm_service.py    # LLM API integration
│   │   ├── embedding_service.py  # Document embeddings
│   │   └── email_service.py  # Email PIN delivery
│   ├── utils/                # Utilities (to be created)
│   │   └── helpers.py        # Helper functions
│   ├── static/               # CSS, JS assets
│   │   ├── css/
│   │   └── js/
│   └── templates/            # HTML templates
├── documents/
│   ├── books/                # PDF/TXT books
│   └── transcripts/          # Conference transcripts
├── data/                     # SQLite database
├── venv/                     # Python virtual environment
├── run.py                    # Application entry point
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
└── README.md                 # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10 or higher
- Git

### 1. Clone the Repository

```bash
cd C:\Users\belic\Claude\confAI\ConfAI
```

### 2. Set Up Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

```bash
# Copy the example .env file
cp .env.example .env

# Edit .env with your API keys and configuration
```

**Required Environment Variables:**
- `SECRET_KEY`: Flask secret key for sessions
- `ANTHROPIC_API_KEY`: Claude API key (or other LLM keys)
- `SMTP_USERNAME` / `SMTP_PASSWORD`: Email credentials for PIN delivery
- `VECTOR_STORAGE`: Choose `faiss` or `pinecone`

### 5. Initialize Database

The database will be automatically initialized on first run:

```bash
python run.py
```

### 6. Access the Application

Open your browser and navigate to:
```
http://localhost:5000
```

---

## 📦 Technology Stack

**Backend:**
- **Flask** 3.0 - Web framework
- **SQLite** - Database
- **SQLAlchemy** - ORM
- **Flask-Session** - Session management
- **Flask-Limiter** - Rate limiting

**AI/ML:**
- **Anthropic** - Claude API client
- **Transformers** - BAAI/bge-large-en-v1.5 embeddings
- **FAISS** / **Pinecone** - Vector storage
- **PyPDF2** - PDF parsing

**Frontend:**
- HTML5/CSS3/JavaScript
- Server-Sent Events (SSE) for streaming responses
- Telekom-inspired design system

---

## 🔑 Key Features

### 1. Authentication
- Email-based login with PIN codes
- JWT session tokens
- Invite-only access (150 users max)
- Rate limiting (5 attempts per minute)

### 2. Chat Interface
- Multiple chat threads per user
- Streaming LLM responses
- Support for Claude, Grok, and Perplexity APIs
- Context-aware responses using embeddings

### 3. Document Embeddings
- Automatic PDF/TXT parsing
- BAAI/bge-large-en-v1.5 model for embeddings
- FAISS (in-memory) or Pinecone (cloud) storage
- Admin API for real-time document updates

### 4. Insights Wall
- Share AI insights from chats
- Upvote/downvote system
- 3 votes per user limit
- Vote results revealed after all votes cast
- Sorted by net votes (upvotes - downvotes)

---

## 🎨 Design System

The UI follows Telekom's design principles:

**Colors:**
- Primary (Magenta): `#E20074`
- Secondary (Blue): `#001E50`
- Background: `#FFFFFF`
- Sidebar: `#F8F8F8`

**Components:**
- Gradient avatars (randomly generated)
- Card-based insights
- Clean, minimalistic chat interface
- Responsive design (mobile-first)

---

## 🐳 Docker Deployment

### Build and Run with Docker

```bash
# Build the Docker image
docker build -t confai:latest .

# Run with docker-compose
docker-compose up -d
```

### Docker Configuration

```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=production
    volumes:
      - ./data:/app/data
      - ./documents:/app/documents
```

---

## 📚 API Endpoints

### Authentication
- `POST /login` - Request PIN code
- `POST /verify` - Verify PIN and login
- `GET /logout` - Logout user

### Chat
- `GET /chat` - Main chat page
- `POST /api/chat` - Send message and get streaming response
- `GET /api/threads` - List user's chat threads
- `POST /api/threads` - Create new thread
- `DELETE /api/threads/<id>` - Delete thread

### Insights
- `GET /insights` - View insights wall
- `POST /api/insights` - Share insight
- `POST /api/insights/<id>/vote` - Vote on insight

### Admin
- `POST /api/update-transcript` - Upload/update documents (requires admin key)

---

## 🔒 Security Features

- **HTTPS** enforcement (configure in production)
- **Rate limiting** on login and API calls
- **Input sanitization** to prevent prompt injection
- **Session management** with secure cookies
- **Invite-only** access with pre-registered emails

---

## 📝 Development Status

### ✅ Completed
- [x] Project structure
- [x] Virtual environment setup
- [x] Database models (Users, ChatThreads, Messages, Insights, Votes)
- [x] Flask app factory
- [x] Configuration system

### 🚧 In Progress
- [ ] Route blueprints (auth, chat, insights, admin)
- [ ] LLM service integration
- [ ] Embedding service
- [ ] Email service for PINs
- [ ] Frontend templates and CSS

### 📋 TODO
- [ ] Docker configuration
- [ ] Unit tests
- [ ] Documentation site
- [ ] Deployment scripts

---

## 🤝 Contributing

This is a private project for conference attendees. For questions or issues, contact the administrator.

---

## 📄 License

Proprietary - For conference use only

---

## 🆘 Support

For setup assistance or bug reports, please contact:
- **Email**: support@confai.com
- **Documentation**: See `Project Documentation Simple LLM-Ba.txt`

---

## 🎓 Documentation Files

- `Project Documentation Simple LLM-Ba.txt` - Full project requirements
- `Design Guide for the LLM-Based Chat.txt` - UI/UX guidelines
- `Telekom-Inspired CSS Library for Chat App.txt` - CSS reference

---

**Built with ❤️ for high-level conference attendees**
