# Task Conveyor

Task Conveyor is a sleek, always-on task manager that docks to the side of your display. Designed for developers and power users, the app features a completely **keyboard-driven, button-free user interface** controlled via a global hotkey-activated Spotlight overlay or a footer command bar.

Tasks automatically shift up like a conveyor belt as you complete them, and you can safeguard urgent items using the built-in demotion blocker.

---

## Key Features

- **Docked Sidebar**: Stays pinned to the right edge of your primary screen (integrates with Windows AppBar API on Windows, and monitors macOS/Linux work areas).
- **Global Hotkey Toggle**: Show or hide the Spotlight-style overlay input from anywhere using:
  - **macOS**: `Option+Space` (labeled `⌥Space` in UI)
  - **Windows**: `Ctrl+Space`
- **100% Keyboard Controlled**: No buttons, no clicks. Create, move, remove, and pin tasks entirely through typing.
- **Prefix Shortcuts**:
  - `<text>`: Add task to the **bottom** of the queue.
  - `!<text>`: Add task as **next up** (index 1).
  - `!!<text>`: Insert task as the **current active task** (index 0), shifting the previous task down.
- **Tag, Project & Mention Autocomplete**: Type `#` for tags, `$` for projects, or `@` for mentions and press `[Tab]` to autocomplete items from your custom `autocomplete.json` config.
- **Demotion Block Guard**: Mark a task `/important` to lock it in the current slot. The app rejects any commands or prepends that would demote it until you toggle the lock off.
- **Single-level Undo**: Revert any list modification command instantly.
- **Automatic Persistence**: Tasks survive app restarts and reloads by automatically syncing to local storage.

---

## Keyboard Command Reference

Type any of the following commands in the Spotlight overlay or the sidebar footer input:

| Command | Action | Description |
| :--- | :--- | :--- |
| `<text>` | Add Task | Creates a new task at the bottom of the list. |
| `!<text>` | Next Task | Creates a new task at index 1 (directly below the current task). |
| `!!<text>` | Prepend Task | Inserts a new task in the "current" slot (index 0), moving the old current task down. (Blocked if current task is important). |
| `/d[one] [b[reak]]` | Complete Task | Ends the current task (index 0) and moves to the next. Passing `b` or `break` inserts a "Break" task at index 0 immediately. |
| `/b[reak]` | Take Break | Inserts a "Break ☕" task at index 0, moving the current task down. (Blocked if current task is important). |
| `/m[ove] x y` | Absolute Move | Moves task `x` (0-indexed) to index `y`. (Blocked if it demotes an important task). |
| `/m[ove] x u\|d [y]` | Relative Move | Moves task `x` (0-indexed) up (`u`) or down (`d`) by `y` spots (default `1`). Clamps at list bounds. (Blocked if it demotes an important task). |
| `/r[emove] x` | Remove Task | Deletes task `x` (0-indexed) from the list. |
| `/u[ndo]` | Undo Last Action | Reverts the previous command (1-level history depth). |
| `/i[mportant]` | Toggle Urgent | Toggles important status on the current task (index 0). Styles it with a pulsing red card and blocks any demotion. |
| `/p[in]` | Toggle Pin | Pinned/always-on-top toggle for the sidebar dock. |
| `/config` or `/tags` | Open Autocomplete Config | Opens `autocomplete.json` in your default text editor. |
| `/c[lear]` | Clear All | Clears all tasks from the conveyor belt. |
| `/h[elp]` or `/?` | Help | Displays a help message in the sidebar listing available commands. |

---

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- [pnpm](https://pnpm.io/)

### Installation

Clone the repository and install the project dependencies:

```bash
git clone https://github.com/thealternator89/task-conveyor.git
cd task-conveyor
pnpm install
```

### Running in Development

Start the Electron app in development mode with hot-reloading:

```bash
pnpm start
```

### Build & Package

To package the application for production:

```bash
# Packages the app for your current OS platform
pnpm run package

# Creates distributable installers (DMG, Zip, Squirrel, etc.)
pnpm run make
```

### Linting

Run ESLint to check for code issues:

```bash
pnpm run lint
```
