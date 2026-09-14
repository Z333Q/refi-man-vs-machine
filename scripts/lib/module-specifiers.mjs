// Every literal module specifier in a source file, whatever syntax loaded it.
//
// Written because a boundary gate that only understands `from '...'` is a
// boundary with a hole in it. A side-effect import loads a module just as
// completely as a named one:
//
//   import '../../../src/lib/persistence';   // no `from`, same coupling
//
// and the one place that form actually appears in this repository is exactly
// the interesting one: arenaIndex registers five arena modules for their side
// effects alone. A rule that cannot see that syntax cannot police it.
//
// Deliberately regex over a parser. The forms below are the complete set a
// TypeScript ESM file can use with a literal specifier, and a gate that needs
// a parser to stay correct is a gate that goes wrong quietly and expensively.
// A computed specifier (import(someVariable)) is not literal and not
// detectable here by any means short of evaluation; the gate says so rather
// than implying coverage it does not have.

const PATTERNS = [
  // import x from '…'  ·  import type X from '…'  ·  export … from '…'
  // Also covers `export * from` and `export type { X } from`.
  /\bfrom\s*['"]([^'"]+)['"]/g,
  // import '…'  — side effect only, no bindings.
  /\bimport\s+['"]([^'"]+)['"]/g,
  // import('…')  — literal dynamic import, with or without await.
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // require('…')  — not used in this ESM repository, caught anyway: a file
  // that starts using it has left the module system the boundary assumes.
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/**
 * @param {string} source  Source with comments already blanked, newlines kept.
 * @returns {{spec: string, line: number}[]} one entry per specifier, in file order.
 */
export function moduleSpecifiers(source) {
  const found = [];
  const seen = new Set();
  source.split('\n').forEach((line, i) => {
    for (const pattern of PATTERNS) {
      pattern.lastIndex = 0;
      for (const m of line.matchAll(pattern)) {
        // `import x from 'y'` matches both the from-pattern and, in some
        // spacings, nothing else; de-duplicate by position so one import is
        // reported once.
        const key = `${String(i)}:${String(m.index ?? 0)}:${m[1]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ spec: m[1], line: i + 1 });
      }
    }
  });
  return found.sort((a, b) => a.line - b.line);
}
