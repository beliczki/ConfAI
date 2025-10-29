# ConfAI - Next Steps & TODOs

## Immediate Next Steps

### 1. Implement Insights Wall UI ⚠️ PRIORITY
**Status:** 30% Complete (structure ready, needs UI)
**Location:** `app/templates/insights.html`, `app/routes/insights.py`

**Tasks:**
- [ ] Create card-based insight display layout
- [ ] Add upvote/downvote buttons with heart icons
- [ ] Implement vote count display (hide until all votes cast)
- [ ] Add "Share Insight" button in chat UI
- [ ] Create modal for sharing insights from chat
- [ ] Add voting animations and transitions
- [ ] Show remaining votes counter
- [ ] Implement vote reveal logic (when all 3 votes used)
- [ ] Add loading states for API calls
- [ ] Style with Telekom design system

**Files to Create/Modify:**
```
app/templates/insights.html        # Main insights wall UI
app/static/js/insights.js          # Insights JavaScript (new file)
app/templates/chat.html            # Add "Share" button to messages
```

**JavaScript Functions Needed:**
```javascript
- loadInsights()              // Fetch and render insights
- shareInsight(content)       // Create new insight
- voteInsight(id, type)       // Vote on insight
- unvoteInsight(id)          // Remove vote
- updateVoteCounter()        // Update remaining votes display
- checkVoteReveal()          // Check if counts should be shown
```

---

### 2. Implement Document Embedding System ❌
**Status:** 20% Complete (placeholder only)
**Location:** `app/services/embedding_service.py`

**Tasks:**
- [ ] Uncomment ML dependencies in requirements.txt:
  ```
  transformers>=4.36.0
  torch>=2.6.0
  sentence-transformers>=2.2.2
  faiss-cpu>=1.7.4
  ```
- [ ] Load BAAI/bge-large-en-v1.5 model
- [ ] Implement PDF parsing (PyPDF2 or pdfplumber)
- [ ] Implement TXT file reading
- [ ] Create text chunking strategy (chunk_size=512, overlap=50)
- [ ] Generate embeddings for chunks
- [ ] Build FAISS index
- [ ] Implement search_context() method
- [ ] Add document upload processing
- [ ] Create admin dashboard for viewing documents
- [ ] Add re-indexing capability

**Implementation Steps:**
```python
# 1. Initialize model
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('BAAI/bge-large-en-v1.5')

# 2. Parse documents
def parse_pdf(file_path):
    # Extract text from PDF

def parse_txt(file_path):
    # Read TXT file

# 3. Chunk text
def chunk_text(text, chunk_size=512, overlap=50):
    # Split into overlapping chunks

# 4. Generate embeddings
embeddings = model.encode(chunks)

# 5. Build FAISS index
import faiss
index = faiss.IndexFlatL2(dimension)
index.add(embeddings)

# 6. Search
def search_context(query, top_k=5):
    query_embedding = model.encode([query])
    distances, indices = index.search(query_embedding, top_k)
    return relevant_chunks
```

---

### 3. Create Admin Dashboard 📊
**Status:** 0% Complete
**Location:** New files needed

**Tasks:**
- [ ] Create admin login page (separate from user login)
- [ ] Create admin dashboard template
- [ ] Add document list view
- [ ] Add document upload UI (drag & drop)
- [ ] Show embedding status (indexed/pending)
- [ ] Add re-index button
- [ ] Display system statistics:
  - Total users
  - Total chat threads
  - Total messages
  - Total insights
  - Total votes cast
  - Documents indexed
- [ ] Add user management (view users, delete users)
- [ ] Add insights moderation (delete inappropriate insights)

**Files to Create:**
```
app/templates/admin/
  ├── login.html          # Admin login
  ├── dashboard.html      # Main dashboard
  ├── documents.html      # Document management
  └── users.html          # User management

app/routes/admin.py       # Expand with UI routes
app/static/css/admin.css  # Admin-specific styles
```

---

### 4. Docker Deployment Configuration 🐳
**Status:** 0% Complete

**Tasks:**
- [ ] Create Dockerfile
- [ ] Create docker-compose.yml
- [ ] Add .dockerignore
- [ ] Configure Gunicorn for production
- [ ] Set up environment variable handling
- [ ] Add volume mounts for:
  - Database (data/)
  - Uploaded documents (documents/)
  - Session data (flask_session/)
- [ ] Add health check endpoint
- [ ] Create deployment documentation
- [ ] Test local Docker build

**Dockerfile Structure:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "run:app"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  confai:
    build: .
    ports:
      - "5000:5000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - SECRET_KEY=${SECRET_KEY}
    volumes:
      - ./data:/app/data
      - ./documents:/app/documents
      - ./flask_session:/app/flask_session
