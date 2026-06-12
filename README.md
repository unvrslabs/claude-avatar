# Claude Avatar

A tiny desktop pet for [Claude Code](https://claude.com/claude-code): Clawd lives in a small always-on-top window and reacts in real time to what Claude is doing. It thinks, types on its keyboard, runs commands, celebrates green tests with confetti, panics on errors and falls asleep when you stop working.

One avatar per Claude Code session: open three terminals, get three Clawds, each tagged with its project name.

## Install

```bash
curl -fsSL https://avatar.unvrslabs.dev/install.sh | bash
```

Then open the window with `avatar` from any terminal, or type `/avatar` inside Claude Code.

## What it does

| Claude Code is...      | Clawd...                                        |
|------------------------|--------------------------------------------------|
| reading / thinking     | looks around, thought dots floating              |
| editing files          | types on a pixel keyboard, code lines on screen  |
| running commands       | types, terminal panel with live prompt lines     |
| done, tests green      | jumps with confetti                              |
| hit an error           | shakes, wide eyes, red exclamation mark          |
| waiting for you        | stares at you with a speech bubble               |
| idle for 90s           | falls asleep, zzz                                |

It also adds a minimal **status line** inside Claude Code (state, model, folder, git branch), synced with the window.

## How it works

- A zero-dependency Node server (`~/.claude-avatar/claude-avatar.js`) keeps one state per Claude Code session on `127.0.0.1:4848` (loopback only, nothing is exposed).
- [Claude Code hooks](https://docs.claude.com/en/docs/claude-code/hooks) report what's happening (prompt submitted, tool used, turn done, session ended).
- A native Tauri window (or a Chrome app-mode window as fallback) renders the pixel canvas. Multiple windows stack bottom-right, drag them wherever you like.

## Commands

```bash
avatar          # open a window (bound to the most recent active session)
avatar quit     # close all windows (also hides the status line state)
```

Inside Claude Code: `/avatar` and `/avatar quit`.

## Requirements

macOS (Apple Silicon or Intel), Node.js, jq, Claude Code.

## Uninstall

```bash
~/.claude-avatar/uninstall.sh
```

Removes the app, the LaunchAgent, the hooks and the status line from `~/.claude/settings.json` (with a backup), and the install folder. No leftovers.

## License & credits

Code is [MIT](LICENSE). The Clawd character is the property of [Anthropic](https://www.anthropic.com) — this is an unofficial, non-commercial fan project, not affiliated with or endorsed by Anthropic. See [NOTICE.md](NOTICE.md).

Inspired by the lovely [clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk) and [claude-code-mascot-statusline](https://github.com/TeXmeijin/claude-code-mascot-statusline). All pixel scenes here (keyboard, terminal, confetti, bubbles) are original artwork.

Made by [UNVRS Labs](https://unvrslabs.dev).
