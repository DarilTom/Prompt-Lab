import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { updateUserProfile, changePassword } from "../../services/authService";
import { useInstalledModels } from "../../hooks/useInstalledModels";
import { formatModelLabel } from "../../services/modelService";

function ProfileSection({ user, setUser }) {
  const [name, setName] = useState(user?.name || user?.display_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");

    try {
      const updatedUser = await updateUserProfile({
        name: name.trim(),
        email: email.trim().toLowerCase(),
      });
      setUser(updatedUser);
      setSuccess("Profile updated successfully.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(
        err?.data?.email?.[0] ||
          err?.data?.name?.[0] ||
          err?.data?.detail ||
          err?.message ||
          "Failed to update profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 sm:p-6 shadow-subtle space-y-5">
      <div className="border-b border-border pb-3">
        <h2 className="font-serif text-xl font-semibold text-ink">
          Account & Profile
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Update your public display name and account email address.
        </p>
      </div>

      {success && (
        <div className="rounded-control border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-800">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-control border border-error/20 bg-error/5 p-3 text-xs font-medium text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Username
            </label>
            <input
              type="text"
              disabled
              value={user?.username || ""}
              className="w-full rounded-control border border-border bg-background/50 px-3 py-2 text-xs font-mono text-muted cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-muted/70">
              Usernames are permanent identifiers and cannot be modified.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Account Role
            </label>
            <input
              type="text"
              disabled
              value={user?.is_admin ? "Administrator" : "Standard Member"}
              className="w-full rounded-control border border-border bg-background/50 px-3 py-2 text-xs font-mono text-muted cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-muted/70">
              Permissions are managed securely by administrators.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="profile-name"
              className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"
            >
              Display Name
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full or display name"
              className="w-full rounded-control border border-border bg-background px-3 py-2 text-xs font-sans text-ink outline-none transition-colors focus:border-brand"
            />
          </div>

          <div>
            <label
              htmlFor="profile-email"
              className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"
            >
              Email Address
            </label>
            <input
              id="profile-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-control border border-border bg-background px-3 py-2 text-xs font-mono text-ink outline-none transition-colors focus:border-brand"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-control bg-brand px-4 py-2 text-xs font-semibold text-white shadow-subtle hover:bg-brand/90 transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {saving && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {saving ? "Saving changes..." : "Save Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ModelPreferenceSection({
  user,
  setUser,
  installedModels,
  modelsLoading,
  modelsError,
  retryModels,
}) {
  const [selectedModel, setSelectedModel] = useState(
    user?.default_model || ""
  );
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const savedModel = user?.default_model || "";
  const isSavedModelInstalled =
    !savedModel ||
    installedModels.some(
      (m) => m.name === savedModel || m.model === savedModel
    );

  const activeModelDetails = installedModels.find(
    (m) => m.name === selectedModel || m.model === selectedModel
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");

    try {
      const updatedUser = await updateUserProfile({
        default_model: selectedModel,
      });
      setUser(updatedUser);
      setSuccess(
        selectedModel
          ? `Default model preference saved as "${selectedModel}".`
          : "Default model preference cleared (will automatically use gemma3:4b or first available model)."
      );
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(
        err?.data?.default_model?.[0] ||
          err?.message ||
          "Failed to save model preference."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 sm:p-6 shadow-subtle space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3 gap-2">
        <div>
          <h2 className="font-serif text-xl font-semibold text-ink">
            Model Preferences
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Choose your default local Ollama model for sandbox executions, improvements, and evaluations.
          </p>
        </div>
        <button
          type="button"
          onClick={retryModels}
          disabled={modelsLoading}
          className="self-start sm:self-auto rounded-control border border-border bg-background px-3 py-1.5 text-xs font-medium text-ink hover:border-brand hover:text-brand transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <span className={`h-3 w-3 ${modelsLoading ? "animate-spin" : ""}`}>
            ↻
          </span>
          Refresh Models
        </button>
      </div>

      {success && (
        <div className="rounded-control border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-800">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-control border border-error/20 bg-error/5 p-3 text-xs font-medium text-error">
          {error}
        </div>
      )}

      {!isSavedModelInstalled && (
        <div className="rounded-card border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <span className="text-amber-600">⚠️</span>
            Preferred model not found in Ollama
          </div>
          <p className="text-amber-800 leading-relaxed">
            Your saved preference &ldquo;
            <span className="font-mono font-semibold">{savedModel}</span>
            &rdquo; is not currently installed locally. Prompt Lab is falling back
            to an available installed model. You can install it with{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-[11px] text-ink select-all border border-amber-200">
              ollama pull {savedModel}
            </code>{" "}
            or select another default model below.
          </p>
        </div>
      )}

      {modelsLoading ? (
        <div className="flex items-center gap-3 p-4 text-muted text-xs font-mono">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/40 border-t-brand" />
          Discovering locally installed Ollama models...
        </div>
      ) : modelsError ? (
        <div className="rounded-control border border-error/20 bg-error/5 p-3 text-xs text-error space-y-2">
          <p>{modelsError}</p>
          <button
            type="button"
            onClick={retryModels}
            className="font-semibold underline hover:opacity-80"
          >
            Retry Ollama connection
          </button>
        </div>
      ) : installedModels.length === 0 ? (
        <div className="rounded-control border border-amber-300 bg-amber-50/70 p-4 text-xs text-amber-900 space-y-2">
          <p className="font-semibold">No Ollama models detected locally</p>
          <p className="text-amber-800">
            Run this command in your terminal to install the recommended model:
          </p>
          <div className="flex items-center gap-2">
            <code className="rounded border border-amber-200 bg-white/80 px-2 py-1 font-mono text-[11px] text-ink select-all">
              ollama pull gemma3:4b
            </code>
            <button
              type="button"
              onClick={retryModels}
              className="font-semibold text-amber-900 underline hover:opacity-80"
            >
              Refresh
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="default-model-select"
              className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"
            >
              Default Model
            </label>
            <select
              id="default-model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-xs font-medium text-ink outline-none transition-colors focus:border-brand"
            >
              <option value="">
                Automatic Default (Prefer gemma3:4b if installed)
              </option>
              {installedModels.map((m) => (
                <option key={m.name} value={m.name}>
                  {formatModelLabel(m)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              Applied automatically when opening the Execution Sandbox, Prompt Improver, or Run Evaluation.
            </p>
          </div>

          {activeModelDetails && (
            <div className="rounded-control border border-border/80 bg-background/50 p-3 text-xs space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-semibold block">
                Model Information
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-semibold text-ink">
                  {activeModelDetails.name}
                </span>
                {activeModelDetails.family && (
                  <span className="rounded bg-brand/10 px-2 py-0.5 font-mono text-[10px] text-brand">
                    Family: {activeModelDetails.family}
                  </span>
                )}
                {activeModelDetails.parameter_size && (
                  <span className="rounded bg-border/60 px-2 py-0.5 font-mono text-[10px] text-ink">
                    Parameters: {activeModelDetails.parameter_size}
                  </span>
                )}
                {activeModelDetails.size_formatted && (
                  <span className="rounded bg-border/60 px-2 py-0.5 font-mono text-[10px] text-ink">
                    Size: {activeModelDetails.size_formatted}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-control bg-brand px-4 py-2 text-xs font-semibold text-white shadow-subtle hover:bg-brand/90 transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {saving && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {saving ? "Saving preference..." : "Save Model Preference"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function BehaviorSection({ user, setUser }) {
  const [notify, setNotify] = useState(user?.notify_on_completion !== false);
  const [autoScroll, setAutoScroll] = useState(
    user?.auto_scroll_results !== false
  );
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");

    try {
      const updatedUser = await updateUserProfile({
        notify_on_completion: notify,
        auto_scroll_results: autoScroll,
      });
      setUser(updatedUser);
      setSuccess("Behavior preferences saved successfully.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err?.message || "Failed to update behavior preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 sm:p-6 shadow-subtle space-y-5">
      <div className="border-b border-border pb-3">
        <h2 className="font-serif text-xl font-semibold text-ink">
          Notifications & Behavior
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Configure dashboard completion alerts and viewport scrolling interactions.
        </p>
      </div>

      {success && (
        <div className="rounded-control border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-800">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-control border border-error/20 bg-error/5 p-3 text-xs font-medium text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <label className="flex items-start justify-between gap-4 rounded-control border border-border/70 bg-background/40 p-3.5 hover:bg-background/80 transition-colors cursor-pointer">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-ink block">
                Background Task Notifications
              </span>
              <span className="text-[11px] text-muted leading-relaxed block">
                Show notification banners in the dashboard header when executions or prompt improvements complete in the background.
              </span>
            </div>
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-brand focus:ring-brand/30 cursor-pointer"
            />
          </label>

          <label className="flex items-start justify-between gap-4 rounded-control border border-border/70 bg-background/40 p-3.5 hover:bg-background/80 transition-colors cursor-pointer">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-ink block">
                Auto-Scroll to Completed Responses
              </span>
              <span className="text-[11px] text-muted leading-relaxed block">
                Automatically scroll the viewport to the generated result upon completion in the Execution Sandbox and Prompt Improver.
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-brand focus:ring-brand/30 cursor-pointer"
            />
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-control bg-brand px-4 py-2 text-xs font-semibold text-white shadow-subtle hover:bg-brand/90 transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {saving && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordSection({ user }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      setSaving(false);
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setError("New passwords do not match.");
      setSaving(false);
      return;
    }

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      });

      setSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      const fieldErrors = err?.data;
      const msg =
        fieldErrors?.current_password?.[0] ||
        fieldErrors?.new_password?.[0] ||
        fieldErrors?.new_password_confirm?.[0] ||
        err?.message ||
        "Failed to change password.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 sm:p-6 shadow-subtle space-y-5">
      <div className="border-b border-border pb-3">
        <h2 className="font-serif text-xl font-semibold text-ink">
          Security & Password
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Update your account password. Never share your credentials.
        </p>
      </div>

      {success && (
        <div className="rounded-control border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-800">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-control border border-error/20 bg-error/5 p-3 text-xs font-medium text-error">
          {error}
        </div>
      )}

      {user?.has_usable_password === false && (
        <div className="rounded-control border border-brand/20 bg-brand/5 p-3.5 text-xs text-ink space-y-1">
          <span className="font-semibold block text-brand">
            Google Account Sign-In
          </span>
          <p className="text-muted leading-relaxed">
            Your account currently signs in with Google. You can set a password below to also enable standard email/password authentication.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {user?.has_usable_password !== false && (
          <div>
            <label
              htmlFor="current-password"
              className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"
            >
              Current Password
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={showCurrentPw ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full rounded-control border border-border bg-background px-3 py-2 pr-10 text-xs font-sans text-ink outline-none transition-colors focus:border-brand"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-2.5 text-xs text-muted hover:text-ink cursor-pointer"
                tabIndex={-1}
              >
                {showCurrentPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="new-password"
              className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNewPw ? "text" : "password"}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-control border border-border bg-background px-3 py-2 pr-10 text-xs font-sans text-ink outline-none transition-colors focus:border-brand"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-2.5 text-xs text-muted hover:text-ink cursor-pointer"
                tabIndex={-1}
              >
                {showNewPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="new-password-confirm"
              className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"
            >
              Confirm New Password
            </label>
            <input
              id="new-password-confirm"
              type="password"
              required
              minLength={8}
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full rounded-control border border-border bg-background px-3 py-2 text-xs font-sans text-ink outline-none transition-colors focus:border-brand"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-control bg-brand px-4 py-2 text-xs font-semibold text-white shadow-subtle hover:bg-brand/90 transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {saving && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {saving ? "Updating password..." : "Update Password"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Settings() {
  const { user, setUser } = useAuth();

  const {
    models: installedModels,
    loading: modelsLoading,
    error: modelsError,
    retry: retryModels,
  } = useInstalledModels();

  return (
    <div className="max-w-4xl space-y-8 pb-16">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-muted">
            Preferences
          </span>
        </div>
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl text-ink">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Manage your account profile, default Ollama model, and execution preferences.
        </p>
      </div>

      {/* Account Overview Header Card */}
      <div className="rounded-card border border-border bg-surface p-5 sm:p-6 shadow-subtle">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/10 font-mono text-base font-bold text-brand ring-1 ring-brand/20">
              {(
                user?.name?.[0] ||
                user?.display_name?.[0] ||
                user?.username?.[0] ||
                "U"
              ).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg font-semibold text-ink">
                  {user?.display_name || user?.name || user?.username}
                </h2>
                {user?.is_admin && (
                  <span className="inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-brand">
                    Administrator
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <span className="font-mono">@{user?.username}</span>
                <span>•</span>
                <span>{user?.email}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:self-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              Active Account
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: Account & Profile */}
      <ProfileSection key={`profile-${user?.id}`} user={user} setUser={setUser} />

      {/* Section 2: Model Preferences */}
      <ModelPreferenceSection
        key={`model-${user?.id}-${user?.default_model}`}
        user={user}
        setUser={setUser}
        installedModels={installedModels}
        modelsLoading={modelsLoading}
        modelsError={modelsError}
        retryModels={retryModels}
      />

      {/* Section 3: Notifications & Behavior */}
      <BehaviorSection
        key={`behavior-${user?.id}-${user?.notify_on_completion}-${user?.auto_scroll_results}`}
        user={user}
        setUser={setUser}
      />

      {/* Section 4: Security & Password */}
      <PasswordSection key={`password-${user?.id}`} user={user} />
    </div>
  );
}
