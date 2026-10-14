import { $, $$, escapeHtml as e, downloadJson } from './dom.js';

const roles = {
  user: ['You', 'Y'],
  coordinator: ['Coordinator', 'C'],
  specialist: ['Venue specialist', 'V'],
  protocol: ['Discovery', '↔'],
  system: ['System', '!'],
};
const labels = {
  working: 'In progress',
  'input-required': 'Needs your input',
  completed: 'Completed',
  rejected: 'No suitable venue',
  failed: 'Could not finish',
  canceled: 'Stopped',
};
const eventIds = new Set();
const traceSignatures = new Map();
let displayedResult;

function renderComparison(venues) {
  $('#comparison').hidden = !venues.length;
  $('#comparison-grid').innerHTML = venues
    .map(
      (venue) =>
        `<article class="comparison-option"><h3>${e(venue.name)}</h3><strong>AED ${e(venue.price)}</strong><dl><dt>Seats</dt><dd>${e(venue.capacity)}</dd><dt>Noise</dt><dd>${e(venue.noise)}</dd><dt>Separate rooms</dt><dd>${e(venue.breakoutRooms)}</dd></dl><p>${e(venue.note)}</p><span class="stretch-label">${venue.stretch ? `+ AED ${e(venue.stretch)} over preferred budget` : 'No budget stretch'}</span></article>`,
    )
    .join('');
}

export function renderMode(mode) {
  const live = mode === 'live';
  $('#mode-banner').classList.toggle('live', live);
  $('#mode-banner .banner-mark').textContent = live ? 'AI' : 'R';
  $('#mode-banner strong').textContent = live ? 'Live AI mode' : 'Rehearsal mode';
  $('#mode-banner div > span').textContent = live
    ? 'Model-driven decisions. Real A2A requests between local services.'
    : 'Scripted decisions. Real A2A requests between local services.';
}

function renderEvent(event) {
  const [name, initial] = roles[event.role] || roles.system;
  const article = document.createElement('article');
  article.className = `event ${event.role}`;
  article.innerHTML = `<span class="event-avatar" aria-hidden="true">${e(initial)}</span><div class="event-body"><div class="event-heading"><strong>${e(name)}</strong><time></time></div><div class="event-title"></div><p></p></div>`;
  article.querySelector('time').textContent = new Date(event.time).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  article.querySelector('time').dateTime = event.time;
  article.querySelector('.event-title').textContent = event.title;
  article.querySelector('p').textContent = event.text;
  return article;
}

function renderTrace(trace) {
  if (trace.length && !traceSignatures.size) $('#trace-list').replaceChildren();
  for (const entry of trace) {
    const signature = JSON.stringify(entry);
    if (traceSignatures.get(entry.id) === signature) continue;
    let item = document.getElementById(`trace-${entry.id}`);
    if (!item) {
      item = document.createElement('details');
      item.id = `trace-${entry.id}`;
      item.className = 'trace-item';
      $('#trace-list').append(item);
    }
    const method = entry.request?.method || 'Agent Card';
    item.innerHTML = `<summary><b>${e(entry.method)}</b><span>${e(method)}</span><span>${e(entry.status || '…')}</span></summary><h4>Endpoint</h4><pre class="trace-url"></pre><h4>Request</h4><pre class="trace-request"></pre><h4>Response</h4><pre class="trace-response"></pre>`;
    item.querySelector('.trace-url').textContent = entry.url;
    item.querySelector('.trace-request').textContent = entry.request
      ? JSON.stringify(entry.request, null, 2)
      : 'GET · no request body';
    item.querySelector('.trace-response').textContent =
      entry.error ||
      (entry.response ? JSON.stringify(entry.response, null, 2) : 'Waiting for a response…');
    traceSignatures.set(entry.id, signature);
  }
  $('#trace-count').textContent = trace.length;
}

