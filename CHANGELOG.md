# ConfAI Changelog

## [2025-11-01] - UI/UX Improvements

### Added
- **Model-Specific AI Avatar Gradients**: Each AI model now has a distinctive gradient color
  - Gemini: Blue gradient (#001E50 → #00A0E9)
  - Claude: Orange gradient (#CC785C → #E8956D)
  - Grok: Grey gradient (#4A5568 → #718096)
  - Perplexity: Teal gradient (#0D9488 → #14B8A6)
  - Gradients update dynamically when switching models mid-conversation

- **Avatar Dropdown Menu**: Relocated menu from sidebar footer to header
  - Compact avatar circle in top-right header
  - Dropdown contains: AI Model selector, Admin Dashboard link (if admin), and Logout
  - Cleaner UI with better use of screen space
  - Avatar size reduced from 40px to 32px for better alignment with header buttons

- **Model Availability Indicators**: LLM selector now shows which models are configured
  - Models without API keys are greyed out (opacity 0.3) and non-clickable
  - Available models show green "ready" badge
  - Visual feedback prevents selecting unconfigured models

- **Vote Revocation Confirmation**: Added confirmation dialog when removing votes
  - Uses custom dialog system with danger styling
  - Prevents accidental vote removal
  - Consistent with unshare confirmation pattern

### Fixed
- **Dropdown Click Event Bubbling**: Fixed chevron-down icons not being clickable
  - Added `event.stopPropagation()` to prevent immediate dropdown closure
  - Added `pointer-events: none` to icon elements
  - Both avatar dropdown and model selector now work correctly

- **Model Switching**: Fixed model not switching in existing threads
  - Backend now updates thread's `model_used` field when sending messages
  - Frontend updates `currentModel` variable when switching models
  - Thread correctly uses new model for subsequent messages
  - Model gradient updates immediately upon selection

- **Avatar Dropdown Persistence**: Model dropdown no longer closes parent dropdown
  - Selecting a model now keeps the avatar dropdown open
  - Allows for better workflow when adjusting settings
  - Only closes on outside click or explicit dismiss

### Changed
- Removed success message after unsharing insights (silent unshare)
- Updated avatar size for better visual balance with other header elements
- Improved dropdown interaction patterns across the application

### Technical Details

#### Backend Changes
- `app/models/__init__.py`: Added `ChatThread.update_model()` method
- `app/routes/chat.py`:
  - Enhanced `/api/threads/<thread_id>/messages` to include model with each message
  - Updated `/api/chat/stream` to update thread model when sending messages
  - Added `/api/config` endpoint enhancement to return available providers

#### Frontend Changes
- `app/static/js/chat.js`:
  - Added `getAIGradient()` helper function for model-specific colors
  - Added `currentModel` tracking variable
  - Updated `renderMessages()`, `addStreamingMessage()`, and `showTypingIndicator()` to use model gradients
  - Enhanced `selectModel()` to update current model
  - Fixed `toggleAvatarDropdown()` and `toggleModelDropdown()` with event propagation handling
  - Added `buildModelDropdown()` for dynamic model list generation

- `app/static/js/insights.js`:
  - Added vote revocation confirmation in `handleVote()` function
  - Commented out success message in `handleUnshare()`

- `app/templates/chat.html`:
  - Removed sidebar footer menu
  - Added avatar dropdown menu in header with nested model selector
  - Updated onclick handlers to pass event objects

- `app/static/css/chat.css`:
  - Added comprehensive avatar dropdown styling
  - Added model availability indicators (`.model-unavailable`, `.model-ready-badge`)
  - Updated `.user-avatar` dimensions (40px → 32px)
  - Added `pointer-events: none` to dropdown icons
  - Modified `.model-dropdown` for inline flow (push-down behavior)

## [2025-10-29] - Admin Dashboard Implementation

### Added
- Complete admin dashboard with system prompt editing, context file management, and statistics
- Dual authentication (session-based + API key)
- File upload with drag & drop support
- Template loader with 4 pre-built prompts
- Real-time statistics monitoring
- Context file preview with token estimation

[See IMPLEMENTATION_SUMMARY.md for full details]

---

**Maintained by**: Claude Code Assistant
**Project**: ConfAI - Conference Intelligence Platform
