# Team 3: How do agents talk to other agents?

## Slide deck

With `npm start` running, open [the 16-slide presentation](http://127.0.0.1:8780/presentation/).
You can also open `public/presentation/index.html` directly in a browser without a server.
Use the arrow keys to move, **N** for speaker notes, **F** for full screen,
or the slide picker to jump to a topic. **Print / PDF** prints all slides without notes.
The deck includes the two agent roles, MCP versus A2A, protocol exchanges,
preferences, observed live results, review limits, code organization and demo steps.

## Short presenter script

A 6-8 minute walkthrough. Start Relay and the VitePress guide before presenting.
Use the actual presentation display and state whether the mode is Rehearsal or Live AI.

## 1. Set up the choice

"We need a venue for 30 people with a projector and step-free access. We prefer
AED 1,400 but authorize up to AED 1,600 if the benefit is worthwhile. Several
venues fit. Which one best supports our workshop?"

Show Canal Loft (AED 1,200, moderate noise), Cedar Room (AED 1,350, low noise),
and Harbor Hall (AED 1,550, two separate breakout rooms, moderate noise).
All places, features, and prices are fictional.

## 2. Introduce the two roles

The coordinator owns the user's outcome. The venue specialist owns venue selection.
The specialist's local catalogue function returns facts; the specialist decides
how those facts should inform a recommendation.

MCP can connect agents to tools and context. A2A supports communication between
agents. Our catalogue tool is a direct function, not a live MCP connection.

## 3. Discover and delegate

Choose **Discuss the trade-off**, select the desired mode, and start the handoff.
In **Protocol inspector**, show the Agent Card and `SendMessage`.
The coordinator knows the specialist's address and reads its declared capability.
It is not searching the web for arbitrary agents.

Rehearsal uses scripted decisions and real A2A HTTP. Live mode calls the configured
model with separate coordinator and specialist instructions. Both use A2A 1.0.

## 4. Answer a meaningful question

The specialist consults the catalogue and asks which benefit matters most.
Show the candidate comparison. Answer **Separate breakout rooms**.
Show that the answer continues the same task ID and context ID.

In rehearsal, Harbor Hall wins. In live mode, explain the observed recommendation
instead of promising exact wording or a particular choice.

## 5. Review the trade-off

For Harbor Hall, the benefit is two enclosed discussion rooms. The sacrifice is
moderate main-hall noise and spending AED 150 above the preferred budget. It remains
AED 50 below the hard limit.

Show the specialist's explanation, the returned artifact, and the coordinator's
review. The coordinator may accept, request one revision, or reject.
A revision uses a NEW A2A task in the SAME context and references the earlier task.
Do not claim a revision occurred unless it appears in the actual exchange.

The app also checks hard constraints and screens for a narrow class of contradictory
budget-direction statements. These checks are code, not additional agent reasoning.
A model review can still miss errors; protocol success is not proof of correctness.

## 6. Change the preference or test a limit

Start a new run using **Prioritize a quiet room**. In rehearsal, Cedar Room wins.
Explain why lower noise can be worth more than saving AED 150 at Canal Loft.
Then use **A budget that cannot work** to show a valid rejection.

## 7. Finish with the lesson

"An agent delegate owns a goal, not just an operation. It can ask for information,
use tools, weigh alternatives, and return an explanation for another agent to
check. A2A gives them a common way to exchange that work."

The point is not to force live AI to differ from the script. Look for clear
responsibilities, actual task messages, sensible trade-offs, and verifiable facts.
