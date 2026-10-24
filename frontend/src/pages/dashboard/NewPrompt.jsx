import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPrompt } from "../../services/promptService";

const INITIAL_FORM = {
  title: "",
  description: "",
  category: "engineering",
  content: "",
  system_prompt: "",
};

export default function NewPrompt() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!formData.title.trim()) {
      setError("Please enter a prompt title.");
      return;
    }

    if (!formData.content.trim()) {
      setError("Please enter the prompt content.");
      return;
    }

    setLoading(true);

    try {
      await createPrompt({
        ...formData,
        status: "draft",

        // The backend expects these fields when creating
        // the initial PromptVersion.
        variables: {},
        change_summary: "Initial version",
      });

      navigate("/dashboard/prompts");
    } catch (err) {
      setError(err.message || "Unable to create prompt.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-ink">
          New Prompt
        </h1>

        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          Create the first version of a prompt experiment.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-card border border-error/20 bg-error/5 px-4 py-3">
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic information */}
        <section className="rounded-card border border-border bg-surface p-6">
          <div className="grid gap-5">
            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="mb-2 block text-sm font-medium text-ink"
              >
                Title
              </label>

              <input
                id="title"
                name="title"
                type="text"
                value={formData.title}
                onChange={handleChange}
                placeholder="Customer Support Assistant"
                className="w-full rounded-control border border-border bg-background px-4 py-3 text-sm text-ink outline-none transition-standard placeholder:text-muted/50 focus:border-brand focus:ring-2 focus:ring-brand/10"
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium text-ink"
              >
                Description
              </label>

              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Briefly describe what this prompt is intended to do."
                className="w-full resize-y rounded-control border border-border bg-background px-4 py-3 text-sm leading-6 text-ink outline-none transition-standard placeholder:text-muted/50 focus:border-brand focus:ring-2 focus:ring-brand/10"
              />
            </div>

            {/* Category */}
            <div>
              <label
                htmlFor="category"
                className="mb-2 block text-sm font-medium text-ink"
              >
                Category
              </label>

              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full max-w-sm cursor-pointer rounded-control border border-border bg-background px-4 py-3 text-sm text-ink outline-none transition-standard focus:border-brand focus:ring-2 focus:ring-brand/10"
              >
                <option value="content">Content</option>
                <option value="ecommerce">E-commerce</option>
                <option value="engineering">Engineering</option>
                <option value="legal">Legal</option>
                <option value="productivity">Productivity</option>
                <option value="research">Research</option>
                <option value="support">Support</option>
              </select>
            </div>
          </div>
        </section>

        {/* Prompt content */}
        <section className="rounded-card border border-border bg-surface p-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Prompt
            </p>

            <label
              htmlFor="content"
              className="mt-3 mb-2 block text-sm font-medium text-ink"
            >
              Prompt content
            </label>

            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              rows={12}
              placeholder="Write the prompt you want to experiment with..."
              className="w-full resize-y rounded-control border border-border bg-background px-4 py-3 font-mono text-sm leading-7 text-ink outline-none transition-standard placeholder:text-muted/40 focus:border-brand focus:ring-2 focus:ring-brand/10"
            />
          </div>
        </section>

        {/* System prompt */}
        <section className="rounded-card border border-border bg-surface p-6">
          <label
            htmlFor="system_prompt"
            className="mb-2 block text-sm font-medium text-ink"
          >
            System prompt
          </label>

          <p className="mb-3 text-xs leading-5 text-muted">
            Optional instructions that define how the model should behave.
          </p>

          <textarea
            id="system_prompt"
            name="system_prompt"
            value={formData.system_prompt}
            onChange={handleChange}
            rows={6}
            placeholder="You are helpful, concise, and professional."
            className="w-full resize-y rounded-control border border-border bg-background px-4 py-3 font-mono text-sm leading-7 text-ink outline-none transition-standard placeholder:text-muted/40 focus:border-brand focus:ring-2 focus:ring-brand/10"
          />
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard/prompts")}
            className="rounded-control border border-border bg-surface px-5 py-3 text-sm font-medium text-ink transition-standard hover:border-ink"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="rounded-control bg-brand px-5 py-3 text-sm font-semibold text-white transition-standard hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Prompt"}
          </button>
        </div>
      </form>
    </div>
  );
}