# Pseudocode Compiler

Monorepo for the Pseudocode Compiler toolchain and editor suite.

The project currently ships in three user-facing versions:

- a browser-based web app built with Next.js
- a local desktop application built with Electron
- a local iOS and iPadOS app built with Expo / React Native

The monorepo also includes:

- a shared compiler package that tokenizes, parses, validates, and transpiles pseudocode to Python
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
│   ├── mobile      # Local iOS and iPadOS app (Expo / React Native)
│   └── web         # Browser app (Next.js) + Electron desktop packaging
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

Run the local desktop application:

```bash
npm run dev
```

That launches:

- the local web renderer in local persistence mode
- Electron pointed at the local Next.js server

If you only want the browser version:

```bash
npm run dev:web
```

Open the browser app at [http://localhost:3000](http://localhost:3000).

If you want the local iOS / iPadOS version:

```bash
npm run ios --workspace=@pseudocode-compiler/mobile
```

## Root Commands

Run these from the repository root:

```bash
npm run dev             # Web + Electron desktop shell
npm run dev:web         # Next.js only
npm run build           # Production web build
npm run test            # All workspace tests that define test scripts
npm run test:compiler   # Compiler tests only
npm run test:web        # Web app tests only
npm run typecheck       # Type-check all workspaces that support it
npm run typecheck:mobile
npm run lint
```

## Product Versions

The project has three end-user versions:

- Browser web app: hosted, account-based, and cloud-backed with WorkOS AuthKit plus Convex.
- Local desktop application: Electron-based and saved locally on the machine with no account required.
- Local iOS and iPadOS app: Expo / React Native based and saved locally on-device with no account required.

## App-Specific Commands

### Browser Web App

```bash
npm run dev:web --workspace=@pseudocode-compiler/web
npm run build --workspace=@pseudocode-compiler/web
npm run start --workspace=@pseudocode-compiler/web
```

### Local Desktop Application

```bash
npm run dev --workspace=@pseudocode-compiler/web
npm run dev:web:local --workspace=@pseudocode-compiler/web
npm run dev:electron --workspace=@pseudocode-compiler/web
npm run dist --workspace=@pseudocode-compiler/web   # signed macOS DMG build
npm run dist:unsigned --workspace=@pseudocode-compiler/web   # unsigned macOS DMG build
npm run pack --workspace=@pseudocode-compiler/web   # unpacked Electron app
```

### Local iOS and iPadOS App

```bash
npm run start --workspace=@pseudocode-compiler/mobile
npm run ios --workspace=@pseudocode-compiler/mobile
npm run ios:ipad26 --workspace=@pseudocode-compiler/mobile
npm run ios:preview --workspace=@pseudocode-compiler/mobile
npm run ios:production --workspace=@pseudocode-compiler/mobile
npm run ios:testflight --workspace=@pseudocode-compiler/mobile
```

### Web Authentication

The deployed web app uses WorkOS AuthKit for sign-in and Convex for cloud-backed workspace storage.

Current production URL:

- `https://apps.lumorastudio.top`

Required environment variables for `apps/web`:

```bash
WORKOS_API_KEY=sk_example_123
WORKOS_CLIENT_ID=client_123
WORKOS_COOKIE_PASSWORD=replace-with-a-random-32-plus-character-secret
NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://apps.lumorastudio.top/callback
NEXT_PUBLIC_CONVEX_URL=https://different-deer-512.convex.cloud
WORKOS_AUDIT_ORGANIZATION_ID=org_123
```

Production/staging redirect settings for the current deployment:

- Redirect URI: `https://apps.lumorastudio.top/callback`
- Sign-in endpoint: `https://apps.lumorastudio.top/login`
- Sign-out redirect: `https://apps.lumorastudio.top/`

Important:

- These values must be added in the same WorkOS environment as the API key in use.
- For `sk_test_...` keys, the redirect must be added to the matching sandbox/staging environment in the WorkOS dashboard.
- If WorkOS does not list the exact callback URL above, sign-in will fail with `This is not a valid redirect URI`.
- Preview deployment URLs are not used as the callback target in production. When `NEXT_PUBLIC_WORKOS_REDIRECT_URI` is not set, the web app now falls back to Vercel's canonical production domain (`VERCEL_PROJECT_PRODUCTION_URL`) instead of a preview hostname.
- `WORKOS_AUDIT_ORGANIZATION_ID` is the browser app fallback for WorkOS Audit Logs when the signed-in access token does not already contain an `org_id` claim.
- Configure these WorkOS Audit Log event schemas in the dashboard before testing browser audit events:
  - `workspace.created` with target type `workspace`
  - `workspace.saved` with target type `workspace`
  - `workspace.settings_updated` with target type `workspace`

Behavior:

- Signed-in users get a cloud-synced workspace in Convex, scoped to their authenticated WorkOS identity.
- Logged-out users run in a guest session only. Their workspace stays in memory and is cleared on reload or restart.
- Clicking `Sign in to save workspace` opens a modal that lets the user either sign in or create an account before enabling persistence.
- The toolbar and workspace settings both show explicit signed-in state. When cloud auth is active, the save control unlocks and files/folders persist to PseudocodeCompiler Cloud.
- The browser version now emits WorkOS Audit Log events when it provisions a cloud workspace, when the user manually saves browser workspace changes, and when autosave settings change in the cloud-backed session.

### Local Apps

- The Electron desktop build runs in `local` persistence mode and never requires WorkOS or Convex to save files and folders.
- The iOS and iPadOS app also save locally on-device and do not depend on internet access.
- Local desktop and iOS/iPadOS users should always be able to save immediately without creating an account.

Local development:

- `http://localhost:3000/callback` is valid only for local sandbox development.
- If you want local auth instead of the deployed callback, override `NEXT_PUBLIC_WORKOS_REDIRECT_URI` in `apps/web/.env.local` and add the matching localhost callback in the WorkOS sandbox environment.
- For local desktop-shell development, `npm run dev --workspace=@pseudocode-compiler/web` starts the app in local persistence mode. Use `npm run dev:web --workspace=@pseudocode-compiler/web` to test the cloud-backed web flow.

### macOS Packaging

- `npm run pack --workspace=@pseudocode-compiler/web` is the local testing path. It creates an unpacked `.app` in `apps/web/dist/mac-arm64/`.
- `npm run dist --workspace=@pseudocode-compiler/web` is for distribution. It now requires a `Developer ID Application` certificate in your macOS keychain.
- `npm run dist:unsigned --workspace=@pseudocode-compiler/web` creates a DMG without Developer ID signing. Use this only for manual/local sharing where Gatekeeper warnings are acceptable.
- Without that certificate, Electron can only ad hoc sign the bundle. The app may still start from Terminal, but Finder and Gatekeeper will reject the packaged DMG.

## Packages

### `@pseudocode-compiler/compiler`

The compiler package exposes the main compile entry point:

```ts
import { compilePseudocode } from "@pseudocode-compiler/compiler";

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

### `@pseudocode-compiler/workspace`

The workspace package contains the shared state model used by all three versions:

- folders and pseudocode documents
- panel instances for editor / explorer / terminal / diagnostics / files
- split-layout state
- virtual file storage
- migration helpers for persisted workspace data

## Runtime Notes

- Program execution uses a Python runtime loaded in a worker on web and inside a WebView bridge on the local iOS/iPadOS app.
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
