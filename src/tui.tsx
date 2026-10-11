import { Plugin } from "@opencode/plugin/tui"
import { createSignal, For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"

// opencode-session-time: timestamps for your OpenCode sessions.
//
//  - prompt.footer.status — wall clock near the prompt;
//  - sidebar.content      — a "Session" block (started / last answer), updates live;
//  - session.panel        — a /time command with the per-turn timeline.
//
// Note: the OpenCode plugin API has no slot for the per-message footer, so
// inline timestamps under each message are not possible yet (upstream feature
// request: a `message.footer` slot).

const pad = (n: number) => String(n).padStart(2, "0")
const fmt = (ms: number) => {
  const d = new Date(ms)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const messages = (context: any, sessionID: string): any[] =>
  (context.data.session.message.list(sessionID) ?? []) as any[]

export default Plugin.define({
  id: "session-time",
  setup(context) {
    // One tick drives every slot: any data event re-renders, plus a 30s timer.
    const [tick, setTick] = createSignal(0)
    const bump = () => setTick((t) => t + 1)
    const unlisten = context.data.listen(() => bump())
    const timer = setInterval(bump, 30_000)

    // 1) Wall clock in the prompt footer.
    const disposeClock = context.ui.slot({
      append: "prompt.footer.status",
      render: () => {
        tick()
        return <text fg={context.theme.text.muted}>{fmt(Date.now())}</text>
      },
    })

    // 2) "Session" block in the sidebar (styled like the built-in Context/MCP blocks).
    const disposeSide = context.ui.slot({
      append: "sidebar.content",
      render: ({ sessionID }) => {
        tick()
        const list = messages(context, sessionID)
        const started = context.data.session.get(sessionID)?.time?.created ?? 0
        let last = 0
        for (const m of list) {
          const done = m.time?.completed ?? m.time?.created ?? 0
          if (done > last) last = done
        }
        return (
          <box flexDirection="column">
            <text fg={context.theme.text.base} attributes={TextAttributes.BOLD}>Session</text>
            <text fg={context.theme.text.muted}>{started ? fmt(started) : "—"} started</text>
            <text fg={context.theme.text.muted}>{last ? fmt(last) : "—"} last answer</text>
          </box>
        )
      },
    })

    // 3) /time — per-turn timeline panel.
    const disposePanel = context.ui.slot({
      append: "session.panel",
      render: (panel) => (
        <Show when={panel.name === "session-time.timeline"}>
          {(() => {
            tick()
            const route = context.ui.router.current()
            const sid = route.type === "session" ? (route.sessionID as string) : undefined
            const list = sid ? messages(context, sid) : []
            return (
              <box flexDirection="column">
                <text fg={context.theme.text.base} attributes={TextAttributes.BOLD}>Timeline</text>
                <For each={list}>
                  {(m: any) => (
                    <text fg={context.theme.text.muted}>
                      {fmt(m.time?.created ?? 0)} · {m.agent ?? "—"} ·{" "}
                      {m.model?.id ?? m.model ?? "—"} →{" "}
                      {m.time?.completed ? fmt(m.time.completed) : "in progress"}
                    </text>
                  )}
                </For>
              </box>
            )
          })()}
        </Show>
      ),
    })

    // Keymap provider exists only in a full TUI; CLI reconciliation must not fail.
    let disposeKeys: (() => void) | undefined
    try {
      disposeKeys = context.keymap.layer(() => ({
        mode: "global",
        commands: [
          {
            id: "session-time.timeline",
            title: "Time: session timeline",
            slash: { name: "time" },
            run: () => {
              context.ui.panel.open("session-time.timeline")
            },
          },
        ],
      }))
    } catch {
      // no Keymap.Provider outside the TUI — the command is simply not registered
    }

    return () => {
      clearInterval(timer)
      unlisten()
      disposeClock?.()
      disposeSide?.()
      disposePanel?.()
      disposeKeys?.()
    }
  },
})
