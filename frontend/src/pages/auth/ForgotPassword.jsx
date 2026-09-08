import { useState } from "react";
import { Link } from "react-router-dom";

import { requestPasswordReset } from "../../services/authService";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const data = await requestPasswordReset(
        email.trim()
      );

      setMessage(
        data.detail ||
          "If an account exists for that email, a reset link has been sent."
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to process the password reset request."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background text-ink">
      <div className="flex min-h-dvh items-center justify-center px-6 py-12">

        <div className="w-full max-w-md">

          <Link
            to="/"
            className="font-serif text-2xl tracking-tight"
          >
            Prompt Lab
          </Link>

          <div className="mt-14">

            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              Account recovery
            </p>

            <h1 className="mt-3 font-serif text-5xl leading-tight">
              Reset your password.
            </h1>

            <p className="mt-5 text-base leading-7 text-muted">
              Enter the email associated with your Prompt Lab
              account and we'll send you a reset link.
            </p>

          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-10 space-y-5"
          >

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-control border border-border bg-surface px-4 py-3 text-sm outline-none transition-standard placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/10"
              />
            </div>

            {error && (
              <p
                className="text-sm text-error"
                role="alert"
              >
                {error}
              </p>
            )}

            {message && (
              <div
                className="rounded-control border border-success/20 bg-success/5 px-4 py-3 text-sm text-success"
                role="status"
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-control bg-brand px-5 py-3 text-sm font-semibold text-white transition-standard hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Sending..."
                : "Send Reset Link"}
            </button>

          </form>

          <p className="mt-8 text-center text-sm text-muted">
            Remember your password?{" "}
            <Link
              to="/login"
              className="font-medium text-ink hover:text-brand"
            >
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </main>
  );
}