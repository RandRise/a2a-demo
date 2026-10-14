import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  ClientFactory,
  DefaultAgentCardResolver,
  JsonRpcTransportFactory,
} from '@a2a-js/sdk/client';
import { dataOf, message, stateName, textOf } from '../protocol/messages.mjs';
import { validateBrief, validateRecommendation, PRIORITIES } from '../domain/catalogue.mjs';
import { modelDecision, ProviderError } from '../ai/provider.mjs';
import { COORDINATOR_PROMPT, REVIEW_PROMPT } from './prompts.mjs';
import { budgetFacts, budgetExplanationIssue } from '../domain/budget-review.mjs';

export class Coordinator {
  constructor(specialistUrl, getSettings, decide = modelDecision) {
    this.specialistUrl = specialistUrl;
    this.getSettings = getSettings;
    this.decide = decide;
    this.runs = new Map();
  }

  start(input) {
    const brief = validateBrief(input.brief);
    if (!['rehearsal', 'live'].includes(input.mode))
      throw new Error('Choose rehearsal or live mode.');
    if (input.mode === 'live' && !this.getSettings())
      throw new Error('Connect a model before starting a live run.');
    if ([...this.runs.values()].some((run) => ['working', 'input-required'].includes(run.state)))
      throw new Error('Finish or stop the current run first.');
    if (this.runs.size >= 50) this.runs.delete(this.runs.keys().next().value);
    const run = {
      id: randomUUID(),
      brief,
      mode: input.mode,
      state: 'working',
      phase: 'discover',
      startedAt: new Date().toISOString(),
      events: [],
      trace: [],
      taskId: null,
      contextId: null,
      result: null,
      clarification: null,
      shortlist: [],
      revisionCount: 0,
      previousTaskIds: [],
      review: null,
      feedback: '',
      settings: this.getSettings(),
      abort: new AbortController(),
      client: null,
    };
    this.runs.set(run.id, run);
    this.event(
      run,
      'user',
      'Workshop brief',
      `${brief.title} · ${brief.attendees} people · ${brief.budget === null ? 'budget not supplied' : `AED ${brief.budget}`}`,
    );
    void this.execute(run);
    return this.view(run);
  }

  event(run, role, title, text) {
    if (run.state === 'canceled') return;
    run.events.push({ id: randomUUID(), role, title, text, time: new Date().toISOString() });
  }

  view(run) {
    const { settings, abort, client, ...safe } = run;
    return structuredClone(safe);
  }

  async discover(run) {
    const tracedFetch = async (url, options = {}) => {
      // Never accept a discovery redirect to another host or record credentials.
      if (new URL(url).origin !== this.specialistUrl) throw new Error('Unexpected agent endpoint.');
      const entry = {
        id: randomUUID(),
        time: new Date().toISOString(),
        method: options.method || 'GET',
        url: String(url),
        request: options.body ? JSON.parse(options.body) : null,
        status: null,
        response: null,
      };
      run.trace.push(entry);
      try {
        const response = await fetch(url, {
          ...options,
          redirect: 'error',
          signal: options.signal
            ? AbortSignal.any([options.signal, AbortSignal.timeout(75000)])
            : AbortSignal.timeout(75000),
        });
        entry.status = response.status;
        entry.response = await response.clone().json();
        return response;
      } catch {
        entry.error = 'No readable agent response.';
        throw new Error('Cannot reach the venue agent. Restart the demo and try again.');
      }
    };
    const resolver = new DefaultAgentCardResolver({ fetchImpl: tracedFetch });
    const card = await resolver.resolve(this.specialistUrl);
    if (!card.skills?.some((skill) => skill.id === 'venue-selection'))
      throw new Error('The discovered agent does not offer venue selection.');
    const endpoint = card.supportedInterfaces?.find((item) => item.protocolBinding === 'JSONRPC');
    if (!endpoint || new URL(endpoint.url).origin !== this.specialistUrl)
      throw new Error('The agent advertised an unexpected endpoint.');
    run.card = card;
    this.event(
      run,
      'protocol',
      'Specialist discovered',
      `Read the Agent Card. ${card.name} offers the venue-selection skill over A2A ${endpoint.protocolVersion}.`,
    );
    run.client = await new ClientFactory({
      cardResolver: resolver,
      transports: [new JsonRpcTransportFactory({ fetchImpl: tracedFetch })],
    }).createFromAgentCard(card);
  }

