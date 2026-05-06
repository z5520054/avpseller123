import type { ReactNode } from 'react'

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <div className="inline-flex rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.32em] text-white/42">
          {eyebrow}
        </div>
        <h2 className="mt-4 max-w-xl font-display text-[2rem] leading-tight text-sheen sm:text-4xl">
          {title}
        </h2>
        {description ? <p className="mt-3 max-w-xl text-sm leading-6 text-white/54">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
