/**
 * SectionHeader — left-aligned eyebrow + tight headline + optional description.
 *
 * Replaces the centered `<h2>` + 20×1px underline-bar pattern that every
 * section was duplicating. The eye anchors on the left edge, so a
 * left-aligned header reads as more rigorous and less template-y than a
 * centered one. Numbered eyebrows ("Section 02 · Experience") imply order
 * and structure, which is exactly the tone a portfolio wants.
 */

type Props = {
  eyebrow: string
  title: string
  description?: string
  className?: string
}

export default function SectionHeader({ eyebrow, title, description, className = '' }: Props) {
  return (
    <div className={`mb-10 sm:mb-16 max-w-4xl ${className}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/50 mb-3">
        {eyebrow}
      </div>
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {description && (
        <p className="text-base sm:text-lg text-foreground/60 mt-3 leading-relaxed">
          {description}
        </p>
      )}
    </div>
  )
}
