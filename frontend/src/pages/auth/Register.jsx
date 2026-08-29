import { Link } from "react-router-dom";

function Register() {
  return (
    <main className="min-h-dvh bg-background text-ink">
      <div className="grid min-h-dvh lg:grid-cols-2">
        {/* Left: Registration form */}
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
            <div className="mt-12">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                Start experimenting
              </p>

              <h1 className="mt-3 font-serif text-5xl leading-tight sm:text-6xl">
                Create your account.
              </h1>

              <p className="mt-5 max-w-sm text-base leading-7 text-muted">
                Build, test, version, and compare better prompts.
              </p>
            </div>

            {/* Registration form */}
            <form className="mt-10 space-y-5">
              {/* Full name */}
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-medium"
                >
                  Full name
                </label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  className="w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink outline-none transition-standard placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
              </div>

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
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium"
                >
                  Password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Create a password"
                  className="w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink outline-none transition-standard placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
              </div>

              {/* Confirm password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-medium"
                >
                  Confirm password
                </label>

                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className="w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink outline-none transition-standard placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full rounded-control bg-brand px-5 py-3 text-sm font-semibold text-white transition-standard hover:opacity-90"
              >
                Create Account
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

            {/* Login link */}
            <p className="mt-8 text-center text-sm text-muted">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-ink transition-standard hover:text-brand"
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>

        {/* Right: Experiment philosophy */}
        <section className="hidden bg-surface p-8 lg:flex lg:items-center lg:justify-center">
          <div className="w-full max-w-lg">
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-card border border-border bg-background p-5 shadow-subtle">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">
                  Step 01
                </p>

                <h2 className="mt-8 font-serif text-3xl">
                  Design
                </h2>

                <p className="mt-3 text-sm leading-6 text-muted">
                  Build precise prompts for the task at hand.
                </p>
              </article>

              <article className="rounded-card border border-border bg-background p-5 shadow-subtle">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">
                  Step 02
                </p>

                <h2 className="mt-8 font-serif text-3xl">
                  Test
                </h2>

                <p className="mt-3 text-sm leading-6 text-muted">
                  Run experiments and inspect the results.
                </p>
              </article>

              <article className="rounded-card border border-border bg-background p-5 shadow-subtle">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">
                  Step 03
                </p>

                <h2 className="mt-8 font-serif text-3xl">
                  Compare
                </h2>

                <p className="mt-3 text-sm leading-6 text-muted">
                  Compare versions and model responses.
                </p>
              </article>

              <article className="rounded-card border border-border bg-background p-5 shadow-subtle">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">
                  Step 04
                </p>

                <h2 className="mt-8 font-serif text-3xl">
                  Improve
                </h2>

                <p className="mt-3 text-sm leading-6 text-muted">
                  Keep the draft that actually works.
                </p>
              </article>
            </div>

            <p className="mt-5 font-mono text-xs uppercase tracking-widest text-muted">
              A laboratory for better prompts
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Register;