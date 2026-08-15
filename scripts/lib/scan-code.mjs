// Minimal JS/TS/JSX scanner: classifies every character as code, comment, or
// player-facing copy (string/template literal, or JSX text child). The em-dash
// gate and the sweep both use it, so they agree exactly on what counts as copy
// and neither trips over a dash in a comment or a box-drawing rule.

export const CODE = 0;
export const COMMENT = 1;
export const COPY = 2;

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
