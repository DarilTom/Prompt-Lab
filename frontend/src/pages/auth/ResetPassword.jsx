import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { confirmPasswordReset } from "../../services/authService";

export default function ResetPassword() {
  const { uid, token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!password || !passwordConfirm) {
      setError("Please enter both password fields.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await confirmPasswordReset({
        uid,
        token,
        password,
        password_confirm: passwordConfirm,
      });

      setSuccess(true);
    } catch (err) {
      setError(
        err.message ||
          "Unable to reset your password."
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
              Set a new password.
            </h1>

            <p className="mt-5 text-base leading-7 text-muted">
              Choose a new password for your Prompt Lab
              account.
            </p>

          </div>

          {success ? (
            <div className="mt-10">

              <div className="rounded-card border border-success/20 bg-success/5 p-5">
                <p className="text-sm font-semibold text-success">
                  Password reset successfully.
                </p>

                <p className="mt-2 text-sm leading-6 text-muted">
                  You can now sign in using your new password.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="mt-5 w-full rounded-control bg-brand px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Back to Sign In
              </button>

            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-10 space-y-5"
            >

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium"
                >
                  New password
                </label>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Enter your new password"
                  className="w-full rounded-control border border-border bg-surface px-4 py-3 text-sm outline-none transition-standard placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
              </div>

              <div>
                <label
                  htmlFor="passwordConfirm"
                  className="mb-2 block text-sm font-medium"
                >
                  Confirm password
                </label>

                <input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) =>
                    setPasswordConfirm(event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Repeat your new password"
                  className="w-full rounded-control border border-border bg-surface px-4 py-3 text-sm outline-none transition-standard placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
              </div>

              {error && (
                <p className="text-sm text-error" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-control bg-brand px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Resetting..."
                  : "Reset Password"}
              </button>

            </form>
          )}

          <p className="mt-8 text-center text-sm text-muted">
            <Link
              to="/login"
              className="font-medium text-ink hover:text-brand"
            >
              ← Back to Sign In
            </Link>
          </p>

        </div>
      </div>
    </main>
  );
}