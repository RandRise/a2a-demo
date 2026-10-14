const string = { type: 'string' };
export const decisionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: {
      type: 'string',
      enum: ['delegate', 'lookup', 'ask', 'recommend', 'reject', 'accept', 'revise'],
    },
    text: string,
    venueId: string,
  },
  required: ['action', 'text', 'venueId'],
};

export class ProviderError extends Error {}

export function connectionSettings(input, previous = {}) {
  if (!['openai', 'ollama'].includes(input.provider)) throw new Error('Choose OpenAI or Ollama.');
  const model = typeof input.model === 'string' ? input.model.trim() : '';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,100}$/.test(model))
    throw new Error('Enter a valid model name.');
  const apiKey =
    input.provider === 'openai'
      ? input.apiKey || (previous.provider === 'openai' ? previous.apiKey : '')
      : '';
  if (
    input.provider === 'openai' &&
    (typeof apiKey !== 'string' || apiKey.length < 10 || apiKey.length > 512 || /\s/.test(apiKey))
  )
    throw new Error('Enter your API key locally to enable OpenAI.');
  return { provider: input.provider, model, apiKey };
}

// Credentials stay here on the server. Neither prompts nor responses are logged.
export async function modelDecision(settings, instructions, input, signal, fetchImpl = fetch) {
  if (!settings) throw new ProviderError('Configure a model connection before using live mode.');
  const timeout = AbortSignal.timeout(60000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response;
  try {
    if (settings.provider === 'openai') {
      response = await fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: combined,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
        body: JSON.stringify({
          model: settings.model,
          store: false,
          instructions,
          input: JSON.stringify(input),
          max_output_tokens: 1500,
          text: {
            format: {
              type: 'json_schema',
              name: 'agent_decision',
              strict: true,
              schema: decisionSchema,
            },
          },
        }),
      });
    } else {
      response = await fetchImpl('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        signal: combined,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          stream: false,
          format: decisionSchema,
          messages: [
            { role: 'system', content: instructions },
            { role: 'user', content: JSON.stringify(input) },
          ],
        }),
      });
    }
  } catch {
    if (signal?.aborted) throw new ProviderError('Run stopped.');
    throw new ProviderError(
      combined.aborted
        ? 'The model took too long. Try again or use rehearsal mode.'
        : 'Cannot reach the model provider. Check the connection and try again.',
    );
  }
  if (!response.ok) {
    const reason = {
      401: 'The API key was not accepted.',
      403: 'This model is not available to this account.',
      404: 'The model was not found.',
      429: 'The provider reports a rate or billing limit.',
    }[response.status];
    throw new ProviderError(reason || `The model provider returned HTTP ${response.status}.`);
  }
  let decision;
  try {
    const body = await response.json();
    if (settings.provider === 'openai' && body.status !== 'completed')
      throw new Error('Incomplete');
    const content =
      settings.provider === 'openai'
        ? body.output
            ?.flatMap((item) => item.content ?? [])
            .filter((item) => item.type === 'output_text')
            .map((item) => item.text)
            .join('')
        : body.message?.content;
    decision = JSON.parse(content);
  } catch {
    throw new ProviderError('The model did not return a complete, readable decision.');
  }
  if (
    !decisionSchema.properties.action.enum.includes(decision.action) ||
    typeof decision.text !== 'string' ||
    !decision.text.trim() ||
    decision.text.length > 2000 ||
    typeof decision.venueId !== 'string'
  ) {
    throw new ProviderError('The model returned an invalid decision. No result was accepted.');
  }
  return decision;
}
