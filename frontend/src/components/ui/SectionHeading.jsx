export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
}) {
  const alignment = align === 'center' ? 'mx-auto text-center' : 'text-left'

  return (
    <div className={`max-w-2xl ${alignment}`}>
      {eyebrow ? (
        <p className="mb-tight font-mono text-xs uppercase tracking-[0.2em] text-muted">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-serif text-3xl tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-stack text-muted">{description}</p>
      ) : null}
    </div>
  )
}
