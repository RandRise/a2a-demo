# Validation — 13 October 2026

## Actual local A2A HTTP tests

The tests start two services on temporary loopback ports and use the official
A2A SDK client/server over real HTTP. These are not mocked HTTP responses.

- Agent Card discovery returns the specialist's identity, skill and endpoint.
- `SendMessage` creates a task; `GetTask` observes input-required.
- A budget reply continues the **same task ID and context ID**.
- The task completes with a real artifact; the coordinator checks the result.
- A complete brief skips clarification. AED 500 produces a rejected task and
  no recommendation.
- `CancelTask` works for a task waiting for input and while the specialist is
  working. A late operation cannot overwrite the canceled coordinator run.
- A finished task cannot receive another budget reply through the demo API.

The agent decisions in these protocol checks are scripted or injected fixtures.
This verifies local A2A transport/task behavior, not live model reasoning.

## Automated code and fixture checks

`npm test`: **9 test cases passed**, with assertions covering the HTTP scenarios
above, constraint validation, invalid briefs, forged recommendations, unavailable
live mode, provider failures without fallback, safe error messages, and key
exclusion from returned application data. Cross-origin requests are refused and
server source/configuration files are not publicly served.

The injected model flow exercises separate delegation, clarification, tool
selection, recommendation and review decisions. The provider adapter test checks
the OpenAI Responses request shape, JSON schema, `store: false`, and error handling.
Neither is a live OpenAI provider test.

All application/test JavaScript passed Node syntax checks. Formatting is managed
by pinned Prettier and verified with `npm run format:check`.

## Actual browser checks

Headless installed Chrome rendered and operated the real application against
the two running local services. A separate temporary browser profile was used.

- Complete missing-budget workflow through the actual browser controls.
- Reloading while paused restores the same pending task without browser storage.
- Expected Canal Loft result; inspector displays actual card/task data.
- Recommendation download triggers with the intended JSON filename.
- Impossible budget shows rejection without a result card.
- Explanation and all five catalogue entries render.
- Closing the connection dialog clears its key field.
- No horizontal overflow at 1024, 768, 390, or 320 pixels.
- No browser JavaScript exceptions during the walkthrough.

Axe reported **zero automated WCAG A/AA violations** in seven checked views/states:
desktop ready, clarification, completed result, explanation, catalogue, connection
dialog, and mobile ready. This is an automated check, not accessibility certification.
Desktop, completed-result, guide, and mobile screenshots were visually inspected.
Screenshots and machine-readable audit results are in ignored `.qa/`.

The in-app browser automation failed at startup because of the Windows sandbox;
the headless Chrome checks above succeeded independently.

## Runtime dependency audit

`npm audit --omit=dev`: **0 known vulnerabilities** reported in installed runtime
dependencies on this date. This is a registry advisory check, not a security audit.

## VitePress explanation website

The local guide was built with `npm run docs:build` and checked in installed
headless Chrome with `npm run test:docs` against its production preview.

- All six handoff illustration steps, direct step selection, and replay worked.
- Each of the three quiz answers displayed its corresponding explanation.
- Review disclosures and all three reference pages opened successfully.
- No horizontal overflow at 1440, 768, 390, or 320 pixels.
- Four automated Axe WCAG A/AA audits passed: explanation and review pages,
  each at desktop and mobile widths. This is not accessibility certification.
- No browser JavaScript exceptions occurred during the checked walkthrough.
- Desktop and mobile screenshots were visually reviewed. Evidence is in ignored
  `.qa/docs-*.png`, `.qa/docs-browser-checks.json`, and `.qa/docs-accessibility.json`.

The original nine demo tests passed after the dependency additions. The updated
dependency installation reported zero known vulnerabilities, including dev tools.
The illustrations and quiz make no live agent or model calls.

## Local environment setup — 14 October 2026

The user authorized an ignored local `.env` for OpenAI credentials. The shareable
`.env.example` has an empty key. Git checks confirmed `.env` is ignored by the
demo folder's own `.gitignore` and is not tracked; the example remains eligible
for version control.

`npm test`: **12 test cases passed** after adding environment configuration.
The three new tests use invented markers and verify optional file loading,
quoted values, shell-variable precedence, blank/invalid configuration, and actual
CLI startup from another working directory. The startup check confirms that
status responses and stdout exclude the marker, and that private environment
and source paths return 404. No live provider requests were made by these tests.

`npm run test:live` is a separate, explicit provider check. It calls OpenAI using
local credentials and API billing, expects clarification, supplies AED 1400,
and verifies same-task continuation plus a completed recommendation artifact.
It does not save credentials, raw responses, or a claimed validation result.
No successful execution of this standalone command has been recorded yet.

## Observed live OpenAI run — 14 October 2026

Read-only inspection of the running specialist through A2A `ListTasks` and
`GetTask` found a live-mode task ending at **12:28:57 UTC (16:28:57 Dubai)**.
The running application's connection status reported OpenAI with `gpt-4.1-mini`.
This is an observed application run, separate from fixture tests.

