# Link preview card (`og-image.png`)

The share card is the first thing anyone sees in a link preview, and for a
product whose growth loop is "play, share, sign up" it is load-bearing.

## Why PNG and not SVG

X, LinkedIn, iMessage, Slack and Discord do not render SVG link previews. An
SVG in `og:image` produces a blank card everywhere that matters. `og:image`
must point at the **PNG**; the SVG is kept only as the editable source.

## Why the URL is absolute and matches the live host

Crawlers do not resolve relative `og:image` paths reliably, and an absolute URL
on a host that does not serve the asset fails silently. The game is served from
`game.refi.trading`, so every absolute URL in `index.html` must use that origin.

`game.refi.trading` is also the CORS allow-origin the mint-handoff service
expects (`infra/terraform/variables.tf` → `allowed_origin`, and the fallback in
`services/handoff/src/server.ts`). If the game's origin and that value drift
apart, the handoff fails at runtime with a CORS error rather than a visible
one — keep them in step.

## Regenerating the PNG

Edit `public/og-image.svg`, then re-render. On macOS, with no extra tooling:

```sh
qlmanage -t -s 1200 -o /tmp/og public/og-image.svg
cp /tmp/og/og-image.svg.png public/og-image.png
sips --cropToHeightWidth 630 1200 public/og-image.png
sips -g pixelWidth -g pixelHeight public/og-image.png   # must be 1200 x 630
```

Two constraints that are easy to break:

- **Keep `viewBox` only — do not add `width`/`height` attributes to the `<svg>`.**
  Quick Look scales the two cases differently; with width/height present the
  crop lands on a zoomed portion of the design.
- **Keep the two footer lines short.** JetBrains Mono is not installed on most
  machines, so the renderer falls back to a wider monospace face. The previous
  card overflowed the canvas and truncated "NOT INVESTMENT ADVICE" to "NOT
  INVESTMENT" in the rendered PNG.

Commit the regenerated PNG — it is a build input, not a build artifact.

## Verifying a change

Deploy first: crawlers fetch the live URL, never your branch.

1. https://cards-dev.twitter.com/validator — card renders, not blank
2. https://www.linkedin.com/post-inspector/ — use "Inspect" to bust their cache
3. https://developers.facebook.com/tools/debug/ — "Scrape Again"
4. Paste the link into Slack and iMessage — the two that fail most quietly
5. `curl -sI https://game.refi.trading/og-image.png | head -3` — expect
   `200` and `content-type: image/png`

Caches are sticky. If a stale blank card persists after a fix, force a re-scrape
in each tool above rather than assuming the fix did not land.
