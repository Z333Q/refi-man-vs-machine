import { RESULT_CATEGORY, type ResultCategory } from '../lib/resultCategories';

// Marketing-integrity badge (§62 / §3.4 gate 1). Render this on any
// component that shows a performance number so the result category is
// never ambiguous. The `category` prop is a typed key, and the CI
// label gate greps for `ResultCategoryLabel category="..."` — so the
// prop must be a plain string literal, not a computed expression.

interface Props {
  category: ResultCategory;
  className?: string;
}

export function ResultCategoryLabel({ category, className = '' }: Props) {
  return (
    <div
      role="note"
      aria-label={`Result category: ${RESULT_CATEGORY[category]}`}
      className={`inline-block border border-alert-amber/30 bg-alert-amber/5 text-alert-amber font-mono tracking-widest px-2 py-0.5 ${className}`}
      style={{ fontSize: '9px', letterSpacing: '0.12em' }}
    >
      {RESULT_CATEGORY[category]}
    </div>
  );
}
