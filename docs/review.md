---
title: Your guided review
description: Compare three priorities and inspect what the agents actually did.
---

<p class="eyebrow">Team 3 / Try it yourself / About 6 minutes</p>

# Let's review the upgraded demo

Keep this page next to Relay. We will change what matters to you and watch how the specialist responds.

## Start the app and guide

In the `a2a-demo` terminal:

```sh
npm start
```

Open [Relay at http://127.0.0.1:8780](http://127.0.0.1:8780). To open this guide in a second terminal:

```sh
npm run docs:dev
```

The guide is at [http://127.0.0.1:5173](http://127.0.0.1:5173). A fresh checkout needs `npm ci` first. Stop each server with Ctrl+C. Restart the demo after source or `.env` changes, then refresh the browser.

## Experiment 1 / Is the extra spend worthwhile?

Choose **Discuss the trade-off**. This sets AED 1,400 preferred, AED 1,600 maximum, and leaves the priority for clarification. Keep 30 people, projector, and step-free access.

Start with **Rehearsal** to learn the controls. Click **Start the handoff**.

The specialist consults the catalogue and asks what matters most. The three suitable venues appear below the conversation. Choose **Separate breakout rooms**, then **Send answer**.

In rehearsal, expect **Harbor Hall at AED 1,550**: two enclosed breakout rooms, AED 150 above the preferred budget, and AED 50 below the hard limit. The trade-off is higher cost and moderate background noise in the main hall.

Read both the **specialist explanation** and **coordinator review**. They represent different responsibilities.

### Inspect the actual exchange

Open **Protocol inspector** and look for:

| Evidence                              | Meaning                                                             |
| ------------------------------------- | ------------------------------------------------------------------- |
| Agent Card response                   | The coordinator discovered the declared skill and endpoint.         |
| First `SendMessage`                   | The brief crossed the A2A boundary.                                 |
| `GetTask` and input-required          | The specialist paused for your preference.                          |
| Reply with the same task/context IDs  | The answer continued the existing work.                             |
| Completed task and artifact           | The specialist returned structured output.                          |
| A second task, if a revision occurred | The coordinator asked for reconsideration in the same conversation. |

A revision is optional and can occur only in live mode. Rehearsal does not manufacture one. You can download the result JSON; it includes the checked venue and the coordinator's review.

## Experiment 2 / Change your priority

Start a **New run**, choose **Prioritize a quiet room**, and start the handoff again. With a known priority, the specialist should not ask the same question unnecessarily.

In rehearsal, expect **Cedar Room at AED 1,350**. It is quieter and stays within the preferred budget, but has no separate breakout rooms.

Now try **Keep the cost down**. Rehearsal selects **Canal Loft at AED 1,200**, accepting moderate noise and a shared room to save money.

These rehearsal choices come from explicit rules. In live mode, inspect how the model uses your free-text preferences, explains alternatives, and justifies its answer. Do not judge the demo by whether the model disagrees with the script.

## Experiment 3 / Test a hard boundary

Choose **A budget that cannot work**. It sets both budgets to AED 500. The specialist should reject the request because no venue satisfies the hard constraints. A preference never authorizes overspending.

You can also stop a run while it awaits clarification. It should become **Stopped** and produce no later approved recommendation.

## Use the real model

Open `.env` locally and set `OPENAI_API_KEY`. Keep `OPENAI_MODEL=gpt-4.1-mini` or choose a compatible model available to your account. Restart the server, then select **Live AI** before starting.

The key is loaded on the server. `.env` is plain text and ignored by Git; only the blank `.env.example` belongs on GitHub. Do not put credentials in notes, screenshots, or source files. OpenAI runs use API billing. Model connection in the sidebar remains an alternative for a session-only key or local Ollama.

For a terminal check of the real provider:

```sh
npm run test:live
```

It answers the preference question with **Separate breakout rooms**. Use `npm run test:live -- --quiet` for the quiet-room preference. Both commands make real, billable model calls. Ordinary `npm test` uses invented fixtures.

A configured connection alone does not prove a successful run. Check the final state, artifact, and coordinator approval. A provider error never silently switches to rehearsal.

## Your 30-second explanation

> "Several venues meet the hard requirements, so the specialist must understand what matters to the workshop. The coordinator delegates the goal over A2A. The specialist uses a catalogue tool, asks a clarification, and returns a recommendation with a trade-off. The coordinator checks the facts and explanation, and can request one revision. The important difference from a tool call is who owns the decisions needed to complete the work."

## Check your understanding

<details><summary>What is a hard constraint, and what is a preference?</summary>

Capacity, required facilities, and the maximum budget are enforced in code. Preferred spending, noise, and breakout rooms guide the choice among feasible venues. A preference cannot override a hard constraint.

</details>

<details><summary>Why can a revision have a different task ID?</summary>

Clarifications continue unfinished tasks. Once a task is completed, a revision is a new task in the same context with a reference to the earlier task. We do not reopen a completed task.

</details>

<details><summary>Does a different live answer automatically make it better?</summary>

No. Judge it against catalogue facts, your stated preferences, its explanation, and the coordinator review. Agreement with rehearsal can be correct; disagreement can be a mistake. A2A provides communication, not a correctness guarantee.

</details>

See [Architecture](./ARCHITECTURE) for the source map and [Validation](./VALIDATION) for actual observations.
