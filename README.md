# IGCSE Pseudocode Compiler

Strict Cambridge-style pseudocode compiler and runtime in a JavaScript monorepo. The project validates exam-style pseudocode, transpiles it to Python, and executes it with Pyodide on the web and on mobile.

The repo currently ships:

- A web app built with Next.js
- A macOS desktop shell built with Electron
- A mobile app built with Expo / React Native
- A shared compiler package
- A shared workspace model and persistence package

## Monorepo layout

```text
apps/
  web/                   # Next.js app + Electron desktop packaging
  mobile/                # Expo / React Native app
packages/
  compiler/              # Shared tokenizer, parser, semantics, codegen
  workspace/             # Shared workspace state, layout, panels, persistence helpers
```

## Current product surface

### Shared compiler (`@igcse/compiler`)

- Tokenizes, parses, and semantically validates strict pseudocode
- Emits structured diagnostics with codes such as `SYNxxx`, `SEMxxx`, and `RUNxxx`
- Generates Python for successful programs
- Is consumed by both the web app and the mobile app

### Shared workspace model (`@igcse/workspace`)

- Models folders, documents, active tabs, compile summaries, terminal/files panels, and layout state
- Supports folder and document creation, rename, delete, move, and reorder
- Stores virtual files used by `OPENFILE`, `READFILE`, `WRITEFILE`, and `CLOSEFILE`
- Handles persisted workspace migration between schema versions

### Web app (`@igcse/web`)

The current web UI is a workspace shell rather than the older single-file editor:

- Explorer sidebar with folders and multiple pseudocode documents
- Monaco-based pseudocode editor
- Breadcrumbs, terminal output, inline runtime `INPUT` prompts, and save/error notices
- Rename, delete, move, and drag/drop interactions in the explorer
- A built-in `/manual` reference page for Cambridge 0478 pseudocode guidance
- Touch-first layouts for iPad-style and phone-style browser sessions

Persistence on the web uses IndexedDB (`igcse-pseudocode-workspace`) with migration from older localStorage keys.

### Desktop shell

- Electron wraps the web app for local desktop use
- Production desktop builds package the statically exported web app
- Current packaging is configured for macOS DMG output

### Mobile app (`@igcse/mobile`)

The mobile app is an Expo / React Native shell with:

- A WebView-based Monaco editor using `apps/mobile/assets/editor.html`
- A WebView-based Pyodide runner using `apps/mobile/assets/pyodide-runner.html`
- Workspace tree, output panel, and manual screen
- AsyncStorage-backed persistence
- A seeded starter workspace on first launch with `layout.pseudo`, `page.pseudo`, and starter folders such as `src/app`

The Expo app is configured for iPhone and iPad, and includes EAS profiles for preview and production iOS builds.

## Compile and run flow

`compilePseudocode()` performs the shared compiler pipeline:

1. Tokenization
2. Parsing into an AST
3. Semantic analysis
4. Diagnostic merge/sort
5. Python code generation when there are no error diagnostics

Runtime execution differs by platform:

- Web: generated Python runs inside `apps/web/src/workers/pythonRunner.worker.ts`
- Mobile: generated Python runs inside the hidden Pyodide WebView runner

Current runtime behavior:

- `Run` recompiles the active document before execution
- `INPUT` is handled interactively from the terminal UI
- Virtual files are passed into the runtime and returned after execution
- Execution uses a `12s` default timeout and a longer first-run initialization timeout
- Worker/WebView failures are surfaced as runtime diagnostics instead of crashing the UI

## Supported pseudocode surface

The compiler currently supports:

- Declarations and constants: `DECLARE`, `CONSTANT`
- Assignment and IO: `<-` or `←`, `INPUT`, `OUTPUT`
- Selection: `IF/THEN/ELSE/ENDIF`, `CASE/OF/OTHERWISE/ENDCASE`
- Iteration: `FOR/TO/STEP/NEXT`, `WHILE/DO/ENDWHILE`, `REPEAT/UNTIL`
- Routines: `PROCEDURE/ENDPROCEDURE`, `FUNCTION/RETURNS/ENDFUNCTION`, `CALL`, `RETURN`
- File operations: `OPENFILE`, `READFILE`, `WRITEFILE`, `CLOSEFILE`
- Arrays with declared bounds, including 2D arrays
- Built-ins: `DIV`, `MOD`, `LENGTH`, `LCASE`, `UCASE`, `SUBSTRING`, `ROUND`, `RANDOM`
- Boolean operators and literals: `AND`, `OR`, `NOT`, `TRUE`, `FALSE`
- Line comments starting with `//`

