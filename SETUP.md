# ConfAI - Setup Guide

## ✅ What's Been Completed

### Infrastructure ✓
- [x] Python virtual environment created
- [x] Project structure organized
- [x] Flask application factory pattern
- [x] SQLite database with comprehensive models
- [x] Environment configuration system

### Backend ✓
- [x] **Authentication Routes** - Email/PIN login system
- [x] **Chat Routes** - Thread and message management
- [x] **Insights Routes** - Wall with voting system
- [x] **Admin Routes** - Document upload/management
- [x] **Email Service** - Beautiful HTML PIN emails
- [x] **LLM Service** - Claude/Grok/Perplexity integration
- [x] **Embedding Service** - Structure for document processing
- [x] **Utility Helpers** - Common functions and decorators

### Frontend ✓
- [x] **Base Template** - Telekom-inspired design system
- [x] **Login Page** - Beautiful email/PIN authentication
- [x] **Chat Page** - Placeholder interface
- [x] **Insights Page** - Placeholder wall

### Database Models ✓
- [x] Users (email, name, avatar gradient)
- [x] Login tokens (PIN codes with expiration)
- [x] Chat threads (multi-threaded conversations)
- [x] Chat messages (user and AI responses)
- [x] Insights (shared AI insights)
- [x] Votes (3 votes per user, vote tracking)

---

## 🚀 Quick Start

### 1. Activate Virtual Environment

```bash
cd /path/to/ConfAI

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

**Note**: This may take a few minutes as it includes:
- Flask and extensions
- Anthropic Claude SDK
- Google Generative AI SDK (for Gemini)
- ChromaDB (for vector embeddings)
- And other dependencies

### 3. Configure Environment

The `.env` file has been created with defaults. **You must add**:

```bash
# Required for AI chat functionality
ANTHROPIC_API_KEY=your_claude_api_key_here

# Optional (for email PINs in production)
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

**For development**: PINs will be printed to console, so email setup is optional.

### 4. Run the Application

```bash
python run.py
```

The application will start on port 5000

### 5. Test the Login

1. Open the application URL in your browser
2. Enter any valid email address
3. Check the console output for the PIN code
4. Enter the 4-digit PIN
5. You'll be logged in and redirected to the chat page

---

## 📁 Project Structure

```
ConfAI/
├── app/
│   ├── __init__.py              ✓ Flask app factory
│   ├── models/
│   │   └── __init__.py          ✓ Database models & helpers
│   ├── routes/
│   │   ├── auth.py              ✓ Authentication endpoints
│   │   ├── chat.py              ✓ Chat functionality
│   │   ├── insights.py          ✓ Insights wall
│   │   └── admin.py             ✓ Document management
│   ├── services/
│   │   ├── email_service.py     ✓ PIN email delivery
│   │   ├── llm_service.py       ✓ LLM integration
│   │   └── embedding_service.py ✓ Document embeddings (placeholder)
│   ├── utils/
│   │   └── helpers.py           ✓ Utility functions
│   ├── static/
│   │   ├── css/                 (empty, ready for CSS files)
│   │   └── js/                  (empty, ready for JS files)
│   └── templates/
│       ├── base.html            ✓ Base template
│       ├── login.html           ✓ Login page
│       ├── chat.html            ✓ Chat page (placeholder)
│       └── insights.html        ✓ Insights page (placeholder)
├── documents/
│   ├── books/                   (for PDF/TXT books)
│   └── transcripts/             (for conference transcripts)
├── data/                        (SQLite database created on first run)
├── venv/                        ✓ Virtual environment
├── .env                         ✓ Environment variables
├── .env.example                 ✓ Template for .env
├── .gitignore                   ✓ Git ignore rules
├── requirements.txt             ✓ Python dependencies
├── run.py                       ✓ Application entry point
├── README.md                    ✓ Project documentation
└── SETUP.md                     ✓ This file
```

---

## 🔑 Current Features

### ✅ Working Now

