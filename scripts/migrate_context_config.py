"""Migration script to convert context_config.json to new schema.

Migration rules:
- Files with mode='window' + enabled=true → base_context
- Files with mode='vector' + enabled=true → vectorized_files.background_info
- Files with enabled=false (any mode) → vectorized_files.background_info
- Everything else defaults to vectorized_files.background_info

New schema:
{
  "base_context": ["file1.txt", "file2.md"],
  "vectorized_files": {
    "transcript": [],
    "books": [],
    "background_info": []
  },
  "streaming_sessions": {}
}
"""

import json
import os
import shutil
from datetime import datetime


def migrate_config():
    """Migrate context_config.json to new schema."""
    config_path = 'data/context_config.json'

    # Check if config exists
    if not os.path.exists(config_path):
        print(f"No existing config found at {config_path}")
        print("Creating new config with empty structure...")
        new_config = {
            "base_context": [],
            "vectorized_files": {
                "transcript": [],
                "books": [],
                "background_info": []
            },
            "streaming_sessions": {}
        }
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(new_config, f, indent=2)
        print("Done!")
        return True

    # Load existing config
    with open(config_path, 'r', encoding='utf-8') as f:
        old_config = json.load(f)

    # Check if already migrated (new schema has 'base_context' key)
    if 'base_context' in old_config:
        print("Config already in new format. No migration needed.")
        return True

    # Backup old config
    backup_path = f'data/context_config.backup.{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    shutil.copy(config_path, backup_path)
    print(f"Backed up old config to: {backup_path}")

    # Extract old structure
    file_modes = old_config.get('file_modes', {})
    enabled_files = old_config.get('enabled_files', {})

    # Build new structure
    new_config = {
        "base_context": [],
        "vectorized_files": {
            "transcript": [],
            "books": [],
            "background_info": []
        },
        "streaming_sessions": {}
    }

    # Migrate files
    print("\nMigrating files:")
    for filename, mode in file_modes.items():
        is_enabled = enabled_files.get(filename, True)  # Default to enabled

        if mode == 'window' and is_enabled:
            # Window mode + enabled -> base_context
            new_config['base_context'].append(filename)
            print(f"  {filename} -> base_context (was window+enabled)")
        else:
            # Everything else -> vectorized_files.background_info
            new_config['vectorized_files']['background_info'].append(filename)
            if is_enabled:
                print(f"  {filename} -> vectorized:background_info (was vector+enabled)")
            else:
                print(f"  {filename} -> vectorized:background_info (was disabled)")

    # Check for files in enabled_files but not in file_modes
    for filename in enabled_files:
        if filename not in file_modes:
            # No mode specified, treat as vectorized
            if filename not in new_config['vectorized_files']['background_info']:
                new_config['vectorized_files']['background_info'].append(filename)
                print(f"  {filename} -> vectorized:background_info (no mode specified)")

    # Save new config
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(new_config, f, indent=2)

    print(f"\nMigration complete!")
    print(f"  Base context files: {len(new_config['base_context'])}")
    print(f"  Vectorized files (background_info): {len(new_config['vectorized_files']['background_info'])}")

    return True


if __name__ == '__main__':
    migrate_config()
