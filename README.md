# proactive-realtime-sla-tracking

Track whether we're meeting, at risk of missing, or breaching each partner's SLA

A small, dependency-light **realtime SLA tracker**. It watches each partner's
support commitments and continuously classifies them as **on track**, **at
risk**, **breaching**, **met**, or **breached**, so the team can act *before* an
SLA is missed. A live dashboard streams updates over Server-Sent Events (SSE),
and an in-memory simulation keeps the board moving so you can see it working
immediately.

## What it does

- Evaluates every commitment against its resolution budget in real time.
- Surfaces a color-coded summary (on track / at risk / breaching / met /
  breached) plus a per-commitment card with a progress bar and countdown.
- Streams changes to the browser instantly via SSE — no polling.
- Lets you resolve a commitment or open a new one through a small JSON API.

## Quickstart

```bash
npm install       # install dependencies
npm run dev       # start the dev server (tsx watch) on http://localhost:3000
npm test          # run the unit tests (vitest)
npm run build     # type-check + compile to dist/
npm start         # run the compiled server from dist/
```

The dashboard is served at [http://localhost:3000](http://localhost:3000).
Set `PORT` and `HOST` to override the defaults (`3000` / `0.0.0.0`).

## API

| Method | Path                             | Description                                             |
| ------ | -------------------------------- | ------------------------------------------------------- |
| GET    | `/`                              | The dashboard UI (static HTML/CSS/JS).                  |
| GET    | `/api/state`                     | Current snapshot: partners, evaluated commitments, counts. |
| GET    | `/api/stream`                    | SSE stream; emits a snapshot on connect and on change.  |
| POST   | `/api/commitments`               | Open a new commitment (JSON body, all fields optional). |
| POST   | `/api/commitments/:id/resolve`   | Mark a commitment resolved; returns the new snapshot.   |

Example bodies for `POST /api/commitments`:

```json
{ "partnerId": "acme", "subject": "Login errors", "priority": "P1", "targetMinutes": 30 }
```

## SLA status model

Each commitment has an `openedAt` time and a `targetMinutes` resolution budget,
giving a `deadline = openedAt + targetMinutes`. The `AT_RISK_THRESHOLD` (75%)
controls when an open commitment is flagged early.

| Status      | Meaning                                                            |
| ----------- | ----------------------------------------------------------------- |
| `on_track`  | Open and less than 75% of the budget consumed.                    |
| `at_risk`   | Open, ≥ 75% of the budget consumed, deadline not yet passed.      |
| `breaching` | Open and past the deadline (actively missing SLA).               |
| `met`       | Resolved on or before the deadline.                              |
| `breached`  | Resolved after the deadline.                                     |

The evaluation logic lives in `src/sla.ts` as pure, unit-tested functions
(`evaluateSla`, `summarize`, `buildSnapshot`).

## Project layout

```
src/
  types.ts    domain types
  sla.ts      pure SLA evaluation + snapshot building
  store.ts    in-memory store + realtime simulation (tick)
  server.ts   Express server: static UI, JSON API, SSE stream
public/       vanilla dashboard (index.html, styles.css, app.js)
test/         vitest unit tests
```

## Cloud Agent environment

The Cloud Agent environment is configured in
[`.cursor/environment.json`](.cursor/environment.json) using Cursor's default
image (no Dockerfile required):

- **install**: `npm ci` — installs dependencies from the committed
  `package-lock.json`.
- **terminals**: a long-running `dev-server` terminal runs `npm run serve`
  (the `tsx` server) so the dashboard is always up and its logs are visible.
- **ports**: exposes port `3000` (the web dashboard).

Because the app is pure TypeScript/Node with vanilla front-end assets (no CDN
dependencies), it runs fully offline in the agent environment.
