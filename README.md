# opencode-session-time

> ⚠️ **npm install is broken**: interactive updates (collapse/click/live refresh) don't
> work when installed from npm due to an upstream OpenCode bug
> [anomalyco/opencode#39986](https://github.com/anomalyco/opencode/issues/39986)
> ("tui: support reactive external TSX plugins in packaged CLI", open): the packaged CLI
> skips the host TSX transform for plugins loaded from the npm cache, so the plugin's own
> copies of `@opentui/solid` break the reactivity graph — the first frame renders, then
> nothing updates.
>
> **Install: `opencode plugin add github:…` (or the clone + absolute-path fallback).**
> See [Install](#install) below.

[![npm version](https://img.shields.io/npm/v/opencode-session-time)](https://www.npmjs.com/package/opencode-session-time)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Timestamps for your [OpenCode](https://opencode.ai) V2 sessions: a current-turn
stopwatch in the prompt footer, a `Session`/`Last answer` sidebar block, and a
`/time` timeline popup.

> **v0.2.0–v0.2.1 contributed by [@ransagy](https://github.com/ransagy)** — last user
> input, last model thought and last model reply timings, turn stopwatch, API backfill,
> durable persistence and throttled live refresh.

Small TUI plugin built on the official [`@opencode/plugin/tui`](https://opencode.ai/v2/docs/build/plugins/cli/) API.

## What you get

| Where | What |
| --- | --- |
| Prompt footer (`prompt.footer.status`) | current-turn elapsed time, `⏱ MM:SS` (or `⏱ H:MM:SS`). Starts when the first assistant step begins after the last user input and freezes when the turn completes. If that step is outside the loaded message window, it falls back to the last user input time. |
| Sidebar (`sidebar.content`) | `Session` block styled like the built-in `Context`/`MCP` blocks (session start, request/step counters), plus a `Last answer` section: last user input, model thought phases (count ×N and total duration), last model reply, and top tool counts. Rows are laid out in a fixed order with the timestamp/payload right-aligned; they refresh on data events. Historical values are backfilled from the API when they are outside the loaded window. |
| `/time` command (palette popup) | assistant turn timeline as a searchable popup, newest first: time, agent, model, duration, reply preview. **Enter** opens a per-turn details card (timing, tokens, cost, finish reason); **Esc** returns to the list, **Esc** again closes. |

The sidebar block updates on data events: timestamps and durations re-render whenever
the data behind them changes. There is no per-second "x ago" countdown — timestamps are
absolute times. The prompt-footer timer is a turn stopwatch, not a wall clock; it shows
`00:00` while waiting for the first assistant step and `—` when there is no turn.

Per-session anchors are persisted in durable storage, so a TUI restart restores the
last input, thought, and reply immediately; the API backfill covers new sessions and
other devices.

Example:

```text
▼ Session
• Started              16:27:31
• Requests 12 · Steps 48
  Last answer  ⏱
  • User                17:43:12
  • Thought ×2 · 2.1s   17:43:20
  • Reply · 8.4s        17:44:02
  • Tools 5 · shell 3 · read 2
```

Same-day timestamps omit the date. Older timestamps include it (`23.10, 16:27:31`).

The prompt footer shows the current-turn stopwatch:

```text
⏱ 03:12
```

## Why the sidebar and not under each message?

The plugin API exposes slots for `app`, `home.footer*`, `prompt.footer*`,
`session.composer.top`, `sidebar.*` and `session.panel` — but there is **no slot for
the per-message footer**, and no settings option for it either. Inline per-message
timestamps would need an upstream `message.footer` slot. Until then, the sidebar block
is the closest native place.

## Install

TUI-only plugin. The npm package is currently broken (see the warning at the top), so
install from GitHub instead. Two equivalent ways to do that:

### 1. `opencode plugin add github:…` (works on current CLI versions)

```bash
opencode plugin add github:LazyGatto/opencode-session-time
# or a pinned tag:
opencode plugin add github:LazyGatto/opencode-session-time#v0.4.0
```

`opencode plugin add` writes the plugin to your global CLI configuration and installs it.
Restart the TUI after installing.

### 2. Fallback: git clone + absolute path (version-independent)

On some CLI versions the git-dep install step above can fail with
`NpmInstallFailedError: … git dep preparation failed`. If that happens, clone the
repository and reference it by absolute path:

```bash
git clone https://github.com/LazyGatto/opencode-session-time.git \
  ~/opencode-plugins/opencode-session-time
```

```jsonc
// ~/.config/opencode/cli.json
{
  "plugins": ["/absolute/path/to/opencode-session-time"]
}
```

Restart the TUI after installing.

Note: listing `"github:…"` directly in `cli.json` triggers the same git-dep install as
`plugin add`, so if that step fails on your CLI version, prefer the absolute path.

Requirements: OpenCode V2; `@opentui/core`, `@opentui/solid`, `solid-js` are peer
dependencies provided by the host. This is a terminal-client plugin; web and desktop
clients do not load TUI plugins.

## Notes

- `/time` shows the timeline for the session you are currently in.
- The sidebar block uses `append`, so it appears after the built-in Context/MCP panels.
- Plugin edits hot-reload: the plugin is rebuilt on reconciliation, no TUI restart needed.

## License

MIT. Original work copyright (c) 2026 LazyGatto; see [LICENSE](LICENSE).
