---
title: Let me explain the demo
description: Follow a real choice, a clarification, and a checked result between two agents.
---

<p class="eyebrow">Team 3 / Your final course task / Start here</p>

# How does one agent ask another for help?

<p class="intro-deck">You want a workshop venue. Several places fit. One is cheaper, one is quieter, and one has separate rooms for group discussions. How should an agent choose?</p>

The app is **Relay**. A coordinator delegates venue selection to a specialist over A2A. The specialist investigates the options, asks what matters most, and explains a recommendation. The coordinator reviews that explanation before presenting it to you.

<div class="opening">

**The lesson is who owns the work.** A tool returns catalogue facts. The specialist uses those facts to pursue a goal, handle uncertainty, and explain a trade-off. A2A carries the messages between agents.

</div>

## 01 / Give the specialist a meaningful choice

Here is our workshop brief:

> "Find a venue for 30 people, with a projector and step-free access. Prefer AED 1,400, but spend up to AED 1,600 if the benefit is worthwhile. Small-group discussions matter more than a prestigious location."

The **preferred budget** is a target. The **hard spending limit** is an absolute constraint. The agents cannot raise it. They can explain why a benefit merits spending between those two amounts.

Three of the six fictional venues meet the hard requirements:

| Venue       | Cost      | Noise    | Separate breakout rooms | The trade-off                                             |
| ----------- | --------- | -------- | ----------------------- | --------------------------------------------------------- |
| Canal Loft  | AED 1,200 | Moderate | 0                       | Save money; groups share one open room.                   |
| Cedar Room  | AED 1,350 | Low      | 0                       | Quieter discussion; groups still share a room.            |
| Harbor Hall | AED 1,550 | Moderate | 2                       | Separate discussions; AED 150 above the preferred budget. |

There is no single winner until we know how you value those differences. The other three venues illustrate hard exclusions: insufficient seats, no projector, or no step-free access.

<div class="cast">
<article><span class="eyebrow">Agent 01</span><h3>The coordinator</h3><p>Owns your outcome. Delegates the brief, relays clarification, checks hard constraints, and reviews whether the specialist justified its recommendation.</p></article>
<article><span class="eyebrow">Agent 02</span><h3>The venue specialist</h3><p>Owns the comparison. Uses its catalogue tool, asks what matters most, chooses a suitable venue, and explains the benefit and sacrifice.</p></article>
</div>

## 02 / Walk through the handoff with me

Press **Next step**. Notice when responsibility moves between agents and when the specialist uses a tool.

<HandoffWalkthrough />

This is an **illustration**, not a live run. Relay's protocol inspector shows the actual local HTTP exchange. Rehearsal and live AI both use that real A2A transport.

## 03 / What is A2A doing here?

A2A provides shared communication rules. It does not supply the intelligence or guarantee a good recommendation.

| Term       | What it means in our demo                                        |
| ---------- | ---------------------------------------------------------------- |
| Agent Card | The specialist's declared skill and communication endpoint.      |
| Message    | A request or reply, including text and structured workshop data. |
| Task       | A tracked piece of work with an ID and status.                   |
| Context    | The conversation grouping that related tasks and messages share. |
| Artifact   | The structured venue recommendation returned by the specialist.  |

The coordinator starts with a **configured local address** and reads the Agent Card. It does not search the whole internet for an agent. Other discovery arrangements are possible; see the [A2A discovery reference](https://a2a-protocol.org/latest/topics/agent-discovery/).

We use the official JavaScript SDK **1.3.0**, speaking **A2A 1.0 JSON-RPC**. Two HTTP services run in one Node process. This demonstrates the communication pattern; cross-company interoperability has not been tested.

## 04 / Where is the difference from a tool call?

Compare these two requests:

| Calling a tool                                              | Delegating to an agent                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| "Return venue facts and unmet requirements."                | "Find a venue that serves this workshop and explain the trade-off." |
| The caller interprets the returned facts.                   | The specialist manages the permitted steps toward the goal.         |
| Our `lookupVenues()` function performs a defined operation. | The specialist may ask, look up, recommend, or reject.              |

**MCP** standardizes access to tools and context. An A2A specialist could use an MCP-connected catalogue. In our app the catalogue is a **direct local function**, so no live MCP server is involved. [MCP architecture reference](https://modelcontextprotocol.io/docs/learn/architecture).

A tool can contain AI, and an agent can follow rules. The useful distinction is the responsibility exposed by the interface, not whether one of them sounds more conversational.

## 05 / What happens when the coordinator disagrees?

A technically valid venue can still be poorly justified. Suppose you prioritize quiet, but the specialist chooses Canal Loft only because it is cheaper.

The live coordinator can ask it to reconsider Cedar Room. The specialist receives that feedback over A2A, compares again, and returns another recommendation. It may change its choice or substantively defend it.

There is an important protocol detail: **a completed task is terminal**. Clarifications continue the same unfinished task; a review revision creates a **new task in the same context**, with a reference to the earlier task. The inspector exposes those identifiers.

We allow **one revision**. If the review is still unresolved, the coordinator reports that it did not approve the recommendation. It does not loop forever or present an unapproved result as successful.

The app calculates the budget differences in code and checks for a narrow class
of contradictory budget statements. A correction from that check is labelled as
a **budget check**, not presented as a model decision. Other factual errors are
still possible; a second model is not a guarantee of correctness.

**Disagreement is not forced.** A sound first recommendation can be accepted immediately. Both agents choosing the same venue is perfectly valid.

## 06 / What does live AI add here?

|                      | Rehearsal                                           | Live AI                                                            |
| -------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| How choices are made | Explicit rules rank cost, noise, or breakout rooms. | A model interprets the preferences and compares the facts.         |
| Clarification        | Scripted question with supported answer choices.    | A model-written question grounded in the available options.        |
| Explanation          | Fixed wording describes the rule and alternatives.  | A public explanation connects the chosen trade-off to the brief.   |
| Coordinator review   | Scripted checks; no manufactured disagreement.      | Separate model review can accept, request one revision, or reject. |
| A2A transport        | Real local HTTP.                                    | The same real local HTTP.                                          |

The live model receives free-text preferences as well as the structured priority. Its choices are bounded, the facts are fictional, and the hard constraints are checked in code. This is a teaching lab, not an unrestricted planner.

**Matching answers do not prove intelligence.** We inspect the chosen actions, clarification, explanation, task lifecycle, and final review. A model may reach the same answer as the rules for a better-explained reason, or make a mistake. The protocol itself proves neither quality nor correctness.

Read [What has been tested](./VALIDATION) for observed live runs, fixture tests, and limits. No venue is booked and no payment is made.

## 07 / Check that the idea clicked

<UnderstandingCheck />

<p class="say-it">"I give the coordinator a goal. It delegates venue selection to a specialist. The specialist asks what matters, uses a tool, and explains a choice. The coordinator checks that choice. A2A carries their conversation."</p>

Continue to [Your guided review](./review) to try different priorities and inspect the evidence.
