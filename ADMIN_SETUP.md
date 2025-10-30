# ConfAI Admin Dashboard - Setup & Usage Guide

## Overview

The admin dashboard provides a comprehensive interface for managing ConfAI's AI behavior, context files, and monitoring system statistics.

## Features Implemented

### 1. System Prompt Management
- **Edit System Prompt**: Customize the AI's personality, behavior, and knowledge base
- **Character Counter**: Track prompt length in real-time
- **Quick Templates**: Pre-built templates for common use cases:
  - Conference Expert
  - Helpful Assistant
  - Concise Responder
  - Creative Thinker
- **Reset to Default**: Restore the original system prompt
- **Test Prompt**: Preview how the prompt will affect AI responses

### 2. Context Files Management
- **Upload Files**: Drag & drop or click to upload .txt and .md files
- **File Size Limit**: 500KB per file
- **File List**: View all uploaded context files with metadata
- **Delete Files**: Remove context files that are no longer needed
- **Context Preview**: See what content will be injected into AI context
- **Statistics**: Real-time character and token counting

### 3. Application Statistics
- **User Metrics**: Total users, chat threads, shared insights, votes cast
- **Recent Activity**: Timeline of user actions and system events
- **Context Window Usage**: Visual indicator of context window utilization

### 4. Settings (UI Ready)
- LLM Provider selection
- Max tokens per response
- Rate limiting configuration
- Voting system settings

## Setup Instructions

### 1. Environment Configuration

Add the following to your `.env` file:

```env
# Admin access
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_API_KEY=your-secure-admin-key-here
```

- **ADMIN_EMAIL**: Email address that will have admin access via web interface
- **ADMIN_API_KEY**: API key for programmatic admin access

### 2. Directory Structure

The following directories are automatically created:

```
ConfAI/
├── data/
│   └── system_prompt.txt          # Stores the active system prompt
└── documents/
    └── context/                    # Stores context files for AI injection
        └── README.txt              # Documentation for context files
```

### 3. Admin Access

#### Option 1: Web Interface (Recommended)
1. Log in with the email configured as `ADMIN_EMAIL`
2. Navigate to the admin dashboard via the sidebar link: ⚙️ Admin Dashboard
3. Access is session-based and secure

#### Option 2: API Access
Use the `X-Admin-Key` header with your `ADMIN_API_KEY`:

```bash
curl -H "X-Admin-Key: your-admin-key" \
     http://localhost:5000/api/admin/system-prompt
```

## API Endpoints

### Admin Dashboard Routes

#### GET `/admin`
- **Description**: Admin dashboard page
- **Auth**: Requires login + admin session
- **Response**: HTML page

#### GET `/api/admin/system-prompt`
- **Description**: Get current system prompt
- **Auth**: Session or API key
- **Response**:
  ```json
  {
    "success": true,
    "prompt": "Your system prompt..."
  }
  ```

#### POST `/api/admin/system-prompt`
- **Description**: Update system prompt
- **Auth**: Session or API key
- **Body**:
  ```json
  {
    "prompt": "New system prompt text..."
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "System prompt updated successfully"
  }
  ```

#### GET `/api/admin/context-files`
- **Description**: List all context files with preview
- **Auth**: Session or API key
- **Response**:
  ```json
  {
    "success": true,
    "files": [
      {
        "name": "conference-info.txt",
        "size": 2048,
        "chars": 1500
      }
    ],
    "preview": "--- conference-info.txt ---\n...",
    "total_chars": 1500,
    "total_tokens": 375
  }
  ```

#### POST `/api/admin/context-files`
- **Description**: Upload new context files
- **Auth**: Session or API key
- **Content-Type**: `multipart/form-data`
- **Body**: Files with key `files` (supports multiple)
- **Response**:
  ```json
  {
    "success": true,
    "message": "Successfully uploaded 2 file(s)",
    "files": ["file1.txt", "file2.md"]
  }
  ```

#### DELETE `/api/admin/context-files/<filename>`
- **Description**: Delete a context file
- **Auth**: Session or API key
- **Response**:
  ```json
  {
    "success": true,
    "message": "File deleted: filename.txt"
  }
  ```

#### GET `/api/admin/stats`
- **Description**: Get application statistics
- **Auth**: Session or API key
- **Response**:
  ```json
  {
    "total_users": 42,
    "total_threads": 156,
    "total_insights": 89,
    "total_votes": 234,
    "context_used": 15000,
    "context_max": 200000,
    "recent_activity": [
      {
        "type": "user_joined",
        "text": "John joined",
        "time": "2m ago"
      }
    ]
  }
  ```

## How It Works

### System Prompt Flow