1. **Authentication System**
   - Email-based login
   - 4-digit PIN codes
   - 15-minute expiration
   - Session management
   - Rate limiting (5 attempts/min)

2. **Database**
   - SQLite with comprehensive schema
   - User management
   - Thread and message storage
   - Insights with voting
   - Automatic initialization

3. **API Endpoints**
   - All route blueprints registered
   - Authentication routes functional
   - Chat thread management ready
   - Insights wall structure ready
   - Admin document upload ready

4. **LLM Integration Structure**
   - Claude API client configured
   - Grok API support
   - Perplexity API support
   - Streaming response structure
   - System prompt configured

### 🚧 Next Steps (TODO)

1. **Chat UI Enhancement**
   - Real-time message display
   - SSE streaming implementation
   - Thread switching
   - Message history loading
   - Typing indicators

2. **LLM Integration**
   - Connect chat routes to LLM service
   - Implement streaming responses
   - Add context from embeddings
   - Error handling and retries

3. **Insights Wall**
   - Card-based insight display
   - Voting UI with animations
   - Vote count reveal logic
   - Share button in chat

4. **Embedding System**
   - Gemini embeddings (text-embedding-004) integration
   - PDF/TXT parsing
   - Text chunking and embedding
   - ChromaDB vector storage
   - Context search integration

5. **Frontend Polish**
   - JavaScript for interactivity
   - CSS animations
   - Responsive mobile design
   - Avatar gradient display
   - Telekom branding refinement

6. **Docker Deployment**
   - Dockerfile
   - docker-compose.yml
   - Production configuration
   - Gunicorn setup

---

## 🧪 Testing

### Test Authentication
```bash
curl -X POST http://your-domain.com/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Check console for PIN, then verify:
```bash
curl -X POST http://your-domain.com/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","pin":"123456"}'
```

### Test API Endpoints
```bash
# Create thread (requires login cookie)
curl -X POST http://your-domain.com/api/threads \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"title":"Test Chat"}'

# Upload document (requires admin key)
curl -X POST http://your-domain.com/api/update-transcript \
  -H "X-Admin-Key: admin-secret-key-change-this" \
  -F "file=@document.pdf" \
  -F "type=transcript"
```

---

## 🐛 Troubleshooting

### Issue: Import Errors
**Solution**: Make sure virtual environment is activated and dependencies are installed:
```bash
venv\Scripts\activate
pip install -r requirements.txt
```

### Issue: Database Errors
**Solution**: Delete the database and let it reinitialize:
```bash
rm -rf data/
python run.py
```

### Issue: PIN Not Appearing
**Solution**: Check console output where Flask is running. PINs are printed in development mode.

### Issue: Port Already in Use
**Solution**: Change port in `run.py`:
```python
app.run(host='0.0.0.0', port=5001, debug=debug)
```

---

## 📊 Development Status

**Overall Progress**: 60% Complete

- ✅ **Backend Structure**: 100%
- ✅ **Authentication**: 100%
- ✅ **Database Models**: 100%
- ✅ **API Routes**: 100%
- ⚠️ **LLM Integration**: 80% (structure ready, needs connection)
- ⚠️ **Chat UI**: 30% (basic layout, needs JavaScript)
- ⚠️ **Insights Wall**: 30% (structure ready, needs UI)
- ❌ **Embedding System**: 20% (placeholder only)
- ❌ **Docker**: 0% (not started)

---

## 🎯 Immediate Next Actions

1. **Add your Anthropic API key** to `.env`
2. **Test the login flow** at `http://localhost:5000`
3. **Implement chat streaming** with SSE
4. **Build the chat interface** with JavaScript
5. **Add insights wall UI** with voting

---

## 📞 Support

For issues or questions:
- Check console output for errors
- Review Flask logs
- Check `.env` configuration
- Verify API keys are valid

---

**Status**: ✅ Ready for development and testing!
**Next Focus**: Chat UI and LLM integration
