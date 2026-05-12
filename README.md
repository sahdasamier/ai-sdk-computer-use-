Author: Sahda Samier

<h1 align="center">AI SDK Computer Use</h1>

<p align="center">
  A full-stack AI agent that controls a real Linux desktop — taking screenshots, clicking, typing, and running shell commands — all visible in your browser in real time.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#state-management">State Management</a> ·
  <a href="#event-pipeline">Event Pipeline</a> ·
  <a href="#running-locally">Running Locally</a> ·
  <a href="#environment-variables">Environment Variables</a>
</p>

---

## Features

- **Computer Use Agent** — Claude controls a real desktop via `screenshot`, `left_click`, `type`, `scroll`, `key`, and `bash` tools.
- **Live VNC Stream** — The sandbox desktop is streamed to the browser via noVNC inside a resizable iframe.
- **Tool Event Pipeline** — Every tool call is parsed in real time into a typed `AgentEvent` and displayed in a scrollable Debug Panel with live counters.
- **Detail View** — Clicking any event in the Debug Panel switches the right panel from the VNC stream to a rich detail card showing the screenshot image, bash output, click coordinates, typed text, duration, and raw JSON payload.
- **Multi-Session Support** — Multiple named chat sessions, each with their own event history, persisted to `localStorage` via Zustand.
- **PackyAPI Proxy** — All Anthropic API calls are routed through [PackyAPI](https://www.packyapi.com) as a reverse proxy, keeping the real API key server-side while allowing flexible model routing.
- **Next.js 15 App Router** — Streaming chat responses over a single `POST /api/chat` route using the Vercel AI SDK `streamText` + `toDataStreamResponse`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│                                                                  │
│  ┌─────────────────┐   messages   ┌──────────────────────────┐  │
│  │   ChatArea       │ ──────────► │  useEventPipeline (hook) │  │
│  │  (useChat hook)  │             │  parses UIMessage parts  │  │
│  └────────┬─────────┘             └──────────┬───────────────┘  │
│           │ POST /api/chat                    │ addEvent /       │
│           │                                   │ updateEvent      │
│           ▼                                   ▼                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Zustand Stores                              │    │
│  │  useAgentStore  — sessions, events, selectedEventId     │    │
│  │  useSandboxStore — sandboxId, isInitializing            │    │
│  └──────────────────┬──────────────────────────────────────┘    │
│                     │                                            │
│   ┌─────────────────┴────────────────┐                          │
│   │          Right Panel             │                          │
│   │  selectedEvent? → EventDetail    │                          │
│   │  otherwise      → VNCViewer      │                          │
│   │  (React.memo — no re-render on   │                          │
│   │   unrelated state changes)       │                          │
│   └──────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
         │ POST /api/chat (streaming)
         ▼
┌─────────────────────────────┐
│  Next.js API Route          │
│  app/api/chat/route.ts      │
│                             │
│  streamText(                │
│    model: packyAnthropic(…) │  ◄─── PackyAPI proxy
│    tools: {                 │       https://www.packyapi.com/v1
│      computer, bash         │
│    }                        │
│  )                          │
└──────────────┬──────────────┘
               │ tool execution
               ▼
┌─────────────────────────────────────────────┐
│  Vercel Sandbox (ephemeral Linux VM)         │
│                                             │
│  Xvnc  :99  (1024 × 768)                   │
│  openbox  (window manager)                  │
│  Google Chrome  (pre-launched)              │
│  websockify → noVNC  (port 6080)            │
│  ImageMagick import  (screenshots)          │
│  xdotool  (mouse / keyboard)                │
└─────────────────────────────────────────────┘
               │ noVNC WebSocket
               ▼
        iframe in browser
```

---

## State Management

Two purpose-built Zustand stores keep the UI reactive without prop drilling.

### `useAgentStore` — agent sessions and events

```
AgentStore
├── sessions: ChatSession[]          ← persisted to localStorage
│   ├── id, title, createdAt
│   ├── messages: ChatMessage[]
│   └── events: AgentEvent[]
├── activeSessionId: string | null
├── selectedEventId: string | null   ← drives Detail View
└── agentStatus: "idle" | "thinking" | "executing"
```

Key design decisions:

- **`persist` middleware** serialises sessions to `localStorage` so history survives page reloads.
- **`WeakMap` counter cache** — `getActiveSessionEventCounts` stores computed per-type counters keyed by the `events` array reference. Because Zustand produces a new array reference on every mutation, the cache stays consistent without a manual invalidation step.
- **Stable selector references** — `getActiveSessionEvents`, `getSelectedEvent`, and `getActiveSessionEventCounts` are module-level functions rather than inline lambdas, preventing unnecessary re-renders in components that subscribe to them.

### `useSandboxStore` — sandbox lifecycle

A lightweight, non-persistent store that tracks the active sandbox ID and whether the desktop is still initialising, used by both `VNCViewer` and `ChatArea` to gate interactions.

---

## Event Pipeline

`hooks/useEventPipeline.ts` is the bridge between the AI SDK's streaming `UIMessage` array and the typed event model the UI consumes.

### Flow

```
useChat messages  →  useEventPipeline  →  useAgentStore
 (UIMessage[])         (useEffect)        addEvent / updateEvent
```

### Two-pass event lifecycle

Every tool invocation passes through the pipeline twice:

| Pass | `state` | Action |
|------|---------|--------|
| 1st | `"call"` | `addEvent` with `status: "pending"` and call-time args |
| 2nd | `"result"` | `updateEvent` with `status: "complete"`, duration, result data, and updated payload |

A `processedIds` ref (`Set<string>`) keyed on `sessionId:messageId:toolCallId:state` prevents double-processing when React re-runs the effect.

### Typed event mapping

Each tool invocation is mapped to one of five strongly-typed `AgentEvent` variants:

| Tool | Action | Mapped type |
|------|--------|-------------|
| `computer` | `screenshot` | `ScreenshotEvent` — extracts base64 → `data:image/png` URL |
| `computer` | `left_click`, `double_click`, `right_click`, `mouse_move`, `scroll`, `left_click_drag` | `ClickEvent` — stores `x`, `y`, and action name |
| `computer` | `type`, `key` | `TypeEvent` — stores the typed text or key sequence |
| `computer` | `wait` | `BashEvent` — rendered as `sleep <duration>` |
| `bash` | any | `BashEvent` — stores command, stdout, exit code |

### Payload update on result

When `updateEvent` fires on the result pass, it merges all typed fields **plus** the raw `payload` (containing the full result-state invocation). This ensures the Detail View's *Raw Payload* section always shows the actual result, not just the call snapshot.

---

## VNC Performance — `React.memo`

`VNCViewer` is wrapped in `React.memo`:

```tsx
export const VNCViewer = memo(VNCViewerComponent);
```

The VNC stream lives inside an `<iframe>`. Without memoisation, any parent re-render (e.g. a new streaming token arriving in `ChatArea`) would cause React to reconcile the iframe, interrupting the WebSocket connection. `React.memo` prevents re-renders unless the component's own subscribed Zustand slices actually change.

The component subscribes to exactly two store slices:
- `useSandboxStore` — for the `streamUrl` and `isInitializing` flag.
- `useAgentStore(getSelectedEvent)` — to switch between the VNC iframe and the `EventDetail` view.

---

## Project Structure

```
.
├── app/
│   ├── api/chat/route.ts        # streamText + computerTool + bashTool
│   └── page.tsx                 # Root layout with resizable panels
├── components/
│   ├── chat/ChatArea.tsx        # useChat, sends sandboxId with every request
│   ├── debug/DebugPanel.tsx     # Event list with type counters
│   ├── message.tsx              # Per-message renderer, tool invocation cards
│   ├── sidebar/Sidebar.tsx      # Session switcher
│   └── vnc/VNCViewer.tsx        # VNC iframe + EventDetail
├── hooks/
│   └── useEventPipeline.ts      # UIMessage → AgentEvent transformer
├── lib/
│   └── sandbox/
│       ├── tool.ts              # computerTool + bashTool (AI SDK tool() + Zod)
│       └── utils.ts             # getDesktop, getDesktopURL, killDesktop
├── store/
│   ├── useAgentStore.ts         # Sessions, events, selection (persisted)
│   └── useSandboxStore.ts       # Sandbox lifecycle (ephemeral)
└── types/
    └── events.ts                # AgentEvent discriminated union
```

---

## Running Locally

### Prerequisites

- Node.js 18+
- A [Vercel](https://vercel.com) account (for Sandbox access)
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone and install

```bash
git clone https://github.com/your-username/ai-sdk-computer-use
cd ai-sdk-computer-use
yarn install
```

### 2. Set up Vercel credentials

```bash
npm install -g vercel
vercel link
vercel env pull
```

This writes `VERCEL_OIDC_TOKEN` to `.env.local`. Alternatively, set `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` manually.

### 3. Create the sandbox snapshot

The snapshot pre-installs Xvnc, openbox, Chrome, noVNC, xdotool, and ImageMagick so sandboxes boot in seconds instead of minutes.

```bash
npx tsx lib/sandbox/create-snapshot.ts
```

This takes ~10 minutes. When complete it prints a snapshot ID — add it to `.env.local`:

```
SANDBOX_SNAPSHOT_ID=snap_xxxxxxxxxxxxx
```

### 4. Add remaining variables

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 5. Start the dev server

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key — routed through PackyAPI |
| `SANDBOX_SNAPSHOT_ID` | Yes | Vercel Sandbox snapshot with the desktop environment |
| `VERCEL_OIDC_TOKEN` | Yes* | Auto-set by `vercel env pull` for Sandbox auth |
| `VERCEL_TOKEN` | Alt* | Alternative — a Vercel personal access token |
| `VERCEL_TEAM_ID` | Alt* | Required alongside `VERCEL_TOKEN` |
| `VERCEL_PROJECT_ID` | Alt* | Required alongside `VERCEL_TOKEN` |

\* Either `VERCEL_OIDC_TOKEN` (from `vercel env pull`) **or** the `VERCEL_TOKEN` + team/project pair is required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| AI SDK | Vercel AI SDK v4 (`ai`, `@ai-sdk/anthropic`) |
| LLM | Claude Sonnet 4.6 via **PackyAPI** proxy |
| Sandbox | `@vercel/sandbox` — ephemeral Linux VM |
| VNC | noVNC + websockify (port 6080) |
| State | Zustand 5 with `persist` middleware |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI, Lucide |
| Panels | `react-resizable-panels` |
| Animation | Motion (Framer Motion) |
| Validation | Zod (tool parameter schemas) |
| Language | TypeScript 5 |
