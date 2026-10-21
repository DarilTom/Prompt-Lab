import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  createPrompt,
  createPromptVersion,
  getPrompts,
  improvePrompt,
} from "../../services/promptService";

const TONE_OPTIONS = [
  { value: "", label: "Natural / Default" },
  { value: "Professional and precise", label: "Professional & Precise" },
  { value: "Direct, concise, and minimal", label: "Direct & Concise" },
  { value: "Friendly, empathetic, and approachable", label: "Friendly & Warm" },
  { value: "Analytical, academic, and rigorous", label: "Analytical & Rigorous" },
  { value: "Creative, engaging, and persuasive", label: "Creative & Engaging" },
];

const FORMAT_OPTIONS = [
  { value: "", label: "Flexible / Default" },
  { value: "Clean markdown with structured headings", label: "Markdown Headings" },
  { value: "Bullet points with key takeaways", label: "Bullet Points" },
  { value: "Step-by-step numbered instructions", label: "Step-by-Step" },
  { value: "Strict valid JSON object", label: "JSON Object" },
  { value: "Concise plain text paragraphs", label: "Plain Text" },
];

const CATEGORIES = [
  { value: "engineering", label: "Engineering" },
  { value: "content", label: "Content" },
  { value: "productivity", label: "Productivity" },
  { value: "research", label: "Research" },
  { value: "support", label: "Support" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "legal", label: "Legal" },
];

