#!/bin/bash
# Claude Avatar — uninstaller. Rimuove tutto quello che install.sh ha installato.
set -uo pipefail

DIR="$HOME/.claude-avatar"
LABEL="com.unvrslabs.claude-avatar"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SETTINGS="$HOME/.claude/settings.json"

echo "● Chiudo le finestre e fermo il server"
pkill -x claude-avatar 2>/dev/null
launchctl unload "$PLIST" 2>/dev/null
rm -f "$PLIST"

echo "● Rimuovo gli hook da settings.json (backup incluso)"
if [ -f "$SETTINGS" ]; then
  cp "$SETTINGS" "$SETTINGS.bak.avatar-uninstall.$(date +%Y%m%d-%H%M%S)"
  python3 - "$SETTINGS" "$DIR" <<'PY'
import json, sys
path, d = sys.argv[1], sys.argv[2]
with open(path) as f: s = json.load(f)
HB = d + '/avatar-hook'
hooks = s.get('hooks', {})
for ev in list(hooks.keys()):
    hooks[ev] = [e for e in hooks[ev] if HB not in json.dumps(e)]
    if not hooks[ev]: del hooks[ev]
sl = s.get('statusLine', {})
if isinstance(sl, dict) and d in sl.get('command', ''):
    del s['statusLine']
with open(path, 'w') as f: json.dump(s, f, indent=2, ensure_ascii=False)
print('  hook e status line rimossi')
PY
fi

echo "● Rimuovo app, comando e file"
rm -rf "/Applications/Claude Avatar.app"
rm -f "$HOME/.local/bin/avatar" "$HOME/.claude-avatar-hidden"
grep -q 'claude-avatar/avatar' "$HOME/.claude/commands/avatar.md" 2>/dev/null && rm -f "$HOME/.claude/commands/avatar.md"
rm -rf "$DIR"

echo "✓ Claude Avatar disinstallato. Ciao da Clawd! 🦀"
