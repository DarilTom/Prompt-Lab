import { Link } from "react-router-dom";

function Login() {
  return (
    <main className="min-h-dvh bg-background text-ink">
      <div className="grid min-h-dvh lg:grid-cols-2">
        {/* Left: Login form */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            {/* Brand */}
            <Link
              to="/"
              className="inline-block font-serif text-2xl tracking-tight"
            >
              Prompt Lab
            </Link>

            {/* Heading */}
            <div className="mt-14">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                Prompt Lab
              </p>

              <h1 className="mt-3 font-serif text-5xl leading-tight sm:text-6xl">
                Welcome back.
              </h1>

              <p className="mt-5 max-w-sm text-base leading-7 text-muted">
                Continue experimenting with better prompts.
              </p>
            </div>

            {/* Login form */}
            <form className="mt-10 space-y-5">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium"
                >
                  Email
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink outline-none transition-standard placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
              </div>

              {/* Password */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    className="text-sm text-muted transition-standard hover:text-brand"
                  >
                    Forgot password?
                  </button>
                </div>

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink outline-none transition-standard placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full rounded-control bg-brand px-5 py-3 text-sm font-semibold text-white transition-standard hover:opacity-90"
              >
                Sign In
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />

                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  or
                </span>

                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Google */}
              <button
                type="button"
                className="w-full rounded-control border border-border bg-surface px-5 py-3 text-sm font-medium text-ink transition-standard hover:border-ink"
              >
                Continue with Google
              </button>
            </form>

            {/* Register link */}
            <p className="mt-8 text-center text-sm text-muted">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="font-medium text-ink transition-standard hover:text-brand"
              >
                Create account
              </Link>
            </p>
          </div>
        </section>

        {/* Right: Editorial experiment panel */}
        <section className="hidden bg-surface p-8 lg:flex lg:items-center lg:justify-center">
          <div className="w-full max-w-lg">
            <div className="rounded-card border border-border bg-background p-6 shadow-subtle">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <span className="font-mono text-xs uppercase tracking-widest text-muted">
                  Experiment 014
                </span>

                <span className="rounded-pill bg-support/30 px-3 py-1 font-mono text-[11px] text-ink">
                  v04
                </span>
              </div>

              {/* Prompt */}
              <div className="pt-6">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">
                  Prompt
                </p>

                <p className="mt-3 font-mono text-sm leading-7 text-ink">
                  Analyze the following problem and provide a structured,
                  practical solution...
                </p>
              </div>

              {/* Metrics */}
              <div className="mt-8 grid grid-cols-3 gap-3">
                <div className="rounded-md border border-border bg-surface p-3">
                  <p className="font-mono text-[10px] uppercase text-muted">
                    Model
                  </p>
                  <p className="mt-2 font-mono text-xs">Llama 3</p>
                </div>

                <div className="rounded-md border border-border bg-surface p-3">
                  <p className="font-mono text-[10px] uppercase text-muted">
                    Tokens
                  </p>
                  <p className="mt-2 font-mono text-xs">384</p>
                </div>

                <div className="rounded-md border border-border bg-surface p-3">
                  <p className="font-mono text-[10px] uppercase text-muted">
                    Score
                  </p>
                  <p className="mt-2 font-mono text-xs">92/100</p>
                </div>
              </div>
            </div>

            <p className="mt-5 font-mono text-xs uppercase tracking-widest text-muted">
              Design · Test · Optimize · Compare
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Login;