import { startDemo } from './app.mjs';
import { loadLocalEnvironment, settingsFromEnvironment } from './config/environment.mjs';

let demo;
try {
  loadLocalEnvironment();
  const port = Number(process.env.PORT || 8780);
  const agentPort = Number(process.env.AGENT_PORT || 8781);
  const settings = settingsFromEnvironment();
  demo = await startDemo({ port, agentPort, settings });
  console.log(
    `Relay — A2A teaching demo\nLocal: ${demo.url}\nVenue agent: ${demo.specialistUrl}\n${settings ? 'OpenAI configured. Select Live AI to run the agents; the provider has not been tested yet.' : 'No API key configured. Add OPENAI_API_KEY to .env and restart, or use Model connection.'}\nPress Ctrl+C to stop. Local .env credentials are never served to the browser.`,
  );
} catch (error) {
  console.error(
    error.code === 'EADDRINUSE'
      ? 'A demo port is already in use. Stop the earlier server or set PORT and AGENT_PORT.'
      : 'Could not start the demo. Check Node.js, .env configuration, and run npm ci.',
  );
  process.exitCode = 1;
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await demo?.close();
    process.exit(0);
  });
