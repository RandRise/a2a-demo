import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { startDemo } from '../src/app.mjs';
import { ProviderError } from '../src/ai/provider.mjs';

const brief = {
  title: 'AI Operations workshop',
  attendees: 30,
  budget: null,
  projector: true,
  accessible: true,
};
async function request(demo, path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`${demo.url}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
}
async function settled(demo, id) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const { data } = await request(demo, `/runs/${id}`);
    if (data.state !== 'working') return data;
    await delay(100);
  }
  throw new Error('Run did not settle');
}

test('real local A2A: discovery, clarification, continuation, artifact, and coordinator review', async (t) => {
  const demo = await startDemo({ port: 0, agentPort: 0 });
  t.after(() => demo.close());
  const start = await request(demo, '/runs', { mode: 'rehearsal', brief });
  assert.equal(start.status, 202);
  const paused = await settled(demo, start.data.id);
  assert.equal(paused.state, 'input-required', JSON.stringify(paused));
  assert.ok(paused.taskId);
  assert.ok(paused.contextId);
  assert.equal(paused.trace[0].status, 200);
  assert.equal(paused.trace[0].response.name, 'Venue specialist');
  await request(demo, `/runs/${paused.id}/reply`, { budget: 1400 });
  const completed = await settled(demo, paused.id);
  assert.equal(completed.state, 'completed', JSON.stringify(completed));
  assert.equal(completed.taskId, paused.taskId);
  assert.equal(completed.contextId, paused.contextId);
  assert.equal(completed.result.venue.id, 'canal-loft');
  assert.equal(completed.result.venue.price, 1200);
  assert.ok(completed.trace.some((entry) => entry.request?.method === 'SendMessage'));
  assert.ok(completed.trace.some((entry) => entry.request?.method === 'GetTask'));
  assert.ok(completed.result.artifactId);
  assert.equal(completed.events.at(-1).role, 'coordinator');
  const repeat = await request(demo, `/runs/${paused.id}/reply`, { budget: 2000 });
  assert.equal(repeat.status, 400);
});

test('complete brief bypasses clarification; an impossible budget is rejected', async (t) => {
  const demo = await startDemo({ port: 0, agentPort: 0 });
  t.after(() => demo.close());
  for (const [budget, expected] of [
    [1400, 'completed'],
    [500, 'rejected'],
  ]) {
    const { data } = await request(demo, '/runs', {
      mode: 'rehearsal',
      brief: { ...brief, budget },
    });
    const result = await settled(demo, data.id);
    assert.equal(result.state, expected, JSON.stringify(result));
    assert.ok(!result.events.some((event) => event.title === 'A question before proceeding'));
    if (expected === 'rejected') assert.equal(result.result, null);
  }
});

test('reject malformed requests and unavailable live mode; prevent cross-origin use and private file access', async (t) => {
  const demo = await startDemo({ port: 0, agentPort: 0 });
  t.after(() => demo.close());
  assert.equal(
    (await request(demo, '/runs', { mode: 'rehearsal', brief: { ...brief, attendees: -2 } }))
      .status,
    400,
  );
  assert.equal((await request(demo, '/runs', { mode: 'live', brief })).status, 400);
  const cross = await fetch(`${demo.url}/api/runs`, {
    method: 'POST',
    headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'rehearsal', brief }),
  });
  assert.equal(cross.status, 403);
  for (const path of ['/src/server.mjs', '/package.json', '/.env', '/archive/verification.json'])
    assert.equal((await fetch(`${demo.url}${path}`)).status, 404);
  const page = await fetch(demo.url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
});

test('stopping a task waiting for input preserves cancellation and enables a new run', async (t) => {
  const demo = await startDemo({ port: 0, agentPort: 0 });
  t.after(() => demo.close());
  const { data } = await request(demo, '/runs', { mode: 'rehearsal', brief });
  const paused = await settled(demo, data.id);
  assert.equal(paused.state, 'input-required');
  const stopped = await request(demo, `/runs/${data.id}/stop`, {});
  assert.equal(stopped.data.state, 'canceled');
  assert.ok(stopped.data.trace.some((entry) => entry.request?.method === 'CancelTask'));
  assert.equal((await request(demo, '/runs', { mode: 'rehearsal', brief })).status, 202);
});

test('injected model decisions exercise the live path; credentials never enter API output', async (t) => {
  const actions = [];
  const decide = async (settings, instructions, input) => {
    assert.equal(settings.provider, 'openai');
    if (instructions.includes('discovered a venue specialist')) {
      actions.push('delegate');
      return {
        action: 'delegate',
        text: 'Select a venue meeting the structured brief.',
        venueId: '',
      };
    }
    if (instructions.includes('reviewing a specialist')) {
      actions.push('accept');
      return {
        action: 'accept',
        text: 'Canal Loft fits the verified requirements.',
        venueId: 'canal-loft',
      };
    }
    const action = input.brief.budget === null ? 'ask' : input.toolResult ? 'recommend' : 'lookup';
    actions.push(action);
    return {
      action,
      text: action === 'ask' ? 'What is the budget?' : 'Fits all constraints.',
      venueId: action === 'recommend' ? 'canal-loft' : '',
    };
  };
  const demo = await startDemo({ port: 0, agentPort: 0, decide });
  t.after(() => demo.close());
  const marker = 'invented-test-marker-not-a-real-key';
  const connection = await request(
    demo,
    '/connection',
    { provider: 'openai', model: 'fixture', apiKey: marker },
    'PUT',
  );
  assert.equal(connection.status, 200);
  assert.ok(!JSON.stringify(connection.data).includes(marker));
  const { data } = await request(demo, '/runs', { mode: 'live', brief });
  const paused = await settled(demo, data.id);
  assert.equal(paused.state, 'input-required');
  assert.equal((await request(demo, '/connection', {}, 'DELETE')).status, 409);
  await request(demo, `/runs/${data.id}/reply`, { budget: 1400 });
  const completed = await settled(demo, data.id);
  assert.equal(completed.state, 'completed', JSON.stringify(completed));
  assert.deepEqual(actions, ['delegate', 'ask', 'lookup', 'recommend', 'accept']);
  assert.ok(!JSON.stringify(completed).includes(marker));
  assert.equal((await request(demo, '/connection', {}, 'DELETE')).status, 200);
});

test('model failure stays a failure and never falls back to rehearsal', async (t) => {
  const demo = await startDemo({
    port: 0,
    agentPort: 0,
    settings: { provider: 'openai', model: 'fixture', apiKey: 'invented-test-marker' },
    decide: async () => {
      throw new ProviderError('The provider reports a rate or billing limit.');
    },
  });
  t.after(() => demo.close());
  const { data } = await request(demo, '/runs', { mode: 'live', brief });
  const failed = await settled(demo, data.id);
  assert.equal(failed.state, 'failed');
  assert.equal(failed.mode, 'live');
  assert.equal(failed.result, null);
  assert.match(failed.error, /billing limit/);
});

test('cancellation while the specialist is working cannot be overwritten by a late result', async (t) => {
  const decide = async (settings, prompt, input, signal) => {
    if (prompt.includes('discovered a venue specialist'))
      return { action: 'delegate', text: 'Please select a venue.', venueId: '' };
    await delay(1000, undefined, { signal });
    return { action: 'lookup', text: 'Compare venues.', venueId: '' };
  };
  const demo = await startDemo({
    port: 0,
    agentPort: 0,
    decide,
    settings: { provider: 'openai', model: 'fixture', apiKey: 'invented-test-marker' },
  });
  t.after(() => demo.close());
  const { data } = await request(demo, '/runs', {
    mode: 'live',
    brief: { ...brief, budget: 1400 },
  });
  let running;
  for (let count = 0; count < 30; count++) {
    running = (await request(demo, `/runs/${data.id}`)).data;
    if (running.taskId) break;
    await delay(30);
  }
  assert.ok(running.taskId);
  assert.equal(running.state, 'working');
  const stopped = await request(demo, `/runs/${data.id}/stop`, {});
  assert.equal(stopped.data.state, 'canceled');
  await delay(1100);
  const final = (await request(demo, `/runs/${data.id}`)).data;
  assert.equal(final.state, 'canceled');
  assert.equal(final.result, null);
  const cancellation = final.trace.find((entry) => entry.request?.method === 'CancelTask');
  assert.equal(cancellation.response.result.contextId, running.contextId);
});
