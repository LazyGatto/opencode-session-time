/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createMemo, createSignal, onMount } from "solid-js"
import { TextAttributes, t, fg, bold } from "@opentui/core"

// opencode-session-time: timestamps for your OpenCode sessions.
//
//  - prompt.footer.status — elapsed time for the current turn near the prompt;
//  - sidebar.content      — a "Session Timings" block (started / input / thought / reply);
//  - /time                  — palette-style timeline popup (dialog.select).
//
// Note: the OpenCode plugin API has no slot for the per-message footer, so
// inline timestamps under each message are not possible yet (upstream feature
// request: a `message.footer` slot).

const pad = (n: number) => String(n).padStart(2, "0")

const stopwatch = (ms?: number) => {
  if (ms === undefined || ms < 0) return "—"
  const total = Math.floor(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

const fmt = (ms?: number) => {
  if (!ms) return "—"
  const d = new Date(ms)
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  if (d.toDateString() === new Date().toDateString()) return time
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}, ${time}`
}

const dur = (start?: number, end?: number) => {
  if (!start || !end || end < start) return undefined
  const ms = end - start
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  if (minutes < 60) return `${minutes}m${pad(seconds)}s`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h${pad(minutes % 60)}m`
  return `${Math.floor(hours / 24)}d${pad(hours % 24)}h`
}

const durMs = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  if (minutes < 60) return `${minutes}m${pad(seconds)}s`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h${pad(minutes % 60)}m`
  return `${Math.floor(hours / 24)}d${pad(hours % 24)}h`
}

const preview = (message: any): string => {
  const content = message.content
  let text = ""
  if (typeof content === "string") text = content
  else if (Array.isArray(content))
    text = content
      .map((part: any) => (typeof part === "string" ? part : part?.type === "text" ? (part.text ?? "") : ""))
      .join(" ")
  text = text.replace(/\s+/g, " ").trim()
  return text.length > 110 ? `${text.slice(0, 110)}…` : text
}

const messages = (context: any, sessionID: string): any[] =>
  (context.data.session.message.list(sessionID) ?? []) as any[]

const activity = (message: any) => {
  let last = message.time?.created ?? 0
  last = Math.max(last, message.time?.streamed ?? 0, message.time?.completed ?? 0)
  for (const part of message.content ?? []) {
    if (!part.time) continue
    last = Math.max(
      last,
      part.time.created ?? 0,
      part.time.ran ?? 0,
      part.time.completed ?? 0,
    )
  }
  return last
}

const currentTurn = (list: any[], fallbackUser?: number) => {
  let lastAssistant = -1
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].type === "assistant" && list[i].time?.created) {
      lastAssistant = i
      break
    }
  }

  let lastUser = -1
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].type === "user") {
      lastUser = i
      break
    }
  }

  if (lastAssistant < 0) {
    return lastUser >= 0 || fallbackUser ? { waiting: true } : undefined
  }

  // A new user message without an assistant response yet means the next turn
  // has not started. Do not keep showing the previous turn's elapsed time.
  if (lastUser > lastAssistant) return { waiting: true }

  let user = -1
  for (let i = lastAssistant - 1; i >= 0; i--) {
    if (list[i].type === "user") {
      user = i
      break
    }
  }

  if (user < 0) {
    if (!fallbackUser) return undefined
    let lastActivity = 0
    for (const message of list) {
      if (message.type !== "assistant") continue
      lastActivity = Math.max(lastActivity, activity(message))
    }
    if (lastActivity < fallbackUser) return { waiting: true }
    return {
      start: fallbackUser,
      last: lastActivity,
      completed: list[lastAssistant].time?.completed !== undefined,
    }
  }

  const turn = list
    .slice(user + 1, lastAssistant + 1)
    .filter((message) => message.type === "assistant" && message.time?.created)
  if (turn.length === 0) return undefined

  const first = turn[0]
  const last = turn[turn.length - 1]
  let lastActivity = first.time.created as number
  for (const message of turn) {
    lastActivity = Math.max(lastActivity, activity(message))
  }

  return {
    start: first.time.created as number,
    last: lastActivity,
    completed: last.time?.completed !== undefined,
  }
}

const lastUser = (list: any[]) => {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].type === "user") return list[i]
  }
}

const thoughtStats = (list: any[]) => {
  // reasoning phases since the last user input (all assistant steps of the turn)
  let userIdx = -1
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].type === "user") { userIdx = i; break }
  }
  let count = 0
  let totalMs = 0
  let last: any
  for (let i = list.length - 1; i > userIdx; i--) {
    const message = list[i]
    if (message.type !== "assistant" || !Array.isArray(message.content)) continue
    for (const part of message.content) {
      if (part.type !== "reasoning" || !part.time?.created) continue
      count++
      if (!last) last = part
      const end = part.time.completed
      if (end && end >= part.time.created) totalMs += end - part.time.created
    }
  }
  return { last, count, totalMs }
}

const lastReply = (list: any[]) => {
  for (let i = list.length - 1; i >= 0; i--) {
    const message = list[i]
    if (message.type !== "assistant" || !message.time?.completed) continue
    if (message.content?.some((part: any) => part.type === "text" && part.text?.trim())) return message
  }
}

const BUILTIN_TOOLS = new Set([
  "shell", "read", "write", "edit", "glob", "grep", "webfetch", "websearch",
  "task", "subagent", "skill", "todo", "todowrite", "todoread", "question",
  "execute", "ls", "patch", "apply_patch", "codesearch",
])

const turnTools = (list: any[]) => {
  let userIdx = -1
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].type === "user") { userIdx = i; break }
  }
  const counts: Record<string, number> = {}
  let total = 0
  let mcp = 0
  for (let i = list.length - 1; i > userIdx; i--) {
    const message = list[i]
    if (message.type !== "assistant" || !Array.isArray(message.content)) continue
    for (const part of message.content) {
      if (part.type !== "tool") continue
      total++
      const name = part.name ?? "?"
      counts[name] = (counts[name] ?? 0) + 1
      if (!BUILTIN_TOOLS.has(name)) mcp++
    }
  }
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, n]) => `${name} ${n}`)
    .join(" · ")
  return { total, mcp, top }
}

type SessionCounts = {
  user: number
  steps: number
  mcp: number
  tools: Record<string, number>
  capped: boolean
  at: number
}

type Anchor = {
  user?: number
  thought?: number
  thoughtDuration?: string
  thoughtCount?: number
  counts?: SessionCounts
  reply?: number
  replyDuration?: string
  updated?: number
}

type AnchorStore = Record<string, Anchor>

