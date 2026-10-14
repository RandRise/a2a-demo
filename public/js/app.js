import { api } from './api.js';
import { $, $$, toast } from './dom.js';
import { renderRun, resetDisplay, renderCatalogue, renderMode } from './render.js';
import { setupConnection, renderConnection } from './connection.js';

let currentRun = null;
let pollTimer;
let revision = 0;
let failures = 0;

function showView(name) {
  $$('.view').forEach((view) => {
    view.hidden = view.id !== `${name}-view`;
  });
  $$('[data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === name);
    button.toggleAttribute('aria-current', button.dataset.view === name);
    if (button.dataset.view === name) button.setAttribute('aria-current', 'page');
  });
  $('#view-name').textContent = {
    workspace: 'Agent-to-agent',
    guide: 'How it works',
    catalogue: 'Venue catalogue',
  }[name];
}

function showTab(name) {
  $$('[data-tab]').forEach((button) => {
    const selected = button.dataset.tab === name;
    button.setAttribute('aria-selected', selected);
    button.tabIndex = selected ? 0 : -1;
  });
  $('#conversation-content').hidden = name !== 'conversation';
  $('#protocol-content').hidden = name !== 'protocol';
}

function update(run) {
  const wasWaiting = currentRun?.state === 'input-required';
  currentRun = run;
  renderRun(run);
  if (run.state === 'input-required' && !wasWaiting)
    $(run.clarification?.field === 'priority' ? '#reply-priority' : '#reply-budget').focus({
      preventScroll: true,
    });
}

async function poll(id, generation) {
  if (generation !== revision) return;
  try {
    const run = await api(`/runs/${id}`);
    if (generation !== revision) return;
    failures = 0;
    update(run);
    if (run.state === 'working') pollTimer = setTimeout(() => poll(id, generation), 450);
  } catch (error) {
    if (generation !== revision) return;
    failures++;
    if (failures === 1) toast(error.message, true);
    if (failures < 4) pollTimer = setTimeout(() => poll(id, generation), 1500);
    else {
      $('#working-indicator').hidden = true;
      $('#outcome-message').hidden = false;
      $('#outcome-message').textContent =
        'Connection lost. The server may still be working. Reload this page after restarting the server.';
      $('#run-state').textContent = 'Connection lost';
    }
  }
}

$('#brief-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearTimeout(pollTimer);
  revision++;
  const generation = revision;
  $('#start').disabled = true;
  try {
    const brief = {
      title: $('#title').value,
      attendees: Number($('#attendees').value),
      budget: $('#budget').value === '' ? null : Number($('#budget').value),
      projector: $('#projector').checked,
      accessible: $('#accessible').checked,
      preferredBudget:
        $('#preferred-budget').value === '' ? null : Number($('#preferred-budget').value),
      priority: $('#priority').value,
      preferences: $('#preferences').value,
    };
    const run = await api('/runs', { method: 'POST', body: { brief, mode: $('#mode').value } });
    resetDisplay();
    currentRun = null;
    failures = 0;
    update(run);
    showTab('conversation');
    pollTimer = setTimeout(() => poll(run.id, generation), 250);
  } catch (error) {
    toast(error.message, true);
    $('#start').disabled = false;
  }
});

$('#clarification-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentRun) return;
  event.submitter.disabled = true;
  try {
    const run = await api(`/runs/${currentRun.id}/reply`, {
      method: 'POST',
      body:
        currentRun.clarification?.field === 'priority'
          ? { priority: $('#reply-priority').value }
          : { budget: Number($('#reply-budget').value) },
    });
    update(run);
    pollTimer = setTimeout(() => poll(run.id, revision), 200);
  } catch (error) {
    toast(error.message, true);
  } finally {
    event.submitter.disabled = false;
  }
});

$('#stop').addEventListener('click', async () => {
  if (!currentRun) return;
  $('#stop').disabled = true;
  try {
    const run = await api(`/runs/${currentRun.id}/stop`, { method: 'POST' });
    clearTimeout(pollTimer);
    revision++;
    update(run);
  } catch (error) {
    toast(error.message, true);
  } finally {
    $('#stop').disabled = false;
  }
});

$('#reset').addEventListener('click', () => {
  clearTimeout(pollTimer);
  revision++;
  currentRun = null;
  resetDisplay();
  renderMode($('#mode').value);
  $('#title').focus({ preventScroll: true });
});
$('#mode').addEventListener('change', () => renderMode($('#mode').value));
$$('[data-view]').forEach((button) =>
  button.addEventListener('click', () => showView(button.dataset.view)),
);
$$('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => showTab(button.dataset.tab));
  button.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const name =
        event.key === 'Home'
          ? 'conversation'
          : event.key === 'End'
            ? 'protocol'
            : button.dataset.tab === 'conversation'
              ? 'protocol'
              : 'conversation';
      showTab(name);
      $(`#${name}-tab`).focus();
    }
  });
});
$$('[data-preset]').forEach((button) =>
  button.addEventListener('click', () => {
    $('#attendees').value = '30';
    $('#projector').checked = true;
    $('#accessible').checked = true;
    const preset = button.dataset.preset;
    $('#budget').value = preset === 'tight' ? '500' : '1600';
    $('#preferred-budget').value = preset === 'tight' ? '500' : '1400';
    $('#priority').value =
      preset === 'discussion' ? 'undecided' : preset === 'quiet' ? 'quiet' : 'value';
    toast(
      button.dataset.preset === 'tight'
        ? 'Budget set to AED 500. Start a new handoff to see the outcome.'
        : 'Preferred budget AED 1,400; hard limit AED 1,600. Start a handoff to compare the options.',
    );
  }),
);
setupConnection((connection) => {
  renderConnection(connection);
  renderMode($('#mode').value);
});

async function initialize() {
  const results = await Promise.allSettled([api('/status'), api('/catalogue')]);
  if (results[0].status === 'fulfilled') renderConnection(results[0].value.connection);
  else toast(results[0].reason.message, true);
  if (results[1].status === 'fulfilled') renderCatalogue(results[1].value.venues);
  else toast(results[1].reason.message, true);
  const activeRunId =
    results[0].status === 'fulfilled' &&
    (results[0].value.activeRunId || results[0].value.latestRunId);
  if (activeRunId) {
    try {
      const run = await api(`/runs/${activeRunId}`);
      $('#title').value = run.brief.title;
      $('#attendees').value = run.brief.attendees;
      $('#budget').value = run.brief.budget ?? '';
      $('#projector').checked = run.brief.projector;
      $('#accessible').checked = run.brief.accessible;
      $('#preferred-budget').value = run.brief.preferredBudget ?? '';
      $('#priority').value = run.brief.priority ?? 'value';
      $('#preferences').value = run.brief.preferences ?? '';
      update(run);
      if (run.state === 'working') pollTimer = setTimeout(() => poll(run.id, revision), 250);
    } catch (error) {
      toast(error.message, true);
    }
  }
}
await initialize();
