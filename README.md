# IGCSE Pseudocode Compiler

Monorepo for an IGCSE-style pseudocode toolchain and editor suite. The project includes:

- a shared compiler package that tokenizes, parses, validates, and transpiles pseudocode to Python
- a Next.js app that serves as the main browser UI and the desktop shell source for Electron
- an Expo React Native app for mobile and iPad layouts
- a shared workspace package for file trees, panel state, layout state, and persistence

## What It Does

- Compiles IGCSE pseudocode into Python
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
- npm 10+ recommended

Optional, depending on what you want to run:

- Xcode / iOS Simulator for local iOS work
- `eas-cli` for Expo cloud builds

## Getting Started

Install dependencies from the repository root:

```bash
npm install
```

Start the main desktop development workflow:

```bash
npm run dev
```

That launches:

- `next dev` for the web UI
- Electron pointed at the local Next.js server

If you only want the browser app:

```bash
npm run dev:web
```

Open the web app at [http://localhost:3000](http://localhost:3000).

## Root Commands

Run these from the repository root:

```bash
npm run dev             # Web + Electron desktop shell
npm run dev:web         # Next.js only
npm run build           # Production web build
npm run test           # All workspace tests that define test scripts
npm run test:compiler   # Compiler tests only
npm run test:web        # Web app tests only
npm run typecheck       # Type-check all workspaces that support it
npm run typecheck:mobile
npm run lint
```

## App-Specific Commands

### Web / Desktop

```bash
npm run dev --workspace=@igcse/web
npm run dev:web --workspace=@igcse/web
npm run dev:electron --workspace=@igcse/web
npm run build --workspace=@igcse/web
npm run dist --workspace=@igcse/web   # signed macOS DMG build
npm run dist:unsigned --workspace=@igcse/web   # unsigned macOS DMG build
npm run pack --workspace=@igcse/web   # unpacked Electron app
```

### macOS Packaging

- `npm run pack --workspace=@igcse/web` is the local testing path. It creates an unpacked `.app` in `apps/web/dist/mac-arm64/`.
- `npm run dist --workspace=@igcse/web` is for distribution. It now requires a `Developer ID Application` certificate in your macOS keychain.
- `npm run dist:unsigned --workspace=@igcse/web` creates a DMG without Developer ID signing. Use this only for manual/local sharing where Gatekeeper warnings are acceptable.
- Without that certificate, Electron can only ad hoc sign the bundle. The app may still start from Terminal, but Finder and Gatekeeper will reject the packaged DMG.

### Mobile

```bash
npm run start --workspace=@igcse/mobile
npm run ios --workspace=@igcse/mobile
npm run ios:ipad26 --workspace=@igcse/mobile
npm run android --workspace=@igcse/mobile
npm run web --workspace=@igcse/mobile
npm run ios:preview --workspace=@igcse/mobile
npm run ios:production --workspace=@igcse/mobile
npm run ios:testflight --workspace=@igcse/mobile
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
npm run test
```

## License

Released under the [MIT License](./LICENSE).