export function renderRun(run) {
  const conversation = $('#conversation-content');
  const followConversation =
    conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight < 80;
  const active = ['working', 'input-required'].includes(run.state);
  renderMode(run.mode);
  $('#mode').value = run.mode;
  $('#priority').value = run.brief.priority ?? 'value';
  $('#budget').value = run.brief.budget ?? '';
  $('#empty-state').hidden = true;
  $('#run-state').textContent =
    run.state === 'rejected' && run.review ? 'Review not approved' : labels[run.state] || run.state;
  $('#run-state').className = `state-pill ${run.state}`;
  $('#stop').hidden = !active;
  $('#reset').disabled = active;
  $$(
    '#brief-form input, #brief-form select, #brief-form textarea, #brief-form button, [data-preset]',
  ).forEach((element) => {
    element.disabled = active || element.id === 'duration';
  });
  $('#working-indicator').hidden = run.state !== 'working';
  $('#working-text').textContent =
    run.phase === 'discover'
      ? 'Discovering the venue specialist…'
      : run.phase === 'review'
        ? 'The coordinator is checking the result…'
        : 'The agents are working…';
  $('#clarification-form').hidden = run.state !== 'input-required';
  const priorityQuestion = run.clarification?.field === 'priority';
  $('#clarification-heading').textContent =
    run.clarification?.question || 'The specialist has a question.';
  $('#budget-answer').hidden = priorityQuestion;
  $('#reply-budget').disabled = priorityQuestion;
  $('#reply-budget').min = String(run.brief.preferredBudget ?? 1);
  $('#priority-answer').hidden = !priorityQuestion;
  $('#reply-priority').disabled = !priorityQuestion;
  renderComparison(run.shortlist ?? []);
  const order = { discover: 0, delegate: 1, evaluate: 1, clarify: 2, review: 3, result: 3 };
  $$('[data-phase]').forEach((element, index) => {
    const phase = order[run.phase] ?? 0;
    element.classList.toggle('active', index === phase);
    // Clarification is optional; do not claim it happened when a full brief skipped it.
    element.classList.toggle(
      'done',
      (index < phase || run.state === 'completed') &&
        (index !== 2 ||
          run.events.some((event) =>
            ['Budget supplied', 'Priority supplied'].includes(event.title),
          )),
    );
  });
  for (const event of run.events) {
    if (eventIds.has(event.id)) continue;
    $('#events').append(renderEvent(event));
    eventIds.add(event.id);
  }
  if (followConversation) conversation.scrollTop = conversation.scrollHeight;
  renderTrace(run.trace);
  $('#task-identifiers').innerHTML = run.taskId
    ? `<dt>Task ID · this piece of work</dt><dd>${e(run.taskId)}</dd><dt>Context ID · this conversation</dt><dd>${e(run.contextId)}</dd><dt>Specialist task state</dt><dd>${e(run.taskState || 'submitted')}</dd>${run.previousTaskIds?.length ? `<dt>Earlier completed task · revision requested</dt><dd>${e(run.previousTaskIds.join(', '))}</dd>` : ''}`
    : '';
  const message =
    run.error ||
    (run.state === 'canceled' ? 'This run was stopped. Start a new run when you’re ready.' : '');
  $('#outcome-message').hidden = !message;
  $('#outcome-message').textContent = message;
  if (run.result && displayedResult !== run.result.artifactId) {
    const { venue, reason } = run.result;
    $('#result').hidden = false;
    $('#result').innerHTML =
      `<div class="result-top"><span class="small-label">03 / THE RETURNED ARTIFACT</span><span class="result-check">✓</span></div><h2 id="result-heading">${e(venue.name)}</h2><p class="result-area">${e(venue.area)} · Fictional venue</p><div class="result-metrics"><div><strong>AED ${e(venue.price.toLocaleString())}</strong><span>Four-hour venue cost</span></div><div><strong>${e(venue.capacity)} seats</strong><span>For ${e(run.brief.attendees)} people</span></div><div><strong>AED ${e((run.brief.budget - venue.price).toLocaleString())}</strong><span>Below hard limit</span></div></div><p class="result-reason">${e(reason)}</p><div class="result-checks"><span>✓ Within hard limit</span><span>✓ Capacity checked</span>${run.brief.projector ? '<span>✓ Projector</span>' : ''}${run.brief.accessible ? '<span>✓ Step-free access</span>' : ''}</div><div class="result-actions"><span>${run.mode === 'live' ? 'Live AI recommendation' : 'Scripted rehearsal result'} · No booking made</span><button id="download-result" class="button secondary">Download result ↓</button></div>`;
    const review = document.createElement('div');
    review.className = 'review-panel';
    review.innerHTML = `<strong>Coordinator review · ${e(run.mode === 'live' ? 'model decision' : 'scripted checks')}</strong><p>${e(run.result.review?.text || run.result.summary)}</p><p class="budget-verdict">${run.result.stretch ? `AED ${e(run.result.stretch)} above the preferred budget; within the AED ${e(run.brief.budget)} hard limit.` : 'Within the preferred budget, if supplied, and the hard spending limit.'}</p><small>${run.revisionCount ? 'One revision requested over A2A; a new task continued the same conversation.' : 'Accepted without a revision. Disagreement is not forced.'}</small>`;
    $('#result .result-actions').before(review);
    $('#download-result').addEventListener('click', () =>
      downloadJson(
        { mode: run.mode, taskId: run.taskId, ...run.result },
        'relay-venue-recommendation.json',
      ),
    );
    displayedResult = run.result.artifactId;
  }
}

