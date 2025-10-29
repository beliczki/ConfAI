# ConfAI API Reference

## Authentication Endpoints

### POST /login
Request a login PIN via email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "PIN sent to your email"
}
```

**Rate Limit:** 5 per minute

---

### POST /verify
Verify PIN and create session.

**Request:**
```json
{
  "email": "user@example.com",
  "pin": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "avatar_gradient": "linear-gradient(135deg, #E20074, #FF6B9D)"
  }
}
```

**Rate Limit:** 10 per minute

---

### POST /logout
Logout and clear session.

**Response:**
```json
{
  "success": true
}
```

---

### GET /me
Get current user info (requires authentication).

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "avatar_gradient": "linear-gradient(135deg, #E20074, #FF6B9D)"
}
```

---

## Chat Endpoints

### GET /chat
Render chat page (requires authentication).

**Returns:** HTML page

---

### GET /api/threads
Get user's chat threads (requires authentication).

**Response:**
```json
{
  "threads": [
    {
      "id": 1,
      "title": "New Chat",
      "created_at": "2025-10-29 10:00:00",
      "updated_at": "2025-10-29 10:30:00"
    }
  ]
}
```

---

### POST /api/threads
Create new chat thread (requires authentication).

**Request:**
```json
{
  "title": "My New Chat"  // Optional, defaults to "New Chat"
}
```

**Response:**
```json
{
  "success": true,
  "thread_id": 1
}
```

---

### DELETE /api/threads/:thread_id
Delete a chat thread (requires authentication).

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- 404: Thread not found or not owned by user

---

### GET /api/threads/:thread_id/messages
Get messages for a thread (requires authentication).

**Response:**
```json
{
  "messages": [
    {
      "id": 1,
      "role": "user",
      "content": "Hello!",
      "created_at": "2025-10-29 10:00:00"
    },
    {
      "id": 2,
      "role": "assistant",
      "content": "Hi! How can I help you?",
      "created_at": "2025-10-29 10:00:05"
    }
  ]
}
```

**Errors:**
- 404: Thread not found or not owned by user

---

### POST /api/chat
Send message and get response (non-streaming, requires authentication).

**Request:**
```json
{
  "thread_id": 1,
  "message": "What is AI?"
}
```

**Response:**
```json
{
  "success": true,
  "response": "AI stands for Artificial Intelligence..."
}
```

**Errors:**
- 400: Missing thread_id or message
- 404: Thread not found or not owned by user

---

### POST /api/chat/stream
Send message and get streaming response via SSE (requires authentication).

**Request:**
```json
{
  "thread_id": 1,
  "message": "Explain quantum computing"
}
```

**Response (Server-Sent Events):**
```
data: {"content": "Quantum", "done": false}

data: {"content": " computing", "done": false}

data: {"content": " is", "done": false}

...

data: {"content": "", "done": true}
```

**SSE Event Format:**
- `content`: Text chunk (empty when done)
- `done`: Boolean indicating completion

**Conversation Context:**
- Includes last 10 messages from thread
- Includes relevant context from embeddings (if available)

**Errors (as SSE):**
- `data: {"error": "Thread not found", "done": true}`
- `data: {"content": "Sorry, I encountered an error: ...", "done": true}`

---

## Insights Endpoints

### GET /insights
Render insights wall page (requires authentication).

**Returns:** HTML page

---

### GET /api/insights
Get insights wall with vote status (requires authentication).

**Response:**
```json
{
  "insights": [
    {
      "id": 1,
      "content": "AI will transform healthcare...",
      "vote_count": 15,
      "created_at": "2025-10-29 10:00:00",
      "user_vote": "upvote",  // null if no vote
      "show_count": false      // true only if all votes cast
    }
  ],
  "user_votes_remaining": 2,
  "user_total_votes": 3
}
```

---

### POST /api/insights
Create new insight (requires authentication).

**Request:**
```json
{
  "content": "AI will revolutionize education by personalizing learning..."
}
```

**Response:**
```json
{
  "success": true,
  "insight_id": 1
}
```

---

### POST /api/insights/:insight_id/vote
Vote on an insight (requires authentication).

**Request:**
```json
{
  "vote_type": "upvote"  // or "downvote"
}
```

**Response:**
```json
{
  "success": true,
  "votes_remaining": 2
}
```

**Errors:**
- 400: No votes remaining
- 400: Already voted on this insight
- 400: Invalid vote_type

---

### DELETE /api/insights/:insight_id/vote
Remove vote from an insight (requires authentication).

**Response:**
```json
{
  "success": true,
  "votes_remaining": 3
}
```

---

## Admin Endpoints

### POST /api/update-transcript
Upload conference transcript (requires admin key).

**Headers:**
```
X-Admin-Key: admin-secret-key-change-this
```

**Form Data:**
```
file: [PDF/TXT file]
type: transcript  // or "book"
```

**Response:**
```json
{
  "success": true,
  "message": "Transcript uploaded and processed successfully"
}
```

**Errors:**
- 401: Missing or invalid admin key
- 400: No file uploaded
- 400: Invalid file type (only PDF/TXT allowed)

---

## Error Response Format

All endpoints return errors in this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
- 200: Success
- 400: Bad request (invalid parameters)
- 401: Unauthorized (authentication required or invalid)
- 404: Resource not found
- 500: Internal server error

---

## Authentication

Most endpoints require authentication via session cookies. After successful `/verify`, the server sets a session cookie that must be included in subsequent requests.

**Session Cookie:** `session`

**Session Data:**
- `user_id`: User's database ID
- `email`: User's email
- `name`: User's name

---

## Rate Limiting

Rate limits are applied per IP address:

- **Login endpoint:** 5 requests per minute
- **Verify endpoint:** 10 requests per minute
- **Global default:** 1000 requests per day, 100 per hour

**Rate Limit Headers:**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1635500000
```

---

## LLM Provider Configuration

The application supports multiple LLM providers configured via environment variables:

**Provider Selection:**
```bash
LLM_PROVIDER=claude  # or "grok" or "perplexity"
```

**API Keys:**
```bash
ANTHROPIC_API_KEY=sk-ant-...
GROK_API_KEY=grok-...
PERPLEXITY_API_KEY=pplx-...
```

**Default Model:**
- Claude: `claude-3-5-sonnet-20241022`
- Grok: `grok-2-latest`
- Perplexity: `llama-3.1-sonar-large-128k-online`

---

## Embedding Service (Placeholder)

The embedding service provides document search capabilities:

**Model:** BAAI/bge-large-en-v1.5
**Vector Storage:** FAISS (local) or Pinecone (cloud)

**Search Context Method:**
```python
context = embedding_service.search_context(query, top_k=5)
# Returns: Relevant text chunks from uploaded documents
```

Currently returns empty string (placeholder implementation).
