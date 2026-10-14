import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { TaskState } from '@a2a-js/sdk';
import { AgentEvent } from '@a2a-js/sdk/server';
import { dataOf, dataPart, message, textOf } from '../protocol/messages.mjs';
import {
  validateBrief,
  lookupVenues,
  validateRecommendation,
  clarificationNeeded,
  rehearsalSelection,
  PRIORITIES,
} from '../domain/catalogue.mjs';
import { modelDecision, ProviderError } from '../ai/provider.mjs';
import { SPECIALIST_PROMPT } from './prompts.mjs';

export class VenueSpecialist {
  constructor(getSettings, decide = modelDecision) {
    this.getSettings = getSettings;
    this.decide = decide;
    this.controllers = new Map();
    this.pending = new Map();
    this.contexts = new Map();
  }

  async execute(context, bus) {
    const { taskId, contextId, userMessage } = context;
    const abort = new AbortController();
    this.controllers.set(taskId, abort);
    this.contexts.set(taskId, contextId);
    const status = (state, text, data) =>
      bus.publish(
        AgentEvent.statusUpdate({
          taskId,
          contextId,
          status: {
            state,
            timestamp: new Date().toISOString(),
            message: message(text, { agent: true, taskId, contextId, data }),
          },
        }),
      );
    const snapshot = context.task
      ? {
          ...context.task,
          status: { state: TaskState.TASK_STATE_WORKING, timestamp: new Date().toISOString() },
        }
      : {
          id: taskId,
          contextId,
          status: { state: TaskState.TASK_STATE_SUBMITTED, timestamp: new Date().toISOString() },
          history: [userMessage],
          artifacts: [],
        };
    bus.publish(AgentEvent.task(snapshot));
    try {
      const payload = dataOf(userMessage);
      const brief = validateBrief(payload?.brief);
      if (!['live', 'rehearsal'].includes(payload?.mode))
        throw new Error('Select a supported decision mode.');
      const previous = this.pending.get(taskId);
      if (context.task && !previous)
        throw new Error('This task no longer accepts additional input.');
      if (
        previous &&
        (previous.mode !== payload.mode ||
          [
            'title',
            'attendees',
            'projector',
            'accessible',
            'preferences',
            'preferredBudget',
            ...(previous.field === 'budget' ? ['priority'] : ['budget']),
          ].some((key) => previous.brief[key] !== brief[key]))
      )
        throw new Error(
          'A follow-up must preserve the original task constraints. Start a new task for changes.',
        );
      const settings = previous?.settings ?? this.getSettings();
      status(TaskState.TASK_STATE_WORKING, 'Reviewing the delegated workshop brief.');
      let toolResult = previous?.toolResult;
      for (let step = 0; step < 3; step++) {
        if (payload.mode === 'rehearsal') await delay(350, undefined, { signal: abort.signal });
        if (abort.signal.aborted) throw new ProviderError('Run stopped.');
        let decision;
        if (payload.mode === 'live') {
          decision = await this.decide(
            settings,
            SPECIALIST_PROMPT,
            {
              brief,
              request: textOf(userMessage),
              toolResult,
              reviewFeedback: payload.reviewFeedback || '',
            },
            abort.signal,
          );
        } else if (brief.budget === null) {
          decision = {
            action: 'ask',
            text: 'What is your total venue budget in AED for the four-hour workshop?',
            venueId: '',
          };
        } else if (!toolResult) {
          decision = {
            action: 'lookup',
            text: 'I’ll compare the catalogue against the budget, group size, and required facilities.',
            venueId: '',
          };
        } else if (clarificationNeeded(brief, toolResult) === 'priority') {
          decision = {
            action: 'ask',
            text: 'Which matters most for the suitable options below: saving money, a quieter room, or separate breakout rooms? A benefit may justify spending above your preferred budget, but never above the hard limit.',
            venueId: '',
          };
        } else {
          const selected = rehearsalSelection(toolResult, brief.priority);
          const other = toolResult.filter(
            (venue) => !venue.unmet.length && venue.id !== selected?.id,
          );
          decision = selected
            ? {
                action: 'recommend',
                venueId: selected.id,
                text: `${selected.name} is the scripted choice for "${PRIORITIES[brief.priority] || 'available fit'}" at AED ${selected.price}. ${selected.note} ${other.length ? `Also considered: ${other.map((v) => `${v.name} (AED ${v.price}, ${v.noise} noise, ${v.breakoutRooms} separate rooms)`).join('; ')}.` : 'No other venue meets the hard requirements.'} ${selected.stretch ? `This is AED ${selected.stretch} above the preferred budget, within the hard limit, for the selected benefit.` : 'No stretch above the preferred budget is needed.'}`,
              }
            : {
                action: 'reject',
                venueId: '',
                text: 'No catalogue venue meets every hard requirement within this budget. Start a new request with different constraints.',
              };
        }
        if (abort.signal.aborted) throw new ProviderError('Run stopped.');
        const field = clarificationNeeded(brief, toolResult);
        if (decision.action === 'ask' && field) {
          this.pending.set(taskId, { brief, mode: payload.mode, settings, field, toolResult });
          status(TaskState.TASK_STATE_INPUT_REQUIRED, decision.text, {
            clarification: {
              field,
              question: decision.text,
              options: field === 'priority' ? PRIORITIES : null,
            },
            candidates: toolResult?.filter((venue) => !venue.unmet.length) ?? [],
          });
          return;
        }
        if (decision.action === 'lookup' && !toolResult) {
          toolResult = lookupVenues(brief);
          status(
            TaskState.TASK_STATE_WORKING,
            `Chose lookup: ${decision.text} Used local tool lookupVenues: compared ${toolResult.length} fictional venues. This is a direct function call, not an MCP connection.`,
          );
          continue;
        }
        if (
          decision.action === 'reject' &&
          toolResult &&
          !toolResult.some((venue) => !venue.unmet.length)
        ) {
          this.pending.delete(taskId);
          status(TaskState.TASK_STATE_REJECTED, decision.text);
          return;
        }
        if (decision.action === 'recommend' && toolResult) {
          const result = validateRecommendation(
            { venueId: decision.venueId, reason: decision.text },
            brief,
          );
          this.pending.delete(taskId);
          bus.publish(
            AgentEvent.artifactUpdate({
              taskId,
              contextId,
              append: false,
              lastChunk: true,
              artifact: {
                artifactId: randomUUID(),
                name: 'venue-recommendation',
                description: 'Fictional venue recommendation; no booking made.',
                parts: [dataPart(result)],
                extensions: [],
              },
            }),
          );
          status(TaskState.TASK_STATE_COMPLETED, decision.text);
          return;
        }
        throw new Error('The specialist returned an unsupported or inconsistent decision.');
      }
      throw new Error('The specialist reached its decision limit. Try a new run.');
    } catch (error) {
      this.pending.delete(taskId);
      status(
        abort.signal.aborted ? TaskState.TASK_STATE_CANCELED : TaskState.TASK_STATE_FAILED,
        error instanceof ProviderError
          ? error.message
          : 'The specialist could not produce a valid result for this request.',
      );
    } finally {
      this.controllers.delete(taskId);
      if (!this.pending.has(taskId)) this.contexts.delete(taskId);
      bus.finished();
    }
  }

  async cancelTask(taskId, bus) {
    const controller = this.controllers.get(taskId);
    if (controller) controller.abort();
    this.pending.delete(taskId);
    // The SDK persists the cancellation; publish even for a paused task.
    bus.publish(
      AgentEvent.statusUpdate({
        taskId,
        contextId: this.contexts.get(taskId) || '',
        status: { state: TaskState.TASK_STATE_CANCELED, timestamp: new Date().toISOString() },
      }),
    );
    this.contexts.delete(taskId);
    bus.finished();
  }

  close() {
    for (const controller of this.controllers.values()) controller.abort();
    this.pending.clear();
    this.contexts.clear();
  }
}
