import { api } from './api.js';
import { $, toast } from './dom.js';

export function setupConnection(onChange) {
  const dialog = $('#connection-dialog');
  const clearKey = () => {
    $('#api-key').value = '';
  };
  $('#connection-open').addEventListener('click', () => {
    $('#connection-error').textContent = '';
    dialog.showModal();
  });
  $('#connection-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', clearKey);
  $('#provider').addEventListener('change', () => {
    const local = $('#provider').value === 'ollama';
    $('#key-field').hidden = local;
    $('#ollama-hint').hidden = !local;
    $('#model').value = local ? 'qwen3:8b' : 'gpt-4.1-mini';
    clearKey();
  });
  $('#connection-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    submit.disabled = true;
    $('#connection-error').textContent = '';
    try {
      const connection = await api('/connection', {
        method: 'PUT',
        body: {
          provider: $('#provider').value,
          model: $('#model').value,
          apiKey: $('#api-key').value,
        },
      });
      clearKey();
      onChange(connection);
      dialog.close();
      toast('Connection configured. Select Live AI to use it.');
    } catch (error) {
      $('#connection-error').textContent = error.message;
    } finally {
      clearKey();
      submit.disabled = false;
    }
  });
  $('#disconnect').addEventListener('click', async () => {
    try {
      await api('/connection', { method: 'DELETE' });
      onChange({ configured: false });
      dialog.close();
      toast('Disconnected. Rehearsal mode is ready.');
    } catch (error) {
      $('#connection-error').textContent = error.message;
    }
  });
}

export function renderConnection(connection) {
  $('#connection-dot').classList.toggle('connected', connection.configured);
  $('#connection-label').textContent = connection.configured
    ? `${connection.provider === 'ollama' ? 'Ollama' : 'OpenAI'} · configured`
    : 'Rehearsal is ready';
  const liveOption = $('#mode option[value=live]');
  liveOption.disabled = !connection.configured;
  liveOption.textContent = connection.configured
    ? 'Live AI · model-driven agents'
    : 'Live AI · connect a model';
  if (!connection.configured) $('#mode').value = 'rehearsal';
  if (connection.provider) {
    $('#provider').value = connection.provider;
    $('#key-field').hidden = connection.provider === 'ollama';
    $('#ollama-hint').hidden = connection.provider !== 'ollama';
  }
  if (connection.model) $('#model').value = connection.model;
}
