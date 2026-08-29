const variants = {
  primary:
    'bg-brand text-white hover:text-white hover:opacity-90',
  secondary:
    'border border-border bg-surface text-ink hover:text-ink hover:border-ink/20',
  ghost: 'text-ink hover:text-brand',
}

export default function Button({
  variant = 'primary',
  href,
  className = '',
  children,
  ...props
}) {
  const classes = `inline-flex items-center justify-center rounded-control px-4 py-2.5 text-sm font-medium transition-standard ${variants[variant]} ${className}`

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    )
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  )
}
