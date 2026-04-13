#!/usr/bin/env python3
"""
Sync EDITOR_DATA in editor.html with GAME_DATA from index.html.

Run this after any change to GAME_DATA in index.html (adding arrays,
changing config, adding scenarios, etc.) to keep the editor's fallback
default in sync. Without this, a fresh editor load (no localStorage
cache and no GitHub pull) would show stale data.

Usage:
    python3 sync-editor.py

The script:
1. Extracts the GAME_DATA JSON from index.html (between the markers)
2. Replaces the EDITOR_DATA assignment in editor.html with that JSON
3. Reports the sizes for verification
"""

import re, sys

def extract_game_data(index_path):
    with open(index_path) as f:
        content = f.read()
    m = re.search(
        r'/\* GAME_DATA_START \*/\s*\nconst GAME_DATA\s*=\s*(\{.*?\})\s*;?\s*\n/\* GAME_DATA_END \*/',
        content, re.DOTALL
    )
    if not m:
        print("ERROR: Could not find GAME_DATA in", index_path)
        sys.exit(1)
    return m.group(1)

def replace_editor_data(editor_path, game_data_raw):
    with open(editor_path) as f:
        content = f.read()
    m = re.search(
        r'(var EDITOR_DATA\s*=\s*\n?)(\{[\s\S]*?\n\})(\s*\n;\s*\n// ═══ GITHUB CONFIG)',
        content
    )
    if not m:
        print("ERROR: Could not find EDITOR_DATA in", editor_path)
        sys.exit(1)
    new_content = content[:m.start()] + m.group(1) + game_data_raw + m.group(3) + content[m.end():]
    with open(editor_path, 'w') as f:
        f.write(new_content)
    return len(game_data_raw)

if __name__ == '__main__':
    game_data = extract_game_data('index.html')
    size = replace_editor_data('editor.html', game_data)
    print(f"✓ Synced EDITOR_DATA ({size:,} chars) from index.html → editor.html")
