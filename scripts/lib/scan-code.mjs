// Minimal JS/TS/JSX scanner: classifies every character as code, comment, or
// player-facing copy (string/template literal, or JSX text child). The em-dash
// gate and the sweep both use it, so they agree exactly on what counts as copy
// and neither trips over a dash in a comment or a box-drawing rule.

export const CODE = 0;
export const COMMENT = 1;
export const COPY = 2;

/**
 * Whether an unescaped matching quote appears before the end of this line.
 *
 * This is what separates a real string literal from an apostrophe sitting in
 * JSX text, and it is a language rule rather than a heuristic: a single- or
 * double-quoted string cannot contain a raw line terminator.
 */
/**
 * Whether this apostrophe is inside a word, as in TODAY'S or don't.
 *
 * Also a language rule rather than a guess: a string delimiter can never sit
 * directly between two word characters, because no ECMAScript production puts
 * an identifier immediately before an opening quote or immediately after a
 * closing one. So a quote in that position is always an apostrophe, and this
 * holds even when two of them appear on the same line and would otherwise
 * pair with each other.
 */
function isWordApostrophe(src, i) {
  if (src[i] !== "'") return false;
  const before = src[i - 1] ?? '';
  const after = src[i + 1] ?? '';
  return /\w/.test(before) && /\w/.test(after);
}

function closesOnSameLine(src, start, quote) {
  for (let j = start + 1; j < src.length; j++) {
    const ch = src[j];
    if (ch === '\n') return false;
    if (ch === '\\') { j++; continue; }
    if (ch === quote) return true;
  }
  return false;
}

export function classify(src) {
  const kind = new Uint8Array(src.length);
  const n = src.length;
  let i = 0;

  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') kind[i++] = COMMENT;
      continue;
    }

    if (c === '/' && c2 === '*') {
      kind[i++] = COMMENT;
      kind[i++] = COMMENT;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) kind[i++] = COMMENT;
      if (i < n) { kind[i++] = COMMENT; kind[i++] = COMMENT; }
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      const quote = c;

      // A quote only opens a string literal if it actually closes as one.
      //
      // ECMAScript forbids an unescaped line terminator inside a single- or
      // double-quoted string, so a quote with no unescaped partner before the
      // end of its line cannot be opening a literal. In JSX text it is an
      // apostrophe: TODAY'S SIGNAL. Treating it as a delimiter opened a
      // phantom string that ran to the next quote anywhere later in the file,
      // which silently reclassified whole regions, including comments, as
      // player copy.
      //
      // Backticks are exempt from the check: template literals may legally
      // span lines, so a backtick always opens.
      if (isWordApostrophe(src, i) || (quote !== '`' && !closesOnSameLine(src, i, quote))) {
        kind[i++] = CODE;
        continue;
      }

      kind[i++] = COPY;
      while (i < n) {
        if (src[i] === '\\') {
          kind[i++] = COPY;
          if (i < n) kind[i++] = COPY;
          continue;
        }
        const done = src[i] === quote;
        kind[i++] = COPY;
        if (done) break;
      }
      continue;
    }

    kind[i++] = CODE;
  }

  // JSX text children are player-facing but are not string literals: anything
  // between a closing > and the next < or { that the pass above left as code.
  for (let j = 0; j < n; j++) {
    if (kind[j] !== CODE || src[j] !== '>') continue;
    let k = j + 1;
    while (k < n && kind[k] === CODE && src[k] !== '<' && src[k] !== '{') {
      kind[k] = COPY;
      k++;
    }
  }

  return kind;
}

/** Every line index (1-based) where a character of `needle` sits in copy. */
export function findInCopy(src, needle) {
  const kind = classify(src);
  const hits = [];
  let line = 1;
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '\n') { line++; continue; }
    if (src[i] === needle && kind[i] === COPY) {
      const start = src.lastIndexOf('\n', i) + 1;
      let end = src.indexOf('\n', i);
      if (end === -1) end = src.length;
      hits.push({ line, text: src.slice(start, end).trim() });
    }
  }
  return hits;
}