Strict mode behavior:

- Keywords are expected in uppercase
- Compiler diagnostics are line/column aware
- The editors auto-correct keyword casing outside strings/comments and convert `<-` to `←`

## Tech stack

- TypeScript
- npm workspaces
- Next.js App Router
- React 19
- Tailwind CSS 4
- Monaco Editor
- Electron
- Expo / React Native
- Pyodide
- Vitest

## Getting started

Prerequisites:

- Node.js 20 or newer
- npm

Install dependencies from the repo root:

```bash
npm install
```

## Running the apps

### Web only

From the repo root:

```bash
npm run dev:web
```

### Web + Electron desktop shell

From the repo root:

```bash
npm run dev
```

This starts the Next.js dev server and then launches Electron against `http://localhost:3000`.

### Production web build

From the repo root:

```bash
npm run build
```

### Desktop packaging

From `apps/web`:

```bash
npm run dist   # macOS DMG
npm run pack   # unpacked Electron app
```

### Mobile development

From the repo root:

```bash
npm run --workspace=@igcse/mobile start
npm run --workspace=@igcse/mobile ios
npm run --workspace=@igcse/mobile android
npm run --workspace=@igcse/mobile web
```

Root-level convenience scripts currently exposed for mobile are:

```bash
npm run ios:ipad26
npm run ios:preview
npm run ios:production
npm run ios:testflight
```

Mobile prerequisites:

- macOS + Xcode for iOS/iPadOS simulator work
- Android Studio for Android emulator work
- Expo / EAS account for preview or production iOS builds

## Root scripts

From the repo root:

```bash
npm run dev
npm run dev:web
npm run build
npm run test
npm run test:compiler
npm run test:web
npm run typecheck
npm run typecheck:mobile
npm run lint
npm run ios:ipad26
npm run ios:preview
npm run ios:production
npm run ios:testflight
```

Notes:

- `npm run build` builds the web workspace
- `npm run lint` runs only in workspaces that define a lint script
- `npm run test` and `npm run typecheck` fan out across workspaces with matching scripts

## Testing

Current automated coverage in the repo includes:

- Compiler tests in `packages/compiler/src/compiler.test.ts`
- Workspace model tests in `packages/workspace/src/index.test.ts`
- Web app tests for the sidebar, editor autocorrect, storage helpers, Apple touch detection, and the main page

Run everything with:

```bash
npm run test
```

## Deployment

### Web deployment

The repo contains GitHub Actions workflows for Vercel:

- `.github/workflows/vercel-preview.yml`
- `.github/workflows/vercel-production.yml`

Both workflows currently run:

- `npm run lint`
- `npm run test`
- `npm run build`

Required Vercel secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Mobile iOS / iPadOS release flow

The mobile app is configured with EAS build profiles in `apps/mobile/eas.json`:

- `preview` for internal simulator builds
- `production` for App Store / TestFlight builds

Useful commands:

```bash
npm run ios:preview
npm run ios:production
npm run ios:testflight
```

Current Expo / iOS config includes:

- Bundle identifier: `com.alex.igcsepseudocodecompiler`
- Tablet support enabled
- `ITSAppUsesNonExemptEncryption: false`

## Persistence notes

- Web storage: IndexedDB, with migration from older localStorage snapshots
- Mobile storage: AsyncStorage
- Shared workspace schema version: `2`
- Mobile storage key: `igcse-workspace-v3`

## Scope notes

- The shared workspace package already supports panel layout metadata, terminal/files panels, and virtual files
- The current web UI primarily surfaces the explorer, editor, manual, and terminal workflow
- The desktop app is an Electron wrapper around the web workspace, not a separate codebase
