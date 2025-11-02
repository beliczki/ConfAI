# Getting Started with ConfAI

A step-by-step guide to install, configure, and deploy the ConfAI platform.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [First Run](#first-run)
5. [Admin Setup](#admin-setup)
6. [Context Files](#context-files)
7. [Vector Embeddings Setup](#vector-embeddings-setup)
8. [Production Deployment](#production-deployment)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before installing ConfAI, ensure you have:

### Required
- **Python 3.10 or higher** - [Download Python](https://www.python.org/downloads/)
- **At least one AI API key**:
  - Claude: [Anthropic Console](https://console.anthropic.com/)
  - Gemini: [Google AI Studio](https://aistudio.google.com/apikey)
  - Grok: [xAI Console](https://console.x.ai/)
  - Perplexity: [Perplexity API](https://www.perplexity.ai/settings/api)

### System Requirements
- **RAM**: 2GB minimum (4GB recommended for vector embeddings)
- **Disk Space**: 500MB for dependencies + storage for your data
- **OS**: Windows, macOS, or Linux

### Optional (for production)
- **SMTP Email Server** - For sending PIN codes via email
- **PostgreSQL** - Alternative to SQLite for production use

---

## Installation

### Step 1: Clone or Download the Project

```bash
# Navigate to your project directory
cd /path/to/ConfAI

# Or clone from repository if available
# git clone <repository-url>
# cd ConfAI
```

### Step 2: Create a Virtual Environment

Creating a virtual environment isolates the project dependencies.

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux:**
```bash
python -m venv venv
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- Flask 3.1 (web framework)
- Anthropic SDK (Claude)
- Google Generative AI (Gemini)
- ChromaDB (vector database)
- sentence-transformers (ML models)
- Other required packages

**Note**: First-time installation of sentence-transformers will download the ML model (~80MB).

### Step 4: Create Required Directories

```bash
# Windows
mkdir data
mkdir documents\context

# macOS/Linux
mkdir -p data documents/context
```

---

## Configuration

### Step 1: Create `.env` File

Create a file named `.env` in the project root directory:

```bash
# Flask Configuration
FLASK_ENV=development
SECRET_KEY=your-secret-key-change-this-in-production
DEBUG=True

# Database
DATABASE_URL=sqlite:///data/confai.db

# AI Models (add at least one)
ANTHROPIC_API_KEY=sk-ant-api03-...
GEMINI_API_KEY=...
GROK_API_KEY=...
PERPLEXITY_API_KEY=...

# Default Settings
LLM_PROVIDER=gemini

# Email Configuration (Optional for development)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Security
ADMIN_API_KEY=change-this-secure-key-for-admin-access
```

### Step 2: Generate a Strong Secret Key

The `SECRET_KEY` is critical for session security. Generate a strong one:

**Python method:**
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output and replace `your-secret-key-change-this-in-production` in `.env`.

### Step 3: Configure Email (Optional)

For development, PIN codes print to the console, so email is optional.

**For Gmail:**
1. Enable 2-factor authentication on your Google account
2. Create an App Password: [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Use the app password in `SMTP_PASSWORD`

**For other providers:**
Update `SMTP_SERVER` and `SMTP_PORT` accordingly.

### Step 4: Choose Default LLM Provider

Set `LLM_PROVIDER` to your preferred model:
- `claude` - Best quality, prompt caching
- `gemini` - Fast and cost-effective (recommended for development)
- `grok` - Alternative model
- `perplexity` - Web-connected reasoning

---

## First Run

### Step 1: Start the Application

```bash
python run.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
 * Debugger is active!
```

### Step 2: Access the Application

Open your browser and navigate to the application URL (default: port 5000)

### Step 3: First Login

1. Enter any email address (e.g., `test@example.com`)
2. Click "Send Code"
3. **Check the console output** for the 6-digit PIN
4. Enter the PIN and click "Verify"
5. You're now logged in!

**Development Note**: In development mode (`DEBUG=True`), PIN codes are printed to the console instead of being emailed.

---

## Admin Setup

### Step 1: Access Admin Dashboard

Navigate to the admin dashboard at `/admin`

**Authentication**: You'll need to authenticate admin API requests. The admin dashboard handles this automatically if you're logged in as an admin user.

### Step 2: Configure System Prompt

1. Go to **System Prompt** tab
2. Customize the AI's behavior and personality
3. Click **Save Changes**

**Default Prompt**: The application comes with a conference-focused system prompt. Modify it to fit your specific conference or use case.

### Step 3: Adjust Settings

Go to **Settings** tab and configure:

**Welcome Message**:
- Shown to new users
- Supports markdown formatting

**LLM Configuration**:
- Default model (Claude, Gemini, Grok, Perplexity)
- Context mode (window vs embeddings)
- Max tokens per response (256-8192)

**Rate Limiting**:
- Requests per minute (default: 200)

**Insights Limits**:
- Votes per user (default: 3)
- Shares per user (default: 3)

Click **Save Settings** to apply changes.

---

## Context Files

Context files provide background knowledge to the AI. They're included in every conversation.

### Step 1: Prepare Context Files

Create `.txt` or `.md` files with information about:
- Conference schedule and speakers
- Product documentation
- Company information
- FAQ content
- Any other relevant information

**File Guidelines**:
- Use `.txt` or `.md` format
- UTF-8 encoding
- Maximum 500KB per file
- Clear, well-structured content

### Step 2: Upload Context Files

1. Go to **Admin Dashboard** > **Context Files**
2. Click the **upload zone** or drag files into it
3. Files are uploaded to `documents/context/`
4. Enable/disable files using the checkboxes

### Step 3: Verify Upload

- File count should increase
- Preview files by clicking on them
- Check "Context chars" and "tokens" in the top-right corner

**Token Limits**:
- Claude: ~200,000 tokens
- Gemini: ~1,000,000 tokens
- Stay well below limits to leave room for conversation

---

## Vector Embeddings Setup

For large document collections, use vector embeddings instead of loading all context into the prompt.

### When to Use Vector Embeddings

**Use Context Window Mode when**:
- Small document collection (<50,000 tokens)
- Need holistic understanding across all documents
- Questions require seeing connections between documents

**Use Vector Embeddings Mode when**:
- Large document collection (>50,000 tokens)
- Specific, targeted questions
- Cost optimization is important
- Documents are independent (less cross-referencing needed)

### Step 1: Switch to Vector Embeddings Mode

1. Go to **Admin Dashboard** > **Settings**
2. Change **Context Mode** to "Vector Embeddings (Smart & Scalable)"
3. Click **Save Settings**

### Step 2: Process Embeddings

1. Go to **Context Files** tab
2. Ensure context files are uploaded and enabled
3. Click **Process Embeddings**
4. Wait for processing to complete

**Processing Details**:
- Documents are split into 512-character chunks (128-char overlap)
- Each chunk is converted to a vector embedding
- Embeddings are stored in ChromaDB (`data/chromadb/`)
- First-time processing downloads the ML model (~80MB)

**Stats**: After processing, you'll see:
- **Documents**: Number of unique files processed
- **Chunks**: Total number of text segments

### Step 3: Test Semantic Search

1. Go to **Chat**
2. Ask a question related to your context files
3. The AI will search for the 5 most relevant chunks
4. Only relevant content is sent to the AI (cost-effective)

### Reprocessing Embeddings

When you add, remove, or modify context files:
1. Go to **Context Files** tab
2. Click **Process Embeddings** again
3. Existing embeddings are cleared and regenerated

---

## Production Deployment

### Security Checklist

Before deploying to production:

- [ ] Change `SECRET_KEY` to a strong 64-character random string
- [ ] Set `DEBUG=False` in `.env`
- [ ] Change `ADMIN_API_KEY` to a strong random value
- [ ] Configure SMTP for email delivery
- [ ] Use HTTPS/TLS (reverse proxy like Nginx)
- [ ] Set up firewall rules
- [ ] Consider PostgreSQL instead of SQLite
- [ ] Enable monitoring and logging
- [ ] Set up automated database backups

### Deploy with Gunicorn (Recommended)

Gunicorn is a production-grade WSGI server for Flask.

**Step 1: Install Gunicorn**
```bash
pip install gunicorn
```

**Step 2: Update `.env` for Production**
```bash
FLASK_ENV=production
DEBUG=False
SECRET_KEY=<strong-64-character-random-key>
```

**Step 3: Run with Gunicorn**
```bash
gunicorn --bind 0.0.0.0:5000 --workers 4 run:app
```

**Worker Count**: Use `(2 x CPU cores) + 1` for optimal performance.

### PostgreSQL Setup (Optional)

For production with multiple concurrent users, PostgreSQL is recommended over SQLite.

**Step 1: Install PostgreSQL**
- [Download PostgreSQL](https://www.postgresql.org/download/)

**Step 2: Create Database**
```sql
CREATE DATABASE confai;
CREATE USER confai_user WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE confai TO confai_user;
```

**Step 3: Update `.env`**
```bash
DATABASE_URL=postgresql://confai_user:your-password@localhost/confai
```

**Step 4: Install psycopg2**
```bash
pip install psycopg2-binary
```

### Reverse Proxy with Nginx

For HTTPS and better performance:

**nginx.conf example:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then use [Let's Encrypt](https://letsencrypt.org/) for free SSL certificates.

---

## Troubleshooting

### Installation Issues

**Problem**: `pip install -r requirements.txt` fails
- **Solution**: Ensure Python 3.10+ is installed: `python --version`
- **Solution**: Update pip: `pip install --upgrade pip`
- **Solution**: Check internet connectivity

**Problem**: "No module named 'flask'"
- **Solution**: Activate virtual environment: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)

### Runtime Issues

**Problem**: "Address already in use" on port 5000
- **Solution**: Kill existing process or change port in `run.py`:
  ```python
  app.run(host='0.0.0.0', port=5001, debug=True)
  ```

**Problem**: AI not responding
- **Solution**: Check API key in `.env` is correct
- **Solution**: Verify API key has credits/quota remaining
- **Solution**: Check console for error messages
- **Solution**: Try switching to a different model

**Problem**: "Failed to initialize embedding service"
- **Solution**: Ensure 2GB+ RAM available
- **Solution**: Check `data/chromadb/` directory permissions
- **Solution**: Restart the application

**Problem**: "Failed to process embeddings"
- **Solution**: Verify context files are `.txt` or `.md` format
- **Solution**: Check file encoding is UTF-8
- **Solution**: Check console for detailed error messages

**Problem**: Database locked error (SQLite)
- **Solution**: Reduce concurrent users
- **Solution**: Migrate to PostgreSQL for production
- **Solution**: Check no other process is accessing the database

**Problem**: Context window too large error
- **Solution**: Switch to Vector Embeddings mode
- **Solution**: Disable some context files
- **Solution**: Check token count in Admin > Context Files

**Problem**: PIN code not appearing
- **Development**: Check console output (stdout)
- **Production**: Verify SMTP settings in `.env`
- **Production**: Check email spam folder

### Email Configuration Issues

**Problem**: SMTP authentication failed
- **Solution**: Use App Password for Gmail (not regular password)
- **Solution**: Enable "Less secure app access" for other providers
- **Solution**: Verify SMTP server and port are correct

**Problem**: Emails not being received
- **Solution**: Check spam/junk folder
- **Solution**: Verify SMTP_USERNAME is correct
- **Solution**: Test SMTP connection separately

### Getting Help

If you encounter issues not covered here:

1. Check the main README.md
2. Review console output for error messages
3. Enable debug logging: `DEBUG=True` in `.env`
4. Check file permissions in `data/` and `documents/` directories
5. Verify all environment variables are set correctly

---

## Next Steps

Now that ConfAI is installed and configured:

1. **Upload context files** with conference-specific information
2. **Test the chat** with different models to find your preferred one
3. **Customize the system prompt** for your conference theme
4. **Configure insights limits** based on expected user count
5. **Share the Insights Wall** with attendees for collaborative knowledge sharing

**Enjoy your AI-powered conference experience!** 🎉

---

## Quick Command Reference

```bash
# Activate virtual environment
venv\Scripts\activate          # Windows
source venv/bin/activate       # Mac/Linux

# Run development server
python run.py

# Run production server
gunicorn --bind 0.0.0.0:5000 --workers 4 run:app

# Install new dependencies
pip install <package-name>
pip freeze > requirements.txt  # Update requirements

# Database operations
# (handled automatically by the app on first run)

# Update embeddings after context file changes
# (done through Admin Dashboard > Context Files > Process Embeddings)
```

---

**Need more help?** Check the [README.md](README.md) for feature details and API reference.
