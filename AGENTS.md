# AGENTS.md

Guidance for coding agents working in this repository.

## Project Shape

This is a pnpm monorepo for Pseudocode Compiler.

- `apps/mobile`: Expo / React Native app for iOS and iPadOS.
- `apps/web`: Next.js App Router web app, also used as the Electron desktop shell source.
- `packages/compiler`: shared pseudocode compiler.
- `packages/workspace`: shared workspace state model and persistence helpers.
- `convex`: Convex schema and functions used by the deployed browser version.

## Product Variants

Keep the runtime split intact:

- Native iOS / iPadOS app: local app persistence, no Clerk, no Convex cloud sync.
- Desktop app: Electron package built from `apps/web` with `BUILD_TARGET=electron`; local persistence, no auth requirement.
- Local browser app on `localhost`, `127.0.0.1`, or `::1`: browser local persistence, no auth requirement.
- Deployed browser app on Vercel: Clerk authentication is required to save workspaces to Convex.

Do not make deployed browser saves silently fall back to local storage. Signed-out deployed-browser users may edit in memory, but saving must require sign-in.

The desktop app and browser app share Next.js UI code but are different runtime products:

- Desktop app means installed Electron app. It must not show Clerk sign-in UI or depend on Convex.
- Browser app means the website opened in a browser. Local browser development saves locally; deployed browser previews/production use Clerk and Convex.

When modifying auth or persistence, check `apps/web/src/lib/platform.ts` and preserve this split.

## Authentication Rules

The deployed browser version uses Clerk. Do not reintroduce WorkOS.

Required patterns:

- Use `@clerk/nextjs` for client components and provider wrappers.
- Use `@clerk/nextjs/server` for server auth.
- Use `clerkMiddleware()` in `apps/web/src/proxy.ts`.
- Use `await auth()` in App Router route handlers.
- Use `<Show when="signed-out">`, `<Show when="signed-in">`, `<SignInButton>`, `<SignUpButton>`, and `<UserButton>` for auth UI.
- Keep `<ClerkProvider>` inside `<body>` in `apps/web/src/app/layout.tsx`, currently through `apps/web/src/lib/auth-components.tsx`.

Forbidden patterns:

- Do not use `authMiddleware()`.
- Do not use `withAuth`, old `currentUser`, `<SignedIn>`, or `<SignedOut>`.
- Do not add Pages Router auth files such as `_app.tsx` or `pages/signin`.
- Do not add `/login`, `/logout`, or `/callback` WorkOS routes.

## Environment Variables

Vercel browser cloud sync needs:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CONVEX_URL` or `CONVEX_URL`
- `WORKSPACE_SYNC_SECRET`

Never commit real secrets to tracked files. If a secret appears in chat or logs, treat it as exposed and rotate it.

`apps/web/.env.local` is for local testing only. Vercel Preview and Production environments must be configured separately with `vercel env`.

## Convex Data Model

Cloud workspace ownership is keyed by Clerk user IDs.

- Use `clerkUserId`, not `workosUserId`.
- Keep Convex server access protected by `WORKSPACE_SYNC_SECRET`.
- Browser route handlers should return `401` for unsigned users and avoid throwing raw config errors to users.

Existing WorkOS-keyed cloud data will not automatically map to Clerk users. If migration is required, implement it explicitly.

## Common Commands

Run from the repository root unless noted otherwise.

```bash
pnpm install
pnpm dev
pnpm dev:web
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

Web-specific verification:

```bash
pnpm --filter @igcse/web typecheck
pnpm --filter @igcse/web test
pnpm --filter @igcse/web build
pnpm --filter @igcse/web lint
```

Electron desktop packaging:

```bash
pnpm --filter @igcse/web pack
pnpm --filter @igcse/web dist:unsigned
pnpm --filter @igcse/web dist
```

Mobile:

```bash
pnpm --filter @igcse/mobile start
pnpm --filter @igcse/mobile ios
pnpm --filter @igcse/mobile ios:ipad26
pnpm --filter @igcse/mobile ios:preview
pnpm --filter @igcse/mobile ios:production
pnpm --filter @igcse/mobile ios:testflight
```

## Deployment Notes

The root `vercel.json` deploys `apps/web`.

Use:

```bash
vercel deploy --yes --force
```

After changing Vercel env vars, redeploy. Environment changes do not fix already-built previews.

## Development Notes

- Prefer existing workspace helpers from `packages/workspace` over duplicating workspace state logic.
- Keep compiler behavior in `packages/compiler`; UI code should not parse pseudocode ad hoc.
- Use `rg` for searches.
- Avoid unrelated refactors in shared compiler/workspace packages unless required by the task.
- Keep tests scoped to the changed surface, but broaden coverage for auth, persistence, or data-model changes.
