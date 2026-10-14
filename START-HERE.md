# Team 3: start here

This pack contains **Relay**, our two-agent A2A course demo, and an editable
PowerPoint presentation. All venues and workshop data are invented.

**No personal API key is included. Rehearsal mode works without any API key.**

## 1. Extract and install

1. Extract the entire ZIP. Do not run the files from inside the ZIP viewer.
2. Open the extracted `a2a-demo` folder. You should see `package.json` here.
3. Install Node.js **20.18 or newer** if necessary. Check with `node --version`.
4. Open a terminal in this folder. In VS Code, use **Terminal → New Terminal**.
5. Run these commands, one at a time:

```sh
npm ci
npm start
```

The first command downloads the dependencies and needs internet access.
The second starts both local agent services. Keep its terminal open.
Open **http://127.0.0.1:8780** in your browser.

On Windows, if PowerShell blocks `npm.ps1`, use `npm.cmd ci` and `npm.cmd start`
or use a Command Prompt terminal. You do not need to change system security settings.

## 2. Rehearse without a key

1. Choose **Rehearsal** and the **Discuss the trade-off** preset.
2. Click **Start the handoff**.
3. When the specialist asks, choose **Separate breakout rooms** and send the answer.
4. Read the venue comparison, Harbor Hall recommendation and coordinator review.
5. Open **Protocol inspector**. Look for the Agent Card, messages and task ID.
   The clarification answer continues the same task.
6. Start a **New run**, choose **Prioritize a quiet room**, and compare Cedar Room.
7. Try **A budget that cannot work** to see a valid rejection.

The coordinator owns the user's request. The venue specialist chooses how to
handle the delegated venue search. A2A carries their task exchange. The catalogue
lookup is a local tool function; this demo does not connect a live MCP server.

Rehearsal has scripted decisions but real local A2A HTTP traffic. It is useful
for presenting the protocol consistently. Label it as Rehearsal when presenting.

## 3. Open the presentation and explanation

- **PowerPoint:** `presentation/Relay-Team-3.pptx`. Use Slide Show to present and
  Presenter View to see the speaker notes. The text and tables are editable.
- **Browser slides:** open `public/presentation/index.html`, or visit
  http://127.0.0.1:8780/presentation/ while the app is running.
- **Interactive guide:** open a second terminal in `a2a-demo`, run
  `npm run docs:dev`, then open http://127.0.0.1:5173.
- **Discord message to share:** `docs/DISCORD-MESSAGE.txt`.

## 4. Optional Live AI with your own key

You can skip this section entirely for the classroom rehearsal.

1. Copy `.env.example` to `.env` in the same folder. The example key is blank.
   On Windows use `Copy-Item .env.example .env`; on macOS/Linux use
   `cp .env.example .env`. Do this only if you do not already have your own `.env`.
2. Edit `.env` locally and enter **your own** OpenAI API key after `OPENAI_API_KEY=`.
   Use a model available to your account. Do not send the key in Discord.
3. Stop the app with **Ctrl+C**, run `npm start` again, then select **Live AI**.

Live runs use your account's API billing and need internet access. They can fail
because of connection, account, quota or model access issues. There is no automatic
scripted fallback. You can explicitly select Rehearsal to continue without a provider.
Keep `.env` private and out of ZIP files and Git commits.

## Troubleshooting

| What you see                           | What to do                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm` or `node` is not recognized      | Install Node.js, then reopen your terminal.                                         |
| `package.json` is missing              | Change into the extracted `a2a-demo` folder before running commands.                |
| A demo port is already in use          | Stop your earlier demo terminal with Ctrl+C. Ports 8780 and 8781 must both be free. |
| The guide's port is busy               | Reuse the existing guide at port 5173, or stop its earlier terminal.                |
| Live AI says no provider is configured | Use Rehearsal, or set up your own `.env` and restart.                               |
| The page will not load                 | Keep `npm start` running and check its terminal for errors.                         |

The source is at https://github.com/RandRise/a2a-demo.
The repository is source code; each teammate starts their own local app.
