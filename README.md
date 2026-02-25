# IGCSE Pseudocode Compiler

Strict Cambridge-style pseudocode compiler + runtime with a web UI (Next.js) and desktop packaging (Electron).

This project takes IGCSE-like pseudocode, validates it, transpiles it to Python, and executes it in-browser through Pyodide running inside a Web Worker.

## What this app does

- Edits pseudocode in a Monaco-based editor with custom language support.
- Enforces strict keyword casing and statement forms expected in IGCSE-style pseudocode.
- Produces syntax + semantic diagnostics with exact line/column spans.
- Transpiles accepted pseudocode programs into Python code.
- Runs transpiled Python in a sandboxed browser worker, captures stdout/stderr, and surfaces runtime diagnostics.
- Ships both as:
1. A web app (`next dev` / `next build`)
2. A macOS desktop app (`electron-builder` DMG output)

## Detailed application behavior

### Main screen (`/`)

The home page is a two-pane workspace:

- Left: Monaco pseudocode editor.
- Right: terminal output panel.
- Toolbar actions: `Open Manual`, `Compile`, `Run`, `Clear Terminal`.

Current persistence behavior:

- Source code is saved to `localStorage` under `igcse-editor-source-v2`.
- On reload, source is restored from local storage (or a default sample program).

### Manual screen (`/manual`)

The manual page is an in-app study/reference guide with:

- Command word glossary.
- Loop and algorithm patterns.
- Worked pseudocode examples.
- Notes aligned to Cambridge IGCSE 0478 (2026-2028 context in content).

### Compile flow

`compilePseudocode()` performs:

1. Tokenization (`src/compiler/tokenizer.ts`)
2. Parsing to AST (`src/compiler/parser.ts`)
3. Semantic analysis (`src/compiler/semantics.ts`)
4. Diagnostic merge/sort by position
5. Python code generation if no `error` diagnostics (`src/compiler/codegen.ts`)

Compile result includes:

- `success`
- `diagnostics[]`
- `astJson`
- `pythonCode` (when successful)

### Run flow

`Run` on the home page:

1. Re-runs compile.
2. Sends generated Python to `pythonRunner`.
3. Uses a dedicated Web Worker (`src/workers/pythonRunner.worker.ts`) with Pyodide `v0.27.2`.
4. Collects `stdout`, `stderr`, runtime diagnostics, and updated virtual file state.
5. Enforces timeout (default `12s`) and resets worker on timeout/crash.

## Supported pseudocode language surface

Implemented statement categories include:

- Declarations and constants: `DECLARE`, `CONSTANT`
- Assignment and IO: `<-` or `←`, `INPUT`, `OUTPUT`
- Selection: `IF/THEN/ELSE/ENDIF`, `CASE/OF/OTHERWISE/ENDCASE`
- Iteration: `FOR/TO/STEP/NEXT`, `WHILE/DO/ENDWHILE`, `REPEAT/UNTIL`
- Routines: `PROCEDURE/ENDPROCEDURE`, `FUNCTION/RETURNS/ENDFUNCTION`, `CALL`, `RETURN`
- File operations: `OPENFILE`, `READFILE`, `WRITEFILE`, `CLOSEFILE`
- Arrays: declared bounds with 1D or 2D index dimensions
- Built-ins: `DIV`, `MOD`, `LENGTH`, `LCASE`, `UCASE`, `SUBSTRING`, `ROUND`, `RANDOM`
- Boolean operators and literals: `AND`, `OR`, `NOT`, `TRUE`, `FALSE`

Strictness behavior:

- Keywords must be uppercase in strict mode.
- Diagnostics use structured codes (`SYNxxx`, `SEMxxx`, `RUNxxx`).

## Monaco editor integration

The custom editor component (`src/app/components/MonacoPseudocodeEditor.tsx`) adds:

- Custom language tokenization and theming.
- Keyword autocomplete and quick snippets.
- Auto-correction of keyword casing outside string/comment literals.
- Auto-conversion of `<-` to `←`.
- Quote-pair handling and marker updates from compiler diagnostics.

## Runtime model (Python side)

Generated Python includes a prelude that emulates pseudocode behaviors:

