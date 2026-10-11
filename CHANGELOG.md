# Changelog

## 0.1.1 — 2026-10-11

- Fix: explicit `@jsxImportSource @opentui/solid` (pragma + tsconfig) — the plugin loader
  compiles published packages with the React JSX runtime by default, which broke loading.
## 0.1.0 — 2026-10-11

- Wall clock in the prompt footer (`prompt.footer.status`).
- Sidebar block `Session`: `DD.MM, HH:mm started` / `DD.MM, HH:mm last answer`
  (`sidebar.content`, updates on data events).
- `/time` command: timeline panel with every turn's start/end time, agent and model.
