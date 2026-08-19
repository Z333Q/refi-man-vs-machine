/**
 * The build this page was served from.
 *
 * A tester could not tell which build they were looking at, and neither could
 * we: Vercel preview URLs are pinned to one deployment while the production
 * alias tracks main, so "it's broken on the vercel link" did not say whether
 * the bug was already fixed. This makes a screenshot self-identifying.
 *
 * Laid out inline rather than as a fixed overlay. The first version pinned it
 * to the bottom-right corner, where it sat on top of the DECIDE button on a
 * phone — the same overlap defect being fixed everywhere else in this screen,
 * introduced by the very thing meant to help report it. It now sits in a bar
 * and takes part in the flex flow, so it can never cover anything.
 */
export default function BuildStamp({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-mono text-phosphor-dim/50 tracking-widest whitespace-nowrap select-none ${className}`}
      style={{ fontSize: '9px' }}
      title={`BUILD ${__BUILD_SHA__} · ${__BUILD_TIME__} UTC`}
    >
      BUILD {__BUILD_SHA__}
    </span>
  );
}
