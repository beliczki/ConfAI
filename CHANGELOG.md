# ConfAI Changelog

## [2025-11-06] - Email Styling, Chat Enhancements & Insights Wall

### Added

#### Email System Dark Mode Compatibility
- **CSS Gradient Background Technique**: Discovered and implemented workaround for Gmail/Outlook dark mode color inversion
  - Email headers now use `linear-gradient(to bottom, #1a1a1a, #2a2a2a)` instead of solid colors
  - Gradient backgrounds are not inverted by email clients in dark mode
  - Added subtle gradient from `#1a1a1a` to `#2a2a2a` for visual depth
  - CID-attached images provide additional inversion protection

- **Email Template Improvements**:
  - Updated PIN and invite email headers with gradient backgrounds
  - Added 660x120 gradient background image as MIME attachment
  - Implemented `overflow: hidden` to preserve rounded corners
  - Updated copyright year to 2025 in email footers
  - Email headers maintain consistent dark appearance across all clients

#### Chat Interface Enhancements
- **Model-Specific Gradient Borders**: AI chat bubbles now display 4px left gradient border matching avatar colors
  - Claude: Orange gradient (`#FF491E → #C2891E`)
  - Gemini: Blue gradient (`#001E50 → #00A0E9`)
  - Grok: Grey gradient (`#4A5568 → #718096`)
  - Perplexity: Teal gradient (`#0D9488 → #14B8A6`)
  - Borders dynamically match AI model for visual coherence
  - Implemented using CSS `::before` pseudo-elements to preserve `border-radius`

- **Updated Claude Brand Colors**: Changed from brownish to vibrant orange gradient
  - Updated across chat UI, design language, and documentation
  - New gradient: `#FF491E → #C2891E`

#### Admin Dashboard - Insights Wall
- **Comprehensive Insights Management**:
  - View all shared insights from all users in centralized dashboard
  - Display user emails for each insight
  - Markdown export functionality for insights
  - Vote counts and sharing statistics
  - Full insights history and analytics

- **Text Search & Filtering**:
  - Real-time text search across insight content
  - White filter icon for better visibility
  - Sort options: Latest First, Oldest First, Most Voted, Most Shared
  - Filter indicators showing active search/sort

### Fixed

#### Email Compatibility Issues
- **Gmail Dark Mode Inversion**: Solved through CSS gradient technique
  - Solid background colors (`#1a1a1a`) were being inverted to light in dark mode
  - Gradients bypass email client color manipulation
  - Tested across Desktop Gmail (light/dark), Mobile Gmail (light/dark), Outlook

- **Email Image Handling**:
  - Gmail was stripping 1x1 tracking pixel (anti-tracking measure)
  - Switched to 10x10 tile, then to 1px height with 0.1 opacity
  - CID attachments work better than data URIs or external URLs
  - Position properties (`absolute`, `relative`, `z-index`) stripped by Gmail for security

- **Rounded Corners in Emails**: Maintained using `overflow: hidden` on parent containers
  - Border-radius preserved despite image attachments
  - Gradient backgrounds don't interfere with corner rounding

#### Chat Interface
- **Border-Radius Preservation**: Fixed gradient borders losing rounded corners
  - Initial `border-image` approach incompatible with `border-radius`
  - Switched to `::before` pseudo-element technique
  - Gradient borders now respect parent `border-radius`

- **Grok Model Border**: Added missing gradient border for Grok model

#### Admin Insights
- **sqlite3.Row Attribute Access**: Fixed attribute access in admin insights endpoints
- **API Error Handling**: Improved error responses to return JSON instead of HTML redirects
- **Loading States**: Fixed insights loading with proper credentials and error handling
- **CSS Class Conflicts**: Resolved styling conflicts in admin insights display
- **Export Dialog**: Removed success dialog from markdown export (silent export)

### Changed

#### Design System Updates
- **Mobile-First Principle**: Added as top design priority in design guide
- **Light & Dark Mode Ready**: All components must support both modes across app and emails
- **Email Compatibility Documentation**: Comprehensive section added to design guide
  - CSS gradient dark mode bypass technique documented
  - CID image attachment technique explained
  - Email client compatibility notes (position stripping, etc.)
  - Email testing checklist (7 platforms)

#### API Improvements
- **Cache Control Headers**: Added to authenticated pages and logout redirect
  - Prevents browser caching of sensitive pages
  - Forces fresh page loads after logout
  - Improves security and user experience

- **Error Response Format**: API endpoints now consistently return JSON errors
  - No more HTML redirect responses from AJAX calls
  - Better error handling in frontend JavaScript
  - Clearer error messages for debugging

### Technical Details

#### Backend Changes (`app/services/email_service.py`)
- Added `_load_bg_gradient()` method to load gradient image from static files
- Updated email templates with CSS gradient backgrounds
- Attached gradient image as MIME part with Content-ID reference
- Removed base64 import (no longer needed for pixel generation)
- Updated both PIN and invite email templates

#### Frontend Changes (`app/static/js/chat.js`)
- Updated `getAIGradient()` with new Claude colors (#FF491E → #C2891E)
- Added `data-model` attribute to assistant messages for CSS targeting (lines 634, 873)

#### CSS Changes (`app/static/css/chat.css`)
- Added `position: relative` and `overflow: hidden` to `.message.assistant .message-content`
- Created model-specific `::before` pseudo-elements for gradient borders (lines 862-905)
- Each model has dedicated gradient border rules

#### Admin Frontend (`app/static/js/admin.js`)
- Added insights wall loading and display functions
- Implemented text search filtering
- Added markdown export functionality
- Fixed `exportInsights` global scope exposure

#### Admin Styles (`app/static/css/admin.css`)
- Added insights wall card styling
- Implemented white filter icons
- Added search and sort controls styling
- Fixed CSS class conflicts with main app

#### Design Documentation (`.claude/design_guide.md`)
- Added "Email Design Compatibility" section
- Documented CSS gradient dark mode bypass
- Documented CID image attachment technique
- Added email client compatibility notes
- Added email testing checklist
- Updated design principles with mobile-first and light/dark mode priorities

### Email Testing Results

Tested across 7 platforms:
- ✅ Desktop Gmail (light mode) - Gradient working
- ✅ Desktop Gmail (dark mode) - Gradient NOT inverted
- ✅ Mobile Gmail (light mode) - Gradient working
- ✅ Mobile Gmail (dark mode) - Gradient NOT inverted
- ✅ Outlook (desktop) - Fallback gradient working
- ✅ Outlook (web) - Fallback gradient working
- ⚠️ Apple Mail - Not fully tested

### Known Limitations

- Email client positioning (`position`, `z-index`) stripped by Gmail - use inline layout instead
- Very small images (1x1) blocked by Gmail as tracking pixels - use 10x10+ or opacity tricks
- Hosted images require "Display images" / "Trust sender" confirmation
- CID attachments are most reliable for email images

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
