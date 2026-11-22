# IncidentRoom

Real-time collaborative security incident investigation on
[DeepSpace](https://docs.deep.space) (SDK **0.44.2**). Live app:
[https://incidentroom.app.space/](https://incidentroom.app.space/).

Investigators can create and filter incidents, claim ownership, share notes on a
live timeline, and run **AI triage** with structured, evidence-grounded reports.
Demo rows are seeded as **synthetic** data (`DEMO-` IDs, `source: synthetic`).

## Architecture

| Layer | Role |
| --- | --- |
| React + TypeScript UI | Generouted routes, Base UI, ops-room theme |
| DeepSpace records | Durable Object collections with RBAC (`incidents`, `investigation-events`, `ai-analyses`, …) |
| Cloudflare Worker | Auth proxy, realtime WS, server actions, AI chat/tools |
| Server actions | Privileged orchestration (`analyzeIncident`, `reviewAiAnalysis`) via `POST /api/actions/:name` |

Phase coverage:

1. Persistent incidents, auth, filters, synthetic seed
2. Claim/release, notes, realtime collaboration, activity history
3. AI triage: deterministic indicators + Zod-validated LLM report + human review labels

## DeepSpace integrations

- **Records / realtime** - `RecordScope`, `useQuery`, `useMutations` (`*Confirmed` where needed)
- **Auth** - DeepSpace AuthGate / JWT; membership roles (`member` / `admin` / `viewer`)
- **Server actions** - RBAC bypass with `X-App-Action`; handlers must authorize using real records
- **AI** - `createDeepSpaceAI` + Vercel AI SDK `generateObject` (model `claude-haiku-5-5`)
- **Optional chat** - scaffold AI chat routes remain available; incident triage uses one-shot actions, not a multi-agent framework

## AI billing

Incident analysis **omits `authToken`** on `createDeepSpaceAI`, so the proxy uses
`APP_OWNER_JWT` and **bills the app owner**. Investigators do not need personal
DeepSpace AI credits for triage.

Mitigations: authenticated investigators only, input/output size caps, per-user and
per-incident rate limits, in-flight duplicate guards, clear provider/credit errors.
No OpenAI/Anthropic SDK keys are stored in app source; `.dev.vars` is gitignored.

## Local development

Requires a supported Node version (see `package.json` `engines`; prefer Node 24).

```sh
npm install
npx deepspace auth login
npx deepspace dev start
```

Then open the local Vite URL (typically `http://127.0.0.1:5173`), sign in, open
**Incidents**, optionally **Load demo incidents**, and use **Analyze with AI**.

Deploy:

```sh
npx deepspace deploy
```

## Tests

```sh
npm run type-check
npm run lint
npm run test:unit          # Vitest (src/**/*.test.ts)
npm run build
npx deepspace test run     # Playwright suites under tests/
```

Notable suites:

- Unit: indicators, Zod findings, analyze/review actions (mocked AI)
- `tests/api.spec.ts`, smoke, collab / incidents-collab
- Opt-in live AI: `INCIDENTROOM_LIVE_AI=1 npx deepspace test run ai-analysis.live`
  (consumes **app-owner** AI credits)

## Limitations

- Deterministic extractors cover a small set of synthetic patterns; unmatched text
  can still be analyzed by the LLM.
- AI hypotheses are not facts; review labels do not change incident status or ownership.
- In-flight analysis locks are best-effort per Worker isolate; persisted cool-downs
  are the durable backstop.
- `/api/debug/*` exists only when `ALLOW_DEBUG_ROUTES=true` and the caller is an
  app admin (local/test tooling).
- Synthetic demos are for walkthroughs only - not real security telemetry.
