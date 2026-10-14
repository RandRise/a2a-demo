# A2A demo configuration

The user explicitly authorized a local `.env` for the live OpenAI demo.
This is the sole exception to the workspace's no-secrets-in-files rule:
the user may enter their own key in this ignored local file.
Never read its values into tool output, copy it into documentation or archives,
force-add it to Git, or include it in a commit. Never request the key in chat.

`.env.example` is a shareable template and must keep `OPENAI_API_KEY` empty.
Keep `.env` and `.env.*` ignored, with only `.env.example` allowed in Git,
including when this folder is used as a standalone repository.
Keep provider credentials on the Node server; do not use a `VITE_` prefix.
Ordinary tests use invented markers, never live API calls. The explicit
`npm run test:live` verification command uses the local key without displaying it
and makes billable provider calls; keep its observed results separate from fixtures.
Record observed live-provider results separately from fixture tests.
