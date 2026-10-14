import express from 'express';
import { fileURLToPath } from 'node:url';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import { venueCard } from './protocol/card.mjs';
import { VenueSpecialist } from './agents/specialist.mjs';
import { Coordinator } from './agents/coordinator.mjs';
import { connectionSettings } from './ai/provider.mjs';
import { VENUES } from './domain/catalogue.mjs';
import { localOnly } from './http/security.mjs';

const publicPath = fileURLToPath(new URL('../public/', import.meta.url));
function listen(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });
}

export async function startDemo({
  port = 8780,
  agentPort = 8781,
  settings: initialSettings = null,
  decide,
} = {}) {
  let settings = initialSettings;
  const getSettings = () => settings;
  const specialist = new VenueSpecialist(getSettings, decide);
  const specialistApp = express();
  specialistApp.disable('x-powered-by');
  specialistApp.use(localOnly, express.json({ limit: '32kb' }));
  // Binding first permits ephemeral ports in the integration tests.
  let handler;
  specialistApp.use('/.well-known/agent-card.json', (req, res, next) =>
    agentCardHandler({ agentCardProvider: handler })(req, res, next),
  );
  specialistApp.use('/a2a', (req, res, next) =>
    jsonRpcHandler({ requestHandler: handler, userBuilder: UserBuilder.noAuthentication })(
      req,
      res,
      next,
    ),
  );
  const agentServer = await listen(specialistApp, agentPort);
  const specialistUrl = `http://127.0.0.1:${agentServer.address().port}`;
  handler = new DefaultRequestHandler(
    venueCard(specialistUrl),
    new InMemoryTaskStore(),
    specialist,
  );
  const coordinator = new Coordinator(specialistUrl, getSettings, decide);
  const app = express();
  app.disable('x-powered-by');
  app.use(localOnly, express.json({ limit: '16kb' }));
  app.get('/api/status', (req, res) =>
    res.json({
      protocol: '1.0',
      sdk: '1.3.0',
      specialistUrl,
      activeRunId:
        [...coordinator.runs.values()].find((run) =>
          ['working', 'input-required'].includes(run.state),
        )?.id ?? null,
      latestRunId: [...coordinator.runs.keys()].at(-1) ?? null,
      connection: {
        configured: Boolean(settings),
        provider: settings?.provider ?? 'openai',
        model: settings?.model ?? 'gpt-4.1-mini',
      },
    }),
  );
  app.get('/api/catalogue', (req, res) => res.json({ venues: VENUES, fictional: true }));
  const busy = () =>
    [...coordinator.runs.values()].some((run) => ['working', 'input-required'].includes(run.state));
  app.put('/api/connection', (req, res) => {
    if (busy())
      return res
        .status(409)
        .json({ error: 'Finish or stop the current run before changing the connection.' });
    settings = connectionSettings(req.body, settings);
    res.json({ configured: true, provider: settings.provider, model: settings.model });
  });
  app.delete('/api/connection', (req, res) => {
    if (busy())
      return res
        .status(409)
        .json({ error: 'Finish or stop the current run before disconnecting.' });
    settings = null;
    for (const run of coordinator.runs.values()) run.settings = null;
    res.json({ configured: false });
  });
  app.post('/api/runs', (req, res) => res.status(202).json(coordinator.start(req.body)));
  app.get('/api/runs/:id', (req, res) => {
    const run = coordinator.runs.get(req.params.id);
    if (!run)
      return res.status(404).json({ error: 'Run not found. The server may have restarted.' });
    res.json(coordinator.view(run));
  });
  app.post('/api/runs/:id/reply', (req, res) =>
    res.status(202).json(coordinator.reply(req.params.id, req.body)),
  );
  app.post('/api/runs/:id/stop', async (req, res) =>
    res.json(await coordinator.stop(req.params.id)),
  );
  app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown demo endpoint.' }));
  app.use(express.static(publicPath, { dotfiles: 'deny', index: 'index.html' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({
      error:
        error.type === 'entity.parse.failed'
          ? 'Invalid JSON request.'
          : error.type === 'entity.too.large'
            ? 'Request is too large.'
            : error.message || 'Invalid request.',
    });
  });
  let server;
  try {
    server = await listen(app, port);
  } catch (error) {
    agentServer.close();
    throw error;
  }
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    specialistUrl,
    coordinator,
    async close() {
      coordinator.close();
      specialist.close();
      settings = null;
      await Promise.all(
        [server, agentServer].map(
          (item) =>
            new Promise((resolve) => {
              item.close(resolve);
              item.closeAllConnections();
            }),
        ),
      );
    },
  };
}
