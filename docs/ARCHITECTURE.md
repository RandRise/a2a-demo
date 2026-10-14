# Architecture

Relay runs two local HTTP services in one Node.js process: the coordinator and
browser app on port 8780, and the venue specialist on port 8781. Their task
exchange goes through HTTP and the official A2A SDK. The coordinator never calls
the specialist executor directly.

```text
Browser                  Coordinator                    Venue specialist
  |                          |                                 |
  |-- workshop brief ------->|-- GET Agent Card --------------->|
  |                          |<-- skills + endpoint -----------|
  |                          |-- A2A SendMessage -------------->|
  |                          |<-- task ID + context ID ---------|
  |                          |-- A2A GetTask ------------------>|
  |<-- priority question ------|<-- input-required ---------------|
  |-- priority answer -------->|-- SendMessage, same task ------->|
  |                          |                                 |-- catalogue tool
  |                          |-- GetTask --------------------->|
  |                          |<-- completed + artifact ---------|
  |                          |-- check constraints; review      |
  |<-- recommendation -------|                                 |
```

## Protocol scope

- **A2A 1.0**, official `@a2a-js/sdk` **1.3.0**, JSON-RPC over HTTP.
- Known-address discovery reads `/.well-known/agent-card.json`; no registry.
- The demo exercises `SendMessage`, `GetTask`, `CancelTask`, task/context
  identity, input-required continuation, returned artifacts, and one optional linked revision task.
- The SDK handles wire serialization, protocol errors, task storage and routing.
  Its internal numeric enums and `content.$case` objects are serialized into the
  actual JSON displayed in the inspector, including `ROLE_USER` and
  `TASK_STATE_*`. The inspector is not a handwritten protocol illustration.
- Streaming, push notifications, and extended cards are not advertised.
- The structured brief is application-specific data described in the skill.
  A2A standardizes communication; it does not guarantee another agent understands
  an arbitrary task schema or produces correct results.
- No conformance-suite certification or third-party/cross-company interoperability
  test is claimed. This is a local protocol demonstration.

## Decisions

The coordinator discovers the specialist, formulates the task, forwards the
user's clarification, and reviews the result. The specialist can ask for a
budget or priority, request its catalogue tool, recommend a venue, or reject an impossible
brief. Its live loop allows up to three decisions per turn. The two agents have
separate prompts; the specialist does not receive the coordinator's instructions.

The catalogue tool is a direct function call, **not a live MCP connection**.
Both agents can use the same model/provider; separate vendors are not required
to demonstrate the delegation boundary.

Rehearsal follows explicit rules: rank feasible venues by price, noise, or separate
rooms according to the selected priority. Free-text preferences affect live model
decisions; they are not semantically interpreted by rehearsal rules.
A short presentation pause separates its steps; no model is called. A2A requests
remain real. Live AI independently calls the model for delegation, specialist
decisions, and final review, with no scripted fallback. The review may accept, request one revision,
or reject. Revisions create a new task in the same context with referenceTaskIds;
completed tasks are never reopened. Clarifications preserve the existing task ID. Both modes validate the
recommendation against catalogue constraints. The UI displays a short public
explanation, not hidden reasoning.

## Budget and preference checks

`budget` is a hard ceiling. `preferredBudget` is an optional soft target. The brief
also carries `priority` (undecided/value/quiet/breakouts) and up to 600 characters
of free-text preferences. Old briefs without priority default to value.
A continuation may update only the field the specialist requested. Both agents
validate capacity, facilities, and price using the canonical catalogue.

`budget-review.mjs` computes budget relations and screens public explanations for
a narrow class of contradictory above/below-preferred-budget claims. A detected
contradiction triggers the same bounded revision mechanism, labelled as a code
budget check in the conversation. This is not a general semantic fact checker;
sentences naming alternative venues are skipped to avoid false attribution.
The final display calculates the budget stretch and hard-limit headroom in code.
Model review is an additional judgment, not a correctness guarantee.

The status API exposes the latest run ID so a reload can restore a completed run
as well as a paused one. Credentials remain excluded from these responses.

## Source map

| Location                     | Responsibility                                         |
| ---------------------------- | ------------------------------------------------------ |
| `src/server.mjs`             | Startup, environment options, shutdown                 |
| `src/app.mjs`                | Compose the two services and HTTP routes               |
| `src/http/`                  | Loopback host/origin checks and browser headers        |
| `src/protocol/`              | Agent Card and SDK message helpers                     |
| `src/agents/coordinator.mjs` | Discovery, delegation, polling, continuation, review   |
| `src/agents/specialist.mjs`  | Specialist decisions, tool use, task updates, artifact |
| `src/agents/prompts.mjs`     | Separate live role instructions                        |
| `src/ai/`                    | Provider adapters, structured output, safe errors      |
| `src/domain/`                | Invented catalogue and constraint checks               |
| `public/js/`                 | Browser events, rendering, connection controls         |
| `public/styles/`             | Layout, responsive rules, component styles             |
| `test/`                      | Domain, provider-fixture, and local HTTP tests         |
| `scripts/browser-check.mjs`  | Headless walkthrough and accessibility audit           |

## Explanation website

VitePress serves the learning material separately from the running agents.
`docs/index.md` presents the lesson; `docs/review.md` guides the app review.
The theme and two teaching components live in `docs/.vitepress/theme/`.
The illustrated handoff and quiz run only in the browser and make no agent calls.

`npm run docs:dev` starts the guide on loopback port 5173.
`npm run docs:build` generates the static site in ignored
`docs/.vitepress/dist/`. `npm run docs:preview` serves that build.
`npm run test:docs` checks a running guide, using isolated headless Chrome.

VitePress is pinned to 1.6.4 for compatibility with the installed Node 20 runtime.
Its Vite dependency is overridden to patched 6.4.3; the Vue plugin supports Vite 6.
Vue is pinned to 3.5.44. Build and browser validation cover this combination.

## Application boundaries

Single local operator; no public hosting or user accounts. Static serving is
limited to `public`. Model keys never enter A2A messages, trace downloads or
browser storage. The UI clears the key input after submission/closing. The server
optionally loads the ignored project `.env` through `src/config/environment.mjs`
using Node's built-in loader; existing shell variables take precedence.
Keys entered in the UI are never written to that file. Disconnect clears active
connection settings but does not erase `.env` or shell variables; restart loads
them again. The file is plain text and must never be committed or archived.
Only the blank `.env.example` is shareable. No request logger records keys.

Only one active coordinator run is allowed. Runs and tasks are in memory and
lost on restart. Up to 50 coordinator runs are retained; the SDK's task store
lasts for the process lifetime. Restart between long teaching sessions to clear
all state. There is no durable queue or automatic model retry. Production use
would need authentication, authorization, durable state and operational controls.
