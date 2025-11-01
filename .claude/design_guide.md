# ConfAI Design Guide

This document outlines the official design system for ConfAI, extracted from the actual CSS implementation across chat, insights, and dialog systems.

## Color Palette

### Primary Colors
- **Primary (Magenta)**: `#E20074` - Main brand color, used for primary actions, headers, and emphasis
- **Secondary (Blue)**: `#00A0E9` - Accent color for secondary elements

### Background Colors
- **Main Background**: `#0a0a0a` - Dark background for main application
- **Surface**: `#1a1a1a` - Cards, panels, elevated surfaces
- **Surface Alt**: `#2a2a2a` - Hover states, input backgrounds, secondary surfaces
- **Border**: `#3a3a3a` - Borders and dividers throughout the app

### Text Colors
- **Text Primary**: `#e0e0e0` - Main text color (light gray on dark background)
- **Text Secondary**: `#999` - Muted text, timestamps, secondary information
- **White**: `#fff` - Used on primary buttons and headers

### State Colors
- **Success**: `#10b981` - Success states, positive actions, checkmarks
- **Danger**: `#ef4444` - Destructive actions, errors, warnings
- **Warning**: `#ffa726` - Caution states, important notices

## Gradients

### AI Model Avatar Gradients
Each LLM has a unique gradient for visual differentiation:

- **Claude**: `linear-gradient(135deg, #D2691E, #CC785C)` - Dark orange to lighter orange
- **Gemini**: `linear-gradient(135deg, #001E50, #00A0E9)` - Dark blue to light blue
- **Grok**: `linear-gradient(135deg, #4A5568, #718096)` - Dark gray to light gray
- **Perplexity**: `linear-gradient(135deg, #0D9488, #14B8A6)` - Dark teal to light teal

### Dialog Icon Gradients
Used for dialog modal icons:

- **Info**: `linear-gradient(135deg, #667eea, #764ba2)` - Purple gradient
- **Success**: `linear-gradient(135deg, #00c853, #00897b)` - Green gradient
- **Error**: `linear-gradient(135deg, #ff6b6b, #ee5a6f)` - Red gradient
- **Warning**: `linear-gradient(135deg, #ffa726, #fb8c00)` - Orange gradient

## Typography

**Font Family**: `'TeleNeoWeb', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

The application uses the TeleNeoWeb font family loaded from `/static/fonts/`:
- Regular (400): `TeleNeoWeb-Regular.woff2`, `TeleNeoWeb-Regular.woff`
- Medium (500): `TeleNeoWeb-Medium.woff2`, `TeleNeoWeb-Medium.woff`
- Bold (700): `TeleNeoWeb-Bold.woff2`, `TeleNeoWeb-Bold.woff`

### Font Sizes
- Headers (h1-h3): `24px - 48px`
- Body text: `15px`
- Small text (timestamps, labels): `12px - 14px`
- Button text: `14px - 15px`

### Font Weights
- Regular: `400`
- Medium: `500`
- Bold: `700`

## Button Styles

### Primary Button (Outline Style)
Default button style used throughout the application:

```css
background: none;
border: 2px solid var(--primary);
color: var(--primary);
padding: 8px 16px;
border-radius: 8px;
transition: all 0.2s;
display: inline-flex;
align-items: center;
gap: 6px;

:hover {
    background: var(--primary);
    border-color: var(--primary);
    color: white;
}
```

### Sidebar Buttons

**Insights Wall Button** (Filled Primary):
```css
background: var(--primary);
color: white;
padding: 12px 16px;
border-radius: 8px;

:hover {
    background: #C00060; /* Darker magenta */
}
```

**New Chat Button** (Outline Transparent):
```css
background: transparent;
border: 1px solid rgba(255,255,255,0.3);
color: white;
padding: 12px 16px;
border-radius: 8px;

:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.5);
}
```

### Danger Button
Used for destructive actions (delete, unshare, revoke):

```css
background: none;
border: 2px solid #ef4444;
color: #ef4444;
padding: 8px 16px;
border-radius: 8px;

:hover {
    background: #ef4444;
    border-color: #ef4444;
    color: white;
}
```

### Secondary Button
```css
background: #2a2a2a;
border: 2px solid #3a3a3a;
color: #e0e0e0;

:hover {
    background: #3a3a3a;
    border-color: #4a4a4a;
}
```

### Icon Buttons
```css
background: transparent;
border: 2px solid #3a3a3a;
padding: 8px;
border-radius: 8px;

:hover {
    border-color: var(--primary);
    color: var(--primary);
}
```

## Status Indicators

### Shared Status Tag
```css
display: inline-flex;
align-items: center;
gap: 6px;
color: #10b981;
font-size: 14px;
font-weight: 500;
/* No background, no border - just text and icon */
```

### Vote/Share Counters
```css
display: inline-flex;
align-items: center;
gap: 8px;
padding: 8px 16px;
background: #1a1a1a;
border: 1px solid #3a3a3a;
border-radius: 8px;