export default function PromptImprover() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const greetingHeading = user?.name?.trim()
    ? `Welcome back, ${user.name.trim()}`
    : "Welcome back";

  // Input states
  const [promptText, setPromptText] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [model, setModel] = useState("gemma3:4b");

  // Improver generation state
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState("");
  const [improvedResult, setImprovedResult] = useState(null);
  const [originalDraft, setOriginalDraft] = useState("");
  const [editablePrompt, setEditablePrompt] = useState("");

  // Suggestions history (for "Improve Again" without overwriting)
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  // Save workflow states
  const [userPrompts, setUserPrompts] = useState([]);
  const [saveMode, setSaveMode] = useState(null); // 'new' | 'version' | null
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedPromptInfo, setSavedPromptInfo] = useState(null);

  // Form states for saving
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("engineering");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [versionNote, setVersionNote] = useState("Improved via AI Prompt Improver");

  // Copy feedback
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedImproved, setCopiedImproved] = useState(false);

  // Load existing prompts for the "Save as version" dropdown
  useEffect(() => {
    async function loadPrompts() {
      try {
        const res = await getPrompts();
        const list = Array.isArray(res) ? res : res?.results || [];
        setUserPrompts(list);
        if (list.length > 0) {
          setSelectedPromptId(String(list[0].id));
        }
      } catch (err) {
        console.warn("Could not load user prompts for version selection:", err);
      }
    }
    loadPrompts();
  }, []);

  async function handleImprove(event) {
    if (event) event.preventDefault();
    if (!promptText.trim()) {
      setError("Please describe what you want the AI to accomplish.");
      return;
    }

    try {
      setImproving(true);
      setError("");
      setSaveError("");
      setSavedPromptInfo(null);
      setSaveMode(null);

      const result = await improvePrompt({
        prompt_text: promptText.trim(),
        context: context.trim(),
        tone,
        output_format: outputFormat,
        model,
      });

      const initialSug = {
        id: Date.now(),
        improved_prompt: result.improved_prompt || "",
        explanation: result.explanation || "",
        model: result.model || model,
        editable_text: result.improved_prompt || "",
      };

      setOriginalDraft(promptText.trim());
      setSuggestions([initialSug]);
      setActiveSuggestionIndex(0);
      setImprovedResult(result);
      setEditablePrompt(result.improved_prompt || "");

      // Pre-fill a default title for save-as-new based on original prompt
      const words = promptText.trim().split(/\s+/).slice(0, 5).join(" ");
      setNewTitle(words ? words.charAt(0).toUpperCase() + words.slice(1) : "Improved Prompt");
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Unable to improve prompt. Please ensure Ollama is running locally with gemma3:4b."
      );
    } finally {
      setImproving(false);
    }
  }

  async function handleImproveAgain() {
    if (improving || saveLoading) return;
    const baseGoal = originalDraft || promptText.trim();
    if (!baseGoal) {
      setError("Please describe what you want the AI to accomplish.");
      return;
    }

    try {
      setImproving(true);
      setError("");
      setSaveError("");

      // Preserve user edits on the currently active suggestion before generating another
      const updatedSuggestions = suggestions.map((sug, idx) =>
        idx === activeSuggestionIndex ? { ...sug, editable_text: editablePrompt } : sug
      );

      const result = await improvePrompt({
        prompt_text: baseGoal,
        context: context.trim(),
        tone,
        output_format: outputFormat,
        model,
      });

      const nextSug = {
        id: Date.now(),
        improved_prompt: result.improved_prompt || "",
        explanation: result.explanation || "",
        model: result.model || model,
        editable_text: result.improved_prompt || "",
      };

      const finalSuggestions = [...updatedSuggestions, nextSug];
      setSuggestions(finalSuggestions);
      setActiveSuggestionIndex(finalSuggestions.length - 1);
      setImprovedResult(result);
      setEditablePrompt(nextSug.improved_prompt);
      setSavedPromptInfo(null);
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Unable to generate another suggestion. Please check that Ollama is running."
      );
    } finally {
      setImproving(false);
    }
  }

  function handleSelectSuggestion(index) {
    if (index === activeSuggestionIndex || index < 0 || index >= suggestions.length) return;

    // Save current active edits into active suggestion
    const updated = suggestions.map((sug, idx) =>
      idx === activeSuggestionIndex ? { ...sug, editable_text: editablePrompt } : sug
    );
    setSuggestions(updated);

    const target = updated[index];
    setActiveSuggestionIndex(index);
    setEditablePrompt(target.editable_text);
    setImprovedResult(target);
  }

  function handleCopy(text, setFeedback) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setFeedback(true);
    setTimeout(() => setFeedback(false), 2000);
  }

  async function handleSaveNew(andOpenSandbox = false) {
    if (!newTitle.trim()) {
      setSaveError("Please provide a title for the new prompt.");
      return;
    }
    if (!editablePrompt.trim()) {
      setSaveError("Prompt content cannot be empty.");
      return;
    }

    try {
      setSaveLoading(true);
      setSaveError("");

      const created = await createPrompt({
        title: newTitle.trim(),
        description: `Created from goal: ${originalDraft.slice(0, 120)}...`,
        category: newCategory,
        status: "testing",
        content: editablePrompt.trim(),
        system_prompt: "",
        variables: {},
        change_summary: "Initial improved prompt version",
      });

      setSavedPromptInfo({
        id: created.id,
        title: created.title,
        version: 1,
      });
      setSaveMode(null);

      // Refresh prompt list in background so "Save as version" is immediately updated
      getPrompts()
        .then((res) => {
          const list = Array.isArray(res) ? res : res?.results || [];
          setUserPrompts(list);
        })
        .catch(() => {});

      if (andOpenSandbox) {
        navigate(`/dashboard/prompts/${created.id}#execution-sandbox`);
      }
    } catch (err) {
      console.error(err);
      setSaveError(err.message || "Unable to save new prompt.");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleSaveVersion(andOpenSandbox = false) {
    if (!selectedPromptId) {
      setSaveError("Please select a prompt to add this version to.");
      return;
    }
    if (!editablePrompt.trim()) {
      setSaveError("Prompt content cannot be empty.");
      return;
    }

    try {
      setSaveLoading(true);
      setSaveError("");

      const createdVersion = await createPromptVersion(selectedPromptId, {
        content: editablePrompt.trim(),
        system_prompt: "",
        change_summary: versionNote.trim() || "Improved prompt version",
        variables: {},
      });

      const parentPrompt = userPrompts.find(
        (p) => String(p.id) === String(selectedPromptId)
      );

      setSavedPromptInfo({
        id: selectedPromptId,
        title: parentPrompt ? parentPrompt.title : `Prompt #${selectedPromptId}`,
        version: createdVersion.version_number,
      });
      setSaveMode(null);

      if (andOpenSandbox) {
        navigate(`/dashboard/prompts/${selectedPromptId}#execution-sandbox`);
      }
    } catch (err) {
      console.error(err);
      setSaveError(err.message || "Unable to save prompt version.");
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div className="space-y-8 pb-16 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl text-ink">
          {greetingHeading}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
          What would you like to create today? Turn your idea into a clear, effective prompt with AI.
        </p>
      </div>

      {/* Main Error */}
      {error && (
        <div className="rounded-card border border-error/20 bg-error/5 p-4 text-sm text-error">
          <p className="font-semibold">Unable to generate prompt</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Editor Card */}
      <section className="rounded-card border border-border bg-surface p-6 shadow-subtle">
        <form onSubmit={handleImprove} className="space-y-5">
          {/* Main Goal */}
          <div>
            <label
              htmlFor="prompt-goal"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink"
            >
              What should the AI accomplish?
            </label>
            <textarea
              id="prompt-goal"
              rows={4}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g. Write a friendly follow-up email to a prospective client who attended a SaaS product demo yesterday, highlighting our analytics dashboard and suggesting a brief call next week."
              className="w-full rounded-control border border-border bg-background p-4 text-sm leading-6 text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-brand"
            />
          </div>

          {/* Quick Options */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="tone-select"
                className="mb-1.5 block text-xs font-medium text-ink"
              >
                Desired Tone <span className="text-muted">(optional)</span>
              </label>
              <select
                id="tone-select"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-xs text-ink outline-none transition-colors focus:border-brand"
              >
                {TONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="format-select"
                className="mb-1.5 block text-xs font-medium text-ink"
              >
                Output Format <span className="text-muted">(optional)</span>
              </label>
              <select
                id="format-select"
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-xs text-ink outline-none transition-colors focus:border-brand"
              >
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Additional Context */}
          <div>
            <label
              htmlFor="context-input"
              className="mb-1.5 block text-xs font-medium text-ink"
            >
              Additional Context or Constraints{" "}
              <span className="text-muted">(optional)</span>
            </label>
            <input
              id="context-input"
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. The client is a healthcare startup; avoid overly technical jargon; keep under 150 words."
              className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-xs text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-brand"
            />
          </div>

          {/* Expandable Advanced Settings */}
          <details className="border-t border-border pt-3">
            <summary className="cursor-pointer list-none text-xs font-medium text-muted hover:text-ink">
              <span className="inline-flex items-center gap-1.5">
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="transition-transform [[open]_&]:rotate-90"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 18l6-6-6-6"
                  />
                </svg>
                Advanced settings
              </span>
            </summary>

            <div className="mt-3 max-w-xs">
              <label className="mb-1 block text-xs font-medium text-muted">
                Optimizer Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-control border border-border bg-background px-3 py-2 text-xs font-mono text-ink outline-none focus:border-brand"
              >
                <option value="gemma3:4b">gemma3:4b (Local Ollama)</option>
              </select>
              <p className="mt-1 text-[10px] text-muted">
                Runs locally via Ollama on port 11434.
              </p>
            </div>
          </details>

          {/* Action Row */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-xs text-muted">
              Prompt Lab formulates role framing, task rules, and structure.
            </p>

            <button
              type="submit"
              disabled={improving || !promptText.trim()}
              className="inline-flex items-center gap-2 rounded-control bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {improving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Improving with Ollama...
                </>
              ) : (
                <>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Improve Prompt
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Comparison & Improvement Results */}
      {improvedResult && (
        <section className="space-y-6">
          {/* Key Improvements Explanation Banner */}
          <div className="rounded-card border border-brand/20 bg-brand/5 p-5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-brand">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </span>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
                Key Improvements Made
              </p>
            </div>

            <p className="mt-2 text-sm leading-6 text-ink whitespace-pre-line">
              {improvedResult.explanation ||
                "Refined instructions for greater clarity, explicit constraints, and structured output."}
            </p>
          </div>

          {/* Side-by-side: Original vs Improved */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Original Draft (Reference) */}
            <div className="flex flex-col rounded-card border border-border bg-surface shadow-subtle">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Original Goal / Draft
                </span>

                <button
                  type="button"
                  onClick={() => handleCopy(originalDraft, setCopiedOriginal)}
                  className="text-xs text-muted transition-colors hover:text-ink"
                >
                  {copiedOriginal ? "Copied!" : "Copy"}
                </button>
              </div>

              <div className="flex-1 p-5">
                <p className="whitespace-pre-wrap font-mono text-xs leading-6 text-muted">
                  {originalDraft}
                </p>
              </div>
            </div>

            {/* Improved Prompt (Editable) */}
            <div className="flex flex-col rounded-card border border-brand/40 bg-surface shadow-subtle ring-1 ring-brand/15">
              <div className="flex items-center justify-between border-b border-border bg-brand/5 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
                    AI-Improved Prompt
                  </span>
                  <span className="rounded-full bg-background px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                    Editable
                  </span>

                  {suggestions.length > 1 && (
                    <div className="ml-1 inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted">
                      <span>
                        Suggestion {activeSuggestionIndex + 1} of {suggestions.length}
                      </span>
                      <button
                        type="button"
                        disabled={activeSuggestionIndex === 0}
                        onClick={() => handleSelectSuggestion(activeSuggestionIndex - 1)}
                        className="rounded px-1 font-bold hover:text-ink disabled:opacity-30"
                        title="Previous suggestion"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        disabled={activeSuggestionIndex === suggestions.length - 1}
                        onClick={() => handleSelectSuggestion(activeSuggestionIndex + 1)}
                        className="rounded px-1 font-bold hover:text-ink disabled:opacity-30"
                        title="Next suggestion"
                      >
                        ▶
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(editablePrompt, setCopiedImproved)}
                  className="text-xs font-medium text-brand transition-opacity hover:opacity-80"
                >
                  {copiedImproved ? "Copied!" : "Copy prompt"}
                </button>
              </div>

              <div className="flex-1 p-5">
                <textarea
                  rows={10}
                  value={editablePrompt}
                  onChange={(e) => setEditablePrompt(e.target.value)}
                  className="w-full resize-y rounded-control border border-border bg-background p-4 font-mono text-xs leading-6 text-ink outline-none transition-colors focus:border-brand"
                  placeholder="The improved prompt will appear here..."
                />
                <p className="mt-2 text-right font-mono text-[10px] text-muted">
                  {editablePrompt.length} characters · {editablePrompt.split(/\s+/).filter(Boolean).length} words
                </p>
              </div>
            </div>
          </div>

          {/* Saved Notification */}
          {savedPromptInfo && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-card border border-success/30 bg-success/5 p-4 text-sm text-success">
              <div>
                <p className="font-medium">
                  Prompt successfully saved as &ldquo;{savedPromptInfo.title}&rdquo; (v{savedPromptInfo.version})
                </p>
                <p className="text-xs text-success/80">
                  Ready to test with inputs in the execution sandbox.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/dashboard/prompts/${savedPromptInfo.id}#execution-sandbox`
                  )
                }
                className="inline-flex w-fit items-center gap-1.5 rounded-control bg-success px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
              >
                Open in Sandbox →
              </button>
            </div>
          )}

          {/* Save & Sandbox Action Bar */}
          <div className="rounded-card border border-border bg-surface p-5 shadow-subtle">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">
                  Actions &amp; Next Steps
                </p>
                <p className="text-xs text-muted">
                  Generate another variation, save to your library, or test directly in the sandbox.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={improving || saveLoading}
                  onClick={handleImproveAgain}
                  className="inline-flex items-center gap-1.5 rounded-control border border-border bg-background px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                  title="Generate another suggestion without overwriting your current prompt"
                >
                  {improving ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand/40 border-t-brand" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Improve Again
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={saveLoading || improving}
                  onClick={() => setSaveMode(saveMode === "new" ? null : "new")}
                  className={`rounded-control border px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${
                    saveMode === "new"
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-surface text-ink hover:border-brand hover:text-brand"
                  }`}
                >
                  Save as New Prompt
                </button>

                {userPrompts.length > 0 && (
                  <button
                    type="button"
                    disabled={saveLoading || improving}
                    onClick={() => setSaveMode(saveMode === "version" ? null : "version")}
                    className={`rounded-control border px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${
                      saveMode === "version"
                        ? "border-brand bg-brand text-white"
                        : "border-border bg-surface text-ink hover:border-brand hover:text-brand"
                    }`}
                  >
                    Save as New Version
                  </button>
                )}

                {!savedPromptInfo ? (
                  <button
                    type="button"
                    disabled={saveLoading || improving}
                    onClick={() => {
                      if (saveMode === "version") {
                        handleSaveVersion(true);
                      } else {
                        handleSaveNew(true);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-control bg-ink px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {saveLoading ? "Saving..." : "Save & Open in Sandbox →"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/dashboard/prompts/${savedPromptInfo.id}#execution-sandbox`
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-control bg-success px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Open in Sandbox →
                  </button>
                )}
              </div>
            </div>

            {/* Inline Save Error */}
            {saveError && (
              <p className="mt-3 text-xs text-error font-medium">{saveError}</p>
            )}

            {/* Mode 1: Save as New Prompt Form */}
            {saveMode === "new" && (
              <div className="mt-5 border-t border-border pt-4 space-y-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Save as New Prompt
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink">
                      Prompt Title
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Client Demo Follow-up Email"
                      className="w-full rounded-control border border-border bg-background px-3 py-2 text-xs text-ink outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink">
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full rounded-control border border-border bg-background px-3 py-2 text-xs text-ink outline-none focus:border-brand"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setSaveMode(null)}
                    className="rounded-control border border-border px-3 py-1.5 text-xs text-muted hover:text-ink"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={saveLoading}
                    onClick={() => handleSaveNew(false)}
                    className="rounded-control bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {saveLoading ? "Saving..." : "Save to Library"}
                  </button>

                  <button
                    type="button"
                    disabled={saveLoading}
                    onClick={() => handleSaveNew(true)}
                    className="rounded-control bg-ink px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {saveLoading ? "Saving..." : "Save & Open in Sandbox →"}
                  </button>
                </div>
              </div>
            )}

            {/* Mode 2: Add as New Version to Existing Prompt */}
            {saveMode === "version" && (
              <div className="mt-5 border-t border-border pt-4 space-y-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Add as New Version to Existing Prompt
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink">
                      Target Prompt
                    </label>
                    <select
                      value={selectedPromptId}
                      onChange={(e) => setSelectedPromptId(e.target.value)}
                      className="w-full rounded-control border border-border bg-background px-3 py-2 text-xs text-ink outline-none focus:border-brand"
                    >
                      {userPrompts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} (current v{p.latest_version?.version_number || 1})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink">
                      Change Summary
                    </label>
                    <input
                      type="text"
                      value={versionNote}
                      onChange={(e) => setVersionNote(e.target.value)}
                      placeholder="e.g. Improved clarity and structure with AI"
                      className="w-full rounded-control border border-border bg-background px-3 py-2 text-xs text-ink outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setSaveMode(null)}
                    className="rounded-control border border-border px-3 py-1.5 text-xs text-muted hover:text-ink"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={saveLoading}
                    onClick={() => handleSaveVersion(false)}
                    className="rounded-control bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {saveLoading ? "Saving..." : "Save Version"}
                  </button>

                  <button
                    type="button"
                    disabled={saveLoading}
                    onClick={() => handleSaveVersion(true)}
                    className="rounded-control bg-ink px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {saveLoading ? "Saving..." : "Save & Open in Sandbox →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
