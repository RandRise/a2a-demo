import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { startDemo } from '../src/app.mjs';
import { validateBrief, validateRecommendation } from '../src/domain/catalogue.mjs';
import { budgetExplanationIssue, budgetFacts } from '../src/domain/budget-review.mjs';

const brief = {
  title: 'Discussion workshop',
  attendees: 30,
  budget: 1600,
  preferredBudget: 1400,
  priority: 'undecided',
  preferences: 'Small-group discussion matters more than prestige.',
  projector: true,
  accessible: true,
};

test('calculated budget review catches the observed live arithmetic error without rejecting alternative comparisons', () => {
  const result = validateRecommendation(
    { venueId: 'cedar-room', reason: 'Quiet room.' },
    { ...brief, priority: 'quiet' },
  );
  assert.equal(budgetFacts(brief, result.venue).preferredRelation, 'below');
  assert.equal(budgetFacts(brief, result.venue).preferredDifference, 50);
  assert.match(
    budgetExplanationIssue(
      'Cedar Room costs AED 1350, slightly above your preferred budget of 1400 AED.',
      brief,
      result.venue,
    ),
    /below/,
  );
  assert.match(
    budgetExplanationIssue('This justifies a modest budget stretch.', brief, result.venue),
    /stretch is AED 0/,
  );
  assert.equal(
    budgetExplanationIssue(
      'Cedar Room is below your preferred budget. Harbor Hall exceeds the preferred budget.',
      brief,
      result.venue,
    ),
    null,
  );
  assert.equal(budgetExplanationIssue('No budget stretch is needed.', brief, result.venue), null);
  assert.equal(
    budgetExplanationIssue('No stretch above the preferred budget is needed.', brief, result.venue),
    null,
  );
});
async function request(demo, path, body) {
  const response = await fetch(`${demo.url}/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
async function settle(demo, id) {
  for (let i = 0; i < 100; i++) {
    const { data } = await request(demo, `/runs/${id}`);
    if (data.state !== 'working') return data;
    await delay(60);
  }
  throw new Error('Task did not settle');
}

test('soft budget permits a justified stretch but hard limits and unresolved priorities are enforced', () => {
  assert.throws(() => validateBrief({ ...brief, preferredBudget: 1700 }), /Preferred budget/);
  assert.throws(
    () => validateRecommendation({ venueId: 'harbor-hall', reason: 'Extra rooms' }, brief),
    /Clarify/,
  );
  const confirmed = validateBrief({ ...brief, priority: 'breakouts' });
  const result = validateRecommendation(
    { venueId: 'harbor-hall', reason: 'Two separate rooms' },
    confirmed,
  );
  assert.equal(result.stretch, 150);
  assert.throws(
    () =>
      validateRecommendation(
        { venueId: 'harbor-hall', reason: 'Extra rooms' },
        { ...confirmed, budget: 1500 },
      ),
    /requirements/,
  );
});

test('two clarifications preserve identity and freeze every other constraint', async (t) => {
  const demo = await startDemo({ port: 0, agentPort: 0 });
  t.after(() => demo.close());
  const { data } = await request(demo, '/runs', {
    mode: 'rehearsal',
    brief: { ...brief, budget: null },
  });
  const budgetQuestion = await settle(demo, data.id);
  assert.equal(budgetQuestion.clarification.field, 'budget');
  await request(demo, `/runs/${data.id}/reply`, { budget: 1600 });
  const priorityQuestion = await settle(demo, data.id);
  assert.equal(priorityQuestion.clarification.field, 'priority');
  assert.equal(priorityQuestion.shortlist.length, 3);
  assert.equal(priorityQuestion.taskId, budgetQuestion.taskId);
  assert.equal(
    (await request(demo, `/runs/${data.id}/reply`, { priority: 'breakouts', budget: 2000 })).status,
    400,
  );
  assert.equal((await request(demo, `/runs/${data.id}/reply`, {})).status, 400);
  await request(demo, `/runs/${data.id}/reply`, { priority: 'breakouts' });
  const complete = await settle(demo, data.id);
  assert.equal(complete.state, 'completed', complete.error);
  assert.equal(complete.taskId, budgetQuestion.taskId);
  assert.equal(complete.contextId, budgetQuestion.contextId);
  assert.equal(complete.result.venue.id, 'harbor-hall');
  assert.equal(complete.result.stretch, 150);
});

test('rehearsal priority changes choose distinct suitable options and impossible briefs reject without preference questions', async (t) => {
  const demo = await startDemo({ port: 0, agentPort: 0 });
  t.after(() => demo.close());
  for (const [priority, venueId] of [
    ['value', 'canal-loft'],
    ['quiet', 'cedar-room'],
    ['breakouts', 'harbor-hall'],
  ]) {
    const { data } = await request(demo, '/runs', {
      mode: 'rehearsal',
      brief: { ...brief, priority },
    });
    const run = await settle(demo, data.id);
    assert.equal(run.state, 'completed', run.error);
    assert.equal(run.result.venue.id, venueId);
  }
  const { data } = await request(demo, '/runs', {
    mode: 'rehearsal',
    brief: { ...brief, budget: 200, preferredBudget: 200 },
  });
  const run = await settle(demo, data.id);
  assert.equal(run.state, 'rejected');
  assert.equal(run.clarification, null);
});

test('model-fixture review requests a new linked A2A task and the specialist answers the feedback', async (t) => {
  const decisions = [];
  const decide = async (settings, prompt, input) => {
    if (prompt.includes('discovered a venue specialist'))
      return { action: 'delegate', text: 'Compare options for quiet discussion.', venueId: '' };
    if (prompt.includes('reviewing a specialist')) {
      decisions.push(`review:${input.revisionCount}`);
      return input.revisionCount
        ? {
            action: 'accept',
            text: 'Cedar Room provides lower noise within the preferred budget.',
            venueId: 'cedar-room',
          }
        : {
            action: 'revise',
            text: 'Canal Loft has moderate noise. Compare Cedar Room before choosing for a quiet workshop.',
            venueId: 'canal-loft',
          };
    }
    if (!input.toolResult) return { action: 'lookup', text: 'Read venue facts.', venueId: '' };
    if (input.reviewFeedback) {
      assert.match(input.reviewFeedback, /Cedar/);
      decisions.push('feedback received');
    }
    return {
      action: 'recommend',
      text: input.reviewFeedback
        ? 'Cedar is quieter; give up separate rooms.'
        : 'Canal Loft saves money.',
      venueId: input.reviewFeedback ? 'cedar-room' : 'canal-loft',
    };
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
    brief: { ...brief, priority: 'quiet' },
  });
  const run = await settle(demo, data.id);
  assert.equal(run.state, 'completed', run.error);
  assert.equal(run.result.venue.id, 'cedar-room');
  assert.equal(run.revisionCount, 1);
  assert.equal(run.previousTaskIds.length, 1);
  assert.notEqual(run.taskId, run.previousTaskIds[0]);
  const sends = run.trace.filter((entry) => entry.request?.method === 'SendMessage');
  assert.equal(sends.length, 2);
  assert.equal(sends[1].request.params.message.contextId, run.contextId);
  assert.deepEqual(sends[1].request.params.message.referenceTaskIds, run.previousTaskIds);
  assert.deepEqual(decisions, ['review:0', 'feedback received', 'review:1']);
  assert.ok(!JSON.stringify(run).includes('invented-test-marker'));
});

test('a contradictory budget explanation triggers a labelled code check and corrected linked task', async (t) => {
  const decide = async (settings, prompt, input) => {
    if (prompt.includes('discovered a venue specialist'))
      return { action: 'delegate', text: 'Find a quiet venue.', venueId: '' };
    if (prompt.includes('reviewing a specialist'))
      return {
        action: 'accept',
        text: 'Cedar Room is AED 50 below the preferred budget.',
        venueId: 'cedar-room',
      };
    if (!input.toolResult) return { action: 'lookup', text: 'Read the catalogue.', venueId: '' };
    return {
      action: 'recommend',
      venueId: 'cedar-room',
      text: input.reviewFeedback
        ? 'Cedar Room is quieter and below the preferred budget; it has no separate rooms.'
        : 'Cedar Room costs AED 1350, above your preferred budget of AED 1400.',
    };
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
    brief: { ...brief, priority: 'quiet' },
  });
  const run = await settle(demo, data.id);
  assert.equal(run.state, 'completed', run.error);
  assert.equal(run.revisionCount, 1);
  assert.ok(run.events.some((event) => event.title === 'Budget check requests a correction'));
  assert.match(run.result.reason, /below/);
  assert.equal((await request(demo, '/status')).data.latestRunId, run.id);
});

test('unresolved review stops after one revision without showing an approved result', async (t) => {
  const decide = async (settings, prompt, input) => {
    if (prompt.includes('discovered a venue specialist'))
      return { action: 'delegate', text: 'Find a venue.', venueId: '' };
    if (prompt.includes('reviewing a specialist'))
      return {
        action: 'revise',
        text: 'The priority is still not addressed.',
        venueId: 'canal-loft',
      };
    return input.toolResult
      ? { action: 'recommend', text: 'Canal is inexpensive.', venueId: 'canal-loft' }
      : { action: 'lookup', text: 'Check venues.', venueId: '' };
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
    brief: { ...brief, priority: 'quiet' },
  });
  const run = await settle(demo, data.id);
  assert.equal(run.state, 'rejected');
  assert.equal(run.revisionCount, 1);
  assert.equal(run.result, null);
});
