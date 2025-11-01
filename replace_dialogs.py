"""Replace all alert() and confirm() calls with custom dialog functions."""
import re

# File paths
files = {
    'app/static/js/chat.js': [
        # Alerts
        (r"alert\('Insight is too short to share'\)", "showDialog('Insight is too short to share', 'warning')"),
        (r"alert\(`Error sharing insight: \$\{error\.message\}`\)", "showDialog(`Error sharing insight: ${error.message}`, 'error')"),
        (r"alert\(`Error unsharing insight: \$\{error\.message\}`\)", "showDialog(`Error unsharing insight: ${error.message}`, 'error')"),
        (r"alert\('Unable to share this message\. Please try again\.'\)", "showDialog('Unable to share this message. Please try again.', 'error')"),
        # Confirms
        (r"if \(!confirm\('Delete this chat\?'\)\) return;", "if (!await showConfirm('Delete this chat?', {confirmText: 'Delete', confirmStyle: 'danger'})) return;"),
        (r"if \(!confirm\('Remove this insight from the Insights Wall\?'\)\) return;", "if (!await showConfirm('Remove this insight from the Insights Wall?', {confirmText: 'Remove', confirmStyle: 'danger'})) return;"),
    ],
    'app/static/js/insights.js': [
        # Alerts
        (r"alert\(`Error: \$\{error\.message\}`\)", "showDialog(`Error: ${error.message}`, 'error')"),
        (r"alert\('Insight unshared successfully'\)", "showDialog('Insight unshared successfully', 'success')"),
        # Confirms
        (r"if \(!confirm\('Remove this insight from the Insights Wall\?'\)\) return;", "if (!await showConfirm('Remove this insight from the Insights Wall?', {confirmText: 'Remove', confirmStyle: 'danger'})) return;"),
    ],
    'app/static/js/admin.js': [
        # Alerts
        (r"alert\('System Prompt Preview:\\n\\n' \+ prompt \+ '\\n\\n\(Testing functionality will be implemented in a future update\)'\)", "showDialog('System Prompt Preview:\\n\\n' + prompt + '\\n\\n(Testing functionality will be implemented in a future update)', 'info')"),
        (r"alert\(`File \"\$\{file\.name\}\" has an invalid extension\. Only \.txt and \.md files are allowed\.`\)", "showDialog(`File \"${file.name}\" has an invalid extension. Only .txt and .md files are allowed.`, 'error')"),
        (r"alert\(`File \"\$\{file\.name\}\" is too large\. Maximum size is 500KB\.`\)", "showDialog(`File \"${file.name}\" is too large. Maximum size is 500KB.`, 'error')"),
        (r"alert\('Failed to upload files\. Please try again\.'\)", "showDialog('Failed to upload files. Please try again.', 'error')"),
        (r"alert\('Failed to delete file\. Please try again\.'\)", "showDialog('Failed to delete file. Please try again.', 'error')"),
        (r"alert\('Insight deleted successfully'\)", "showDialog('Insight deleted successfully', 'success')"),
        (r"alert\(`Error: \$\{data\.error\}`\)", "showDialog(`Error: ${data.error}`, 'error')"),
        (r"alert\('Failed to delete insight'\)", "showDialog('Failed to delete insight', 'error')"),
        (r"alert\('Failed to toggle file status'\)", "showDialog('Failed to toggle file status', 'error')"),
        # Confirms
        (r"if \(!confirm\('Are you sure you want to reset the system prompt to default\? This will discard any custom changes\.'\)\)", "if (!await showConfirm('Are you sure you want to reset the system prompt to default? This will discard any custom changes.', {confirmText: 'Reset', confirmStyle: 'danger'}))"),
        (r"if \(!confirm\(`Are you sure you want to delete \"\$\{filename\}\"\?`\)\)", "if (!await showConfirm(`Are you sure you want to delete \"${filename}\"?`, {confirmText: 'Delete', confirmStyle: 'danger'}))"),
        (r"if \(!confirm\('Are you sure you want to delete this insight\? This action cannot be undone\.'\)\)", "if (!await showConfirm('Are you sure you want to delete this insight? This action cannot be undone.', {confirmText: 'Delete', confirmStyle: 'danger'}))"),
        (r"if \(!confirm\('Delete ' \+ file\.name \+ '\?'\)\) return;", "if (!await showConfirm('Delete ' + file.name + '?', {confirmText: 'Delete', confirmStyle: 'danger'})) return;"),
    ]
}

def replace_in_file(filepath, replacements):
    """Apply regex replacements to a file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content
        for pattern, replacement in replacements:
            content = re.sub(pattern, replacement, content)

        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"[OK] Updated {filepath}")
            return True
        else:
            print(f"[SKIP] No changes needed in {filepath}")
            return False
    except Exception as e:
        print(f"[ERROR] Failed to update {filepath}: {e}")
        return False

if __name__ == '__main__':
    print("Replacing alert() and confirm() calls with custom dialogs...\n")

    updated_count = 0
    for filepath, replacements in files.items():
        if replace_in_file(filepath, replacements):
            updated_count += 1

    print(f"\n[SUCCESS] Updated {updated_count} file(s)")
