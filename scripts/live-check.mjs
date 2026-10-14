import { setTimeout as delay } from 'node:timers/promises';
import { loadLocalEnvironment, settingsFromEnvironment } from '../src/config/environment.mjs';
import { startDemo } from '../src/app.mjs';

// Explicit opt-in command: calls OpenAI and uses the account's API billing.
// Print only a small outcome summary; never print settings, payloads, or credentials.
let demo;
try {
  loadLocalEnvironment();
  const settings = settingsFromEnvironment();
  if (!settings) throw new Error('Add OPENAI_API_KEY to your local .env before running test:live.');
  console.log('Running a real OpenAI + A2A handoff. This uses your API billing.');
  demo = await startDemo({ port: 0, agentPort: 0, settings });
  const brief = {
    title: 'AI Operations workshop',
    attendees: 30,
    budget: 1600,
    preferredBudget: 1400,
    priority: 'undecided',
    preferences:
      'Small-group discussions matter more than a prestigious location. Explain whether spending extra is worthwhile.',
    projector: true,
    accessible: true,
  };
  let run = demo.coordinator.start({ mode: 'live', brief });
  async function settled() {
    const deadline = Date.now() + 210000;
    while (Date.now() < deadline) {
      const response = await fetch(`${demo.url}/api/runs/${run.id}`);
      const current = await response.json();
      if (current.state !== 'working') return current;
      await delay(300);
    }
    throw new Error('The live check timed out. No successful result was recorded.');
  }
  run = await settled();
  if (run.state !== 'input-required')
    throw new Error(`Expected clarification; got ${run.state}. ${run.error || ''}`);
  if (run.clarification?.field !== 'priority')
    throw new Error('Expected a preference clarification.');
  const { taskId, contextId } = run;
  const priority = process.argv.includes('--quiet') ? 'quiet' : 'breakouts';
  console.log(`Live clarification received; answering with priority: ${priority}.`);
  demo.coordinator.reply(run.id, { priority });
  run = await settled();
  if (run.state !== 'completed')
    throw new Error(`Live run did not complete (${run.state}). ${run.error || ''}`);
  if (
    (run.taskId !== taskId && !run.previousTaskIds.includes(taskId)) ||
    run.contextId !== contextId ||
    !run.result?.artifactId ||
    run.review?.action !== 'accept'
  )
    throw new Error('The run did not preserve task identity and return an artifact.');
  console.log(
    `PASS: real provider run completed; clarification preserved task identity and coordinator accepted the result.`,
  );
  console.log(
    `Verified catalogue result: ${run.result.venue.name}, AED ${run.result.venue.price}. No booking made.`,
  );
  console.log(
    `Stretch above preferred budget: AED ${run.result.stretch}. Revisions requested: ${run.revisionCount}.`,
  );
  console.log(`Specialist explanation: ${run.result.reason}`);
  console.log(`Coordinator review: ${run.review.text}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await demo?.close();
}
