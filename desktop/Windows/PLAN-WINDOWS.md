# Omi for Windows — Port Plan (Track 1: Windows App)

Goal: a Windows desktop app that is as close as possible to the macOS Swift app
(`desktop/Desktop`), talking to the same production backends, with as many Mac
features working as possible.

## Stack

- **Electron 38 + TypeScript + React 18 + Vite** (electron-vite). Chosen because every
  Mac feature has a 1:1 Windows path here: frameless always-on-top panel (floating bar),
  tray, global hotkeys, `desktopCapturer` screenshots, **WASAPI system-audio loopback**
  (`setDisplayMediaRequestHandler` + `audio: 'loopback'`), protocol-scheme OAuth, and
  SSE/WebSocket streaming from the main process (Node `ws` can send the same
  `Authorization` headers the Swift app sends via URLSession).
- Local data: `better-sqlite3` (FTS5) mirroring GRDB usage on Mac.
- OCR: Windows.Media.Ocr (WinRT) via a persistent PowerShell sidecar — native Windows
  counterpart of Apple Vision.

## Backends (same as Mac app)

| Concern | Endpoint |
|---|---|
| Python API | `https://api.omi.me/` (`OMI_PYTHON_API_URL` overridable) |
| Rust desktop backend | `https://desktop-backend-hhibjajaja-uc.a.run.app/` (`OMI_DESKTOP_API_URL`) |
| Auth | `/v1/auth/authorize` (browser) -> `omi-computer://auth/callback` -> `/v1/auth/token` -> Firebase REST `signInWithCustomToken` (key from `GoogleService-Info.plist`, public client key) -> refresh via `securetoken.googleapis.com` |
| Chat | `POST {rust}/v2/chat/completions` (OpenAI-compatible Anthropic proxy, `claude-sonnet-4-6`, SSE) |
| Conversation capture | `wss://api.omi.me/v4/listen?language=&sample_rate=16000&codec=pcm16&channels=1&include_speech_profile=true&source=desktop&speaker_auto_assign=enabled` (16 kHz mono PCM16 frames) |
| Push-to-talk | `wss://api.omi.me/v2/voice-message/transcribe-stream` (`finalize` text frame ends a turn) |
| Data | `/v1/conversations`, `/v3/memories`, `/v1/action-items`, `/v1/goals/all`, `/v2/chat-sessions`, `/v2/desktop/messages`, `/v1/users/profile`, `/v1/knowledge-graph` |

## Fidelity targets (from `Sources/Theme` + window code)

- Colors: bg `#0F0F0F/#1A1A1A/#252525/#35343B`, raised `#1F1F25`, border `#3A3940@28%`,
  text `#FFF/#E5E5E5/#B0B0B0/#888`, accent purple `#8B5CF6/#A855F7/#7C3AED`, user bubble
  `#43389F`, speaker color rotation (6), status `#10B981/#F59E0B/#EF4444/#3B82F6`.
- Radii: window 26, card 24, section 20, control 16, chip 14. Bubbles 18.
- Main window 1200x800 (min 900x600), sidebar 260px (collapsed 64px), content card with
  gradient + 1px border + soft shadow.
- Floating bar: borderless always-on-top panel; collapsed pill 40x14 -> hover 210x50
  ("Ask omi" + "Push to talk") -> AI conversation 430px wide; position persisted;
  visible over fullscreen apps where Windows allows (screen-saver level).
- Sidebar items + order: Dashboard, Conversations, Memories, Tasks, Rewind, Apps;
  permission rows + device widget + profile menu at bottom.

## Feature matrix (build order)

| # | Feature | Mac source | Windows approach |
|---|---|---|---|
| 1 | Shell: tray, hotkey, windows, single-instance | OmiApp.swift | Electron main; tray menu mirrors NSStatusBar menu; `Ctrl+Shift+Space` default Ask-Omi hotkey (configurable) |
| 2 | Theme/design system | Sources/Theme | CSS custom properties, exact tokens |
| 3 | Sign-in (Google/Apple) | AuthService.swift | System browser + `omi-computer://` scheme (whitelisted by backend); token store via `safeStorage` |
| 4 | Floating bar (text + voice ask, streaming) | FloatingControlBar/ | Frameless transparent panel, states as on Mac |
| 5 | Chat page + sessions | ChatPage, ChatProvider | Same `/v2/chat/completions` SSE + `/v2/chat-sessions` |
| 6 | Conversations (list, detail, transcript, star, search) | ConversationsPage | `/v1/conversations` REST |
| 7 | Live transcription (mic + system audio) | AudioSourceManager, TranscriptionService | Renderer AudioWorklet 16k PCM16 -> IPC -> main-process `ws` `/v4/listen`; loopback via display-media handler |
| 8 | Memories | MemoriesPage | `/v3/memories` REST, category filters |
| 9 | Tasks | TasksPage | `/v1/action-items` (complete, due, priority) |
| 10 | Dashboard | DashboardPage | Greeting, today's tasks, recent conversations, goals |
| 11 | Rewind-lite | Rewind/ | 3s `desktopCapturer` captures, dHash dedup (<=5 bits), JPEG q0.8 max 3000px, WinRT OCR, SQLite FTS5, timeline + search UI |
| 12 | Screenshot context ("What do you see?") | ScreenCaptureService | Attach capture to chat as image part; OCR text fallback |
| 13 | Settings | SettingsPage | General/Rewind/Transcription/Account/Advanced(BYOK)/About |
| 14 | PTT voice ask | PushToTalkManager | Hold-to-talk on floating bar -> transcribe-stream |
| 15 | Packaging | codemagic | electron-builder NSIS installer + portable exe |

Stretch (only after the above): TTS replies (`/v1/tts/synthesize`), knowledge graph page,
proactive memory extraction via `/v1/proxy/gemini`, live notes.

Out of scope for this challenge: BLE pendant (CoreBluetooth stack), agent VMs, Sparkle
auto-update (stubbed "Check for updates"), Crisp.

## Risks / mitigations

- Rust-backend chat is paywalled -> graceful upgrade message + BYOK headers
  (`X-BYOK-*`) supported in Settings -> Advanced, same as Mac.
- `better-sqlite3` prebuilds for Electron ABI -> fallback to JSON + linear search.
- Loopback audio needs Electron >= 31 -> using 38.