1. **Storage**: System prompt is stored in `data/system_prompt.txt`
2. **Loading**: On each AI request, `LLMService._load_system_prompt()` reads from file
3. **Fallback**: If file doesn't exist, uses `DEFAULT_SYSTEM_PROMPT`
4. **Injection**: Prompt is sent to the AI provider as the system message

### Context Files Flow

1. **Storage**: Context files are stored in `documents/context/`
2. **Loading**: `LLMService.get_context_files()` reads all `.txt` and `.md` files
3. **Concatenation**: Files are concatenated with separators
4. **Injection**: Content is appended to the system prompt before each request
5. **Real-time**: Changes take effect immediately for new conversations

### Security

- **Session-based Auth**: Admin users have `is_admin=True` in session
- **API Key Auth**: Supports `X-Admin-Key` header for programmatic access
- **Dual Authentication**: Accepts either session OR API key
- **Login Integration**: Admin status set automatically during login if email matches `ADMIN_EMAIL`

## Usage Examples

### Example 1: Uploading Conference Information

1. Navigate to **Context Files** tab
2. Create a file `conference-2024.txt`:
   ```
   Conference: Tech Summit 2024
   Date: December 1-3, 2024
   Location: San Francisco, CA

   Key Topics:
   - AI and Machine Learning
   - Cloud Computing
   - Cybersecurity
   ```
3. Upload via drag & drop or file picker
4. Verify in the file list and preview

### Example 2: Customizing AI Personality

1. Navigate to **System Prompt** tab
2. Edit the prompt:
   ```
   You are an enthusiastic conference AI assistant for Tech Summit 2024.
   You're knowledgeable about all sessions, speakers, and venue information.
   Always be helpful, professional, and encourage attendees to explore sessions.
   When unsure, direct users to the conference help desk.
   ```
3. Click **Save Changes**
4. Test in a new chat session

### Example 3: Using Quick Templates

1. Click on **Concise Responder** template
2. Review the loaded prompt
3. Customize if needed
4. Save to apply

## Best Practices

### System Prompt
- Keep prompts focused and clear
- Define the AI's role explicitly
- Set expectations for tone and behavior
- Specify when to defer or admit uncertainty
- Test prompts before production use

### Context Files
- **Organization**: Use descriptive filenames (e.g., `schedule-day1.txt`, `speaker-bios.txt`)
- **Size Management**: Keep individual files under 500KB
- **Content Structure**: Use headers and sections for clarity
- **Updates**: Replace files when information changes
- **Monitoring**: Watch context window usage to avoid limits

### Security
- **Change Default Keys**: Always update `ADMIN_API_KEY` in production
- **Limit Admin Access**: Only add trusted emails to `ADMIN_EMAIL`
- **Regular Audits**: Review context files and system prompts periodically
- **Backup**: Keep backups of working prompts and context files

## Troubleshooting

### Admin Link Not Showing
- Verify `ADMIN_EMAIL` is set in `.env`
- Ensure logged in email matches `ADMIN_EMAIL`
- Check session has `is_admin=True`
- Try logging out and back in

### Context Files Not Loading
- Check file permissions on `documents/context/`
- Verify files are `.txt` or `.md` format
- Check file encoding is UTF-8
- Review server logs for errors

### System Prompt Not Applying
- Ensure file is saved at `data/system_prompt.txt`
- Check file permissions
- Verify encoding is UTF-8
- Start a new chat thread to test (existing threads use old prompt)

### Statistics Not Loading
- Verify database is accessible
- Check database table names match schema
- Review server console for SQL errors
- Ensure `get_db()` context manager is working

## Technical Details

### Files Modified/Created

**Created:**
- `app/static/js/admin.js` (18KB) - Admin dashboard JavaScript
- `data/system_prompt.txt` - Default system prompt
- `documents/context/README.txt` - Context files documentation
- `ADMIN_SETUP.md` - This documentation

**Modified:**
- `app/routes/admin.py` - Added admin dashboard and API endpoints
- `app/services/llm_service.py` - Added system prompt and context file loading
- `app/utils/helpers.py` - Enhanced admin_required decorator
- `app/routes/auth.py` - Added admin session flag on login
- `app/templates/chat.html` - Added admin dashboard link
- `.env.example` - Added ADMIN_EMAIL configuration

### Dependencies
No new dependencies required. Uses existing Flask, SQLite, and frontend libraries.

## Future Enhancements

Potential future features:
- [ ] Prompt versioning and rollback
- [ ] A/B testing of different prompts
- [ ] Advanced analytics and insights
- [ ] Bulk context file operations
- [ ] Scheduled prompt changes
- [ ] Multi-language support
- [ ] Context file templates
- [ ] Integration with external knowledge bases

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review server console logs
3. Verify environment configuration
4. Check file permissions and paths

---

**Last Updated**: 2025-10-29
**Version**: 1.0.0
**ConfAI Admin Dashboard Implementation Complete**