  async requestRevision(run, text, source = 'model') {
    run.review = { action: 'revise', text, source };
    if (run.revisionCount >= 1) {
      run.state = 'rejected';
      run.phase = 'result';
      run.error = `Review remains unresolved after one revision: ${text}`;
      this.event(run, 'coordinator', 'Recommendation not approved', run.error);
      return;
    }
    this.event(
      run,
      'coordinator',
      source === 'budget-check'
        ? 'Budget check requests a correction'
        : 'Coordinator requests a revision',
      text,
    );
    run.feedback = text;
    run.revisionCount++;
    run.previousTaskIds.push(run.taskId);
    run.taskId = null;
    run.taskState = 'submitted';
    run.task = null;
    // Completed tasks are terminal; revisions use a new task in the same context.
    return await this.execute(run);
  }

  async execute(run, followup = false) {
    try {
      let request;
      if (!followup) {
        if (!run.client) await this.discover(run);
        if (run.abort.signal.aborted) return;
        run.phase = 'delegate';
        request = `Recommend a venue for ${run.brief.title}, a four-hour workshop for ${run.brief.attendees} people. ${run.brief.projector ? 'A projector is required. ' : ''}${run.brief.accessible ? 'Step-free access is required. ' : ''}${run.brief.budget === null ? 'The budget has not been provided; ask if you need it.' : `The maximum venue budget is AED ${run.brief.budget}.`} Return your recommendation and explain why it fits. Do not book anything.`;
        request += ` Preferred budget: ${run.brief.preferredBudget ?? 'not supplied'}. Priority: ${run.brief.priority}. Preferences: ${run.brief.preferences || 'none supplied'}. Compare suitable alternatives and explain the trade-off.`;
        if (run.feedback)
          request = `Reconsider the recommendation in the previous task. Coordinator feedback: ${run.feedback} Preserve the structured brief and hard requirements. Return a revised recommendation and explanation.`;
        if (run.mode === 'live' && !run.feedback) {
          const decision = await this.decide(
            run.settings,
            COORDINATOR_PROMPT,
            { brief: run.brief, card: run.card },
            run.abort.signal,
          );
          if (decision.action !== 'delegate')
            throw new Error('The coordinator did not produce a valid delegation.');
          request = decision.text;
        }
        this.event(
          run,
          'coordinator',
          run.feedback ? 'Revision delegated' : 'Task delegated',
          request,
        );
      } else {
        request = `The user clarified: ${run.answerText}. Continue this same task and preserve all other requirements.`;
        this.event(run, 'coordinator', 'Clarification sent', request);
      }
      if (run.abort.signal.aborted) return;
      run.phase = 'evaluate';
      let task = await run.client.sendMessage({
        message: message(request, {
          data: { brief: run.brief, mode: run.mode, reviewFeedback: run.feedback },
          taskId: run.taskId || '',
          contextId: run.contextId || '',
          referenceTaskIds: run.previousTaskIds,
        }),
        configuration: {
          returnImmediately: true,
          acceptedOutputModes: ['application/json', 'text/plain'],
          historyLength: 10,
        },
      });
      if (!task.id) throw new Error('The specialist did not return a tracked task.');
      run.taskId = task.id;
      run.contextId = task.contextId;
      let lastStatus = '';
      const deadline = Date.now() + 180000;
      while (true) {
        if (run.abort.signal.aborted) {
          await run.client.cancelTask({ id: run.taskId }).catch(() => {});
          return;
        }
        const state = stateName(task.status.state);
        const statusText = textOf(task.status.message);
        if (statusText && statusText !== lastStatus) {
          this.event(
            run,
            'specialist',
            state === 'input-required'
              ? 'A question before proceeding'
              : state === 'completed'
                ? 'Recommendation returned'
                : 'Specialist update',
            statusText,
          );
          lastStatus = statusText;
        }
        run.taskState = state;
        if (!['submitted', 'working'].includes(state)) break;
        if (Date.now() > deadline) {
          await run.client.cancelTask({ id: run.taskId }).catch(() => {});
          throw new Error('The task exceeded the three-minute limit. Start a new run.');
        }
        await delay(300, undefined, { signal: run.abort.signal });
        task = await run.client.getTask({ id: task.id, historyLength: 10 });
      }
      run.task = {
        id: task.id,
        contextId: task.contextId,
        state: stateName(task.status.state),
        artifacts:
          task.artifacts?.map((artifact) => ({
            artifactId: artifact.artifactId,
            name: artifact.name,
          })) ?? [],
      };
      if (run.task.state === 'input-required') {
        const clarificationData = dataOf(task.status.message);
        if (!['budget', 'priority'].includes(clarificationData?.clarification?.field))
          throw new Error('The specialist requested an unsupported clarification.');
        run.clarification = clarificationData.clarification;
        run.shortlist = clarificationData.candidates ?? [];
        run.state = 'input-required';
        run.phase = 'clarify';
        return;
      }
      if (run.task.state !== 'completed') {
        run.state = run.task.state === 'rejected' ? 'rejected' : 'failed';
        run.phase = 'result';
        run.error = textOf(task.status.message) || 'The specialist could not finish this task.';
        return;
      }
      const data = dataOf(task.artifacts?.[0]);
      run.clarification = null;
      run.phase = 'review';
      const result = validateRecommendation(
        { venueId: data?.venue?.id, reason: data?.reason },
        run.brief,
      );
      if (data?.venue?.price !== result.venue.price)
        throw new Error('The specialist returned a price that does not match the catalogue.');
      run.shortlist = [
        { ...result.venue, unmet: [], stretch: result.stretch },
        ...result.alternatives.filter((venue) => !venue.unmet.length),
      ];
      let summary = `${result.venue.name} fits your workshop: ${result.venue.capacity} seats for ${run.brief.attendees} guests, the required facilities, and AED ${result.venue.price} for four hours. That leaves AED ${run.brief.budget - result.venue.price} of your venue budget. This is a recommendation; no booking has been made.`;
      const explanationIssue = budgetExplanationIssue(result.reason, run.brief, result.venue);
      if (explanationIssue)
        return await this.requestRevision(run, explanationIssue, 'budget-check');
      run.review = {
        action: 'accept',
        text: 'Rehearsal check: capacity, required facilities, and hard limit pass. Preference ranking follows scripted rules.',
      };
      if (run.mode === 'live') {
        const review = await this.decide(
          run.settings,
          REVIEW_PROMPT,
          {
            brief: run.brief,
            result,
            budgetFacts: budgetFacts(run.brief, result.venue),
            revisionCount: run.revisionCount,
          },
          run.abort.signal,
        );
        if (
          !['accept', 'revise', 'reject'].includes(review.action) ||
          review.venueId !== result.venue.id
        )
          throw new Error(
            'The coordinator did not accept this recommendation. Review the trace and start a new run.',
          );
        if (run.abort.signal.aborted) return;
        run.review = { action: review.action, text: review.text, source: 'model' };
        if (review.action === 'revise') return await this.requestRevision(run, review.text);
        if (review.action !== 'accept') {
          run.state = 'rejected';
          run.phase = 'result';
          run.error = `Coordinator did not approve the recommendation: ${review.text}`;
          this.event(run, 'coordinator', 'Recommendation not approved', run.error);
          return;
        }
        const reviewIssue = budgetExplanationIssue(review.text, run.brief, result.venue);
        if (reviewIssue) return await this.requestRevision(run, reviewIssue, 'budget-check');
        summary = review.text;
      }
      if (run.abort.signal.aborted) return;
      this.event(run, 'coordinator', 'Result checked and delivered', summary);
      run.result = {
        ...result,
        summary,
        review: run.review,
        revisionCount: run.revisionCount,
        artifactId: task.artifacts[0].artifactId,
      };
      run.state = 'completed';
      run.phase = 'result';
    } catch (error) {
      if (run.abort.signal.aborted) return;
      run.state = 'failed';
      run.phase = 'result';
      run.error =
        error instanceof ProviderError
          ? error.message
          : error.message || 'The run could not finish.';
      this.event(run, 'system', 'Run could not finish', run.error);
    }
  }

