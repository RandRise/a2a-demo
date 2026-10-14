# Relay: agent-to-agent, explained

A local teaching lab for the final AI Operations course task. Watch a coordinator
discover a venue specialist, delegate a workshop brief, answer a clarification,
and check the returned recommendation.

## Understand the demo first

The VitePress walkthrough presents the story in plain English, with an interactive
handoff illustration, a knowledge check, and a guided review of the actual app.
After installing dependencies with `npm ci`, run `npm run docs:dev` and open
**http://127.0.0.1:5173**. Its content lives in `docs/index.md` and `docs/review.md`.
Build it with `npm run docs:build`; serve the build with `npm run docs:preview`.
The walkthrough does not start the agents. Use a second terminal for the app below.
On Windows, you can also double-click `start-walkthrough.cmd` to open the guide.

## Presentation and class message

Open [the 16-slide presentation](http://127.0.0.1:8780/presentation/) while the
app is running, or open `public/presentation/index.html` directly in your browser.
It works offline and includes speaker notes, keyboard navigation, full-screen
mode, and a print layout for PDF export. Use **N** for notes and the arrow keys
to move between slides.

The [short presenter script](docs/PRESENTATION.md) supports a 6–8 minute demo.
The [Discord message](docs/DISCORD-MESSAGE.txt) is ready to copy and post.

## Start the app

Node.js **20.18 or newer** is required. From this directory:

```sh
npm ci
npm start
```

Open **http://127.0.0.1:8780**. The specialist runs at **127.0.0.1:8781**.
The Node process serves both local HTTP services. Stop it with Ctrl+C.
No build step, database, Supabase connection, or API key is needed for rehearsal.

## Try the handoff

1. Choose **Discuss the trade-off**: AED 1,400 preferred, AED 1,600 maximum.
2. Click **Start the handoff**. The specialist compares the catalogue and asks
   whether cost, quiet, or separate breakout rooms matter most.
3. Choose **Separate breakout rooms** and send the answer. Rehearsal returns
   Harbor Hall at AED 1,550, a justified AED 150 stretch within the hard limit.
4. Read the comparison, specialist explanation, and coordinator review. Open
   **Protocol inspector** for the real messages and task identifiers.
5. Try **Prioritize a quiet room** or **Keep the cost down** in a new run.
   Rehearsal chooses Cedar Room or Canal Loft respectively. Live decisions may vary.
6. Use the impossible-budget preset to see an honest rejection.

**Rehearsal uses scripted decisions and real local A2A communication.** Live AI
uses model calls with separate coordinator and specialist instructions. Neither
mode makes bookings. All venue data and prices are invented.

## Connect live AI

### OpenAI with a local .env

1. Copy `.env.example` to `.env` if the local file does not already exist.
2. Add your key after `OPENAI_API_KEY=` in **`.env` only**. Leave the example blank.
3. Keep `OPENAI_MODEL=gpt-4.1-mini`, or use a compatible model available to your account.
4. Restart `npm start`. Open the app, select **Live AI**, and click **Start the handoff**.
5. Leave the priority undecided to see a useful clarification, then choose what matters most.

Node loads this project's `.env` at startup, regardless of the terminal's working
directory. Existing shell environment variables take precedence. An absent file
or empty key keeps rehearsal available. Restart after editing the file.
Configuration does not test a key: the first live run calls the provider and may
report account access, billing, model, or network errors. There is no scripted fallback.

For an explicit end-to-end provider check, run `npm run test:live` after adding
the key. It starts isolated local services, delegates a preference-based brief,
answers with separate breakout rooms, and checks the artifact and coordinator acceptance.
Use `npm run test:live -- --quiet` to try the quiet-room priority. **This command
makes real OpenAI calls and uses API billing.** Ordinary `npm test` uses fixtures
and never makes provider calls. Record the observed live outcome separately.

### Other connection options

You can also open **Model connection** in the sidebar:

- **OpenAI:** enter a model name (default `gpt-4.1-mini`) and your API key locally.
  Live runs send the fictional brief to the API and use your API billing.
- **Ollama:** start Ollama separately, download a model that supports reliable
  structured output, and enter its exact installed name. The demo connects only
  to `http://127.0.0.1:11434`. The suggested name is a starting value, not an
  installed or automatically downloaded model.

Save the connection, then select **Live AI** in the brief. Saving does not claim
the provider was tested: the first live run makes the request and reports any
connection, model, billing, or output errors. There is no scripted fallback.

Keys entered in the form stay in server memory; the form never writes `.env`.
**Disconnect** clears the active connection but does not edit `.env` or the shell
environment, so restarting loads those settings again. Keys are excluded from
browser storage, API responses, A2A traces, and recommendation downloads.

### Sharing on GitHub

Commit `.env.example` with its key blank and keep `.gitignore`. Your actual `.env`
is ignored, including when `a2a-demo` becomes its own repository. Before pushing,
run these from this folder:

```sh
git check-ignore .env
git ls-files -- .env
```

The first should print `.env`; the second should print nothing. Never force-add
the file or include it in ZIPs, screenshots, or logs. Git ignore rules do not remove
a secret already committed; revoke an exposed key immediately if that occurs.

An `.env` file is **plain text, not encryption**. Keep it private on your machine.
Keep keys on the server as described in the
[OpenAI authentication guidance](https://developers.openai.com/api/reference/overview#authentication).
Do not use `VITE_` for a secret, since that prefix exposes variables to frontend code.
GitHub hosts the source; the live demo still needs its Node server and your own key.

## Project guide

- [Architecture and source map](docs/ARCHITECTURE.md)
- [Presentation walkthrough](docs/PRESENTATION.md)
- [Actual validation and limits](docs/VALIDATION.md)

The code is divided into agents, protocol helpers, model adapters, domain rules,
HTTP composition, and browser modules. The project pins official A2A SDK 1.3.0
and implements the **A2A 1.0 JSON-RPC** workflow.

## Checks

```sh
npm test
npm run check
npm run format:check
npm run test:browser
```

Browser checks use an existing Chrome installation in a separate headless
profile. To use Edge, set the process environment variable `BROWSER_CHANNEL`
to `msedge` before running `npm run test:browser`. The script starts its own
services on temporary ports and closes them afterward. Screenshots and audit
reports go only to ignored `.qa/`.

Tests distinguish real local A2A HTTP checks from injected model responses.
A model fixture passing is not a successful live provider test.

## Local configuration

If the ports are occupied, change both process environment variables `PORT`
and `AGENT_PORT` before starting. The app intentionally binds to loopback only.
It is a single-operator course demo, not a hosted multi-user application.
Tasks disappear on restart. No commit or deployment is part of running it.
