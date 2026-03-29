# OpenDictate

OpenDictate is an open-source desktop dictation application built with Electron. Press a global hotkey to start recording, speak, and have your words transcribed and inserted directly into any focused input field — powered by a Whisper-compatible API and optional Gemini AI refinement.

## Features

- **Global hotkey** — Start/stop recording from anywhere with a configurable keyboard shortcut
- **Overlay indicator** — A minimal always-on-top overlay shows recording and processing state
- **Auto text insertion** — Transcribed text is pasted into the last focused field automatically
- **AI refinement** — Optionally clean up transcriptions using Google Gemini (removes filler words, fixes punctuation)
- **Transcription history** — All dictations are stored locally in a SQLite database
- **System tray** — Runs quietly in the background with tray icon state feedback
- **Configurable** — Hotkey, overlay position, Gemini model, and system prompt are all user-adjustable

## Download

Pre-built packages are available on the [Releases](https://github.com/raghavendra-k-j/OpenDictate/releases) page.

| Platform | Package |
|---|---|
| Windows | `OpenDictate-Setup.exe` (Squirrel installer) |
| macOS | `OpenDictate-darwin-*.zip` |
| Linux (Debian/Ubuntu) | `*.deb` |
| Linux (Fedora/RHEL) | `*.rpm` |

## Installation

### Windows

Run `OpenDictate-Setup.exe`. Squirrel installs and launches the app automatically. A tray icon will appear in the system tray.

### macOS

Extract the ZIP archive and move `OpenDictate.app` to your `/Applications` folder, then open it.

### Linux

**Debian/Ubuntu:**
```bash
sudo dpkg -i opendictate_*.deb
```

**Fedora/RHEL:**
```bash
sudo rpm -i opendictate-*.rpm
```

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- npm v9+
- **Windows:** Visual Studio Build Tools (required for native `better-sqlite3` module)
- **macOS/Linux:** `python3`, `make`, and a C++ compiler

### Steps

```bash
# Clone the repository
git clone https://github.com/raghavendra-k-j/OpenDictate.git
cd OpenDictate

# Install dependencies
npm install

# Run in development mode
npm start

# Build a distributable package
npm run package   # outputs to out/

# Create platform installer(s)
npm run make      # outputs to out/make/
```

## First-run Setup

OpenDictate requires a Whisper-compatible transcription endpoint.

1. Launch the app — it appears in the **system tray**.
2. Open **Settings** from the tray menu.
3. Paste a **cURL command** from your Whisper API provider (e.g. OpenAI, a self-hosted Whisper instance).
4. *(Optional)* Enter a **Google Gemini API key** to enable AI text refinement. The default model is `gemini-2.5-flash`.
5. Configure your preferred **hotkey** (default: `Ctrl+Shift+Space` / `Cmd+Shift+Space`) and **overlay corner position**.

## Usage

1. Click into any text field in any application.
2. Press the configured hotkey to **start recording**.
3. Speak clearly. Press the hotkey again (or it will auto-stop) to **stop recording**.
4. The transcribed text is inserted at the cursor automatically.

The tray icon and overlay indicator reflect the current state: **Ready**, **Recording**, or **Processing**.

## Configuration

Settings are stored as JSON in the Electron `userData` directory:

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\opendictate\settings.json` |
| macOS | `~/Library/Application Support/opendictate/settings.json` |
| Linux | `~/.config/opendictate/settings.json` |

Transcription history is stored in a SQLite database in the same directory.

## Tech Stack

- [Electron](https://www.electronjs.org/) 41
- [Vite](https://vitejs.dev/) + TypeScript
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — local history storage
- [@google/genai](https://github.com/googleapis/js-genai) — Gemini AI refinement
- [Electron Forge](https://www.electronforge.io/) — build & packaging

## License

MIT © 2026 [Raghavendra K J](mailto:raghavendra.kj@bluecrimson.in)
