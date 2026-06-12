#!/bin/bash
# Claude Avatar — installer
# Usage:  curl -fsSL https://avatar.unvrslabs.dev/install.sh | bash
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/unvrslabs/claude-avatar/main"
APP_URL="https://github.com/unvrslabs/claude-avatar/releases/latest/download/Claude-Avatar.app.tar.gz"
DIR="$HOME/.claude-avatar"
LABEL="com.unvrslabs.claude-avatar"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

say()  { printf '\033[38;2;216;119;86m●\033[0m %s\n' "$1"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$1"; exit 1; }

[ "$(uname)" = "Darwin" ] || fail "Per ora Claude Avatar supporta solo macOS."
command -v node >/dev/null 2>&1 || fail "Serve Node.js (brew install node)."
command -v jq   >/dev/null 2>&1 || fail "Serve jq (brew install jq)."
command -v python3 >/dev/null 2>&1 || fail "Serve python3."
command -v claude >/dev/null 2>&1 || say "Claude Code non trovato nel PATH: installalo da https://claude.com/claude-code (l'avatar si attiva con gli hook di Claude Code)."

say "Scarico Claude Avatar in $DIR"
mkdir -p "$DIR"
for f in claude-avatar.js scripts/avatar scripts/avatar-hook scripts/avatar-statusline scripts/uninstall.sh; do
  curl -fsSL "$REPO_RAW/$f" -o "$DIR/$(basename "$f")"
done
chmod +x "$DIR/avatar" "$DIR/avatar-hook" "$DIR/avatar-statusline" "$DIR/uninstall.sh"

say "Configuro il server di stato (LaunchAgent, porta 4848)"
NODE_BIN="$(command -v node)"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>$LABEL</string>
    <key>ProgramArguments</key>
    <array><string>$NODE_BIN</string><string>$DIR/claude-avatar.js</string></array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/claude-avatar.log</string>
    <key>StandardErrorPath</key><string>/tmp/claude-avatar.err</string>
</dict>
</plist>
PL
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

say "Collego gli hook di Claude Code (backup di settings.json incluso)"
SETTINGS="$HOME/.claude/settings.json"
mkdir -p "$HOME/.claude"
[ -f "$SETTINGS" ] && cp "$SETTINGS" "$SETTINGS.bak.claude-avatar.$(date +%Y%m%d-%H%M%S)"
python3 - "$SETTINGS" "$DIR" <<'PY'
import json, sys, os
path, d = sys.argv[1], sys.argv[2]
s = {}
if os.path.exists(path):
    with open(path) as f: s = json.load(f)
hooks = s.setdefault('hooks', {})
HB = os.path.join(d, 'avatar-hook')
def H(state): return {"type": "command", "command": f"{HB} {state}"}
def add(ev, entry):
    lst = hooks.setdefault(ev, [])
    if any(HB in json.dumps(e) and e.get('matcher','') == entry.get('matcher','') for e in lst):
        return
    lst.append(entry)
add('UserPromptSubmit', {"hooks": [H('thinking')]})
add('PreToolUse', {"matcher": "Edit|Write|MultiEdit|NotebookEdit", "hooks": [H('working')]})
add('PreToolUse', {"matcher": "Bash", "hooks": [H('running')]})
add('PreToolUse', {"matcher": "Read|Grep|Glob|WebFetch|WebSearch", "hooks": [H('thinking')]})
add('PostToolUse', {"matcher": "Bash", "hooks": [H('bashresult')]})
add('Notification', {"hooks": [H('waiting')]})
add('Stop', {"hooks": [H('done')]})
add('SessionEnd', {"hooks": [H('bye')]})
if 'statusLine' not in s:
    s['statusLine'] = {"type": "command", "command": os.path.join(d, 'avatar-statusline')}
    print('  status line installata')
else:
    print('  hai gia una status line personalizzata: non la tocco (vedi README per integrarla)')
with open(path, 'w') as f: json.dump(s, f, indent=2, ensure_ascii=False)
print('  hook installati')
PY

say "Comando /avatar per Claude Code"
mkdir -p "$HOME/.claude/commands"
if [ ! -f "$HOME/.claude/commands/avatar.md" ]; then
  cat > "$HOME/.claude/commands/avatar.md" <<'MD'
---
description: Apre la finestra dell'avatar Clawd (desktop pet che reagisce a Claude Code). Con "quit" la chiude.
allowed-tools: Bash(~/.claude-avatar/avatar:*)
---

## Contesto

- Risultato del comando: !`~/.claude-avatar/avatar $ARGUMENTS`

## Compito

Conferma in una riga cosa è successo (avatar aperto, oppure chiuso se l'argomento era "quit").
MD
fi

say "Scarico l'app nativa (finestrella desktop)"
if curl -fL --progress-bar "$APP_URL" -o /tmp/claude-avatar-app.tar.gz 2>/dev/null; then
  rm -rf "/Applications/Claude Avatar.app"
  tar -xzf /tmp/claude-avatar-app.tar.gz -C /Applications
  rm -f /tmp/claude-avatar-app.tar.gz
  say "App installata in /Applications"
else
  say "App nativa non ancora pubblicata: uso la finestra Chrome come fallback (identica)"
fi

mkdir -p "$HOME/.local/bin"
ln -sf "$DIR/avatar" "$HOME/.local/bin/avatar"
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) say "Aggiungi ~/.local/bin al PATH per usare il comando 'avatar' dal terminale" ;;
esac

echo
say "Fatto! Apri l'avatar con:  avatar   (o /avatar dentro Claude Code)"
say "Per disinstallare:         ~/.claude-avatar/uninstall.sh"
"$DIR/avatar" || true