.count {
    color: var(--primary);
    font-size: 16px;
    font-weight: 700;
}
```

## Avatars

### Size and Shape
```css
width: 40px;
height: 40px;
border-radius: 50%;
display: flex;
align-items: center;
justify-content: center;
color: white;
font-weight: 600;
font-size: 16px;
```

### Backgrounds
- **AI Avatars**: Use model-specific gradients (see Gradients section)
- **User Avatar**: `linear-gradient(135deg, #E20074, #00A0E9)` (Primary to Secondary)

## Cards

### Insight Cards
```css
background: #1a1a1a;
border-radius: 12px;
padding: 24px;
border: 1px solid #3a3a3a;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
```

### Card Footer
```css
padding-top: 16px;
border-top: 1px solid #3a3a3a;
display: flex;
justify-content: space-between;
align-items: center;
```

## Dialogs & Modals

### Dialog Overlay
```css
background: rgba(0, 0, 0, 0.7);
backdrop-filter: blur(4px);
z-index: 10000;
```

### Dialog Box
```css
background: #1a1a1a;
border-radius: 12px;
border: 1px solid #3a3a3a;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
min-width: 400px;
max-width: 500px;
```

### Dialog Icon Circle
```css
width: 56px;
height: 56px;
border-radius: 50%;
background: [gradient based on type];
```

## Form Elements

### Input Fields
```css
background: #1a1a1a;
border: 1px solid #3a3a3a;
color: #e0e0e0;
padding: 12px;
border-radius: 8px;
font-size: 15px;

:focus {
    outline: none;
    border-color: var(--primary);
}
```

### Textareas
Same as input fields, with:
```css
resize: vertical;
min-height: 100px;
```

## Tabs

```css
background: transparent;
border: none;
color: #999;
padding: 12px 24px;
border-bottom: 2px solid transparent;
transition: all 0.2s;

:hover {
    color: #e0e0e0;
}

.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
}
```

## Headers

### Page Headers
Design language page uses dark grey header:

```css
background: #1a1a1a;
color: white;
padding: 60px 20px;
text-align: center;
```

Insights page uses primary color header:

```css
background: var(--primary);
color: white;
padding: 30px 20px;
text-align: center;
```

## Spacing System

- **Extra Small**: `4px`
- **Small**: `8px`
- **Medium**: `12px - 16px`
- **Large**: `20px - 24px`
- **Extra Large**: `32px - 40px`

## Border Radius

- **Small (inputs, buttons)**: `8px`
- **Medium (cards)**: `12px`
- **Circle (avatars, dialog icons)**: `50%`

## Shadows

- **Card Shadow**: `0 2px 8px rgba(0, 0, 0, 0.3)`
- **Dialog Shadow**: `0 8px 32px rgba(0, 0, 0, 0.5)`

## Transitions

Standard transition for interactive elements:
```css
transition: all 0.2s ease;
```

## Icons

**Icon Library**: Lucide Icons (https://lucide.dev)

### Icon Sizing
- **Small**: `16px x 16px`
- **Medium**: `18px - 20px x 18px - 20px`
- **Large**: `24px - 32px x 24px - 32px`

### Common Icons Used
- `message-square` - Chat/messaging
- `share-2` - Share actions
- `x-circle` - Unshare/revoke actions
- `trash-2` - Delete actions
- `sparkles` - Remix/creative actions
- `lightbulb` - Insights
- `plus` - New/add actions
- `thumbs-up`, `thumbs-down` - Voting
- `settings`, `user`, `log-out` - Navigation/user actions

## Layout & Grid System

### Full-Width Surfaces
All major sections use full-width cards (`width: 100%`) with internal grid systems for content layout.

### Color Grid (4-Column Responsive)
```css
display: grid;
grid-template-columns: repeat(4, 1fr);
gap: 20px;

/* Responsive breakpoints */
@media (max-width: 1200px) {
    grid-template-columns: repeat(3, 1fr);
}
@media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
}
@media (max-width: 600px) {
    grid-template-columns: 1fr;
}
```

### Dividers Within Surfaces
Use horizontal dividers to separate categories within a single surface:
```css
.dl-divider {
    height: 1px;
    background: #3a3a3a;
    margin: 24px 0;
}
```

## Design Principles

1. **Outline First**: Default button style is outline (transparent background, colored border) that fills on hover
2. **Consistent Spacing**: Use the spacing system for margins and padding
3. **Clear Hierarchy**: Use color, size, and weight to establish visual hierarchy
4. **Subtle Interactions**: Use `0.2s` transitions for smooth state changes
5. **Dark Theme**: All components designed for dark mode (#0a0a0a background)
6. **Accessibility**: Maintain sufficient color contrast, focus states, and semantic HTML
7. **Icon Consistency**: Always use Lucide icons, initialize with `lucide.createIcons()`
8. **Surface Organization**: Each navigation section leads to one full-width surface, with categories separated by dividers and margins
9. **Grid-Based Layouts**: Use 4-column responsive grids for displaying multiple items (colors, gradients, etc.)

## Component States

### Disabled State
```css
:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

### Hover State
Generally adds background fill or increases brightness/opacity

### Active/Selected State
- Tabs: Primary color text + bottom border
- Buttons: Filled background
- Checkboxes/toggles: Primary color background

## Reference
For live examples and complete CSS reference, visit: `/designlanguage`
