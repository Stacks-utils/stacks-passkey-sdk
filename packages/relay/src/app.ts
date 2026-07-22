import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { RelayConfig } from './types.js';
import { RateLimiter } from './rate-limit.js';
import { SponsorService } from './sponsor.js';
import { GasTankStore } from './gas-tank.js';

export function createRelayApp(config: RelayConfig, gasTank?: GasTankStore) {
  const app = new Hono();
  const sponsor = new SponsorService(config, gasTank);
  const limiter = new RateLimiter(config.policy);

  app.use(
    '*',
    cors({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
    })
  );

  app.get('/health', (c) =>
    c.json({ ok: true, sponsorAddress: sponsor.getSponsorAddress(), network: config.network })
  );

  app.get('/v1/project', (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    const auth = c.req.header('Authorization');
    const apiKey = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!apiKey) return c.json({ error: 'Unauthorized' }, 401);
    const project = gasTank.getByApiKey(apiKey);
    if (!project) return c.json({ error: 'Invalid API key' }, 401);
    return c.json({
      projectId: project.id,
      projectName: project.name,
      gasBalanceMicroStx: project.gasBalanceMicroStx.toString(),
      totalSpentMicroStx: project.totalSpentMicroStx.toString(),
      txCount: project.txCount,
    });
  });

  app.get('/v1/admin/projects', (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    if (config.adminApiKey && c.req.header('X-Admin-Key') !== config.adminApiKey) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    return c.json({
      projects: gasTank.listProjects().map((p) => ({
        id: p.id,
        name: p.name,
        apiKey: p.apiKey,
        gasBalanceMicroStx: p.gasBalanceMicroStx.toString(),
        totalSpentMicroStx: p.totalSpentMicroStx.toString(),
        txCount: p.txCount,
        createdAt: p.createdAt,
      })),
    });
  });

  app.post('/v1/admin/projects', async (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    if (config.adminApiKey && c.req.header('X-Admin-Key') !== config.adminApiKey) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const body = await c.req.json<{ name?: string; initialGasMicroStx?: string }>();
    if (!body.name) return c.json({ error: 'Missing name' }, 400);
    const initial = body.initialGasMicroStx ? BigInt(body.initialGasMicroStx) : 1_000_000n;
    const project = gasTank.createProject(body.name, initial);
    return c.json({
      id: project.id,
      name: project.name,
      apiKey: project.apiKey,
      gasBalanceMicroStx: project.gasBalanceMicroStx.toString(),
    });
  });

  app.post('/v1/admin/projects/:id/refill', async (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    if (config.adminApiKey && c.req.header('X-Admin-Key') !== config.adminApiKey) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const body = await c.req.json<{ amountMicroStx?: string }>();
    if (!body.amountMicroStx) return c.json({ error: 'Missing amountMicroStx' }, 400);
    const project = gasTank.refill(c.req.param('id'), BigInt(body.amountMicroStx));
    return c.json({ gasBalanceMicroStx: project.gasBalanceMicroStx.toString() });
  });

  app.get('/v1/admin/projects/:id/logs', (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    if (config.adminApiKey && c.req.header('X-Admin-Key') !== config.adminApiKey) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    return c.json({ logs: gasTank.getLogs(c.req.param('id')) });
  });

  app.post('/sponsor', async (c) => {
    const auth = c.req.header('Authorization');
    const apiKey = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

    let projectId: string | undefined;
    if (gasTank && apiKey) {
      const project = gasTank.getByApiKey(apiKey);
      if (!project) {
        return c.json({ status: 'rejected', reason: 'Invalid API key' }, 401);
      }
      projectId = project.id;
    } else if (config.apiKey) {
      if (auth !== `Bearer ${config.apiKey}`) {
        return c.json({ status: 'rejected', reason: 'Unauthorized' }, 401);
      }
    }

    const clientIp = c.req.header('x-forwarded-for') ?? 'local';
    if (!limiter.check(clientIp)) {
      return c.json({ status: 'rejected', reason: 'Rate limit exceeded' }, 429);
    }

    const body = await c.req.json<{ txHex?: string; billingMode?: 'gasless' | 'account-pay'; estimatedFeeMicroStx?: string }>();
    if (!body.txHex) {
      return c.json({ status: 'rejected', reason: 'Missing txHex' }, 400);
    }

    const billingMode = body.billingMode ?? 'gasless';

    if (gasTank && projectId && billingMode === 'gasless') {
      const project = gasTank.getById(projectId);
      const minFee = config.policy.maxFeeMicroStx;
      if (project && project.gasBalanceMicroStx < minFee) {
        return c.json({ status: 'rejected', reason: 'Insufficient gas tank balance' }, 402);
      }
    }

    try {
      const result = await sponsor.sponsorAndBroadcast(body.txHex, {
        projectId,
        billingMode,
        estimatedFeeMicroStx: body.estimatedFeeMicroStx ? BigInt(body.estimatedFeeMicroStx) : undefined,
      });
      if (result.status === 'rejected') {
        return c.json(result, 400);
      }
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown relay error';
      return c.json({ status: 'rejected', reason: message }, 500);
    }
  });

  return app;
}