export function resetDisplay() {
  eventIds.clear();
  traceSignatures.clear();
  displayedResult = null;
  $('#events').replaceChildren();
  $('#empty-state').hidden = false;
  $('#trace-list').innerHTML =
    '<p class="muted">Start a run to inspect discovery and task messages.</p>';
  $('#trace-count').textContent = '0';
  $('#task-identifiers').replaceChildren();
  $('#run-state').textContent = 'Ready';
  $('#run-state').className = 'state-pill';
  for (const selector of [
    '#clarification-form',
    '#working-indicator',
    '#result',
    '#comparison',
    '#outcome-message',
    '#stop',
  ])
    $(selector).hidden = true;
  $$('[data-phase]').forEach((element) => element.classList.remove('active', 'done'));
  $$(
    '#brief-form input, #brief-form select, #brief-form textarea, #brief-form button, [data-preset]',
  ).forEach((element) => {
    element.disabled = element.id === 'duration';
  });
  $('#reset').disabled = false;
}

const venueDrawing = `<svg viewBox="0 0 160 100" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20 85V29l60-19 60 19v56H20Z"/><path d="M80 10v75M20 29l60 19 60-19M42 47v24l21 7V54L42 47ZM96 54v24l21-7V47L96 54ZM20 85l60 10 60-10M80 85v10"/><path d="m50 32 30-9 30 9-30 10-30-10Z"/><path d="M9 91h142" opacity=".4"/></svg>`;
export function renderCatalogue(venues) {
  $('#catalogue-grid').innerHTML = venues
    .map(
      (venue, index) =>
        `<article class="venue-card"><div class="venue-visual"><span class="venue-number">VENUE / 0${index + 1}</span>${venueDrawing}</div><div class="venue-content"><h2>${e(venue.name)}</h2><p>${e(venue.area)}</p><div class="venue-facts"><strong>AED ${e(venue.price.toLocaleString())}</strong><span>${e(venue.capacity)} people</span></div><div class="venue-features"><span class="${venue.projector ? '' : 'unavailable'}">${venue.projector ? '✓ Projector' : 'No projector'}</span><span class="${venue.accessible ? '' : 'unavailable'}">${venue.accessible ? '✓ Step-free access' : 'Stairs only'}</span></div><p class="venue-note">${e(venue.note)}</p></div></article>`,
    )
    .join('');
}