- The coordinator delegated a 30-person workshop brief with no initial budget.
- The specialist asked for the venue budget.
- The user's AED 200 reply continued the same task and context identifiers.
- The specialist used `lookupVenues` to compare all five fictional venues.
- The task ended in `TASK_STATE_REJECTED`, explaining that every venue exceeded
  the budget. No artifact was returned, as expected for this outcome.
- Independent inspection of the catalogue confirmed the least expensive venue
  meeting capacity, projector, and access requirements is Canal Loft at AED 1200.

This verifies live delegation, clarification, continuation, tool use, and correct
budget rejection. It does **not** verify the live recommendation-artifact and
coordinator-acceptance path. The separate completed Canal Loft task retained by
the server was explicitly marked rehearsal, so it is not live-provider evidence.
The review made no new model requests and did not read credentials or save raw
task payloads. The coordinator's final browser display was not independently read.

## Preference-based upgrade — 14 October 2026

The catalogue now has six venues. Three meet the default 30-person brief and
AED 1600 hard ceiling: Canal Loft (AED 1200, moderate noise, no separate rooms),
Cedar Room (AED 1350, low noise, no separate rooms), and Harbor Hall (AED 1550,
moderate noise, two enclosed breakout rooms). Earlier five-venue observations
above describe the earlier version and are retained as history.

### Actual OpenAI observations

The explicit live-check command loaded the local configuration without displaying
credentials and ran isolated HTTP services with real model calls.

- **Breakout-room priority:** the model asked for the priority, received the
  answer on the same task, and returned Harbor Hall at AED 1550. Its explanation
  compared cheaper alternatives, justified the AED 150 stretch, and noted the
  noise sacrifice. The coordinator accepted. An artifact was returned.
- **Initial quiet-room attempt:** Cedar Room was selected at AED 1350, but both
  model explanations wrongly described this as above the AED 1400 preferred
  budget. The protocol completed, but manual review caught a factual error.
  This attempt is not counted as a fully correct end-to-end explanation.
- **Quiet-room recheck after the fix:** Cedar Room was selected again. The
  specialist explained the quiet-versus-breakout-room trade-off, and the
  coordinator correctly stated the price was below both budgets, with AED 250
  hard-limit headroom. It accepted the recommendation and returned an artifact.

Neither correct live run requested a revision. There is no claim that a live
model spontaneously demonstrated negotiation during these observations.
The fix supplies explicit calculated budget facts to the reviewer and screens
for a narrow class of contradictory budget-direction statements. It is not a
general fact checker or a guarantee against future model mistakes.

### Automated checks for this version

`npm test`: **19 test cases passed**. Syntax, formatting, and the VitePress
production build passed. The updated guide passed its interactive browser checks
and four automated accessibility audits in desktop and mobile views.

The fixture suite covers preferred versus hard budget, distinct rehearsal
priorities, two consecutive clarifications on one task, immutable constraints,
an actual new A2A task linked to the earlier completed task after model-fixture
review feedback, a one-revision limit, and correction of the observed arithmetic
error. Revision tests use invented model decisions, not live provider responses.

Chrome browser checks exercised the new priority question, three-option comparison,
Harbor Hall result, budget-stretch display, coordinator review, result download,
six-venue catalogue, rejection, and refresh recovery. Responsive checks covered
1024, 768, 390, and 320 pixels. Automated accessibility checks passed in the
tested app states. These checks do not certify accessibility.

## Presentation and clarification layout — 14 October 2026

The clarification submit button now keeps its natural width and a 44-pixel
minimum height instead of stretching beside the priority label and input.
Targeted Chrome checks verified its size at 1440, 768, 390 and 320 pixels,
and submitting the answer still completed the same rehearsal task.

The new 16-slide browser presentation was rendered and visually reviewed.
All slides fit the desktop canvas and avoided horizontal overflow at 390 pixels.
Keyboard navigation, slide selection, speaker notes, direct offline opening,
and print visibility for all 16 slides passed. An automated WCAG A/AA check
passed on the tested presentation view. This does not certify accessibility
or verify a PowerPoint export; the deliverable is an HTML slide deck.

All 19 Node tests, the main browser checks, syntax checks, formatting and
the VitePress production build passed again. These release checks used
rehearsal and fixtures; they made no new live provider calls.

## Not yet verified

- A live model-requested revision has not been observed; linked revision behavior
  is covered with injected model fixtures. Live recommendation and coordinator
  acceptance were observed for both priorities as described above.
- No live Ollama run has been observed.
- No separate-company agent, public deployment, auth federation, or A2A
  conformance-suite test. The demo uses A2A 1.0 JSON-RPC in one local runtime.
- No live MCP server. The catalogue function is a direct local tool call.
- No macOS/Safari run or physical classroom/projector rehearsal.
- No real venue availability, booking, or payment. All catalogue data is invented.

Repeat `npm test`, `npm run check`, `npm run format:check`, and
`npm run test:browser` after changing the implementation. Record future live
provider observations separately, without saving API keys or raw credentials.
