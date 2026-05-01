<p align="center">
  <img src="./branding/app-icon.png" alt="Pseudocode Compiler app icon" width="96" height="96">
</p>

<h1 align="center">Pseudocode Compiler</h1>

Monorepo for a strict pseudocode toolchain and editor suite. The project includes:

- a shared compiler package that tokenizes, parses, validates, and transpiles pseudocode to Python
- a Next.js app that serves as the main browser UI and the desktop shell source for Electron
- an Expo React Native app for mobile and iPad layouts
- a shared workspace package for file trees, panel state, layout state, and persistence

## What It Does

- Compiles pseudocode into Python
- Produces syntax and semantic diagnostics with source locations
- Runs generated Python inside an in-browser / in-app Python runtime
- Persists a small multi-file workspace with folders, documents, and virtual files
- Ships a study manual page with worked examples and reference material

## Repository Layout

```text
.
├── apps
│   ├── mobile      # Expo / React Native mobile app
│   └── web         # Next.js app + Electron desktop packaging
├── packages
│   ├── compiler    # Shared compiler core
│   └── workspace   # Shared workspace model and persistence helpers
├── package.json    # Root workspace scripts
└── README.md
```

## Prerequisites

- Node.js 20+ recommended
- pnpm 10+ recommended

Optional, depending on what you want to run:

- Xcode / iOS Simulator for local iOS work
- `eas-cli` for Expo cloud builds

## Getting Started

Install dependencies from the repository root:

```bash
pnpm install
```

Start the main desktop development workflow:

```bash
pnpm dev
```

That launches:

- `next dev` for the web UI
- Electron pointed at the local Next.js server

If you only want the browser app:

```bash
pnpm dev:web
```

Open the web app at [http://localhost:3000](http://localhost:3000).

If you want the Electron shell without keeping the app attached to the launch terminal, start the web server first and then open the desktop window separately:

```bash
pnpm dev:web
pnpm open:desktop
```

## Root Commands

Run these from the repository root:

```bash
pnpm dev             # Web + Electron desktop shell
pnpm dev:web         # Next.js only
pnpm build           # Production web build
pnpm test            # All workspace tests that define test scripts
pnpm test:compiler   # Compiler tests only
pnpm test:web        # Web app tests only
pnpm typecheck       # Type-check all workspaces that support it
pnpm typecheck:mobile
pnpm lint
```

## App-Specific Commands

### Web / Desktop

```bash
pnpm --filter @igcse/web dev
pnpm --filter @igcse/web dev:web
pnpm --filter @igcse/web dev:electron
pnpm --filter @igcse/web build
pnpm --filter @igcse/web dist   # signed macOS DMG build
pnpm --filter @igcse/web dist:unsigned   # unsigned macOS DMG build
pnpm --filter @igcse/web pack   # unpacked Electron app
```

### macOS Packaging

- `pnpm --filter @igcse/web pack` is the local testing path. It creates an unpacked `.app` in `apps/web/dist/mac-arm64/`.
- `pnpm --filter @igcse/web dist` is for distribution. It now requires a `Developer ID Application` certificate in your macOS keychain.
- `pnpm --filter @igcse/web dist:unsigned` creates a DMG without Developer ID signing. Use this only for manual/local sharing where Gatekeeper warnings are acceptable.
- Without that certificate, Electron can only ad hoc sign the bundle. The app may still start from Terminal, but Finder and Gatekeeper will reject the packaged DMG.

### Mobile

```bash
pnpm --filter @igcse/mobile start
pnpm --filter @igcse/mobile ios
pnpm --filter @igcse/mobile ios:ipad26
pnpm --filter @igcse/mobile android
pnpm --filter @igcse/mobile web
pnpm --filter @igcse/mobile ios:preview
pnpm --filter @igcse/mobile ios:production
pnpm --filter @igcse/mobile ios:testflight
```

## Packages

### `@igcse/compiler`

The compiler package exposes the main compile entry point:

```ts
import { compilePseudocode } from "@igcse/compiler";

const result = compilePseudocode({
  source: `DECLARE Total : INTEGER
DECLARE Index : INTEGER

FOR Index <- 1 TO 3
    Total <- Total + Index
NEXT Index

OUTPUT Total`,
  filename: "main.pseudo",
  strict: true,
});
```

Successful results include generated Python. Failed results include diagnostics and the parsed AST JSON.

Core compiler stages live in:

- `packages/compiler/src/tokenizer.ts`
- `packages/compiler/src/parser.ts`
- `packages/compiler/src/semantics.ts`
- `packages/compiler/src/codegen.ts`

### `@igcse/workspace`

The workspace package contains the shared state model used by both apps:

- folders and pseudocode documents
- panel instances for editor / explorer / terminal / diagnostics / files
- split-layout state
- virtual file storage
- migration helpers for persisted workspace data

## Runtime Notes

- Program execution uses a Python runtime loaded in a worker on web and inside a WebView bridge on mobile.
- The first run may take longer because the Python runtime needs to initialize.
- Execution is guarded by a timeout so runaway programs do not hang the UI indefinitely.

## Manual

The web app includes a built-in manual at `/manual` with:

- exam command words
- loop patterns
- worked pseudocode examples
- copyable snippets

## Testing

Current test coverage in the repo includes:

- compiler unit tests for valid compilation and semantic/syntax failures
- workspace unit tests
- web app component and utility tests

Run everything:

```bash
pnpm test
```

## License

Released under the [GNU General Public License v3.0](./LICENSE).