- `__PseudoArray` class with declared bound checks.
- `__input()` / `__output()` runtime helpers.
- Emulated file API over in-memory virtual files (`__vfs`).
- Utility built-ins mapped to pseudocode built-ins.
- Inclusive range helper for `FOR ... TO ... STEP ...`.

Execution happens in a worker to keep the UI responsive and isolate crashes/timeouts.

## Tech stack

Core app:

- Next.js `16.1.6` (App Router)
- React `19.2.3`
- TypeScript `5`
- Tailwind CSS `4` (global styles + utility support)
- Monaco Editor (`@monaco-editor/react` + `monaco-editor`)

Compiler/runtime:

- Custom tokenizer/parser/semantic analyzer/code generator in TypeScript
- Pyodide (loaded from CDN in worker) for Python execution

Desktop packaging:

- Electron `37`
- electron-builder `26` (macOS DMG target)
- `serve-handler` for serving static export in packaged app

Quality/tooling:

- ESLint `9` + `eslint-config-next`
- Vitest `4` + Testing Library + jsdom
- `tsc --noEmit` for type checks
- `concurrently`, `wait-on`, `cross-env` for dev/build orchestration

## How this is built

### Development mode

`npm run dev` starts both:

1. Next.js dev server (`npm run dev:web`)
2. Electron pointed at `http://localhost:3000` (`npm run dev:electron`)

So local development behaves like the desktop app while still using hot-reload web tooling.

### Production web build

`npm run build` performs a standard Next.js production build.

### Electron build path

`npm run build:electron-web` sets `BUILD_TARGET=electron`, making Next config export static output (`out/`).

Packaged Electron app then:

- Starts a local internal HTTP server for `out/`
- Loads that URL in `BrowserWindow`
- Produces DMG artifact via `npm run dist`

## Project structure

```text
src/
  app/
    page.tsx                   # Main editor + terminal UI
    manual/page.tsx            # In-app learning manual
    components/
      MonacoPseudocodeEditor.tsx
      pseudocodeAutocorrect.ts
      DiagnosticsPanel.tsx
      VirtualFilesPanel.tsx
  compiler/
    tokenizer.ts
    parser.ts
    semantics.ts
    codegen.ts
    index.ts                   # compilePseudocode entrypoint
    types.ts
  runtime/
    executePython.ts           # Worker manager + timeout handling
  workers/
    pythonRunner.worker.ts     # Pyodide execution environment
electron/
  main.cjs
  preload.cjs
scripts/
  deploy.sh
.github/workflows/
  vercel-preview.yml
  vercel-production.yml
```

## Setup

Prerequisites:

- Node.js 20+ recommended
- npm
- macOS required for DMG packaging

Install:

```bash
npm install
```

Run in dev (web + Electron):

```bash
npm run dev
```

Run web only:

```bash
npm run dev:web
```

## Scripts

```bash
npm run dev                # Web + Electron (local desktop workflow)
npm run dev:web            # Next.js dev server only
npm run dev:electron       # Electron against local web server
npm run lint               # ESLint
npm run typecheck          # TypeScript checks
npm run test               # Vitest
npm run test:watch         # Vitest watch mode
npm run build              # Next.js production build
npm run build:electron-web # Static export for Electron
npm run pack               # Electron unpacked build
npm run dist               # Electron DMG build
```

## Testing

Current automated tests cover:

- Compiler happy path and selected failure paths (`src/compiler/compiler.test.ts`)
- Pseudocode keyword auto-correction behavior (`src/app/components/pseudocodeAutocorrect.test.ts`)

Run all tests:

```bash
npm run test
```

## Deployment

### Scripted preview deploy

This repository includes a deployment helper:

```bash
bash scripts/deploy.sh
```

It packages and deploys via the claimable-preview endpoint.

### GitHub Actions

- Preview deploys: `.github/workflows/vercel-preview.yml`
  Trigger: non-`main` pushes + pull requests
- Production deploys: `.github/workflows/vercel-production.yml`
  Trigger: pushes to `main`

Both workflows run:

- `npm run lint`
- `npm run test`
- `npm run build`

Required secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Notes on current scope

- The runtime supports stdin lines and virtual file maps internally.
- The current home page UI wires runtime execution with empty stdin and empty virtual files by default.
- Additional UI components (`VirtualFilesPanel`, `DiagnosticsPanel`, storage helpers for workspace state) exist in the repo and can be integrated/expanded further.
