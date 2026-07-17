# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

**Pintra** (`pintra`) is a VS Code extension that embeds the [`pi` coding agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) as a chat sidebar. The extension host spawns an external `pi --mode rpc` child process and speaks its JSON-lines RPC protocol; a React webview renders the streaming conversation, thinking, and tool calls.

The `pi` runtime is **not bundled** — it is an external CLI the user must install and authenticate separately. The extension resolves the binary from `pintra.binaryPath` (default `pi`).

## Architecture

```
┌──────────────── VS Code ────────────────┐        ┌── pi --mode rpc (child) ──┐
│ Webview (React)  ⇄  Extension Host (Node)│  stdio │ JSON-lines over           │
│ chat / streaming    spawns + bridges     │  ⇄     │ stdin / stdout            │
└──────────────────────────────────────────┘        └───────────────────────────┘
```

Two independently-bundled targets:

- **Extension host** — CommonJS / Node, entry [`src/extension.ts`](src/extension.ts) → `dist/extension.js`. `vscode` is external (provided by the runtime).
- **Webview** — browser IIFE / React, entry [`webview/src/main.tsx`](webview/src/main.tsx) → `dist/webview.js`. No Node built-ins.

The two communicate only via `postMessage`. Both share a single source of truth for message shapes: [`shared/protocol.ts`](shared/protocol.ts).

### Key files

| Concern                                         | Location                                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Shared protocol types (RPC + Host↔Webview)      | [`shared/protocol.ts`](shared/protocol.ts)                                                   |
| Extension entry / activation                    | [`src/extension.ts`](src/extension.ts)                                                       |
| RPC framing + typed client                      | [`src/rpc/`](src/rpc/) (`jsonl.ts`, `rpc-client.ts`, `rpc-process.ts`)                       |
| Runtime bootstrap (binary resolution, env/PATH) | [`src/runtime/bootstrap.ts`](src/runtime/bootstrap.ts)                                       |
| Runtime lifecycle + crash recovery              | [`src/runtime/pi-runtime.ts`](src/runtime/pi-runtime.ts)                                     |
| Session/runtime pool                            | [`src/session/session-manager.ts`](src/session/session-manager.ts)                           |
| Sidebar webview provider                        | [`src/provider.ts`](src/provider.ts)                                                         |
| Editor-tab chat panels                          | [`src/editor/panel-manager.ts`](src/editor/panel-manager.ts)                                 |
| Host↔webview bridge                             | [`src/webview/chat-bridge.ts`](src/webview/chat-bridge.ts)                                   |
| Commands / config                               | [`src/commands.ts`](src/commands.ts), [`src/config.ts`](src/config.ts)                       |
| React app root + state                          | [`webview/src/App.tsx`](webview/src/App.tsx), [`webview/src/store.ts`](webview/src/store.ts) |
| React components                                | [`webview/src/components/`](webview/src/components/)                                         |

## Build & dev commands

The package manager is **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`; VS Code tasks call `pnpm`).

```sh
pnpm install
pnpm run build        # bundle host + webview once (node esbuild.mjs)
pnpm run watch        # rebuild on change (background)
pnpm run typecheck    # tsc --noEmit  — the only type-check gate
pnpm run package      # typecheck + production bundle + vsce package (.vsix)
pnpm run format       # prettier --write
```

- **Run/debug:** press **F5** ("Run Pintra Extension") to launch an Extension Development Host; the `pnpm: watch` task starts automatically. Open the **Pintra** view in the activity bar.
- **Bundling is esbuild only** ([`esbuild.mjs`](esbuild.mjs)). `tsc` is configured with `noEmit` and is used _purely_ for type-checking — do not expect it to produce output.
- `.scss` files are compiled by a custom sass plugin in `esbuild.mjs` and injected as CSS; load paths are rooted at `webview/src`.

### Verifying changes

There is no test suite. After any change, at minimum run `pnpm run typecheck`. For behavioral changes, launch the Extension Development Host (F5) and exercise the affected flow — most logic spans the host↔webview boundary and only surfaces at runtime.

## Conventions

- **TypeScript strict mode**, plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`. Keep code warning-clean.
- **Formatting (Prettier, [`.prettierrc`](.prettierrc)):** single quotes, semicolons, 2-space indent (`useTabs: false`), trailing commas everywhere, `bracketSameLine: true`. Run `pnpm run format` before finishing. (Some existing files are tab-indented — Prettier is the source of truth; don't hand-match stray tabs.)
- **Webview components** follow a per-folder pattern: `component-name/` containing `component-name.tsx`, `component-name.scss`, and `index.ts` (barrel export). File names are kebab-case; React component exports are PascalCase.
- **Webview state:** [`zustand`](webview/src/store.ts) (`store.ts`, plus focused stores under `webview/src/stores/`). Prefer the store over prop-drilling for cross-cutting chat state.
- **Never import `vscode` in webview code** — it is not available in the browser bundle. The webview talks to the host only through `postMessage` using the `WebviewMessage` / `HostMessage` unions in `shared/protocol.ts`.
- **Protocol changes are cross-cutting:** adding a message type or field means updating `shared/protocol.ts` first, then both the host handler ([`chat-bridge.ts`](src/webview/chat-bridge.ts)) and the webview consumer. RPC command/event names must mirror the pi runtime's rpc-mode contract.
- The RPC and streaming-event types are intentionally _loose/open_ (`{ type: string; [k: string]: unknown }`) — the runtime emits more than the UI renders, and unknown payloads are forwarded as-is. Don't tighten them into exhaustive unions.

## Configuration surface

Extension settings live under the `pintra.*` namespace (declared in [`package.json`](package.json) `contributes.configuration`): `binaryPath`, `agentDir`, `defaultModel`, `thinkingLevel`, `autoCompact`, `autoRetry`, `extraArgs`. Changing a **restart-affecting** setting triggers a runtime restart via `affectsRestart` in [`src/config.ts`](src/config.ts) — keep that list in sync when adding settings that alter how the child process is spawned.

## Gotchas

- The `pi` binary is external and may not be on VS Code's PATH. Bootstrap logic and version detection live in [`src/runtime/bootstrap.ts`](src/runtime/bootstrap.ts).
- The webview cannot access the microphone, filesystem, or Node APIs directly — everything goes through the host bridge.
- `dist/` is a build artifact (git-ignored) — never edit it by hand.
