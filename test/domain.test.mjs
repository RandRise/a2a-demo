import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupVenues, validateBrief, validateRecommendation } from '../src/domain/catalogue.mjs';
import { modelDecision } from '../src/ai/provider.mjs';

const brief = { title: 'Demo', attendees: 30, budget: 1400, projector: true, accessible: true };
test('constraints exclude cheap but unsuitable venues and forged recommendations', () => {
  const venues = lookupVenues(brief);
  assert.deepEqual(
    venues.filter((venue) => !venue.unmet.length).map((venue) => venue.id),
    ['canal-loft', 'cedar-room'],
  );
  for (const venueId of ['atelier', 'garden-room', 'studio-eight', 'harbor-hall', 'invented'])
    assert.throws(() => validateRecommendation({ venueId, reason: 'Trust me' }, brief));
  assert.throws(() => validateBrief({ ...brief, budget: '1400' }));
  assert.throws(() => validateBrief({ ...brief, attendees: 2.5 }));
  assert.throws(() =>
    validateRecommendation({ venueId: 'canal-loft', reason: 'Fits' }, { ...brief, budget: null }),
  );
});

test('model provider builds structured Responses requests and sanitizes upstream errors', async () => {
  let request;
  const settings = { provider: 'openai', model: 'fixture', apiKey: 'fixture-marker' };
  const response = await modelDecision(
    settings,
    'Role',
    { brief },
    undefined,
    async (url, options) => {
      request = { url, ...options };
      return Response.json({
        status: 'completed',
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({ action: 'ask', text: 'Budget?', venueId: '' }),
              },
            ],
          },
        ],
      });
    },
  );
  assert.equal(response.action, 'ask');
  const body = JSON.parse(request.body);
  assert.equal(body.store, false);
  assert.equal(body.text.format.type, 'json_schema');
  assert.ok(!request.body.includes(settings.apiKey));
  await assert.rejects(
    () =>
      modelDecision(
        settings,
        'Role',
        {},
        undefined,
        async () => new Response('sensitive-upstream-body', { status: 401 }),
      ),
    /API key was not accepted/,
  );
  await assert.rejects(
    () =>
      modelDecision(settings, 'Role', {}, undefined, async () =>
        Response.json({ status: 'incomplete', output: [] }),
      ),
    /complete, readable/,
  );
});