```

---

### 5. Frontend Polish & Enhancements ✨
**Status:** Ongoing

**Tasks:**
- [ ] Extract inline CSS to separate files:
  ```
  app/static/css/
    ├── base.css        # Global styles
    ├── login.css       # Login page
    ├── chat.css        # Chat interface
    └── insights.css    # Insights wall
  ```
- [ ] Extract inline JavaScript to separate files:
  ```
  app/static/js/
    ├── chat.js         # Chat functionality
    ├── insights.js     # Insights wall
    └── common.js       # Shared utilities
  ```
- [ ] Add responsive mobile design
- [ ] Improve loading states and animations
- [ ] Add dark mode toggle (optional)
- [ ] Add keyboard shortcuts:
  - `/` to focus chat input
  - `Ctrl+N` for new thread
  - `Esc` to cancel/close modals
- [ ] Add message formatting (markdown support)
- [ ] Add code syntax highlighting in messages
- [ ] Add copy button for code blocks
- [ ] Improve error messaging and toasts

---

### 6. Testing & Quality Assurance 🧪
**Status:** 0% Complete

**Tasks:**
- [ ] Create unit tests for models
- [ ] Create unit tests for services
- [ ] Create integration tests for routes
- [ ] Test authentication flow
- [ ] Test chat streaming with different providers
- [ ] Test voting logic and limits
- [ ] Test file upload and parsing
- [ ] Load testing with multiple concurrent users
- [ ] Security testing (SQL injection, XSS, CSRF)
- [ ] Create test fixtures and sample data

**Test Files to Create:**
```
tests/
  ├── __init__.py
  ├── test_models.py
  ├── test_auth.py
  ├── test_chat.py
  ├── test_insights.py
  ├── test_llm_service.py
  └── fixtures/
      ├── sample.pdf
      └── sample.txt
```

---

### 7. Documentation 📚
**Status:** 50% Complete (SETUP.md and README.md exist)

**Tasks:**
- [ ] Add API documentation (OpenAPI/Swagger)
- [ ] Create deployment guide
- [ ] Add troubleshooting guide
- [ ] Document environment variables
- [ ] Add contributing guidelines
- [ ] Create user manual
- [ ] Add architecture diagrams
- [ ] Document database schema with ER diagram
- [ ] Add code comments for complex logic

---

## Feature Ideas (Future Enhancements)

### Chat Enhancements
- [ ] Search within thread messages
- [ ] Export chat history as PDF/TXT
- [ ] Share thread with other users
- [ ] Pin important messages
- [ ] Message reactions/emoji
- [ ] Voice input support
- [ ] Multi-language support

### Insights Wall Enhancements
- [ ] Filter insights by category/tag
- [ ] Sort by most votes, newest, trending
- [ ] Comment threads on insights
- [ ] Share insights externally (Twitter, LinkedIn)
- [ ] Insight analytics (views, shares)
- [ ] AI-generated insight summaries

### Embedding & Search
- [ ] Highlighted search results
- [ ] Document preview in chat
- [ ] Citation links to source documents
- [ ] Semantic search across all conversations
- [ ] Auto-suggest related insights

### Analytics & Monitoring
- [ ] Usage analytics dashboard
- [ ] LLM cost tracking
- [ ] Response time monitoring
- [ ] Error logging and alerting
- [ ] User engagement metrics

### Collaboration
- [ ] Team/group chats
- [ ] Shared insights boards
- [ ] Mentions and notifications
- [ ] Collaborative document annotation

---

## Current Blockers & Issues

### No Critical Blockers ✅
The application is fully functional with core features working.

### Optional Improvements
1. **Heavy ML dependencies**: Embedding system requires large PyTorch downloads
   - Solution: Keep optional for now, document as separate feature

2. **Email service**: Currently prints PINs to console in dev mode
   - Solution: Works fine for dev, configure SMTP for production

3. **Session storage**: Using filesystem, might not scale
   - Solution: Fine for MVP, consider Redis for production

4. **SQLite limitations**: Not ideal for high-concurrency production
   - Solution: Good for MVP, migrate to PostgreSQL if needed

---

## Development Priorities (Recommended Order)

1. **Insights Wall UI** (High Priority)
   - Core feature, already has backend
   - Visible impact
   - ~4-6 hours of work

2. **Frontend Polish** (Medium Priority)
   - Extract CSS/JS to files
   - Improve responsive design
   - ~2-3 hours of work

3. **Embedding System** (Medium Priority)
   - Powerful feature but complex
   - Can be developed incrementally
   - ~8-12 hours of work

4. **Admin Dashboard** (Low Priority)
   - Nice to have, not user-facing
   - ~4-6 hours of work

5. **Docker Deployment** (Low Priority)
   - Important for production but works fine locally
   - ~2-3 hours of work

6. **Testing & Documentation** (Ongoing)
   - Should be done alongside feature development
   - ~6-8 hours total

---

## Git Workflow

### Branch Strategy
```
main          # Production-ready code
├── feature/insights-wall
├── feature/embeddings
├── feature/admin-dashboard
└── feature/docker
```

### Commit Convention
```
feat: Add insights wall UI
fix: Resolve streaming connection timeout
docs: Update API documentation
refactor: Extract inline CSS to files
test: Add chat route integration tests
```

### Before Committing
1. Test locally
2. Update relevant .claude files
3. Run basic smoke tests
4. Check console for errors
5. Review git diff
