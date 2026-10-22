import { useNavigate } from "react-router-dom";

const statusConfig = {
  production: {
    label: "PRODUCTION",
    className: "border-success/20 bg-success/10 text-success",
  },
  testing: {
    label: "TESTING",
    className: "border-warning/20 bg-warning/10 text-warning",
  },
  draft: {
    label: "DRAFT",
    className: "border-border bg-neutral-100 text-muted",
  },
  archived: {
    label: "ARCHIVED",
    className: "border-border bg-neutral-100 text-muted",
  },
};

const categoryLabels = {
  content: "CONTENT",
  ecommerce: "E-COMMERCE",
  engineering: "ENGINEERING",
  legal: "LEGAL",
  productivity: "PRODUCTIVITY",
  research: "RESEARCH",
  support: "SUPPORT",
};

function formatUpdatedAt(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function PromptCard({ prompt, onClick }) {
  const navigate = useNavigate();

  const status =
    statusConfig[prompt.status] || statusConfig.draft;

  const latestVersion = prompt.latest_version;

  const versionLabel = latestVersion
    ? `v${latestVersion.version_number}`
    : "No version";

  const snippet =
    latestVersion?.content?.trim() ||
    "No prompt content available.";

  const experimentNumber = `EXP-${String(prompt.id).padStart(
    3,
    "0"
  )}`;

  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      className="
        group
        flex h-full cursor-pointer flex-col
        rounded-card
        border border-border
        bg-surface
        p-5
        shadow-subtle

        transition-all
        duration-200
        ease-out

        hover:-translate-y-1
        hover:border-ink/15
        hover:shadow-raised

        focus-visible:outline-none
      "
    >
      {/* Top row */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-medium tracking-[0.16em] text-muted">
          {experimentNumber}
        </span>

        <span
          className={`rounded-pill border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.12em] ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      {/* Main content */}
      <div className="mt-5 flex-1">

        <h3 className="font-serif text-[25px] leading-tight transition-colors duration-200 group-hover:text-brand">
          {prompt.title}
        </h3>

        {prompt.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
            {prompt.description}
          </p>
        )}

        {/* Category */}
        <div className="mt-4">
          <span className="inline-flex rounded-control bg-accent/10 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.12em] text-accent">
            {categoryLabels[prompt.category] || prompt.category}
          </span>
        </div>

        {/* Prompt snippet */}
        <div className="mt-5 rounded-control border border-border bg-background p-3.5 transition-colors duration-200 group-hover:border-ink/10">
          <p className="line-clamp-3 whitespace-pre-wrap font-mono text-xs leading-6 text-muted">
            {snippet}
          </p>
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-5 grid grid-cols-3 gap-4 border-t border-border pt-4">

        <div>
          <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted">
            Version
          </p>

          <p className="mt-1 font-mono text-xs font-medium text-ink">
            {versionLabel}
          </p>
        </div>

        <div>
          <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted">
            Updated
          </p>

          <p className="mt-1 text-xs font-medium text-ink">
            {formatUpdatedAt(
  prompt.latest_version?.created_at || prompt.updated_at
)}
          </p>
        </div>

        <div className="text-right">
          <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted">
            Score
          </p>

          <p className="mt-1 font-mono text-xs font-medium text-muted">
            —
          </p>
        </div>
      </div>

      {/* Saved Versions Quick Links */}
      {prompt.versions && prompt.versions.length > 0 && (
        <div className="mt-4 border-t border-border/70 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted">
              Versions ({prompt.versions.length})
            </span>
            <span className="text-[10px] text-muted">
              Click to view &amp; test
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {prompt.versions.map((ver) => {
              const isLatest = ver.version_number === latestVersion?.version_number;
              return (
                <button
                  key={ver.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/dashboard/prompts/${prompt.id}?version=${ver.version_number}`);
                  }}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors ${
                    isLatest
                      ? "bg-ink text-white"
                      : "border border-border bg-background text-muted hover:border-brand hover:text-brand"
                  }`}
                  title={`v${ver.version_number}${ver.change_summary ? `: ${ver.change_summary}` : ""}`}
                >
                  <span>v{ver.version_number}</span>
                  {isLatest && (
                    <span className="text-[9px] font-normal opacity-75">latest</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">

        <span className="font-mono text-[11px] text-muted">
          {prompt.versions && prompt.versions.length > 1
            ? `${prompt.versions.length} versions`
            : versionLabel}
        </span>

        <span className="flex items-center gap-1 text-xs font-semibold text-muted transition-all duration-200 group-hover:gap-2 group-hover:text-brand">
          Open
          <span aria-hidden="true">→</span>
        </span>
      </div>
    </article>
  );
}