# refi-man-vs-machine

**ReFi Alpha (Man vs Machine)** — a historical U.S. equity strategy game and marketing property of ReFi Trading Inc.

Vite + React + Supabase SPA. Historical arenas only; no current-market recommendations, no forward-looking signals, no brokerage. Deployed at `play.refi.trading`.

## Specifications

- **Product & game design:** [`CLAUDE.md`](./CLAUDE.md) — the 4,991-line authoritative spec.
- **USA build order, security, compliance, and integration seam with the investor product:** [`refi-alpha-usa-build-integration-spec.md`](../refi-alpha-usa-build-integration-spec.md) (governs where it conflicts with CLAUDE.md).

## Development

```sh
npm install
npm run dev          # Vite dev server
npm run typecheck    # tsc --noEmit
npm run lint
npm run build
```

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (git-ignored). Supabase migrations live in `supabase/migrations/`.

## Related

- Investor product (Next.js BFF, SEC internet-adviser surface): [`ReFi-Trading-Inc/refi-us-sec-ia`](https://github.com/ReFi-Trading-Inc/refi-us-sec-ia)