  reply(id, answer) {
    const run = this.runs.get(id);
    if (!run) throw new Error('This run is no longer available.');
    if (run.state !== 'input-required') throw new Error('This run is not waiting for input.');
    const input = typeof answer === 'number' ? { budget: answer } : answer;
    const field = run.clarification?.field;
    if (
      !input ||
      !['budget', 'priority'].includes(field) ||
      !Object.hasOwn(input, field) ||
      Object.keys(input).some((key) => key !== field)
    )
      throw new Error(
        'Answer only the requested clarification. Start a new run to change requirements.',
      );
    const updated = validateBrief({ ...run.brief, [field]: input[field] });
    if (
      (field === 'budget' && updated.budget === null) ||
      (field === 'priority' && !PRIORITIES[updated.priority])
    )
      throw new Error('Provide an answer to the specialist question.');
    run.brief = updated;
    run.answerText =
      field === 'budget'
        ? `maximum venue budget AED ${run.brief.budget}`
        : PRIORITIES[run.brief.priority];
    run.clarification = null;
    run.state = 'working';
    this.event(
      run,
      'user',
      field === 'budget' ? 'Budget supplied' : 'Priority supplied',
      run.answerText,
    );
    void this.execute(run, true);
    return this.view(run);
  }

  async stop(id) {
    const run = this.runs.get(id);
    if (!run) throw new Error('This run is no longer available.');
    if (!['working', 'input-required'].includes(run.state)) return this.view(run);
    run.state = 'canceled';
    run.phase = 'result';
    run.abort.abort();
    if (run.client && run.taskId) await run.client.cancelTask({ id: run.taskId }).catch(() => {});
    run.settings = null;
    return this.view(run);
  }

  close() {
    for (const run of this.runs.values()) run.abort.abort();
  }
}
