import { useAuth } from "../../context/AuthContext";

function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <main className="min-h-dvh bg-background text-ink">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <p className="font-serif text-3xl">Prompt Lab</p>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">
              Workspace
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium transition-standard hover:border-ink"
          >
            Sign out
          </button>
        </header>

        <section className="flex flex-1 items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              Experiment workspace
            </p>

            <h1 className="mt-3 font-serif text-5xl">
              Welcome, {user?.name || user?.email}.
            </h1>

            <p className="mt-4 max-w-xl leading-7 text-muted">
              Your Prompt Lab workspace is ready. Prompt Library, experiments,
              versioning, and analytics will live here.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Dashboard;