interface HomePageShellProps {
  message?: string;
}

function PlaceholderLine({
  className,
}: {
  className: string;
}) {
  return <div className={`rounded-full bg-[var(--surface2)]/85 ${className}`} />;
}

export function HomePageShell({
  message = "Loading your workspace shell…",
}: HomePageShellProps) {
  return (
    <main className="flex min-h-[100svh] flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--separator)] bg-[var(--titlebar)] px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="window-dot bg-[var(--traffic-red)] opacity-80" />
            <span className="window-dot bg-[var(--traffic-yellow)] opacity-80" />
            <span className="window-dot bg-[var(--traffic-green)] opacity-80" />
          </div>
          <PlaceholderLine className="h-5 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <PlaceholderLine className="h-7 w-20" />
          <PlaceholderLine className="h-7 w-24" />
          <PlaceholderLine className="h-7 w-7" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[260px] shrink-0 border-r border-[var(--separator)] bg-[var(--sidebar)] px-3 py-4 md:flex md:flex-col">
          <PlaceholderLine className="mb-4 h-9 w-full rounded-2xl" />
          <div className="space-y-3">
            <PlaceholderLine className="h-4 w-28" />
            <PlaceholderLine className="h-4 w-36" />
            <PlaceholderLine className="h-4 w-24" />
            <PlaceholderLine className="h-4 w-32" />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-[var(--separator)] px-3">
            <PlaceholderLine className="h-7 w-32 rounded-md" />
            <PlaceholderLine className="h-7 w-28 rounded-md" />
          </div>
          <div className="flex h-7 shrink-0 items-center border-b border-[var(--separator)] px-4">
            <PlaceholderLine className="h-3 w-48" />
          </div>

          <section className="flex min-h-0 flex-1 items-center justify-center p-6">
            <div className="w-full max-w-2xl rounded-[28px] border border-[var(--separator)] bg-[var(--surface)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                Pseudocode Compiler
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-[var(--text)]">
                Opening the editor without blocking first paint
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text2)]">{message}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <PlaceholderLine className="h-20 rounded-2xl" />
                <PlaceholderLine className="h-20 rounded-2xl" />
                <PlaceholderLine className="h-20 rounded-2xl" />
              </div>
            </div>
          </section>

          <div className="h-px shrink-0 bg-[var(--separator)]" />
          <section className="flex h-[160px] shrink-0 flex-col bg-[var(--surface)] px-4 py-3">
            <PlaceholderLine className="h-3 w-20" />
            <div className="mt-4 space-y-2">
              <PlaceholderLine className="h-3 w-4/5" />
              <PlaceholderLine className="h-3 w-3/5" />
              <PlaceholderLine className="h-3 w-2/5" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
